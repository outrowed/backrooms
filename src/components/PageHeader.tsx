import { useTranslation } from "react-i18next";
import { jakartaNow } from "../../shared/rooms.js";
import { useClock, useRoomState } from "../state/RoomState.js";

export function PageHeader() {
    const clock = useClock();
    const { currentFaculty, setDay, setTime } = useRoomState();
    const { t } = useTranslation();

    const handleClockClick = () => {
        const current = jakartaNow(clock);

        if (current.day) {
            setDay(current.day);
            setTime(current.time);
        }
    };

    return (
        <>
            {/* Sticky Dynamic-Island-style top navigation bar */}
            <div className="sticky top-3 z-30 mb-6">
                <header className="mx-auto flex items-center justify-between gap-1 border-2 border-room-border bg-room-card/95 px-2 py-2.5 font-pixel text-base sm:gap-3 sm:text-xl text-room-text-muted shadow-retro-md sm:px-6">
                    <span className="shrink-0 tracking-wide text-room-glow">
                        {currentFaculty.shortName}
                        {" "}
                        UI
                    </span>
                    <button
                        type="button"
                        onClick={handleClockClick}
                        title={t("filters.setTimeToNow")}
                        aria-label={t("filters.setTimeToNow")}
                        className="group flex cursor-pointer items-baseline gap-1 px-1 py-0.5 text-center text-room-heading transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-room-glow sm:gap-1.5 sm:px-2"
                    >
                        <span className="font-pixel text-xl tabular-nums leading-none group-hover:underline group-hover:decoration-dotted sm:text-3xl">
                            {clock.toLocaleTimeString("en-GB", {
                                timeZone: "Asia/Jakarta",
                                hourCycle: "h23",
                            })}
                        </span>
                        <span className="text-xs text-room-text-subtle group-hover:text-room-text">{t("common.wib")}</span>
                    </button>
                    <a className="shrink-0 underline decoration-1 underline-offset-4 hover:text-room-glow" href="https://sceletracker.taruna.me">
                        {t("header.trackerLink")}
                    </a>
                </header>
            </div>

            {/* Static Backrooms Title Container (does not stick) */}
            <section aria-label="Title" className="border-2 border-room-border bg-room-surface/90 px-5 py-7 shadow-retro-lg sm:px-8">
                <h1 className="text-6xl font-bold tracking-tight text-room-heading sm:text-8xl">Backrooms</h1>
            </section>
        </>
    );
}
