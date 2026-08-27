const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["play", "demo", "send", "landing", "settings"]);

export function normalizeWaitlistEmail(raw: string): string | null {
	const email = raw.trim().toLowerCase().slice(0, 254);
	if (!EMAIL_RE.test(email)) return null;
	return email;
}

export function waitlistSource(raw: unknown): string {
	const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
	return SOURCES.has(s) ? s : "landing";
}
