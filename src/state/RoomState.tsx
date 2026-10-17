import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { type Day, days, FACULTIES, type FacultyInfo, jakartaNow, roomInfo, type Snapshot, vacancyStatus, type VacancyStatus } from "../../shared/rooms.js";
import type { SupportedLocale } from "../i18n/index.js";

export const SSR_DATA_ELEMENT_ID = "backrooms-ssr-data";

export interface SsrPayload {
    initialData?: Snapshot;
    initialFaculty: string;
    initialNow: number;
    initialLang: SupportedLocale;
}

export interface RoomInitialState {
    initialData?: Snapshot;
    initialFaculty?: string;
    initialNow?: number;
}

/** Shared discovery state and request lifecycle, owned by the application provider */
function useRoomModel({ initialData, initialFaculty, initialNow }: RoomInitialState = {}) {
    const initialDate = initialNow !== undefined ? new Date(initialNow) : new Date();
    const initial = jakartaNow(initialDate);
    const resolvedFaculty = FACULTIES.find(f => f.id === initialFaculty)?.id || initialData?.faculty || "fasilkom";
    const [isPending, startTransition] = useTransition();
    const [faculty, setFacultyRaw] = useState<string>(resolvedFaculty);
    const [day, setDay] = useState<Day>(initial.day || "senin");
    const [time, setTime] = useState(initial.time >= "08:00" && initial.time < "18:00" ? initial.time : "08:00");
    const [duration, setDuration] = useState(30);
    const [query, setQuery] = useState("");
    const [building, setBuilding] = useState("all");
    const [type, setType] = useState("all");
    const [includeVirtual, setIncludeVirtual] = useState(false);
    const [showUnavailable, setShowUnavailable] = useState(false);
    const [strata, setStrata] = useState("S1");
    const [sortBy, setSortBy] = useState<"name" | "vacant">("name");
    const [data, setData] = useState<Snapshot | undefined>(initialData);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState("");
    const snapshotCache = useRef(new Map<string, Snapshot>(initialData ? [[initialData.faculty, initialData]] : []));

    const setFaculty = useCallback((nextFaculty: string) => {
        startTransition(() => {
            setFacultyRaw(nextFaculty);
        });
    }, []);

    const currentFaculty: FacultyInfo = useMemo(
        () => FACULTIES.find(f => f.id === faculty) || FACULTIES[0],
        [faculty],
    );

    const load = useCallback(async (targetFaculty = faculty, signal?: AbortSignal) => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`/api/rooms/schedule?faculty=${encodeURIComponent(targetFaculty)}`, { signal });

            if (!response.ok) {
                throw new Error("The schedule is unavailable. Try again in a moment.");
            }

            const json: Snapshot = await response.json();
            snapshotCache.current.set(json.faculty, json);
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
        if (data?.faculty === faculty) {
            setLoading(false);
            return;
        }

        // Revisited faculties render instantly from the per-session snapshot cache
        const cached = snapshotCache.current.get(faculty);

        if (cached) {
            setData(cached);
            return;
        }

        const controller = new AbortController();
        void load(faculty, controller.signal);
        return () => controller.abort();
    }, [data?.faculty, faculty, load]);

    const names = useMemo(() => {
        if (!data?.schedule) return [];

        return [...new Set(days.flatMap(value => Object.keys(data.schedule[value] || {})))].sort();
    }, [data?.schedule]);

    const candidates = useMemo(() => {
        const queryNormalized = query.trim().toLowerCase();

        return names.filter((name) => {
            const room = roomInfo(name, faculty);

            // Strata only filters which rooms are listed; every program's classes still count as occupied
            // Rooms without strata metadata cannot be classified, so they stay visible
            const slots = days.flatMap(value => data?.schedule[value]?.[name] ?? []);

            if (strata !== "all" && slots.some(slot => slot.strata) && !slots.some(slot => slot.strata === strata)) return false;

            if (!includeVirtual && room.isVirtual) return false;

            return name.toLowerCase().includes(queryNormalized)
                && (building === "all" || room.building === building)
                && (type === "all" || room.type === type);
        });
    }, [names, faculty, data?.schedule, strata, includeVirtual, query, building, type]);

    const getStatus = useCallback((name: string, selected: Day): VacancyStatus => {
        const slots = data?.schedule?.[selected]?.[name];
        return vacancyStatus(slots, time, duration);
    }, [data?.schedule, time, duration]);

    const isVacant = useCallback((name: string, selected: Day) => getStatus(name, selected) === "vacant", [getStatus]);

    const hasScheduleForDay = useCallback((selected: Day) => {
        if (!data?.schedule?.[selected]) return false;

        return Object.keys(data.schedule[selected]).length > 0;
    }, [data?.schedule]);

    const vacantCounts = useMemo(() => {
        const result = {} as Record<Day, number>;

        if (!data?.schedule) {
            for (const d of days) result[d] = 0;

            return result;
        }

        for (const d of days) {
            const daySchedule = data.schedule[d];
            let count = 0;

            for (const name of candidates) {
                const slots = daySchedule?.[name];

                if (slots && vacancyStatus(slots, time, duration) === "vacant") {
                    count++;
                }
            }

            result[d] = count;
        }

        return result;
    }, [data?.schedule, candidates, time, duration]);

    const rooms = useMemo(() => {
        const daySchedule = data?.schedule?.[day];

        const filtered = candidates.filter((name) => {
            const hasDayData = Boolean(daySchedule && name in daySchedule);

            if (!hasDayData) {
                // Day has no definite schedule data for this room (e.g. Saturday or unscheduled day)
                // Hidden by default; included only when user toggles showUnavailable
                return showUnavailable;
            }

            return true;
        });

        if (sortBy === "vacant") {
            // Precompute rank once per room: 3 = Vacant, 2 = Semivacant, 1 = Occupied, 0 = No data
            const ranks = new Map<string, number>();

            for (const name of filtered) {
                const slots = daySchedule?.[name];

                if (!slots) {
                    ranks.set(name, 0);
                    continue;
                }

                const status = vacancyStatus(slots, time, duration);
                const rank = status === "vacant" ? 3 : status === "semivacant" ? 2 : 1;
                ranks.set(name, rank);
            }

            return filtered.sort((a, b) => {
                const diff = (ranks.get(b) ?? 0) - (ranks.get(a) ?? 0);

                if (diff !== 0) return diff;

                return a.localeCompare(b, undefined, {
                    numeric: true,
                    sensitivity: "base",
                });
            });
        }

        return filtered.sort((a, b) => a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: "base",
        }));
    }, [candidates, data?.schedule, day, showUnavailable, sortBy, time, duration]);

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
        strata,
        setStrata,
        sortBy,
        setSortBy,
        data,
        loading,
        isPending,
        error,
        load,
        candidates,
        vacantCounts,
        getStatus,
        isVacant,
        hasScheduleForDay,
        rooms,
    };
}

const RoomContext = createContext<ReturnType<typeof useRoomModel> | undefined>(undefined);
const ClockContext = createContext<Date | undefined>(undefined);

/** Ticks independently so the 1-second clock never re-renders the room model or its consumers */
function ClockProvider({ initialNow, children }: {
    initialNow?: number;
    children: ReactNode;
}) {
    const [clock, setClock] = useState(() => (initialNow !== undefined ? new Date(initialNow) : new Date()));

    useEffect(() => {
        setClock(new Date());
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

/** Application-wide state survives child component unmounts, not page reloads */
export function RoomStateProvider({
    children,
    initialData,
    initialFaculty,
    initialNow,
}: RoomInitialState & { children: ReactNode }) {
    const model = useRoomModel({
        initialData,
        initialFaculty,
        initialNow,
    });

    return (
        <RoomContext.Provider value={model}>
            <ClockProvider initialNow={initialNow}>
                {children}
            </ClockProvider>
        </RoomContext.Provider>
    );
}

/** Access room discovery state under RoomStateProvider */
export function useRoomState() {
    const state = useContext(RoomContext);

    if (!state) throw new Error("RoomStateProvider is missing");

    return state;
}

/** Access the shared clock without subscribing to filter changes */
export function useClock() {
    const clock = useContext(ClockContext);

    if (!clock) throw new Error("Clock provider is missing");

    return clock;
}
