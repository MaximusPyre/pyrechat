import { DurableObject } from "cloudflare:workers";

type Att = { userId?: string };

function userIdOf(ws: WebSocket): string {
	const att = ws.deserializeAttachment() as Att | null;
	return att?.userId || "";
}

export class ChatRoom extends DurableObject<Env> {
	#sendAll(payload: string, skip?: WebSocket): void {
		for (const ws of this.ctx.getWebSockets()) {
			if (ws === skip) continue;
			try {
				ws.send(payload);
			} catch {
				/* closed */
			}
		}
	}

	#roster(): string[] {
		const ids = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			const id = userIdOf(ws);
			if (id) ids.add(id);
		}
		return [...ids];
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.endsWith("/broadcast") && request.method === "POST") {
			this.#sendAll(await request.text());
			return new Response("ok");
		}
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("expected websocket", { status: 426 });
		}
		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		const userId = url.searchParams.get("user") || "";
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ userId });
		try {
			server.send(JSON.stringify({ type: "roster", users: this.#roster() }));
		} catch {
			/* ignore */
		}
		if (userId) this.#sendAll(JSON.stringify({ type: "here", from: userId, at: Date.now() }), server);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);
		let parsed: { type?: string; [k: string]: unknown };
		try {
			parsed = JSON.parse(text) as { type?: string };
		} catch {
			return;
		}
		const from = userIdOf(ws);
		this.#sendAll(JSON.stringify({ ...parsed, from, at: Date.now() }));
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const from = userIdOf(ws);
		try {
			ws.close();
		} catch {
			/* already */
		}
		if (from) this.#sendAll(JSON.stringify({ type: "gone", from, at: Date.now() }));
	}
}

export class UserHub extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.endsWith("/push") && request.method === "POST") {
			const payload = await request.text();
			for (const ws of this.ctx.getWebSockets()) {
				try {
					ws.send(payload);
				} catch {
					/* closed */
				}
			}
			return new Response("ok");
		}
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("expected websocket", { status: 426 });
		}
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);
		let parsed: { type?: string };
		try {
			parsed = JSON.parse(text) as { type?: string };
		} catch {
			return;
		}
		if (parsed.type === "ping") {
			ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
		}
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		ws.close();
	}
}
