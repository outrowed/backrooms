import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { days, type FacultyInfo, type Schedule } from "../shared/rooms.js";

const slotPattern = /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s*,\s*(\d{2})[.:](\d{2})\s*-\s*(\d{2})[.:](\d{2})\s*\((.+)\)$/i;

const dayMapping: Record<string, (typeof days)[number]> = {
    senin: "senin",
    selasa: "selasa",
    rabu: "rabu",
    kamis: "kamis",
    jumat: "jumat",
    sabtu: "sabtu",
};

export interface SlcmCredentials {
    username: string;
    password: string;
}

export function loadCredentials(): SlcmCredentials | null {
    let username = process.env.SLCM_USERNAME || process.env.USERNAME || "";
    let password = process.env.SLCM_PASSWORD || process.env.PASSWORD || "";

    if ((!username || !password) && existsSync("AUTH_DATA.env")) {
        const lines = readFileSync("AUTH_DATA.env", "utf-8").split("\n");

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("USERNAME=")) {
                username = trimmed.split("=")[1].trim();
            }

            if (trimmed.startsWith("PASSWORD=")) {
                password = trimmed.split("=")[1].trim();
            }
        }
    }

    if (!username || !password) return null;

    return {
        username,
        password,
    };
}

let cachedSession: {
    accessToken: string;
    appToken: string;
    expiresAt: number;
    year: number;
    term: number;
} | null = null;

export async function authenticateSlcm(creds: SlcmCredentials) {
    if (cachedSession && Date.now() < cachedSession.expiresAt - 60000) {
        return cachedSession;
    }

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = randomBytes(16).toString("base64url");
    const nonce = randomBytes(16).toString("base64url");

    const authParams = new URLSearchParams({
        client_id: "slcm-akademik",
        redirect_uri: "https://slcm.ui.ac.id/portal",
        state,
        response_mode: "fragment",
        response_type: "code",
        scope: "openid profile email",
        nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
    });

    const authUrl = `https://login.ui.ac.id/realms/main/protocol/openid-connect/auth?${authParams.toString()}`;
    const userAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

    const getRes = await fetch(authUrl, {
        headers: { "User-Agent": userAgent },
        redirect: "manual",
    });

    const cookies: string[] = [];

    for (const [k, v] of getRes.headers.entries()) {
        if (k === "set-cookie") cookies.push(v.split(";")[0]);
    }

    const html = await getRes.text();
    const actionMatch = html.match(/action="([^"]+)"/);

    if (!actionMatch) throw new Error("Keycloak login form action missing");

    let postAction = actionMatch[1].replace(/&amp;/g, "&");

    if (postAction.startsWith("/")) {
        postAction = new URL(postAction, authUrl).toString();
    }

    const loginBody = new URLSearchParams({
        username: creds.username,
        password: creds.password,
        credentialId: "",
    });

    const postRes = await fetch(postAction, {
        method: "POST",
        headers: {
            "User-Agent": userAgent,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": authUrl,
            "Cookie": cookies.join("; "),
        },
        body: loginBody.toString(),
        redirect: "manual",
    });

    const location = postRes.headers.get("location");

    if (!location) throw new Error(`Login redirection failed with status ${postRes.status}`);

    const locUrl = new URL(location);
    const fragmentParams = new URLSearchParams(locUrl.hash.replace(/^#/, ""));
    const code = fragmentParams.get("code") || locUrl.searchParams.get("code");

    if (!code) throw new Error("No authorization code in Keycloak redirect");

    const tokenRes = await fetch("https://login.ui.ac.id/realms/main/protocol/openid-connect/token", {
        method: "POST",
        headers: {
            "User-Agent": userAgent,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: "slcm-akademik",
            code,
            redirect_uri: "https://slcm.ui.ac.id/portal",
            code_verifier: verifier,
        }).toString(),
    });

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const expiresIn = Number(tokenData.expires_in) || 300;

    const userRes = await fetch("https://slcm.ui.ac.id/akademik/api/user", {
        headers: {
            "User-Agent": userAgent,
            "Authorization": `Bearer ${accessToken}`,
            "Referer": "https://slcm.ui.ac.id/akademik/schedule/class/whole",
        },
    });

    if (!userRes.ok) throw new Error(`SLCM user info request failed: ${userRes.status}`);

    const userData = await userRes.json();
    const appToken = userData.data?.userToken;
    const userInfo = userData.data?.userInfo || {};

    const year = Number(userInfo.current_year) || new Date().getFullYear();
    const term = Number(userInfo.current_term) || 1;

    cachedSession = {
        accessToken,
        appToken,
        expiresAt: Date.now() + expiresIn * 1000,
        year,
        term,
    };

    return cachedSession;
}

export function parseSlcmClassData(items: Array<{
    classname?: string;
    coursename?: string;
    dates_rooms?: string[];
    prodi?: string;
    strata?: string;
}>): Schedule {
    const schedule = Object.fromEntries(days.map(d => [d, {}])) as Schedule;

    for (const item of items) {
        const className = item.classname || item.coursename || "Class";
        const datesRooms = item.dates_rooms || [];

        for (const dr of datesRooms) {
            const match = slotPattern.exec(dr.trim());

            if (!match) continue;

            const [, dayStr, sh, sm, eh, em, roomRaw] = match;
            const dayKey = dayMapping[dayStr.toLowerCase()];

            if (!dayKey) continue;

            const room = roomRaw.trim();

            // virtual room included per user request

            if (!schedule[dayKey][room]) {
                schedule[dayKey][room] = [];
            }

            const existing = schedule[dayKey][room];
            const duplicate = existing.some(
                s => s.start === `${sh}:${sm}` && s.end === `${eh}:${em}` && s.class === className && s.prodi === item.prodi,
            );

            if (!duplicate) {
                existing.push({
                    start: `${sh}:${sm}`,
                    end: `${eh}:${em}`,
                    class: className,
                    prodi: item.prodi,
                    strata: item.strata,
                });
            }
        }
    }

    return schedule;
}

const facultySubOrgsCache = new Map<string, Array<{
    code: string;
    name: string;
}>>();

export async function getFacultySubOrgs(
    facultyCode: string,
    fallbackOrgCode: string,
    session: {
        accessToken: string;
        appToken: string;
    },
): Promise<Array<{
    code: string;
    name: string;
}>> {
    const cached = facultySubOrgsCache.get(facultyCode);

    if (cached) return cached;

    const userAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";
    const url = `https://slcm.ui.ac.id/akademik/api/v1/shared/faculty-orgs?faculty_code=${encodeURIComponent(facultyCode)}`;

    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": userAgent,
                "Accept": "application/json",
                "Authorization": `Bearer ${session.accessToken}`,
                "x-app-token": session.appToken,
                "Referer": "https://slcm.ui.ac.id/akademik/schedule/class/whole",
            },
        });

        if (res.ok) {
            const json = await res.json();
            const data: Array<{
                code?: string;
                name?: string;
            }> = json.data || [];
            const codes = data.flatMap(item => item.code
                ? [{
                        code: item.code,
                        name: item.name || "",
                    }]
                : []);

            if (codes.length > 0) {
                facultySubOrgsCache.set(facultyCode, codes);
                return codes;
            }
        }
    }
    catch {}

    return [{
        code: fallbackOrgCode,
        name: "",
    }];
}

export async function fetchSlcmSchedule(faculty: FacultyInfo): Promise<Schedule> {
    const creds = loadCredentials();

    if (!creds) {
        throw new Error("SLCM credentials missing (SLCM_USERNAME and SLCM_PASSWORD)");
    }

    const session = await authenticateSlcm(creds);
    const orgCodes = await getFacultySubOrgs(faculty.facultyCode, faculty.orgCode, session);

    const userAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

    const fetchOrgClasses = async (org: {
        code: string;
        name: string;
    }) => {
        const orgCode = org.code;
        const url = `https://slcm.ui.ac.id/akademik/api/v1/class/whole?org=${encodeURIComponent(orgCode)}&year=${session.year}&term=${session.term}&lang=id`;

        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": userAgent,
                    "Accept": "application/json",
                    "Authorization": `Bearer ${session.accessToken}`,
                    "x-app-token": session.appToken,
                    "Referer": "https://slcm.ui.ac.id/akademik/schedule/class/whole",
                },
                signal: AbortSignal.timeout(12000),
            });

            if (!res.ok) return [];

            const json = await res.json();
            return Array.isArray(json.data)
                ? json.data.map((item: object) => ({
                        ...item,
                        prodi: org.name,
                        strata: org.name.match(/\b(?:S[123]|D[234])\b/i)?.[0].toUpperCase() || "unknown",
                    }))
                : [];
        }
        catch {
            return [];
        }
    };

    const batchSize = 10;
    const allClasses: Array<{
        classname?: string;
        coursename?: string;
        dates_rooms?: string[];
        prodi?: string;
        strata?: string;
    }> = [];

    for (let i = 0; i < orgCodes.length; i += batchSize) {
        const batch = orgCodes.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(code => fetchOrgClasses(code)));

        for (const res of batchResults) {
            allClasses.push(...res);
        }
    }

    return parseSlcmClassData(allClasses);
}
