import { hmacHex, timingSafeEqual } from "./auth.js";
import { envText, isBetaOpen } from "./env.js";
import { nowIso, notify } from "./util.js";

export type TicketKind = "bug" | "feature";
export type TicketStatus = "queued" | "working" | "shipped" | "skipped" | "failed";
export type TicketRollout = "none" | "live" | "apk";

export type AttachmentRow = {
	id: string;
	ticket_id: string | null;
	user_id: string;
	media_key: string;
	filename: string;
	content_type: string;
	byte_size: number;
	created_at: string;
};

export type PublicAttachment = {
	id: string;
	name: string;
	contentType: string;
	size: number;
	url: string;
	image: boolean;
};

export type TicketRow = {
	id: string;
	user_id: string;
	kind: TicketKind;
	title: string;
	body: string;
	status: TicketStatus;
	agent_id: string | null;
	agent_url: string | null;
	pr_url: string | null;
	note: string | null;
	created_at: string;
	updated_at: string;
	username?: string;
};

export type TicketResultBody = {
	ticketId?: string;
	status?: string;
	note?: string;
	prUrl?: string;
	rollout?: string;
	androidVersionCode?: number;
};

const RESULT_STATUSES = new Set<TicketStatus>(["working", "shipped", "skipped", "failed"]);
const APK_URL = "https://chat.pyrearms.dev/api/download/android";
const PR_URL_RE = /^https:\/\/github\.com\/MaximusPyre\/pyrechat(?:\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*)?$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const TICKET_MAX_FILES = 5;
const TICKET_TYPES = new Set([
	"image/jpeg",
	"image/jpg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/heic",
	"image/heif",
	"application/pdf",
	"text/plain",
	"text/csv",
	"application/json",
	"application/zip",
	"application/x-zip-compressed",
	"video/mp4",
	"video/webm",
	"audio/mpeg",
	"audio/webm",
	"audio/mp4",
]);
const TICKET_EXT: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	heic: "image/heic",
	heif: "image/heif",
	pdf: "application/pdf",
	txt: "text/plain",
	csv: "text/csv",
	json: "application/json",
	zip: "application/zip",
	mp4: "video/mp4",
	webm: "video/webm",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
};

export function publicTicket(row: TicketRow, attachments: AttachmentRow[] = []) {
	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		body: row.body,
		status: row.status,
		agentUrl: row.agent_url,
		prUrl: row.pr_url,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		username: row.username || undefined,
		attachments: attachments.map(publicAttachment),
	};
}

export function sanitizeTicketFilename(raw: string): string {
	const base = raw.replace(/\\/g, "/").split("/").pop() || "attachment";
	return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120) || "attachment";
}

export function ticketFileType(header: string, filename: string): string | null {
	const ct = (header || "").split(";")[0].trim().toLowerCase();
	if (TICKET_TYPES.has(ct)) return ct === "image/jpg" ? "image/jpeg" : ct;
	const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
	return (m && TICKET_EXT[m[1]]) || null;
}

export async function serveTicketAttachment(env: Env, att: AttachmentRow): Promise<Response> {
	const obj = await env.MEDIA.get(att.media_key);
	if (!obj) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
	const headers = new Headers();
	headers.set("Content-Type", att.content_type || obj.httpMetadata?.contentType || "application/octet-stream");
	headers.set("Cache-Control", "private, max-age=3600");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Content-Disposition", `inline; filename="${sanitizeTicketFilename(att.filename)}"`);
	return new Response(obj.body, { headers });
}

export { MAX_FILE_BYTES };

export function publicAttachment(a: AttachmentRow): PublicAttachment {
	return {
		id: a.id,
		name: a.filename,
		contentType: a.content_type,
		size: a.byte_size,
		url: `/api/tickets/files/${a.id}`,
		image: a.content_type.startsWith("image/"),
	};
}

export function ticketFileExt(ct: string, filename: string): string {
	const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
	if (m && TICKET_EXT[m[1]]) return m[1] === "jpeg" ? "jpg" : m[1];
	if (ct === "image/jpeg") return "jpg";
	if (ct === "text/csv") return "csv";
	if (ct === "application/json") return "json";
	if (ct === "image/heic") return "heic";
	if (ct === "image/heif") return "heif";
	if (ct === "application/pdf") return "pdf";
	if (ct === "text/plain") return "txt";
	if (ct.includes("zip")) return "zip";
	if (ct.startsWith("audio/mpeg")) return "mp3";
	if (ct.includes("mp4")) return "mp4";
	if (ct.includes("webm")) return "webm";
	return "bin";
}

export async function claimTicketAttachments(
	env: Env,
	userId: string,
	ticketId: string,
	ids: string[],
): Promise<AttachmentRow[]> {
	const claimed: AttachmentRow[] = [];
	for (const raw of ids.slice(0, TICKET_MAX_FILES)) {
		if (!/^[0-9a-f-]{36}$/i.test(raw)) continue;
		const att = await env.DB.prepare(
			"SELECT * FROM ticket_attachments WHERE id = ? AND user_id = ? AND ticket_id IS NULL",
		)
			.bind(raw, userId)
			.first<AttachmentRow>();
		if (!att) continue;
		await env.DB.prepare("UPDATE ticket_attachments SET ticket_id = ? WHERE id = ?").bind(ticketId, att.id).run();
		claimed.push({ ...att, ticket_id: ticketId });
	}
	return claimed;
}

export async function attachmentsFor(env: Env, ticketIds: string[]): Promise<Map<string, AttachmentRow[]>> {
	const map = new Map<string, AttachmentRow[]>();
	if (ticketIds.length === 0) return map;
	const placeholders = ticketIds.map(() => "?").join(",");
	const rows = await env.DB.prepare(
		`SELECT * FROM ticket_attachments WHERE ticket_id IN (${placeholders}) ORDER BY created_at`,
	)
		.bind(...ticketIds)
		.all<AttachmentRow>();
	for (const row of rows.results || []) {
		const key = row.ticket_id || "";
		const list = map.get(key) || [];
		list.push(row);
		map.set(key, list);
	}
	return map;
}

function webhookUrl(env: Env): string {
	return envText(env, "TICKET_WEBHOOK_URL");
}

function webhookAuth(env: Env): string {
	const raw = envText(env, "TICKET_WEBHOOK_TOKEN");
	if (!raw) return "";
	return /^bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`;
}

function callbackSecret(env: Env): string {
	return envText(env, "TICKET_CALLBACK_SECRET") || envText(env, "SESSION_SECRET");
}

function originUrl(env: Env): string {
	return envText(env, "PUBLIC_APP_URL") || "https://chat.pyrearms.dev";
}

export async function ticketCallbackToken(env: Env, ticketId: string): Promise<string> {
	const secret = callbackSecret(env);
	if (!secret) throw new Error("missing callback secret");
	return hmacHex(secret, `ticket-result:v1:${ticketId}`);
}

export async function verifyTicketCallbackToken(env: Env, ticketId: string, given: string): Promise<boolean> {
	if (!given || given.length > 200) return false;
	try {
		const expected = await ticketCallbackToken(env, ticketId);
		return timingSafeEqual(given, expected);
	} catch {
		return false;
	}
}

export function bearerToken(request: Request): string {
	const raw = request.headers.get("Authorization") || "";
	return raw.replace(/^bearer\s+/i, "").trim();
}

export function verifyTicketBotBearer(env: Env, given: string): boolean {
	const expected = envText(env, "TICKET_WEBHOOK_TOKEN").replace(/^bearer\s+/i, "").trim();
	if (!expected || !given) return false;
	return timingSafeEqual(given, expected);
}

function cleanNote(raw: string | undefined): string {
	return (raw || "")
		.replace(/[\u0000-\u001f\u007f]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 400);
}

function cleanPrUrl(raw: string | undefined): string | null {
	const url = (raw || "").trim();
	if (!url) return null;
	if (!PR_URL_RE.test(url) || url.length > 240) return null;
	return url;
}

export async function dispatchTicketWebhook(env: Env, ticket: TicketRow): Promise<void> {
	if (!isBetaOpen(env)) return;
	const url = webhookUrl(env);
	if (!url) {
		await env.DB.prepare("UPDATE tickets SET note = ?, updated_at = ? WHERE id = ? AND status = 'queued'")
			.bind("Automation webhook is not set yet.", nowIso(), ticket.id)
			.run();
		return;
	}
	const headers = new Headers({ "Content-Type": "application/json" });
	const auth = webhookAuth(env);
	if (auth) headers.set("Authorization", auth);
	const origin = originUrl(env);
	const callbackToken = await ticketCallbackToken(env, ticket.id);
	const attMap = await attachmentsFor(env, [ticket.id]);
	const attachments = (attMap.get(ticket.id) || []).map((a) => ({
		...publicAttachment(a),
		url: `${origin}/api/internal/tickets/files/${a.id}`,
	}));
	const res = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({
			event: "pyrechat.ticket",
			ticket: { ...publicTicket(ticket, attMap.get(ticket.id) || []), attachments },
			repo: envText(env, "CURSOR_REPO") || "https://github.com/MaximusPyre/pyrechat",
			ship: {
				autoMerge: true,
				rollout: "live",
				markPrReady: true,
				note: "Open a PR on MaximusPyre/pyrechat from a cursor/* branch. GitHub auto-merges it to master and Cloudflare deploys immediately. Web and native WebView pick it up on next load. Set rollout apk only for native/plugin changes.",
			},
			callback: {
				url: `${origin}/api/internal/tickets/result`,
				ticketId: ticket.id,
				token: callbackToken,
			},
		}),
	});
	const errText = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 400);
	if (!res.ok) {
		await env.DB.prepare(
			"UPDATE tickets SET status = 'failed', note = ?, updated_at = ? WHERE id = ? AND status = 'queued'",
		)
			.bind(`Webhook ${res.status}${errText ? `: ${errText}` : ""}`, nowIso(), ticket.id)
			.run();
		return;
	}
	await env.DB.prepare(
		"UPDATE tickets SET status = 'working', note = NULL, updated_at = ? WHERE id = ? AND status = 'queued'",
	)
		.bind(nowIso(), ticket.id)
		.run();
}

export async function applyTicketResult(
	env: Env,
	ticketId: string,
	body: TicketResultBody,
): Promise<{ ok: true } | { error: string; status: number }> {
	if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return { error: "Not found", status: 404 };
	const status = (body.status || "") as TicketStatus;
	if (!RESULT_STATUSES.has(status)) return { error: "status must be working, shipped, skipped, or failed", status: 400 };
	const note = cleanNote(body.note);
	if (status !== "working" && note.length < 4) return { error: "note is required", status: 400 };
	const prUrl = cleanPrUrl(body.prUrl);
	if (body.prUrl && !prUrl) return { error: "prUrl must be a MaximusPyre/pyrechat GitHub link", status: 400 };
	const rolloutRaw = (body.rollout || (status === "shipped" ? "live" : "none")).trim().toLowerCase();
	const rollout: TicketRollout =
		rolloutRaw === "live" || rolloutRaw === "apk" || rolloutRaw === "none" ? rolloutRaw : "none";
	if (rollout !== "none" && status !== "shipped") return { error: "rollout only on shipped tickets", status: 400 };

	const row = await env.DB.prepare("SELECT * FROM tickets WHERE id = ?").bind(ticketId).first<TicketRow>();
	if (!row) return { error: "Not found", status: 404 };
	if (row.status === "shipped" && status !== "shipped") return { error: "Ticket already shipped", status: 409 };

	await env.DB.prepare(
		"UPDATE tickets SET status = ?, note = ?, pr_url = COALESCE(?, pr_url), updated_at = ? WHERE id = ?",
	)
		.bind(status, note || null, prUrl, nowIso(), ticketId)
		.run();

	if (status === "working") return { ok: true };

	const reporterNote =
		status === "shipped"
			? `Your ${row.kind} “${row.title}” shipped. ${note}`
			: status === "skipped"
				? `Your ${row.kind} “${row.title}” was skipped. ${note}`
				: `Your ${row.kind} “${row.title}” could not be done. ${note}`;
	await notify(env, row.user_id, "ticket", reporterNote.slice(0, 400), {
		ticketId: row.id,
		status,
		prUrl,
		rollout,
	});

	if (status === "shipped" && rollout === "live") {
		await setAppNotice(env, "live", "PyreChat updated. You’re already on the new build in the app.");
		await notifyEveryone(env, "app_update", "PyreChat just updated in the app. No download needed.", {
			rollout: "live",
			ticketId: row.id,
		});
	}

	if (status === "shipped" && rollout === "apk") {
		const nextCode = await bumpAndroidVersion(env, body.androidVersionCode);
		await setAppNotice(env, "apk", "A new Android APK is ready. Install it to pick up native changes.", APK_URL);
		await notifyEveryone(
			env,
			"app_update",
			`New PyreChat Android build (v${nextCode}). Tap to download.`,
			{ rollout: "apk", url: APK_URL, versionCode: nextCode, ticketId: row.id },
		);
	}

	return { ok: true };
}

async function configGet(env: Env, key: string, fallback: string): Promise<string> {
	const row = await env.DB.prepare("SELECT value FROM app_config WHERE key = ?").bind(key).first<{ value: string }>();
	return row?.value || fallback;
}

async function configSet(env: Env, key: string, value: string): Promise<void> {
	await env.DB.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)").bind(key, value).run();
}

export async function androidRelease(env: Env): Promise<{ versionCode: number; versionName: string; url: string }> {
	const versionCode = Number(await configGet(env, "android_version_code", "2")) || 2;
	const versionName = await configGet(env, "android_version_name", "1.1");
	return { versionCode, versionName, url: APK_URL };
}

export async function latestAppNotice(env: Env): Promise<{
	id: string;
	kind: string;
	body: string;
	url: string | null;
	createdAt: string;
} | null> {
	const row = await env.DB.prepare("SELECT * FROM app_notices ORDER BY created_at DESC LIMIT 1").first<{
		id: string;
		kind: string;
		body: string;
		url: string | null;
		created_at: string;
	}>();
	if (!row) return null;
	return { id: row.id, kind: row.kind, body: row.body, url: row.url, createdAt: row.created_at };
}

async function setAppNotice(env: Env, kind: string, body: string, url?: string): Promise<void> {
	await env.DB.prepare("DELETE FROM app_notices").run();
	await env.DB.prepare("INSERT INTO app_notices (id, kind, body, url, created_at) VALUES (?, ?, ?, ?, ?)")
		.bind(crypto.randomUUID(), kind, body.slice(0, 400), url || null, nowIso())
		.run();
}

async function bumpAndroidVersion(env: Env, requested?: number): Promise<number> {
	const current = Number(await configGet(env, "android_version_code", "2")) || 2;
	let next = current + 1;
	if (Number.isInteger(requested) && (requested as number) > current && (requested as number) <= current + 20) {
		next = requested as number;
	}
	await configSet(env, "android_version_code", String(next));
	await configSet(env, "android_version_name", `1.${next}`);
	return next;
}

async function notifyEveryone(
	env: Env,
	kind: string,
	body: string,
	payload?: unknown,
): Promise<void> {
	const users = await env.DB.prepare("SELECT id FROM users LIMIT 2000").all<{ id: string }>();
	const now = nowIso();
	const text = body.slice(0, 400);
	const blob = payload ? JSON.stringify(payload) : null;
	const stmts = users.results.map((u) =>
		env.DB.prepare(
			"INSERT INTO notifications (id, user_id, kind, body, payload, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
		).bind(crypto.randomUUID(), u.id, kind, text, blob, now),
	);
	for (let i = 0; i < stmts.length; i += 40) {
		await env.DB.batch(stmts.slice(i, i + 40));
	}
}
