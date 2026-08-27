import { hmacHex, timingSafeEqual } from "./auth.js";
import { envText, isBetaOpen } from "./env.js";
import { nowIso, notify } from "./util.js";

export type TicketKind = "bug" | "feature";
export type TicketStatus = "queued" | "working" | "shipped" | "skipped" | "failed";
export type TicketRollout = "none" | "live" | "apk";

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

export function publicTicket(row: TicketRow) {
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
	};
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
	const res = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({
			event: "pyrechat.ticket",
			ticket: publicTicket(ticket),
			repo: envText(env, "CURSOR_REPO") || "https://github.com/MaximusPyre/pyrechat",
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
	const rolloutRaw = (body.rollout || "none").trim().toLowerCase();
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
