import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { api, ApiError, track } from "./lib/api";
import { openSocket } from "./lib/ws";
import type { ChatRow, Tab, User } from "./lib/types";
import { MUTE, TEAL } from "./lib/brand";
import { Icon } from "./components/Icon";
import { AuthScreen } from "./screens/AuthScreen";
import { ChatListScreen } from "./screens/ChatScreens";
import { AddFriendsScreen } from "./screens/AddFriendsScreen";
import { RecoveryKeySheet } from "./components/RecoveryKey";
import type { Story } from "./screens/StoriesScreen";

const CameraScreen = lazy(() => import("./screens/CameraScreen").then((m) => ({ default: m.CameraScreen })));
const FeedScreen = lazy(() => import("./screens/FeedScreen").then((m) => ({ default: m.FeedScreen })));
const MapScreen = lazy(() => import("./screens/MapScreen").then((m) => ({ default: m.MapScreen })));
const ProfileScreen = lazy(() => import("./screens/ProfileScreens").then((m) => ({ default: m.ProfileScreen })));
const SettingsScreen = lazy(() => import("./screens/ProfileScreens").then((m) => ({ default: m.SettingsScreen })));
const TicketsScreen = lazy(() => import("./screens/TicketsScreen").then((m) => ({ default: m.TicketsScreen })));
const MemoriesScreen = lazy(() => import("./screens/ProfileScreens").then((m) => ({ default: m.MemoriesScreen })));
const SearchScreen = lazy(() => import("./screens/ProfileScreens").then((m) => ({ default: m.SearchScreen })));
const FriendshipScreen = lazy(() => import("./screens/ProfileScreens").then((m) => ({ default: m.FriendshipScreen })));
const CallScreen = lazy(() => import("./screens/ProfileScreens").then((m) => ({ default: m.CallScreen })));
const ChatThreadScreen = lazy(() => import("./screens/ChatScreens").then((m) => ({ default: m.ChatThreadScreen })));
const SnapViewer = lazy(() => import("./screens/StoriesScreen").then((m) => ({ default: m.SnapViewer })));
const StoryViewer = lazy(() => import("./screens/StoriesScreen").then((m) => ({ default: m.StoryViewer })));

type Overlay =
	| { t: "settings" }
	| { t: "tickets" }
	| { t: "add"; username?: string }
	| { t: "memories" }
	| { t: "search" }
	| { t: "map" }
	| { t: "thread"; chat: ChatRow }
	| { t: "snap"; id: string }
	| { t: "story"; items: Story[]; i: number }
	| { t: "friend"; id: string }
	| { t: "call"; name: string };

const TABS: { id: Tab; label: string; icon: string }[] = [
	{ id: "inbox", label: "Inbox", icon: "chat" },
	{ id: "capture", label: "Capture", icon: "cam" },
	{ id: "feed", label: "Feed", icon: "feed" },
	{ id: "you", label: "You", icon: "user" },
];

const DESKTOP_MQ = "(min-width: 900px)";

function useDesktop() {
	const [on, setOn] = useState(() => window.matchMedia(DESKTOP_MQ).matches);
	useEffect(() => {
		const mq = window.matchMedia(DESKTOP_MQ);
		const fn = () => setOn(mq.matches);
		mq.addEventListener("change", fn);
		return () => mq.removeEventListener("change", fn);
	}, []);
	return on;
}

function isFilmOverlay(overlay: Overlay | null, inboxSnap: string | null) {
	if (inboxSnap && !overlay) return true;
	return overlay?.t === "snap" || overlay?.t === "story" || overlay?.t === "call";
}

function ScreenFallback() {
	return (
		<div className="page" style={{ display: "grid", placeItems: "center" }}>
			<span className="muted">…</span>
		</div>
	);
}

function OverlayFallback() {
	return (
		<div className="overlay-page" style={{ display: "grid", placeItems: "center" }}>
			<span className="muted">…</span>
		</div>
	);
}

class OverlayErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}
	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(error, info);
	}
	render() {
		if (this.state.failed) {
			return (
				<div className="overlay-page" style={{ display: "grid", placeItems: "center", gap: 12, padding: 24 }}>
					<div className="muted" style={{ fontWeight: 700, textAlign: "center" }}>This screen failed to load.</div>
					<button className="primary" type="button" onClick={() => location.reload()}>Reload</button>
				</div>
			);
		}
		return this.props.children;
	}
}

export default function App() {
	const [user, setUser] = useState<User | null>(null);
	const [booting, setBooting] = useState(true);
	const [tab, setTab] = useState<Tab>("inbox");
	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [inboxTick, setInboxTick] = useState(0);
	const [inboxSnap, setInboxSnap] = useState<string | null>(null);
	const [pendingRecovery, setPendingRecovery] = useState<string | null>(null);
	const issuingRecovery = useRef(false);
	const desktop = useDesktop();

	const refreshMe = useCallback(async () => {
		try {
			const r = await api<{ user: User }>("/api/me");
			setUser(r.user);
		} catch (e) {
			const unauthorized = e instanceof ApiError && e.status === 401;
			if (unauthorized) {
				setUser(null);
				return;
			}
			try {
				const r = await api<{ user: User }>("/api/me");
				setUser(r.user);
			} catch (e2) {
				if (e2 instanceof ApiError && e2.status === 401) {
					setUser(null);
				}
			}
		}
	}, []);

	useEffect(() => {
		void refreshMe().finally(() => setBooting(false));
	}, [refreshMe]);

	useEffect(() => {
		if (!user) return;
		track(`view_${tab}`);
	}, [user, tab]);

	useEffect(() => {
		if (!user) return;
		const t = window.setTimeout(() => {
			void import("./screens/CameraScreen");
			void import("./screens/FeedScreen");
		}, 900);
		return () => window.clearTimeout(t);
	}, [user]);

	useEffect(() => {
		if (!user) return;
		const ws = openSocket("/api/ws/hub");
		ws.onmessage = (ev) => {
			try {
				const m = JSON.parse(ev.data as string) as { type?: string; snapId?: string; kind?: string };
				if (m.type === "snap" && m.snapId) setInboxSnap(m.snapId);
				if (m.kind === "snap" && m.snapId) setInboxSnap(m.snapId);
				if (m.type === "chat" || m.type === "message") setInboxTick((n) => n + 1);
				if (m.type === "notification" && (m.kind === "ticket" || m.kind === "app_update")) setInboxTick((n) => n + 1);
			} catch {
				/* ignore */
			}
		};
		const ping = window.setInterval(() => {
			if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
		}, 25000);
		return () => {
			window.clearInterval(ping);
			ws.close();
		};
	}, [user]);

	useEffect(() => {
		const path = location.pathname;
		const add = path.match(/^\/add\/([^/]+)/);
		if (add && user) {
			history.replaceState({}, "", "/");
			setOverlay({ t: "add", username: decodeURIComponent(add[1]) });
		}
	}, [user]);

	useEffect(() => {
		if (!user || user.hasRecovery || pendingRecovery || issuingRecovery.current) return;
		issuingRecovery.current = true;
		let alive = true;
		void api<{ recoveryKey: string }>("/api/me/recovery-key", { method: "POST", body: JSON.stringify({}) })
			.then((r) => {
				if (!alive) return;
				setUser((u) => (u ? { ...u, hasRecovery: true } : u));
				setPendingRecovery(r.recoveryKey);
			})
			.catch(() => {
				issuingRecovery.current = false;
			});
		return () => {
			alive = false;
		};
	}, [user, pendingRecovery]);

	if (booting) {
		return (
			<div className="auth">
				<div className="muted">PyreChat</div>
			</div>
		);
	}
	if (!user) return <AuthScreen onAuthed={setUser} />;
	if (!user.hasRecovery && !pendingRecovery) {
		return (
			<div className="auth">
				<div className="muted">Creating your recovery key…</div>
			</div>
		);
	}
	if (pendingRecovery) {
		return <RecoveryKeySheet recoveryKey={pendingRecovery} onDone={() => setPendingRecovery(null)} />;
	}

	const authed = user;

	function openChat(chat: ChatRow) {
		if (chat.unopenedSnaps) {
			void api<{ snaps: { snap_id: string; viewed_at: string | null; conversation_id: string }[] }>("/api/inbox").then((r) => {
				const hit = r.snaps.find((s) => !s.viewed_at && s.conversation_id === chat.id);
				if (hit) setOverlay({ t: "snap", id: hit.snap_id });
				else setOverlay({ t: "thread", chat });
			});
		} else setOverlay({ t: "thread", chat });
	}

	const inbox = (
		<ChatListScreen
			refreshKey={inboxTick}
			activeId={overlay?.t === "thread" ? overlay.chat.id : null}
			onOpen={openChat}
			onSearch={() => setOverlay({ t: "search" })}
			onAdd={() => setOverlay({ t: "add" })}
		/>
	);

	const nav = (
		<nav className={`nav ${!desktop && tab === "capture" ? "over-cam" : ""}`}>
			{TABS.map((t) => (
				<button
					key={t.id}
					className={`nav-item ${tab === t.id ? "on" : ""}`}
					onClick={() => {
						setTab(t.id);
						if (desktop) setOverlay(null);
					}}
				>
					<Icon name={t.icon} size={22} color={tab === t.id ? TEAL : MUTE} />
					<span>{t.label}</span>
				</button>
			))}
		</nav>
	);

	const tabScreen =
		tab === "capture" ? (
			<Suspense fallback={<ScreenFallback />}>
				<CameraScreen onOpenMemories={() => setOverlay({ t: "memories" })} />
			</Suspense>
		) : tab === "feed" ? (
			<Suspense fallback={<ScreenFallback />}>
				<FeedScreen
					onSearch={() => setOverlay({ t: "search" })}
					onAdd={() => setOverlay({ t: "add" })}
					onOpenStory={(items, i) => setOverlay({ t: "story", items, i })}
				/>
			</Suspense>
		) : tab === "you" ? (
			<Suspense fallback={<ScreenFallback />}>
				<ProfileScreen
					embedded
					me={authed}
					onBack={() => setTab("inbox")}
					onSettings={() => setOverlay({ t: "settings" })}
					onAdd={() => setOverlay({ t: "add" })}
					onMemories={() => setOverlay({ t: "memories" })}
					onMap={() => setOverlay({ t: "map" })}
					refresh={() => void refreshMe()}
				/>
			</Suspense>
		) : null;

	function overlays(mode: "pane" | "film" | "all") {
		const pane = mode === "pane" || mode === "all";
		const film = mode === "film" || mode === "all";
		return (
			<OverlayErrorBoundary>
				<Suspense fallback={<OverlayFallback />}>
					{pane && overlay?.t === "settings" && (
						<SettingsScreen
							me={authed}
							onBack={() => setOverlay(null)}
							onTickets={authed.betaTickets ? () => setOverlay({ t: "tickets" }) : undefined}
							onLoggedOut={() => {
								setUser(null);
								setOverlay(null);
							}}
						/>
					)}
					{pane && overlay?.t === "tickets" && (
						<TicketsScreen founder={authed.founder} onBack={() => setOverlay({ t: "settings" })} />
					)}
					{pane && overlay?.t === "add" && (
						<AddFriendsScreen pendingUsername={overlay.username} onBack={() => setOverlay(null)} />
					)}
					{pane && overlay?.t === "memories" && <MemoriesScreen onBack={() => setOverlay(null)} />}
					{pane && overlay?.t === "search" && (
						<SearchScreen onBack={() => setOverlay(null)} onAdd={() => setOverlay({ t: "add" })} />
					)}
					{pane && overlay?.t === "map" && <MapScreen me={authed} onProfile={() => setOverlay(null)} />}
					{pane && overlay?.t === "thread" && (
						<ChatThreadScreen
							chat={overlay.chat}
							me={{ id: authed.id, username: authed.username, display_name: authed.displayName, skullmoji: authed.skullmoji, kindling: authed.kindling }}
							onBack={() => setOverlay(null)}
							onSnap={() => {
								setOverlay(null);
								setTab("capture");
							}}
							onCall={() => setOverlay({ t: "call", name: overlay.chat.members[0]?.display_name || "Friend" })}
							onFriend={() => overlay.chat.members[0] && setOverlay({ t: "friend", id: overlay.chat.members[0].id })}
						/>
					)}
					{pane && overlay?.t === "friend" && <FriendshipScreen id={overlay.id} onBack={() => setOverlay(null)} />}
					{film && overlay?.t === "snap" && <SnapViewer id={overlay.id} onClose={() => setOverlay(null)} />}
					{film && overlay?.t === "story" && <StoryViewer items={overlay.items} start={overlay.i} onClose={() => setOverlay(null)} />}
					{film && overlay?.t === "call" && <CallScreen peerName={overlay.name} onEnd={() => setOverlay(null)} />}
					{film && inboxSnap && !overlay && <SnapViewer id={inboxSnap} onClose={() => setInboxSnap(null)} />}
				</Suspense>
			</OverlayErrorBoundary>
		);
	}

	const film = isFilmOverlay(overlay, inboxSnap);

	if (desktop) {
		return (
			<div className="app desktop">
				{nav}
				<aside className="desk-side">{inbox}</aside>
				<div className="desk-main pager">
					{overlay && !film ? (
						overlays("pane")
					) : tab === "inbox" ? (
						<div className="desk-empty">
							<div className="eyebrow">PyreChat</div>
							<h2>Pick a chat</h2>
							<p>Inbox on the left. Capture, Feed, and You fill this pane.</p>
						</div>
					) : (
						tabScreen
					)}
				</div>
				{film ? <div className="desk-film">{overlays("film")}</div> : null}
			</div>
		);
	}

	return (
		<div className="app">
			<div className="pager">
				{tab === "inbox" ? inbox : tabScreen}
			</div>
			{!overlay && nav}
			{overlays("all")}
		</div>
	);
}
