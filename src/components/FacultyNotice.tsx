import { useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState";

export function FacultyNotice() {
    const { currentFaculty } = useRoomState();
    const { t } = useTranslation();

    return (
        <aside
            aria-label={`Policy notice for ${currentFaculty.shortName}`}
            className="mt-8 border border-[#a9b68b] bg-[#163023]/95 p-5 shadow-[4px_4px_0_#101e16]"
        >
            <h3 className="mb-2 font-pixel text-2xl text-[#fff5bb]">
                {t("notice.title", { faculty: currentFaculty.shortName })}
            </h3>
            {currentFaculty.openPolicy
                ? (
                        <p className="text-base text-[#dae0c7]">
                            {t("notice.fasilkomOpenPolicy")}
                        </p>
                    )
                : (
                        <p className="text-base text-[#dae0c7]">
                            {t("notice.otherFacultyPolicy", { faculty: currentFaculty.shortName })}
                        </p>
                    )}
        </aside>
    );
}
