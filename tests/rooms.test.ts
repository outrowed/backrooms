import { describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { parseSlcmClassData } from "../server/slcm";
import { createStore, TTL, validateSchedule } from "../server/store";
import {
    days,
    FACULTIES,
    freeSlots,
    hasVacancy,
    jakartaNow,
    type Schedule,
} from "../shared/rooms";

const schedule = Object.fromEntries(
    days.map(day => [
        day,
        {
            "A1.09 (Ged Baru)": [
                {
                    start: "10:00",
                    end: "11:40",
                    class: "Example",
                },
            ],
        },
    ]),
) as unknown as Schedule;

describe("availability boundaries", () => {
    it("uses the same minimum vacancy boundary for counters and filtering", () => {
        const classes = [
            {
                start: "09:00",
                end: "10:00",
                class: "A",
            },
        ];

        expect(hasVacancy(classes, "08:30", 30)).toBe(true);
        expect(hasVacancy(classes, "08:30", 31)).toBe(false);
        expect(hasVacancy(undefined, "08:30", 30)).toBe(false);
        expect(hasVacancy([], "18:00", 1)).toBe(false);
        expect(hasVacancy([], "08:00", 0)).toBe(false);
    });

    it("clips classes and merges overlaps without phantom availability", () => {
        expect(
            freeSlots([
                {
                    start: "07:00",
                    end: "09:00",
                    class: "A",
                },
                {
                    start: "08:30",
                    end: "10:00",
                    class: "B",
                },
                {
                    start: "17:00",
                    end: "20:00",
                    class: "C",
                },
            ]),
        ).toEqual([
            {
                start: 600,
                end: 1020,
            },
        ]);

        expect(
            freeSlots([
                {
                    start: "19:00",
                    end: "20:00",
                    class: "A",
                },
            ]),
        ).toEqual([
            {
                start: 480,
                end: 1080,
            },
        ]);
    });

    it("uses Jakarta day boundaries including saturday", () => {
        expect(jakartaNow(new Date("2026-10-04T17:30:00Z"))).toEqual({
            day: "senin",
            time: "00:30",
        });

        // Saturday in Jakarta timezone
        expect(jakartaNow(new Date("2026-10-03T05:00:00Z"))).toEqual({
            day: "sabtu",
            time: "12:00",
        });

        // Sunday in Jakarta timezone has no weekday schedule
        expect(jakartaNow(new Date("2026-10-04T05:00:00Z")).day).toBeUndefined();
    });

    it("rejects invalid upstream times", () => {
        expect(() => validateSchedule({
            senin: {
                Room: [
                    {
                        start: "25:00",
                        end: "26:00",
                        class: "A",
                    },
                ],
            },
        })).toThrow();
    });

    it("parses SLCM dates_rooms formats including Saturday and dot separators", () => {
        const parsed = parseSlcmClassData([
            {
                classname: "Alin A",
                dates_rooms: [
                    "Selasa, 10:00-11:40 (A6.10 (Ged Baru))",
                    "Sabtu, 13.00-14.50 (202S (FT))",
                ],
            },
        ]);

        expect(parsed.selasa["A6.10 (Ged Baru)"]).toEqual([
            {
                start: "10:00",
                end: "11:40",
                class: "Alin A",
            },
        ]);

        expect(parsed.sabtu["202S (FT)"]).toEqual([
            {
                start: "13:00",
                end: "14:50",
                class: "Alin A",
            },
        ]);
    });
});

describe("public SQLite cache with multi-faculty on-demand loading", () => {
    it("deduplicates cold loads and serves warm snapshots per faculty", async () => {
        let calls = 0;

        const store = createStore(":memory:", async () => {
            calls++;
            return schedule;
        });

        await Promise.all([store.get("fasilkom"), store.get("fasilkom")]);
        expect(calls).toBe(1);

        expect((await store.get("fasilkom")).schedule).toEqual(schedule);
        expect(calls).toBe(1);

        // Another faculty triggers an on-demand fetch
        await store.get("ft");
        expect(calls).toBe(2);

        store.close();
    });

    it("retains stale data on failure and backs off", async () => {
        let clock = 1000;
        let calls = 0;

        const store = createStore(
            ":memory:",
            async () => {
                if (++calls > 1) throw new Error("offline");

                return schedule;
            },
            () => clock,
        );

        await store.get("fasilkom");
        clock += TTL + 1;

        expect((await store.get("fasilkom")).stale).toBe(true);
        await new Promise(resolve => setImmediate(resolve));

        expect((await store.get("fasilkom")).schedule).toEqual(schedule);
        expect(calls).toBe(2);

        store.close();
    });

    it("exposes public schedule endpoint supporting faculty query parameter", async () => {
        const store = createStore(":memory:", async () => schedule);
        const app = await createApp(store, "/nonexistent");

        const response = await app.inject("/api/rooms/schedule?faculty=fasilkom");
        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body.schedule).toEqual(schedule);
        expect(body.faculty).toBe("fasilkom");

        const facultiesRes = await app.inject("/api/faculties");
        expect(facultiesRes.statusCode).toBe(200);
        expect(facultiesRes.json().faculties.length).toBe(FACULTIES.length);

        await app.close();
        store.close();
    });
});
