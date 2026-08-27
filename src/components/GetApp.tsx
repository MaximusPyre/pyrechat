import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { api, reloadForLiveBuild } from "../lib/api";

export const APK_URL = "https://chat.pyrearms.dev/api/download/android";
/** Bump this and android versionCode together whenever a new APK is published. */
export const NATIVE_VERSION_CODE = 2;

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

export function isStandaloneApp(): boolean {
	if (isNativeApp()) return true;
	if (window.matchMedia("(display-mode: standalone)").matches) return true;
	const nav = navigator as Navigator & { standalone?: boolean };
	return nav.standalone === true;
}

export function isIosDevice(): boolean {
	const ua = navigator.userAgent || "";
	if (/iPhone|iPad|iPod/i.test(ua)) return true;
	return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function canShowApk(): boolean {
	if (isIosDevice()) return false;
	return true;
}

export function GetAppCard({ prominent = false }: { prominent?: boolean }) {
	const [hidden, setHidden] = useState(() => {
		try {
			return !prominent && localStorage.getItem("pyrechat.hideGetApp") === "1";
		} catch {
			return false;
		}
	});
	const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
		() => window.__pwaInstall ?? null,
	);
	const [iosHelp, setIosHelp] = useState(false);

	useEffect(() => {
		const sync = () => setPromptEvent(window.__pwaInstall ?? null);
		sync();
		window.addEventListener("pwa-install-ready", sync);
		window.addEventListener("appinstalled", sync);
		return () => {
			window.removeEventListener("pwa-install-ready", sync);
			window.removeEventListener("appinstalled", sync);
		};
	}, []);

	if (isStandaloneApp() || hidden) return null;

	async function install() {
		if (promptEvent) {
			await promptEvent.prompt();
			const choice = await promptEvent.userChoice;
			if (choice.outcome === "accepted") {
				window.__pwaInstall = null;
				setPromptEvent(null);
			}
			return;
		}
		if (isIosDevice()) setIosHelp(true);
	}

	const pwaReady = !!promptEvent;
	const ios = isIosDevice();
	const title = ios ? "Install on iPhone" : pwaReady ? "Install PyreChat" : "Get the app";
	const sub = ios
		? "Add to Home Screen — no App Store wait."
		: pwaReady
			? "Install from this browser. Home screen icon, full screen."
			: "Install from Chrome, or download the Android APK.";

	return (
		<>
			<div className={`get-app${prominent ? " prominent" : ""}`}>
				<div className="get-app-copy">
					<strong>{title}</strong>
					<span>{sub}</span>
				</div>
				{(pwaReady || ios) && (
					<button className="get-app-btn" type="button" onClick={() => void install()}>
						Install
					</button>
				)}
				{canShowApk() && !pwaReady && (
					<a className="get-app-btn" href={APK_URL}>
						APK
					</a>
				)}
				{canShowApk() && pwaReady && (
					<a className="get-app-link" href={APK_URL}>
						APK
					</a>
				)}
				{!prominent && (
					<button
						className="get-app-x"
						aria-label="Hide"
						onClick={() => {
							try {
								localStorage.setItem("pyrechat.hideGetApp", "1");
							} catch {
								/* ignore */
							}
							setHidden(true);
						}}
					>
						×
					</button>
				)}
			</div>
			{iosHelp && <IosInstallSheet onClose={() => setIosHelp(false)} />}
		</>
	);
}

export function AuthInstallActions() {
	const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
		() => window.__pwaInstall ?? null,
	);
	const [iosHelp, setIosHelp] = useState(false);

	useEffect(() => {
		const sync = () => setPromptEvent(window.__pwaInstall ?? null);
		sync();
		window.addEventListener("pwa-install-ready", sync);
		window.addEventListener("appinstalled", sync);
		return () => {
			window.removeEventListener("pwa-install-ready", sync);
			window.removeEventListener("appinstalled", sync);
		};
	}, []);

	if (isStandaloneApp()) return null;

	async function install() {
		if (promptEvent) {
			await promptEvent.prompt();
			const choice = await promptEvent.userChoice;
			if (choice.outcome === "accepted") {
				window.__pwaInstall = null;
				setPromptEvent(null);
			}
			return;
		}
		setIosHelp(true);
	}

	const ios = isIosDevice();
	const showInstall = !!promptEvent || ios;

	return (
		<>
			{showInstall && (
				<button className="primary get-app-auth" type="button" onClick={() => void install()}>
					{ios ? "Install on iPhone" : "Install app"}
				</button>
			)}
			{canShowApk() && (
				<a className={showInstall ? "link" : "primary get-app-auth"} href={APK_URL}>
					Get the Android APK
				</a>
			)}
			{iosHelp && <IosInstallSheet onClose={() => setIosHelp(false)} />}
		</>
	);
}

function IosInstallSheet({ onClose }: { onClose: () => void }) {
	return (
		<div className="sheet" onClick={onClose}>
			<div className="sheet-card ios-install" onClick={(e) => e.stopPropagation()}>
				<div className="sheet-title">Add to Home Screen</div>
				<ol className="ios-install-steps">
					<li>
						Tap the <b>Share</b> button
						<span className="ios-share" aria-hidden>
							□↑
						</span>
					</li>
					<li>
						Scroll and tap <b>Add to Home Screen</b>
					</li>
					<li>
						Tap <b>Add</b>
					</li>
				</ol>
				<p className="muted" style={{ textAlign: "center", fontWeight: 700 }}>
					Safari only — Chrome on iPhone can’t install Home Screen apps.
				</p>
				<button className="primary" style={{ width: "100%" }} type="button" onClick={onClose}>
					Got it
				</button>
			</div>
		</div>
	);
}

export function NativeUpdateBanner() {
	const [url, setUrl] = useState<string | null>(null);
	useEffect(() => {
		if (!isNativeApp()) return;
		void api<{ android: { versionCode: number; url: string } }>("/api/app")
			.then((r) => {
				if (r.android.versionCode > NATIVE_VERSION_CODE) setUrl(r.android.url);
			})
			.catch(() => {
				/* ignore */
			});
	}, []);
	if (!url) return null;
	return (
		<div className="get-app">
			<div className="get-app-copy">
				<strong>Update PyreChat</strong>
				<span>A new Android build is ready.</span>
			</div>
			<a className="get-app-btn" href={url}>
				Install
			</a>
		</div>
	);
}

export function AppNoticeBanner() {
	const [notice, setNotice] = useState<{ id: string; kind: string; body: string; url: string | null } | null>(null);
	useEffect(() => {
		let alive = true;
		async function load() {
			try {
				const r = await api<{ notice: { id: string; kind: string; body: string; url: string | null } | null }>("/api/app");
				if (!alive || !r.notice) return;
				if (r.notice.kind === "live") reloadForLiveBuild(r.notice.id);
				try {
					if (localStorage.getItem(`pyrechat.notice.${r.notice.id}`) === "1") return;
				} catch {
					/* ignore */
				}
				setNotice(r.notice);
			} catch {
				/* ignore */
			}
		}
		void load();
		const t = window.setInterval(() => void load(), 60000);
		return () => {
			alive = false;
			window.clearInterval(t);
		};
	}, []);
	if (!notice) return null;
	return (
		<div className="get-app">
			<div className="get-app-copy">
				<strong>{notice.kind === "apk" ? "New Android build" : "PyreChat updated"}</strong>
				<span>{notice.body}</span>
			</div>
			{notice.url && (
				<a className="get-app-btn" href={notice.url}>
					Download
				</a>
			)}
			<button
				className="get-app-x"
				aria-label="Dismiss"
				onClick={() => {
					try {
						localStorage.setItem(`pyrechat.notice.${notice.id}`, "1");
					} catch {
						/* ignore */
					}
					setNotice(null);
				}}
			>
				×
			</button>
		</div>
	);
}

type AccountNotice = { id: string; kind: string; body: string; payload: string | null; read: number };

export function AccountNotices({ refreshKey = 0 }: { refreshKey?: number }) {
	const [items, setItems] = useState<AccountNotice[]>([]);
	useEffect(() => {
		void api<{ notifications: AccountNotice[] }>("/api/notifications")
			.then((r) => {
				setItems((r.notifications || []).filter((n) => n.kind === "ticket" || n.kind === "app_update").slice(0, 4));
			})
			.catch(() => {
				/* ignore */
			});
	}, [refreshKey]);
	if (items.length === 0) return null;
	return (
		<div className="account-notices">
			{items.map((n) => {
				let url = "";
				try {
					const p = n.payload ? (JSON.parse(n.payload) as { url?: string }) : {};
					if (p.url) url = p.url;
				} catch {
					/* ignore */
				}
				if (n.kind === "app_update" && !url) url = APK_URL;
				return (
					<div key={n.id} className={`account-notice${n.read ? "" : " unread"}`}>
						<div className="get-app-copy">
							<strong>{n.kind === "ticket" ? "Ticket update" : "App update"}</strong>
							<span>{n.body}</span>
						</div>
						{url && n.kind === "app_update" && (
							<a className="get-app-link" href={url}>
								APK
							</a>
						)}
					</div>
				);
			})}
		</div>
	);
}
