import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { FACULTIES, type Snapshot } from "../shared/rooms.js";
import { renderDocument } from "../src/entry-server.js";
import {
    getAuthenticatedGroups,
    getAuthenticatedUser,
    isAuthorizedAdmin,
    verifyAdminRequest,
} from "./admin.js";
import type { createStore } from "./store.js";

const FALLBACK_HTML = "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Backrooms (of UI)</title></head><body><div id=\"root\"></div></body></html>";

export async function createApp(store: ReturnType<typeof createStore>, staticRoot = resolve("dist")) {
    const app = Fastify({ logger: true });

    const distIndex = resolve(staticRoot, "index.html");
    const rootIndex = resolve("index.html");
    const htmlTemplate = existsSync(distIndex)
        ? readFileSync(distIndex, "utf-8")
        : existsSync(rootIndex)
            ? readFileSync(rootIndex, "utf-8")
            : FALLBACK_HTML;

    const devAuthUser = process.env.DEV_AUTH_USER?.trim();
    const devAuthGroups = process.env.DEV_AUTH_GROUPS?.trim();

    if (devAuthUser || devAuthGroups) {
        app.addHook("onRequest", async (request) => {
            if (devAuthUser && !request.headers["remote-user"] && !request.headers["x-forwarded-user"]) {
                request.headers["remote-user"] = devAuthUser;
            }

            if (devAuthGroups && !request.headers["remote-groups"] && !request.headers["x-forwarded-groups"]) {
                request.headers["remote-groups"] = devAuthGroups;
            }
        });
    }

    app.addHook("onSend", async (_request, reply) => {
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Content-Security-Policy", "default-src 'self'; img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    });

    app.get("/api/health", async () => ({ ok: true }));

    app.get("/api/admin/me", async (request) => {
        const user = getAuthenticatedUser(request);
        const groups = getAuthenticatedGroups(request);
        const admin = isAuthorizedAdmin(user, groups);

        return {
            authenticated: Boolean(user || groups.length > 0),
            user,
            groups,
            isAdmin: admin,
        };
    });

    app.post<{
        Body?: { faculty?: string };
        Querystring?: { faculty?: string };
    }>("/api/admin/cache/refresh", async (request, reply) => {
        const auth = verifyAdminRequest(request);

        if (!auth.ok) {
            return reply.code(auth.status).send({ error: auth.error });
        }

        const facultyParam = request.body?.faculty || request.query?.faculty;

        if (facultyParam === "all") {
            store.invalidate();
            return {
                ok: true,
                faculty: "all",
                invalidated: true,
                message: "All faculty caches have been marked stale and will be re-fetched on demand.",
                by: auth.username,
            };
        }

        const facultyId = facultyParam || "fasilkom";
        const faculty = FACULTIES.find(f => f.id === facultyId);

        if (!faculty) {
            return reply.code(400).send({ error: `Unknown faculty: "${facultyId}"` });
        }

        try {
            const snapshot = await store.refresh(faculty);
            const totalRooms = Object.keys(snapshot.schedule.senin || {}).length;

            return {
                ok: true,
                faculty: faculty.id,
                refreshedAt: snapshot.fetchedAt,
                seninRoomsCount: totalRooms,
                by: auth.username,
            };
        }
        catch (err) {
            return reply.code(502).send({
                error: `Failed to force refresh schedule for ${faculty.shortName}: ${(err as Error).message}`,
            });
        }
    });

    app.get("/api/faculties", async () => ({
        faculties: FACULTIES.map(f => ({
            id: f.id,
            name: f.name,
            shortName: f.shortName,
            openPolicy: f.openPolicy,
        })),
    }));

    app.get<{
        Querystring: { faculty?: string };
    }>("/api/rooms/schedule", async (request, reply) => {
        try {
            const facultyParam = request.query?.faculty || "fasilkom";
            const data = await store.get(facultyParam);

            reply.header("Cache-Control", "public, max-age=60");
            return data;
        }
        catch {
            return reply.code(503).send({ error: "The room schedule is temporarily unavailable. Please try again later." });
        }
    });

    const renderPage = async (
        request: FastifyRequest<{ Querystring: { faculty?: string } }>,
        reply: FastifyReply,
    ) => {
        const requestedFaculty = request.query?.faculty;
        const faculty = FACULTIES.find(f => f.id === requestedFaculty)?.id || "fasilkom";
        let initialData: Snapshot | undefined;

        try {
            initialData = await store.get(faculty);
        }
        catch {}

        const html = renderDocument(htmlTemplate, {
            initialData,
            initialFaculty: faculty,
            initialNow: Date.now(),
            cookieHeader: request.headers.cookie,
            acceptLanguage: request.headers["accept-language"],
        });

        reply.header("Cache-Control", "no-cache");
        reply.type("text/html; charset=utf-8");
        return reply.send(html);
    };

    app.get("/", renderPage);
    app.get("/index.html", renderPage);

    if (existsSync(staticRoot)) {
        await app.register(staticFiles, {
            root: staticRoot,
            index: false,
        });
    }

    return app;
}
