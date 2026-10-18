import { stringify } from "devalue";
import React from "react";
import { renderToString } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { FACULTIES, type Snapshot } from "../shared/rooms.js";
import App from "./App.js";
import { createI18n, resolveRequestLocale } from "./i18n/index.js";
import { RoomStateProvider, SSR_DATA_ELEMENT_ID, type SsrPayload } from "./state/RoomState.js";

export { SSR_DATA_ELEMENT_ID, type SsrPayload };

export interface RenderDocumentOptions {
    initialData?: Snapshot;
    initialFaculty?: string;
    initialNow?: number;
    cookieHeader?: string;
    acceptLanguage?: string;
}

/** Escape characters that could prematurely terminate an HTML script tag */
export function serializeSsrPayload(payload: SsrPayload): string {
    return stringify(payload);
}

/** Render the application component tree to an HTML string for SSR */
export function renderApp(payload: SsrPayload): string {
    const i18n = createI18n(payload.initialLang);

    return renderToString(
        <React.StrictMode>
            <I18nextProvider i18n={i18n}>
                <RoomStateProvider
                    initialData={payload.initialData}
                    initialFaculty={payload.initialFaculty}
                    initialNow={payload.initialNow}
                >
                    <App />
                </RoomStateProvider>
            </I18nextProvider>
        </React.StrictMode>,
    );
}

/** Inject the server-rendered React markup and hydration payload into the HTML shell */
export function renderPage(options: RenderDocumentOptions = {}) {
    const initialFaculty = FACULTIES.find(f => f.id === options.initialFaculty)?.id
        || options.initialData?.faculty
        || "fasilkom";
    const initialNow = options.initialNow ?? Date.now();
    const initialLang = resolveRequestLocale(options.cookieHeader, options.acceptLanguage);

    const payload: SsrPayload = {
        initialData: options.initialData,
        initialFaculty,
        initialNow,
        initialLang,
    };

    const appHtml = renderApp(payload);
    const serialized = serializeSsrPayload(payload);
    const dataScript = `<script id="${SSR_DATA_ELEMENT_ID}" type="application/json">${serialized}</script>`;

    return {
        element: appHtml,
        data: dataScript,
        lang: initialLang,
    };
}
