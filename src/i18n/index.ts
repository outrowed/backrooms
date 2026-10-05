import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import id from "./locales/id.json";

export const defaultNS = "translation";

export const resources = {
    en: {
        translation: en,
    },
    id: {
        translation: id,
    },
} as const;

function detectUserLanguage(): "en" | "id" {
    if (typeof window === "undefined") return "en";

    const saved = localStorage.getItem("backrooms_locale");

    if (saved === "en" || saved === "id") {
        return saved;
    }

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

const initialLanguage = detectUserLanguage();

void i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: initialLanguage,
        fallbackLng: "en",
        defaultNS,
        interpolation: {
            escapeValue: false,
        },
    });

if (typeof window !== "undefined") {
    i18n.on("languageChanged", (lng) => {
        localStorage.setItem("backrooms_locale", lng);
    });
}

export default i18n;
