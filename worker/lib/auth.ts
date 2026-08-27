import { parseJson } from "./util.js";

function timingSafeEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	const aa = enc.encode(a);
	const bb = enc.encode(b);
	if (aa.byteLength !== bb.byteLength) {
		crypto.subtle.timingSafeEqual(aa, aa);
		return false;
	}
	return crypto.subtle.timingSafeEqual(aa, bb);
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
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomUUID();
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100_000, hash: "SHA-256" },
		key,
		256,
	);
	return `${salt}:${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [salt, hex] = stored.split(":");
	if (!salt || !hex) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100_000, hash: "SHA-256" },
		key,
		256,
	);
	return timingSafeEqual(toHex(bits), hex);
}

export async function createSession(env: Env, userId: string): Promise<string> {
	const secret = env.SESSION_SECRET || "dev-only-change-me";
	const raw = crypto.randomUUID() + crypto.randomUUID();
	const token = await hmacHex(secret, raw);
	const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
	await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
		.bind(token, userId, expires)
		.run();
	return token;
}

export function sessionCookie(token: string): string {
	return `pyrechat=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Secure`;
}

export function clearSessionCookie(): string {
	return "pyrechat=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function readToken(request: Request): string | null {
	const auth = request.headers.get("Authorization");
	if (auth?.startsWith("Bearer ")) return auth.slice(7);
	try {
		const q = new URL(request.url).searchParams.get("token");
		if (q) return q;
	} catch {
		/* ignore */
	}
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

export async function requireUser(
	request: Request,
	env: Env,
): Promise<{ user: AuthedUser; token: string } | Response> {
	const token = readToken(request);
	if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
	const row = await env.DB.prepare(
		`SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
	)
		.bind(token)
		.first<AuthedUser>();
	if (!row) return Response.json({ error: "Unauthorized" }, { status: 401 });
	await env.DB.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").bind(row.id).run();
	return { user: row, token };
}

export function isFounderUsername(username: string): boolean {
	return username.trim().toLowerCase() === "maximuspyre";
}

export function betaTicketsEnabled(env: Env): boolean {
	const v = String((env as Env & { BETA_TICKETS?: string }).BETA_TICKETS ?? "1").toLowerCase();
	return v !== "0" && v !== "false" && v !== "off" && v !== "closed";
}

export function publicUser(u: AuthedUser, env?: Env) {
	return {
		id: u.id,
		username: u.username,
		displayName: u.display_name,
		bio: u.bio,
		skullmoji: parseJson(u.skullmoji, {
			color: "#FF6A1A",
			eyes: "hollow",
			jaw: "grin",
			hat: "none",
			bg: "#111111",
		}),
		snapScore: u.snap_score,
		storyPrivacy: u.story_privacy,
		whoCanContact: u.who_can_contact,
		mapMode: u.map_mode,
		mapSelected: parseJson<string[]>(u.map_selected, []),
		birthday: u.birthday,
		phone: u.phone,
		email: u.email,
		createdAt: u.created_at,
		lastActive: u.last_active,
		founder: isFounderUsername(u.username),
		betaTickets: env ? betaTicketsEnabled(env) : true,
	};
}
