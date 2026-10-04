import { resolve } from "node:path";
import { createApp } from "./app.js";
import { createStore } from "./store.js";

const store = createStore(process.env.DB_PATH || resolve("data/rooms.sqlite"));
const app = await createApp(store);
await app.listen({
    port: Number(process.env.PORT || 3017),
    host: process.env.HOST || "0.0.0.0",
});

// Close the listener before releasing SQLite on a container shutdown.
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
        await app.close();
        store.close();
    });
}
