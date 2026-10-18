import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyRequest } from "fastify";

export interface AdminConfig {
    admins?: Array<string | {
        username?: string;
        id?: string;
    }>;
    admin_groups?: string[];
}

let cachedMtime = 0;
let cachedAdmins = new Set<string>();
let cachedGroups = new Set<string>();

/** Reset cache for unit testing */
export function clearAdminCache() {
    cachedMtime = 0;
    cachedAdmins = new Set<string>();
    cachedGroups = new Set<string>();
}

/**
 * Load admin identifiers and groups from JSON configuration file or environment variable.
 * Supports:
 * - Custom path passed directly
 * - Path in process.env.ADMIN_CONFIG_PATH or process.env.ADMINS_FILE
 * - Fallback to data/admins.json or admins.json
 * - Raw JSON string via process.env.ADMINS_JSON
 * Format can be an array of strings/objects, or an object containing `admins` and optional `admin_groups`.
 */
export function loadAdminConfig(customPath?: string): {
    admins: Set<string>;
    groups: Set<string>;
} {
    if (process.env.ADMINS_JSON && !customPath) {
        try {
            const parsed = JSON.parse(process.env.ADMINS_JSON);
            return extractAdminSets(parsed);
        }
        catch {
            return {
                admins: new Set(),
                groups: new Set(),
            };
        }
    }

    const filePath = customPath
        || process.env.ADMIN_CONFIG_PATH
        || process.env.ADMINS_FILE
        || (existsSync(resolve("data/admins.json")) ? resolve("data/admins.json") : resolve("admins.json"));

    if (!existsSync(filePath)) {
        return {
            admins: new Set(),
            groups: new Set(),
        };
    }

    try {
        const stats = statSync(filePath);

        if (!customPath && stats.mtimeMs === cachedMtime && (cachedAdmins.size > 0 || cachedGroups.size > 0)) {
            return {
                admins: cachedAdmins,
                groups: cachedGroups,
            };
        }

        const raw = readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const { admins, groups } = extractAdminSets(parsed);

        if (!customPath) {
            cachedMtime = stats.mtimeMs;
            cachedAdmins = admins;
            cachedGroups = groups;
        }

        return {
            admins,
            groups,
        };
    }
    catch {
        return {
            admins: new Set(),
            groups: new Set(),
        };
    }
}

/** Normalize list or object of admin definitions into lowercase Sets */
function extractAdminSets(data: unknown): {
    admins: Set<string>;
    groups: Set<string>;
} {
    const admins = new Set<string>();
    const groups = new Set<string>();

    if (Array.isArray(data)) {
        for (const item of data) {
            if (typeof item === "string") {
                const trimmed = item.trim().toLowerCase();

                if (trimmed) admins.add(trimmed);
            }
            else if (item && typeof item === "object") {
                const raw = (item as {
                    username?: string;
                    id?: string;
                }).username
                || (item as {
                    username?: string;
                    id?: string;
                }).id;

                if (typeof raw === "string") {
                    const trimmed = raw.trim().toLowerCase();

                    if (trimmed) admins.add(trimmed);
                }
            }
        }

        return {
            admins,
            groups,
        };
    }

    if (data && typeof data === "object") {
        const cfg = data as AdminConfig;

        if (Array.isArray(cfg.admins)) {
            for (const item of cfg.admins) {
                if (typeof item === "string") {
                    const trimmed = item.trim().toLowerCase();

                    if (trimmed) admins.add(trimmed);
                }
                else if (item && typeof item === "object") {
                    const raw = item.username || item.id;

                    if (typeof raw === "string") {
                        const trimmed = raw.trim().toLowerCase();

                        if (trimmed) admins.add(trimmed);
                    }
                }
            }
        }

        if (Array.isArray(cfg.admin_groups)) {
            for (const item of cfg.admin_groups) {
                if (typeof item === "string") {
                    const trimmed = item.trim().toLowerCase();

                    if (trimmed) groups.add(trimmed);
                }
            }
        }
    }

    return {
        admins,
        groups,
    };
}

/**
 * Extract authenticated username/ID from reverse proxy / Authelia headers.
 * First-party headers from Authelia forward-auth: Remote-User, Remote-Preferred-Username, Remote-Email.
 * Also checks standard proxy headers: X-Forwarded-User, X-Remote-User.
 */
export function getAuthenticatedUser(request: FastifyRequest): string | null {
    const configuredHeader = process.env.AUTH_USER_HEADER?.toLowerCase();

    if (configuredHeader) {
        const val = request.headers[configuredHeader];

        if (typeof val === "string" && val.trim()) return val.trim();

        if (Array.isArray(val) && val[0]?.trim()) return val[0].trim();
    }

    // Authelia forward-auth and standard reverse-proxy headers in order of preference
    const candidateHeaders = [
        "remote-user",
        "remote-preferred-username",
        "x-forwarded-user",
        "x-remote-user",
    ];

    for (const header of candidateHeaders) {
        const val = request.headers[header];

        if (typeof val === "string" && val.trim()) {
            return val.trim();
        }

        if (Array.isArray(val) && val[0]?.trim()) {
            return val[0].trim();
        }
    }

    return null;
}

/**
 * Extract authenticated groups from reverse proxy / Authelia headers.
 * Authelia forwards groups in the `Remote-Groups` header (comma-separated).
 */
export function getAuthenticatedGroups(request: FastifyRequest): string[] {
    const raw = request.headers["remote-groups"] || request.headers["x-forwarded-groups"];

    if (typeof raw === "string") {
        return raw
            .split(",")
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
    }

    if (Array.isArray(raw)) {
        return raw.flatMap(r => r.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
    }

    return [];
}

/** Check if the given user or their groups match the administrators configuration */
export function isAuthorizedAdmin(
    user: string | null,
    groups: string[] = [],
    customPath?: string,
): boolean {
    const config = loadAdminConfig(customPath);

    if (user && config.admins.has(user.trim().toLowerCase())) {
        return true;
    }

    if (groups.length > 0 && config.groups.size > 0) {
        return groups.some(g => config.groups.has(g));
    }

    return false;
}

export type AdminVerifyResult
    = | {
        ok: true;
        username: string;
        groups: string[];
    }
    | {
        ok: false;
        status: 401 | 403;
        error: string;
    };

/** Verify request is authenticated via auth proxy and belongs to an authorized administrator */
export function verifyAdminRequest(request: FastifyRequest, customPath?: string): AdminVerifyResult {
    const user = getAuthenticatedUser(request);
    const groups = getAuthenticatedGroups(request);

    if (!user && groups.length === 0) {
        return {
            ok: false,
            status: 401,
            error: "Authentication required. Expected Remote-User or Remote-Groups header from external auth provider (Authelia / LDAP proxy).",
        };
    }

    if (!isAuthorizedAdmin(user, groups, customPath)) {
        const identifier = user ? `User "${user}"` : `Groups [${groups.join(", ")}]`;

        return {
            ok: false,
            status: 403,
            error: `${identifier} is not authorized as an administrator in the backrooms admin configuration.`,
        };
    }

    return {
        ok: true,
        username: user || groups[0],
        groups,
    };
}
