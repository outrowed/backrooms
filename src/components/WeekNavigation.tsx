import { days } from "../../shared/rooms";
import { useRoomState } from "../state/RoomState";

const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeekNavigation() {
    const { day, setDay, candidates, isVacant, hasScheduleForDay, data } = useRoomState();

    return (
        <nav aria-label="Weekday availability" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {days.map((value, index) => {
                const hasData = hasScheduleForDay(value);
                const vacantCount = candidates.filter(name => isVacant(name, value)).length;

                return (
                    <button
                        type="button"
                        key={value}
                        aria-pressed={day === value}
                        onClick={() => setDay(value)}
                        className={`min-h-20 border p-3 text-left ${day === value ? "border-[#f0e9af] bg-[#a8ba7e] text-[#172719]" : "border-[#a9b68b] bg-[#193326]/95 text-[#edf0d4]"}`}
                    >
                        <span className="block font-pixel text-2xl">{labels[index]}</span>
                        <span className="mt-1 block text-sm">
                            {!data ? "-" : !hasData ? "No data" : `${vacantCount} vacant`}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
