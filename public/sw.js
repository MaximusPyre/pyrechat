const ASSET_CACHE = "pyrechat-assets-v5";

self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)));
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith("/api/")) return;
	if (url.pathname === "/sw.js") return;

	if (url.pathname.startsWith("/assets/")) {
		event.respondWith(cacheHashedAsset(req));
		return;
	}

	event.respondWith(networkFirst(req));
});

function isHtml(res) {
	const type = (res.headers.get("Content-Type") || "").toLowerCase();
	return type.includes("text/html");
}

function canCacheAsset(req, res) {
	if (!res.ok) return false;
	if (isHtml(res)) return false;
	const path = new URL(req.url).pathname;
	return /\.(js|css|wasm|woff2?|png|jpe?g|gif|webp|svg|ico|map)$/i.test(path);
}

async function cacheHashedAsset(req) {
	const cache = await caches.open(ASSET_CACHE);
	const hit = await cache.match(req);
	if (hit && !isHtml(hit)) return hit;
	if (hit) await cache.delete(req);
	const res = await fetch(req);
	if (canCacheAsset(req, res)) await cache.put(req, res.clone());
	if (isHtml(res)) {
		return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
	return res;
}

async function networkFirst(req) {
	try {
		const res = await fetch(req);
		return res;
	} catch {
		const cache = await caches.open(ASSET_CACHE);
		const hit = await cache.match(req);
		if (hit && !isHtml(hit)) return hit;
		return Response.error();
	}
}
