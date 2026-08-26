import { parseJson } from "./util.js";

function timingSafeEqual(a: string, b: string): boolean {
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

export async function secretEqual(given: string, expected: string): Promise<boolean> {
	return timingSafeEqual(await sha256Hex(given), await sha256Hex(expected));
}

async function hmacHex(secret: string, data: string): Promise<string> {
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

function sessionSecret(env: Env, request: Request): string {
	const secret = env.SESSION_SECRET?.trim();
	if (!secret || secret === "dev-only-change-me") {
		throw new Error("SESSION_SECRET is not configured");
	}
	const host = new URL(request.url).hostname;
	if (host === "chat.pyrearms.dev" && /change-me/i.test(secret)) {
		throw new Error("SESSION_SECRET is not configured");
	}
	return secret;
}

export async function createSession(env: Env, userId: string, request: Request): Promise<string> {
	const secret = sessionSecret(env, request);
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
};

const DEFAULT_SKULL = {
	color: "#FF6A1A",
	eyes: "hollow",
	jaw: "grin",
	hat: "none",
	bg: "#111111",
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
	};
}

export function publicUser(u: AuthedUser) {
	return basePublic(u);
}

export function meUser(u: AuthedUser) {
	return {
		...basePublic(u),
		birthday: u.birthday,
		phone: u.phone,
		email: u.email,
	};
}
