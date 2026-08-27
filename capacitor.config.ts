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
			backgroundColor: "#141618",
			launchAutoHide: true,
			showSpinner: false,
		},
		StatusBar: {
			style: "DARK",
			backgroundColor: "#141618",
		},
		Keyboard: {
			resize: "body",
			style: "DARK",
		},
	},
	android: {
		backgroundColor: "#141618",
	},
	ios: {
		backgroundColor: "#141618",
		contentInset: "automatic",
		preferredContentMode: "mobile",
		scheme: "PyreChat",
	},
};

export default config;
