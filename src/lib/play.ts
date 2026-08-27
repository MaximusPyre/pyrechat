export const PLAY_PACKAGE = "dev.pyrearms.chat";
export const PLAY_PRE_REG_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;
export const PRIVACY_URL = "https://chat.pyrearms.dev/privacy";
export const TERMS_URL = "https://chat.pyrearms.dev/terms";

export function openPlayPreReg(): void {
	window.open(PLAY_PRE_REG_URL, "_blank", "noopener,noreferrer");
}
