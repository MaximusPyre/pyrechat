import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Pt } from "./lenses";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL =
	"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker: FaceLandmarker | null = null;
let boot: Promise<FaceLandmarker | null> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker | null> {
	if (landmarker) return landmarker;
	if (!boot) {
		boot = (async () => {
			try {
				const vision = await FilesetResolver.forVisionTasks(WASM);
				const opts = {
					baseOptions: { modelAssetPath: MODEL, delegate: "GPU" as const },
					runningMode: "VIDEO" as const,
					numFaces: 1,
				};
				try {
					landmarker = await FaceLandmarker.createFromOptions(vision, opts);
				} catch {
					landmarker = await FaceLandmarker.createFromOptions(vision, {
						...opts,
						baseOptions: { ...opts.baseOptions, delegate: "CPU" },
					});
				}
				return landmarker;
			} catch {
				return null;
			}
		})();
	}
	return boot;
}

export function detectFace(video: HTMLVideoElement, ts: number): FaceLandmarkerResult | null {
	if (!landmarker || video.readyState < 2) return null;
	try {
		return landmarker.detectForVideo(video, ts);
	} catch {
		return null;
	}
}

export function landmarksToPts(result: FaceLandmarkerResult | null, mirror: boolean): Pt[] | null {
	const raw = result?.faceLandmarks?.[0];
	if (!raw?.length) return null;
	return raw.map((p) => ({ x: mirror ? 1 - p.x : p.x, y: p.y }));
}

export function smoothPts(prev: Pt[] | null, next: Pt[], alpha = 0.26): Pt[] {
	if (!prev || prev.length !== next.length) return next;
	return next.map((p, i) => ({
		x: prev[i].x * (1 - alpha) + p.x * alpha,
		y: prev[i].y * (1 - alpha) + p.y * alpha,
	}));
}
