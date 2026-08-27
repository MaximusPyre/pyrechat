import { Capacitor } from "@capacitor/core";
import { apiOrigin } from "./api";

export const chatFieldProps = {
	autoComplete: "off" as const,
	autoCorrect: "on" as const,
	autoCapitalize: "sentences" as const,
	spellCheck: true,
	enterKeyHint: "send" as const,
	inputMode: "text" as const,
	name: "pyre-msg",
	"aria-autocomplete": "none" as const,
	"data-lpignore": "true",
	"data-1p-ignore": "true",
	"data-form-type": "other",
	"data-bwignore": "true",
};

export function bootNativeShell(): void {
	bindKeyboardInset();
	if (!Capacitor.isNativePlatform()) return;
	void hideKeyboardChrome();
	void pullLiveWebView();
	window.setInterval(() => {
		if (document.visibilityState === "visible") void pullLiveWebView();
	}, 60_000);
	void import("@capacitor/keyboard").then(({ Keyboard }) => {
		void Keyboard.addListener("keyboardWillShow", () => {
			void hideKeyboardChrome();
		});
		void Keyboard.addListener("keyboardDidShow", () => {
			void hideKeyboardChrome();
		});
	});
	void import("@capacitor/app").then(({ App }) => {
		void App.addListener("resume", () => {
			void hideKeyboardChrome();
			void pullLiveWebView();
		});
		void App.addListener("appStateChange", ({ isActive }) => {
			if (!isActive) return;
			void hideKeyboardChrome();
			void pullLiveWebView();
		});
	});
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") void pullLiveWebView();
	});
}

function bindKeyboardInset(): void {
	const apply = () => {
		const vv = window.visualViewport;
		let kbd = 0;
		if (vv) kbd = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
		document.documentElement.style.setProperty("--kbd", `${Math.round(kbd)}px`);
	};
	window.visualViewport?.addEventListener("resize", apply);
	window.visualViewport?.addEventListener("scroll", apply);
	window.addEventListener("resize", apply);
	apply();
}

async function hideKeyboardChrome(): Promise<void> {
	try {
		const { Keyboard } = await import("@capacitor/keyboard");
		await Keyboard.setAccessoryBarVisible({ isVisible: false });
		await Keyboard.setScroll({ isDisabled: true });
	} catch {
		/* plugin missing in browser */
	}
}

async function pullLiveWebView(): Promise<void> {
	const cur = currentBundleName();
	if (!cur) return;
	try {
		const origin = apiOrigin() || location.origin;
		const html = await fetch(`${origin}/?_=${Date.now()}`, { cache: "no-store", credentials: "omit" }).then((r) => r.text());
		const next = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1];
		if (next && next !== cur) {
			const u = new URL(location.href);
			u.searchParams.set("v", next.replace(/\W/g, ""));
			location.replace(u.toString());
		}
	} catch {
		/* offline: stay on the current WebView */
	}
}

function currentBundleName(): string | null {
	const src = (document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null)?.src || "";
	const m = src.match(/index-[A-Za-z0-9_-]+\.js/);
	return m ? m[0] : null;
}
