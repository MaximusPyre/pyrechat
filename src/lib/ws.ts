import { apiOrigin, getToken } from "./api";

export function openSocket(path: string): WebSocket {
	const origin = apiOrigin();
	const host = origin ? new URL(origin).host : location.host;
	const secure = origin ? origin.startsWith("https:") : location.protocol === "https:";
	const proto = secure ? "wss:" : "ws:";
	const token = getToken();
	const q = token ? `${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : "";
	return new WebSocket(`${proto}//${host}${path}${q}`);
}
