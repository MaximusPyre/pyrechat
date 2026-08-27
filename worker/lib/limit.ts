const RL_GEN = "v3";

export async function rateLimited(
	request: Request,
	bucket: string,
	max: number,
	windowSec: number,
	mode: "check" | "hit" = "hit",
): Promise<boolean> {
	const ip =
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		"local";
	const slot = Math.floor(Date.now() / (windowSec * 1000));
	const cacheKey = new Request(
		`https://rl.pyrechat.internal/${RL_GEN}/${encodeURIComponent(bucket)}/${encodeURIComponent(ip)}/${slot}`,
	);
	const cache = caches.default;
	try {
		const hit = await cache.match(cacheKey);
		const current = hit ? Number(await hit.text()) || 0 : 0;
		if (mode === "check") return current > max;
		const n = current + 1;
		await cache.put(
			cacheKey,
			new Response(String(n), { headers: { "Cache-Control": `max-age=${windowSec + 5}` } }),
		);
		return n > max;
	} catch {
		return false;
	}
}
