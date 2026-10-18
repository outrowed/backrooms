import { parse } from "devalue";
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App.js";
import { createI18n } from "./i18n/index.js";
import { RoomStateProvider, SSR_DATA_ELEMENT_ID, type SsrPayload } from "./state/RoomState.js";
import "./index.css";
import "./styles/flicker.css";

function readSsrPayload(): SsrPayload | undefined {
    const el = document.getElementById(SSR_DATA_ELEMENT_ID);

    if (!el?.textContent) return undefined;

    try {
        return parse(el.textContent) as SsrPayload;
    }
    catch {
        return undefined;
    }
}

const root = document.getElementById("root");

if (!root) throw new Error("Missing root element");

const ssrPayload = readSsrPayload();
const i18n = createI18n(ssrPayload?.initialLang);

const app = (
    <React.StrictMode>
        <I18nextProvider i18n={i18n}>
            <RoomStateProvider
                initialData={ssrPayload?.initialData}
                initialFaculty={ssrPayload?.initialFaculty}
                initialNow={ssrPayload?.initialNow}
            >
                <App />
            </RoomStateProvider>
        </I18nextProvider>
    </React.StrictMode>
);

if (root.firstElementChild) {
    hydrateRoot(root, app);
}
else {
    createRoot(root).render(app);
}
