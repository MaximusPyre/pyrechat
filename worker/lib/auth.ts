import { parseJson } from "./util.js";
import { isFounderUsername } from "./founder.js";
import { isBetaOpen } from "./env.js";

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}

function toHex(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return toHex(buf);
}

export function normalizeRecoveryKey(raw: string): string {
	return (raw || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase();
}

export function formatRecoveryKey(hex: string): string {
	return (hex.match(/.{1,8}/g) || [hex]).join("-");
}

export function generateRecoveryKey(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return formatRecoveryKey(toHex(bytes.buffer));
}

export async function hashRecoveryKey(key: string): Promise<string> {
	const norm = normalizeRecoveryKey(key);
	if (norm.length < 32) throw new Error("recovery key too short");
	return sha256Hex(norm);
}

export async function recoveryKeyMatches(key: string, stored: string): Promise<boolean> {
	const trimmed = (key || "").trim().replace(/\s+/g, "");
	const norm = normalizeRecoveryKey(key);
	if (!stored || trimmed.length < 16) return false;
	const candidates = [...new Set([trimmed, trimmed.toLowerCase(), norm].filter((s) => s.length >= 16))];
	if (stored.startsWith("pbkdf2$") || stored.includes(":")) {
		const unique = candidates[0] === candidates[candidates.length - 1] ? [candidates[0]] : [candidates[0], candidates[candidates.length - 1]];
		for (const c of unique) {
			if (await verifyPassword(c, stored)) return true;
		}
		return false;
	}
	const want = stored.toLowerCase();
	for (const c of candidates) {
		if (timingSafeEqual(await sha256Hex(c), want)) return true;
	}
	return false;
}

export async function secretEqual(given: string, expected: string): Promise<boolean> {
	return timingSafeEqual(await sha256Hex(given), await sha256Hex(expected));
}

export async function hmacHex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
	return toHex(sig);
}

const PBKDF2_ITERS = 100_000;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

async function pbkdf2Hex(password: string, salt: string, iterations: number): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations, hash: "SHA-256" },
		key,
		256,
	);
	return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomUUID();
	const hex = await pbkdf2Hex(password, salt, PBKDF2_ITERS);
	return `pbkdf2$${PBKDF2_ITERS}$${salt}$${hex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	try {
		let iterations = PBKDF2_ITERS;
		let salt = "";
		let hex = "";
		if (stored.startsWith("pbkdf2$")) {
			const parts = stored.split("$");
			iterations = Number(parts[1]) || PBKDF2_ITERS;
			salt = parts[2] || "";
			hex = parts[3] || "";
		} else {
			const cut = stored.indexOf(":");
			if (cut < 0) return false;
			salt = stored.slice(0, cut);
			hex = stored.slice(cut + 1);
		}
		if (!salt || !hex) return false;
		return timingSafeEqual(await pbkdf2Hex(password, salt, iterations), hex);
	} catch {
		return false;
	}
}

const SESSION_PLACEHOLDERS = new Set([
	"dev-only-change-me",
	"change-me-in-production-use-a-long-random-string",
]);

function sessionSecret(env: Env): string {
	const secret = env.SESSION_SECRET?.trim();
	if (!secret || SESSION_PLACEHOLDERS.has(secret)) {
		throw new Error("SESSION_SECRET is not configured");
	}
	return secret;
}

export async function createSession(env: Env, userId: string, _request: Request): Promise<string> {
	const secret = sessionSecret(env);
	const raw = crypto.randomUUID() + crypto.randomUUID();
	const token = await hmacHex(secret, raw);
	const expires = new Date(Date.now() + 1000 * SESSION_MAX_AGE).toISOString();
	await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
		.bind(token, userId, expires)
		.run();
	return token;
}

export function sessionCookie(token: string, request: Request): string {
	const https = new URL(request.url).protocol === "https:";
	const origin = request.headers.get("Origin") || "";
	const crossSite = /^(capacitor|ionic):/i.test(origin);
	const sameSite = crossSite ? "None" : "Lax";
	const secure = https || crossSite;
	return `pyrechat=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookies(): string[] {
	return [
		"pyrechat=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
		"pyrechat=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0",
	];
}

export function readToken(request: Request): string | null {
	const cookie = request.headers.get("Cookie") || "";
	const match = cookie.match(/(?:^|;\s*)pyrechat=([^;]+)/);
	return match ? decodeURIComponent(match[1]) : null;
}

export type AuthedUser = {
	id: string;
	username: string;
	display_name: string;
	birthday: string | null;
	bio: string;
	phone: string | null;
	email: string | null;
	skullmoji: string;
	snap_score: number;
	story_privacy: string;
	who_can_contact: string;
	map_mode: string;
	map_selected: string;
	created_at: string;
	last_active: string | null;
	kindling?: number;
	recovery_hash?: string | null;
};

const DEFAULT_SKULL = {
	color: "#c45e32",
	eyes: "hollow",
	jaw: "grin",
	hat: "none",
	bg: "#1c2124",
};

export async function requireUser(
	request: Request,
	env: Env,
): Promise<{ user: AuthedUser; token: string } | Response> {
	const token = readToken(request);
	if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
	const row = await env.DB.prepare(
		`SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
	)
		.bind(token, new Date().toISOString())
		.first<AuthedUser>();
	if (!row) return Response.json({ error: "Unauthorized" }, { status: 401 });
	await env.DB.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").bind(row.id).run();
	return { user: row, token };
}

function basePublic(u: AuthedUser) {
	return {
		id: u.id,
		username: u.username,
		displayName: u.display_name,
		bio: u.bio,
		skullmoji: parseJson(u.skullmoji, DEFAULT_SKULL),
		snapScore: u.snap_score,
		storyPrivacy: u.story_privacy,
		whoCanContact: u.who_can_contact,
		mapMode: u.map_mode,
		mapSelected: parseJson<string[]>(u.map_selected, []),
		createdAt: u.created_at,
		lastActive: u.last_active,
		founder: isFounderUsername(u.username),
		kindling: !isFounderUsername(u.username) && Number(u.kindling) === 1,
		hasRecovery: Boolean(u.recovery_hash),
	};
}

export function publicUser(u: AuthedUser) {
	return basePublic(u);
}

export function meUser(u: AuthedUser, env?: Env) {
	return {
		...basePublic(u),
		birthday: u.birthday,
		phone: u.phone,
		email: u.email,
		betaTickets: env ? isBetaOpen(env) : false,
		hasRecovery: Boolean(u.recovery_hash),
	};
}
