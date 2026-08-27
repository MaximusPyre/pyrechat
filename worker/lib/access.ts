import { bad } from "./util.js";

export const ALLOWED_ORIGINS = new Set([
	"https://chat.pyrearms.dev",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"capacitor://localhost",
	"ionic://localhost",
	"http://localhost",
	"https://localhost",
]);

export const ALLOWED_MEDIA_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/heic",
	"image/heif",
	"video/webm",
	"video/mp4",
	"video/quicktime",
	"audio/webm",
	"audio/mp4",
	"audio/mpeg",
	"application/pdf",
	"application/zip",
	"application/x-zip-compressed",
	"text/plain",
]);

export const STORY_PRIVACY = new Set(["friends", "everyone"]);
export const WHO_CAN_CONTACT = new Set(["everyone", "friends"]);
export const MAP_MODES = new Set(["friends", "selected", "skull"]);

const MEDIA_KEY_RE = /^u\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|webm|mp4|mov|m4a|mp3|pdf|zip|txt)$/i;

export function corsOrigin(origin: string): string | undefined {
	return origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined;
}

export function originAllowed(request: Request): boolean {
	const origin = request.headers.get("Origin");
	if (!origin) return true;
	return ALLOWED_ORIGINS.has(origin);
}

export function normalizeMediaType(raw: string | undefined): string | null {
	const ct = (raw || "").split(";")[0].trim().toLowerCase();
	return ALLOWED_MEDIA_TYPES.has(ct) ? ct : null;
}

export function extForType(ct: string): string {
	if (ct === "image/png") return "png";
	if (ct === "image/webp") return "webp";
	if (ct === "image/gif") return "gif";
	if (ct === "application/pdf") return "pdf";
	if (ct === "text/plain") return "txt";
	if (ct === "application/zip" || ct === "application/x-zip-compressed") return "zip";
	if (ct === "audio/mpeg") return "mp3";
	if (ct.startsWith("video/") || ct.startsWith("audio/")) return ct.includes("mp4") ? "mp4" : "webm";
	return "jpg";
}

export function isOwnedMediaKey(key: string, userId: string): boolean {
	if (!MEDIA_KEY_RE.test(key)) return false;
	return key.startsWith(`u/${userId}/`);
}

export function likeContains(q: string): string {
	return `%${q.replace(/[!%_]/g, (ch) => `!${ch}`)}%`;
}

export function ageYears(birthday: string): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return null;
	const born = Date.UTC(y, mo - 1, d);
	if (Number.isNaN(born)) return null;
	const now = new Date();
	let age = now.getUTCFullYear() - y;
	const hadBirthday =
		now.getUTCMonth() + 1 > mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() >= d);
	if (!hadBirthday) age -= 1;
	return age;
}

export async function areFriends(env: Env, a: string, b: string): Promise<boolean> {
	const row = await env.DB.prepare(
		"SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'",
	)
		.bind(a, b)
		.first();
	return !!row;
}

export async function isBlocked(env: Env, a: string, b: string): Promise<boolean> {
	const row = await env.DB.prepare(
		"SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)",
	)
		.bind(a, b, b, a)
		.first();
	return !!row;
}

export async function canContact(env: Env, fromId: string, toId: string): Promise<Response | null> {
	if (fromId === toId) return bad("Invalid recipient");
	if (await isBlocked(env, fromId, toId)) return bad("Cannot contact this user", 403);
	if (!(await areFriends(env, fromId, toId))) return bad("Friends only", 403);
	return null;
}

export async function canViewStory(
	env: Env,
	viewerId: string,
	story: { user_id: string; story_privacy?: string },
): Promise<boolean> {
	if (story.user_id === viewerId) return true;
	if (await isBlocked(env, viewerId, story.user_id)) return false;
	const privacy = story.story_privacy || "friends";
	if (privacy === "everyone") return true;
	if (privacy === "friends") return areFriends(env, viewerId, story.user_id);
	return false;
}

export async function canReadMedia(env: Env, userId: string, key: string): Promise<boolean> {
	if (!MEDIA_KEY_RE.test(key)) return false;
	if (key.startsWith(`u/${userId}/`)) return true;

	const spotlight = await env.DB.prepare("SELECT 1 FROM spotlight WHERE media_key = ?").bind(key).first();
	if (spotlight) return true;

	const snap = await env.DB.prepare(
		`SELECT 1 FROM snaps s
     LEFT JOIN snap_receipts r ON r.snap_id = s.id AND r.user_id = ?
     WHERE s.media_key = ? AND (s.sender_id = ? OR r.user_id IS NOT NULL)`,
	)
		.bind(userId, key, userId)
		.first();
	if (snap) return true;

	const story = await env.DB.prepare(
		`SELECT s.user_id, u.story_privacy FROM stories s
     JOIN users u ON u.id = s.user_id
     WHERE s.media_key = ? AND s.expires_at > datetime('now')`,
	)
		.bind(key)
		.first<{ user_id: string; story_privacy: string }>();
	if (story && (await canViewStory(env, userId, story))) return true;

	const memory = await env.DB.prepare("SELECT 1 FROM memories WHERE media_key = ? AND user_id = ?")
		.bind(key, userId)
		.first();
	if (memory) return true;

	const msg = await env.DB.prepare(
		`SELECT 1 FROM messages m
     JOIN conversation_members c ON c.conversation_id = m.conversation_id AND c.user_id = ?
     WHERE m.media_key = ?`,
	)
		.bind(userId, key)
		.first();
	return !!msg;
}
