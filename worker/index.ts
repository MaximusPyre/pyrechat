import app from "./api.js";
import { ChatRoom, UserHub } from "./durable/realtime.js";
import { expireContent } from "./expire.js";

export { ChatRoom, UserHub };

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
			const res = await env.ASSETS.fetch(request);
			const headers = new Headers(res.headers);
			headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
			return new Response(res.body, { status: res.status, headers });
		}
		return app.fetch(request, env, ctx);
	},
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(expireContent(env));
	},
} satisfies ExportedHandler<Env>;
