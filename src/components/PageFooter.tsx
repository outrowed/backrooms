import { useRoomState } from "../state/RoomState";

export function PageFooter() {
    const { data, currentFaculty } = useRoomState();

    return (
        <footer className="mt-8 space-y-3 border border-[#a9b68b] bg-[#173225]/95 p-5 text-base text-[#dae0c7]">
            <p>
                Schedule-based availability only. Rooms may be locked, booked separately, or already in use. Check on-site and follow faculty rules. Not a booking service or an official UI website.
            </p>
            <p>
                Faculty:
                {" "}
                <strong>{currentFaculty.name}</strong>
                {" "}
                · Source: SLCM UI (Academic Schedule)
                {data && (
                    <>
                        {" "}
                        - Cached
                        {" "}
                        {new Date(data.fetchedAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}
                        {" "}
                        WIB
                        {data.stale && " - STALE - last known schedule"}
                    </>
                )}
            </p>
            <p className="text-sm">
                Wallpaper: &quot;Stylized Backrooms 'Chevron' Wallpaper&quot; by For underscore dev,
                <a className="underline" href="https://commons.wikimedia.org/wiki/File:Stylized_Backrooms_%27Chevron%27_Wallpaper.png">
                    CC0 via Wikimedia Commons
                </a>
                {" "}
                - VT323: SIL Open Font License
            </p>
        </footer>
    );
}
