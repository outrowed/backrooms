import { useTranslation } from "react-i18next";
import { PageHeader } from "./components/PageHeader";
import { PageFooter } from "./components/PageFooter";
import { RoomFilters } from "./components/RoomFilters";
import { WeekNavigation } from "./components/WeekNavigation";
import { RoomResults } from "./components/RoomResults";
import { FacultyNotice } from "./components/FacultyNotice";

export default function App() {
    const { t } = useTranslation();

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
