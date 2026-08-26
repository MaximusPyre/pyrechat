import app from "./api.js";
import { ChatRoom, UserHub } from "./durable/realtime.js";
import { expireContent } from "./expire.js";

export { ChatRoom, UserHub };

export default {
	async fetch(request, env, ctx) {
		return app.fetch(request, env, ctx);
	},
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(expireContent(env));
	},
} satisfies ExportedHandler<Env>;
