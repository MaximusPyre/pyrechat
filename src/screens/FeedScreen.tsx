import { useEffect, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";
import { StoriesScreen, type Story } from "./StoriesScreen";
import { SpotlightScreen } from "./SpotlightScreen";

type LiveItem = {
	id: string;
	media_key: string;
	caption: string;
	hearts: number;
	username: string;
	display_name: string;
	skullmoji: string;
};

export function FeedScreen({
	onSearch,
	onAdd,
	onOpenStory,
}: {
	onSearch: () => void;
	onAdd: () => void;
	onOpenStory: (items: Story[], i: number) => void;
}) {
	const [live, setLive] = useState<LiveItem[]>([]);
	const [showLive, setShowLive] = useState<number | null>(null);

	useEffect(() => {
		void api<{ items: LiveItem[] }>("/api/spotlight").then((r) => setLive(r.items));
	}, []);

	if (showLive !== null) {
		return (
			<div className="page">
				<button className="icon-btn feed-close" onClick={() => setShowLive(null)} aria-label="Close">
					<Icon name="close" />
				</button>
				<SpotlightScreen startAt={showLive} />
			</div>
		);
	}

	return (
		<div className="page stories">
			<div className="page-head">
				<div>
					<div className="eyebrow">PyreChat</div>
					<h1>Feed</h1>
				</div>
				<div className="page-head-actions">
					<button className="icon-btn solid" onClick={onSearch} aria-label="Search"><Icon name="search" size={20} /></button>
					<button className="icon-btn solid" onClick={onAdd} aria-label="Add friends"><Icon name="add" size={20} /></button>
				</div>
			</div>
			<StoriesScreen embedded onSearch={onSearch} onAdd={onAdd} onOpen={onOpenStory} />
			<div className="section">Public · newest first</div>
			{live.length === 0 && <div className="empty">Nothing public yet. Capture something and post it.</div>}
			<div className="feed-grid">
				{live.map((item, i) => (
					<button key={item.id} className="feed-card" onClick={() => setShowLive(i)}>
						{item.media_key.endsWith(".webm") || item.media_key.endsWith(".mp4") ? (
							<video src={mediaUrl(item.media_key)} muted playsInline />
						) : (
							<img src={mediaUrl(item.media_key)} alt="" />
						)}
						<div className="feed-card-meta">
							<SkullmojiAvatar value={item.skullmoji} size={22} />
							<span>{item.display_name || item.username}</span>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
