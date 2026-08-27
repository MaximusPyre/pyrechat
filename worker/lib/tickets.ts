import type { Hono } from "hono";
import { betaTicketsEnabled, isFounderUsername, type AuthedUser } from "./auth.js";
import { bad, json, nowIso, notify } from "./util.js";

type Vars = { user: AuthedUser };
type App = Hono<{ Bindings: Env; Variables: Vars }>;

type TicketEnv = Env & {
	TICKET_WEBHOOK_URL?: string;
	TICKET_WEBHOOK_SECRET?: string;
	CURSOR_WEBHOOK_URL?: string;
	CURSOR_WEBHOOK_SECRET?: string;
	BETA_TICKETS?: string;
};

export type TicketRow = {
	id: string;
	user_id: string;
	username: string;
	kind: string;
	title: string;
	body: string;
	status: string;
	note: string | null;
	pr_url: string | null;
	agent_url: string | null;
	rollout: string | null;
	created_at: string;
	updated_at: string;
};

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

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_TYPES = new Set([
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

const EXT_TYPE: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	heic: "image/heic",
	heif: "image/heif",
	pdf: "application/pdf",
	txt: "text/plain",
	log: "text/plain",
	csv: "text/csv",
	json: "application/json",
	zip: "application/zip",
	mp4: "video/mp4",
	webm: "video/webm",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
};

const RESULT_STATUSES = new Set(["shipped", "skipped", "failed", "working"]);

function originOf(env: Env, request: Request): string {
	const pub = (env.PUBLIC_APP_URL || "").replace(/\/$/, "");
	if (pub) return pub;
	try {
		return new URL(request.url).origin;
	} catch {
		return "https://chat.pyrearms.dev";
	}
}

async function sha256Hex(value: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

function sanitizeFilename(raw: string): string {
	const base = raw.replace(/\\/g, "/").split("/").pop() || "attachment";
	return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120) || "attachment";
}

function extOf(name: string): string {
	const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
	return m?.[1] || "";
}

function resolveType(header: string, filename: string): string | null {
	const ct = (header || "").split(";")[0].trim().toLowerCase();
	if (ALLOWED_TYPES.has(ct)) return ct === "image/jpg" ? "image/jpeg" : ct;
	const guessed = EXT_TYPE[extOf(filename)];
	if (guessed) return guessed;
	if (ct === "application/octet-stream" || !ct) return null;
	return null;
}

function publicTicket(row: TicketRow, attachments: AttachmentRow[], founder: boolean) {
	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		body: row.body,
		status: row.status,
		note: row.note,
		prUrl: row.pr_url,
		agentUrl: row.agent_url,
		rollout: row.rollout,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		username: founder ? row.username : undefined,
		attachments: attachments.map((a) => ({
			id: a.id,
			name: a.filename,
			contentType: a.content_type,
			size: a.byte_size,
			url: `/api/tickets/files/${a.id}`,
			image: a.content_type.startsWith("image/"),
		})),
	};
}

async function attachmentsFor(env: Env, ticketIds: string[]): Promise<Map<string, AttachmentRow[]>> {
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

async function verifyCallbackToken(env: Env, ticketId: string, token: string): Promise<boolean> {
	if (!ticketId || !token) return false;
	const row = await env.DB.prepare("SELECT token_hash FROM ticket_callbacks WHERE ticket_id = ?")
		.bind(ticketId)
		.first<{ token_hash: string }>();
	if (!row?.token_hash) return false;
	const hash = await sha256Hex(token);
	return timingSafeEqual(hash, row.token_hash);
}

function readBearer(request: Request): string | null {
	const auth = request.headers.get("Authorization");
	if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
	try {
		return new URL(request.url).searchParams.get("token");
	} catch {
		return null;
	}
}

async function dispatchWebhook(env: TicketEnv, payload: unknown): Promise<void> {
	const url = env.TICKET_WEBHOOK_URL || env.CURSOR_WEBHOOK_URL;
	if (!url) return;
	const secret = env.TICKET_WEBHOOK_SECRET || env.CURSOR_WEBHOOK_SECRET;
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (secret) headers.Authorization = `Bearer ${secret}`;
	const res = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(15000),
	});
	if (!res.ok) throw new Error(`ticket webhook ${res.status}`);
}

async function serveAttachment(env: Env, att: AttachmentRow): Promise<Response> {
	const obj = await env.MEDIA.get(att.media_key);
	if (!obj) return bad("Not found", 404);
	const headers = new Headers();
	headers.set("Content-Type", att.content_type || obj.httpMetadata?.contentType || "application/octet-stream");
	headers.set("Cache-Control", "private, max-age=3600");
	headers.set("Content-Disposition", `inline; filename="${sanitizeFilename(att.filename)}"`);
	return new Response(obj.body, { headers });
}

export function registerTicketRoutes(app: App): void {
	app.post("/api/tickets/attachments", async (c) => {
		if (!betaTicketsEnabled(c.env)) return bad("Private beta tickets are closed.", 404);
		const me = c.get("user");
		const filename = sanitizeFilename(c.req.header("x-filename") || c.req.query("filename") || "attachment");
		const contentType = resolveType(c.req.header("content-type") || "", filename);
		if (!contentType) return bad("That file type is not allowed on tickets");
		const buf = await c.req.arrayBuffer();
		if (buf.byteLength < 1) return bad("Empty file");
		if (buf.byteLength > MAX_FILE_BYTES) return bad("File too large (10 MB max)", 413);
		const pending = await c.env.DB.prepare(
			"SELECT COUNT(*) AS n FROM ticket_attachments WHERE user_id = ? AND ticket_id IS NULL",
		)
			.bind(me.id)
			.first<{ n: number }>();
		if ((pending?.n || 0) >= MAX_FILES) return bad(`At most ${MAX_FILES} files per ticket`);
		const id = crypto.randomUUID();
		const ext = extOf(filename) || (contentType.startsWith("image/") ? "jpg" : "bin");
		const key = `tickets/${me.id}/${id}.${ext}`;
		await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType } });
		await c.env.DB.prepare(
			`INSERT INTO ticket_attachments (id, ticket_id, user_id, media_key, filename, content_type, byte_size, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(id, me.id, key, filename, contentType, buf.byteLength, nowIso())
			.run();
		return json({
			id,
			key,
			filename,
			contentType,
			size: buf.byteLength,
			url: `/api/tickets/files/${id}`,
			image: contentType.startsWith("image/"),
		});
	});

	app.get("/api/tickets/files/:id", async (c) => {
		const me = c.get("user");
		const id = c.req.param("id");
		const att = await c.env.DB.prepare("SELECT * FROM ticket_attachments WHERE id = ?")
			.bind(id)
			.first<AttachmentRow>();
		if (!att) return bad("Not found", 404);
		if (att.user_id !== me.id && !isFounderUsername(me.username)) return bad("Forbidden", 403);
		return serveAttachment(c.env, att);
	});

	app.get("/api/tickets", async (c) => {
		if (!betaTicketsEnabled(c.env)) return bad("Private beta tickets are closed.", 404);
		const me = c.get("user");
		const founder = isFounderUsername(me.username);
		const rows = founder
			? await c.env.DB.prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 80").all<TicketRow>()
			: await c.env.DB.prepare("SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 80")
					.bind(me.id)
					.all<TicketRow>();
		const tickets = rows.results || [];
		const attMap = await attachmentsFor(
			c.env,
			tickets.map((t) => t.id),
		);
		return json({ tickets: tickets.map((t) => publicTicket(t, attMap.get(t.id) || [], founder)) });
	});

	app.post("/api/tickets", async (c) => {
		if (!betaTicketsEnabled(c.env)) return bad("Private beta tickets are closed.", 404);
		const me = c.get("user");
		const body = await c.req.json<{
			kind?: string;
			title?: string;
			body?: string;
			attachmentIds?: string[];
		}>();
		const kind = body.kind === "feature" ? "feature" : body.kind === "bug" ? "bug" : "";
		if (!kind) return bad("Kind must be bug or feature");
		const title = (body.title || "").trim().slice(0, 80);
		const text = (body.body || "").trim().slice(0, 4000);
		if (title.length < 3) return bad("Title is too short");
		if (text.length < 8) return bad("Tell us a bit more");
		const ids = Array.isArray(body.attachmentIds) ? body.attachmentIds.slice(0, MAX_FILES) : [];
		const attachments: AttachmentRow[] = [];
		for (const attId of ids) {
			const att = await c.env.DB.prepare(
				"SELECT * FROM ticket_attachments WHERE id = ? AND user_id = ? AND ticket_id IS NULL",
			)
				.bind(attId, me.id)
				.first<AttachmentRow>();
			if (att) attachments.push(att);
		}

		const id = crypto.randomUUID();
		const created = nowIso();
		const rawToken = crypto.randomUUID() + crypto.randomUUID();
		const tokenHash = await sha256Hex(rawToken);
		await c.env.DB.prepare(
			`INSERT INTO tickets (id, user_id, username, kind, title, body, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
		)
			.bind(id, me.id, me.username, kind, title, text, created, created)
			.run();
		await c.env.DB.prepare("INSERT INTO ticket_callbacks (ticket_id, token_hash) VALUES (?, ?)")
			.bind(id, tokenHash)
			.run();
		for (const att of attachments) {
			await c.env.DB.prepare("UPDATE ticket_attachments SET ticket_id = ? WHERE id = ?").bind(id, att.id).run();
		}

		const origin = originOf(c.env, c.req.raw);
		const webhookAttachments = attachments.map((a) => ({
			id: a.id,
			name: a.filename,
			contentType: a.content_type,
			size: a.byte_size,
			url: `${origin}/api/internal/tickets/files/${a.id}`,
			// Bot fetches with Authorization: Bearer <callback.token>
		}));
		try {
			await dispatchWebhook(c.env as TicketEnv, {
				event: "pyrechat.ticket",
				ticket: {
					id,
					kind,
					title,
					body: text,
					status: "queued",
					agentUrl: null,
					prUrl: null,
					note: null,
					createdAt: created,
					updatedAt: created,
					username: me.username,
					attachments: webhookAttachments,
				},
				repo: "https://github.com/MaximusPyre/pyrechat",
				callback: {
					url: `${origin}/api/internal/tickets/result`,
					ticketId: id,
					token: rawToken,
				},
			});
		} catch {
			await c.env.DB.prepare("UPDATE tickets SET note = ?, updated_at = ? WHERE id = ?")
				.bind("Filed, but the builder webhook did not accept it. It is still in the queue.", nowIso(), id)
				.run();
		}

		return json({
			ticket: publicTicket(
				{
					id,
					user_id: me.id,
					username: me.username,
					kind,
					title,
					body: text,
					status: "queued",
					note: null,
					pr_url: null,
					agent_url: null,
					rollout: null,
					created_at: created,
					updated_at: created,
				},
				attachments.map((a) => ({ ...a, ticket_id: id })),
				isFounderUsername(me.username),
			),
		});
	});

	app.post("/api/internal/tickets/result", async (c) => {
		const token = readBearer(c.req.raw);
		const body = await c.req.json<{
			ticketId?: string;
			status?: string;
			note?: string;
			prUrl?: string;
			rollout?: string;
			agentUrl?: string;
		}>();
		const ticketId = (body.ticketId || "").trim();
		if (!ticketId || !token) return bad("Unauthorized", 401);
		if (!(await verifyCallbackToken(c.env, ticketId, token))) return bad("Unauthorized", 401);
		const status = (body.status || "").trim();
		if (!RESULT_STATUSES.has(status)) return bad("status must be shipped, skipped, failed, or working");
		const note = (body.note || "").trim().slice(0, 2000);
		if (!note) return bad("note is required");
		const prUrl = typeof body.prUrl === "string" ? body.prUrl.trim().slice(0, 500) : "";
		const rollout = typeof body.rollout === "string" ? body.rollout.trim().slice(0, 32) : "";
		const agentUrl = typeof body.agentUrl === "string" ? body.agentUrl.trim().slice(0, 500) : "";
		const ticket = await c.env.DB.prepare("SELECT * FROM tickets WHERE id = ?").bind(ticketId).first<TicketRow>();
		if (!ticket) return bad("Not found", 404);
		await c.env.DB.prepare(
			`UPDATE tickets SET status = ?, note = ?, pr_url = ?, agent_url = ?, rollout = ?, updated_at = ? WHERE id = ?`,
		)
			.bind(status, note, prUrl || null, agentUrl || ticket.agent_url, rollout || null, nowIso(), ticketId)
			.run();
		const label =
			status === "shipped"
				? "Ticket shipped"
				: status === "skipped"
					? "Ticket skipped"
					: status === "working"
						? "Ticket in progress"
						: "Ticket failed";
		await notify(c.env, ticket.user_id, "ticket", `${label}: ${note}`, {
			ticketId,
			prUrl: prUrl || undefined,
			status,
			rollout: rollout || undefined,
		});
		return json({ ok: true });
	});

	app.get("/api/internal/tickets/files/:id", async (c) => {
		const token = readBearer(c.req.raw);
		const att = await c.env.DB.prepare("SELECT * FROM ticket_attachments WHERE id = ?")
			.bind(c.req.param("id"))
			.first<AttachmentRow>();
		if (!att?.ticket_id) return bad("Not found", 404);
		if (!token || !(await verifyCallbackToken(c.env, att.ticket_id, token))) return bad("Unauthorized", 401);
		return serveAttachment(c.env, att);
	});
}
