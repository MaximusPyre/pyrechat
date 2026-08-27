import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { ApiError, api, apiOrigin, uploadTicketFile } from "../lib/api";
import type { Ticket } from "../lib/types";
import { Icon } from "../components/Icon";

const STATUS: Record<Ticket["status"], string> = {
	queued: "In queue",
	working: "Bot is on it",
	shipped: "Shipped",
	skipped: "Skipped",
	failed: "Failed",
};

const IMAGE_ACCEPT = "image/*";
const FILE_ACCEPT = "image/*,.pdf,.txt,.csv,.json,.zip,.mp4,.webm,.mp3,.m4a,application/pdf,text/plain";
const MAX_FILES = 5;

type Draft = {
	id: string;
	file: File;
	preview: string | null;
	broken?: boolean;
};

function fileUrl(path: string): string {
	return `${apiOrigin()}${path}`;
}

function canPreviewImage(file: File): boolean {
	const t = `${file.type} ${file.name}`.toLowerCase();
	if (/heic|heif/.test(t)) return false;
	return file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
}

async function nativeGalleryFiles(limit: number): Promise<File[] | "cancel" | null> {
	if (!Capacitor.isNativePlatform() || limit <= 0) return null;
	try {
		const picked = await Camera.pickImages({ quality: 88, limit });
		const out: File[] = [];
		for (const photo of picked.photos) {
			const src = photo.webPath;
			if (!src) continue;
			const res = await fetch(src);
			const blob = await res.blob();
			if (!blob.size) continue;
			const ext = (photo.format || "jpeg").replace("jpeg", "jpg");
			const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : `image/${ext === "jpg" ? "jpeg" : ext}`;
			out.push(new File([blob], `photo-${Date.now()}-${out.length}.${ext}`, { type }));
		}
		return out;
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/cancel/i.test(msg)) return "cancel";
		return null;
	}
}

export function TicketsScreen({ founder, onBack }: { founder?: boolean; onBack: () => void }) {
	const [kind, setKind] = useState<Ticket["kind"]>("bug");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [items, setItems] = useState<Ticket[]>([]);
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);
	const [closed, setClosed] = useState(false);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const photoRef = useRef<HTMLInputElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const load = useCallback(async () => {
		try {
			const r = await api<{ tickets: Ticket[] }>("/api/tickets");
			setItems(r.tickets);
			setClosed(false);
		} catch (e) {
			if (e instanceof ApiError && e.status === 404) setClosed(true);
			else setMsg(e instanceof Error ? e.message : "Could not load tickets");
		}
	}, []);

	const draftsRef = useRef(drafts);
	draftsRef.current = drafts;

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		return () => {
			for (const d of draftsRef.current) if (d.preview) URL.revokeObjectURL(d.preview);
		};
	}, []);

	function addFiles(list: FileList | File[] | null) {
		if (!list || (list as FileList | File[]).length === 0) {
			setMsg("Could not read that file. Try Photos or Files again.");
			return;
		}
		const files = Array.isArray(list) ? list : Array.from(list);
		if (!files.length) {
			setMsg("Could not read that file. Try Photos or Files again.");
			return;
		}
		setDrafts((cur) => {
			const next = [...cur];
			for (const raw of files) {
				if (next.length >= MAX_FILES) break;
				const file = raw.name ? raw : new File([raw], `photo-${Date.now()}.jpg`, { type: raw.type || "image/jpeg" });
				if (next.some((d) => d.file.name === file.name && d.file.size === file.size)) continue;
				next.push({
					id: crypto.randomUUID(),
					file,
					preview: canPreviewImage(file) ? URL.createObjectURL(file) : null,
				});
			}
			return next.slice(0, MAX_FILES);
		});
	}

	async function pickPhotos() {
		const room = MAX_FILES - drafts.length;
		const native = await nativeGalleryFiles(room);
		if (native === "cancel") return;
		if (native) {
			if (native.length) addFiles(native);
			return;
		}
		photoRef.current?.click();
	}

	function removeDraft(id: string) {
		setDrafts((cur) => {
			const hit = cur.find((d) => d.id === id);
			if (hit?.preview) URL.revokeObjectURL(hit.preview);
			return cur.filter((d) => d.id !== id);
		});
	}

	async function submit() {
		setMsg("");
		setBusy(true);
		try {
			const attachmentIds: string[] = [];
			for (const d of drafts) {
				const up = await uploadTicketFile(d.file);
				attachmentIds.push(up.id);
			}
			await api("/api/tickets", {
				method: "POST",
				body: JSON.stringify({ kind, title, body, attachmentIds }),
			});
			setTitle("");
			setBody("");
			for (const d of drafts) if (d.preview) URL.revokeObjectURL(d.preview);
			setDrafts([]);
			setMsg("Filed. Viable tickets auto-merge and go live on chat.pyrearms.dev.");
			await load();
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Could not file ticket");
		} finally {
			setBusy(false);
		}
	}

	if (closed) {
		return (
			<div className="overlay-page">
				<div className="page-head">
					<div>
						<div className="eyebrow">Beta</div>
						<h1>Tickets</h1>
					</div>
					<button className="icon-btn solid" onClick={onBack} aria-label="Close"><Icon name="close" size={20} /></button>
				</div>
				<div className="settings">
					<div className="card">Private beta tickets are closed. Thanks for helping build PyreChat.</div>
				</div>
			</div>
		);
	}

	return (
		<div className="overlay-page">
			<div className="page-head">
				<div>
					<div className="eyebrow">Beta</div>
					<h1>Tickets</h1>
				</div>
				<button className="icon-btn solid" onClick={onBack} aria-label="Close"><Icon name="close" size={20} /></button>
			</div>
			<div className="settings">
				<div className="card">
					<p className="muted" style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
						File a real bug or a feature. Attach screenshots or files. During private beta a builder bot audits it, implements it if it is viable, auto-merges the PR, and deploys. The site and native WebView pick it up on the next load — no APK unless native code changed.
					</p>
				</div>
				<div className="card">
					<h3>New ticket</h3>
					<select className="select" value={kind} onChange={(e) => setKind(e.target.value as Ticket["kind"])}>
						<option value="bug">Bug</option>
						<option value="feature">Feature</option>
					</select>
					<input className="field" placeholder="Short title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
					<textarea
						className="field"
						placeholder={kind === "bug" ? "What happened, where, and on which device" : "What you want and why it belongs in PyreChat"}
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={5}
						maxLength={4000}
						style={{ width: "100%", resize: "vertical", minHeight: 96 }}
					/>
					<div className="ticket-attach-row">
						{Capacitor.isNativePlatform() ? (
							<>
								<input
									ref={photoRef}
									className="file-sr"
									type="file"
									accept={IMAGE_ACCEPT}
									multiple
									onChange={(e) => {
										addFiles(e.target.files);
										e.target.value = "";
									}}
								/>
								<button type="button" className="pill" onClick={() => void pickPhotos()}>
									<Icon name="image" size={16} /> Photos
								</button>
							</>
						) : (
							<label className="pill ticket-pick">
								<input
									ref={photoRef}
									className="file-sr"
									type="file"
									accept={IMAGE_ACCEPT}
									multiple
									onChange={(e) => {
										addFiles(e.target.files);
										e.target.value = "";
									}}
								/>
								<Icon name="image" size={16} /> Photos
							</label>
						)}
						<label className="pill ticket-pick">
							<input
								ref={fileRef}
								className="file-sr"
								type="file"
								accept={FILE_ACCEPT}
								multiple
								onChange={(e) => {
									addFiles(e.target.files);
									e.target.value = "";
								}}
							/>
							<Icon name="clip" size={16} /> Files
						</label>
						<span className="muted" style={{ fontWeight: 700, fontSize: 12 }}>
							{drafts.length}/{MAX_FILES} · 10 MB each
						</span>
					</div>
					{drafts.length > 0 && (
						<div className="ticket-files">
							{drafts.map((d) => (
								<div key={d.id} className="ticket-file">
									{d.preview && !d.broken ? (
										<img src={d.preview} alt="" onError={() => setDrafts((cur) => cur.map((x) => (x.id === d.id ? { ...x, broken: true } : x)))} />
									) : (
										<div className="ticket-file-name">{d.file.name || "Photo"}</div>
									)}
									<button type="button" className="ticket-file-x" onClick={() => removeDraft(d.id)} aria-label="Remove">
										×
									</button>
								</div>
							))}
						</div>
					)}
					<button className="primary" disabled={busy} onClick={() => void submit()}>
						{busy ? "…" : "Send to the builder"}
					</button>
					{msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
				</div>
				{items.map((t) => (
					<div key={t.id} className="card">
						<div className="muted" style={{ fontWeight: 800, letterSpacing: "0.08em", fontSize: 11 }}>
							{t.kind.toUpperCase()} · {STATUS[t.status]}
							{founder && t.username ? ` · @${t.username}` : ""}
						</div>
						<h3 style={{ margin: "6px 0" }}>{t.title}</h3>
						<p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap", fontWeight: 600 }}>{t.body}</p>
						{t.attachments && t.attachments.length > 0 && (
							<div className="ticket-files">
								{t.attachments.map((a) => (
									a.image ? (
										<a key={a.id} className="ticket-file" href={fileUrl(a.url)} target="_blank" rel="noreferrer">
											<img src={fileUrl(a.url)} alt={a.name} />
										</a>
									) : (
										<a key={a.id} className="ticket-file ticket-file-doc" href={fileUrl(a.url)} target="_blank" rel="noreferrer">
											<div className="ticket-file-name">{a.name}</div>
										</a>
									)
								))}
							</div>
						)}
						{t.note && <p className="muted" style={{ marginTop: 8 }}>{t.note}</p>}
						{t.prUrl && (
							<a className="link" href={t.prUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
								Pull request
							</a>
						)}
					</div>
				))}
				{items.length === 0 && <div className="empty">No tickets yet. First one through the door sets the tone.</div>}
			</div>
		</div>
	);
}
