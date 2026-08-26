import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [react(), cloudflare()],
	server: {
		port: 5173,
		host: "localhost",
	},
	optimizeDeps: {
		exclude: ["@mediapipe/tasks-vision"],
	},
	build: {
		target: "es2022",
		modulePreload: false,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/leaflet")) return "leaflet";
					if (id.includes("@mediapipe")) return "mediapipe";
				},
			},
		},
	},
});
