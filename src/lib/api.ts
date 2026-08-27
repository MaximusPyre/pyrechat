import { Capacitor } from "@capacitor/core";
import type { User } from "./types";

export function apiOrigin(): string {
	const fromEnv = import.meta.env.VITE_API_ORIGIN as string | undefined;
	if (fromEnv) return fromEnv.replace(/\/$/, "");
	if (Capacitor.isNativePlatform()) return "https://chat.pyrearms.dev";
	return "";
}

export class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body && !(init.body instanceof ArrayBuffer) && !(init.body instanceof Blob) && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	let res: Response;
	try {
		res = await fetch(`${apiOrigin()}${path}`, { ...init, headers, credentials: "include" });
	} catch {
		throw new ApiError("Could not reach PyreChat. Check your connection.", 0);
	}
	if (!res.ok) {
		let msg = res.statusText || `Error ${res.status}`;
		try {
			const j = (await res.json()) as { error?: string };
			if (j.error) msg = j.error;
		} catch {
			/* ignore */
		}
		throw new ApiError(msg, res.status);
	}
	if (res.status === 204) return undefined as T;
	try {
		return (await res.json()) as T;
	} catch {
		throw new ApiError("PyreChat sent a bad response", res.status);
	}
}

export async function uploadTicketFile(file: File): Promise<{ id: string; name: string; url: string; image: boolean }> {
	return api("/api/tickets/attachments", {
		method: "POST",
		headers: {
			"Content-Type": file.type || "application/octet-stream",
			"X-Filename": file.name,
		},
		body: file,
	});
}

export function reloadForLiveBuild(id: string): void {
	const key = `pyrechat.reloaded.${id}`;
	try {
		if (localStorage.getItem(key) === "1") return;
		localStorage.setItem(key, "1");
	} catch {
		return;
	}
	location.reload();
}

export async function uploadMedia(blob: Blob): Promise<{ key: string; url: string }> {
	const type = blob.type || "image/jpeg";
	const res = await fetch(`${apiOrigin()}/api/media`, {
		method: "POST",
		headers: { "Content-Type": type },
		body: blob,
		credentials: "include",
	});
	if (!res.ok) throw new Error("Upload failed");
	return (await res.json()) as { key: string; url: string };
}

export function mediaUrl(key: string): string {
	return `${apiOrigin()}/api/media/${encodeURIComponent(key)}`;
}

export async function login(username: string, password: string): Promise<{ user: User; recoveryKey?: string }> {
	return api<{ user: User; recoveryKey?: string }>("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	});
}

export async function signup(
	username: string,
	password: string,
	displayName: string,
	birthday?: string,
): Promise<{ user: User; recoveryKey?: string }> {
	return api<{ user: User; recoveryKey?: string }>("/api/auth/signup", {
		method: "POST",
		body: JSON.stringify({ username, password, displayName, birthday }),
	});
}

export async function recover(username: string, seed: string, password: string): Promise<{ user: User }> {
	return api<{ user: User }>("/api/auth/recover", {
		method: "POST",
		body: JSON.stringify({ username, seed, password }),
	});
}

export function track(event: string): void {
	void api("/api/metrics", { method: "POST", body: JSON.stringify({ event }) }).catch(() => undefined);
}

export async function logout(): Promise<void> {
	try {
		await api("/api/auth/logout", { method: "POST" });
	} catch {
		/* cookie is cleared server-side when possible */
	}
}
