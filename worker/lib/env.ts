export function envText(env: Env, key: string): string {
	const v = (env as unknown as Record<string, unknown>)[key];
	return typeof v === "string" ? v.trim() : "";
}

export function envOn(env: Env, key: string): boolean {
	return envText(env, key) === "1";
}

export function isEarlyCohort(env: Env): boolean {
	return envOn(env, "EARLY_COHORT");
}

export function isBetaOpen(env: Env): boolean {
	return envOn(env, "BETA_OPEN");
}
