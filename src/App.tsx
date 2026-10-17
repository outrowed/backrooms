import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FacultyNotice } from "./components/FacultyNotice.js";
import { PageFooter } from "./components/PageFooter.js";
import { PageHeader } from "./components/PageHeader.js";
import { RoomFilters } from "./components/RoomFilters.js";
import { RoomResults } from "./components/RoomResults.js";
import { WeekNavigation } from "./components/WeekNavigation.js";
import { LOCALE_STORAGE_KEY, persistBrowserLocale } from "./i18n/index.js";

export default function App() {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        try {
            const saved = localStorage.getItem(LOCALE_STORAGE_KEY);

            if (saved === "en" || saved === "id") {
                persistBrowserLocale(saved);

                if (saved !== i18n.resolvedLanguage && saved !== i18n.language) {
                    void i18n.changeLanguage(saved);
                }
            }
        }
        catch {}
    }, [i18n]);

    return (
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-8 sm:pt-6">
            <a href="#rooms" className="sr-only focus:not-sr-only focus:bg-black focus:p-3">
                {t("common.skipToRooms")}
            </a>
            <PageHeader />

            <main>
                <RoomFilters />
                <WeekNavigation />
                <RoomResults />
            </main>

            <FacultyNotice />
            <PageFooter />
        </div>
    );
}
