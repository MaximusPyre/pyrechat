import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "dev.pyrearms.chat",
	appName: "PyreChat",
	webDir: "dist/client",
	server: {
		androidScheme: "https",
		iosScheme: "https",
	},
	plugins: {
		SplashScreen: {
			backgroundColor: "#FF6A1A",
			launchAutoHide: true,
			showSpinner: false,
		},
		StatusBar: {
			style: "DARK",
			backgroundColor: "#000000",
		},
		Keyboard: {
			resize: "body",
		},
	},
	android: {
		backgroundColor: "#000000",
	},
	ios: {
		backgroundColor: "#000000",
		contentInset: "automatic",
		preferredContentMode: "mobile",
		scheme: "PyreChat",
	},
};

export default config;
