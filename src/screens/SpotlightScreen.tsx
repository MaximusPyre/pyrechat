import { useEffect, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { EMBER } from "../lib/brand";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";

type Item = {
	id: string;
	user_id: string;
	media_key: string;
	caption: string;
	hearts: number;
	hearted: number;
	username: string;
	display_name: string;
	skullmoji: string;
};

export function SpotlightScreen({ startAt = 0 }: { startAt?: number }) {
	const [items, setItems] = useState<Item[]>([]);
	const [i, setI] = useState(startAt);
	useEffect(() => {
		void api<{ items: Item[] }>("/api/spotlight").then((r) => {
			setItems(r.items);
			setI(Math.min(startAt, Math.max(0, r.items.length - 1)));
		});
	}, [startAt]);
	const cur = items[i];
	if (!cur) {
		return (
			<div className="page">
				<div className="empty" style={{ paddingTop: 160 }}>
					Spotlight is empty. Newest Pyres show first, in order. Nobody is ranking you.
				</div>
			</div>
		);
	}
	return (
		<div className="spotlight"
			onWheel={(e) => {
				if (e.deltaY > 20) setI((n) => Math.min(items.length - 1, n + 1));
				if (e.deltaY < -20) setI((n) => Math.max(0, n - 1));
			}}
			onPointerUp={(e) => {
				const y = e.clientY;
				if (y < window.innerHeight / 3) setI((n) => Math.max(0, n - 1));
				if (y > (window.innerHeight * 2) / 3) setI((n) => Math.min(items.length - 1, n + 1));
			}}
		>
			<div className="spot-item">
				{cur.media_key.endsWith(".webm") ? (
					<video src={mediaUrl(cur.media_key)} autoPlay loop muted playsInline />
				) : (
					<img src={mediaUrl(cur.media_key)} alt="" />
				)}
			</div>
			<div className="spot-meta">
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<SkullmojiAvatar value={cur.skullmoji} size={32} />
					<strong>@{cur.username}</strong>
				</div>
				<p>{cur.caption}</p>
			</div>
			<div className="spot-actions">
				<button
					className="icon-btn"
					onClick={async (e) => {
						e.stopPropagation();
						const r = await api<{ hearted: boolean }>(`/api/spotlight/${cur.id}/heart`, { method: "POST" });
						setItems((all) =>
							all.map((x) =>
								x.id === cur.id
									? { ...x, hearted: r.hearted ? 1 : 0, hearts: x.hearts + (r.hearted ? 1 : -1) }
									: x,
							),
						);
					}}
				>
					<Icon name="heart" color={cur.hearted ? EMBER : "#fff"} />
				</button>
				<span className="heart">{cur.hearts}</span>
				<button className="icon-btn"><Icon name="share" /></button>
			</div>
		</div>
	);
}
