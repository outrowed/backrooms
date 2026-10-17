import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import type { Snapshot } from "./shared/rooms.js";

function ssrDevPlugin(): Plugin {
    return {
        name: "backrooms-ssr-dev",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.method !== "GET" || !req.url) {
                    next();
                    return;
                }

                const url = new URL(req.url, "http://localhost");

                if (url.pathname !== "/" && url.pathname !== "/index.html") {
                    next();
                    return;
                }

                try {
                    const rawTemplate = readFileSync(resolve("index.html"), "utf-8");
                    const template = await server.transformIndexHtml(req.url, rawTemplate);
                    const { renderDocument } = await server.ssrLoadModule("/src/entry-server.tsx");
                    const faculty = url.searchParams.get("faculty") || "fasilkom";
                    let initialData: Snapshot | undefined;

                    try {
                        const apiRes = await fetch(
                            `http://127.0.0.1:3017/api/rooms/schedule?faculty=${encodeURIComponent(faculty)}`,
                            { signal: AbortSignal.timeout(5000) },
                        );

                        if (apiRes.ok) {
                            initialData = await apiRes.json();
                        }
                    }
                    catch {}

                    const html = renderDocument(template, {
                        initialData,
                        initialFaculty: faculty,
                        initialNow: Date.now(),
                        cookieHeader: req.headers.cookie,
                        acceptLanguage: req.headers["accept-language"],
                    });

                    res.statusCode = 200;
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.end(html);
                }
                catch (error) {
                    server.ssrFixStacktrace(error as Error);
                    next(error);
                }
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), tailwindcss(), ssrDevPlugin()],
    server: {
        port: 5177,
        strictPort: true,
        allowedHosts: [".ts.net", "backrooms.taruna.me"],
        hmr: { clientPort: 8447 },
        proxy: { "/api": "http://127.0.0.1:3017" },
    },
});
