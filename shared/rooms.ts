export const days = [
    "senin",
    "selasa",
    "rabu",
    "kamis",
    "jumat",
    "sabtu",
] as const;

export type Day = (typeof days)[number];

export interface FacultyInfo {
    id: string;
    name: string;
    shortName: string;
    facultyCode: string;
    orgCode: string;
    openPolicy: boolean;
}

export const FACULTIES: FacultyInfo[] = [
    {
        id: "fasilkom",
        name: "Fakultas Ilmu Komputer (FASILKOM)",
        shortName: "FASILKOM",
        facultyCode: "12.01",
        orgCode: "01.00.12.01",
        openPolicy: true,
    },
    {
        id: "ft",
        name: "Fakultas Teknik (FT)",
        shortName: "FT",
        facultyCode: "04.01",
        orgCode: "01.00.04.01",
        openPolicy: false,
    },
    {
        id: "fmipa",
        name: "Fakultas Matematika dan Ilmu Pengetahuan Alam (FMIPA)",
        shortName: "FMIPA",
        facultyCode: "03.01",
        orgCode: "01.00.03.01",
        openPolicy: false,
    },
    {
        id: "feb",
        name: "Fakultas Ekonomi dan Bisnis (FEB)",
        shortName: "FEB",
        facultyCode: "06.01",
        orgCode: "01.00.06.01",
        openPolicy: false,
    },
    {
        id: "fh",
        name: "Fakultas Hukum (FH)",
        shortName: "FH",
        facultyCode: "05.01",
        orgCode: "01.00.05.01",
        openPolicy: false,
    },
    {
        id: "fpsi",
        name: "Fakultas Psikologi (FPsi)",
        shortName: "FPsi",
        facultyCode: "08.01",
        orgCode: "01.00.08.01",
        openPolicy: false,
    },
    {
        id: "fib",
        name: "Fakultas Ilmu Pengetahuan Budaya (FIB)",
        shortName: "FIB",
        facultyCode: "07.01",
        orgCode: "01.00.07.01",
        openPolicy: false,
    },
    {
        id: "fisip",
        name: "Fakultas Ilmu Sosial dan Ilmu Politik (FISIP)",
        shortName: "FISIP",
        facultyCode: "09.01",
        orgCode: "01.00.09.01",
        openPolicy: false,
    },
    {
        id: "fkm",
        name: "Fakultas Kesehatan Masyarakat (FKM)",
        shortName: "FKM",
        facultyCode: "10.01",
        orgCode: "01.00.10.01",
        openPolicy: false,
    },
    {
        id: "fk",
        name: "Fakultas Kedokteran (FK)",
        shortName: "FK",
        facultyCode: "01.01",
        orgCode: "01.00.01.01",
        openPolicy: false,
    },
    {
        id: "fkg",
        name: "Fakultas Kedokteran Gigi (FKG)",
        shortName: "FKG",
        facultyCode: "02.01",
        orgCode: "01.00.02.01",
        openPolicy: false,
    },
    {
        id: "fik",
        name: "Fakultas Ilmu Keperawatan (FIK)",
        shortName: "FIK",
        facultyCode: "13.01",
        orgCode: "01.00.11.01",
        openPolicy: false,
    },
    {
        id: "ff",
        name: "Fakultas Farmasi (FF)",
        shortName: "FF",
        facultyCode: "17.01",
        orgCode: "01.00.13.01",
        openPolicy: false,
    },
    {
        id: "fia",
        name: "Fakultas Ilmu Administrasi (FIA)",
        shortName: "FIA",
        facultyCode: "18.01",
        orgCode: "01.00.14.01",
        openPolicy: false,
    },
    {
        id: "vokasi",
        name: "Program Pendidikan Vokasi",
        shortName: "VOKASI",
        facultyCode: "15.01",
        orgCode: "01.00.15.01",
        openPolicy: false,
    },
    {
        id: "sksg",
        name: "Sekolah Ilmu Lingkungan & SKSG",
        shortName: "SIL / SKSG",
        facultyCode: "20.01",
        orgCode: "01.00.16.01",
        openPolicy: false,
    },
];

export interface ClassSlot {
    start: string;
    end: string;
    class: string;
    prodi?: string;
    strata?: string;
}

export type Schedule = Record<Day, Record<string, ClassSlot[]>>;

export interface Snapshot {
    faculty: string;
    schedule: Schedule;
    fetchedAt: number;
    stale: boolean;
}

export function minutes(time: string): number {
    const [h, m] = time.split(":").map(Number);

    return h * 60 + m;
}

export function timeLabel(value: number): string {
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Merge overlapping classes and clip to the displayed 08:00-18:00 window. */
export function freeSlots(classes: ClassSlot[]) {
    const occupied = classes
        .map(slot => [Math.max(480, minutes(slot.start)), Math.min(1080, minutes(slot.end))])
        .filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0]);

    const free: {
        start: number;
        end: number;
    }[] = [];

    let cursor = 480;

    for (const [start, end] of occupied) {
        if (start > cursor) {
            free.push({
                start: cursor,
                end: start,
            });
        }

        cursor = Math.max(cursor, end);
    }

    if (cursor < 1080) {
        free.push({
            start: cursor,
            end: 1080,
        });
    }

    return free;
}

export function isVirtualRoom(name: string): boolean {
    return /online|daring|pjj|zoom|kuliah\s+maya|virtual/i.test(name);
}

export function roomInfo(name: string, facultyId = "fasilkom") {
    const campus = /salemba/i.test(name) ? "Salemba" : undefined;
    const building = campus === "Salemba"
        ? "Salemba"
        : /g(d|ed)\.?\s*lama/i.test(name)
            ? "Gedung Lama"
            : /g(d|ed)\.?\s*baru/i.test(name)
                ? "Gedung Baru"
                : /gedung\s+[a-z]/i.test(name) || /gedung\s+[0-9]/i.test(name)
                    ? name.match(/gedung\s+[a-z0-9]+/i)?.[0] ?? "Kampus UI"
                    : "Kampus UI";

    const type = /auditorium/i.test(name)
        ? "auditorium"
        : /lab/i.test(name)
            ? "lab"
            : "classroom";

    // Shorthand room codes are only consistent and defined for FASILKOM.
    // For other faculties, keep code equal to full name to avoid confusing or broken abbreviations.
    if (facultyId !== "fasilkom") {
        return {
            campus,
            name,
            code: name,
            building,
            type,
            isVirtual: isVirtualRoom(name),
        };
    }

    let code = name.match(/[A-Z]\d+\.\d+/)?.[0] ?? name.match(/\d{3,4}[A-Z]?/)?.[0] ?? name;

    if (name.includes("Auditorium Ged Baru-1")) code += "A";

    if (name.includes("+Lab")) code += "+";

    return {
        campus,
        name,
        code,
        building,
        type,
        isVirtual: isVirtualRoom(name),
    };
}

/** Jakarta time helper. Returns matching weekday when schedule is possible. */
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
        Sat: "sabtu",
    } as Record<string, Day>)[weekday];

    return {
        time,
        day,
    };
}

export type VacancyStatus = "vacant" | "semivacant" | "occupied" | "unknown";

/**
 * Classify a room at the target time.
 * - vacant: a free interval covers the whole requested stay
 * - semivacant: free at the target time, but the interval ends before the minimum duration
 * - occupied: a class is running at the target time (or the time is outside 08:00-18:00)
 * - unknown: no schedule was supplied, so availability is never assumed
 */
export function vacancyStatus(classes: ClassSlot[] | undefined, time: string, duration: number): VacancyStatus {
    if (!classes) return "unknown";

    const target = minutes(time);
    const slot = freeSlots(classes).find(free => free.start <= target && target < free.end);

    if (!slot) return "occupied";

    return Number.isFinite(duration) && duration >= 1 && slot.end >= target + duration ? "vacant" : "semivacant";
}

/** True only when a known free interval covers the complete requested stay. */
export function hasVacancy(classes: ClassSlot[] | undefined, time: string, duration: number): boolean {
    return vacancyStatus(classes, time, duration) === "vacant";
}
