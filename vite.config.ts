import { viteFastify } from "@fastify/vite/plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss(), viteFastify({ clientModule: "/src/entry-server.tsx" })],
    environments: {
        ssr: {
            build: {
                rollupOptions: {
                    input: {
                        "entry-server": "/src/entry-server.tsx",
                    },
                },
            },
        },
    },
    html: { cspNonce: "backrooms-development" },
    server: {
        allowedHosts: [".ts.net", "backrooms.taruna.me"],
        hmr: { clientPort: Number(process.env.HMR_CLIENT_PORT || 8447) },
    },
});
