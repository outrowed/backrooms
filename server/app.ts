import { existsSync } from "node:fs";
import { resolve } from "node:path";
import staticFiles from "@fastify/static";
import Fastify from "fastify";
import type { createStore } from "./store.js";

export async function createApp(store: ReturnType<typeof createStore>, staticRoot = resolve("dist")) {
    const app = Fastify({ logger: true });

    app.addHook("onSend", async (_request, reply) => {
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Content-Security-Policy", "default-src 'self'; img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    });

    app.get("/api/health", async () => ({ ok: true }));

    app.get("/api/rooms/schedule", async (_request, reply) => {
        try {
            const data = await store.get();
            reply.header("Cache-Control", "public, max-age=60");
            return data;
        }
        catch { return reply.code(503).send({ error: "The room schedule is temporarily unavailable. Please try again later." }); }
    });

    if (existsSync(staticRoot)) await app.register(staticFiles, { root: staticRoot });

    return app;
}
