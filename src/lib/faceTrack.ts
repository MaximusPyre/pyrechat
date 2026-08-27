import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { EMBER, INK } from "./brand";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL =
	"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type Pt = { x: number; y: number };

export const LENSES = [
	{ id: "none", label: "Off" },
	{ id: "skull", label: "Skull" },
	{ id: "fire", label: "Fire" },
	{ id: "crown", label: "Crown" },
	{ id: "shade", label: "Shades" },
	{ id: "ember", label: "Ember" },
] as const;

export type LensId = (typeof LENSES)[number]["id"];

export const GRADES = [
	{ id: "none", label: "Original", filter: "none" },
	{ id: "ember", label: "Ember", filter: "saturate(1.35) sepia(0.22) hue-rotate(-8deg)" },
	{ id: "flame", label: "Flame", filter: "contrast(1.28) saturate(1.5) sepia(0.18)" },
	{ id: "ash", label: "Ash", filter: "grayscale(0.82) contrast(1.12)" },
	{ id: "night", label: "Night", filter: "brightness(0.88) saturate(0.75) hue-rotate(195deg)" },
	{ id: "ice", label: "Ice", filter: "hue-rotate(175deg) saturate(1.15) brightness(1.05)" },
] as const;

export type GradeId = (typeof GRADES)[number]["id"];

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
	if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
	else ctx.rect(x, y, w, h);
}

function at(pts: Pt[], i: number, w: number, h: number): Pt {
	const p = pts[i] ?? { x: 0.5, y: 0.5 };
	return { x: p.x * w, y: p.y * h };
}

function dist(a: Pt, b: Pt): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function gradeFilter(id: GradeId): string {
	return GRADES.find((g) => g.id === id)?.filter ?? "none";
}

/** Draw camera frame + face-locked overlays. Landmarks are normalized 0–1. */
export function drawCaptureFrame(
	ctx: CanvasRenderingContext2D,
	video: HTMLVideoElement,
	pts: Pt[] | null,
	opts: { mirror: boolean; grade: GradeId; lens: LensId },
): void {
	const w = ctx.canvas.width;
	const h = ctx.canvas.height;
	ctx.save();
	if (opts.mirror) {
		ctx.translate(w, 0);
		ctx.scale(-1, 1);
	}
	ctx.filter = gradeFilter(opts.grade);
	ctx.drawImage(video, 0, 0, w, h);
	ctx.filter = "none";
	ctx.restore();

	if (!pts || opts.lens === "none") return;
	drawLens(ctx, pts, w, h, opts.lens);
}

function drawLens(ctx: CanvasRenderingContext2D, pts: Pt[], w: number, h: number, lens: LensId): void {
	const forehead = at(pts, 10, w, h);
	const chin = at(pts, 152, w, h);
	const leftEye = at(pts, 33, w, h);
	const rightEye = at(pts, 263, w, h);
	const nose = at(pts, 1, w, h);
	const leftCheek = at(pts, 234, w, h);
	const rightCheek = at(pts, 454, w, h);
	const faceH = Math.max(80, dist(forehead, chin));
	const eyeSpan = Math.max(40, dist(leftEye, rightEye));

	ctx.save();
	ctx.lineJoin = "round";
	ctx.lineCap = "round";

	if (lens === "skull") {
		const cx = (leftEye.x + rightEye.x) / 2;
		const cy = (forehead.y + chin.y) / 2 - faceH * 0.04;
		const rx = eyeSpan * 0.95;
		const ry = faceH * 0.42;
		const bone = ctx.createRadialGradient(cx, cy - ry * 0.2, 8, cx, cy, rx);
		bone.addColorStop(0, "#f4f0e6");
		bone.addColorStop(1, "#b9b0a4");
		ctx.fillStyle = bone;
		ctx.beginPath();
		ctx.ellipse(cx, cy - ry * 0.08, rx, ry, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = INK;
		ctx.beginPath();
		ctx.ellipse(leftEye.x, leftEye.y, eyeSpan * 0.18, eyeSpan * 0.22, 0, 0, Math.PI * 2);
		ctx.ellipse(rightEye.x, rightEye.y, eyeSpan * 0.18, eyeSpan * 0.22, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = EMBER;
		ctx.beginPath();
		ctx.ellipse(leftEye.x, leftEye.y, eyeSpan * 0.05, eyeSpan * 0.06, 0, 0, Math.PI * 2);
		ctx.ellipse(rightEye.x, rightEye.y, eyeSpan * 0.05, eyeSpan * 0.06, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "#2a2420";
		ctx.lineWidth = Math.max(2.2, faceH * 0.016);
		ctx.beginPath();
		ctx.moveTo(cx, nose.y - 4);
		ctx.lineTo(cx, nose.y + faceH * 0.08);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(cx, chin.y - faceH * 0.18, rx * 0.42, 0.12 * Math.PI, 0.88 * Math.PI);
		ctx.stroke();
		for (let i = -2; i <= 2; i++) {
			ctx.beginPath();
			ctx.moveTo(cx + i * rx * 0.12, chin.y - faceH * 0.2);
			ctx.lineTo(cx + i * rx * 0.12, chin.y - faceH * 0.12);
			ctx.stroke();
		}
	}

	if (lens === "fire") {
		const tnow = performance.now();
		for (let i = 0; i < 9; i++) {
			const t = (i - 4) / 4;
			const flicker = 0.55 + Math.sin(tnow / 90 + i * 1.3) * 0.45;
			const x = forehead.x + t * eyeSpan * 0.62;
			const y = forehead.y - faceH * 0.02;
			const hh = faceH * (0.14 + Math.abs(Math.sin(tnow / 140 + i)) * 0.16) * flicker;
			ctx.fillStyle = i % 2 ? EMBER : "#ff7a2a";
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x - 12 * flicker, y - hh * 0.5, x + Math.sin(tnow / 80 + i) * 6, y - hh);
			ctx.quadraticCurveTo(x + 12 * flicker, y - hh * 0.5, x, y);
			ctx.fill();
		}
		ctx.fillStyle = "#ffe08a";
		ctx.beginPath();
		ctx.moveTo(forehead.x, forehead.y);
		ctx.quadraticCurveTo(forehead.x - 8, forehead.y - faceH * 0.16, forehead.x, forehead.y - faceH * 0.28);
		ctx.quadraticCurveTo(forehead.x + 8, forehead.y - faceH * 0.16, forehead.x, forehead.y);
		ctx.fill();
	}

	if (lens === "crown") {
		const y = forehead.y - faceH * 0.12;
		const x0 = forehead.x - eyeSpan * 0.7;
		const x1 = forehead.x + eyeSpan * 0.7;
		ctx.fillStyle = EMBER;
		ctx.strokeStyle = "#ffd27a";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x0, y + 18);
		ctx.lineTo(x0, y);
		ctx.lineTo(x0 + (x1 - x0) * 0.2, y + 14);
		ctx.lineTo(forehead.x, y - 16);
		ctx.lineTo(x0 + (x1 - x0) * 0.8, y + 14);
		ctx.lineTo(x1, y);
		ctx.lineTo(x1, y + 18);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	if (lens === "shade") {
		const r = eyeSpan * 0.28;
		ctx.fillStyle = "#0b0b0c";
		ctx.strokeStyle = "#f2e6c9";
		ctx.lineWidth = Math.max(2, faceH * 0.012);
		ctx.beginPath();
		roundRect(ctx, leftEye.x - r, leftEye.y - r * 0.55, r * 1.9, r * 1.15, r * 0.35);
		roundRect(ctx, rightEye.x - r * 0.9, rightEye.y - r * 0.55, r * 1.9, r * 1.15, r * 0.35);
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(leftEye.x + r * 0.95, (leftEye.y + rightEye.y) / 2);
		ctx.lineTo(rightEye.x - r * 0.95, (leftEye.y + rightEye.y) / 2);
		ctx.stroke();
		ctx.fillStyle = "#ffffff33";
		ctx.beginPath();
		ctx.ellipse(leftEye.x - r * 0.15, leftEye.y - r * 0.12, r * 0.35, r * 0.12, -0.4, 0, Math.PI * 2);
		ctx.fill();
	}

	if (lens === "ember") {
		const glow = ctx.createRadialGradient(leftCheek.x, leftCheek.y, 4, leftCheek.x, leftCheek.y, faceH * 0.22);
		glow.addColorStop(0, `${EMBER}88`);
		glow.addColorStop(1, `${EMBER}00`);
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(leftCheek.x, leftCheek.y, faceH * 0.22, 0, Math.PI * 2);
		ctx.fill();
		const glow2 = ctx.createRadialGradient(rightCheek.x, rightCheek.y, 4, rightCheek.x, rightCheek.y, faceH * 0.22);
		glow2.addColorStop(0, `${EMBER}88`);
		glow2.addColorStop(1, `${EMBER}00`);
		ctx.fillStyle = glow2;
		ctx.beginPath();
		ctx.arc(rightCheek.x, rightCheek.y, faceH * 0.22, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.restore();
}
