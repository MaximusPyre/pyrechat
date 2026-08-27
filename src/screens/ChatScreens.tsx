import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, mediaUrl, uploadMedia } from "../lib/api";
import { chatFieldProps } from "../lib/shell";
import type { ChatRow, User } from "../lib/types";
import { Icon } from "../components/Icon";
import { DisplayName } from "../components/DisplayName";
import { SkullLogo, SkullmojiAvatar } from "../components/Skull";
import { AccountNotices, AppNoticeBanner, GetAppCard, NativeUpdateBanner } from "../components/GetApp";
import { openSocket } from "../lib/ws";
import { StoryRail, useStoryRail, type Story } from "./StoriesScreen";

function statusOf(c: ChatRow, meId?: string): { cls: string; text: string } {
	const ago = timeAgo(c.last?.created_at);
	const tail = ago ? ` • ${ago}` : "";
	if (c.unopenedSnaps) return { cls: "unopened", text: `Received${tail}` };
	if (c.last?.kind === "snap") return { cls: "opened", text: `Opened${tail}` };
	if (c.last && (c.last.kind === "text" || c.last.kind === "sticker" || c.last.kind === "voice")) {
		const mine = !!meId && c.last.sender_id === meId;
		return { cls: mine ? "sent" : "chat", text: `${mine ? "Delivered" : "Received"}${tail}` };
	}
	if (c.last) return { cls: "chat", text: `${c.last.kind}${tail}` };
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
	onYou,
	onHome,
	onSnap,
	onOpenStory,
	refreshKey = 0,
	activeId,
	desktop,
	me,
}: {
	onOpen: (chat: ChatRow) => void;
	onSearch: () => void;
	onAdd: () => void;
	onYou?: () => void;
	onHome?: () => void;
	onSnap?: () => void;
	onOpenStory?: (items: Story[], i: number) => void;
	refreshKey?: number;
	activeId?: string | null;
	desktop?: boolean;
	me?: User;
}) {
	const [chats, setChats] = useState<ChatRow[]>([]);
	const [q, setQ] = useState("");
	const stories = useStoryRail();
	useEffect(() => {
		void api<{ chats: ChatRow[] }>("/api/chats").then((r) => setChats(r.chats));
	}, [refreshKey]);
	const query = q.trim().toLowerCase();
	const shown = query
		? chats.filter((c) => {
				const title = c.is_group ? c.name || "Group" : c.members[0]?.display_name || "";
				const user = c.members[0]?.username || "";
				return title.toLowerCase().includes(query) || user.toLowerCase().includes(query);
			})
		: chats;
	return (
		<div className="page chat">
			{desktop ? (
				<div className="web-head">
					<button type="button" className="web-head-avatar" onClick={onYou} aria-label="You">
						<SkullmojiAvatar value={me?.skullmoji} size={36} />
					</button>
					<button type="button" className="web-head-logo" onClick={onHome} aria-label="PyreChat">
						<SkullLogo size={30} orange />
					</button>
					<button type="button" className="icon-btn ghost" onClick={onAdd} aria-label="Add friends">
						<Icon name="person-add" size={20} />
					</button>
					<button type="button" className="web-head-new" onClick={onSearch} aria-label="Search">
						<Icon name="search" size={18} />
					</button>
				</div>
			) : (
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
			)}
			<div className="list inset">
				<NativeUpdateBanner />
				<AppNoticeBanner />
				<AccountNotices refreshKey={refreshKey} />
				<GetAppCard />
				<div className="web-search">
					<Icon name="search" size={16} />
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search"
						aria-label="Search chats"
						autoComplete="off"
						autoCorrect="off"
						autoCapitalize="none"
						spellCheck={false}
						enterKeyHint="search"
						data-lpignore="true"
						data-1p-ignore="true"
						data-form-type="other"
					/>
				</div>
				{onOpenStory && (
					<StoryRail compact mine={stories.mine} friends={stories.friends} onOpen={onOpenStory} onCapture={onSnap} />
				)}
				{shown.length === 0 && <div className="empty">{chats.length === 0 ? "Add friends to start chatting." : "No chats match."}</div>}
				{shown.map((c) => {
					const st = statusOf(c, me?.id);
					const title = c.is_group ? c.name || "Group" : c.members[0]?.display_name || "Chat";
					const storyOn = !c.is_group && !!c.members[0]?.story_key;
					return (
						<button key={c.id} type="button" className={`row ${c.id === activeId ? "on" : ""}`} onClick={() => onOpen(c)}>
							<SkullmojiAvatar value={c.members[0]?.skullmoji} ring={!!c.unopenedSnaps || storyOn} />
							<div className="row-body">
								<div className="row-title">
									<DisplayName name={title} username={c.is_group ? undefined : c.members[0]?.username} kindling={c.is_group ? undefined : c.members[0]?.kindling} />
								</div>
								<div className="row-sub">
									<i className={`status-ico ${st.cls}`} />
									{st.text}
									{c.streak > 0 && <span className="streak">🔥 {c.streak}</span>}
								</div>
							</div>
							{onSnap && (
								<span
									className="row-cam"
									role="button"
									aria-label="Camera"
									onClick={(e) => {
										e.stopPropagation();
										onSnap();
									}}
								>
									<Icon name="cam" size={16} />
								</span>
							)}
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
	username?: string;
	display_name: string;
	skullmoji?: unknown;
	kindling?: number | boolean;
};

type Me = { id: string; username?: string; display_name: string; skullmoji: unknown; kindling?: number | boolean };

const PALETTE = ["#5b9aa3", "#c45e32", "#4d8a8e", "#8b9aa3", "#d4895c", "#7eb0b3", "#9b958c", "#c47a6a"];
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
	const scroller = useRef<HTMLDivElement>(null);
	const stack = useRef<HTMLDivElement>(null);
	const followBottom = useRef(true);
	const wsRef = useRef<WebSocket | null>(null);
	const typeTimer = useRef(0);
	const peerTimers = useRef<Map<string, number>>(new Map());
	const title = chat.is_group ? chat.name || "Group" : chat.members[0]?.display_name || "Chat";
	const titleUser = chat.is_group ? undefined : chat.members[0]?.username;
	const titleKindling = chat.is_group ? undefined : chat.members[0]?.kindling;
	const people: Me[] = [
		...chat.members.map((m) => ({ id: m.id, username: m.username, display_name: m.display_name, skullmoji: m.skullmoji, kindling: m.kindling })),
		me,
	];

	function upsertMsg(incoming: Msg) {
		setMsgs((all) => {
			if (all.some((x) => x.id === incoming.id)) return all;
			const withoutTemp = all.filter((x) => !(x.id.startsWith("tmp-") && x.sender_id === incoming.sender_id && x.body === incoming.body));
			return [...withoutTemp, incoming];
		});
	}

	useEffect(() => {
		let live = true;
		setMsgs([]);
		followBottom.current = true;
		void api<{ messages: Msg[] }>(`/api/chats/${chat.id}/messages`).then((r) => {
			if (live) setMsgs(r.messages);
		});
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
			live = false;
			ws.close();
			wsRef.current = null;
			window.clearTimeout(typeTimer.current);
			for (const t of peerTimers.current.values()) window.clearTimeout(t);
		};
	}, [chat.id, me.id]);

	function pinToLatest() {
		const el = scroller.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}

	useLayoutEffect(() => {
		followBottom.current = true;
	}, [chat.id]);

	useLayoutEffect(() => {
		const pin = () => {
			if (followBottom.current) pinToLatest();
		};
		pin();
		const raf = requestAnimationFrame(() => {
			pin();
			requestAnimationFrame(pin);
		});
		const t = window.setTimeout(pin, 80);
		const t2 = window.setTimeout(pin, 240);
		return () => {
			cancelAnimationFrame(raf);
			window.clearTimeout(t);
			window.clearTimeout(t2);
		};
	}, [msgs.length, chat.id]);

	useEffect(() => {
		const el = scroller.current;
		const inner = stack.current;
		if (!el || !inner) return;
		const pin = () => {
			if (followBottom.current) pinToLatest();
		};
		const ro = new ResizeObserver(pin);
		ro.observe(el);
		ro.observe(inner);
		return () => ro.disconnect();
	}, [chat.id]);

	function onThreadScroll() {
		const el = scroller.current;
		if (!el) return;
		followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
	}

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
		followBottom.current = true;
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

	function pickAttachment() {
		const el = document.createElement("input");
		el.type = "file";
		el.accept = "image/*,video/*";
		el.onchange = () => {
			const f = el.files?.[0];
			el.remove();
			if (f) void sendFile(f);
		};
		el.click();
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
						<div className="thread-title"><DisplayName name={title} username={titleUser} kindling={titleKindling} /></div>
						{chat.streak > 0 && <div className="thread-sub">🔥 {chat.streak} day streak</div>}
					</div>
				</button>
				<button className="icon-btn ghost" onClick={() => onCall("audio")} aria-label="Call"><Icon name="phone" size={18} /></button>
				<button className="icon-btn ghost" onClick={() => onCall("video")} aria-label="Video"><Icon name="video" size={18} /></button>
				<button className="icon-btn ghost" onClick={onBack} aria-label="Close"><Icon name="chevron" size={18} /></button>
			</div>
			<div className="msgs" ref={scroller} onScroll={onThreadScroll}>
				<div className="msgs-stack" ref={stack}>
					{groupMsgs(msgs).map((group) => {
						const lead = group[0];
						const mine = lead.sender_id === me.id;
						const color = nameColor(lead.sender_id, mine);
						return (
							<div key={lead.id} className={`chat-block ${mine ? "mine" : ""} ${group.some((x) => x.saved) ? "saved" : ""}`}>
								<i className="chat-accent" style={{ background: color }} />
								<div className="chat-block-body">
									<div className="chat-who" style={{ color }}>
										{mine ? "ME" : (
											<DisplayName name={firstName(lead.display_name)} username={lead.username} kindling={lead.kindling} />
										)}
									</div>
									{group.map((m) => (
										<button key={m.id} className="chat-line" onClick={() => void toggleSave(m)}>
											{renderBody(m)}
										</button>
									))}
								</div>
							</div>
						);
					})}
				</div>
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
							{p.id === me.id ? "ME" : <DisplayName name={firstName(p.display_name)} username={p.username} kindling={p.kindling} />}
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
				<button type="button" className="composer-cam" onClick={onSnap} aria-label="Camera"><Icon name="cam" size={22} /></button>
				<div className="composer-field">
					<textarea
						{...chatFieldProps}
						rows={1}
						value={text}
						placeholder="Send a Chat"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								void send();
							}
						}}
						onChange={(e) => {
							setText(e.target.value);
							pingTyping();
						}}
					/>
					{!text.trim() && (
						<>
							<button type="button" className="icon-btn ghost" onClick={() => void voiceNote()} aria-label="Voice"><Icon name="mic" size={18} /></button>
							<button type="button" className="icon-btn ghost" onClick={() => setStickersOpen((v) => !v)} aria-label="Stickers"><Icon name="sticker" size={18} /></button>
						</>
					)}
				</div>
				{text.trim() ? (
					<button type="button" className="composer-send" onClick={() => void send()} aria-label="Send">
						<Icon name="send" size={18} color="#fff" />
					</button>
				) : (
					<button type="button" className="icon-btn ghost" onClick={pickAttachment} aria-label="Gallery"><Icon name="mem" size={20} /></button>
				)}
			</div>
		</div>
	);
}
