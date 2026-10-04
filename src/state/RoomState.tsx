import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { type Day, days, FACULTIES, type FacultyInfo, hasVacancy, jakartaNow, roomInfo, type Snapshot } from "../../shared/rooms";

/** Shared discovery state and request lifecycle, owned by the application provider. */
function useRoomModel() {
    const initial = jakartaNow();
    const [faculty, setFaculty] = useState<string>("fasilkom");
    const [day, setDay] = useState<Day>(initial.day || "senin");
    const [time, setTime] = useState(initial.time >= "08:00" && initial.time < "18:00" ? initial.time : "08:00");
    const [duration, setDuration] = useState(30);
    const [query, setQuery] = useState("");
    const [building, setBuilding] = useState("all");
    const [type, setType] = useState("all");
    const [includeVirtual, setIncludeVirtual] = useState(false);
    const [showUnavailable, setShowUnavailable] = useState(false);
    const [data, setData] = useState<Snapshot>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const currentFaculty: FacultyInfo = FACULTIES.find(f => f.id === faculty) || FACULTIES[0];

    const load = useCallback(async (targetFaculty = faculty, signal?: AbortSignal) => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`/api/rooms/schedule?faculty=${encodeURIComponent(targetFaculty)}`, { signal });

            if (!response.ok) {
                throw new Error("The schedule is unavailable. Try again in a moment.");
            }

            const json: Snapshot = await response.json();
            setData(json);
        }
        catch (error) {
            if ((error as Error).name !== "AbortError") {
                setError((error as Error).message);
            }
        }
        finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [faculty]);

    useEffect(() => {
        const controller = new AbortController();
        void load(faculty, controller.signal);
        return () => controller.abort();
    }, [faculty, load]);

    const names = data?.schedule ? [...new Set(days.flatMap(value => Object.keys(data.schedule[value] || {})))].sort() : [];
    const candidates = names.filter((name) => {
        const room = roomInfo(name, faculty);

        if (!includeVirtual && room.isVirtual) return false;

        return name.toLowerCase().includes(query.trim().toLowerCase())
            && (building === "all" || room.building === building)
            && (type === "all" || room.type === type);
    });

    const isVacant = (name: string, selected: Day) => {
        const slots = data?.schedule?.[selected]?.[name];
        return hasVacancy(slots, time, duration);
    };

    const hasScheduleForDay = (selected: Day) => {
        if (!data?.schedule?.[selected]) return false;

        return Object.keys(data.schedule[selected]).length > 0;
    };

    const rooms = candidates
        .filter((name) => {
            const hasDayData = Boolean(data?.schedule?.[day] && name in data.schedule[day]);

            if (!hasDayData) {
                // Day has no definite schedule data for this room (e.g. Saturday or unscheduled day)
                // Hidden by default; included only when user toggles showUnavailable
                return showUnavailable;
            }

            return true;
        })
        .sort((a, b) => {
            const aHasData = Boolean(data?.schedule?.[day] && a in data.schedule[day]);
            const bHasData = Boolean(data?.schedule?.[day] && b in data.schedule[day]);

            // Rank: 2 = Vacant (definite), 1 = Unavailable/Occupied (definite), 0 = No data / unscheduled
            const aRank = !aHasData ? 0 : isVacant(a, day) ? 2 : 1;
            const bRank = !bHasData ? 0 : isVacant(b, day) ? 2 : 1;

            if (aRank !== bRank) {
                return bRank - aRank;
            }

            return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: "base",
            });
        });

    return {
        faculty,
        setFaculty,
        currentFaculty,
        day,
        setDay,
        time,
        setTime,
        duration,
        setDuration,
        query,
        setQuery,
        building,
        setBuilding,
        type,
        setType,
        includeVirtual,
        setIncludeVirtual,
        showUnavailable,
        setShowUnavailable,
        data,
        loading,
        error,
        load,
        candidates,
        isVacant,
        hasScheduleForDay,
        rooms,
    };
}

const RoomContext = createContext<ReturnType<typeof useRoomModel> | undefined>(undefined);
const ClockContext = createContext<Date | undefined>(undefined);

/** Application-wide state survives child component unmounts, not page reloads. */
export function RoomStateProvider({ children }: { children: ReactNode }) {
    const model = useRoomModel();
    const [clock, setClock] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <RoomContext.Provider value={model}>
            <ClockContext.Provider value={clock}>
                {children}
            </ClockContext.Provider>
        </RoomContext.Provider>
    );
}

/** Access room discovery state under RoomStateProvider. */
export function useRoomState() {
    const state = useContext(RoomContext);

    if (!state) throw new Error("RoomStateProvider is missing");

    return state;
}

/** Access the shared clock without subscribing to filter changes. */
export function useClock() {
    const clock = useContext(ClockContext);

    if (!clock) throw new Error("Clock provider is missing");

    return clock;
}
