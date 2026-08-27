import app from "./api.js";
import { ChatRoom, UserHub } from "./durable/realtime.js";
import { expireContent } from "./expire.js";

export { ChatRoom, UserHub };

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob: https://cdn.jsdelivr.net",
	"worker-src 'self' blob:",
	"connect-src 'self' blob: https: wss:",
	"img-src 'self' data: blob: https:",
	"media-src 'self' blob: mediastream:",
	"style-src 'self' 'unsafe-inline'",
	"font-src 'self' data:",
	"frame-ancestors 'none'",
	"base-uri 'self'",
].join("; ");

function withHtmlHeaders(res: Response): Response {
	const headers = new Headers(res.headers);
	headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
	headers.set("Content-Security-Policy", CSP);
	return new Response(res.body, { status: res.status, headers });
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname.startsWith("/assets/")) {
			const res = await env.ASSETS.fetch(request);
			const type = (res.headers.get("Content-Type") || "").toLowerCase();
			if (res.status === 404 || type.includes("text/html")) {
				return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
			}
			return res;
		}
		if (url.pathname === "/" || url.pathname === "/index.html") {
			return withHtmlHeaders(await env.ASSETS.fetch(request));
		}
		const res = await app.fetch(request, env, ctx);
		const type = (res.headers.get("Content-Type") || "").toLowerCase();
		if (type.includes("text/html")) return withHtmlHeaders(res);
		return res;
	},
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(expireContent(env));
	},
} satisfies ExportedHandler<Env>;
