import { useRoomState } from "../state/RoomState";

export function FacultyNotice() {
    const { currentFaculty } = useRoomState();

    return (
        <aside
            aria-label={`Policy notice for ${currentFaculty.shortName}`}
            className="mt-8 border border-[#a9b68b] bg-[#163023]/95 p-5 shadow-[4px_4px_0_#101e16]"
        >
            <h3 className="mb-2 font-pixel text-2xl text-[#fff5bb]">
                ROOM USE NOTICE:
                {" "}
                {currentFaculty.shortName}
            </h3>
            {currentFaculty.openPolicy
                ? (
                        <p className="text-base text-[#dae0c7]">
                            Vacant rooms in FASILKOM may generally be used for personal study,
                            group discussions (kerkom), or quiet waiting as long as they do not interrupt academic
                            schedules or booked faculty events.
                        </p>
                    )
                : (
                        <p className="text-base text-[#dae0c7]">
                            Room policies outside FASILKOM often differ significantly. Some faculties lock empty
                            classrooms, prohibit unscheduled entry, or require formal room bookings via the deanship
                            or student affairs (kemahasiswaan). Always observe local faculty rules on-site.
                        </p>
                    )}
        </aside>
    );
}
