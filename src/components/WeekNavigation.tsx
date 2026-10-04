import { useRoomState } from "../state/RoomState";
import { days } from "../../shared/rooms";
const week = [...days, "sabtu"] as const;
const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeekNavigation() {
    const { day, setDay, candidates, isVacant, data } = useRoomState();
    return (
        <nav aria-label="Weekday availability" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {week.map((value, index) => (
                <button type="button" key={value} aria-pressed={day === value} onClick={() => setDay(value)} className={`min-h-20 border p-3 text-left ${day === value ? "border-[#f0e9af] bg-[#a8ba7e] text-[#172719]" : "border-[#a9b68b] bg-[#193326]/95 text-[#edf0d4]"}`}>
                    <span className="block font-pixel text-2xl">{labels[index]}</span>
                    <span className="mt-1 block text-sm">{value === "sabtu" ? "No data" : !data ? "-" : `${candidates.filter(name => isVacant(name, value)).length} vacant`}</span>
                </button>
            ))}
        </nav>

    );
}
