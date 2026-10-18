import { resolve } from "node:path";
import fastifyVite from "@fastify/vite";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { FACULTIES, type Snapshot } from "../shared/rooms.js";
import type { renderPage as renderSsrPage } from "../src/entry-server.js";
import {
    getAuthenticatedGroups,
    getAuthenticatedUser,
    isAuthorizedAdmin,
    verifyAdminRequest,
} from "./admin.js";
import type { createStore } from "./store.js";

export async function createApp(store: ReturnType<typeof createStore>, options: { dev?: boolean } = {}) {
    const app = Fastify({ logger: true });
    const dev = options.dev ?? process.env.NODE_ENV === "development";

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
        reply.header("Content-Security-Policy", `default-src 'self'; img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'${dev ? " 'nonce-backrooms-development'" : ""}; connect-src 'self'${dev ? " ws: wss:" : ""}; frame-ancestors 'none'; base-uri 'self'`);
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

    await app.register(fastifyVite, {
        root: resolve("."),
        dev,
        async createRenderFunction(client) {
            const render = client.renderPage as typeof renderSsrPage;

            return (context) => {
                return render(context as Parameters<typeof renderSsrPage>[0]);
            };
        },
        async createHtmlFunction(source, _scope, config) {
            const template = (await config.createHtmlTemplateFunction(source)) as (context: unknown) => string;

            return function (this: FastifyReply, context: unknown) {
                const ctx = context as { lang?: string } | undefined;
                const lang = ctx?.lang === "id" ? "id" : "en";
                const html = template(context).replace("<html lang=\"en\"", `<html lang="${lang}"`);
                return this.type("text/html; charset=utf-8").send(html);
            };
        },
    });
    await app.vite.ready();

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

        const page = await reply.render({
            initialData,
            initialFaculty: faculty,
            initialNow: Date.now(),
            cookieHeader: request.headers.cookie,
            acceptLanguage: request.headers["accept-language"],
        });

        reply.header("Cache-Control", "no-cache");
        reply.type("text/html; charset=utf-8");
        return reply.html(page);
    };

    app.get("/", renderPage);
    app.get("/index.html", renderPage);

    return app;
}
