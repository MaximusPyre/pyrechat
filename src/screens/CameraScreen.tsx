import { useCallback, useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { api, uploadMedia } from "../lib/api";
import { EMBER, TEAL } from "../lib/brand";
import { drawCaptureFrame, drawVideoFrame, GRADES, LENSES, type GradeId, type LensId, type Pt } from "../lib/lenses";
import { PLAY_PRE_REG_URL } from "../lib/play";
import type { Friend } from "../lib/types";
import { FlameLogo } from "../components/Flame";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";

const LIVE_MAX = 720;

const STICKERS = ["🔥", "☠", "💀", "🧡", "⚡", "😈", "🖤", "✨", "😂", "💋"];
const HOLD_MS = 220;
const LENS_ICON: Record<LensId, string> = {
	none: "off",
	skull: "skull",
	fire: "fire",
	crown: "crown",
	shade: "shades",
	ember: "ember",
};

type Capture = { blob: Blob; url: string; kind: "photo" | "video" };
type CamState = "off" | "ask" | "live" | "denied" | "missing";

function widenFov(stream: MediaStream): void {
	const track = stream.getVideoTracks()[0];
	if (!track?.getCapabilities) return;
	const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
	if (typeof caps.zoom?.min === "number") {
		void track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] } as unknown as MediaTrackConstraints);
	}
}

function sizeOverlay(canvas: HTMLCanvasElement, vw: number, vh: number, max = LIVE_MAX): boolean {
	const scale = Math.min(1, max / Math.max(vw, vh));
	const w = Math.max(2, Math.round((vw * scale) / 2) * 2);
	const h = Math.max(2, Math.round((vh * scale) / 2) * 2);
	if (canvas.width === w && canvas.height === h) return false;
	canvas.width = w;
	canvas.height = h;
	return true;
}

function recMime(): string | undefined {
	const opts = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
	return opts.find((t) => MediaRecorder.isTypeSupported(t));
}

let nativeCamPermAsked = false;

function stopTracks(stream: MediaStream | null): void {
	if (!stream) return;
	for (const track of stream.getTracks()) {
		track.stop();
		stream.removeTrack(track);
	}
}

function dropAudio(stream: MediaStream | null): void {
	if (!stream) return;
	for (const track of stream.getAudioTracks()) {
		track.stop();
		stream.removeTrack(track);
	}
}

function bindPreview(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
	video.muted = true;
	video.defaultMuted = true;
	video.volume = 0;
	video.playsInline = true;
	video.setAttribute("playsinline", "true");
	video.setAttribute("webkit-playsinline", "true");
	video.srcObject = stream;
	return video.play().then(
		() => undefined,
		() => undefined,
	);
}

function useAppVisible(): boolean {
	const [visible, setVisible] = useState(() => document.visibilityState === "visible");
	useEffect(() => {
		let appActive = true;
		const sync = () => {
			setVisible(appActive && document.visibilityState === "visible");
		};
		const onHide = () => {
			appActive = false;
			setVisible(false);
		};
		const onShow = () => {
			appActive = true;
			sync();
		};
		document.addEventListener("visibilitychange", sync);
		window.addEventListener("pagehide", onHide);
		window.addEventListener("pageshow", onShow);
		let remove: (() => void) | undefined;
		void import("@capacitor/app")
			.then(({ App }) =>
				App.addListener("appStateChange", ({ isActive }) => {
					appActive = isActive;
					sync();
				}),
			)
			.then((handle) => {
				remove = () => {
					void handle.remove();
				};
			})
			.catch(() => undefined);
		return () => {
			document.removeEventListener("visibilitychange", sync);
			window.removeEventListener("pagehide", onHide);
			window.removeEventListener("pageshow", onShow);
			remove?.();
		};
	}, []);
	return visible;
}

function revokePreview(url: string): void {
	if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function blobToPreviewUrl(blob: Blob): Promise<string> {
	if (!Capacitor.isNativePlatform()) return Promise.resolve(URL.createObjectURL(blob));
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function dataUrlToBlob(url: string, type: string): Blob {
	const bin = atob((url.split(",")[1] || ""));
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type });
}

async function canvasToJpeg(src: HTMLCanvasElement): Promise<{ blob: Blob; url: string } | null> {
	if (!src.width || !src.height) return null;
	const off = document.createElement("canvas");
	off.width = src.width;
	off.height = src.height;
	const ctx = off.getContext("2d", { alpha: false, willReadFrequently: true });
	if (!ctx) return null;
	ctx.drawImage(src, 0, 0);
	const blob = await new Promise<Blob | null>((res) => off.toBlob(res, "image/jpeg", 0.92));
	if (blob && blob.size > 64) {
		return { blob, url: await blobToPreviewUrl(blob) };
	}
	const url = off.toDataURL("image/jpeg", 0.92);
	return { blob: dataUrlToBlob(url, "image/jpeg"), url };
}

export function CameraScreen({
	onOpenMemories,
	onClose,
	onNeedAccount,
	active = true,
	demo = false,
}: {
	onOpenMemories: () => void;
	onClose?: () => void;
	onNeedAccount?: () => void;
	active?: boolean;
	demo?: boolean;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const liveRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const recRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const drawRef = useRef<HTMLCanvasElement>(null);
	const holdTimer = useRef(0);
	const held = useRef(false);
	const shutterArmed = useRef(false);
	const [facing, setFacing] = useState<"user" | "environment">("user");
	const [grade, setGrade] = useState<GradeId>("none");
	const [lens, setLens] = useState<LensId>("none");
	const [camState, setCamState] = useState<CamState>("off");
	const [painted, setPainted] = useState(false);
	const [recording, setRecording] = useState(false);
	const [torch, setTorch] = useState(false);
	const [capture, setCapture] = useState<Capture | null>(null);
	const [caption, setCaption] = useState("");
	const [drawing, setDrawing] = useState(false);
	const [pen, setPen] = useState(false);
	const [showText, setShowText] = useState(false);
	const [stickers, setStickers] = useState<{ id: string; ch: string; x: number; y: number }[]>([]);
	const [timer, setTimer] = useState(5);
	const [sendOpen, setSendOpen] = useState(false);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [picked, setPicked] = useState<Set<string>>(new Set());
	const [hasInk, setHasInk] = useState(false);

	const facingRef = useRef(facing);
	const gradeRef = useRef(grade);
	const lensRef = useRef(lens);
	const camGen = useRef(0);
	const paintedRef = useRef(false);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	const lastTap = useRef(0);
	const pinchStart = useRef(0);
	const zoomRef = useRef(1);
	const bootDelay = useRef(true);
	const foreground = useAppVisible();
	facingRef.current = facing;
	gradeRef.current = grade;
	lensRef.current = lens;

	const killStream = useCallback(() => {
		camGen.current += 1;
		window.clearTimeout(holdTimer.current);
		holdTimer.current = 0;
		shutterArmed.current = false;
		held.current = false;
		if (recRef.current) {
			try {
				if (recRef.current.state === "recording") recRef.current.stop();
			} catch {
				/* already stopped */
			}
			recRef.current = null;
		}
		stopTracks(streamRef.current);
		streamRef.current = null;
		const video = videoRef.current;
		if (video) video.srcObject = null;
		setRecording(false);
	}, []);

	const startCam = useCallback(async () => {
		const gen = ++camGen.current;
		stopTracks(streamRef.current);
		streamRef.current = null;
		paintedRef.current = false;
		setPainted(false);
		setCamState("ask");
		try {
			if (Capacitor.isNativePlatform() && !nativeCamPermAsked) {
				nativeCamPermAsked = true;
				await Camera.requestPermissions({ permissions: ["camera"] });
			}
			if (gen !== camGen.current) return;
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: { ideal: facing },
					width: { ideal: 720 },
					height: { ideal: 1280 },
					frameRate: { ideal: 30, max: 30 },
				},
			});
			widenFov(stream);
			zoomRef.current = 1;
			if (gen !== camGen.current) {
				stopTracks(stream);
				return;
			}
			streamRef.current = stream;
			try {
				const video = videoRef.current;
				if (video) await bindPreview(video, stream);
			} catch {
				if (gen !== camGen.current) {
					stopTracks(stream);
					streamRef.current = null;
					return;
				}
				stopTracks(stream);
				streamRef.current = null;
				setCamState("denied");
				return;
			}
			if (gen !== camGen.current) {
				stopTracks(stream);
				streamRef.current = null;
				return;
			}
			setCamState("live");
		} catch (e) {
			if (gen !== camGen.current) return;
			const name = e instanceof DOMException ? e.name : "";
			setCamState(name === "NotFoundError" ? "missing" : "denied");
		}
	}, [facing]);

	useEffect(() => {
		if (!active || !foreground || capture) {
			killStream();
			if (!active || !foreground) setCamState("off");
			return;
		}
		let timer = 0;
		if (bootDelay.current) {
			bootDelay.current = false;
			setCamState("ask");
			timer = window.setTimeout(() => void startCam(), 240);
		} else {
			void startCam();
		}
		return () => {
			window.clearTimeout(timer);
			killStream();
		};
	}, [startCam, capture, active, foreground, killStream]);

	useEffect(() => {
		if (lens === "none" || capture || camState !== "live") {
			ctxRef.current = null;
			paintedRef.current = false;
			setPainted(false);
			return;
		}
		let id = 0;
		let cancelled = false;
		let prev: Pt[] | null = null;
		let tick = 0;
		void import("../lib/faceTrack").then(async (ft) => {
			if (cancelled) return;
			await ft.getFaceLandmarker();
			if (cancelled) return;
			const loop = (now: number) => {
				if (cancelled) return;
				id = requestAnimationFrame(loop);
				const video = videoRef.current;
				const canvas = liveRef.current;
				if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
				if (sizeOverlay(canvas, video.videoWidth, video.videoHeight)) ctxRef.current = null;
				let ctx = ctxRef.current;
				if (!ctx) {
					ctx = canvas.getContext("2d", { alpha: false });
					ctxRef.current = ctx;
				}
				if (!ctx) return;
				const mirror = facingRef.current === "user";
				tick += 1;
				if (tick % 2 === 0) {
					const next = ft.landmarksToPts(ft.detectFace(video, now), mirror);
					prev = next ? ft.smoothPts(prev, next) : null;
				}
				drawCaptureFrame(ctx, video, prev, {
					mirror,
					grade: gradeRef.current,
					lens: lensRef.current,
				});
				if (!paintedRef.current) {
					paintedRef.current = true;
					setPainted(true);
				}
			};
			id = requestAnimationFrame(loop);
		}).catch(() => undefined);
		return () => {
			cancelled = true;
			cancelAnimationFrame(id);
		};
	}, [capture, camState, lens]);

	useEffect(() => {
		const canvas = drawRef.current;
		if (!canvas || !capture) return;
		const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
		if (ctx && !hasInk) ctx.clearRect(0, 0, canvas.width, canvas.height);
	}, [capture, hasInk, pen]);

	function buzz(ms = 12): void {
		try {
			navigator.vibrate(ms);
		} catch {
			/* web vibrate optional */
		}
		void import("@capacitor/haptics")
			.then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
			.catch(() => undefined);
	}

	async function ensureMic(): Promise<void> {
		const cam = streamRef.current;
		if (!cam || cam.getAudioTracks().length) return;
		const gen = camGen.current;
		try {
			const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
			if (gen !== camGen.current || streamRef.current !== cam) {
				stopTracks(mic);
				return;
			}
			for (const track of mic.getAudioTracks()) cam.addTrack(track);
		} catch {
			/* video-only still records */
		}
	}

	function applyZoom(z: number): void {
		const track = streamRef.current?.getVideoTracks()[0];
		if (!track?.getCapabilities) return;
		const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
		if (typeof caps.zoom?.min !== "number" || typeof caps.zoom.max !== "number") return;
		const next = Math.min(caps.zoom.max, Math.max(caps.zoom.min, z));
		zoomRef.current = next;
		void track.applyConstraints({ advanced: [{ zoom: next }] } as unknown as MediaTrackConstraints);
	}

	function flipCam(): void {
		setTorch(false);
		setFacing((f) => (f === "user" ? "environment" : "user"));
		buzz(8);
	}

	async function toggleTorch(): Promise<void> {
		const track = streamRef.current?.getVideoTracks()[0];
		if (!track?.getCapabilities) return;
		const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
		if (!caps.torch) return;
		const next = !torch;
		try {
			await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
			setTorch(next);
		} catch {
			setTorch(false);
		}
	}

	function onViewTap(e: PointerEvent<HTMLDivElement>): void {
		if ((e.target as HTMLElement).closest("button, input, textarea")) return;
		const now = Date.now();
		if (now - lastTap.current < 280) {
			lastTap.current = 0;
			flipCam();
		} else lastTap.current = now;
	}

	function pinchDistance(e: TouchEvent): number {
		if (e.touches.length < 2) return 0;
		return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
	}

	function composeShot(): HTMLCanvasElement | null {
		const video = videoRef.current;
		const live = liveRef.current;
		if (lensRef.current !== "none" && live?.width) return live;
		if (!video?.videoWidth) return null;
		const off = document.createElement("canvas");
		const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
		off.width = Math.max(2, Math.round(video.videoWidth * scale));
		off.height = Math.max(2, Math.round(video.videoHeight * scale));
		const ctx = off.getContext("2d", { alpha: false });
		if (!ctx) return null;
		drawVideoFrame(ctx, video, { mirror: facingRef.current === "user", grade: gradeRef.current });
		return off;
	}

	async function snapPhoto() {
		const src = composeShot();
		if (!src) return;
		buzz(18);
		const shot = await canvasToJpeg(src);
		if (!shot) return;
		setHasInk(false);
		setPen(false);
		setCapture({ blob: shot.blob, url: shot.url, kind: "photo" });
	}

	async function startRec() {
		const cam = streamRef.current;
		if (!active || !cam || recRef.current) return;
		const gen = camGen.current;
		await ensureMic();
		if (gen !== camGen.current || streamRef.current !== cam || recRef.current) return;
		buzz(20);
		const live = liveRef.current;
		const lensOn = lensRef.current !== "none" && Boolean(live?.width);
		const overlay = lensOn && live ? live.captureStream(24) : null;
		const videoTracks = overlay ? overlay.getVideoTracks() : cam.getVideoTracks();
		const mixed = new MediaStream([...videoTracks, ...cam.getAudioTracks()]);
		chunksRef.current = [];
		const mime = recMime();
		const rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
		rec.ondataavailable = (e) => {
			if (e.data.size) chunksRef.current.push(e.data);
		};
		rec.onstop = () => {
			overlay?.getVideoTracks().forEach((t) => t.stop());
			recRef.current = null;
			dropAudio(streamRef.current);
			const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
			if (!blob.size) return;
			void blobToPreviewUrl(blob).then((url) => {
				setHasInk(false);
				setPen(false);
				setCapture({ blob, url, kind: "video" });
			});
		};
		rec.start();
		recRef.current = rec;
		setRecording(true);
	}

	function stopRec() {
		if (recRef.current?.state === "recording") recRef.current.stop();
		setRecording(false);
	}

	function onShutterDown(e: PointerEvent<HTMLButtonElement>) {
		e.preventDefault();
		if (!active) return;
		e.currentTarget.setPointerCapture(e.pointerId);
		shutterArmed.current = true;
		held.current = false;
		window.clearTimeout(holdTimer.current);
		holdTimer.current = window.setTimeout(() => {
			held.current = true;
			void startRec();
		}, HOLD_MS);
	}

	function endShutter(e: PointerEvent<HTMLButtonElement>, take: boolean) {
		e.preventDefault();
		if (!shutterArmed.current) return;
		shutterArmed.current = false;
		window.clearTimeout(holdTimer.current);
		if (held.current) stopRec();
		else if (take) void snapPhoto();
		held.current = false;
	}

	function onPointer(e: PointerEvent<HTMLCanvasElement>) {
		if (!pen || !drawRef.current) return;
		const canvas = drawRef.current;
		const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
		if (!ctx) return;
		const r = canvas.getBoundingClientRect();
		const x = ((e.clientX - r.left) / r.width) * canvas.width;
		const y = ((e.clientY - r.top) / r.height) * canvas.height;
		if (e.type === "pointerdown") {
			setDrawing(true);
			ctx.beginPath();
			ctx.moveTo(x, y);
			canvas.setPointerCapture(e.pointerId);
		} else if (e.type === "pointermove" && drawing) {
			ctx.strokeStyle = EMBER;
			ctx.lineWidth = 6;
			ctx.lineCap = "round";
			ctx.lineTo(x, y);
			ctx.stroke();
			setHasInk(true);
		} else {
			setDrawing(false);
		}
	}

	async function openSend() {
		if (demo) {
			onNeedAccount?.();
			return;
		}
		const data = await api<{ friends: Friend[] }>("/api/friends");
		setFriends(data.friends.filter((f) => f.status === "accepted"));
		setSendOpen(true);
	}

	async function send(opts: { story?: boolean; spotlight?: boolean; memory?: boolean }) {
		if (!capture) return;
		const { key } = await uploadMedia(capture.blob);
		const overlay = { caption, stickers, filter: grade, lens, timer };
		if (picked.size) {
			await api("/api/snaps", {
				method: "POST",
				body: JSON.stringify({
					mediaKey: key,
					kind: capture.kind,
					durationSec: timer,
					caption,
					overlay,
					recipientIds: [...picked],
					saveMemory: opts.memory,
				}),
			});
		}
		if (opts.story) {
			await api("/api/stories", {
				method: "POST",
				body: JSON.stringify({ mediaKey: key, kind: capture.kind, caption, overlay, saveMemory: opts.memory }),
			});
		}
		if (opts.spotlight) {
			await api("/api/spotlight", { method: "POST", body: JSON.stringify({ mediaKey: key, caption }) });
		}
		if (opts.memory && !picked.size && !opts.story) {
			await api("/api/memories", { method: "POST", body: JSON.stringify({ mediaKey: key, kind: capture.kind, caption }) });
		}
		setSendOpen(false);
		revokePreview(capture.url);
		setCapture(null);
		setCaption("");
		setStickers([]);
		setPicked(new Set());
		setHasInk(false);
		setPen(false);
	}

	if (capture) {
		return (
			<div className="editor no-swipe">
				{capture.kind === "video" ? (
					<video
						className="preview"
						src={capture.url}
						autoPlay
						loop
						muted
						playsInline
						{...{ "webkit-playsinline": "true" }}
						onLoadedMetadata={(e) => {
							void e.currentTarget.play().catch(() => undefined);
						}}
					/>
				) : (
					<img src={capture.url} alt="" draggable={false} />
				)}
				<canvas
					ref={drawRef}
					className="draw-layer"
					width={720}
					height={1280}
					onPointerDown={onPointer}
					onPointerMove={onPointer}
					onPointerUp={onPointer}
					style={{
						pointerEvents: pen ? "auto" : "none",
						visibility: pen || hasInk ? "visible" : "hidden",
						background: "transparent",
					}}
				/>
				{stickers.map((s) => (
					<button
						key={s.id}
						style={{ position: "absolute", left: s.x, top: s.y, fontSize: 36 }}
						onPointerDown={(e) => {
							const startX = e.clientX - s.x;
							const startY = e.clientY - s.y;
							const move = (ev: globalThis.PointerEvent) => {
								setStickers((all) => all.map((x) => (x.id === s.id ? { ...x, x: ev.clientX - startX, y: ev.clientY - startY } : x)));
							};
							const up = () => {
								window.removeEventListener("pointermove", move);
								window.removeEventListener("pointerup", up);
							};
							window.addEventListener("pointermove", move);
							window.addEventListener("pointerup", up);
						}}
					>
						{s.ch}
					</button>
				))}
				{showText && (
					<input
						className="caption"
						autoFocus
						placeholder="Tap to type"
						value={caption}
						onChange={(e) => setCaption(e.target.value)}
						autoComplete="off"
						autoCorrect="on"
						autoCapitalize="sentences"
						spellCheck
						enterKeyHint="done"
						inputMode="text"
						data-lpignore="true"
						data-1p-ignore="true"
						data-form-type="other"
					/>
				)}
				<div className="editor-top">
					<button className="icon-btn" onClick={() => { revokePreview(capture.url); setCapture(null); setHasInk(false); setPen(false); }}>
						<Icon name="close" />
					</button>
					<button className="icon-btn" onClick={() => setShowText((v) => !v)}><Icon name="text" /></button>
					<button className="icon-btn" onClick={() => setPen((v) => !v)}><Icon name="pen" color={pen ? EMBER : "#fff"} /></button>
					<button className="icon-btn" onClick={() => setTimer((t) => (t >= 10 ? 1 : t + 1))}><Icon name="timer" /></button>
					<button className="icon-btn" onClick={() => {
						const a = document.createElement("a");
						a.href = capture.url;
						a.download = `pyre.${capture.kind === "video" ? "webm" : "jpg"}`;
						a.click();
					}}><Icon name="download" /></button>
				</div>
				<div className="lenses" style={{ bottom: 96 }}>
					{STICKERS.map((ch) => (
						<button key={ch} className="lens" onClick={() => setStickers((s) => [...s, { id: crypto.randomUUID(), ch, x: 140, y: 280 }])}>{ch}</button>
					))}
				</div>
				<div className="editor-bot">
					<span className="pill">{timer}s</span>
					<button className="send-fab" onClick={() => void openSend()}><Icon name="send" color="#fff" /></button>
				</div>
				{sendOpen && (
					<div className="sheet" onClick={() => setSendOpen(false)}>
						<div className="sheet-card" onClick={(e) => e.stopPropagation()}>
							<div className="sheet-title">Send Pyre</div>
							{friends.map((f) => (
								<button key={f.id} className="row" onClick={() => {
									setPicked((p) => {
										const n = new Set(p);
										if (n.has(f.id)) n.delete(f.id);
										else n.add(f.id);
										return n;
									});
								}}>
									<SkullmojiAvatar value={f.skullmoji} />
									<div className="row-body"><div className="row-title">{f.display_name}</div></div>
									{picked.has(f.id) ? <Icon name="check" color={TEAL} /> : null}
								</button>
							))}
							<div style={{ display: "flex", gap: 8, padding: 12, flexWrap: "wrap" }}>
								<button className="pill" onClick={() => void send({ story: true })}>My Story</button>
								<button className="pill" onClick={() => void send({ spotlight: true })}>Spotlight</button>
								<button className="pill" onClick={() => void send({ memory: true })}>Memories</button>
								<button className="primary" style={{ width: "auto", padding: "0 20px" }} onClick={() => void send({ memory: true })}>
									Send {picked.size ? `(${picked.size})` : ""}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	}

	const blocked = camState === "denied" || camState === "missing";

	return (
		<div
			className={`camera ${demo ? "demo" : ""} ${lens !== "none" && painted ? "lensed" : ""}`}
			onPointerDown={onViewTap}
			onTouchStart={(e) => {
				if (e.touches.length === 2) pinchStart.current = pinchDistance(e) / Math.max(0.01, zoomRef.current);
			}}
			onTouchMove={(e) => {
				if (e.touches.length < 2 || !pinchStart.current) return;
				e.preventDefault();
				applyZoom(pinchDistance(e) / pinchStart.current);
			}}
			onTouchEnd={(e) => {
				if (e.touches.length < 2) pinchStart.current = 0;
			}}
		>
			<video
				ref={videoRef}
				className={`cam-src filter-${grade}`}
				playsInline
				muted
				autoPlay
				style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
			/>
			<canvas ref={liveRef} className="live" />
			{blocked && (
				<div className="perm-card">
					<FlameLogo size={72} />
					<h2>{camState === "missing" ? "Open this on your phone" : "Camera is blocked"}</h2>
					<p>
						{camState === "missing"
							? "This computer has no camera. Capture lives on the phone — pre-register so PyreChat is ready when we launch."
							: "Allow the camera so Capture can open. Chrome will ask again when you tap below."}
					</p>
					{camState === "missing" ? (
						<a className="primary" href={PLAY_PRE_REG_URL} target="_blank" rel="noreferrer">
							Get the app
						</a>
					) : (
						<button className="primary" onClick={() => void startCam()}>Allow camera</button>
					)}
				</div>
			)}
			{camState === "ask" && (
				<div className="perm-card dim">
					<div className="eyebrow light">Capture</div>
					<p>Opening camera…</p>
					<button className="primary" onClick={() => void startCam()}>Allow camera</button>
				</div>
			)}
			<div className="cam-ui">
				{!demo && (
				<div className="cam-top">
					{onClose ? (
						<button className="icon-btn solid" onClick={onClose} aria-label="Close camera">
							<Icon name="close" size={18} />
						</button>
					) : (
						<div>
							<div className="eyebrow light">Capture</div>
							<div className="cam-hint">Tap for photo · hold for video</div>
						</div>
					)}
					<button className="icon-btn solid" onClick={onOpenMemories} aria-label="Library"><Icon name="mem" size={18} /></button>
				</div>
				)}
				<div className="cam-dock">
					<div className="lens-row">
						{LENSES.map((l) => (
							<button
								key={l.id}
								className={`lens-pick ${lens === l.id ? "on" : ""}`}
								onClick={() => setLens(l.id)}
							>
								<span className="lens-ico"><Icon name={LENS_ICON[l.id]} size={16} color={lens === l.id ? "#fff" : "#f4f4f5"} /></span>
								{l.label}
							</button>
						))}
					</div>
					<div className="filter-row">
						{GRADES.map((g) => (
							<button key={g.id} className={`chip quiet ${grade === g.id ? "on" : ""}`} onClick={() => setGrade(g.id)}>{g.label}</button>
						))}
					</div>
					<div className="shutter-row">
						{facing === "environment" ? (
							<button className={`tool ${torch ? "on" : ""}`} onClick={() => void toggleTorch()} aria-label="Flash">
								<Icon name="ember" size={18} color={torch ? "#fff" : undefined} />
							</button>
						) : (
							<span className="dock-spacer" />
						)}
						<button
							className={`shutter ${recording ? "rec" : ""}`}
							aria-label={recording ? "Stop recording" : "Capture"}
							onPointerDown={onShutterDown}
							onPointerUp={(e) => endShutter(e, true)}
							onPointerCancel={(e) => endShutter(e, false)}
							onLostPointerCapture={(e) => endShutter(e, false)}
						/>
						<button
							className="tool"
							onClick={flipCam}
							title="Flip camera"
							aria-label="Flip camera"
						>
							<Icon name="flip" size={18} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
