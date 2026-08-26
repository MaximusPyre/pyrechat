import { useEffect, useRef, useState } from "react";
import { api, mediaUrl, uploadMedia } from "../lib/api";
import type { ChatRow } from "../lib/types";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";
import { openSocket } from "../lib/ws";

function statusOf(c: ChatRow): { cls: string; text: string } {
	if (c.unopenedSnaps) return { cls: "unopened", text: "New Pyre" };
	if (c.last?.kind === "snap") return { cls: "opened", text: "Opened" };
	if (c.last?.kind === "text") return { cls: "chat", text: c.last.body || "Chat" };
	if (c.last) return { cls: "chat", text: c.last.kind };
	return { cls: "hollow", text: "Tap to chat" };
}

function timeAgo(iso?: string | null): string {
	if (!iso) return "";
	const s = (Date.now() - new Date(iso).getTime()) / 1000;
	if (s < 60) return "now";
	if (s < 3600) return `${Math.floor(s / 60)}m`;
	if (s < 86400) return `${Math.floor(s / 3600)}h`;
	return `${Math.floor(s / 86400)}d`;
}

export function ChatListScreen({
	onOpen,
	onSearch,
	onAdd,
	refreshKey = 0,
}: {
	onOpen: (chat: ChatRow) => void;
	onSearch: () => void;
	onAdd: () => void;
	refreshKey?: number;
}) {
	const [chats, setChats] = useState<ChatRow[]>([]);
	useEffect(() => {
		void api<{ chats: ChatRow[] }>("/api/chats").then((r) => setChats(r.chats));
	}, [refreshKey]);
	return (
		<div className="page chat">
			<div className="page-head">
				<div>
					<div className="eyebrow">PyreChat</div>
					<h1>Inbox</h1>
				</div>
				<div className="page-head-actions">
					<button className="icon-btn solid" onClick={onSearch} aria-label="Search"><Icon name="search" size={20} /></button>
					<button className="icon-btn solid" onClick={onAdd} aria-label="Add friends"><Icon name="add" size={20} /></button>
				</div>
			</div>
			<div className="list inset">
				{chats.length === 0 && <div className="empty">Add friends to start chatting.</div>}
				{chats.map((c) => {
					const st = statusOf(c);
					const title = c.is_group ? c.name || "Group" : c.members[0]?.display_name || "Chat";
					return (
						<button key={c.id} className="row" onClick={() => onOpen(c)}>
							<SkullmojiAvatar value={c.members[0]?.skullmoji} ring={!!c.unopenedSnaps} />
							<div className="row-body">
								<div className="row-title">{title}</div>
								<div className="row-sub">
									<i className={`status-dot ${st.cls}`} />
									{st.text}
									{c.streak > 0 && <span className="streak">🔥 {c.streak}</span>}
									<span>{timeAgo(c.last?.created_at)}</span>
								</div>
							</div>
							{c.unopenedSnaps > 0 && <span className="badge">{c.unopenedSnaps}</span>}
						</button>
					);
				})}
			</div>
		</div>
	);
}

type Msg = {
	id: string;
	sender_id: string;
	kind: string;
	body: string;
	media_key: string | null;
	created_at: string;
	saved: number;
	display_name: string;
	skullmoji?: unknown;
};

type Me = { id: string; display_name: string; skullmoji: unknown };

const PALETTE = ["#3d9ee8", "#e14b4b", "#2bbbad", "#a78bfa", "#e85d12", "#f0c14a", "#7dd3a0", "#ff7ab6"];
const STICKERS = ["🔥", "☠", "💀", "🧡", "⚡", "😈", "🖤", "✨", "😂", "💋"];

function nameColor(id: string, isMe: boolean): string {
	if (isMe) return "#3d9ee8";
	let n = 0;
	for (const ch of id) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
	return PALETTE[n % PALETTE.length];
}

function firstName(name: string): string {
	return (name.split(/\s+/)[0] || name).toUpperCase();
}

function groupMsgs(msgs: Msg[]): Msg[][] {
	const out: Msg[][] = [];
	for (const m of msgs) {
		const last = out[out.length - 1];
		if (last && last[0].sender_id === m.sender_id) last.push(m);
		else out.push([m]);
	}
	return out;
}

export function ChatThreadScreen({
	chat,
	me,
	onBack,
	onSnap,
	onCall,
	onFriend,
}: {
	chat: ChatRow;
	me: Me;
	onBack: () => void;
	onSnap: () => void;
	onCall: (kind: "audio" | "video") => void;
	onFriend: () => void;
}) {
	const [msgs, setMsgs] = useState<Msg[]>([]);
	const [text, setText] = useState("");
	const [stickersOpen, setStickersOpen] = useState(false);
	const [here, setHere] = useState<Set<string>>(new Set());
	const [typing, setTyping] = useState<Set<string>>(new Set());
	const bottom = useRef<HTMLDivElement>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const typeTimer = useRef(0);
	const peerTimers = useRef<Map<string, number>>(new Map());
	const fileRef = useRef<HTMLInputElement>(null);
	const title = chat.is_group ? chat.name || "Group" : chat.members[0]?.display_name || "Chat";
	const people: Me[] = [...chat.members.map((m) => ({ id: m.id, display_name: m.display_name, skullmoji: m.skullmoji })), me];

	function upsertMsg(incoming: Msg) {
		setMsgs((all) => {
			if (all.some((x) => x.id === incoming.id)) return all;
			const withoutTemp = all.filter((x) => !(x.id.startsWith("tmp-") && x.sender_id === incoming.sender_id && x.body === incoming.body));
			return [...withoutTemp, incoming];
		});
	}

	useEffect(() => {
		void api<{ messages: Msg[] }>(`/api/chats/${chat.id}/messages`).then((r) => setMsgs(r.messages));
		const ws = openSocket(`/api/ws/chat/${chat.id}`);
		wsRef.current = ws;
		ws.onmessage = (ev) => {
			try {
				const m = JSON.parse(ev.data as string) as {
					type?: string;
					id?: string;
					sender_id?: string;
					from?: string;
					kind?: string;
					body?: string;
					media_key?: string | null;
					created_at?: string;
					display_name?: string;
					skullmoji?: unknown;
					users?: string[];
				};
				if (m.type === "roster" && m.users) setHere(new Set(m.users));
				if (m.type === "here" && m.from) setHere((s) => new Set(s).add(m.from as string));
				if (m.type === "gone" && m.from) {
					setHere((s) => {
						const n = new Set(s);
						n.delete(m.from as string);
						return n;
					});
					setTyping((s) => {
						const n = new Set(s);
						n.delete(m.from as string);
						return n;
					});
				}
				if (m.type === "typing" && m.from && m.from !== me.id) {
					setTyping((s) => new Set(s).add(m.from as string));
					const prev = peerTimers.current.get(m.from);
					if (prev) window.clearTimeout(prev);
					const t = window.setTimeout(() => {
						setTyping((s) => {
							const n = new Set(s);
							n.delete(m.from as string);
							return n;
						});
					}, 2200);
					peerTimers.current.set(m.from, t);
				}
				if (m.type === "message" && m.id && m.sender_id) {
					upsertMsg({
						id: m.id,
						sender_id: m.sender_id,
						kind: m.kind || "text",
						body: m.body || "",
						media_key: m.media_key ?? null,
						created_at: m.created_at || new Date().toISOString(),
						saved: 0,
						display_name: m.display_name || "Friend",
						skullmoji: m.skullmoji,
					});
				}
				if (m.type === "snap") {
					void api<{ messages: Msg[] }>(`/api/chats/${chat.id}/messages`).then((r) => setMsgs(r.messages));
				}
			} catch {
				/* ignore */
			}
		};
		return () => {
			ws.close();
			wsRef.current = null;
			window.clearTimeout(typeTimer.current);
			for (const t of peerTimers.current.values()) window.clearTimeout(t);
		};
	}, [chat.id, me.id]);

	useEffect(() => {
		bottom.current?.scrollIntoView({ behavior: "smooth" });
	}, [msgs.length]);

	function pingTyping() {
		if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "typing" }));
		window.clearTimeout(typeTimer.current);
		typeTimer.current = window.setTimeout(() => {
			/* peer timeout clears their pill */
		}, 1600);
	}

	async function post(kind: string, body: string, mediaKey?: string) {
		const local: Msg = {
			id: `tmp-${crypto.randomUUID()}`,
			sender_id: me.id,
			kind,
			body,
			media_key: mediaKey || null,
			created_at: new Date().toISOString(),
			saved: 0,
			display_name: me.display_name,
			skullmoji: me.skullmoji,
		};
		upsertMsg(local);
		const r = await api<{ id: string }>(`/api/chats/${chat.id}/messages`, {
			method: "POST",
			body: JSON.stringify({ kind, body, mediaKey }),
		});
		setMsgs((all) => all.map((x) => (x.id === local.id ? { ...x, id: r.id } : x)));
	}

	async function send() {
		const body = text.trim();
		if (!body) return;
		setText("");
		setStickersOpen(false);
		await post("text", body);
	}

	async function voiceNote() {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const rec = new MediaRecorder(stream);
		const chunks: Blob[] = [];
		rec.ondataavailable = (e) => chunks.push(e.data);
		rec.onstop = () => {
			void (async () => {
				const blob = new Blob(chunks, { type: "audio/webm" });
				const { key } = await uploadMedia(blob);
				await post("voice", "", key);
				stream.getTracks().forEach((t) => t.stop());
			})();
		};
		rec.start();
		window.setTimeout(() => rec.stop(), 4000);
	}

	async function sendFile(file: File) {
		const { key } = await uploadMedia(file);
		await post(file.type.startsWith("video") ? "video" : "image", "", key);
	}

	async function toggleSave(m: Msg) {
		if (m.id.startsWith("tmp-")) return;
		if (m.saved) await api(`/api/messages/${m.id}/save`, { method: "DELETE" });
		else await api(`/api/messages/${m.id}/save`, { method: "POST" });
		setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, saved: m.saved ? 0 : 1 } : x)));
	}

	function renderBody(m: Msg) {
		if (m.kind === "voice" && m.media_key) return <audio controls src={mediaUrl(m.media_key)} />;
		if ((m.kind === "image" || m.kind === "photo") && m.media_key) {
			return <img className="chat-media" src={mediaUrl(m.media_key)} alt="" />;
		}
		if (m.kind === "video" && m.media_key) {
			return <video className="chat-media" src={mediaUrl(m.media_key)} controls playsInline />;
		}
		if (m.kind === "sticker") return <span className="chat-sticker">{m.body}</span>;
		if (m.kind === "snap") return <span className="chat-pyre">🔥 Pyre</span>;
		return <span className="chat-text">{m.body}</span>;
	}

	return (
		<div className="overlay-page chat-thread">
			<div className="thread-top">
				<button className="thread-who" onClick={onFriend}>
					<SkullmojiAvatar value={chat.members[0]?.skullmoji || me.skullmoji} size={36} />
					<div>
						<div className="thread-title">{title}</div>
						{chat.streak > 0 && <div className="thread-sub">🔥 {chat.streak} day streak</div>}
					</div>
				</button>
				<button className="icon-btn ghost" onClick={() => onCall("audio")} aria-label="Call"><Icon name="phone" size={18} /></button>
				<button className="icon-btn ghost" onClick={() => onCall("video")} aria-label="Video"><Icon name="video" size={18} /></button>
				<button className="icon-btn ghost" onClick={onBack} aria-label="Close"><Icon name="chevron" size={18} /></button>
			</div>
			<div className="msgs">
				{groupMsgs(msgs).map((group) => {
					const lead = group[0];
					const mine = lead.sender_id === me.id;
					const color = nameColor(lead.sender_id, mine);
					return (
						<div key={lead.id} className={`chat-block ${mine ? "mine" : ""} ${group.some((x) => x.saved) ? "saved" : ""}`}>
							<i className="chat-accent" style={{ background: color }} />
							<div className="chat-block-body">
								<div className="chat-who" style={{ color }}>{mine ? "ME" : firstName(lead.display_name)}</div>
								{group.map((m) => (
									<button key={m.id} className="chat-line" onClick={() => void toggleSave(m)}>
										{renderBody(m)}
									</button>
								))}
							</div>
						</div>
					);
				})}
				<div ref={bottom} />
			</div>
			<div className="presence-row">
				{people.map((p) => {
					const active = typing.has(p.id);
					const inRoom = here.has(p.id);
					const pop = active || inRoom;
					return (
						<div key={p.id} className={`here-pill ${active ? "typing" : inRoom ? "here" : ""}`}>
							{pop && (
								<span className="here-pop">
									<SkullmojiAvatar value={p.skullmoji} size={28} />
								</span>
							)}
							{p.id === me.id ? "ME" : firstName(p.display_name)}
						</div>
					);
				})}
			</div>
			{stickersOpen && (
				<div className="sticker-tray">
					{STICKERS.map((ch) => (
						<button key={ch} onClick={() => { setStickersOpen(false); void post("sticker", ch); }}>{ch}</button>
					))}
				</div>
			)}
			<div className="composer">
				<button className="composer-cam" onClick={onSnap} aria-label="Camera"><Icon name="cam" size={22} /></button>
				<div className="composer-field">
					<input
						value={text}
						onChange={(e) => {
							setText(e.target.value);
							pingTyping();
						}}
						placeholder="Send a Chat"
						onKeyDown={(e) => e.key === "Enter" && void send()}
					/>
					<button className="icon-btn ghost" onClick={() => void voiceNote()} aria-label="Voice"><Icon name="mic" size={18} /></button>
					<button className="icon-btn ghost" onClick={() => setStickersOpen((v) => !v)} aria-label="Stickers"><Icon name="sticker" size={18} /></button>
				</div>
				<button className="icon-btn ghost" onClick={() => fileRef.current?.click()} aria-label="Gallery"><Icon name="mem" size={20} /></button>
				<input
					ref={fileRef}
					type="file"
					accept="image/*,video/*"
					hidden
					onChange={(e) => {
						const f = e.target.files?.[0];
						e.target.value = "";
						if (f) void sendFile(f);
					}}
				/>
			</div>
		</div>
	);
}
