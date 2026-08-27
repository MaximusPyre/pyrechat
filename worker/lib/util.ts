export function nowIso(): string {
	return new Date().toISOString();
}

export function hoursFromNow(hours: number): string {
	return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export function json(data: unknown, status = 200): Response {
	return Response.json(data, { status });
}

export function withCookies(res: Response, ...cookies: string[]): Response {
	const out = new Response(res.body, res);
	for (const cookie of cookies) out.headers.append("Set-Cookie", cookie);
	return out;
}

export function bad(msg: string, status = 400): Response {
	return Response.json({ error: msg }, { status });
}

export function pairKey(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

export function dmId(a: string, b: string): string {
	const [x, y] = pairKey(a, b);
	return `dm_${x}_${y}`;
}

export function monthKey(iso: string): string {
	return iso.slice(0, 7);
}

export async function notify(
	env: Env,
	userId: string,
	kind: string,
	body: string,
	payload?: unknown,
): Promise<void> {
	await env.DB.prepare(
		"INSERT INTO notifications (id, user_id, kind, body, payload, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
	)
		.bind(crypto.randomUUID(), userId, kind, body, payload ? JSON.stringify(payload) : null, nowIso())
		.run();
	try {
		const stub = env.USER_HUB.get(env.USER_HUB.idFromName(userId));
		await stub.fetch("https://hub/push", {
			method: "POST",
			body: JSON.stringify({ type: "notification", kind, body, payload }),
		});
	} catch {
		/* hub may be cold; notification is persisted */
	}
}

export async function bumpScore(env: Env, userId: string, by = 1): Promise<void> {
	await env.DB.prepare("UPDATE users SET snap_score = snap_score + ?, last_active = ? WHERE id = ?")
		.bind(by, nowIso(), userId)
		.run();
}

export async function setSnapScore(env: Env, userId: string, score: number): Promise<void> {
	await env.DB.prepare("UPDATE users SET snap_score = ?, last_active = ? WHERE id = ?")
		.bind(Math.max(0, Math.floor(score)), nowIso(), userId)
		.run();
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}
