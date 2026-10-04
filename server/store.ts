import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
    days,
    FACULTIES,
    type FacultyInfo,
    type Schedule,
    type Snapshot,
} from "../shared/rooms.js";
import { fetchSlcmSchedule } from "./slcm.js";

export const TTL = 3 * 24 * 60 * 60 * 1000;
const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Reject malformed upstream snapshots before replacing the last good cache */
export function validateSchedule(value: unknown): Schedule {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Empty or invalid schedule");
    }

    const scheduleObj = value as Record<string, unknown>;

    for (const day of days) {
        const daySchedule = scheduleObj[day];

        if (daySchedule && typeof daySchedule === "object" && !Array.isArray(daySchedule)) {
            for (const [name, slots] of Object.entries(daySchedule)) {
                if (!name || name.length > 200 || !Array.isArray(slots)) {
                    throw new Error("Invalid room");
                }

                for (const slot of slots) {
                    if (
                        !slot
                        || typeof slot.class !== "string"
                        || !validTime.test(slot.start)
                        || !validTime.test(slot.end)
                        || slot.end <= slot.start
                    ) {
                        throw new Error("Invalid class interval");
                    }
                }
            }
        }
    }

    return value as Schedule;
}

/** Fallback fetcher from csui.cesilia.dev when SLCM credentials are not configured */
export async function fetchCesiliaSchedule(): Promise<Schedule> {
    const entries = await Promise.all(
        days.map(async (day) => {
            if (day === "sabtu") {
                return [day, {}] as const;
            }

            try {
                const response = await fetch(`https://csui.cesilia.dev/ruangan/schedule/${day}.json`, {
                    signal: AbortSignal.timeout(15000),
                });

                if (!response.ok) return [day, {}] as const;

                const json = await response.json();

                return [day, json && typeof json === "object" ? json : {}] as const;
            }
            catch {
                return [day, {}] as const;
            }
        }),
    );

    return Object.fromEntries(entries) as Schedule;
}

export type ScheduleFetcher = (faculty: FacultyInfo) => Promise<Schedule>;

export async function defaultFetcher(faculty: FacultyInfo): Promise<Schedule> {
    try {
        return await fetchSlcmSchedule(faculty);
    }
    catch (err) {
        // If fasilkom, fall back to cesilia if credentials are not configured or request failed
        if (faculty.id === "fasilkom") {
            try {
                const fallback = await fetchCesiliaSchedule();

                if (Object.keys(fallback.senin || {}).length > 0) {
                    return fallback;
                }
            }
            catch {}
        }

        throw err;
    }
}

/** Per-faculty on-demand SQLite cache */
export function createStore(path: string, fetcher: ScheduleFetcher = defaultFetcher, now = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

    const db = new DatabaseSync(path);

    db.exec(`
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS faculty_rooms (
            faculty TEXT NOT NULL,
            name TEXT NOT NULL,
            schedule TEXT NOT NULL,
            PRIMARY KEY (faculty, name)
        );
        CREATE TABLE IF NOT EXISTS faculty_sync (
            faculty TEXT PRIMARY KEY,
            fetched_at INTEGER NOT NULL
        );
    `);

    const inFlightMap = new Map<string, Promise<Snapshot>>();
    const retryAfterMap = new Map<string, number>();

    function read(facultyId: string): Snapshot | undefined {
        const sync = db.prepare("SELECT fetched_at FROM faculty_sync WHERE faculty = ?").get(facultyId) as
            | { fetched_at: number }
            | undefined;

        if (!sync) return undefined;

        const schedule = Object.fromEntries(days.map(day => [day, {}])) as Schedule;

        const rows = db.prepare("SELECT name, schedule FROM faculty_rooms WHERE faculty = ? ORDER BY name").all(facultyId) as {
            name: string;
            schedule: string;
        }[];

        for (const row of rows) {
            const perDay = JSON.parse(row.schedule);

            for (const day of days) {
                if (perDay[day] !== undefined) {
                    schedule[day][row.name] = perDay[day];
                }
            }
        }

        return {
            faculty: facultyId,
            schedule,
            fetchedAt: sync.fetched_at,
            stale: now() - sync.fetched_at >= TTL,
        };
    }

    async function refresh(faculty: FacultyInfo): Promise<Snapshot> {
        const inFlight = inFlightMap.get(faculty.id);

        if (inFlight) return inFlight;

        const promise = (async () => {
            try {
                const schedule = await fetcher(faculty);
                validateSchedule(schedule);

                const names = new Set(days.flatMap(day => Object.keys(schedule[day] || {})));

                db.exec("BEGIN IMMEDIATE");

                try {
                    db.prepare("DELETE FROM faculty_rooms WHERE faculty = ?").run(faculty.id);

                    const insert = db.prepare("INSERT INTO faculty_rooms VALUES (?, ?, ?)");

                    for (const name of names) {
                        const roomDays = Object.fromEntries(
                            days
                                .filter(day => schedule[day] && name in schedule[day])
                                .map(day => [day, schedule[day][name]]),
                        );

                        insert.run(faculty.id, name, JSON.stringify(roomDays));
                    }

                    db.prepare("INSERT OR REPLACE INTO faculty_sync VALUES (?, ?)").run(faculty.id, now());
                    db.exec("COMMIT");
                }
                catch (error) {
                    db.exec("ROLLBACK");
                    throw error;
                }

                retryAfterMap.delete(faculty.id);
                const snapshot = read(faculty.id);

                if (!snapshot) throw new Error("Missing snapshot after refresh");

                return snapshot;
            }
            catch (error) {
                retryAfterMap.set(faculty.id, now() + 5 * 60 * 1000);
                const cached = read(faculty.id);

                if (cached) return cached;

                throw error;
            }
            finally {
                inFlightMap.delete(faculty.id);
            }
        })();

        inFlightMap.set(faculty.id, promise);
        return promise;
    }

    async function get(facultyId = "fasilkom") {
        const faculty = FACULTIES.find(f => f.id === facultyId) || FACULTIES[0];
        const cached = read(faculty.id);
        const retryAfter = retryAfterMap.get(faculty.id) || 0;

        if (cached) {
            if (cached.stale && now() >= retryAfter) {
                void refresh(faculty).catch(() => {});
            }

            return cached;
        }

        if (now() < retryAfter) {
            throw new Error(`Schedule for ${faculty.name} is temporarily unavailable`);
        }

        return refresh(faculty);
    }

    return {
        get,
        refresh,
        close: () => db.close(),
    };
}
