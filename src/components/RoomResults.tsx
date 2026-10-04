import { jakartaNow } from "../../shared/rooms";
import { useClock, useRoomState } from "../state/RoomState";
import { RoomCard } from "./RoomCard";
import { Button } from "./ui/Button";

export function RoomResults() {
    const { rooms, day, time, duration, data, loading, error, load, hasScheduleForDay, currentFaculty } = useRoomState();
    const now = jakartaNow(useClock());
    const nowTime = now.day === day && now.time >= "08:00" && now.time < "18:00" ? now.time : undefined;
    const hasData = hasScheduleForDay(day);

    return (
        <section id="rooms" aria-label="Room results" className="mt-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#c0c59a] bg-[#193326]/95 px-4 py-3">
                <h2 className="font-pixel text-3xl">
                    {loading && !data ? "SEARCHING..." : `${rooms.length} ROOMS FOUND`}
                </h2>
                <span className="font-pixel text-xl uppercase">
                    {currentFaculty.shortName}
                    {" "}
                    /
                    {day}
                    {" "}
                    /
                    {time}
                    {" "}
                    WIB /
                    {duration}
                    {" "}
                    MIN
                </span>
            </div>
            {error && (
                <div role="alert" className="mb-4 border border-[#e0ae83] bg-[#3a2920] p-4">
                    {error}
                    {" "}
                    <Button className="ml-3" onClick={() => void load()}>Retry</Button>
                </div>
            )}
            {data && (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {rooms.map(name => (
                        <RoomCard
                            key={name}
                            name={name}
                            classes={!hasData ? undefined : data.schedule[day][name]}
                            time={time}
                            duration={duration}
                            nowTime={nowTime}
                            faculty={currentFaculty.id}
                        />
                    ))}
                </div>
            )}
            {data && !rooms.length && (
                <p className="border border-[#a9b68b] bg-[#183427]/95 p-8 text-xl">
                    {!hasData
                        ? `${day.toUpperCase()} has no supplied room schedule for ${currentFaculty.shortName}. Availability is unknown.`
                        : "No rooms match the search criteria. Try another time or a shorter minimum vacancy."}
                </p>
            )}
        </section>
    );
}
