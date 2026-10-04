import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5177,
        strictPort: true,
        allowedHosts: [".ts.net", "backrooms.taruna.me"],
        hmr: { clientPort: 8447 },
        proxy: { "/api": "http://127.0.0.1:3017" },
    },
});
