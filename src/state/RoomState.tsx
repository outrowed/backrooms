import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { type Day, days, hasVacancy, jakartaNow, roomInfo, type Snapshot } from "../../shared/rooms";

/** Shared discovery state and request lifecycle, owned by the application provider. */
function useRoomModel() {
    const initial = jakartaNow();
    const [day, setDay] = useState<Day | "sabtu">(initial.day || "senin");
    const [time, setTime] = useState(initial.day && initial.time >= "08:00" && initial.time < "18:00" ? initial.time : "08:00");
    const [duration, setDuration] = useState(30);
    const [query, setQuery] = useState("");
    const [building, setBuilding] = useState("all");
    const [type, setType] = useState("all");
    const [vacantOnly, setVacantOnly] = useState(true);
    const [data, setData] = useState<Snapshot>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/rooms/schedule", { signal });

            if (!response.ok) throw new Error("The schedule is unavailable. Try again in a moment.");

            setData(await response.json());
        }
        catch (error) { if ((error as Error).name !== "AbortError") setError((error as Error).message); }
        finally { if (!signal?.aborted) setLoading(false); }
    }, []);

    useEffect(() => {
    // Load the public snapshot once; abort outstanding work when leaving the page
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const names = data ? [...new Set(days.flatMap(value => Object.keys(data.schedule[value])))].sort() : [];
    const candidates = names.filter((name) => {
        const room = roomInfo(name);
        return name.toLowerCase().includes(query.trim().toLowerCase())
            && (building === "all" || room.building === building)
            && (type === "all" || room.type === type);
    });

    const isVacant = (name: string, selected: Day) => hasVacancy(data?.schedule[selected][name], time, duration);

    const rooms = day === "sabtu" ? [] : candidates.filter(name => !vacantOnly || isVacant(name, day));

    return { day, setDay, time, setTime, duration, setDuration, query, setQuery, building, setBuilding, type, setType, vacantOnly, setVacantOnly, data, loading, error, load, candidates, isVacant, rooms };
}

const RoomContext = createContext<ReturnType<typeof useRoomModel> | undefined>(undefined);
const ClockContext = createContext<Date | undefined>(undefined);

/** Application-wide state survives child component unmounts, not page reloads. */
export function RoomStateProvider({ children }: { children: ReactNode }) {
    const model = useRoomModel();
    const [clock, setClock] = useState(() => new Date());

    useEffect(() => {
    // Share one WIB timer for the application; release it when the provider unmounts.
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return <RoomContext.Provider value={model}><ClockContext.Provider value={clock}>{children}</ClockContext.Provider></RoomContext.Provider>;
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
