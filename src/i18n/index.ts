import { createInstance, type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json" with { type: "json" };
import id from "./locales/id.json" with { type: "json" };

export type SupportedLocale = "en" | "id";

export const defaultNS = "translation";

export const resources = {
    en: {
        translation: en,
    },
    id: {
        translation: id,
    },
} as const;

export const LOCALE_STORAGE_KEY = "backrooms_locale";

/** Determine the request locale from cookies or Accept-Language during SSR */
export function resolveRequestLocale(cookieHeader?: string, acceptLanguage?: string): SupportedLocale {
    if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)backrooms_locale=(en|id)(?:;|$)/);

        if (match) {
            return match[1] as SupportedLocale;
        }
    }

    if (acceptLanguage) {
        const tags = acceptLanguage.split(",");

        for (const raw of tags) {
            const code = raw.split(";")[0].trim().toLowerCase();

            if (code.startsWith("id")) return "id";

            if (code.startsWith("en")) return "en";
        }
    }

    return "en";
}

/** Detect browser locale when rendering without an SSR payload */
export function detectBrowserLocale(): SupportedLocale {
    if (typeof window === "undefined") return "en";

    try {
        const saved = localStorage.getItem(LOCALE_STORAGE_KEY);

        if (saved === "en" || saved === "id") {
            return saved;
        }
    }
    catch {}

    const browserLangs = navigator.languages || [navigator.language];

    for (const lang of browserLangs) {
        if (!lang) continue;

        const code = lang.toLowerCase();

        if (code.startsWith("id")) {
            return "id";
        }

        if (code.startsWith("en")) {
            return "en";
        }
    }

    return "en";
}

/** Persist the selected locale to localStorage and a cookie for subsequent SSR requests */
export function persistBrowserLocale(lng: string) {
    if (typeof window === "undefined") return;

    const normalized: SupportedLocale = lng.startsWith("id") ? "id" : "en";

    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
    }
    catch {}

    // biome-ignore lint/suspicious/noDocumentCookie: Synchronize locale cookie across browsers for SSR requests
    document.cookie = `${LOCALE_STORAGE_KEY}=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Create a synchronous i18next instance for SSR or client hydration */
export function createI18n(initialLanguage?: SupportedLocale): I18nInstance {
    const instance = createInstance();
    const lng = initialLanguage || detectBrowserLocale();

    void instance
        .use(initReactI18next)
        .init({
            resources,
            lng,
            fallbackLng: "en",
            defaultNS,
            interpolation: {
                escapeValue: false,
            },
        });

    if (typeof window !== "undefined") {
        instance.on("languageChanged", (nextLng) => {
            persistBrowserLocale(nextLng);
            document.documentElement.lang = nextLng.startsWith("id") ? "id" : "en";
        });
    }

    return instance;
}

const defaultI18n = createI18n();

export default defaultI18n;
