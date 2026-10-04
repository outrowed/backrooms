import { describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { createStore, TTL, validateDay } from "../server/store";
import { days, freeSlots, hasVacancy, jakartaNow, type Schedule } from "../shared/rooms";

const schedule = Object.fromEntries(days.map(day => [day, { "A1.09 (Ged Baru)": [{ start: "10:00", end: "11:40", class: "Example" }] }])) as unknown as Schedule;

describe("availability boundaries", () => {
    it("uses the same minimum vacancy boundary for counters and filtering", () => {
        const classes = [{ start: "09:00", end: "10:00", class: "A" }];
        expect(hasVacancy(classes, "08:30", 30)).toBe(true);
        expect(hasVacancy(classes, "08:30", 31)).toBe(false);
        expect(hasVacancy(undefined, "08:30", 30)).toBe(false);
        expect(hasVacancy([], "18:00", 1)).toBe(false);
        expect(hasVacancy([], "08:00", 0)).toBe(false);
    });
    it("clips classes and merges overlaps without phantom availability", () => {
        expect(freeSlots([{ start: "07:00", end: "09:00", class: "A" }, { start: "08:30", end: "10:00", class: "B" }, { start: "17:00", end: "20:00", class: "C" }])).toEqual([{ start: 600, end: 1020 }]);
        expect(freeSlots([{ start: "19:00", end: "20:00", class: "A" }])).toEqual([{ start: 480, end: 1080 }]);
    });
    it("uses Jakarta day boundaries and marks weekends unknown", () => {
        expect(jakartaNow(new Date("2026-10-04T17:30:00Z"))).toEqual({ day: "senin", time: "00:30" });
        expect(jakartaNow(new Date("2026-10-03T14:00:00Z")).day).toBeUndefined();
    });
    it("rejects invalid upstream times", () => {
        expect(() => validateDay({ Room: [{ start: "25:00", end: "26:00", class: "A" }] })).toThrow();
        expect(() => validateDay({})).toThrow();
    });
});

describe("public SQLite cache", () => {
    it("deduplicates cold loads and serves warm snapshots without fetching", async () => {
        let calls = 0;
        const store = createStore(":memory:", async () => {
            calls++;
            return schedule;
        });
        await Promise.all([store.get(), store.get()]);
        expect(calls).toBe(1);
        expect((await store.get()).schedule).toEqual(schedule);
        expect(calls).toBe(1);
        store.close();
    });
    it("retains stale data on failure and backs off", async () => {
        let clock = 1000;
        let calls = 0;
        const store = createStore(":memory:", async () => {
            if (++calls > 1) throw new Error("offline");

            return schedule;
        }, () => clock);
        await store.get();
        clock += TTL + 1;
        expect((await store.get()).stale).toBe(true);
        await new Promise(resolve => setImmediate(resolve));
        expect((await store.get()).schedule).toEqual(schedule);
        expect(calls).toBe(2);
        store.close();
    });
    it("exposes an unauthenticated read-only schedule and handles cold failure", async () => {
        const store = createStore(":memory:", async () => schedule);
        const app = await createApp(store, "/nonexistent");
        const response = await app.inject("/api/rooms/schedule");
        expect(response.statusCode).toBe(200);
        expect(response.json().schedule).toEqual(schedule);
        expect((await app.inject({ method: "POST", url: "/api/rooms/schedule" })).statusCode).toBe(404);
        await app.close();
        store.close();
        const failed = createStore(":memory:", async () => { throw new Error("offline"); });
        const failedApp = await createApp(failed, "/nonexistent");
        expect((await failedApp.inject("/api/rooms/schedule")).statusCode).toBe(503);
        await failedApp.close();
        failed.close();
    });
});
