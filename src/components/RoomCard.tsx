import { useState, useRef, type MouseEvent, type TouchEvent } from "react";
import { type ClassSlot, freeSlots, minutes, roomInfo, timeLabel } from "../../shared/rooms";
import { useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState";

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
        handleSeek(e.clientX);
        setHoverPos(null);
    };

    const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
        if (!known || e.touches.length === 0) return;

        const touch = e.touches[0];
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
        <article className={`border p-5 shadow-[4px_4px_0_#101e16] ${!known ? "border-[#525c55] bg-[#1a221e]/85 opacity-75" : "border-[#90a078] bg-[#142e22]/90"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="group relative font-pixel text-4xl leading-none text-[#fff5bb]">
                    <button type="button" aria-describedby={tooltipId} className="cursor-help underline decoration-dotted decoration-2 underline-offset-4 focus-visible:outline-offset-2">
                        {room.code}
                    </button>
                    <span id={tooltipId} role="tooltip" className="invisible absolute top-full left-0 z-30 mt-2 w-max max-w-64 border border-[#c2cea0] bg-[#0e2018] px-3 py-2 font-sans text-sm leading-snug text-[#edf0d4] shadow-[3px_3px_0_#0a140f] group-hover:visible group-focus-within:visible">
                        {name}
                    </span>
                </h2>
                <div className="flex items-center gap-2">
                    {room.isVirtual && (
                        <span className="border border-[#7e9ba6] bg-[#223942] px-2 py-1 font-pixel text-lg leading-none text-[#bde0ee]">
                            {t("roomCard.onlineBadge")}
                        </span>
                    )}
                    <div className="group relative inline-flex">
                        <button
                            type="button"
                            aria-describedby={statusTooltipId}
                            className={`cursor-help border px-2 py-1 font-pixel text-xl leading-none focus:outline-none focus:ring-1 focus:ring-[#fff5bb] ${
                                !known
                                    ? "border-[#68706b] bg-[#2a302d] text-[#9ba39e]"
                                    : isRoomVacant
                                        ? "border-[#b4d08d] bg-[#a5be76] text-[#152515]"
                                        : isRoomSemivacant
                                            ? "border-[#e2b053] bg-[#c49235] text-[#1f190c]"
                                            : "border-[#a4a487] text-[#dedbb5]"
                            }`}
                        >
                            {statusText}
                        </button>
                        <span
                            id={statusTooltipId}
                            role="tooltip"
                            className="invisible absolute top-full right-0 z-30 mt-2 w-max max-w-64 border border-[#c2cea0] bg-[#0e2018] px-3 py-2 font-sans text-xs leading-snug text-[#edf0d4] shadow-[3px_3px_0_#0a140f] group-hover:visible group-focus-within:visible"
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
            <p className="mt-3 min-h-6 text-[#fff5bb]">
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
                        className="pointer-events-none absolute bottom-full mb-2 z-40 -translate-x-1/2 whitespace-nowrap border border-[#d2dfaf] bg-[#0e2218]/95 px-2.5 py-1 text-xs text-[#edf0d4] shadow-[3px_3px_0_#0a140f]"
                        style={{
                            left: percent(hoverPos.minute),
                        }}
                    >
                        <div className="flex items-center gap-1.5 font-pixel text-sm text-[#fff5bb]">
                            <span>{timeLabel(hoverPos.minute)}</span>
                            <span className="text-[#a5be76]">
                                (
                                {hoveredInfo.start}
                                {" "}
                                -
                                {hoveredInfo.end}
                                )
                            </span>
                        </div>
                        <div className={`mt-0.5 max-w-56 truncate ${hoveredInfo.isVacant ? "text-[#c2cea0]" : "font-medium text-[#ffd8a8]"}`}>
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
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handlePointerLeave}
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
                                className="relative flex h-3.5 cursor-pointer select-none border border-[#98aa7d] bg-[#786347] focus:outline-none focus:ring-1 focus:ring-[#fff5bb]"
                            >
                                {Array.from({ length: 60 }, (_, index) => {
                                    const start = DAY_START + index * 10;
                                    const free = slots.some(slot => slot.start <= start && slot.end >= start + 10);
                                    return <span key={start} className={`flex-1 pointer-events-none ${free ? "bg-[#b7cf88]" : "bg-[#786347]"}`} />;
                                })}

                                {/* Active target marker */}
                                {inDay(target) && (
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute -top-1.5 -bottom-1.5 w-1 -translate-x-1/2 bg-[#fff5bb] shadow-[0_0_0_1px_#142e22]"
                                        style={{ left: percent(target) }}
                                    />
                                )}

                                {/* Ghost seeker marker on hover */}
                                {hoverPos && inDay(hoverPos.minute) && (
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 bg-[#ffffff]/70"
                                        style={{ left: percent(hoverPos.minute) }}
                                    />
                                )}
                            </div>
                        )
                    : (
                            <div
                                role="img"
                                aria-label={t("roomCard.ariaTimeline")}
                                className="relative flex h-3.5 border border-[#525c55] bg-[#3a352a]"
                            />
                        )}
            </div>

            <div className="mt-1 flex justify-between font-pixel text-lg text-[#bfca9b]">
                <span>08:00</span>
                <span>13:00</span>
                <span>18:00</span>
            </div>

            <details className="mt-4 border-t border-[#829473] pt-3">
                <summary className="font-pixel text-2xl text-[#fff5bb]">{t("roomCard.viewSchedule")}</summary>
                {known && (
                    <table className="mt-3 w-full border-collapse text-sm">
                        <tbody>
                            {rows.map((row) => {
                                const current = now !== undefined && row.start <= now && now < row.end;
                                return (
                                    <tr key={`${row.start}-${row.end}-${row.label}`} className={`border-t border-[#829473]/60 ${current ? "bg-[#2c4a33]" : ""} ${row.vacant ? "text-[#c9dca1]" : "text-[#edf0d4]"}`}>
                                        <td className={`py-2 pl-2 ${current ? "border-l-4 border-[#fff5bb]" : "border-l-4 border-transparent"}`}>
                                            {row.vacant ? t("roomCard.vacantScheduleSlot", { min: row.end - row.start }) : row.label}
                                            {current && <span className="ml-2 font-pixel text-base text-[#fff5bb]">{t("roomCard.nowMarker")}</span>}
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
