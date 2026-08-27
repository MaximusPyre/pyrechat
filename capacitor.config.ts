import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "dev.pyrearms.chat",
	appName: "PyreChat",
	webDir: "dist/client",
	server: {
		androidScheme: "https",
		iosScheme: "https",
		url: "https://chat.pyrearms.dev",
		allowNavigation: ["chat.pyrearms.dev"],
	},
	plugins: {
		SplashScreen: {
			backgroundColor: "#140e0b",
			launchAutoHide: true,
			showSpinner: false,
		},
		StatusBar: {
			style: "DARK",
			backgroundColor: "#140e0b",
		},
		Keyboard: {
			resize: "none",
			style: "DARK",
			resizeOnFullScreen: true,
		},
	},
	android: {
		backgroundColor: "#140e0b",
	},
	ios: {
		backgroundColor: "#140e0b",
		contentInset: "automatic",
		preferredContentMode: "mobile",
		scheme: "PyreChat",
	},
};

export default config;
