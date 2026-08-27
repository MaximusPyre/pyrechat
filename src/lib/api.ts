import { Capacitor } from "@capacitor/core";
import type { User } from "./types";

const TOKEN_KEY = "pyrechat.token";

export function apiOrigin(): string {
	const fromEnv = import.meta.env.VITE_API_ORIGIN as string | undefined;
	if (fromEnv) return fromEnv.replace(/\/$/, "");
	if (Capacitor.isNativePlatform()) return "https://chat.pyrearms.dev";
	return "";
}

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
	if (token) localStorage.setItem(TOKEN_KEY, token);
	else localStorage.removeItem(TOKEN_KEY);
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
	const token = getToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
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

export async function uploadTicketFile(file: File): Promise<{
	id: string;
	filename: string;
	contentType: string;
	size: number;
	url: string;
	image: boolean;
}> {
	const token = getToken();
	const res = await fetch(`${apiOrigin()}/api/tickets/attachments`, {
		method: "POST",
		headers: {
			"Content-Type": file.type || "application/octet-stream",
			"X-Filename": file.name || "attachment",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: file,
		credentials: "include",
	});
	if (!res.ok) {
		let msg = "Upload failed";
		try {
			const j = (await res.json()) as { error?: string };
			if (j.error) msg = j.error;
		} catch {
			/* ignore */
		}
		throw new ApiError(msg, res.status);
	}
	return (await res.json()) as {
		id: string;
		filename: string;
		contentType: string;
		size: number;
		url: string;
		image: boolean;
	};
}

export async function uploadMedia(blob: Blob): Promise<{ key: string; url: string }> {
	const token = getToken();
	const res = await fetch(`${apiOrigin()}/api/media`, {
		method: "POST",
		headers: {
			"Content-Type": blob.type || "application/octet-stream",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: blob,
		credentials: "include",
	});
	if (!res.ok) throw new Error("Upload failed");
	return (await res.json()) as { key: string; url: string };
}

export function mediaUrl(key: string): string {
	return `${apiOrigin()}/api/media/${encodeURIComponent(key)}`;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
	const out = await api<{ token: string; user: User }>("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({ username, password }),
	});
	setToken(out.token);
	return out;
}

export async function signup(
	username: string,
	password: string,
	displayName: string,
	birthday?: string,
): Promise<{ token: string; user: User }> {
	const out = await api<{ token: string; user: User }>("/api/auth/signup", {
		method: "POST",
		body: JSON.stringify({ username, password, displayName, birthday }),
	});
	setToken(out.token);
	return out;
}

export async function logout(): Promise<void> {
	try {
		await api("/api/auth/logout", { method: "POST" });
	} finally {
		setToken(null);
	}
}
