import { useState, useRef, type MouseEvent, type TouchEvent } from "react";
import { type ClassSlot, freeSlots, minutes, roomInfo, timeLabel } from "../../shared/rooms.js";
import { useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState.js";

const DAY_START = 480; // 08:00
const DAY_LENGTH = 600; // 10 hours -> 18:00

interface Row {
    start: number;
    end: number;
    label: string;
    vacant: boolean;
}

/** Merge vacant gaps and classes into one chronological 08:00 - 18:00 schedule */
function scheduleRows(classes: ClassSlot[]): Row[] {
    const vacant = freeSlots(classes).map(slot => ({
        ...slot,
        label: "Vacant",
        vacant: true,
    }));
    const booked = classes
        .map(slot => ({
            start: Math.max(DAY_START, minutes(slot.start)),
            end: Math.min(DAY_START + DAY_LENGTH, minutes(slot.end)),
            label: slot.class,
            vacant: false,
        }))
        .filter(row => row.end > row.start);
    return [...vacant, ...booked].sort((a, b) => a.start - b.start || a.end - b.end);
}

const percent = (value: number) => `${((value - DAY_START) / DAY_LENGTH) * 100}%`;

const inDay = (value: number) => value >= DAY_START && value < DAY_START + DAY_LENGTH;

export function RoomCard({ name, classes, time, duration, nowTime, faculty = "fasilkom" }: {
    name: string;
    classes: ClassSlot[] | undefined;
    time: string;
    duration: number;
    nowTime?: string;
    faculty?: string;
}) {
    const { setTime } = useRoomState();
    const room = roomInfo(name, faculty);
    const slots = classes ? freeSlots(classes) : [];
    const rows = classes ? scheduleRows(classes) : [];
    const target = minutes(time);
    const now = nowTime ? minutes(nowTime) : undefined;
    const currentFreeSlot = slots.find(slot => slot.start <= target && target < slot.end);
    const isRoomVacant = Boolean(currentFreeSlot && currentFreeSlot.end >= target + duration);
    const isRoomSemivacant = Boolean(currentFreeSlot && !isRoomVacant);
    const known = classes !== undefined;
    const tooltipId = `room-${room.code.replace(/\W/g, "")}-${name.length}`;
    const statusTooltipId = `status-${room.code.replace(/\W/g, "")}-${name.length}`;
    const { t } = useTranslation();

    const statusText = !known
        ? t("roomCard.noDataBadge")
        : isRoomVacant
            ? t("roomCard.vacantBadge")
            : isRoomSemivacant
                ? t("roomCard.semivacantBadge")
                : t("roomCard.unavailableBadge");

    const statusDesc = !known
        ? t("roomCard.statusDescNoData")
        : isRoomVacant
            ? t("roomCard.statusDescVacant")
            : isRoomSemivacant
                ? t("roomCard.statusDescSemivacant")
                : t("roomCard.statusDescOccupied");

    // Timeline hover / seeking state
    const [hoverPos, setHoverPos] = useState<{
        minute: number;
        clientX: number;
    } | null>(null);
    const touchGesture = useRef<{
        x: number;
        y: number;
        direction: "pending" | "horizontal" | "vertical";
    } | null>(null);
    const suppressTouchClick = useRef(0);
    const timelineRef = useRef<HTMLDivElement>(null);

    // Calculate time (in minutes from midnight) from pointer coordinate
    const getMinuteFromPointer = (clientX: number) => {
        if (!timelineRef.current) return null;

        const rect = timelineRef.current.getBoundingClientRect();

        if (rect.width <= 0) return null;

        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        // Quantize to 5-minute increments for natural UI scrubbing
        const rawMinute = DAY_START + fraction * DAY_LENGTH;
        const rounded = Math.round(rawMinute / 5) * 5;
        return Math.max(DAY_START, Math.min(DAY_START + DAY_LENGTH - 1, rounded));
    };

    const handlePointerMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!known) return;

        const min = getMinuteFromPointer(e.clientX);

        if (min !== null) {
            setHoverPos({
                minute: min,
                clientX: e.clientX,
            });
        }
    };

    const handlePointerLeave = () => {
        setHoverPos(null);
    };

    const handleSeek = (clientX: number) => {
        if (!known) return;

        const min = getMinuteFromPointer(clientX);

        if (min !== null) {
            setTime(timeLabel(min));
        }
    };

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        if (Date.now() < suppressTouchClick.current) return;

        handleSeek(e.clientX);
        setHoverPos(null);
    };

    const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
        if (!known || e.touches.length === 0) return;

        const touch = e.touches[0];
        const gesture = touchGesture.current;

        if (!gesture) return;

        const dx = Math.abs(touch.clientX - gesture.x);
        const dy = Math.abs(touch.clientY - gesture.y);

        if (gesture.direction === "pending" && Math.max(dx, dy) >= 10) {
            gesture.direction = dx > dy * 1.5 ? "horizontal" : "vertical";
        }

        if (gesture.direction !== "horizontal") return;

        const min = getMinuteFromPointer(touch.clientX);

        if (min !== null) {
            setHoverPos({
                minute: min,
                clientX: touch.clientX,
            });
            handleSeek(touch.clientX);
        }
    };

    // Find class or vacant info for hovered minute
    const getSlotInfoAt = (minute: number) => {
        if (!classes) return null;

        const activeClass = classes.find((c) => {
            const start = minutes(c.start);
            const end = minutes(c.end);
            return minute >= start && minute < end;
        });

        if (activeClass) {
            return {
                title: activeClass.class,
                isVacant: false,
                start: activeClass.start,
                end: activeClass.end,
            };
        }

        const activeFree = slots.find(s => minute >= s.start && minute < s.end);

        if (activeFree) {
            return {
                title: t("roomCard.vacantSlot"),
                isVacant: true,
                start: timeLabel(activeFree.start),
                end: timeLabel(activeFree.end),
            };
        }

        return {
            title: t("roomCard.vacantSlot"),
            isVacant: true,
            start: timeLabel(minute),
            end: timeLabel(minute),
        };
    };

    const hoveredInfo = hoverPos ? getSlotInfoAt(hoverPos.minute) : null;

    return (
        <article className={`border p-5 shadow-retro-md ${!known ? "border-room-border-muted bg-room-card-muted/85 opacity-75" : "border-room-border-subtle bg-room-card/90"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="group relative font-pixel text-4xl leading-none text-room-glow">
                    <button type="button" aria-describedby={tooltipId} className="cursor-help underline decoration-dotted decoration-2 underline-offset-4 focus-visible:outline-offset-2">
                        {room.code}
                    </button>
                    <span id={tooltipId} role="tooltip" className="invisible absolute top-full left-0 z-30 mt-2 w-max max-w-64 border border-room-text-subtle bg-room-tooltip-bg px-3 py-2 font-sans text-sm leading-snug text-room-text shadow-retro-sm group-hover:visible group-focus-within:visible">
                        {name}
                    </span>
                </h2>
                <div className="flex items-center gap-2">
                    {room.isVirtual && (
                        <span className="border border-room-online-border bg-room-online-bg px-2 py-1 font-pixel text-lg leading-none text-room-online-text">
                            {t("roomCard.onlineBadge")}
                        </span>
                    )}
                    <div className="group relative inline-flex">
                        <button
                            type="button"
                            aria-describedby={statusTooltipId}
                            className={`cursor-help border px-2 py-1 font-pixel text-xl leading-none focus:outline-none focus:ring-1 focus:ring-room-glow ${
                                !known
                                    ? "border-room-border-muted bg-room-badge-occupied-bg text-room-text-subtle"
                                    : isRoomVacant
                                        ? "border-room-track-free bg-room-button text-room-button-text"
                                        : isRoomSemivacant
                                            ? "border-room-warning-border bg-room-warning text-room-warning-text"
                                            : "border-room-badge-unknown-border text-room-badge-unknown-text"
                            }`}
                        >
                            {statusText}
                        </button>
                        <span
                            id={statusTooltipId}
                            role="tooltip"
                            className="invisible absolute top-full right-0 z-30 mt-2 w-max max-w-64 border border-room-text-subtle bg-room-tooltip-bg px-3 py-2 font-sans text-xs leading-snug text-room-text shadow-retro-sm group-hover:visible group-focus-within:visible"
                        >
                            {statusDesc}
                        </span>
                    </div>
                </div>
            </div>
            <p className="mt-3 text-lg">
                {room.building}
                {" "}
                /
                {" "}
                {room.type}
            </p>
            <p className="mt-3 min-h-6 text-room-glow">
                {isRoomVacant && currentFreeSlot
                    ? t("roomCard.freeUntil", {
                            time: timeLabel(currentFreeSlot.end),
                            left: currentFreeSlot.end - target,
                        })
                    : isRoomSemivacant && currentFreeSlot
                        ? t("roomCard.freeUntilShort", {
                                time: timeLabel(currentFreeSlot.end),
                                left: currentFreeSlot.end - target,
                            })
                        : known
                            ? t("roomCard.noMatchingSlot")
                            : t("roomCard.noScheduleDay")}
            </p>

            {/* Interactive Timeline Bar */}
            <div className="relative mt-5">
                {/* Floating tooltip on hover */}
                {hoverPos && hoveredInfo && (
                    <div
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full mb-2 z-40 -translate-x-1/2 whitespace-nowrap border border-room-text-muted bg-room-tooltip-bg/95 px-2.5 py-1 text-xs text-room-text shadow-retro-sm"
                        style={{
                            left: percent(hoverPos.minute),
                        }}
                    >
                        <div className="flex items-center gap-1.5 font-pixel text-sm text-room-glow">
                            <span>{timeLabel(hoverPos.minute)}</span>
                            <span className="text-room-button">
                                (
                                {hoveredInfo.start}
                                {" "}
                                -
                                {hoveredInfo.end}
                                )
                            </span>
                        </div>
                        <div className={`mt-0.5 max-w-56 truncate ${hoveredInfo.isVacant ? "text-room-text-subtle" : "font-medium text-room-text-occupied"}`}>
                            {hoveredInfo.title}
                        </div>
                    </div>
                )}

                {known
                    ? (
                            <div
                                ref={timelineRef}
                                role="slider"
                                tabIndex={0}
                                aria-label={t("roomCard.seekTimeline")}
                                aria-valuemin={DAY_START}
                                aria-valuemax={DAY_START + DAY_LENGTH}
                                aria-valuenow={target}
                                aria-valuetext={time}
                                onMouseMove={handlePointerMove}
                                onMouseLeave={handlePointerLeave}
                                onClick={handleClick}
                                onTouchStart={(event) => {
                                    const touch = event.touches[0];
                                    suppressTouchClick.current = Date.now() + 1000;
                                    touchGesture.current = {
                                        x: touch.clientX,
                                        y: touch.clientY,
                                        direction: "pending",
                                    };
                                }}
                                style={{ touchAction: "pan-y" }}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={() => {
                                    suppressTouchClick.current = Date.now() + 1000;
                                    touchGesture.current = null;
                                    handlePointerLeave();
                                }}
                                onTouchCancel={() => {
                                    touchGesture.current = null;
                                    handlePointerLeave();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        const newMin = Math.max(DAY_START, target - 5);
                                        setTime(timeLabel(newMin));
                                        setHoverPos(null);
                                    }
                                    else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                                        e.preventDefault();
                                        const newMin = Math.min(DAY_START + DAY_LENGTH - 1, target + 5);
                                        setTime(timeLabel(newMin));
                                        setHoverPos(null);
                                    }
                                }}
                                className="relative h-3.5 cursor-pointer select-none border border-room-border-subtle bg-room-track-occupied focus:outline-none focus:ring-1 focus:ring-room-glow"
                            >
                                {slots.map(slot => (
                                    <span
                                        key={`${slot.start}-${slot.end}`}
                                        aria-hidden="true"
                                        className="pointer-events-none absolute top-0 bottom-0 bg-room-track-free"
                                        style={{
                                            left: percent(slot.start),
                                            width: `${((slot.end - slot.start) / DAY_LENGTH) * 100}%`,
                                        }}
                                    />
                                ))}

                                {/* Active target marker */}
                                {inDay(target) && (
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute -top-1.5 -bottom-1.5 z-10 w-1 -translate-x-1/2 bg-room-glow shadow-seeker"
                                        style={{ left: percent(target) }}
                                    />
                                )}

                                {/* Ghost seeker marker on hover */}
                                {hoverPos && inDay(hoverPos.minute) && (
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute -top-1 -bottom-1 z-10 w-0.5 -translate-x-1/2 bg-white/70"
                                        style={{ left: percent(hoverPos.minute) }}
                                    />
                                )}
                            </div>
                        )
                    : (
                            <div
                                role="img"
                                aria-label={t("roomCard.ariaTimeline")}
                                className="relative flex h-3.5 border border-room-border-muted bg-room-track-muted"
                            />
                        )}
            </div>

            <div className="mt-1 flex justify-between font-pixel text-lg text-room-text-muted">
                <span>08:00</span>
                <span>13:00</span>
                <span>18:00</span>
            </div>

            <details className="mt-4 border-t border-room-border-subtle pt-3">
                <summary className="font-pixel text-2xl text-room-glow">{t("roomCard.viewSchedule")}</summary>
                {known && (
                    <table className="mt-3 w-full border-collapse text-sm">
                        <tbody>
                            {rows.map((row) => {
                                const current = now !== undefined && row.start <= now && now < row.end;
                                return (
                                    <tr key={`${row.start}-${row.end}-${row.label}`} className={`border-t border-room-border-subtle/60 ${current ? "bg-room-row-active" : ""} ${row.vacant ? "text-room-text-vacant" : "text-room-text"}`}>
                                        <td className={`py-2 pl-2 ${current ? "border-l-4 border-room-glow" : "border-l-4 border-transparent"}`}>
                                            {row.vacant ? t("roomCard.vacantScheduleSlot", { min: row.end - row.start }) : row.label}
                                            {current && <span className="ml-2 font-pixel text-base text-room-glow">{t("roomCard.nowMarker")}</span>}
                                        </td>
                                        <td className="py-2 pr-1 text-right whitespace-nowrap tabular-nums">
                                            {timeLabel(row.start)}
                                            -
                                            {timeLabel(row.end)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </details>
        </article>
    );
}
