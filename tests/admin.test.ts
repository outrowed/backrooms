import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    clearAdminCache,
    getAuthenticatedGroups,
    getAuthenticatedUser,
    isAuthorizedAdmin,
    loadAdminConfig,
    verifyAdminRequest,
} from "../server/admin.js";
import { createApp } from "../server/app.js";
import { createStore } from "../server/store.js";
import { days, type Schedule } from "../shared/rooms.js";

const mockSchedule = Object.fromEntries(
    days.map(d => [d, { "A1.09": [{
        start: "08:00",
        end: "10:00",
        class: "Test",
    }] }]),
) as unknown as Schedule;

describe("admin configuration and auth parsing", () => {
    let tempDir: string;
    let configPath: string;

    beforeEach(() => {
        clearAdminCache();
        tempDir = mkdtempSync(join(tmpdir(), "backrooms-admin-test-"));
        configPath = join(tempDir, "admins.json");
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

        delete process.env.ADMINS_JSON;
        delete process.env.ADMIN_CONFIG_PATH;
        delete process.env.AUTH_USER_HEADER;
    });

    it("parses admin lists from array, object, and nested username/id structures", () => {
        writeFileSync(configPath, JSON.stringify(["taruna", "alex"]));
        const list1 = loadAdminConfig(configPath);
        expect(list1.admins.has("taruna")).toBe(true);
        expect(list1.admins.has("alex")).toBe(true);
        expect(list1.admins.has("stranger")).toBe(false);

        clearAdminCache();
        writeFileSync(
            configPath,
            JSON.stringify({
                admins: [{ username: "taruna" }, { id: "admin-42" }, "plain-user"],
                admin_groups: ["sysadmins", "core-devs"],
            }),
        );
        const list2 = loadAdminConfig(configPath);
        expect(list2.admins.has("taruna")).toBe(true);
        expect(list2.admins.has("admin-42")).toBe(true);
        expect(list2.admins.has("plain-user")).toBe(true);
        expect(list2.groups.has("sysadmins")).toBe(true);
        expect(list2.groups.has("core-devs")).toBe(true);
    });

    it("falls back to empty sets when config file does not exist or is invalid", () => {
        const empty = loadAdminConfig(join(tempDir, "nonexistent.json"));
        expect(empty.admins.size).toBe(0);
        expect(empty.groups.size).toBe(0);

        writeFileSync(configPath, "invalid-json{");
        const invalid = loadAdminConfig(configPath);
        expect(invalid.admins.size).toBe(0);
    });

    it("supports raw JSON string via ADMINS_JSON environment variable", () => {
        process.env.ADMINS_JSON = JSON.stringify({
            admins: ["env-admin"],
            admin_groups: ["env-group"],
        });
        const cfg = loadAdminConfig();
        expect(cfg.admins.has("env-admin")).toBe(true);
        expect(cfg.groups.has("env-group")).toBe(true);
    });

    it("extracts authenticated user and groups from Authelia / proxy headers", () => {
        const mockReqAuthelia = {
            headers: {
                "remote-user": "taruna",
                "remote-groups": "admins,devs",
            },
        } as unknown as FastifyRequest;
        expect(getAuthenticatedUser(mockReqAuthelia)).toBe("taruna");
        expect(getAuthenticatedGroups(mockReqAuthelia)).toEqual(["admins", "devs"]);

        const mockReqPreferred = {
            headers: {
                "remote-preferred-username": "taruna_pref",
            },
        } as unknown as FastifyRequest;
        expect(getAuthenticatedUser(mockReqPreferred)).toBe("taruna_pref");

        const mockReqForwarded = {
            headers: {
                "x-forwarded-user": "forwarded_user",
            },
        } as unknown as FastifyRequest;
        expect(getAuthenticatedUser(mockReqForwarded)).toBe("forwarded_user");
    });

    it("authorizes admins by username or group membership", () => {
        writeFileSync(
            configPath,
            JSON.stringify({
                admins: ["taruna"],
                admin_groups: ["dev-team"],
            }),
        );

        expect(isAuthorizedAdmin("taruna", [], configPath)).toBe(true);
        expect(isAuthorizedAdmin("TARUNA", [], configPath)).toBe(true);
        expect(isAuthorizedAdmin("someone-else", ["dev-team"], configPath)).toBe(true);
        expect(isAuthorizedAdmin("stranger", ["guests"], configPath)).toBe(false);
        expect(isAuthorizedAdmin(null, [], configPath)).toBe(false);
    });

    it("verifies admin requests returning proper 401 or 403 status", () => {
        writeFileSync(configPath, JSON.stringify({ admins: ["taruna"] }));

        const unauthReq = { headers: {} } as unknown as FastifyRequest;
        expect(verifyAdminRequest(unauthReq, configPath)).toEqual({
            ok: false,
            status: 401,
            error: expect.stringContaining("Authentication required"),
        });

        const forbiddenReq = { headers: { "remote-user": "not-allowed" } } as unknown as FastifyRequest;
        expect(verifyAdminRequest(forbiddenReq, configPath)).toEqual({
            ok: false,
            status: 403,
            error: expect.stringContaining("not authorized"),
        });

        const allowedReq = { headers: { "remote-user": "taruna" } } as unknown as FastifyRequest;
        expect(verifyAdminRequest(allowedReq, configPath)).toEqual({
            ok: true,
            username: "taruna",
            groups: [],
        });
    });
});

describe("admin endpoints in Fastify application", () => {
    let tempDir: string;
    let configPath: string;

    beforeEach(() => {
        clearAdminCache();
        tempDir = mkdtempSync(join(tmpdir(), "backrooms-admin-app-test-"));
        configPath = join(tempDir, "admins.json");
        process.env.ADMIN_CONFIG_PATH = configPath;
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

    it("responds with auth identity on GET /api/admin/me", async () => {
        writeFileSync(configPath, JSON.stringify({ admins: ["taruna"] }));
        const store = createStore(":memory:", async () => mockSchedule);
        const app = await createApp(store, { dev: true });

        // 1. Unauthenticated request
        const resUnauth = await app.inject({
            method: "GET",
            url: "/api/admin/me",
        });
        expect(resUnauth.statusCode).toBe(200);
        expect(resUnauth.json()).toEqual({
            authenticated: false,
            user: null,
            groups: [],
            isAdmin: false,
        });

        // 2. Authenticated non-admin request
        const resGuest = await app.inject({
            method: "GET",
            url: "/api/admin/me",
            headers: {
                "remote-user": "guest_user",
            },
        });
        expect(resGuest.statusCode).toBe(200);
        expect(resGuest.json()).toEqual({
            authenticated: true,
            user: "guest_user",
            groups: [],
            isAdmin: false,
        });

        // 3. Authenticated admin request
        const resAdmin = await app.inject({
            method: "GET",
            url: "/api/admin/me",
            headers: {
                "remote-user": "taruna",
            },
        });
        expect(resAdmin.statusCode).toBe(200);
        expect(resAdmin.json()).toEqual({
            authenticated: true,
            user: "taruna",
            groups: [],
            isAdmin: true,
        });

        await app.close();
        store.close();
    });

    it("protects cache refresh and allows authorized admins to force refresh", async () => {
        writeFileSync(configPath, JSON.stringify({ admins: ["taruna"] }));
        let fetchCalls = 0;
        const store = createStore(":memory:", async () => {
            fetchCalls++;
            return mockSchedule;
        });
        const app = await createApp(store, { dev: true });

        // 1. Rejects unauthenticated request with 401
        const resUnauth = await app.inject({
            method: "POST",
            url: "/api/admin/cache/refresh",
            payload: { faculty: "fasilkom" },
        });
        expect(resUnauth.statusCode).toBe(401);

        // 2. Rejects unauthorized user with 403
        const resForbidden = await app.inject({
            method: "POST",
            url: "/api/admin/cache/refresh",
            headers: { "remote-user": "hacker" },
            payload: { faculty: "fasilkom" },
        });
        expect(resForbidden.statusCode).toBe(403);

        // 3. Allows admin to refresh specific faculty
        const resOk = await app.inject({
            method: "POST",
            url: "/api/admin/cache/refresh",
            headers: { "remote-user": "taruna" },
            payload: { faculty: "fasilkom" },
        });
        expect(resOk.statusCode).toBe(200);
        const bodyOk = resOk.json();
        expect(bodyOk.ok).toBe(true);
        expect(bodyOk.faculty).toBe("fasilkom");
        expect(bodyOk.by).toBe("taruna");
        expect(fetchCalls).toBe(1);

        // 4. Allows admin to invalidate all faculties
        const resAll = await app.inject({
            method: "POST",
            url: "/api/admin/cache/refresh",
            headers: { "remote-user": "taruna" },
            payload: { faculty: "all" },
        });
        expect(resAll.statusCode).toBe(200);
        expect(resAll.json().faculty).toBe("all");
        expect(resAll.json().invalidated).toBe(true);

        await app.close();
        store.close();
    });
});
