import { useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState.js";

export function FacultyNotice() {
    const { currentFaculty } = useRoomState();
    const { t } = useTranslation();

    return (
        <aside
            aria-label={`Policy notice for ${currentFaculty.shortName}`}
            className="mt-8 border border-room-border bg-room-surface-notice/95 p-5 shadow-retro-md"
        >
            <h3 className="mb-2 font-pixel text-2xl text-room-glow">
                {t("notice.title", { faculty: currentFaculty.shortName })}
            </h3>
            {currentFaculty.openPolicy
                ? (
                        <p className="text-base text-room-text-body">
                            {t("notice.fasilkomOpenPolicy")}
                        </p>
                    )
                : (
                        <p className="text-base text-room-text-body">
                            {t("notice.otherFacultyPolicy", { faculty: currentFaculty.shortName })}
                        </p>
                    )}
        </aside>
    );
}
