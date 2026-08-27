import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken } from "./lib/api";
import { openSocket } from "./lib/ws";
import type { ChatRow, Tab, User } from "./lib/types";
import { Icon } from "./components/Icon";
import { AuthScreen } from "./screens/AuthScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { ChatListScreen, ChatThreadScreen } from "./screens/ChatScreens";
import { SnapViewer, StoryViewer, type Story } from "./screens/StoriesScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { MapScreen } from "./screens/MapScreen";
import {
	AddFriendsScreen,
	CallScreen,
	FriendshipScreen,
	MemoriesScreen,
	ProfileScreen,
	SearchScreen,
	SettingsScreen,
} from "./screens/ProfileScreens";
import { TicketsScreen } from "./screens/TicketsScreen";

type Overlay =
	| { t: "settings" }
	| { t: "tickets" }
	| { t: "add" }
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

export default function App() {
	const [user, setUser] = useState<User | null>(null);
	const [booting, setBooting] = useState(true);
	const [tab, setTab] = useState<Tab>("inbox");
	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [inboxTick, setInboxTick] = useState(0);
	const [inboxSnap, setInboxSnap] = useState<string | null>(null);

	const refreshMe = useCallback(async () => {
		try {
			const r = await api<{ user: User }>("/api/me");
			setUser(r.user);
		} catch {
			setToken(null);
			setUser(null);
		}
	}, []);

	useEffect(() => {
		if (!getToken()) {
			setBooting(false);
			return;
		}
		void refreshMe().finally(() => setBooting(false));
	}, [refreshMe]);

	useEffect(() => {
		if (!user) return;
		const ws = openSocket("/api/ws/hub");
		ws.onmessage = (ev) => {
			try {
				const m = JSON.parse(ev.data as string) as { type?: string; snapId?: string; kind?: string };
				if (m.type === "snap" && m.snapId) setInboxSnap(m.snapId);
				if (m.kind === "snap" && m.snapId) setInboxSnap(m.snapId);
				if (m.type === "chat" || m.type === "message") setInboxTick((n) => n + 1);
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
			void api("/api/friends/add", { method: "POST", body: JSON.stringify({ username: decodeURIComponent(add[1]) }) });
			history.replaceState({}, "", "/");
			setOverlay({ t: "add" });
		}
	}, [user]);

	if (booting) {
		return (
			<div className="auth">
				<div className="muted">PyreChat</div>
			</div>
		);
	}
	if (!user) return <AuthScreen onAuthed={setUser} />;

	return (
		<div className="app">
			<div className="pager">
				{tab === "inbox" && (
					<ChatListScreen
						refreshKey={inboxTick}
						onOpen={(chat) => {
							if (chat.unopenedSnaps) {
								void api<{ snaps: { snap_id: string; viewed_at: string | null; conversation_id: string }[] }>("/api/inbox").then((r) => {
									const hit = r.snaps.find((s) => !s.viewed_at && s.conversation_id === chat.id);
									if (hit) setOverlay({ t: "snap", id: hit.snap_id });
									else setOverlay({ t: "thread", chat });
								});
							} else setOverlay({ t: "thread", chat });
						}}
						onSearch={() => setOverlay({ t: "search" })}
						onAdd={() => setOverlay({ t: "add" })}
					/>
				)}
				{tab === "capture" && (
					<CameraScreen onOpenMemories={() => setOverlay({ t: "memories" })} />
				)}
				{tab === "feed" && (
					<FeedScreen
						onSearch={() => setOverlay({ t: "search" })}
						onAdd={() => setOverlay({ t: "add" })}
						onOpenStory={(items, i) => setOverlay({ t: "story", items, i })}
					/>
				)}
				{tab === "you" && (
					<ProfileScreen
						embedded
						me={user}
						onBack={() => setTab("inbox")}
						onSettings={() => setOverlay({ t: "settings" })}
						onAdd={() => setOverlay({ t: "add" })}
						onMemories={() => setOverlay({ t: "memories" })}
						onMap={() => setOverlay({ t: "map" })}
						refresh={() => void refreshMe()}
					/>
				)}
			</div>
			{!overlay && (
				<nav className={`nav ${tab === "capture" ? "over-cam" : ""}`}>
					{TABS.map((t) => (
						<button
							key={t.id}
							className={`nav-item ${tab === t.id ? "on" : ""}`}
							onClick={() => setTab(t.id)}
						>
							<Icon name={t.icon} size={22} color={tab === t.id ? "#ff6a1a" : "#9a9a9a"} />
							<span>{t.label}</span>
						</button>
					))}
				</nav>
			)}

			{overlay?.t === "settings" && (
				<SettingsScreen
					me={user}
					onBack={() => setOverlay(null)}
					onTickets={user.betaTickets ? () => setOverlay({ t: "tickets" }) : undefined}
					onLoggedOut={() => {
						setUser(null);
						setOverlay(null);
					}}
				/>
			)}
			{overlay?.t === "tickets" && (
				<TicketsScreen founder={user.founder} onBack={() => setOverlay({ t: "settings" })} />
			)}
			{overlay?.t === "add" && <AddFriendsScreen onBack={() => setOverlay(null)} />}
			{overlay?.t === "memories" && <MemoriesScreen onBack={() => setOverlay(null)} />}
			{overlay?.t === "search" && (
				<SearchScreen
					onBack={() => setOverlay(null)}
					onAdd={() => setOverlay({ t: "add" })}
				/>
			)}
			{overlay?.t === "map" && <MapScreen me={user} onProfile={() => setOverlay(null)} />}
			{overlay?.t === "thread" && (
				<ChatThreadScreen
					chat={overlay.chat}
					me={{ id: user.id, display_name: user.displayName, skullmoji: user.skullmoji }}
					onBack={() => setOverlay(null)}
					onSnap={() => { setOverlay(null); setTab("capture"); }}
					onCall={() => setOverlay({ t: "call", name: overlay.chat.members[0]?.display_name || "Friend" })}
					onFriend={() => overlay.chat.members[0] && setOverlay({ t: "friend", id: overlay.chat.members[0].id })}
				/>
			)}
			{overlay?.t === "snap" && <SnapViewer id={overlay.id} onClose={() => setOverlay(null)} />}
			{overlay?.t === "story" && <StoryViewer items={overlay.items} start={overlay.i} onClose={() => setOverlay(null)} />}
			{overlay?.t === "friend" && <FriendshipScreen id={overlay.id} onBack={() => setOverlay(null)} />}
			{overlay?.t === "call" && <CallScreen peerName={overlay.name} onEnd={() => setOverlay(null)} />}
			{inboxSnap && !overlay && <SnapViewer id={inboxSnap} onClose={() => setInboxSnap(null)} />}
		</div>
	);
}
