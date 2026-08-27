import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
	interface Window {
		__pwaInstall?: BeforeInstallPromptEvent | null;
	}
}

window.addEventListener("beforeinstallprompt", (event) => {
	event.preventDefault();
	window.__pwaInstall = event as BeforeInstallPromptEvent;
	window.dispatchEvent(new Event("pwa-install-ready"));
});

window.addEventListener("appinstalled", () => {
	window.__pwaInstall = null;
});

if ("serviceWorker" in navigator && !Capacitor.isNativePlatform()) {
	void navigator.serviceWorker.register("/sw.js");
}

if (Capacitor.isNativePlatform()) {
	void import("@capacitor/keyboard").then(({ Keyboard }) => {
		void Keyboard.setAccessoryBarVisible({ isVisible: false });
	});
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
