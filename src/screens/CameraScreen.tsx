import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { api, uploadMedia } from "../lib/api";
import {
	detectFace,
	drawCaptureFrame,
	getFaceLandmarker,
	GRADES,
	landmarksToPts,
	LENSES,
	smoothPts,
	type GradeId,
	type LensId,
	type Pt,
} from "../lib/faceTrack";
import type { Friend } from "../lib/types";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";

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

function recMime(): string | undefined {
	const opts = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
	return opts.find((t) => MediaRecorder.isTypeSupported(t));
}

export function CameraScreen({
	onOpenMemories,
}: {
	onOpenMemories: () => void;
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

	const facingRef = useRef(facing);
	const gradeRef = useRef(grade);
	const lensRef = useRef(lens);
	const camGen = useRef(0);
	const paintedRef = useRef(false);
	facingRef.current = facing;
	gradeRef.current = grade;
	lensRef.current = lens;

	const startCam = useCallback(async () => {
		const gen = ++camGen.current;
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
		paintedRef.current = false;
		setPainted(false);
		setCamState("ask");
		try {
			if (Capacitor.isNativePlatform()) {
				await Camera.requestPermissions({ permissions: ["camera"] });
			}
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: { ideal: facing },
					width: { ideal: 1080 },
					height: { ideal: 1440 },
				},
			});
			widenFov(stream);
			try {
				const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
				for (const track of mic.getAudioTracks()) stream.addTrack(track);
			} catch {
				/* still useful for photos */
			}
			if (gen !== camGen.current) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}
			streamRef.current = stream;
			const video = videoRef.current;
			if (video) {
				video.srcObject = stream;
				await video.play();
			}
			if (gen !== camGen.current) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}
			setCamState("live");
			void getFaceLandmarker();
		} catch (e) {
			const name = e instanceof DOMException ? e.name : "";
			setCamState(name === "NotFoundError" ? "missing" : "denied");
		}
	}, [facing]);

	useEffect(() => {
		if (capture) {
			streamRef.current?.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
			return;
		}
		void startCam();
		return () => streamRef.current?.getTracks().forEach((t) => t.stop());
	}, [startCam, capture]);

	useEffect(() => {
		if (capture || camState !== "live") return;
		let id = 0;
		let prev: Pt[] | null = null;
		let last = -1;
		const loop = (now: number) => {
			id = requestAnimationFrame(loop);
			const video = videoRef.current;
			const canvas = liveRef.current;
			if (!video || !canvas || video.readyState < 2) return;
			if (video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
			}
			if (!canvas.width) return;
			const ctx = canvas.getContext("2d", { alpha: false });
			if (!ctx) return;
			const mirror = facingRef.current === "user";
			if (now !== last) {
				last = now;
				const next = landmarksToPts(detectFace(video, now), mirror);
				prev = next ? smoothPts(prev, next) : null;
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
		return () => cancelAnimationFrame(id);
	}, [capture, camState]);

	function snapPhoto() {
		const canvas = liveRef.current;
		if (!canvas?.width) return;
		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				setCapture({ blob, url: URL.createObjectURL(blob), kind: "photo" });
			},
			"image/jpeg",
			0.92,
		);
	}

	function startRec() {
		const canvas = liveRef.current;
		const cam = streamRef.current;
		if (!canvas?.width || !cam || recRef.current) return;
		const drawn = canvas.captureStream(30);
		const mixed = new MediaStream([...drawn.getVideoTracks(), ...cam.getAudioTracks()]);
		chunksRef.current = [];
		const mime = recMime();
		const rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
		rec.ondataavailable = (e) => {
			if (e.data.size) chunksRef.current.push(e.data);
		};
		rec.onstop = () => {
			drawn.getVideoTracks().forEach((t) => t.stop());
			recRef.current = null;
			const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
			if (blob.size) setCapture({ blob, url: URL.createObjectURL(blob), kind: "video" });
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
		e.currentTarget.setPointerCapture(e.pointerId);
		shutterArmed.current = true;
		held.current = false;
		window.clearTimeout(holdTimer.current);
		holdTimer.current = window.setTimeout(() => {
			held.current = true;
			startRec();
		}, HOLD_MS);
	}

	function onShutterUp(e: PointerEvent<HTMLButtonElement>) {
		e.preventDefault();
		if (!shutterArmed.current) return;
		shutterArmed.current = false;
		window.clearTimeout(holdTimer.current);
		if (held.current) stopRec();
		else snapPhoto();
		held.current = false;
	}

	function onPointer(e: PointerEvent<HTMLCanvasElement>) {
		if (!pen || !drawRef.current) return;
		const canvas = drawRef.current;
		const ctx = canvas.getContext("2d");
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
			ctx.strokeStyle = "#ff6a1a";
			ctx.lineWidth = 6;
			ctx.lineCap = "round";
			ctx.lineTo(x, y);
			ctx.stroke();
		} else {
			setDrawing(false);
		}
	}

	async function openSend() {
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
		setCapture(null);
		setCaption("");
		setStickers([]);
		setPicked(new Set());
	}

	if (capture) {
		return (
			<div className="editor">
				{capture.kind === "video" ? (
					<video className="preview" src={capture.url} autoPlay loop muted playsInline />
				) : (
					<img src={capture.url} alt="" />
				)}
				<canvas
					ref={drawRef}
					className="draw-layer"
					width={720}
					height={1280}
					onPointerDown={onPointer}
					onPointerMove={onPointer}
					onPointerUp={onPointer}
					style={{ pointerEvents: pen ? "auto" : "none" }}
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
					<input className="caption" autoFocus placeholder="Tap to type" value={caption} onChange={(e) => setCaption(e.target.value)} />
				)}
				<div className="editor-top">
					<button className="icon-btn" onClick={() => { URL.revokeObjectURL(capture.url); setCapture(null); }}>
						<Icon name="close" />
					</button>
					<button className="icon-btn" onClick={() => setShowText((v) => !v)}><Icon name="text" /></button>
					<button className="icon-btn" onClick={() => setPen((v) => !v)}><Icon name="pen" color={pen ? "#ff6a1a" : "#fff"} /></button>
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
									{picked.has(f.id) ? <Icon name="check" color="#ff6a1a" /> : null}
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
		<div className="camera">
			<video
				ref={videoRef}
				className={`cam-src filter-${grade}`}
				playsInline
				muted
				autoPlay
				style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
			/>
			<canvas ref={liveRef} className="live" style={{ opacity: painted ? 1 : 0 }} />
			{blocked && (
				<div className="perm-card">
					<Icon name="cam" size={36} color="#ff6a1a" />
					<h2>{camState === "missing" ? "No camera found" : "Camera is blocked"}</h2>
					<p>
						{camState === "missing"
							? "PyreChat needs a camera on this device to capture."
							: "Allow the camera so Capture can open. Chrome will ask again when you tap below."}
					</p>
					<button className="primary" onClick={() => void startCam()}>Allow camera</button>
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
				<div className="cam-top">
					<div>
						<div className="eyebrow light">Capture</div>
						<div className="cam-hint">Tap for photo · hold for video</div>
					</div>
					<button className="icon-btn solid" onClick={onOpenMemories} aria-label="Library"><Icon name="mem" size={18} /></button>
				</div>
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
						<span className="dock-spacer" />
						<button
							className={`shutter ${recording ? "rec" : ""}`}
							aria-label={recording ? "Stop recording" : "Capture"}
							onPointerDown={onShutterDown}
							onPointerUp={onShutterUp}
							onPointerCancel={onShutterUp}
						/>
						<button
							className="tool"
							onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
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
