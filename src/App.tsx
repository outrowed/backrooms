import { useCallback, useEffect, useState } from "react";
import { type Day, days, hasVacancy, jakartaNow, roomInfo, type Snapshot } from "../shared/rooms";
import { RoomCard } from "./components/RoomCard";

const control = "min-h-11 w-full border border-[#9baa7f] bg-[#10271d] px-3 py-2 text-lg text-[#fff5bb]";
const button = "min-h-11 border border-[#b9c993] bg-[#a8ba7e] px-4 py-2 font-pixel text-2xl text-[#172719] hover:bg-[#c9d49b]";

export default function App() {
    const initial = jakartaNow();
    const [day, setDay] = useState<Day | "sabtu">(initial.day || "senin");
    const [time, setTime] = useState(initial.day && initial.time >= "08:00" && initial.time < "18:00" ? initial.time : "08:00");
    const [duration, setDuration] = useState(30);
    const [advanced, setAdvanced] = useState(false);
    const [clock, setClock] = useState(() => new Date());

    useEffect(() => {
    // The floating WIB clock runs only while this view is mounted
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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
    const week = [...days, "sabtu"] as const;
    const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = jakartaNow(clock);
    const nowTime = now.day === day && now.time >= "08:00" && now.time < "18:00" ? now.time : undefined;

    return (
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-8 sm:pt-6">
            <a href="#rooms" className="sr-only focus:not-sr-only focus:bg-black focus:p-3">Skip to rooms</a>
            {/* Sticky Dynamic-Island-style top navigation bar */}
            <div className="sticky top-3 z-30 mb-6">
                <header className="mx-auto flex items-center justify-between gap-1 border-2 border-[#a9b68b] bg-[#142e22]/95 px-2 py-2.5 font-pixel text-base sm:gap-3 sm:text-xl text-[#d1dbb8] shadow-[4px_4px_0_#101e16] sm:px-6">
                    <span className="shrink-0 tracking-wide text-[#fff5bb]">FASILKOM UI</span>
                    <div role="timer" aria-label="Current time" className="flex items-baseline gap-1 px-0 text-center sm:gap-1.5 sm:px-2 text-[#fff1b0]">
                        <span className="font-pixel text-xl sm:text-3xl tabular-nums leading-none">
                            {clock.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hourCycle: "h23" })}
                        </span>
                        <span className="text-xs text-[#c2cea0]">WIB</span>
                    </div>
                    <a className="shrink-0 underline decoration-1 underline-offset-4 hover:text-[#fff5bb]" href="https://sceletracker.taruna.me">SCeLE Tracker &gt;</a>
                </header>
            </div>

            {/* Static Backrooms Title Container (does not stick) */}
            <section aria-label="Title" className="border-2 border-[#a9b68b] bg-[#183427]/90 px-5 py-7 shadow-[6px_6px_0_#17251b] sm:px-8">
                <h1 className="text-6xl font-bold tracking-tight text-[#fff1b0] sm:text-8xl">Backrooms</h1>
            </section>

            <main>
                <section aria-label="Find a room" className="mt-6">
                    <div className="flex items-stretch gap-2 sm:gap-3">
                        <label className="min-w-0 flex-1">
                            <span className="sr-only">Search rooms</span>
                            <input className={control} placeholder="Search room code or name" value={query} onChange={event => setQuery(event.target.value)} />
                        </label>
                        <button type="button" className={button} aria-expanded={advanced} aria-controls="advanced-filters" onClick={() => setAdvanced(!advanced)}>
                            <span className="sm:hidden">Filters</span>
                            <span className="hidden sm:inline">Advanced filters</span>
                            {" "}
                            {advanced ? "-" : "+"}
                        </button>
                    </div>
                    {advanced && (
                        <div
                            id="advanced-filters"
                            className="border-2 border-[#a9b68b] border-t-0 bg-[#183427]/95 p-4 shadow-[6px_6px_0_#17251b] sm:p-5"
                        >
                            <div className="grid gap-4 text-[#d1dbb8] sm:grid-cols-2 lg:grid-cols-4">
                                <label>
                                    <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">TIME - WIB</span>
                                    <input
                                        type="time"
                                        min="08:00"
                                        max="17:59"
                                        required
                                        className={control}
                                        value={time}
                                        onChange={event => setTime(event.target.value || "08:00")}
                                    />
                                </label>
                                <label>
                                    <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">MINIMUM VACANCY</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="600"
                                        step="1"
                                        className={control}
                                        value={duration}
                                        onChange={event => setDuration(Math.max(1, Math.min(600, Number(event.target.value) || 1)))}
                                    />
                                    <span className="mt-1 block text-sm text-[#a8ba7e]">Minutes free from the selected time</span>
                                </label>
                                <label>
                                    <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">BUILDING</span>
                                    <select className={control} value={building} onChange={event => setBuilding(event.target.value)}>
                                        <option value="all">All buildings</option>
                                        <option>Gedung Baru</option>
                                        <option>Gedung Lama</option>
                                    </select>
                                </label>
                                <label>
                                    <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">ROOM TYPE</span>
                                    <select className={control} value={type} onChange={event => setType(event.target.value)}>
                                        <option value="all">All types</option>
                                        <option value="classroom">Classrooms</option>
                                        <option value="lab">Labs</option>
                                        <option value="auditorium">Auditoriums</option>
                                    </select>
                                </label>
                                <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
                                    <button
                                        type="button"
                                        className={button}
                                        onClick={() => {
                                            const current = jakartaNow();

                                            if (current.day) {
                                                setDay(current.day);
                                                setTime(current.time);
                                            }
                                        }}
                                        disabled={!now.day}
                                    >
                                        Use current time
                                    </button>
                                    <label className="flex min-h-11 items-center gap-2 text-lg text-[#edf0d4]">
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 accent-[#c0d494]"
                                            checked={vacantOnly}
                                            onChange={event => setVacantOnly(event.target.checked)}
                                        />
                                        Vacant only
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
                <nav aria-label="Weekday availability" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {week.map((value, index) => (
                        <button type="button" key={value} aria-pressed={day === value} onClick={() => setDay(value)} className={`min-h-20 border p-3 text-left ${day === value ? "border-[#f0e9af] bg-[#a8ba7e] text-[#172719]" : "border-[#a9b68b] bg-[#193326]/95 text-[#edf0d4]"}`}>
                            <span className="block font-pixel text-2xl">{labels[index]}</span>
                            <span className="mt-1 block text-sm">{value === "sabtu" ? "No data" : !data ? "-" : `${candidates.filter(name => isVacant(name, value)).length} vacant`}</span>
                        </button>
                    ))}
                </nav>
                <section id="rooms" aria-label="Room results" className="mt-7">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#c0c59a] bg-[#193326]/95 px-4 py-3">
                        <h2 className="font-pixel text-3xl">{loading && !data ? "SEARCHING..." : `${rooms.length} ROOMS FOUND`}</h2>
                        <span className="font-pixel text-xl uppercase">
                            {day}
                            {" "}
                            /
                            {" "}
                            {time}
                            {" "}
                            WIB /
                            {" "}
                            {duration}
                            {" "}
                            MIN
                        </span>
                    </div>
                    {error && (
                        <div role="alert" className="mb-4 border border-[#e0ae83] bg-[#3a2920] p-4">
                            {error}
                            {" "}
                            <button type="button" className={`${button} ml-3`} onClick={() => void load()}>Retry</button>
                        </div>
                    )}
                    {data && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rooms.map(name => <RoomCard key={name} name={name} classes={day === "sabtu" ? undefined : data.schedule[day][name]} time={time} duration={duration} nowTime={nowTime} />)}</div>}
                    {data && !rooms.length && <p className="border border-[#a9b68b] bg-[#183427]/95 p-8 text-xl">{day === "sabtu" ? "Saturday has no supplied room schedule. Availability is unknown." : "No rooms match. Try another time, a shorter minimum vacancy, or turn off vacant-only filtering."}</p>}
                </section>
            </main>

            <footer className="mt-8 space-y-3 border border-[#a9b68b] bg-[#173225]/95 p-5 text-base text-[#dae0c7]">
                <p>Schedule-based availability only. Rooms may be locked, booked separately, or already in use. Check on-site and follow faculty rules. Not a booking service or an official UI website.</p>
                <p>
                    Schedule:
                    <a className="underline" href="https://csui.cesilia.dev/ruangan/">csui.cesilia.dev</a>
                    {data && (
                        <>
                            {" "}
                            - Cached
                            {new Date(data.fetchedAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}
                            {" "}
                            WIB
                            {data.stale && " - STALE - last known schedule"}
                        </>
                    )}
                </p>
                <p className="text-sm">
                    Wallpaper: &quot;Stylized Backrooms 'Chevron' Wallpaper&quot; by For underscore dev,
                    <a className="underline" href="https://commons.wikimedia.org/wiki/File:Stylized_Backrooms_%27Chevron%27_Wallpaper.png">CC0 via Wikimedia Commons</a>
                    {" "}
                    - VT323: SIL Open Font License
                </p>
            </footer>
        </div>
    );
}
