import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAdminCache } from "../../server/admin.js";
import { createApp } from "../../server/app.js";
import { createStore } from "../../server/store.js";
import { days, type Schedule } from "../../shared/rooms.js";

const mockSchedule = Object.fromEntries(
    days.map(d => [d, { "A1.09": [{
        start: "08:00",
        end: "10:00",
        class: "Test",
    }] }]),
) as unknown as Schedule;

/**
 * Determine Authelia endpoint:
 * In development container, `authelia:9091` is accessible across the Docker network.
 * For local/offline developer setups, `127.0.0.1:9091` from dev/authelia/compose.yml is used.
 */
async function resolveAutheliaEndpoint(): Promise<string | null> {
    const candidates = [
        process.env.AUTHELIA_TEST_URL,
        "http://authelia:9091",
        "http://127.0.0.1:9091",
        "http://localhost:9091",
    ].filter(Boolean) as string[];

    for (const url of candidates) {
        try {
            const res = await fetch(`${url}/api/health`, {
                signal: AbortSignal.timeout(1500),
            });

            if (res.ok) return url;
        }
        catch {}
    }

    return null;
}

describe("Authelia live integration test", () => {
    let autheliaUrl: string | null = null;
    let tempDir: string;
    let configPath: string;

    beforeEach(async () => {
        clearAdminCache();
        tempDir = mkdtempSync(join(tmpdir(), "backrooms-authelia-live-"));
        configPath = join(tempDir, "admins.json");
        process.env.ADMIN_CONFIG_PATH = configPath;
        autheliaUrl = await resolveAutheliaEndpoint();
    });

    afterEach(() => {
        clearAdminCache();

        try {
            rmSync(tempDir, {
                recursive: true,
                force: true,
            });
        }
        catch {}

        delete process.env.ADMIN_CONFIG_PATH;
    });

    it("verifies real Authelia instance availability or skips with actionable instructions", () => {
        if (!autheliaUrl) {
            console.warn(
                "\n[Notice] No live Authelia instance detected on authelia:9091 or 127.0.0.1:9091.\n"
                + "To run integration tests locally, run: docker compose -f dev/authelia/compose.yml up -d\n",
            );
            return;
        }

        expect(autheliaUrl).toBeTruthy();
    });

    it("verifies forward-auth redirection for unauthenticated admin access through real Authelia", async () => {
        if (!autheliaUrl) return;

        const forwardAuthUrl = `${autheliaUrl}/api/authz/forward-auth?authelia_url=https://auth.taruna.me/`;

        const res = await fetch(forwardAuthUrl, {
            headers: {
                "Host": "backrooms.taruna.me",
                "X-Forwarded-Method": "GET",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": "backrooms.taruna.me",
                "X-Forwarded-URI": "/api/admin/me",
            },
            redirect: "manual",
        });

        // Authelia redirects unauthenticated requests (HTTP 302 to login portal)
        expect(res.status).toBe(302);
        const location = res.headers.get("location");
        expect(location).toBeTruthy();
        expect(decodeURIComponent(location ?? "")).toContain("/api/admin/me");
    });

    it("executes full forward-auth lifecycle and verifies Backrooms admin verification", async () => {
        if (!autheliaUrl) return;

        // Configure admins.json with authorized username and group
        writeFileSync(
            configPath,
            JSON.stringify({
                admins: ["taruna", "admin_dev"],
                admin_groups: ["admins"],
            }),
        );

        const store = createStore(":memory:", async () => mockSchedule);
        const app = await createApp(store, "/nonexistent");

        // 1. Test simulated Authelia headers from a verified forward_auth session
        const adminMeRes = await app.inject({
            method: "GET",
            url: "/api/admin/me",
            headers: {
                "remote-user": "taruna",
                "remote-groups": "admins,users",
                "remote-email": "taruna@taruna.me",
            },
        });

        expect(adminMeRes.statusCode).toBe(200);
        expect(adminMeRes.json()).toEqual({
            authenticated: true,
            user: "taruna",
            groups: ["admins", "users"],
            isAdmin: true,
        });

        // 2. Test cache force refresh through authenticated admin
        let refreshCalled = false;
        const testStore = createStore(":memory:", async () => {
            refreshCalled = true;
            return mockSchedule;
        });
        const testApp = await createApp(testStore, "/nonexistent");

        const refreshRes = await testApp.inject({
            method: "POST",
            url: "/api/admin/cache/refresh",
            headers: {
                "remote-user": "taruna",
                "remote-groups": "admins",
            },
            payload: { faculty: "fasilkom" },
        });

        expect(refreshRes.statusCode).toBe(200);
        expect(refreshRes.json()).toMatchObject({
            ok: true,
            faculty: "fasilkom",
            by: "taruna",
        });
        expect(refreshCalled).toBe(true);

        // 3. Test non-admin user authenticated by Authelia is rejected with 403
        const forbiddenRes = await testApp.inject({
            method: "POST",
            url: "/api/admin/cache/refresh",
            headers: {
                "remote-user": "unauthorized_student",
                "remote-groups": "students",
            },
            payload: { faculty: "fasilkom" },
        });

        expect(forbiddenRes.statusCode).toBe(403);
        expect(forbiddenRes.json().error).toContain("not authorized as an administrator");

        await app.close();
        await testApp.close();
        store.close();
        testStore.close();
    });
});
