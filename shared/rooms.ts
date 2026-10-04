export const days = ["senin", "selasa", "rabu", "kamis", "jumat"] as const;
export type Day = (typeof days)[number];
export interface ClassSlot {
    start: string;
    end: string;
    class: string;
}
export type Schedule = Record<Day, Record<string, ClassSlot[]>>;
export interface Snapshot {
    schedule: Schedule;
    fetchedAt: number;
    stale: boolean;
}

export function minutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

export function timeLabel(value: number): string { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

/** Merge overlapping classes and clip to the displayed 08:00-18:00 window. */
export function freeSlots(classes: ClassSlot[]) {
    const occupied = classes.map(slot => [Math.max(480, minutes(slot.start)), Math.min(1080, minutes(slot.end))])
        .filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
    const free: {
        start: number;
        end: number;
    }[] = [];
    let cursor = 480;

    for (const [start, end] of occupied) {
        if (start > cursor) free.push({
            start: cursor,
            end: start,
        });

        cursor = Math.max(cursor, end);
    }

    if (cursor < 1080) free.push({
        start: cursor,
        end: 1080,
    });

    return free;
}

export function roomInfo(name: string) {
    const building = /g(d|ed)\.?\s*lama/i.test(name) ? "Gedung Lama" : "Gedung Baru";
    const type = /auditorium/i.test(name) ? "auditorium" : /lab/i.test(name) ? "lab" : "classroom";
    let code = name.match(/[A-Z]\d+\.\d+/)?.[0] ?? name.match(/\d{4}/)?.[0] ?? name;

    if (name.includes("Auditorium Ged Baru-1")) code += "A";

    if (name.includes("+Lab")) code += "+";

    return {
        name,
        code,
        building,
        type,
    };
}

/** Weekends have no supplied schedule: never infer that every room is vacant. */
export function jakartaNow(date = new Date()) {
    const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(date);
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
    }).format(date);
    const day = ({
        Mon: "senin",
        Tue: "selasa",
        Wed: "rabu",
        Thu: "kamis",
        Fri: "jumat",
    } as Record<string, Day>)[weekday];
    return {
        time,
        day,
    };
}

/** True only when a known free interval covers the complete requested stay. */
export function hasVacancy(classes: ClassSlot[] | undefined, time: string, duration: number): boolean {
    if (!classes || !Number.isFinite(duration) || duration < 1) return false;

    const target = minutes(time);
    return freeSlots(classes).some(slot => slot.start <= target && slot.end >= target + duration);
}
