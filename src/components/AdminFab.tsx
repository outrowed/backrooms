import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState.js";

/** Floating admin control panel anchored to the bottom-right viewport */
export function AdminFab() {
    const { currentFaculty, isAdmin, adminUser, forceRefresh, data } = useRoomState();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshAll, setRefreshAll] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    if (!isAdmin) return null;

    const totalRooms = data?.schedule?.senin ? Object.keys(data.schedule.senin).length : 0;
    const cacheDateStr = data?.fetchedAt
        ? new Date(data.fetchedAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })
        : null;

    const handleForceRefresh = async (target: string) => {
        if (refreshing || refreshAll) return;

        if (target === "all") {
            setRefreshAll(true);
        }
        else {
            setRefreshing(true);
        }

        setStatusMessage(null);

        try {
            await forceRefresh(target);
            const msg = target === "all"
                ? t("admin.refreshAllSuccess")
                : t("admin.refreshSuccess", { faculty: currentFaculty.shortName });
            setStatusMessage(msg);
            setTimeout(() => setStatusMessage(null), 3000);
        }
        catch (err) {
            setStatusMessage((err as Error).message);
            setTimeout(() => setStatusMessage(null), 5000);
        }
        finally {
            setRefreshing(false);
            setRefreshAll(false);
        }
    };

    return (
        <aside
            aria-label={t("admin.panelLabel")}
            className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2"
        >
            {statusMessage && (
                <div
                    role="status"
                    className="border border-room-border bg-room-surface/95 px-3 py-1 font-pixel text-lg text-room-glow shadow-retro-md"
                >
                    {statusMessage}
                </div>
            )}

            {/* Popup Menu / Mini Control Panel */}
            {open && (
                <div
                    role="dialog"
                    aria-label={t("admin.menuTitle")}
                    className="w-72 border-2 border-room-border bg-room-surface/95 p-4 shadow-retro-lg backdrop-blur-xs sm:w-80"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-room-border-subtle pb-2">
                        <span className="font-pixel text-2xl text-room-heading">
                            {t("admin.menuTitle")}
                        </span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label={t("admin.closeMenu")}
                            className="font-pixel text-2xl text-room-text-muted hover:text-white"
                        >
                            [X]
                        </button>
                    </div>

                    {/* Quick Info & Stats */}
                    <div className="space-y-1.5 py-3 text-sm text-room-text-body">
                        {adminUser && (
                            <p className="flex justify-between">
                                <span className="text-room-text-muted">
                                    {t("admin.operator")}
                                    :
                                </span>
                                <span className="font-pixel text-base text-room-glow">{adminUser}</span>
                            </p>
                        )}
                        <p className="flex justify-between">
                            <span className="text-room-text-muted">
                                {t("admin.activeFaculty")}
                                :
                            </span>
                            <span className="font-pixel text-base text-room-glow">{currentFaculty.name}</span>
                        </p>
                        <p className="flex justify-between">
                            <span className="text-room-text-muted">
                                {t("admin.cachedRooms")}
                                :
                            </span>
                            <span className="font-pixel text-base text-room-glow">
                                {t("admin.roomsCount", { count: totalRooms })}
                            </span>
                        </p>
                        {cacheDateStr && (
                            <p className="flex flex-col text-xs text-room-text-muted">
                                <span>
                                    {t("admin.cacheStatus")}
                                    :
                                </span>
                                <span className="font-mono text-room-text-body">
                                    {cacheDateStr}
                                    {" "}
                                    WIB
                                    {data?.stale && (
                                        <span className="ml-1 text-room-warning">
                                            (
                                            {t("admin.staleNotice")}
                                            )
                                        </span>
                                    )}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Actions / Control Buttons */}
                    <div className="space-y-2 border-t border-room-border-subtle pt-3">
                        <span className="block font-pixel text-xl text-room-text-muted">
                            {t("admin.actionsHeading")}
                        </span>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => handleForceRefresh(currentFaculty.id)}
                                disabled={refreshing || refreshAll}
                                className="min-h-9 border border-room-track-free bg-room-button px-3 py-1 text-left font-pixel text-xl text-room-tooltip-bg hover:bg-room-button-hover disabled:opacity-50"
                            >
                                {refreshing
                                    ? t("admin.refreshing")
                                    : t("admin.forceRefreshCurrent", { faculty: currentFaculty.shortName })}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleForceRefresh("all")}
                                disabled={refreshing || refreshAll}
                                className="min-h-9 border border-room-border-subtle bg-room-surface-alt px-3 py-1 text-left font-pixel text-xl text-room-text-muted hover:border-room-border hover:text-white disabled:opacity-50"
                            >
                                {refreshAll ? t("admin.refreshing") : t("admin.invalidateAll")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Floating Bar Trigger */}
            <div className="border-2 border-room-border bg-room-surface/95 p-1.5 shadow-retro-md">
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                    className="min-h-8 border border-room-track-free bg-room-button px-3 py-1 font-pixel text-xl text-room-tooltip-bg hover:bg-room-button-hover"
                    title={t("admin.toggleMenuTitle")}
                >
                    {open ? t("admin.closeTrigger") : t("admin.openTrigger")}
                </button>
            </div>
        </aside>
    );
}
