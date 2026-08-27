import { useEffect, useRef, useState } from "react";
import { api, logout, mediaUrl } from "../lib/api";
import { TEAL } from "../lib/brand";
import type { Friend, Skullmoji, User } from "../lib/types";
import { Icon } from "../components/Icon";
import { SkullLogo, SkullmojiAvatar } from "../components/Skull";
import { GetAppCard } from "../components/GetApp";
import { DisplayName } from "../components/DisplayName";
import { RecoveryKeySheet } from "../components/RecoveryKey";

export function ProfileScreen({
	me,
	onBack,
	onSettings,
	onAdd,
	onMemories,
	onMap,
	refresh,
	embedded,
}: {
	me: User;
	onBack: () => void;
	onSettings: () => void;
	onAdd: () => void;
	onMemories: () => void;
	onMap?: () => void;
	refresh: () => void;
	embedded?: boolean;
}) {
	const code = `https://chat.pyrearms.dev/add/${me.username}`;
	return (
		<div className={embedded ? "page profile" : "overlay-page"}>
			<div className="page-head">
				<div>
					<div className="eyebrow">Account</div>
					<h1>{embedded ? "You" : me.displayName}</h1>
				</div>
				<div className="page-head-actions">
					<button className="icon-btn solid" onClick={onSettings} aria-label="Settings"><Icon name="gear" size={20} /></button>
					{!embedded && <button className="icon-btn solid" onClick={onBack} aria-label="Close"><Icon name="close" size={20} /></button>}
				</div>
			</div>
			<div className="settings" style={{ textAlign: "center" }}>
				<SkullmojiAvatar value={me.skullmoji} size={96} />
				<h2 style={{ margin: "12px 0 0" }}><DisplayName name={me.displayName} username={me.username} kindling={me.kindling} /></h2>
				<div className="muted">@{me.username}</div>
				{me.kindling ? <div className="muted" style={{ marginTop: 6, fontWeight: 700 }}>Kindling — here before private beta.</div> : null}
				<div className="score" style={{ fontSize: 22, margin: "10px 0" }}>{me.snapScore} Pyre Score</div>
				<GetAppCard prominent />
				<div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
					<SkullLogo size={72} orange />
					<div className="muted" style={{ fontWeight: 800 }}>Skullcode</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(8, 10px)", gap: 4 }}>
						{hashDots(me.id).map((on, i) => (
							<i key={i} style={{ width: 10, height: 10, borderRadius: 2, background: on ? TEAL : "#323a40" }} />
						))}
					</div>
					<button className="pill" onClick={() => void navigator.clipboard.writeText(code)}>{code.replace("https://", "")}</button>
				</div>
				<div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
					<button className="pill" onClick={onAdd}>Add friends</button>
					<button className="pill" onClick={onMemories}>Library</button>
					{onMap && <button className="pill" onClick={onMap}>Map</button>}
				</div>
				<SkullmojiEditor me={me} onSaved={refresh} />
			</div>
		</div>
	);
}

function hashDots(id: string): boolean[] {
	const out: boolean[] = [];
	for (let i = 0; i < 64; i++) {
		out.push(id.charCodeAt(i % id.length) * (i + 3) % 7 > 2);
	}
	return out;
}

function RecoverySettings({ hasRecovery }: { hasRecovery: boolean }) {
	const [password, setPassword] = useState("");
	const [key, setKey] = useState<string | null>(null);
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);

	async function rotate() {
		setMsg("");
		setBusy(true);
		try {
			const r = await api<{ recoveryKey: string }>("/api/me/recovery-key", {
				method: "POST",
				body: JSON.stringify({ password }),
			});
			setPassword("");
			setKey(r.recoveryKey);
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Could not replace key");
		} finally {
			setBusy(false);
		}
	}

	if (key) {
		return <RecoveryKeySheet recoveryKey={key} title="New recovery key" onDone={() => setKey(null)} />;
	}

	return (
		<div className="card">
			<h3>Recovery key</h3>
			<p className="muted" style={{ margin: "0 0 10px", fontWeight: 600, lineHeight: 1.45 }}>
				{hasRecovery
					? "This key resets your password if you get locked out. Making a new one retires the old one."
					: "Create a recovery key so you can reset your password without us."}
			</p>
			{hasRecovery && (
				<input
					className="field"
					type="password"
					placeholder="Current password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					autoComplete="current-password"
				/>
			)}
			<button className="pill" disabled={busy || (hasRecovery && !password)} onClick={() => void rotate()}>
				{busy ? "…" : hasRecovery ? "Replace recovery key" : "Create recovery key"}
			</button>
			{msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
		</div>
	);
}

function SkullmojiEditor({ me, onSaved }: { me: User; onSaved: () => void }) {
	const [s, setS] = useState<Skullmoji>(me.skullmoji);
	return (
		<div className="card" style={{ textAlign: "left", marginTop: 16 }}>
			<h3>Skullmoji</h3>
			<div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
				<SkullmojiAvatar value={s} size={80} />
			</div>
			<label className="muted">Color</label>
			<input className="field" type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} />
			<select className="select" value={s.eyes} onChange={(e) => setS({ ...s, eyes: e.target.value as Skullmoji["eyes"] })}>
				<option value="hollow">Hollow eyes</option>
				<option value="dots">Dot eyes</option>
				<option value="fire">Fire eyes</option>
			</select>
			<div style={{ height: 8 }} />
			<select className="select" value={s.jaw} onChange={(e) => setS({ ...s, jaw: e.target.value as Skullmoji["jaw"] })}>
				<option value="grin">Grin</option>
				<option value="flat">Flat</option>
				<option value="open">Open</option>
			</select>
			<div style={{ height: 8 }} />
			<select className="select" value={s.hat} onChange={(e) => setS({ ...s, hat: e.target.value as Skullmoji["hat"] })}>
				<option value="none">No hat</option>
				<option value="crown">Crown</option>
				<option value="bandana">Bandana</option>
				<option value="shades">Shades</option>
			</select>
			<button className="primary" style={{ marginTop: 12 }} onClick={() => void api("/api/me", { method: "PATCH", body: JSON.stringify({ skullmoji: s }) }).then(onSaved)}>
				Save Skullmoji
			</button>
		</div>
	);
}

export function SettingsScreen({
	me,
	onBack,
	onLoggedOut,
	onTickets,
}: {
	me: User;
	onBack: () => void;
	onLoggedOut: () => void;
	onTickets?: () => void;
}) {
	const [story, setStory] = useState(me.storyPrivacy);
	const [contact, setContact] = useState(me.whoCanContact);
	const [mapMode, setMapMode] = useState(me.mapMode);
	const [bio, setBio] = useState(me.bio);
	const [legalContact, setLegalContact] = useState(me.email || "");
	const [legalUrl, setLegalUrl] = useState("");
	const [legalDetail, setLegalDetail] = useState("");
	const [legalMsg, setLegalMsg] = useState("");

	async function save() {
		await api("/api/me", {
			method: "PATCH",
			body: JSON.stringify({ storyPrivacy: story, whoCanContact: contact, mapMode, bio }),
		});
		onBack();
	}

	async function sendLegal() {
		setLegalMsg("");
		try {
			await api("/api/legal-notice", {
				method: "POST",
				body: JSON.stringify({ contact: legalContact, targetUrl: legalUrl, detail: legalDetail }),
			});
			setLegalMsg("Notice received. We only act on illegal material.");
			setLegalUrl("");
			setLegalDetail("");
		} catch (e) {
			setLegalMsg(e instanceof Error ? e.message : "Failed");
		}
	}

	return (
		<div className="overlay-page">
			<div className="page-head">
				<div>
					<div className="eyebrow">Account</div>
					<h1>Settings</h1>
				</div>
				<button className="icon-btn solid" onClick={onBack} aria-label="Close"><Icon name="close" size={20} /></button>
			</div>
			<div className="settings">
				<div className="card warn">
					Humans talking to humans. No For You ranking. No AI. We do not police legal speech. The only takedown is illegal content (court orders, CSAM, and the like). Block people yourself.
				</div>
				<div className="card">
					<h3>Capture</h3>
					<p className="muted" style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
						PyreChat uses the device camera and our own color grades. We do not ship Snap Camera Kit — Snap does not allow that SDK in apps built for sending photos and video to friends.
					</p>
				</div>
				<div className="card">
					<h3>Who can contact me</h3>
					<select className="select" value={contact} onChange={(e) => setContact(e.target.value)}>
						<option value="everyone">Everyone</option>
						<option value="friends">Friends</option>
					</select>
				</div>
				<div className="card">
					<h3>Who can see my story</h3>
					<select className="select" value={story} onChange={(e) => setStory(e.target.value)}>
						<option value="friends">Friends</option>
						<option value="everyone">Everyone</option>
					</select>
				</div>
				<div className="card">
					<h3>Map</h3>
					<select className="select" value={mapMode} onChange={(e) => setMapMode(e.target.value)}>
						<option value="friends">My Friends</option>
						<option value="selected">Selected Friends</option>
						<option value="skull">Skull Mode (hidden)</option>
					</select>
				</div>
				<div className="card">
					<h3>Bio</h3>
					<input className="field" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" />
				</div>
				<button className="primary" onClick={() => void save()}>Save</button>
				<RecoverySettings hasRecovery={!!me.hasRecovery} />
				{onTickets && (
					<div className="card">
						<h3>Beta tickets</h3>
						<p className="muted" style={{ margin: "0 0 10px", fontWeight: 600, lineHeight: 1.45 }}>
							Bugs and features hit a webhook that runs the beta builder. Viable PRs auto-merge and deploy to chat.pyrearms.dev. The app updates on the next load.
						</p>
						<button className="pill" onClick={onTickets}>Open tickets</button>
					</div>
				)}
				<GetAppCard prominent />
				<div className="card">
					<h3>Source</h3>
					<a className="link" href="https://github.com/MaximusPyre/pyrechat" target="_blank" rel="noreferrer" style={{ marginTop: 0 }}>
						github.com/MaximusPyre/pyrechat
					</a>
				</div>
				<div className="card" style={{ marginTop: 20 }}>
					<h3>Illegal content notice</h3>
					<p className="muted" style={{ margin: "0 0 10px", fontWeight: 700 }}>
						Not for “I don’t like this.” Only for material that is actually illegal.
					</p>
					<input className="field" placeholder="Your contact email" value={legalContact} onChange={(e) => setLegalContact(e.target.value)} />
					<input className="field" placeholder="URL of the Pyre / story / post" value={legalUrl} onChange={(e) => setLegalUrl(e.target.value)} />
					<input className="field" placeholder="What law, and where it is" value={legalDetail} onChange={(e) => setLegalDetail(e.target.value)} />
					<button className="pill" onClick={() => void sendLegal()}>Send notice</button>
					{legalMsg && <p className="muted" style={{ marginTop: 8 }}>{legalMsg}</p>}
				</div>
				<button className="link" onClick={() => void logout().then(onLoggedOut)}>Log out</button>
			</div>
		</div>
	);
}

export function MemoriesScreen({ onBack }: { onBack: () => void }) {
	const [items, setItems] = useState<{ id: string; media_key: string; kind: string; month_key: string }[]>([]);
	useEffect(() => {
		void api<{ memories: typeof items }>("/api/memories").then((r) => setItems(r.memories));
	}, []);
	return (
		<div className="overlay-page">
			<div className="top">
				<button className="icon-btn" onClick={onBack}><Icon name="close" /></button>
				<div className="search-pill" style={{ justifyContent: "center" }}>Memories</div>
			</div>
			<div className="list" style={{ paddingTop: 80 }}>
				{items.length === 0 && <div className="empty">Saved Pyres live here.</div>}
				<div className="mem-grid">
					{items.map((m) =>
						m.kind === "video" ? (
							<video key={m.id} src={mediaUrl(m.media_key)} />
						) : (
							<img key={m.id} src={mediaUrl(m.media_key)} alt="" />
						),
					)}
				</div>
			</div>
		</div>
	);
}

export function FriendshipScreen({ id, onBack }: { id: string; onBack: () => void }) {
	const [data, setData] = useState<{
		user: { display_name: string; username: string; skullmoji: string; snap_score: number; bio: string; kindling?: number | boolean };
		streak: { count: number; record: number } | null;
		friendsSince: string;
		charms: { id: string; title: string; value: string }[];
	} | null>(null);
	useEffect(() => {
		void api<NonNullable<typeof data>>(`/api/friends/${id}/profile`).then(setData);
	}, [id]);
	if (!data) return <div className="overlay-page" />;
	return (
		<div className="overlay-page">
			<div className="top">
				<button className="icon-btn" onClick={onBack}><Icon name="close" /></button>
				<div className="search-pill" style={{ justifyContent: "center" }}>
					<DisplayName name={data.user.display_name} username={data.user.username} kindling={data.user.kindling} />
				</div>
			</div>
			<div className="settings" style={{ textAlign: "center" }}>
				<SkullmojiAvatar value={data.user.skullmoji} size={88} />
				<h2><DisplayName name={data.user.display_name} username={data.user.username} kindling={data.user.kindling} /></h2>
				<div className="muted">@{data.user.username}</div>
				<div className="score">🔥 {data.streak?.count || 0} · best {data.streak?.record || 0}</div>
				{data.charms.map((c) => (
					<div key={c.id} className="card">
						<h3>{c.title}</h3>
						<div style={{ fontWeight: 900 }}>{c.value}</div>
					</div>
				))}
				<button className="link" onClick={() => void api("/api/friends/remove", { method: "POST", body: JSON.stringify({ userId: id }) }).then(onBack)}>
					Remove friend
				</button>
				<button className="link" onClick={() => void api("/api/block", { method: "POST", body: JSON.stringify({ userId: id }) }).then(onBack)}>
					Block (your list only)
				</button>
			</div>
		</div>
	);
}

export function SearchScreen({ onBack, onAdd }: { onBack: () => void; onAdd: (id: string) => void }) {
	const [q, setQ] = useState("");
	const [friends, setFriends] = useState<Friend[]>([]);
	useEffect(() => {
		void api<{ friends: Friend[] }>("/api/friends").then((r) => setFriends(r.friends));
	}, []);
	const filtered = friends.filter((f) => f.display_name.toLowerCase().includes(q.toLowerCase()) || f.username.toLowerCase().includes(q.toLowerCase()));
	return (
		<div className="overlay-page">
			<div className="top">
				<button className="icon-btn" onClick={onBack}><Icon name="close" /></button>
				<input className="search-pill" autoFocus placeholder="Search friends" value={q} onChange={(e) => setQ(e.target.value)} />
			</div>
			<div className="list">
				{filtered.map((f) => (
					<button key={f.id} className="row" onClick={() => onAdd(f.id)}>
						<SkullmojiAvatar value={f.skullmoji} />
						<div className="row-body">
							<div className="row-title"><DisplayName name={f.display_name} username={f.username} kindling={f.kindling} /></div>
							<div className="row-sub">@{f.username}{f.streak ? ` · 🔥 ${f.streak}` : ""}</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}

export function CallScreen({ peerName, onEnd }: { peerName: string; onEnd: () => void }) {
	const localRef = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		let stream: MediaStream | null = null;
		void navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) => {
			stream = s;
			if (localRef.current) localRef.current.srcObject = s;
		});
		return () => stream?.getTracks().forEach((t) => t.stop());
	}, []);
	return (
		<div className="call-screen">
			<SkullmojiAvatar size={96} />
			<h2>{peerName}</h2>
			<video ref={localRef} autoPlay muted playsInline />
			<p className="muted">Calls signal through your Pyre hub. Camera and mic stay on-device.</p>
			<button className="primary" style={{ background: "#c33", width: 200 }} onClick={onEnd}>End</button>
		</div>
	);
}
