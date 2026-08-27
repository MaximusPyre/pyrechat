export const FOUNDER_USERNAME = "maximuspyre";
export const FOUNDER_DISPLAY = "Maximus Pyre";

export function normUser(s: string): string {
	return s.trim().toLowerCase();
}

export function isFounderUsername(username: string | null | undefined): boolean {
	return normUser(username || "") === FOUNDER_USERNAME;
}

export function looksLikeFounderName(display: string): boolean {
	const n = display.toLowerCase().replace(/[^a-z0-9]/g, "");
	return n === "maximuspyre" || n === FOUNDER_USERNAME;
}

export function founderBlocked(display: string, username: string, actorUsername: string): string | null {
	if (isFounderUsername(actorUsername)) return null;
	if (isFounderUsername(username)) return "That username is reserved";
	if (looksLikeFounderName(display)) return "That display name is reserved";
	return null;
}
