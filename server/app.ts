import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { FACULTIES, type Snapshot } from "../shared/rooms.js";
import { renderDocument } from "../src/entry-server.js";
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

    app.addHook("onSend", async (_request, reply) => {
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Content-Security-Policy", "default-src 'self'; img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    });

    app.get("/api/health", async () => ({ ok: true }));

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
