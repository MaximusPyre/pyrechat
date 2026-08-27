const ALLOWED = new Set([
	"view_inbox",
	"view_capture",
	"view_feed",
	"view_you",
	"signup",
	"login",
	"snap",
	"story",
	"spotlight",
	"media",
]);

function dayStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

function routeShape(path: string): string {
	return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "*").slice(0, 80);
}

export function track(env: Env, event: string, extra?: string): void {
	const name = ALLOWED.has(event) ? event : "other";
	try {
		env.ANALYTICS?.writeDataPoint({
			blobs: [name, extra || "", dayStamp()],
			doubles: [1],
			indexes: [dayStamp()],
		});
	} catch {
		/* analytics must never break the app */
	}
}

export function trackRequest(env: Env, request: Request, status: number): void {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/api/")) return;
	try {
		env.ANALYTICS?.writeDataPoint({
			blobs: ["api", request.method, routeShape(url.pathname), request.headers.get("cf-ipcountry") || "XX"],
			doubles: [status],
			indexes: [dayStamp()],
		});
	} catch {
		/* ignore */
	}
}

export async function bumpMetric(env: Env, event: string): Promise<void> {
	if (!ALLOWED.has(event)) return;
	try {
		await env.DB.prepare(
			`INSERT INTO metric_daily (day, event, n) VALUES (?, ?, 1)
       ON CONFLICT(day, event) DO UPDATE SET n = n + 1`,
		)
			.bind(dayStamp(), event)
			.run();
	} catch {
		/* table may not exist yet */
	}
}
