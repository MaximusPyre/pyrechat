import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	clearSessionCookie,
	createSession,
	hashPassword,
	publicUser,
	requireUser,
	sessionCookie,
	verifyPassword,
	type AuthedUser,
} from "./lib/auth.js";
import {
	bad,
	bumpScore,
	dmId,
	hoursFromNow,
	json,
	monthKey,
	nowIso,
	notify,
	pairKey,
	parseJson,
} from "./lib/util.js";

type Vars = { user: AuthedUser };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use(
	"/api/*",
	cors({
		origin: (origin) => origin || "*",
		credentials: true,
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	}),
);

app.onError((err, c) => {
	return c.json({ error: err.message || "Server error" }, 500);
});

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;

app.post("/api/auth/signup", async (c) => {
	const body = await c.req.json<{
		username?: string;
		password?: string;
		displayName?: string;
		birthday?: string;
	}>();
	const username = (body.username || "").trim();
	const password = body.password || "";
	const displayName = (body.displayName || username).trim();
	if (!USERNAME_RE.test(username)) return bad("Username must be 3–24 letters, numbers, dots, or underscores");
	if (password.length < 6) return bad("Password must be at least 6 characters");
	const exists = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
	if (exists) return bad("Username taken", 409);
	const id = crypto.randomUUID();
	const skullmoji = JSON.stringify({
		color: "#FF6A1A",
		eyes: "hollow",
		jaw: "grin",
		hat: "none",
		bg: "#111111",
	});
	try {
		await c.env.DB.prepare(
			`INSERT INTO users (id, username, display_name, password_hash, birthday, skullmoji, created_at, last_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(id, username, displayName, await hashPassword(password), body.birthday || null, skullmoji, nowIso(), nowIso())
			.run();
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/UNIQUE/i.test(msg)) return bad("Username taken", 409);
		return bad("Could not create account", 500);
	}
	const token = await createSession(c.env, id);
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<AuthedUser>();
	c.header("Set-Cookie", sessionCookie(token));
	return json({ token, user: publicUser(user!) });
});

app.post("/api/auth/login", async (c) => {
	const body = await c.req.json<{ username?: string; password?: string }>();
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?")
		.bind((body.username || "").trim())
		.first<AuthedUser & { password_hash: string }>();
	if (!user || !(await verifyPassword(body.password || "", user.password_hash))) {
		return bad("Invalid username or password", 401);
	}
	const token = await createSession(c.env, user.id);
	c.header("Set-Cookie", sessionCookie(token));
	return json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", async (c) => {
	const auth = await requireUser(c.req.raw, c.env);
	if (auth instanceof Response) {
		c.header("Set-Cookie", clearSessionCookie());
		return json({ ok: true });
	}
	await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(auth.token).run();
	c.header("Set-Cookie", clearSessionCookie());
	return json({ ok: true });
});

app.use("/api/*", async (c, next) => {
	if (c.req.path.startsWith("/api/auth/")) return next();
	if (c.req.path === "/api/legal-notice") return next();
	if (c.req.path === "/api/admin/legal/takedown") return next();
	if (c.req.path === "/api/health") return next();
	if (c.req.method === "OPTIONS") return next();
	const auth = await requireUser(c.req.raw, c.env);
	if (auth instanceof Response) return auth;
	c.set("user", auth.user);
	return next();
});

app.get("/api/me", (c) => json({ user: publicUser(c.get("user")) }));

app.patch("/api/me", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<Record<string, unknown>>();
	const display = typeof body.displayName === "string" ? body.displayName.trim() : me.display_name;
	const bio = typeof body.bio === "string" ? body.bio.slice(0, 140) : me.bio;
	const storyPrivacy = typeof body.storyPrivacy === "string" ? body.storyPrivacy : me.story_privacy;
	const whoCanContact = typeof body.whoCanContact === "string" ? body.whoCanContact : me.who_can_contact;
	const mapMode = typeof body.mapMode === "string" ? body.mapMode : me.map_mode;
	const mapSelected = Array.isArray(body.mapSelected) ? JSON.stringify(body.mapSelected) : me.map_selected;
	const skullmoji = body.skullmoji ? JSON.stringify(body.skullmoji) : me.skullmoji;
	const birthday = typeof body.birthday === "string" ? body.birthday : me.birthday;
	const phone = typeof body.phone === "string" ? body.phone : me.phone;
	const email = typeof body.email === "string" ? body.email : me.email;
	await c.env.DB.prepare(
		`UPDATE users SET display_name=?, bio=?, story_privacy=?, who_can_contact=?, map_mode=?, map_selected=?, skullmoji=?, birthday=?, phone=?, email=? WHERE id=?`,
	)
		.bind(display, bio, storyPrivacy, whoCanContact, mapMode, mapSelected, skullmoji, birthday, phone, email, me.id)
		.run();
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<AuthedUser>();
	return json({ user: publicUser(user!) });
});

app.get("/api/users/search", async (c) => {
	const q = (c.req.query("q") || "").trim();
	if (q.length < 1) return json({ users: [] });
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT id, username, display_name, skullmoji, snap_score FROM users
     WHERE id != ? AND (username LIKE ? OR display_name LIKE ?) LIMIT 30`,
	)
		.bind(me.id, `%${q}%`, `%${q}%`)
		.all();
	return json({ users: rows.results });
});

app.get("/api/users/:id", async (c) => {
	const row = await c.env.DB.prepare(
		"SELECT id, username, display_name, bio, skullmoji, snap_score, created_at, last_active FROM users WHERE id = ?",
	)
		.bind(c.req.param("id"))
		.first();
	if (!row) return bad("Not found", 404);
	return json({ user: row });
});

async function areFriends(env: Env, a: string, b: string): Promise<boolean> {
	const row = await env.DB.prepare(
		"SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'",
	)
		.bind(a, b)
		.first();
	return !!row;
}

app.get("/api/friends", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT u.id, u.username, u.display_name, u.skullmoji, u.snap_score, u.last_active, f.status,
            s.count AS streak, s.expires_at AS streak_expires, s.record AS streak_record
     FROM friendships f
     JOIN users u ON u.id = f.friend_id
     LEFT JOIN streaks s ON s.user_a = CASE WHEN f.user_id < f.friend_id THEN f.user_id ELSE f.friend_id END
                        AND s.user_b = CASE WHEN f.user_id < f.friend_id THEN f.friend_id ELSE f.user_id END
     WHERE f.user_id = ?
     ORDER BY u.display_name`,
	)
		.bind(me.id)
		.all();
	return json({ friends: rows.results });
});

app.get("/api/friends/pending", async (c) => {
	const me = c.get("user");
	const incoming = await c.env.DB.prepare(
		`SELECT u.id, u.username, u.display_name, u.skullmoji FROM friendships f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = ? AND f.status = 'pending'`,
	)
		.bind(me.id)
		.all();
	return json({ incoming: incoming.results });
});

app.get("/api/friends/quick-add", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT u.id, u.username, u.display_name, u.skullmoji, u.created_at
     FROM users u
     WHERE u.id != ?
       AND u.id NOT IN (SELECT friend_id FROM friendships WHERE user_id = ?)
     ORDER BY u.created_at DESC
     LIMIT 20`,
	)
		.bind(me.id, me.id)
		.all();
	return json({ suggestions: rows.results });
});

app.post("/api/friends/add", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ username?: string; userId?: string }>();
	let target = body.userId
		? await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(body.userId).first<AuthedUser>()
		: await c.env.DB.prepare("SELECT * FROM users WHERE username = ?")
				.bind((body.username || "").trim())
				.first<AuthedUser>();
	if (!target || target.id === me.id) return bad("User not found", 404);
	const blocked = await c.env.DB.prepare(
		"SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)",
	)
		.bind(me.id, target.id, target.id, me.id)
		.first();
	if (blocked) return bad("Cannot add this user", 403);
	const reverse = await c.env.DB.prepare(
		"SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?",
	)
		.bind(target.id, me.id)
		.first<{ status: string }>();
	if (target.who_can_contact === "friends") {
		const already = await areFriends(c.env, me.id, target.id);
		if (!already && reverse?.status !== "pending") {
			return bad("This user only accepts friends", 403);
		}
	}
	const now = nowIso();
	if (reverse?.status === "pending" || reverse?.status === "accepted") {
		await c.env.DB.prepare(
			"INSERT OR REPLACE INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', ?)",
		)
			.bind(me.id, target.id, now)
			.run();
		await c.env.DB.prepare(
			"INSERT OR REPLACE INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', ?)",
		)
			.bind(target.id, me.id, now)
			.run();
		const [a, b] = pairKey(me.id, target.id);
		await c.env.DB.prepare(
			"INSERT OR IGNORE INTO streaks (user_a, user_b, count, record) VALUES (?, ?, 0, 0)",
		)
			.bind(a, b)
			.run();
		const convId = dmId(me.id, target.id);
		await c.env.DB.prepare(
			"INSERT OR IGNORE INTO conversations (id, is_group, created_by, created_at) VALUES (?, 0, ?, ?)",
		)
			.bind(convId, me.id, now)
			.run();
		await c.env.DB.prepare(
			"INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)",
		)
			.bind(convId, me.id, now)
			.run();
		await c.env.DB.prepare(
			"INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)",
		)
			.bind(convId, target.id, now)
			.run();
		await notify(c.env, target.id, "friend", `${me.display_name} added you`, { userId: me.id });
		return json({ status: "accepted", user: publicUser(target) });
	}
	await c.env.DB.prepare(
		"INSERT OR REPLACE INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)",
	)
		.bind(me.id, target.id, now)
		.run();
	await notify(c.env, target.id, "friend_request", `${me.display_name} wants to add you`, { userId: me.id });
	return json({ status: "pending", user: publicUser(target) });
});

app.post("/api/friends/remove", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ userId?: string }>();
	if (!body.userId) return bad("userId required");
	await c.env.DB.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?")
		.bind(me.id, body.userId)
		.run();
	await c.env.DB.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?")
		.bind(body.userId, me.id)
		.run();
	return json({ ok: true });
});

app.post("/api/block", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ userId?: string }>();
	if (!body.userId) return bad("userId required");
	await c.env.DB.prepare("INSERT OR IGNORE INTO blocks (user_id, blocked_id) VALUES (?, ?)")
		.bind(me.id, body.userId)
		.run();
	await c.env.DB.prepare("DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)")
		.bind(me.id, body.userId, body.userId, me.id)
		.run();
	return json({ ok: true });
});

app.post("/api/unblock", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ userId?: string }>();
	await c.env.DB.prepare("DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?")
		.bind(me.id, body.userId)
		.run();
	return json({ ok: true });
});

app.get("/api/friends/:id/profile", async (c) => {
	const me = c.get("user");
	const other = c.req.param("id");
	if (!(await areFriends(c.env, me.id, other))) return bad("Not friends", 403);
	const user = await c.env.DB.prepare(
		"SELECT id, username, display_name, bio, skullmoji, snap_score, birthday, created_at FROM users WHERE id = ?",
	)
		.bind(other)
		.first();
	const [a, b] = pairKey(me.id, other);
	const streak = await c.env.DB.prepare("SELECT * FROM streaks WHERE user_a = ? AND user_b = ?")
		.bind(a, b)
		.first();
	const friendship = await c.env.DB.prepare(
		"SELECT created_at FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'",
	)
		.bind(me.id, other)
		.first<{ created_at: string }>();
	const saved = await c.env.DB.prepare(
		`SELECT COUNT(*) AS n FROM message_saves ms
     JOIN messages m ON m.id = ms.message_id
     WHERE m.conversation_id = ?`,
	)
		.bind(dmId(me.id, other))
		.first<{ n: number }>();
	return json({
		user,
		streak,
		friendsSince: friendship?.created_at,
		savedCount: saved?.n || 0,
		charms: buildCharms(me, user as { birthday?: string | null; created_at?: string; snap_score?: number } | null, streak, friendship?.created_at),
	});
});

function zodiac(date: string | null | undefined): string {
	if (!date) return "unknown";
	const d = new Date(date);
	const m = d.getUTCMonth() + 1;
	const day = d.getUTCDate();
	const table: [number, number, string][] = [
		[1, 20, "Capricorn"],
		[2, 19, "Aquarius"],
		[3, 20, "Pisces"],
		[4, 20, "Aries"],
		[5, 21, "Taurus"],
		[6, 21, "Gemini"],
		[7, 22, "Cancer"],
		[8, 23, "Leo"],
		[9, 23, "Virgo"],
		[10, 23, "Libra"],
		[11, 22, "Scorpio"],
		[12, 21, "Sagittarius"],
		[12, 32, "Capricorn"],
	];
	for (const [tm, td, name] of table) {
		if (m < tm || (m === tm && day <= td)) return name;
	}
	return "Capricorn";
}

function buildCharms(
	me: AuthedUser,
	other: { birthday?: string | null; created_at?: string; snap_score?: number } | null,
	streak: unknown,
	since?: string,
) {
	const s = streak as { count?: number; record?: number } | null;
	return [
		{ id: "since", title: "Friends since", value: since ? since.slice(0, 10) : "—" },
		{ id: "streak", title: "Pyrestreak", value: String(s?.count || 0) },
		{ id: "record", title: "Best streak", value: String(s?.record || 0) },
		{ id: "stars", title: "Your signs", value: `${zodiac(me.birthday)} × ${zodiac(other?.birthday)}` },
		{ id: "score", title: "Their score", value: String(other?.snap_score || 0) },
	];
}

app.post("/api/media", async (c) => {
	const me = c.get("user");
	const ct = c.req.header("content-type") || "application/octet-stream";
	const ext = ct.includes("video") ? "webm" : ct.includes("audio") ? "webm" : "jpg";
	const key = `u/${me.id}/${crypto.randomUUID()}.${ext}`;
	const buf = await c.req.arrayBuffer();
	if (buf.byteLength > 40 * 1024 * 1024) return bad("File too large", 413);
	await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: ct } });
	return json({ key, url: `/api/media/${encodeURIComponent(key)}` });
});

app.get("/api/media/*", async (c) => {
	const key = decodeURIComponent(c.req.path.replace(/^\/api\/media\//, ""));
	const obj = await c.env.MEDIA.get(key);
	if (!obj) return bad("Not found", 404);
	const headers = new Headers();
	headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
	headers.set("Cache-Control", "private, max-age=3600");
	return new Response(obj.body, { headers });
});

async function touchStreak(env: Env, sender: string, recipient: string): Promise<void> {
	const [a, b] = pairKey(sender, recipient);
	const row = await env.DB.prepare("SELECT * FROM streaks WHERE user_a = ? AND user_b = ?").bind(a, b).first<{
		count: number;
		last_snap_user: string | null;
		expires_at: string | null;
		record: number;
	}>();
	const expires = hoursFromNow(24);
	if (!row) {
		await env.DB.prepare(
			"INSERT INTO streaks (user_a, user_b, count, last_snap_at, last_snap_user, expires_at, record) VALUES (?, ?, 0, ?, ?, ?, 0)",
		)
			.bind(a, b, nowIso(), sender, expires)
			.run();
		return;
	}
	if (row.last_snap_user && row.last_snap_user !== sender) {
		const next = (row.count || 0) + 1;
		const record = Math.max(row.record || 0, next);
		await env.DB.prepare(
			"UPDATE streaks SET count = ?, last_snap_at = ?, last_snap_user = ?, expires_at = ?, record = ? WHERE user_a = ? AND user_b = ?",
		)
			.bind(next, nowIso(), sender, expires, record, a, b)
			.run();
		return;
	}
	await env.DB.prepare(
		"UPDATE streaks SET last_snap_at = ?, last_snap_user = ?, expires_at = ? WHERE user_a = ? AND user_b = ?",
	)
		.bind(nowIso(), sender, row.expires_at && new Date(row.expires_at).getTime() > Date.now() ? row.expires_at : expires, a, b)
		.run();
}

app.post("/api/snaps", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{
		mediaKey?: string;
		kind?: string;
		durationSec?: number;
		caption?: string;
		overlay?: unknown;
		recipientIds?: string[];
		conversationId?: string;
		saveMemory?: boolean;
	}>();
	if (!body.mediaKey) return bad("mediaKey required");
	const id = crypto.randomUUID();
	const created = nowIso();
	const expires = hoursFromNow(24);
	const overlay = JSON.stringify(body.overlay || null);
	const recipients = new Set(body.recipientIds || []);
	let conversationId = body.conversationId || null;
	if (!conversationId && recipients.size === 1) {
		conversationId = dmId(me.id, [...recipients][0]);
	}
	await c.env.DB.prepare(
		`INSERT INTO snaps (id, sender_id, conversation_id, media_key, kind, duration_sec, caption, overlay_json, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			id,
			me.id,
			conversationId,
			body.mediaKey,
			body.kind === "video" ? "video" : "photo",
			Math.min(Math.max(body.durationSec || 5, 1), 10),
			body.caption || "",
			overlay,
			created,
			expires,
		)
		.run();
	for (const rid of recipients) {
		if (rid === me.id) continue;
		await c.env.DB.prepare("INSERT INTO snap_receipts (snap_id, user_id) VALUES (?, ?)").bind(id, rid).run();
		await touchStreak(c.env, me.id, rid);
		await bumpScore(c.env, me.id, 1);
		await notify(c.env, rid, "snap", `${me.display_name} sent a Pyre`, { snapId: id });
		const conv = conversationId || dmId(me.id, rid);
		const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(conv));
		await stub.fetch("https://room/broadcast", {
			method: "POST",
			body: JSON.stringify({ type: "snap", snapId: id, from: me.id }),
		});
	}
	if (body.saveMemory) {
		await c.env.DB.prepare(
			"INSERT INTO memories (id, user_id, media_key, kind, caption, created_at, month_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(crypto.randomUUID(), me.id, body.mediaKey, body.kind === "video" ? "video" : "photo", body.caption || "", created, monthKey(created))
			.run();
	}
	return json({ id });
});

app.get("/api/inbox", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT r.snap_id, r.viewed_at, r.replayed, r.screenshot_at,
            s.sender_id, s.kind, s.duration_sec, s.caption, s.created_at, s.conversation_id,
            u.username, u.display_name, u.skullmoji
     FROM snap_receipts r
     JOIN snaps s ON s.id = r.snap_id
     JOIN users u ON u.id = s.sender_id
     WHERE r.user_id = ? AND s.expires_at > datetime('now')
     ORDER BY s.created_at DESC`,
	)
		.bind(me.id)
		.all();
	return json({ snaps: rows.results });
});

app.get("/api/snaps/:id", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const snap = await c.env.DB.prepare(
		`SELECT s.*, u.username, u.display_name, u.skullmoji
     FROM snaps s JOIN users u ON u.id = s.sender_id WHERE s.id = ?`,
	)
		.bind(id)
		.first<{
			id: string;
			sender_id: string;
			media_key: string;
			kind: string;
			duration_sec: number;
			caption: string;
			overlay_json: string;
			created_at: string;
			username: string;
			display_name: string;
			skullmoji: string;
		}>();
	if (!snap) return bad("Gone", 404);
	if (snap.sender_id !== me.id) {
		const rec = await c.env.DB.prepare(
			"SELECT viewed_at, replayed FROM snap_receipts WHERE snap_id = ? AND user_id = ?",
		)
			.bind(id, me.id)
			.first<{ viewed_at: string | null; replayed: number }>();
		if (!rec) return bad("Forbidden", 403);
		if (rec.viewed_at && rec.replayed >= 1) return bad("Already replayed", 410);
	}
	return json({
		...snap,
		overlay: parseJson(snap.overlay_json, null),
		url: `/api/media/${encodeURIComponent(snap.media_key)}`,
	});
});

app.post("/api/snaps/:id/view", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const rec = await c.env.DB.prepare(
		"SELECT viewed_at, replayed FROM snap_receipts WHERE snap_id = ? AND user_id = ?",
	)
		.bind(id, me.id)
		.first<{ viewed_at: string | null; replayed: number }>();
	if (!rec) return bad("Forbidden", 403);
	if (!rec.viewed_at) {
		await c.env.DB.prepare("UPDATE snap_receipts SET viewed_at = ? WHERE snap_id = ? AND user_id = ?")
			.bind(nowIso(), id, me.id)
			.run();
		await bumpScore(c.env, me.id, 1);
	} else {
		await c.env.DB.prepare("UPDATE snap_receipts SET replayed = 1 WHERE snap_id = ? AND user_id = ?")
			.bind(id, me.id)
			.run();
	}
	const snap = await c.env.DB.prepare("SELECT sender_id FROM snaps WHERE id = ?").bind(id).first<{ sender_id: string }>();
	if (snap) await notify(c.env, snap.sender_id, "opened", `${c.get("user").display_name} opened your Pyre`, { snapId: id });
	return json({ ok: true });
});

app.post("/api/snaps/:id/screenshot", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	await c.env.DB.prepare("UPDATE snap_receipts SET screenshot_at = ? WHERE snap_id = ? AND user_id = ?")
		.bind(nowIso(), id, me.id)
		.run();
	const snap = await c.env.DB.prepare("SELECT sender_id FROM snaps WHERE id = ?").bind(id).first<{ sender_id: string }>();
	if (snap) {
		await notify(c.env, snap.sender_id, "screenshot", `${me.display_name} captured your Pyre`, { snapId: id });
	}
	return json({ ok: true });
});

app.post("/api/stories", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{
		mediaKey?: string;
		kind?: string;
		caption?: string;
		overlay?: unknown;
		lat?: number;
		lng?: number;
		saveMemory?: boolean;
	}>();
	if (!body.mediaKey) return bad("mediaKey required");
	const created = nowIso();
	await c.env.DB.prepare(
		`INSERT INTO stories (id, user_id, media_key, kind, caption, overlay_json, lat, lng, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			crypto.randomUUID(),
			me.id,
			body.mediaKey,
			body.kind === "video" ? "video" : "photo",
			body.caption || "",
			JSON.stringify(body.overlay || null),
			body.lat ?? null,
			body.lng ?? null,
			created,
			hoursFromNow(24),
		)
		.run();
	await bumpScore(c.env, me.id, 1);
	if (body.saveMemory) {
		await c.env.DB.prepare(
			"INSERT INTO memories (id, user_id, media_key, kind, caption, created_at, month_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(crypto.randomUUID(), me.id, body.mediaKey, body.kind === "video" ? "video" : "photo", body.caption || "", created, monthKey(created))
			.run();
	}
	return json({ ok: true });
});

app.get("/api/stories", async (c) => {
	const me = c.get("user");
	const mine = await c.env.DB.prepare(
		"SELECT * FROM stories WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at",
	)
		.bind(me.id)
		.all();
	const friends = await c.env.DB.prepare(
		`SELECT s.*, u.username, u.display_name, u.skullmoji
     FROM stories s
     JOIN users u ON u.id = s.user_id
     JOIN friendships f ON f.friend_id = s.user_id AND f.user_id = ? AND f.status = 'accepted'
     WHERE s.expires_at > datetime('now')
     ORDER BY s.created_at DESC`,
	)
		.bind(me.id)
		.all();
	const discover = await c.env.DB.prepare(
		`SELECT s.*, u.username, u.display_name, u.skullmoji
     FROM stories s JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > datetime('now')
       AND (u.story_privacy = 'everyone' OR s.user_id = ?)
     ORDER BY s.created_at DESC LIMIT 80`,
	)
		.bind(me.id)
		.all();
	return json({ mine: mine.results, friends: friends.results, discover: discover.results });
});

app.post("/api/stories/:id/view", async (c) => {
	const me = c.get("user");
	await c.env.DB.prepare(
		"INSERT OR REPLACE INTO story_views (story_id, viewer_id, viewed_at) VALUES (?, ?, ?)",
	)
		.bind(c.req.param("id"), me.id, nowIso())
		.run();
	await bumpScore(c.env, me.id, 1);
	return json({ ok: true });
});

app.get("/api/stories/:id/viewers", async (c) => {
	const me = c.get("user");
	const story = await c.env.DB.prepare("SELECT user_id FROM stories WHERE id = ?")
		.bind(c.req.param("id"))
		.first<{ user_id: string }>();
	if (!story || story.user_id !== me.id) return bad("Forbidden", 403);
	const rows = await c.env.DB.prepare(
		`SELECT u.id, u.username, u.display_name, u.skullmoji, v.viewed_at
     FROM story_views v JOIN users u ON u.id = v.viewer_id WHERE v.story_id = ?`,
	)
		.bind(c.req.param("id"))
		.all();
	return json({ viewers: rows.results });
});

app.get("/api/chats", async (c) => {
	const me = c.get("user");
	const convos = await c.env.DB.prepare(
		`SELECT c.* FROM conversations c
     JOIN conversation_members m ON m.conversation_id = c.id
     WHERE m.user_id = ?`,
	)
		.bind(me.id)
		.all<{ id: string; is_group: number; name: string | null; created_by: string | null; created_at: string }>();
	const chats = [];
	for (const conv of convos.results) {
		const members = await c.env.DB.prepare(
			`SELECT u.id, u.username, u.display_name, u.skullmoji, u.last_active
       FROM conversation_members m JOIN users u ON u.id = m.user_id
       WHERE m.conversation_id = ? AND u.id != ?`,
		)
			.bind(conv.id, me.id)
			.all();
		const last = await c.env.DB.prepare(
			"SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
		)
			.bind(conv.id)
			.first();
		const pending = await c.env.DB.prepare(
			`SELECT COUNT(*) AS n FROM snap_receipts r
       JOIN snaps s ON s.id = r.snap_id
       WHERE r.user_id = ? AND r.viewed_at IS NULL AND s.conversation_id = ? AND s.expires_at > datetime('now')`,
		)
			.bind(me.id, conv.id)
			.first<{ n: number }>();
		let streak = 0;
		let streakExpires: string | null = null;
		if (!conv.is_group && members.results[0]) {
			const [a, b] = pairKey(me.id, members.results[0].id as string);
			const st = await c.env.DB.prepare("SELECT count, expires_at FROM streaks WHERE user_a = ? AND user_b = ?")
				.bind(a, b)
				.first<{ count: number; expires_at: string | null }>();
			streak = st?.count || 0;
			streakExpires = st?.expires_at || null;
		}
		chats.push({
			...conv,
			members: members.results,
			last,
			unopenedSnaps: pending?.n || 0,
			streak,
			streakExpires,
		});
	}
	chats.sort((x, y) => {
		const xt = (x.last as { created_at?: string } | null)?.created_at || x.created_at;
		const yt = (y.last as { created_at?: string } | null)?.created_at || y.created_at;
		return yt.localeCompare(xt);
	});
	return json({ chats });
});

app.post("/api/chats/group", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ name?: string; memberIds?: string[] }>();
	const id = crypto.randomUUID();
	const now = nowIso();
	await c.env.DB.prepare(
		"INSERT INTO conversations (id, is_group, name, created_by, created_at) VALUES (?, 1, ?, ?, ?)",
	)
		.bind(id, body.name || "Group", me.id, now)
		.run();
	const members = new Set([me.id, ...(body.memberIds || [])]);
	for (const uid of members) {
		await c.env.DB.prepare(
			"INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)",
		)
			.bind(id, uid, now)
			.run();
	}
	return json({ id });
});

app.get("/api/chats/:id/messages", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const member = await c.env.DB.prepare(
		"SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
	)
		.bind(id, me.id)
		.first();
	if (!member) return bad("Forbidden", 403);
	const rows = await c.env.DB.prepare(
		`SELECT m.*, u.username, u.display_name, u.skullmoji,
            CASE WHEN ms.user_id IS NULL THEN 0 ELSE 1 END AS saved
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN message_saves ms ON ms.message_id = m.id AND ms.user_id = ?
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC
     LIMIT 400`,
	)
		.bind(me.id, id)
		.all();
	return json({ messages: rows.results });
});

app.post("/api/chats/:id/messages", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const member = await c.env.DB.prepare(
		"SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
	)
		.bind(id, me.id)
		.first();
	if (!member) return bad("Forbidden", 403);
	const body = await c.req.json<{ kind?: string; body?: string; mediaKey?: string; extra?: unknown }>();
	const msgId = crypto.randomUUID();
	await c.env.DB.prepare(
		`INSERT INTO messages (id, conversation_id, sender_id, kind, body, media_key, extra, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			msgId,
			id,
			me.id,
			body.kind || "text",
			body.body || "",
			body.mediaKey || null,
			JSON.stringify(body.extra || null),
			nowIso(),
		)
		.run();
	const payload = JSON.stringify({
		type: "message",
		id: msgId,
		conversationId: id,
		sender_id: me.id,
		kind: body.kind || "text",
		body: body.body || "",
		media_key: body.mediaKey || null,
		created_at: nowIso(),
		saved: 0,
		display_name: me.display_name,
		skullmoji: me.skullmoji,
	});
	const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(id));
	await stub.fetch("https://room/broadcast", { method: "POST", body: payload });
	const peers = await c.env.DB.prepare("SELECT user_id FROM conversation_members WHERE conversation_id = ?")
		.bind(id)
		.all<{ user_id: string }>();
	for (const p of peers.results) {
		if (p.user_id === me.id) continue;
		const hub = c.env.USER_HUB.get(c.env.USER_HUB.idFromName(p.user_id));
		await hub.fetch("https://hub/push", {
			method: "POST",
			body: JSON.stringify({ type: "chat", conversationId: id, from: me.id }),
		});
	}
	return json({ id: msgId });
});

app.post("/api/messages/:id/save", async (c) => {
	const me = c.get("user");
	await c.env.DB.prepare("INSERT OR IGNORE INTO message_saves (message_id, user_id) VALUES (?, ?)")
		.bind(c.req.param("id"), me.id)
		.run();
	return json({ ok: true });
});

app.delete("/api/messages/:id/save", async (c) => {
	const me = c.get("user");
	await c.env.DB.prepare("DELETE FROM message_saves WHERE message_id = ? AND user_id = ?")
		.bind(c.req.param("id"), me.id)
		.run();
	return json({ ok: true });
});

app.get("/api/memories", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		"SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 400",
	)
		.bind(me.id)
		.all();
	return json({ memories: rows.results });
});

app.post("/api/memories", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ mediaKey?: string; kind?: string; caption?: string }>();
	if (!body.mediaKey) return bad("mediaKey required");
	const created = nowIso();
	await c.env.DB.prepare(
		"INSERT INTO memories (id, user_id, media_key, kind, caption, created_at, month_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			crypto.randomUUID(),
			me.id,
			body.mediaKey,
			body.kind === "video" ? "video" : "photo",
			body.caption || "",
			created,
			monthKey(created),
		)
		.run();
	return json({ ok: true });
});

app.delete("/api/memories/:id", async (c) => {
	const me = c.get("user");
	await c.env.DB.prepare("DELETE FROM memories WHERE id = ? AND user_id = ?")
		.bind(c.req.param("id"), me.id)
		.run();
	return json({ ok: true });
});

app.get("/api/spotlight", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT s.*, u.username, u.display_name, u.skullmoji,
            CASE WHEN h.user_id IS NULL THEN 0 ELSE 1 END AS hearted
     FROM spotlight s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN spotlight_hearts h ON h.spotlight_id = s.id AND h.user_id = ?
     ORDER BY s.created_at DESC
     LIMIT 100`,
	)
		.bind(me.id)
		.all();
	return json({ items: rows.results });
});

app.post("/api/spotlight", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ mediaKey?: string; caption?: string }>();
	if (!body.mediaKey) return bad("mediaKey required");
	const id = crypto.randomUUID();
	await c.env.DB.prepare(
		"INSERT INTO spotlight (id, user_id, media_key, caption, created_at, hearts) VALUES (?, ?, ?, ?, ?, 0)",
	)
		.bind(id, me.id, body.mediaKey, body.caption || "", nowIso())
		.run();
	await bumpScore(c.env, me.id, 2);
	return json({ id });
});

app.post("/api/spotlight/:id/heart", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const existing = await c.env.DB.prepare(
		"SELECT 1 FROM spotlight_hearts WHERE spotlight_id = ? AND user_id = ?",
	)
		.bind(id, me.id)
		.first();
	if (existing) {
		await c.env.DB.prepare("DELETE FROM spotlight_hearts WHERE spotlight_id = ? AND user_id = ?")
			.bind(id, me.id)
			.run();
		await c.env.DB.prepare("UPDATE spotlight SET hearts = MAX(hearts - 1, 0) WHERE id = ?").bind(id).run();
		return json({ hearted: false });
	}
	await c.env.DB.prepare("INSERT INTO spotlight_hearts (spotlight_id, user_id) VALUES (?, ?)")
		.bind(id, me.id)
		.run();
	await c.env.DB.prepare("UPDATE spotlight SET hearts = hearts + 1 WHERE id = ?").bind(id).run();
	return json({ hearted: true });
});

app.post("/api/map", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ lat?: number; lng?: number; activity?: string }>();
	if (typeof body.lat !== "number" || typeof body.lng !== "number") return bad("lat/lng required");
	await c.env.DB.prepare(
		`INSERT INTO locations (user_id, lat, lng, updated_at, activity) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, updated_at=excluded.updated_at, activity=excluded.activity`,
	)
		.bind(me.id, body.lat, body.lng, nowIso(), body.activity || "default")
		.run();
	return json({ ok: true });
});

app.get("/api/map", async (c) => {
	const me = c.get("user");
	const friends = await c.env.DB.prepare(
		`SELECT u.id, u.username, u.display_name, u.skullmoji, u.map_mode, u.map_selected, l.lat, l.lng, l.updated_at, l.activity
     FROM friendships f
     JOIN users u ON u.id = f.friend_id
     JOIN locations l ON l.user_id = u.id
     WHERE f.user_id = ? AND f.status = 'accepted'
       AND l.updated_at > datetime('now', '-8 hours')`,
	)
		.bind(me.id)
		.all<{
			id: string;
			username: string;
			display_name: string;
			skullmoji: string;
			map_mode: string;
			map_selected: string;
			lat: number;
			lng: number;
			updated_at: string;
			activity: string;
		}>();
	const visible = friends.results.filter((f) => {
		if (f.map_mode === "skull") return false;
		if (f.map_mode === "selected") {
			const sel = parseJson<string[]>(f.map_selected, []);
			return sel.includes(me.id);
		}
		return true;
	});
	const myLoc = me.map_mode === "skull"
		? null
		: await c.env.DB.prepare("SELECT * FROM locations WHERE user_id = ?").bind(me.id).first();
	const hotspots = await c.env.DB.prepare(
		`SELECT lat, lng, COUNT(*) AS n FROM stories
     WHERE expires_at > datetime('now') AND lat IS NOT NULL
     GROUP BY ROUND(lat, 2), ROUND(lng, 2)`,
	).all();
	return json({ me: myLoc, friends: visible, hotspots: hotspots.results, mapMode: me.map_mode });
});

app.get("/api/notifications", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		"SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 80",
	)
		.bind(me.id)
		.all();
	return json({ notifications: rows.results });
});

app.post("/api/notifications/read", async (c) => {
	const me = c.get("user");
	await c.env.DB.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").bind(me.id).run();
	return json({ ok: true });
});

app.get("/api/ws/chat/:id", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const member = await c.env.DB.prepare(
		"SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
	)
		.bind(id, me.id)
		.first();
	if (!member) return bad("Forbidden", 403);
	const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(id));
	const url = new URL(c.req.url);
	url.searchParams.set("user", me.id);
	return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.get("/api/ws/hub", async (c) => {
	const me = c.get("user");
	const stub = c.env.USER_HUB.get(c.env.USER_HUB.idFromName(me.id));
	return stub.fetch(c.req.raw);
});

app.post("/api/calls/signal", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ to?: string; signal?: unknown }>();
	if (!body.to) return bad("to required");
	const stub = c.env.USER_HUB.get(c.env.USER_HUB.idFromName(body.to));
	await stub.fetch("https://hub/push", {
		method: "POST",
		body: JSON.stringify({ type: "call", from: me.id, fromName: me.display_name, signal: body.signal }),
	});
	return json({ ok: true });
});

app.post("/api/legal-notice", async (c) => {
	const body = await c.req.json<{ contact?: string; targetUrl?: string; detail?: string }>();
	const contact = (body.contact || "").trim().slice(0, 200);
	const targetUrl = (body.targetUrl || "").trim().slice(0, 500);
	const detail = (body.detail || "").trim().slice(0, 4000);
	if (!contact || !targetUrl || detail.length < 20) {
		return bad("Need contact, URL, and a specific description of the illegal material");
	}
	await c.env.DB.prepare(
		"INSERT INTO legal_notices (id, reporter_id, contact, target_url, detail, created_at, handled) VALUES (?, ?, ?, ?, ?, ?, 0)",
	)
		.bind(crypto.randomUUID(), null, contact, targetUrl, detail, nowIso())
		.run();
	return json({ ok: true });
});

app.post("/api/admin/legal/takedown", async (c) => {
	const expected = c.env.ADMIN_PASSWORD;
	const body = await c.req.json<{ password?: string; mediaKey?: string; noticeId?: string }>();
	if (!expected || body.password !== expected) return bad("Forbidden", 403);
	if (body.mediaKey) {
		await c.env.MEDIA.delete(body.mediaKey).catch(() => undefined);
		await c.env.DB.prepare("DELETE FROM snaps WHERE media_key = ?").bind(body.mediaKey).run();
		await c.env.DB.prepare("DELETE FROM stories WHERE media_key = ?").bind(body.mediaKey).run();
		await c.env.DB.prepare("DELETE FROM spotlight WHERE media_key = ?").bind(body.mediaKey).run();
		await c.env.DB.prepare("DELETE FROM memories WHERE media_key = ?").bind(body.mediaKey).run();
		await c.env.DB.prepare("DELETE FROM messages WHERE media_key = ?").bind(body.mediaKey).run();
	}
	if (body.noticeId) {
		await c.env.DB.prepare("UPDATE legal_notices SET handled = 1 WHERE id = ?").bind(body.noticeId).run();
	}
	return json({ ok: true });
});

app.get("/api/health", (_c) =>
	json({
		ok: true,
		name: "PyreChat",
		ai: false,
		ranking: false,
		moderation: "illegal_only",
	}),
);

export default app;
