import { type ClassSlot, freeSlots, minutes, roomInfo, timeLabel } from "../../shared/rooms";

const DAY_START = 480;
const DAY_LENGTH = 600;

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
    const room = roomInfo(name, faculty);
    const slots = classes ? freeSlots(classes) : [];
    const rows = classes ? scheduleRows(classes) : [];
    const target = minutes(time);
    const now = nowTime ? minutes(nowTime) : undefined;
    const available = slots.find(slot => slot.start <= target && slot.end >= target + duration);
    const known = classes !== undefined;
    const tooltipId = `room-${room.code.replace(/\W/g, "")}-${name.length}`;

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
                            ONLINE
                        </span>
                    )}
                    <span className={`border px-2 py-1 font-pixel text-xl leading-none ${available ? "border-[#b4d08d] bg-[#a5be76] text-[#152515]" : !known ? "border-[#68706b] bg-[#2a302d] text-[#9ba39e]" : "border-[#a4a487] text-[#dedbb5]"}`}>
                        {!known ? "NO DATA" : available ? "VACANT" : "UNAVAILABLE"}
                    </span>
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
                {available ? `Free until ${timeLabel(available.end)} - ${available.end - target} min left` : known ? "No matching free interval at this time." : "No schedule supplied for this day."}
            </p>

            <div className="relative mt-5">
                <div role="img" className="flex h-3 border border-[#98aa7d] bg-[#786347]" aria-label="Availability from 08:00 to 18:00">
                    {known && Array.from({ length: 60 }, (_, index) => {
                        const start = DAY_START + index * 10;
                        const free = slots.some(slot => slot.start <= start && slot.end >= start + 10);
                        return <span key={start} className={`flex-1 ${free ? "bg-[#b7cf88]" : "bg-[#786347]"}`} />;
                    })}
                </div>
                {known && inDay(target) && (
                    <span aria-hidden="true" className="absolute -top-1.5 -bottom-1.5 w-0.5 -translate-x-1/2 bg-[#fff5bb] shadow-[0_0_0_1px_#142e22]" style={{ left: percent(target) }} />
                )}
            </div>
            <div className="mt-1 flex justify-between font-pixel text-lg text-[#bfca9b]">
                <span>08:00</span>
                <span>13:00</span>
                <span>18:00</span>
            </div>

            <details className="mt-4 border-t border-[#829473] pt-3">
                <summary className="font-pixel text-2xl text-[#fff5bb]">View schedule</summary>
                {known && (
                    <table className="mt-3 w-full border-collapse text-sm">
                        <tbody>
                            {rows.map((row) => {
                                const current = now !== undefined && row.start <= now && now < row.end;
                                return (
                                    <tr key={`${row.start}-${row.end}-${row.label}`} className={`border-t border-[#829473]/60 ${current ? "bg-[#2c4a33]" : ""} ${row.vacant ? "text-[#c9dca1]" : "text-[#edf0d4]"}`}>
                                        <td className={`py-2 pl-2 ${current ? "border-l-4 border-[#fff5bb]" : "border-l-4 border-transparent"}`}>
                                            {row.label}
                                            {current && <span className="ml-2 font-pixel text-base text-[#fff5bb]">&lt; NOW</span>}
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
