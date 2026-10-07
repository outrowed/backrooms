import { Trans, useTranslation } from "react-i18next";
import { useRoomState } from "../state/RoomState";
import { Select } from "./ui/Select";

export function PageFooter() {
    const { data, currentFaculty } = useRoomState();
    const { t, i18n } = useTranslation();
    const locale = i18n.resolvedLanguage || i18n.language || "en";

    return (
        <footer className="mt-8 space-y-3 border border-[#a9b68b] bg-[#173225]/95 p-5 text-base text-[#dae0c7]">
            <p>
                <Trans
                    i18nKey="footer.disclaimer"
                    values={{ source: "SLCM UI" }}
                    components={[
                        <a
                            key="slcm-link"
                            className="underline hover:text-[#fff5bb]"
                            href="https://slcm.ui.ac.id"
                            target="_blank"
                            rel="noreferrer"
                        >
                            SLCM UI
                        </a>,
                    ]}
                />
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p>
                    <Trans
                        i18nKey="footer.faculty"
                        values={{ name: currentFaculty.name }}
                        components={[<strong key="faculty-name">{currentFaculty.name}</strong>]}
                    />
                    {" "}
                    ·
                    {" "}
                    <Trans
                        i18nKey="footer.source"
                        values={{ name: "SLCM UI" }}
                        components={[
                            <a
                                key="slcm-source"
                                className="underline hover:text-[#fff5bb]"
                                href="https://slcm.ui.ac.id"
                                target="_blank"
                                rel="noreferrer"
                            >
                                SLCM UI
                            </a>,
                        ]}
                    />
                    {data && (
                        <>
                            {" "}
                            {t("footer.cachedAt", {
                                dateStr: new Date(data.fetchedAt).toLocaleString("en-GB", {
                                    timeZone: "Asia/Jakarta",
                                }),
                            })}
                            {data.stale && ` ${t("footer.stale")}`}
                        </>
                    )}
                </p>
                <label htmlFor="language-select" className="flex items-center gap-2">
                    <span className="font-pixel text-xl text-[#fff5bb]">{t("footer.languageLabel")}</span>
                    <Select
                        id="language-select"
                        aria-label={t("footer.languageLabel")}
                        value={locale.startsWith("id") ? "id" : "en"}
                        onChange={e => void i18n.changeLanguage(e.target.value)}
                        className="min-h-9 w-auto px-2 py-1 font-pixel text-xl text-[#fff5bb]"
                    >
                        <option value="en">English (EN)</option>
                        <option value="id">Bahasa Indonesia (ID)</option>
                    </Select>
                </label>
            </div>
            <p className="text-sm">
                <Trans
                    i18nKey="footer.wallpaperAttribution"
                    values={{
                        title: t("footer.wallpaperTitle"),
                        license: t("footer.wallpaperLicense"),
                        font: "VT323",
                        fontLicense: t("footer.fontLicense"),
                    }}
                    components={[
                        <a
                            key="wp-title"
                            className="underline hover:text-[#fff5bb]"
                            href="https://commons.wikimedia.org/wiki/File:Stylized_Backrooms_%27Chevron%27_Wallpaper.png"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {t("footer.wallpaperTitle")}
                        </a>,
                        <a
                            key="wp-license"
                            className="underline hover:text-[#fff5bb]"
                            href="https://creativecommons.org/publicdomain/zero/1.0/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {t("footer.wallpaperLicense")}
                        </a>,
                        <a
                            key="font-specimen"
                            className="underline hover:text-[#fff5bb]"
                            href="https://fonts.google.com/specimen/VT323"
                            target="_blank"
                            rel="noreferrer"
                        >
                            VT323
                        </a>,
                        <a
                            key="font-license"
                            className="underline hover:text-[#fff5bb]"
                            href="https://openfontlicense.org"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {t("footer.fontLicense")}
                        </a>,
                    ]}
                />
            </p>
            <p className="pt-2 text-sm text-[#c8d4b2]">
                <Trans
                    i18nKey="footer.projectCredit"
                    values={{
                        author: "Taruna Prasetya",
                        license: "MIT License",
                        github: "GitHub",
                    }}
                    components={[
                        <a
                            key="author"
                            className="underline hover:text-[#fff5bb]"
                            href="https://taruna.me"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Taruna Prasetya
                        </a>,
                        <a
                            key="license"
                            className="underline hover:text-[#fff5bb]"
                            href="https://github.com/outrowed/backrooms/blob/main/LICENSE"
                            target="_blank"
                            rel="noreferrer"
                        >
                            MIT License
                        </a>,
                        <a
                            key="github"
                            className="underline hover:text-[#fff5bb]"
                            href="https://github.com/outrowed/backrooms"
                            target="_blank"
                            rel="noreferrer"
                        >
                            GitHub
                        </a>,
                        <em key="italic" className="italic" />,
                    ]}
                />
            </p>
        </footer>
    );
}
