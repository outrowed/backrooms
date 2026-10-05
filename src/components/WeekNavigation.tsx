import { days } from "../../shared/rooms";
import { useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState";

export function WeekNavigation() {
    const { day, setDay, candidates, isVacant, hasScheduleForDay, data } = useRoomState();
    const { t } = useTranslation();

    const dayLabels: Record<string, string> = {
        senin: t("weekdays.senin"),
        selasa: t("weekdays.selasa"),
        rabu: t("weekdays.rabu"),
        kamis: t("weekdays.kamis"),
        jumat: t("weekdays.jumat"),
        sabtu: t("weekdays.sabtu"),
    };

    return (
        <nav aria-label="Weekday availability" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {days.map((value) => {
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
                        <span className="block font-pixel text-2xl">{dayLabels[value] || value}</span>
                        <span className="mt-1 block text-sm">
                            {!data ? "-" : !hasData ? t("weekdays.noData") : t("weekdays.vacantCount", { count: vacantCount })}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
