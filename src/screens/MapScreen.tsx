import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { Icon } from "../components/Icon";

type FriendPin = {
	id: string;
	username: string;
	display_name: string;
	skullmoji: string;
	lat: number;
	lng: number;
	activity: string;
};

export function MapScreen({ me, onProfile }: { me: User; onProfile: () => void }) {
	const divRef = useRef<HTMLDivElement>(null);
	const [mode, setMode] = useState(me.mapMode);
	const [count, setCount] = useState(0);

	useEffect(() => {
		let map: import("leaflet").Map | undefined;
		let cancelled = false;
		void (async () => {
			const L = await import("leaflet");
			if (!divRef.current || cancelled) return;
			map = L.map(divRef.current, { zoomControl: false, attributionControl: false }).setView([39.5, -98.3], 4);
			L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
			try {
				const pos = await new Promise<GeolocationPosition>((res, rej) =>
					navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 }),
				);
				await api("/api/map", {
					method: "POST",
					body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, activity: "active" }),
				});
				map.setView([pos.coords.latitude, pos.coords.longitude], 12);
			} catch {
				/* location optional */
			}
			const data = await api<{ friends: FriendPin[]; me: { lat: number; lng: number } | null; mapMode: string; hotspots: { lat: number; lng: number; n: number }[] }>("/api/map");
			setMode(data.mapMode);
			setCount(data.friends.length);
			if (data.me) {
				L.circleMarker([data.me.lat, data.me.lng], { radius: 10, color: "#ff6a1a", fillColor: "#ff6a1a", fillOpacity: 1 }).addTo(map);
			}
			for (const f of data.friends) {
				const icon = L.divIcon({
					className: "",
					html: `<div style="width:36px;height:36px;border-radius:50%;background:#111;border:2px solid #ff6a1a"></div>`,
					iconSize: [36, 36],
				});
				L.marker([f.lat, f.lng], { icon }).addTo(map).bindPopup(`${f.display_name} · ${f.activity}`);
			}
			for (const h of data.hotspots || []) {
				L.circleMarker([h.lat, h.lng], { radius: 8 + Math.min(h.n, 12), color: "#ff6a1a", fillOpacity: 0.25 }).addTo(map);
			}
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	}, []);

	async function toggleSkull() {
		const next = mode === "skull" ? "friends" : "skull";
		await api("/api/me", { method: "PATCH", body: JSON.stringify({ mapMode: next }) });
		setMode(next);
	}

	return (
		<div className="overlay-page">
			<div ref={divRef} className="map-wrap" />
			<div className="page-head overlay">
				<div>
					<div className="eyebrow">Friends</div>
					<h1>Map</h1>
				</div>
				<button className="icon-btn solid" onClick={onProfile} aria-label="Close"><Icon name="close" size={20} /></button>
			</div>
			<button className="map-chip" onClick={() => void toggleSkull()}>
				{mode === "skull" ? "☠ Skull Mode on" : `Sharing with friends · ${count} visible`}
			</button>
		</div>
	);
}
