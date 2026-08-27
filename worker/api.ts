import { FOUNDER_DISPLAY, FOUNDER_USERNAME, founderBlocked, isFounderUsername } from "./lib/founder.js";
import { bumpMetric, track, trackRequest } from "./lib/metrics.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	ageYears,
	areFriends,
	canContact,
	canReadMedia,
	canViewStory,
	corsOrigin,
	extForType,
	isBlocked,
	isOwnedMediaKey,
	likeContains,
	MAP_MODES,
	normalizeMediaType,
	originAllowed,
	STORY_PRIVACY,
	WHO_CAN_CONTACT,
} from "./lib/access.js";
import {
	clearSessionCookies,
	createSession,
	generateRecoveryKey,
	hashPassword,
	hashRecoveryKey,
	meUser,
	publicUser,
	recoveryKeyMatches,
	requireUser,
	secretEqual,
	sessionCookie,
	verifyPassword,
	type AuthedUser,
} from "./lib/auth.js";
import { rateLimited } from "./lib/limit.js";
import { isBetaOpen, isEarlyCohort } from "./lib/env.js";
import {
	androidRelease,
	applyTicketResult,
	attachmentsFor,
	bearerToken,
	claimTicketAttachments,
	dispatchTicketWebhook,
	latestAppNotice,
	MAX_FILE_BYTES,
	publicTicket,
	sanitizeTicketFilename,
	serveTicketAttachment,
	sniffTicketType,
	TICKET_MAX_FILES,
	ticketFileExt,
	verifyTicketBotBearer,
	verifyTicketCallbackToken,
	type AttachmentRow,
	type TicketKind,
	type TicketRow,
} from "./lib/tickets.js";
import { normalizeWaitlistEmail, waitlistSource } from "./lib/waitlist.js";
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
	withCookies,
} from "./lib/util.js";

type Vars = { user: AuthedUser };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use(
	"/api/*",
	cors({
		origin: (origin) => corsOrigin(origin) ?? "",
		credentials: true,
		allowHeaders: ["Content-Type", "Authorization", "X-Filename"],
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	}),
);

app.use("/api/*", async (c, next) => {
	const method = c.req.method;
	const internal = c.req.path.startsWith("/api/internal/");
	if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !internal && !originAllowed(c.req.raw)) {
		return bad("Forbidden", 403);
	}
	await next();
	trackRequest(c.env, c.req.raw, c.res.status);
});

app.onError((err, c) => {
	const msg = err instanceof Error ? err.message : String(err);
	console.error(c.req.method, c.req.path, msg);
	return json({ error: "Server error" }, 500);
});

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;
const MIN_PASSWORD = 8;

function normUsername(raw: string): string {
	return raw.trim();
}

app.post("/api/auth/signup", async (c) => {
	if (await rateLimited(c.req.raw, "signup", 5, 3600)) return bad("Too many attempts", 429);
	let body: { username?: string; password?: string; displayName?: string; birthday?: string };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const username = normUsername(body.username || "");
	const password = body.password || "";
	const displayName = (body.displayName || username).trim().slice(0, 32);
	const birthday = (body.birthday || "").trim();
	const age = ageYears(birthday);
	if (!USERNAME_RE.test(username)) return bad("Username must be 3–24 letters, numbers, dots, or underscores");
	const reserved = founderBlocked(displayName, username, "");
	if (reserved) return bad(reserved, 403);
	if (password.length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
	if (password.length > 200) return bad("Password is too long");
	if (age === null) return bad("Enter a valid birthday");
	if (age < 13) return bad("You must be at least 13");
	const exists = await c.env.DB.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").bind(username).first();
	if (exists) return bad("Username taken", 409);
	const id = crypto.randomUUID();
	const skullmoji = JSON.stringify({
		color: "#fc7a1a",
		eyes: "hollow",
		jaw: "grin",
		hat: "none",
		bg: "#1f1612",
	});
	const kindling = isEarlyCohort(c.env) && !isFounderUsername(username) ? 1 : 0;
	const recoveryKey = generateRecoveryKey();
	try {
		await c.env.DB.prepare(
			`INSERT INTO users (id, username, display_name, password_hash, birthday, skullmoji, created_at, last_active, kindling, recovery_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				id,
				username,
				displayName,
				await hashPassword(password),
				birthday,
				skullmoji,
				nowIso(),
				nowIso(),
				kindling,
				await hashRecoveryKey(recoveryKey),
			)
			.run();
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/UNIQUE/i.test(msg)) return bad("Username taken", 409);
		return bad("Could not create account", 500);
	}
	const token = await createSession(c.env, id, c.req.raw);
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<AuthedUser>();
	if (!user) return bad("Could not create account", 500);
	c.executionCtx.waitUntil(bumpMetric(c.env, "signup"));
	track(c.env, "signup");
	return withCookies(json({ user: meUser(user, c.env), recoveryKey, token }), sessionCookie(token, c.req.raw));
});

app.post("/api/auth/login", async (c) => {
	if (await rateLimited(c.req.raw, "login", 20, 900, "check")) return bad("Too many attempts", 429);
	let body: { username?: string; password?: string };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const username = normUsername(body.username || "");
	const founder = isFounderUsername(username);
	if (founder && (await rateLimited(c.req.raw, "founder-login", 8, 1800, "check"))) {
		return bad("Too many attempts", 429);
	}
	const password = body.password || "";
	if (!username || !password) return bad("Enter username and password");
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
		.bind(username)
		.first<AuthedUser & { password_hash: string }>();
	if (!user || !(await verifyPassword(password, user.password_hash))) {
		await rateLimited(c.req.raw, "login", 20, 900, "hit");
		if (founder) await rateLimited(c.req.raw, "founder-login", 8, 1800, "hit");
		return bad("Invalid username or password", 401);
	}
	if (!user.password_hash.startsWith("pbkdf2$100000$")) {
		try {
			await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
				.bind(await hashPassword(password), user.id)
				.run();
		} catch {
			/* login still succeeds */
		}
	}
	const token = await createSession(c.env, user.id, c.req.raw);
	c.executionCtx.waitUntil(bumpMetric(c.env, "login"));
	track(c.env, "login");
	let recoveryKey: string | undefined;
	if (!user.recovery_hash) {
		try {
			recoveryKey = generateRecoveryKey();
			await c.env.DB.prepare("UPDATE users SET recovery_hash = ? WHERE id = ?")
				.bind(await hashRecoveryKey(recoveryKey), user.id)
				.run();
			user.recovery_hash = "1";
		} catch (err) {
			console.error("recovery key issue failed", err);
			recoveryKey = undefined;
		}
	}
	return withCookies(json({ user: meUser(user, c.env), recoveryKey, token }), sessionCookie(token, c.req.raw));
});

app.post("/api/auth/logout", async (c) => {
	const auth = await requireUser(c.req.raw, c.env);
	if (!(auth instanceof Response)) {
		await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(auth.token).run();
	}
	return withCookies(json({ ok: true }), ...clearSessionCookies());
});

app.post("/api/auth/recover", async (c) => {
	if (await rateLimited(c.req.raw, "recover", 8, 3600, "check")) return bad("Too many attempts", 429);
	let body: { username?: string; seed?: string; password?: string };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const seed = (body.seed || "").trim();
	const password = body.password || "";
	let username = normUsername(body.username || "");
	if (!username && seed) {
		const founderHash = c.env.FOUNDER_RECOVERY_HASH?.trim() || "";
		if (founderHash && (await recoveryKeyMatches(seed, founderHash))) username = FOUNDER_USERNAME;
	}
	if (!seed || !username) return bad("Enter your username and recovery key");
	if (password.length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
	if (password.length > 200) return bad("Password is too long");
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
		.bind(username)
		.first<AuthedUser & { password_hash: string; recovery_hash?: string | null }>();
	let ok = false;
	if (user?.recovery_hash) {
		ok = await recoveryKeyMatches(seed, user.recovery_hash);
	}
	if (!ok && user && isFounderUsername(user.username)) {
		const founderHash = c.env.FOUNDER_RECOVERY_HASH?.trim() || "";
		if (founderHash) ok = await recoveryKeyMatches(seed, founderHash);
	}
	if (!user || !ok) {
		await rateLimited(c.req.raw, "recover", 8, 3600, "hit");
		return bad("Could not recover that account", 403);
	}
	await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
		.bind(await hashPassword(password), user.id)
		.run();
	await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
	const token = await createSession(c.env, user.id, c.req.raw);
	const fresh = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<AuthedUser>();
	return withCookies(json({ user: meUser(fresh!, c.env), token }), sessionCookie(token, c.req.raw));
});

app.use("/api/*", async (c, next) => {
	if (c.req.path.startsWith("/api/auth/")) return next();
	if (c.req.path === "/api/legal-notice") return next();
	if (c.req.path === "/api/admin/legal/takedown") return next();
	if (c.req.path === "/api/health") return next();
	if (c.req.path === "/api/download/android") return next();
	if (c.req.path === "/api/app") return next();
	if (c.req.path === "/api/waitlist" && c.req.method === "POST") return next();
	if (c.req.path.startsWith("/api/internal/")) return next();
	if (c.req.method === "OPTIONS") return next();
	const auth = await requireUser(c.req.raw, c.env);
	if (auth instanceof Response) return auth;
	c.set("user", auth.user);
	return next();
});

app.get("/api/me", (c) => {
	const row = c.get("user");
	if (!row) return bad("Unauthorized", 401);
	return json({ user: meUser(row, c.env) });
});

app.post("/api/metrics", async (c) => {
	if (await rateLimited(c.req.raw, "metrics", 120, 60)) return bad("Too many attempts", 429);
	let body: { event?: string };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const event = (body.event || "").trim();
	if (!event.startsWith("view_")) return bad("Unknown event");
	track(c.env, event);
	c.executionCtx.waitUntil(bumpMetric(c.env, event));
	return json({ ok: true });
});

app.get("/api/admin/metrics", async (c) => {
	if (!isFounderUsername(c.get("user").username)) return bad("Forbidden", 403);
	const rows = await c.env.DB.prepare(
		"SELECT day, event, n FROM metric_daily WHERE day >= date('now', '-14 days') ORDER BY day DESC, n DESC",
	).all();
	return json({ days: rows.results });
});

app.patch("/api/me", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<Record<string, unknown>>();
	const displayRaw = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 32) : me.display_name;
	const stolen = founderBlocked(displayRaw, me.username, me.username);
	if (stolen) return bad(stolen, 403);
	const display = isFounderUsername(me.username) ? FOUNDER_DISPLAY : displayRaw;
	const bio = typeof body.bio === "string" ? body.bio.slice(0, 140) : me.bio;
	const storyPrivacy =
		typeof body.storyPrivacy === "string" && STORY_PRIVACY.has(body.storyPrivacy) ? body.storyPrivacy : me.story_privacy;
	const whoCanContact =
		typeof body.whoCanContact === "string" && WHO_CAN_CONTACT.has(body.whoCanContact)
			? body.whoCanContact
			: me.who_can_contact;
	const mapMode = typeof body.mapMode === "string" && MAP_MODES.has(body.mapMode) ? body.mapMode : me.map_mode;
	const mapSelected = Array.isArray(body.mapSelected)
		? JSON.stringify(body.mapSelected.filter((id) => typeof id === "string").slice(0, 200))
		: me.map_selected;
	const skullmoji = body.skullmoji ? JSON.stringify(body.skullmoji) : me.skullmoji;
	let birthday = me.birthday;
	if (typeof body.birthday === "string") {
		const age = ageYears(body.birthday);
		if (age === null) return bad("Enter a valid birthday");
		if (age < 13) return bad("You must be at least 13");
		birthday = body.birthday.trim();
	}
	const phone = typeof body.phone === "string" ? body.phone.slice(0, 32) : me.phone;
	const email = typeof body.email === "string" ? body.email.slice(0, 120) : me.email;
	await c.env.DB.prepare(
		`UPDATE users SET display_name=?, bio=?, story_privacy=?, who_can_contact=?, map_mode=?, map_selected=?, skullmoji=?, birthday=?, phone=?, email=? WHERE id=?`,
	)
		.bind(display, bio, storyPrivacy, whoCanContact, mapMode, mapSelected, skullmoji, birthday, phone, email, me.id)
		.run();
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<AuthedUser>();
	return json({ user: meUser(user!, c.env) });
});

app.post("/api/me/recovery-key", async (c) => {
	const me = c.get("user");
	let body: { password?: string } = {};
	try {
		body = await c.req.json();
	} catch {
		/* first-time issue needs no body */
	}
	const row = await c.env.DB.prepare("SELECT password_hash, recovery_hash FROM users WHERE id = ?")
		.bind(me.id)
		.first<{ password_hash: string; recovery_hash: string | null }>();
	if (!row) return bad("Not found", 404);
	if (row.recovery_hash) {
		const password = body.password || "";
		if (!password || !(await verifyPassword(password, row.password_hash))) return bad("Enter your current password", 403);
	}
	const recoveryKey = generateRecoveryKey();
	await c.env.DB.prepare("UPDATE users SET recovery_hash = ? WHERE id = ?")
		.bind(await hashRecoveryKey(recoveryKey), me.id)
		.run();
	return json({ recoveryKey });
});

app.get("/api/users/search", async (c) => {
	const q = (c.req.query("q") || "").trim().slice(0, 32);
	if (q.length < 1) return json({ users: [] });
	const me = c.get("user");
	const like = likeContains(q);
	const rows = await c.env.DB.prepare(
		`SELECT id, username, display_name, skullmoji, snap_score, kindling FROM users
     WHERE id != ? AND (username LIKE ? ESCAPE '!' OR display_name LIKE ? ESCAPE '!') LIMIT 30`,
	)
		.bind(me.id, like, like)
		.all();
	return json({ users: rows.results });
});

app.get("/api/users/:id", async (c) => {
	const row = await c.env.DB.prepare(
		"SELECT id, username, display_name, bio, skullmoji, snap_score, created_at, last_active, kindling FROM users WHERE id = ?",
	)
		.bind(c.req.param("id"))
		.first();
	if (!row) return bad("Not found", 404);
	return json({ user: row });
});

app.get("/api/friends", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT u.id, u.username, u.display_name, u.skullmoji, u.snap_score, u.last_active, u.kindling, f.status,
            s.count AS streak, s.expires_at AS streak_expires, s.record AS streak_record
     FROM friendships f
     JOIN users u ON u.id = f.friend_id
     LEFT JOIN streaks s ON s.user_a = CASE WHEN f.user_id < f.friend_id THEN f.user_id ELSE f.friend_id END
                        AND s.user_b = CASE WHEN f.user_id < f.friend_id THEN f.friend_id ELSE f.user_id END
     WHERE f.user_id = ? AND f.status = 'accepted'
     ORDER BY u.display_name`,
	)
		.bind(me.id)
		.all();
	return json({ friends: rows.results });
});

const PERSON_COLS = "u.id, u.username, u.display_name, u.skullmoji, u.kindling";

async function clearDismissal(env: Env, me: string, other: string): Promise<void> {
	await env.DB.prepare("DELETE FROM friend_dismissals WHERE user_id = ? AND other_id = ?").bind(me, other).run();
}

async function listIncoming(env: Env, me: string) {
	return env.DB.prepare(
		`SELECT ${PERSON_COLS} FROM friendships f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = ? AND f.status = 'pending'
       AND u.id NOT IN (SELECT other_id FROM friend_dismissals WHERE user_id = ? AND kind = 'deleted')
     ORDER BY f.created_at DESC`,
	)
		.bind(me, me)
		.all();
}

async function listSent(env: Env, me: string) {
	return env.DB.prepare(
		`SELECT ${PERSON_COLS} FROM friendships f
     JOIN users u ON u.id = f.friend_id
     WHERE f.user_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
	)
		.bind(me)
		.all();
}

async function listDismissed(env: Env, me: string, kind: "hidden" | "deleted") {
	return env.DB.prepare(
		`SELECT ${PERSON_COLS} FROM friend_dismissals d
     JOIN users u ON u.id = d.other_id
     WHERE d.user_id = ? AND d.kind = ?
     ORDER BY d.created_at DESC`,
	)
		.bind(me, kind)
		.all();
}

async function listQuickAdd(env: Env, me: string) {
	return env.DB.prepare(
		`SELECT ${PERSON_COLS}
     FROM users u
     WHERE u.id != ?
       AND u.who_can_contact = 'everyone'
       AND u.id NOT IN (SELECT friend_id FROM friendships WHERE user_id = ?)
       AND u.id NOT IN (SELECT user_id FROM friendships WHERE friend_id = ? AND status = 'pending')
       AND u.id NOT IN (SELECT other_id FROM friend_dismissals WHERE user_id = ?)
       AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE user_id = ?)
       AND u.id NOT IN (SELECT user_id FROM blocks WHERE blocked_id = ?)
     ORDER BY u.snap_score DESC, u.username
     LIMIT 20`,
	)
		.bind(me, me, me, me, me, me)
		.all();
}

app.get("/api/friends/pending", async (c) => {
	const incoming = await listIncoming(c.env, c.get("user").id);
	return json({ incoming: incoming.results });
});

app.get("/api/friends/quick-add", async (c) => {
	const rows = await listQuickAdd(c.env, c.get("user").id);
	return json({ suggestions: rows.results });
});

app.get("/api/friends/adds", async (c) => {
	const me = c.get("user").id;
	const [incoming, sent, hidden, deleted, suggestions] = await Promise.all([
		listIncoming(c.env, me),
		listSent(c.env, me),
		listDismissed(c.env, me, "hidden"),
		listDismissed(c.env, me, "deleted"),
		listQuickAdd(c.env, me),
	]);
	return json({
		incoming: incoming.results,
		sent: sent.results,
		hidden: hidden.results,
		deleted: deleted.results,
		suggestions: suggestions.results,
	});
});

app.post("/api/friends/dismiss", async (c) => {
	const me = c.get("user");
	let body: { userId?: string; kind?: string };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const other = (body.userId || "").trim();
	const kind = body.kind === "deleted" ? "deleted" : body.kind === "hidden" ? "hidden" : "";
	if (!other || !kind) return bad("userId and kind required");
	if (other === me.id) return bad("Cannot dismiss yourself");
	const exists = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(other).first();
	if (!exists) return bad("User not found", 404);
	await c.env.DB.prepare(
		"INSERT OR REPLACE INTO friend_dismissals (user_id, other_id, kind, created_at) VALUES (?, ?, ?, ?)",
	)
		.bind(me.id, other, kind, nowIso())
		.run();
	return json({ ok: true, kind });
});

app.post("/api/friends/restore", async (c) => {
	const me = c.get("user");
	let body: { userId?: string };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	if (!body.userId) return bad("userId required");
	await clearDismissal(c.env, me.id, body.userId);
	return json({ ok: true });
});

app.post("/api/friends/add", async (c) => {
	const me = c.get("user");
	const body = await c.req.json<{ username?: string; userId?: string }>();
	let target = body.userId
		? await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(body.userId).first<AuthedUser>()
		: await c.env.DB.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
				.bind((body.username || "").trim())
				.first<AuthedUser>();
	if (!target || target.id === me.id) return bad("User not found", 404);
	await clearDismissal(c.env, me.id, target.id);
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
		`SELECT id, username, display_name, bio, skullmoji, snap_score, birthday, created_at, kindling,
            (SELECT media_key FROM stories WHERE user_id = users.id AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1) AS story_key,
            (SELECT kind FROM stories WHERE user_id = users.id AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1) AS story_kind
     FROM users WHERE id = ?`,
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
	const ct = normalizeMediaType(c.req.header("content-type"));
	if (!ct) return bad("Unsupported media type", 415);
	const len = Number(c.req.header("content-length") || "0");
	if (!len || len > 40 * 1024 * 1024) return bad("File too large", 413);
	const body = c.req.raw.body;
	if (!body) return bad("Empty file");
	const key = `u/${me.id}/${crypto.randomUUID()}.${extForType(ct)}`;
	await c.env.MEDIA.put(key, body, { httpMetadata: { contentType: ct } });
	c.executionCtx.waitUntil(bumpMetric(c.env, "media"));
	return json({ key, url: `/api/media/${encodeURIComponent(key)}` });
});

app.get("/api/media/*", async (c) => {
	const key = decodeURIComponent(c.req.path.replace(/^\/api\/media\//, ""));
	const me = c.get("user");
	if (!(await canReadMedia(c.env, me.id, key))) return bad("Forbidden", 403);
	const obj = await c.env.MEDIA.get(key);
	if (!obj) return bad("Not found", 404);
	const headers = new Headers();
	headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
	headers.set("Cache-Control", "private, max-age=3600");
	headers.set("X-Content-Type-Options", "nosniff");
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
	if (!isOwnedMediaKey(body.mediaKey, me.id)) return bad("Invalid media", 403);
	const recipients = new Set<string>();
	let conversationId = body.conversationId || null;
	if (conversationId) {
		const member = await c.env.DB.prepare(
			"SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
		)
			.bind(conversationId, me.id)
			.first();
		if (!member) return bad("Forbidden", 403);
		const conv = await c.env.DB.prepare("SELECT is_group FROM conversations WHERE id = ?")
			.bind(conversationId)
			.first<{ is_group: number }>();
		const peers = await c.env.DB.prepare(
			"SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?",
		)
			.bind(conversationId, me.id)
			.all<{ user_id: string }>();
		for (const p of peers.results) {
			if (await isBlocked(c.env, me.id, p.user_id)) continue;
			if (!conv?.is_group) {
				const denied = await canContact(c.env, me.id, p.user_id);
				if (denied) return denied;
			}
			recipients.add(p.user_id);
		}
	} else {
		for (const rid of body.recipientIds || []) {
			if (!rid || rid === me.id) continue;
			const denied = await canContact(c.env, me.id, rid);
			if (denied) return denied;
			recipients.add(rid);
		}
	}
	if (!conversationId && recipients.size === 1) {
		conversationId = dmId(me.id, [...recipients][0]);
	}
	if (recipients.size === 0) return bad("No recipients");
	const id = crypto.randomUUID();
	const created = nowIso();
	const expires = hoursFromNow(24);
	const overlay = JSON.stringify(body.overlay || null);
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
	c.executionCtx.waitUntil(bumpMetric(c.env, "snap"));
	return json({ id });
});

app.get("/api/inbox", async (c) => {
	const me = c.get("user");
	const rows = await c.env.DB.prepare(
		`SELECT r.snap_id, r.viewed_at, r.replayed, r.screenshot_at,
            s.sender_id, s.kind, s.duration_sec, s.caption, s.created_at, s.conversation_id,
            u.username, u.display_name, u.skullmoji, u.kindling
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
		`SELECT s.*, u.username, u.display_name, u.skullmoji, u.kindling
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
	const rec = await c.env.DB.prepare("SELECT 1 FROM snap_receipts WHERE snap_id = ? AND user_id = ?")
		.bind(id, me.id)
		.first();
	if (!rec) return bad("Forbidden", 403);
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
	if (!isOwnedMediaKey(body.mediaKey, me.id)) return bad("Invalid media", 403);
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
	c.executionCtx.waitUntil(bumpMetric(c.env, "story"));
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
		`SELECT s.*, u.username, u.display_name, u.skullmoji, u.kindling
     FROM stories s
     JOIN users u ON u.id = s.user_id
     JOIN friendships f ON f.friend_id = s.user_id AND f.user_id = ? AND f.status = 'accepted'
     WHERE s.expires_at > datetime('now')
       AND u.story_privacy IN ('friends', 'everyone')
       AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE user_id = ?)
       AND u.id NOT IN (SELECT user_id FROM blocks WHERE blocked_id = ?)
     ORDER BY s.created_at DESC`,
	)
		.bind(me.id, me.id, me.id)
		.all();
	const discover = await c.env.DB.prepare(
		`SELECT s.*, u.username, u.display_name, u.skullmoji, u.kindling
     FROM stories s JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > datetime('now')
       AND u.story_privacy = 'everyone'
       AND s.user_id != ?
       AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE user_id = ?)
       AND u.id NOT IN (SELECT user_id FROM blocks WHERE blocked_id = ?)
     ORDER BY s.created_at DESC LIMIT 80`,
	)
		.bind(me.id, me.id, me.id)
		.all();
	return json({ mine: mine.results, friends: friends.results, discover: discover.results });
});

app.post("/api/stories/:id/view", async (c) => {
	const me = c.get("user");
	const story = await c.env.DB.prepare(
		`SELECT s.user_id, u.story_privacy FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
	)
		.bind(c.req.param("id"))
		.first<{ user_id: string; story_privacy: string }>();
	if (!story || !(await canViewStory(c.env, me.id, story))) return bad("Forbidden", 403);
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
		`SELECT u.id, u.username, u.display_name, u.skullmoji, u.kindling, v.viewed_at
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
	const storyRows = await c.env.DB.prepare(
		"SELECT user_id, media_key, kind FROM stories WHERE expires_at > datetime('now') ORDER BY created_at DESC",
	).all<{ user_id: string; media_key: string; kind: string }>();
	const latestStory = new Map<string, { media_key: string; kind: string }>();
	for (const s of storyRows.results) {
		if (!latestStory.has(s.user_id)) latestStory.set(s.user_id, s);
	}
	const chats = [];
	for (const conv of convos.results) {
		const members = await c.env.DB.prepare(
			`SELECT u.id, u.username, u.display_name, u.skullmoji, u.last_active, u.kindling
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
			members: members.results.map((m) => {
				const story = latestStory.get(m.id as string);
				return { ...m, story_key: story?.media_key || null, story_kind: story?.kind || null };
			}),
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
	const members = new Set<string>([me.id]);
	for (const uid of body.memberIds || []) {
		if (!uid || uid === me.id) continue;
		const exists = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(uid).first();
		if (!exists) return bad("User not found", 404);
		const denied = await canContact(c.env, me.id, uid);
		if (denied) return denied;
		members.add(uid);
	}
	if (members.size < 2) return bad("Need at least one friend");
	await c.env.DB.prepare(
		"INSERT INTO conversations (id, is_group, name, created_by, created_at) VALUES (?, 1, ?, ?, ?)",
	)
		.bind(id, (body.name || "Group").slice(0, 40), me.id, now)
		.run();
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
		`SELECT m.*, u.username, u.display_name, u.skullmoji, u.kindling,
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
	const conv = await c.env.DB.prepare("SELECT is_group FROM conversations WHERE id = ?")
		.bind(id)
		.first<{ is_group: number }>();
	const body = await c.req.json<{ kind?: string; body?: string; mediaKey?: string; extra?: unknown }>();
	if (body.mediaKey && !isOwnedMediaKey(body.mediaKey, me.id)) return bad("Invalid media", 403);
	const peers = await c.env.DB.prepare("SELECT user_id FROM conversation_members WHERE conversation_id = ?")
		.bind(id)
		.all<{ user_id: string }>();
	if (!conv?.is_group) {
		const other = peers.results.find((p) => p.user_id !== me.id);
		if (other) {
			const denied = await canContact(c.env, me.id, other.user_id);
			if (denied) return denied;
		}
	}
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
		username: me.username,
		kindling: Number(me.kindling) === 1,
		kind: body.kind || "text",
		body: body.body || "",
		media_key: body.mediaKey || null,
		extra: body.extra || null,
		created_at: nowIso(),
		saved: 0,
		display_name: me.display_name,
		skullmoji: me.skullmoji,
	});
	const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(id));
	await stub.fetch("https://room/broadcast", { method: "POST", body: payload });
	for (const p of peers.results) {
		if (p.user_id === me.id) continue;
		if (await isBlocked(c.env, me.id, p.user_id)) continue;
		const hub = c.env.USER_HUB.get(c.env.USER_HUB.idFromName(p.user_id));
		await hub.fetch("https://hub/push", {
			method: "POST",
			body: JSON.stringify({ type: "chat", conversationId: id, from: me.id }),
		});
	}
	return json({ id: msgId });
});

app.patch("/api/messages/:id", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const row = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(id).first<{
		id: string;
		conversation_id: string;
		sender_id: string;
		kind: string;
		body: string;
		extra: string | null;
	}>();
	if (!row) return bad("Not found", 404);
	if (row.sender_id !== me.id) return bad("Forbidden", 403);
	const member = await c.env.DB.prepare(
		"SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
	)
		.bind(row.conversation_id, me.id)
		.first();
	if (!member) return bad("Forbidden", 403);
	if (row.kind !== "text") return bad("Only chats can be edited");
	const body = await c.req.json<{ body?: string }>();
	const next = (body.body || "").trim().slice(0, 4000);
	if (next.length < 1) return bad("Empty");
	const extra = { ...parseJson<Record<string, unknown>>(row.extra, {}), editedAt: nowIso() };
	await c.env.DB.prepare("UPDATE messages SET body = ?, extra = ? WHERE id = ?")
		.bind(next, JSON.stringify(extra), id)
		.run();
	const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(row.conversation_id));
	await stub.fetch("https://room/broadcast", {
		method: "POST",
		body: JSON.stringify({ type: "message_edit", id, body: next, extra }),
	});
	return json({ ok: true, extra });
});

app.delete("/api/messages/:id", async (c) => {
	const me = c.get("user");
	const id = c.req.param("id");
	const row = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(id).first<{
		id: string;
		conversation_id: string;
		sender_id: string;
		extra: string | null;
	}>();
	if (!row) return bad("Not found", 404);
	if (row.sender_id !== me.id) return bad("Forbidden", 403);
	const extra = { ...parseJson<Record<string, unknown>>(row.extra, {}), deleted: true };
	await c.env.DB.prepare("UPDATE messages SET body = '', media_key = NULL, extra = ? WHERE id = ?")
		.bind(JSON.stringify(extra), id)
		.run();
	const stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(row.conversation_id));
	await stub.fetch("https://room/broadcast", {
		method: "POST",
		body: JSON.stringify({ type: "message_delete", id }),
	});
	return json({ ok: true });
});

app.post("/api/messages/:id/save", async (c) => {
	const me = c.get("user");
	const member = await c.env.DB.prepare(
		`SELECT 1 FROM messages m
     JOIN conversation_members c ON c.conversation_id = m.conversation_id AND c.user_id = ?
     WHERE m.id = ?`,
	)
		.bind(me.id, c.req.param("id"))
		.first();
	if (!member) return bad("Forbidden", 403);
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
	if (!isOwnedMediaKey(body.mediaKey, me.id)) return bad("Invalid media", 403);
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
		`SELECT s.*, u.username, u.display_name, u.skullmoji, u.kindling,
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
	if (!isOwnedMediaKey(body.mediaKey, me.id)) return bad("Invalid media", 403);
	const id = crypto.randomUUID();
	await c.env.DB.prepare(
		"INSERT INTO spotlight (id, user_id, media_key, caption, created_at, hearts) VALUES (?, ?, ?, ?, ?, 0)",
	)
		.bind(id, me.id, body.mediaKey, body.caption || "", nowIso())
		.run();
	await bumpScore(c.env, me.id, 2);
	c.executionCtx.waitUntil(bumpMetric(c.env, "spotlight"));
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
		`SELECT u.id, u.username, u.display_name, u.skullmoji, u.kindling, u.map_mode, u.map_selected, l.lat, l.lng, l.updated_at, l.activity
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
	const denied = await canContact(c.env, me.id, body.to);
	if (denied) return denied;
	const stub = c.env.USER_HUB.get(c.env.USER_HUB.idFromName(body.to));
	await stub.fetch("https://hub/push", {
		method: "POST",
		body: JSON.stringify({ type: "call", from: me.id, fromName: me.display_name, signal: body.signal }),
	});
	return json({ ok: true });
});

app.get("/api/tickets", async (c) => {
	if (!isBetaOpen(c.env)) return bad("Beta tickets are closed", 404);
	const me = c.get("user");
	const founder = isFounderUsername(me.username);
	const rows = founder
		? await c.env.DB.prepare(
				`SELECT t.*, u.username FROM tickets t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC LIMIT 200`,
			).all<TicketRow>()
		: await c.env.DB.prepare(
				`SELECT t.*, u.username FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 100`,
			)
				.bind(me.id)
				.all<TicketRow>();
	const list = rows.results || [];
	const attMap = await attachmentsFor(
		c.env,
		list.map((r) => r.id),
	);
	return json({ tickets: list.map((r) => publicTicket(r, attMap.get(r.id) || [])) });
});

app.post("/api/tickets/attachments", async (c) => {
	if (!isBetaOpen(c.env)) return bad("Beta tickets are closed", 404);
	if (await rateLimited(c.req.raw, "ticket-file", 30, 3600)) return bad("Too many uploads right now", 429);
	const me = c.get("user");
	const filename = sanitizeTicketFilename(c.req.header("x-filename") || c.req.query("filename") || "attachment");
	const buf = await c.req.arrayBuffer();
	if (!buf.byteLength) return bad("Empty file");
	if (buf.byteLength > MAX_FILE_BYTES) return bad("File too large (10 MB max)", 413);
	const ct = sniffTicketType(buf, c.req.header("content-type") || "", filename);
	if (!ct) return bad("That file type is not allowed", 415);
	const pending = await c.env.DB.prepare(
		"SELECT COUNT(*) AS n FROM ticket_attachments WHERE user_id = ? AND ticket_id IS NULL",
	)
		.bind(me.id)
		.first<{ n: number }>();
	if (Number(pending?.n || 0) >= TICKET_MAX_FILES) return bad(`At most ${TICKET_MAX_FILES} files per ticket`);
	const id = crypto.randomUUID();
	const key = `tickets/${me.id}/${id}.${ticketFileExt(ct, filename)}`;
	await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: ct } });
	const now = nowIso();
	await c.env.DB.prepare(
		`INSERT INTO ticket_attachments (id, ticket_id, user_id, media_key, filename, content_type, byte_size, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(id, me.id, key, filename, ct, buf.byteLength, now)
		.run();
	return json({
		id,
		name: filename,
		contentType: ct,
		size: buf.byteLength,
		url: `/api/tickets/files/${id}`,
		image: ct.startsWith("image/"),
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
	return serveTicketAttachment(c.env, att);
});

app.get("/api/internal/tickets/files/:id", async (c) => {
	const id = c.req.param("id");
	const att = await c.env.DB.prepare("SELECT * FROM ticket_attachments WHERE id = ?")
		.bind(id)
		.first<AttachmentRow>();
	if (!att) return bad("Not found", 404);
	const token = bearerToken(c.req.raw);
	const bot = verifyTicketBotBearer(c.env, token);
	const callback = att.ticket_id ? await verifyTicketCallbackToken(c.env, att.ticket_id, token) : false;
	if (!bot && !callback) return bad("Forbidden", 403);
	return serveTicketAttachment(c.env, att);
});

app.post("/api/tickets", async (c) => {
	if (!isBetaOpen(c.env)) return bad("Beta tickets are closed", 404);
	if (await rateLimited(c.req.raw, "ticket", 12, 3600)) return bad("Too many tickets right now", 429);
	const me = c.get("user");
	let body: { kind?: string; title?: string; body?: string; attachmentIds?: string[] };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const kind: TicketKind = body.kind === "feature" ? "feature" : body.kind === "bug" ? "bug" : ("" as TicketKind);
	if (kind !== "bug" && kind !== "feature") return bad("Pick bug or feature");
	const title = (body.title || "").trim().slice(0, 80);
	const text = (body.body || "").trim().slice(0, 4000);
	if (title.length < 4) return bad("Give it a short title");
	if (text.length < 12) return bad("Tell us what happened or what you want");
	const today = await c.env.DB.prepare(
		"SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND created_at > datetime('now', '-1 day')",
	)
		.bind(me.id)
		.first<{ n: number }>();
	if (Number(today?.n || 0) >= 8) return bad("That's enough tickets for today", 429);
	const id = crypto.randomUUID();
	const now = nowIso();
	await c.env.DB.prepare(
		`INSERT INTO tickets (id, user_id, kind, title, body, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
	)
		.bind(id, me.id, kind, title, text, now, now)
		.run();
	const attachments = await claimTicketAttachments(
		c.env,
		me.id,
		id,
		Array.isArray(body.attachmentIds) ? body.attachmentIds : [],
	);
	const row = await c.env.DB.prepare("SELECT t.*, u.username FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.id = ?")
		.bind(id)
		.first<TicketRow>();
	if (row) c.executionCtx.waitUntil(dispatchTicketWebhook(c.env, row));
	return json({ ticket: publicTicket(row!, attachments) });
});

app.post("/api/internal/tickets/result", async (c) => {
	if (await rateLimited(c.req.raw, "ticket-callback", 40, 3600)) return bad("Too many attempts", 429);
	let body: { ticketId?: string; status?: string; note?: string; prUrl?: string; rollout?: string; androidVersionCode?: number };
	try {
		body = await c.req.json();
	} catch {
		return bad("Invalid request");
	}
	const ticketId = (body.ticketId || "").trim();
	if (!(await verifyTicketCallbackToken(c.env, ticketId, bearerToken(c.req.raw)))) {
		return bad("Forbidden", 403);
	}
	const result = await applyTicketResult(c.env, ticketId, body);
	if ("error" in result) return bad(result.error, result.status);
	return json({ ok: true });
});

app.post("/api/legal-notice", async (c) => {
	if (await rateLimited(c.req.raw, "legal", 5, 3600)) return bad("Too many attempts", 429);
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
	if (await rateLimited(c.req.raw, "admin", 5, 900)) return bad("Too many attempts", 429);
	const expected = c.env.ADMIN_PASSWORD;
	const body = await c.req.json<{ password?: string; mediaKey?: string; noticeId?: string }>();
	const session = await requireUser(c.req.raw, c.env);
	const founder = !(session instanceof Response) && isFounderUsername(session.user.username);
	if (!founder && (!expected || !(await secretEqual(body.password || "", expected)))) return bad("Forbidden", 403);
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

app.get("/api/health", (_c) => json({ ok: true }));

app.get("/api/app", async (c) => {
	const [android, notice] = await Promise.all([androidRelease(c.env), latestAppNotice(c.env)]);
	return json({
		android,
		notice,
		playUrl: c.env.PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=dev.pyrearms.chat",
		privacyUrl: "https://chat.pyrearms.dev/privacy",
	});
});

app.post("/api/waitlist", async (c) => {
	if (await rateLimited(c.req.raw, "waitlist", 8, 3600)) return bad("Too many attempts", 429);
	const body = await c.req.json<{ email?: string; source?: string }>().catch(() => ({} as { email?: string; source?: string }));
	const email = normalizeWaitlistEmail(body.email || "");
	if (!email) return bad("Enter a real email");
	const source = waitlistSource(body.source);
	const ua = (c.req.header("User-Agent") || "").slice(0, 240);
	await c.env.DB.prepare(
		"INSERT OR IGNORE INTO waitlist (email, source, created_at, user_agent) VALUES (?, ?, ?, ?)",
	)
		.bind(email, source, nowIso(), ua || null)
		.run();
	return json({ ok: true });
});

app.get("/api/waitlist", async (c) => {
	if (!isFounderUsername(c.get("user").username)) return bad("Forbidden", 403);
	const rows = await c.env.DB.prepare(
		"SELECT email, source, created_at FROM waitlist ORDER BY created_at DESC LIMIT 5000",
	).all<{ email: string; source: string; created_at: string }>();
	return json({ count: rows.results.length, emails: rows.results });
});

app.get("/api/download/android", async (c) => {
	const obj = await c.env.MEDIA.get("app/pyrechat.apk");
	if (!obj) return bad("Android build is not published yet", 404);
	const headers = new Headers();
	headers.set("Content-Type", "application/vnd.android.package-archive");
	headers.set("Content-Disposition", 'attachment; filename="pyrechat.apk"');
	headers.set("Cache-Control", "public, max-age=300");
	if (obj.size != null) headers.set("Content-Length", String(obj.size));
	return new Response(obj.body, { headers });
});

export default app;
