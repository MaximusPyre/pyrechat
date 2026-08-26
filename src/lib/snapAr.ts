import { Capacitor, registerPlugin, WebPlugin } from "@capacitor/core";

export type SnapArStatus = { native: boolean; configured: boolean };

export type SnapArCapture = { kind: "photo" | "video"; blob: Blob; url: string };

interface SnapArPlugin {
	available(): Promise<SnapArStatus>;
	capture(): Promise<{ kind: string; mime: string; base64: string }>;
}

class SnapArWeb extends WebPlugin implements SnapArPlugin {
	async available(): Promise<SnapArStatus> {
		return { native: false, configured: false };
	}

	async capture(): Promise<{ kind: string; mime: string; base64: string }> {
		throw this.unimplemented("Snap Camera Kit is only in the Android app.");
	}
}

const SnapAr = registerPlugin<SnapArPlugin>("SnapAr", {
	web: () => new SnapArWeb(),
});

export async function snapArStatus(): Promise<SnapArStatus> {
	if (Capacitor.getPlatform() !== "android") return { native: false, configured: false };
	try {
		return await SnapAr.available();
	} catch {
		return { native: true, configured: false };
	}
}

function b64ToBlob(b64: string, mime: string): Blob {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type: mime });
}

export async function captureSnapAr(): Promise<SnapArCapture> {
	const r = await SnapAr.capture();
	const mime = r.mime || (r.kind === "video" ? "video/mp4" : "image/jpeg");
	const blob = b64ToBlob(r.base64, mime);
	const kind = r.kind === "video" ? "video" : "photo";
	return { kind, blob, url: URL.createObjectURL(blob) };
}
