import { describe, expect, it } from "vitest";
import { parseSlcmClassData } from "../server/slcm";
import { roomInfo, vacancyStatus } from "../shared/rooms";

describe("program and campus metadata", () => {
    it("detects Salemba without guessing other campuses", () => {
        expect(roomInfo("Gedung Lama Salemba", "fmipa").building).toBe("Salemba");
        expect(roomInfo("Ruang 101", "fmipa").building).toBe("Kampus UI");
        expect(roomInfo("Ruang 101 SALEMBA", "fmipa").campus).toBe("Salemba");
        expect(roomInfo("Ruang 101", "fmipa").campus).toBeUndefined();
    });

    it("retains overlapping programs and their strata in a shared room", () => {
        const schedule = parseSlcmClassData(["S1", "S2"].map(strata => ({
            classname: "Example",
            prodi: `${strata} Ilmu Komputer`,
            strata,
            dates_rooms: ["Senin, 10.00 - 11.40 (A1.09)"],
        })));
        expect(schedule.senin["A1.09"].map(slot => slot.strata)).toEqual(["S1", "S2"]);
        expect(vacancyStatus(schedule.senin["A1.09"], "10:30", 30)).toBe("occupied");
    });
});

describe("legacy cache migration", () => {
    it("serves pre-strata cache once while refreshing it", async () => {
        const { DatabaseSync } = await import("node:sqlite");
        const { createStore } = await import("../server/store");
        const { mkdtempSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { tmpdir } = await import("node:os");
        const path = join(mkdtempSync(join(tmpdir(), "backrooms-")), "rooms.sqlite");
        const legacy = new DatabaseSync(path);

        legacy.exec(`
            CREATE TABLE faculty_rooms (faculty TEXT NOT NULL, name TEXT NOT NULL, schedule TEXT NOT NULL, PRIMARY KEY (faculty, name));
            CREATE TABLE faculty_sync (faculty TEXT PRIMARY KEY, fetched_at INTEGER NOT NULL);
            INSERT INTO faculty_rooms VALUES ('fasilkom', 'A1.09', '{"senin":[{"start":"10:00","end":"11:40","class":"Old"}]}');
            INSERT INTO faculty_sync VALUES ('fasilkom', ${Date.now()});
        `);
        legacy.close();

        let calls = 0;
        const store = createStore(path, async () => {
            calls++;
            return {
                senin: {},
                selasa: {},
                rabu: {},
                kamis: {},
                jumat: {},
                sabtu: {},
            };
        });

        expect((await store.get("fasilkom")).stale).toBe(true);
        await Promise.resolve();
        expect(calls).toBe(1);
        store.close();
    });
});
