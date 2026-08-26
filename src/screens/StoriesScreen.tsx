import { useEffect, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";

export type Story = {
	id: string;
	user_id: string;
	media_key: string;
	kind: string;
	caption: string;
	created_at: string;
	username?: string;
	display_name?: string;
	skullmoji?: string;
};

export function StoriesScreen({
	onProfile,
	onSearch,
	onAdd,
	onOpen,
	embedded,
}: {
	onProfile?: () => void;
	onSearch: () => void;
	onAdd: () => void;
	onOpen: (items: Story[], i: number) => void;
	embedded?: boolean;
}) {
	const [mine, setMine] = useState<Story[]>([]);
	const [friends, setFriends] = useState<Story[]>([]);
	const [discover, setDiscover] = useState<Story[]>([]);

	useEffect(() => {
		void api<{ mine: Story[]; friends: Story[]; discover: Story[] }>("/api/stories").then((r) => {
			setMine(r.mine);
			setFriends(r.friends);
			setDiscover(r.discover);
		});
	}, []);

	const friendGroups = groupByUser(friends);

	return (
		<div className={embedded ? "stories-embed" : "page stories"}>
			{!embedded && (
			<div className="top">
				<button className="icon-btn" onClick={onProfile}><SkullmojiAvatar size={36} /></button>
				<button className="search-pill" onClick={onSearch}><Icon name="search" size={18} /><span>Stories</span></button>
				<button className="icon-btn" onClick={onAdd}><Icon name="add" /></button>
			</div>
			)}
			<div className={embedded ? "" : "list"}>
				<div className="section">Friends</div>
				<div className="story-row">
					<button className="story-item" onClick={() => mine.length && onOpen(mine, 0)}>
						<SkullmojiAvatar ring={mine.length > 0} size={64} />
						<span>My Story</span>
					</button>
					{friendGroups.map((g) => (
						<button key={g.userId} className="story-item" onClick={() => onOpen(g.items, 0)}>
							<SkullmojiAvatar value={g.items[0].skullmoji} ring size={64} />
							<span>{g.items[0].display_name}</span>
						</button>
					))}
				</div>
				{!embedded && (
					<>
				<div className="section">Newest public</div>
				{discover.map((s, i) => (
					<button key={s.id} className="row" onClick={() => onOpen(discover, i)}>
						<SkullmojiAvatar value={s.skullmoji} ring />
						<div className="row-body">
							<div className="row-title">{s.display_name || s.username}</div>
							<div className="row-sub">{s.caption || "Story"}</div>
						</div>
					</button>
				))}
				{discover.length === 0 && <div className="empty">Public stories, newest first. No For You page.</div>}
					</>
				)}
			</div>
		</div>
	);
}

function groupByUser(stories: Story[]): { userId: string; items: Story[] }[] {
	const map = new Map<string, Story[]>();
	for (const s of stories) {
		const arr = map.get(s.user_id) || [];
		arr.push(s);
		map.set(s.user_id, arr);
	}
	return [...map.entries()].map(([userId, items]) => ({ userId, items }));
}

export function StoryViewer({
	items,
	start,
	onClose,
}: {
	items: Story[];
	start: number;
	onClose: () => void;
}) {
	const [i, setI] = useState(start);
	const s = items[i];
	useEffect(() => {
		if (!s) return;
		void api(`/api/stories/${s.id}/view`, { method: "POST" });
		const t = window.setTimeout(() => {
			if (i + 1 < items.length) setI(i + 1);
			else onClose();
		}, 5000);
		return () => window.clearTimeout(t);
	}, [i, items, onClose, s]);
	if (!s) return null;
	return (
		<div className="viewer" onClick={() => (i + 1 < items.length ? setI(i + 1) : onClose())}>
			<div className="timer-bar"><i style={{ animationDuration: "5s" }} /></div>
			<div className="top">
				<SkullmojiAvatar value={s.skullmoji} size={32} />
				<strong>{s.display_name || "Story"}</strong>
				<button className="icon-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}><Icon name="close" /></button>
			</div>
			{s.kind === "video" ? <video src={mediaUrl(s.media_key)} autoPlay playsInline /> : <img src={mediaUrl(s.media_key)} alt="" />}
			{s.caption && <div className="spot-meta" style={{ bottom: 40 }}>{s.caption}</div>}
		</div>
	);
}

export function SnapViewer({ id, onClose }: { id: string; onClose: () => void }) {
	const [data, setData] = useState<{ url: string; kind: string; duration_sec: number; caption: string; display_name: string; overlay?: { caption?: string } } | null>(null);
	const [gone, setGone] = useState(false);
	useEffect(() => {
		void (async () => {
			try {
				const snap = await api<{ url: string; kind: string; duration_sec: number; caption: string; display_name: string; overlay?: { caption?: string } }>(`/api/snaps/${id}`);
				setData(snap);
				await api(`/api/snaps/${id}/view`, { method: "POST" });
			} catch {
				setGone(true);
			}
		})();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "PrintScreen") void api(`/api/snaps/${id}/screenshot`, { method: "POST" });
		};
		window.addEventListener("keyup", onKey);
		return () => window.removeEventListener("keyup", onKey);
	}, [id]);
	useEffect(() => {
		if (!data) return;
		const t = window.setTimeout(onClose, (data.duration_sec || 5) * 1000);
		return () => window.clearTimeout(t);
	}, [data, onClose]);
	if (gone) {
		return (
			<div className="viewer" onClick={onClose}>
				<div className="empty">This Pyre is gone.</div>
			</div>
		);
	}
	if (!data) return <div className="viewer" />;
	return (
		<div className="viewer" onClick={onClose}>
			<div className="timer-bar"><i style={{ animationDuration: `${data.duration_sec || 5}s` }} /></div>
			<div className="top"><strong>{data.display_name}</strong></div>
			{data.kind === "video" ? <video src={data.url} autoPlay playsInline /> : <img src={data.url} alt="" />}
			{(data.caption || data.overlay?.caption) && (
				<div className="spot-meta" style={{ bottom: 40 }}>{data.caption || data.overlay?.caption}</div>
			)}
		</div>
	);
}
