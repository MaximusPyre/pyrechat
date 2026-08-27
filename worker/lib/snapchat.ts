const SPOTLIGHT_HOSTS = new Set(["story.snapchat.com", "www.snapchat.com", "snapchat.com"]);

export function normalizeSnapUsername(raw: string): string {
	return (raw || "")
		.trim()
		.replace(/^@/, "")
		.toLowerCase();
}

export function isValidSnapUsername(username: string): boolean {
	return /^[a-z0-9._-]{3,32}$/i.test(username);
}

export function generateVerifyCode(userId: string): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
	return `PYRE-${hex}`;
}

export function parseSpotlightUrl(raw: string): URL | null {
	try {
		const url = new URL(raw.trim());
		if (!SPOTLIGHT_HOSTS.has(url.hostname)) return null;
		return url;
	} catch {
		return null;
	}
}

export function usernameFromSpotlightUrl(url: URL): string | null {
	const story = url.pathname.match(/\/@([^/]+)/i);
	if (story?.[1]) return normalizeSnapUsername(story[1]);
	const add = url.pathname.match(/\/add\/([^/?]+)/i);
	if (add?.[1]) return normalizeSnapUsername(add[1]);
	return null;
}

function decodeHtml(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}

function metaContent(html: string, key: string): string {
	const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
	const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i");
	return decodeHtml(html.match(re)?.[1] || html.match(alt)?.[1] || "");
}

export async function scrapeSpotlight(url: string): Promise<{ description: string; title: string; username: string | null }> {
	const parsed = parseSpotlightUrl(url);
	if (!parsed) throw new Error("Use a public Snapchat Spotlight or story link");
	const res = await fetch(parsed.toString(), {
		headers: {
			"User-Agent": "Mozilla/5.0 (compatible; PyreChat/1.0; +https://chat.pyrearms.dev)",
			Accept: "text/html,application/xhtml+xml",
		},
		redirect: "follow",
	});
	if (!res.ok) throw new Error("Could not load that Spotlight link");
	const html = await res.text();
	const description = metaContent(html, "og:description") || metaContent(html, "description");
	const title = metaContent(html, "og:title") || metaContent(html, "title");
	const username = usernameFromSpotlightUrl(parsed);
	return { description, title, username };
}

export function spotlightContainsCode(text: string, code: string): boolean {
	const hay = (text || "").toUpperCase();
	const needle = (code || "").toUpperCase();
	return needle.length > 0 && hay.includes(needle);
}

export function extractSnapScoreFromExport(raw: unknown): number | null {
	if (raw == null) return null;
	if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
	if (typeof raw === "string") {
		const n = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
		return Number.isFinite(n) ? Math.max(0, n) : null;
	}
	if (typeof raw !== "object") return null;
	const obj = raw as Record<string, unknown>;

	const direct =
		obj.Snapscore ??
		obj.snapscore ??
		obj.snap_score ??
		obj["Snap Score"] ??
		obj.score;
	const fromDirect = extractSnapScoreFromExport(direct);
	if (fromDirect != null) return fromDirect;

	const stats = obj.RankingStatistics ?? obj.ranking_statistics ?? obj.statistics;
	if (stats && typeof stats === "object") {
		const nested = extractSnapScoreFromExport((stats as Record<string, unknown>).Snapscore ?? (stats as Record<string, unknown>).snapscore);
		if (nested != null) return nested;
	}

	for (const value of Object.values(obj)) {
		const found = extractSnapScoreFromExport(value);
		if (found != null) return found;
	}
	return null;
}

export async function parseSnapExportText(text: string): Promise<number> {
	const trimmed = text.trim();
	if (!trimmed) throw new Error("Empty export file");
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new Error("Upload ranking.json or user_profile.json from your Snapchat export");
	}
	const score = extractSnapScoreFromExport(parsed);
	if (score == null) throw new Error("Could not find Snapscore in that file. Try ranking.json from your Snapchat export.");
	return score;
}
