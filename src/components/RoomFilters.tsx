import { useState } from "react";
import { FACULTIES, jakartaNow } from "../../shared/rooms";
import { useTranslation } from "react-i18next";
import { useClock, useRoomState } from "../state/RoomState";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

export function RoomFilters() {
    const {
        faculty,
        setFaculty,
        query,
        setQuery,
        building,
        setBuilding,
        type,
        setType,
        strata,
        setStrata,
        sortBy,
        setSortBy,
        time,
        setTime,
        duration,
        setDuration,
        includeVirtual,
        setIncludeVirtual,
        showUnavailable,
        setShowUnavailable,
        setDay,
    } = useRoomState();

    const [advanced, setAdvanced] = useState(false);
    const now = jakartaNow(useClock());
    const { t } = useTranslation();

    return (
        <section aria-label={t("filters.searchSrOnly")} className="mt-6">
            {/* Search and filter controls */}
            <div className="flex items-stretch gap-2 sm:gap-3">
                <label htmlFor="room-query" className="min-w-0 flex-1">
                    <span className="sr-only">{t("filters.searchSrOnly")}</span>
                    <Input
                        id="room-query"
                        placeholder={t("filters.searchPlaceholder")}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                    />
                </label>
                <Button
                    type="button"
                    aria-expanded={advanced}
                    aria-controls="advanced-filters"
                    onClick={() => setAdvanced(!advanced)}
                >
                    <span className="sm:hidden">{t("filters.filtersShort")}</span>
                    <span className="hidden sm:inline">{t("filters.filtersLong")}</span>
                    {" "}
                    {advanced ? "-" : "+"}
                </Button>
            </div>

            {advanced && (
                <div
                    id="advanced-filters"
                    className="border-2 border-[#a9b68b] border-t-0 bg-[#183427]/95 p-4 shadow-[6px_6px_0_#17251b] sm:p-5"
                >
                    <div className="grid gap-4 text-[#d1dbb8] sm:grid-cols-2 lg:grid-cols-4">
                        <label htmlFor="faculty-select" className="sm:col-span-2 lg:col-span-2">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.faculty")}</span>
                            <Select
                                id="faculty-select"
                                value={faculty}
                                onChange={event => setFaculty(event.target.value)}
                            >
                                {FACULTIES.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </Select>
                        </label>
                        <label htmlFor="room-time">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.timeWib")}</span>
                            <Input
                                id="room-time"
                                type="time"
                                min="08:00"
                                max="17:59"
                                required
                                value={time}
                                onChange={event => setTime(event.target.value || "08:00")}
                            />
                        </label>
                        <label htmlFor="room-duration">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.minVacancy")}</span>
                            <Input
                                id="room-duration"
                                type="number"
                                min="1"
                                max="600"
                                step="1"
                                value={duration}
                                onChange={event => setDuration(Math.max(1, Math.min(600, Number(event.target.value) || 1)))}
                            />
                            <span className="mt-1 block text-sm text-[#a8ba7e]">{t("filters.minVacancySub")}</span>
                        </label>
                        <label htmlFor="room-building">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.building")}</span>
                            <Select id="room-building" value={building} onChange={event => setBuilding(event.target.value)}>
                                <option value="all">{t("filters.allBuildings")}</option>
                                <option value="Kampus UI">{t("filters.buildingCampus")}</option>
                                <option value="Salemba">{t("filters.buildingSalemba")}</option>
                                <option value="Gedung Baru">{t("filters.buildingNew")}</option>
                                <option value="Gedung Lama">{t("filters.buildingOld")}</option>
                            </Select>
                        </label>
                        <label htmlFor="room-type">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.roomType")}</span>
                            <Select id="room-type" value={type} onChange={event => setType(event.target.value)}>
                                <option value="all">{t("filters.allTypes")}</option>
                                <option value="classroom">{t("filters.typeClassroom")}</option>
                                <option value="lab">{t("filters.typeLab")}</option>
                                <option value="auditorium">{t("filters.typeAuditorium")}</option>
                            </Select>
                        </label>
                        <label htmlFor="room-strata">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.strata")}</span>
                            <Select id="room-strata" value={strata} onChange={event => setStrata(event.target.value)}>
                                <option value="all">{t("filters.allStrata")}</option>
                                {["S1", "S2", "S3", "D2", "D3", "D4", "unknown"].map(value => (
                                    <option key={value} value={value}>{value === "unknown" ? t("filters.unknownStrata") : value}</option>
                                ))}
                            </Select>
                        </label>
                        <label htmlFor="room-sort">
                            <span className="mb-1 block font-pixel text-2xl text-[#d1dbb8]">{t("filters.sortBy")}</span>
                            <Select id="room-sort" value={sortBy} onChange={event => setSortBy(event.target.value as "name" | "vacant")}>
                                <option value="name">{t("filters.sortByName")}</option>
                                <option value="vacant">{t("filters.sortByVacant")}</option>
                            </Select>
                        </label>
                        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
                            <Button
                                type="button"
                                onClick={() => {
                                    const current = jakartaNow();

                                    if (current.day) {
                                        setDay(current.day);
                                        setTime(current.time);
                                    }
                                }}
                                disabled={!now.day}
                            >
                                {t("filters.useCurrentTime")}
                            </Button>
                            <label className="flex min-h-11 items-center gap-2 text-lg text-[#edf0d4]">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 accent-[#c0d494]"
                                    checked={showUnavailable}
                                    onChange={event => setShowUnavailable(event.target.checked)}
                                />
                                {t("filters.showUnscheduled")}
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-lg text-[#edf0d4]">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 accent-[#c0d494]"
                                    checked={includeVirtual}
                                    onChange={event => setIncludeVirtual(event.target.checked)}
                                />
                                {t("filters.includeVirtual")}
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
