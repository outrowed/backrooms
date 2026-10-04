import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type ClassSlot, days, type Schedule, type Snapshot } from "../shared/rooms.js";

export const TTL = 3 * 24 * 60 * 60 * 1000;
const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Reject malformed upstream snapshots before replacing the last good cache */
export function validateDay(value: unknown): Record<string, ClassSlot[]> {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) { throw new Error("Empty or invalid schedule"); }

    for (const [name, slots] of Object.entries(value)) {
        if (!name || name.length > 200 || !Array.isArray(slots)) { throw new Error("Invalid room"); }

        for (const slot of slots) { if (!slot || typeof slot.class !== "string" || !validTime.test(slot.start) || !validTime.test(slot.end) || slot.end <= slot.start) { throw new Error("Invalid class interval"); } }
    }

    return value as Record<string, ClassSlot[]>;
}

export async function fetchSchedule(): Promise<Schedule> {
    const entries = await Promise.all(days.map(async (day) => {
        const response = await fetch(`https://csui.cesilia.dev/ruangan/schedule/${day}.json`, { signal: AbortSignal.timeout(15000) });

        if (!response.ok) throw new Error(`Schedule source returned ${response.status}`);

        return [day, validateDay(await response.json())] as const;
    }));

    return Object.fromEntries(entries) as Schedule;
}

/** Separate public-only database, with atomic snapshots and single-flight refresh */
export function createStore(path: string, fetcher = fetchSchedule, now = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

    const db = new DatabaseSync(path);

    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (name TEXT PRIMARY KEY, schedule TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sync (id INTEGER PRIMARY KEY CHECK(id=1), fetched_at INTEGER NOT NULL)");

    let inFlight: Promise<Snapshot> | undefined;
    let retryAfter = 0;

    function read(): Snapshot | undefined {
        const sync = db.prepare("SELECT fetched_at FROM sync WHERE id=1").get() as { fetched_at: number } | undefined;

        if (!sync) return;

        const schedule = Object.fromEntries(days.map(day => [day, {}])) as Schedule;

        for (const row of db.prepare("SELECT name, schedule FROM rooms ORDER BY name").all() as { name: string; schedule: string }[]) {
            const perDay = JSON.parse(row.schedule);

            for (const day of days) if (perDay[day] !== undefined) schedule[day][row.name] = perDay[day];
        }

        return { schedule, fetchedAt: sync.fetched_at, stale: now() - sync.fetched_at >= TTL };
    }

    async function refresh(): Promise<Snapshot> {
        if (inFlight) return inFlight;

        inFlight = (async () => {
            try {
                const schedule = await fetcher();

                for (const day of days) validateDay(schedule[day]);

                const names = new Set(days.flatMap(day => Object.keys(schedule[day])));
                db.exec("BEGIN IMMEDIATE");

                try {
                    db.exec("DELETE FROM rooms");
                    const insert = db.prepare("INSERT INTO rooms VALUES (?, ?)");

                    for (const name of names) insert.run(name, JSON.stringify(Object.fromEntries(days.filter(day => name in schedule[day]).map(day => [day, schedule[day][name]]))));

                    db.prepare("INSERT OR REPLACE INTO sync VALUES (1, ?)").run(now());
                    db.exec("COMMIT");
                }
                catch (error) {
                    db.exec("ROLLBACK");
                    throw error;
                }

                retryAfter = 0;
                const snapshot = read();

                if (!snapshot) throw new Error("Missing snapshot after refresh");

                return snapshot;
            }
            catch (error) {
                retryAfter = now() + 5 * 60 * 1000;
                const cached = read();

                if (cached) return cached;

                throw error;
            }
            finally { inFlight = undefined; }
        })();
        return inFlight;
    }

    async function get() {
        const cached = read();

        if (cached) {
            // Visitors receive the last good snapshot immediately; idle service does not poll.
            if (cached.stale && now() >= retryAfter) void refresh().catch(() => {});

            return cached;
        }

        if (now() < retryAfter) throw new Error("Schedule source temporarily unavailable");

        return refresh();
    }

    return { get, refresh, close: () => db.close() };
}
