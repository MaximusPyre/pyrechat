import type { CSSProperties } from "react";
import type { Skullmoji } from "../lib/types";

const DEFAULT: Skullmoji = {
	color: "#c45e32",
	eyes: "hollow",
	jaw: "grin",
	hat: "none",
	bg: "#1c2124",
};

export function parseSkullmoji(raw: unknown): Skullmoji {
	if (!raw) return DEFAULT;
	if (typeof raw === "string") {
		try {
			return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Skullmoji>) };
		} catch {
			return DEFAULT;
		}
	}
	if (typeof raw === "object") return { ...DEFAULT, ...(raw as Partial<Skullmoji>) };
	return DEFAULT;
}

export function SkullmojiAvatar({
	value,
	size = 44,
	ring,
	preview,
}: {
	value?: unknown;
	size?: number;
	ring?: boolean;
	preview?: string | null;
}) {
	const s = parseSkullmoji(value);
	const style: CSSProperties = {
		width: size,
		height: size,
		borderRadius: "50%",
		background: s.bg,
		display: "grid",
		placeItems: "center",
		flexShrink: 0,
		overflow: "hidden",
		position: "relative",
		boxShadow: ring || preview ? "0 0 0 2px #141618, 0 0 0 4px #4d8a8e" : undefined,
	};
	const media = preview ? (
		preview.match(/\.(webm|mp4|mov)(\?|$)/i) ? (
			<video src={preview} muted playsInline autoPlay loop style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
		) : (
			<img src={preview} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
		)
	) : null;
	const eye =
		s.eyes === "dots" ? (
			<>
				<circle cx="20" cy="28" r="3.2" fill={s.color} />
				<circle cx="44" cy="28" r="3.2" fill={s.color} />
			</>
		) : s.eyes === "fire" ? (
			<>
				<path d="M16 32c0-6 4-10 4-10s4 4 4 10-2.2 6-4 6-4-2.4-4-6Z" fill={s.color} />
				<path d="M40 32c0-6 4-10 4-10s4 4 4 10-2.2 6-4 6-4-2.4-4-6Z" fill={s.color} />
			</>
		) : (
			<>
				<ellipse cx="20" cy="28" rx="5.2" ry="6.2" />
				<ellipse cx="44" cy="28" rx="5.2" ry="6.2" />
			</>
		);
	const jaw =
		s.jaw === "open" ? (
			<path d="M24 48c2.4 4 6 6 8 6s5.6-2 8-6" />
		) : s.jaw === "flat" ? (
			<path d="M26 50h12" />
		) : (
			<path d="M24 46.5c2.4 2.4 5.2 3.5 8 3.5s5.6-1.1 8-3.5" />
		);
	const hat =
		s.hat === "crown" ? (
			<path d="M16 14l6 8 10-10 10 10 6-8-4 16H20L16 14Z" fill={s.color} stroke={s.color} />
		) : s.hat === "bandana" ? (
			<path d="M12 20c8-8 32-8 40 0-10 4-30 4-40 0Z" fill={s.color} stroke="none" />
		) : s.hat === "shades" ? (
			<>
				<rect x="12" y="24" width="18" height="10" rx="2" fill="#111" stroke="#fff" />
				<rect x="34" y="24" width="18" height="10" rx="2" fill="#111" stroke="#fff" />
				<path d="M30 28h4" />
			</>
		) : null;
	return (
		<div style={style} aria-hidden>
			{media}
			<svg viewBox="0 0 64 64" width={size * 0.78} height={size * 0.78} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" style={{ position: "relative", opacity: media ? 0 : 1 }}>
				{hat}
				<path d="M32 10c10.5 0 18 7.2 18 18 0 5-1.4 8.8-3.6 12l1.8 9.2c.3 1.5-.8 3-2.4 3.3H18.2c-1.6-.3-2.7-1.8-2.4-3.3l1.8-9.2C15.4 36.8 14 33 14 28 14 17.2 21.5 10 32 10Z" />
				{eye}
				<path d="M32 36.2v4.6" />
				{jaw}
				<path d="M26 52h12" />
			</svg>
		</div>
	);
}

export function SkullLogo({ size = 72, orange = false }: { size?: number; orange?: boolean }) {
	const stroke = orange ? "#c45e32" : "#f3eee6";
	return (
		<svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
			<path d="M32 8c10.5 0 20 7.6 20 20 0 5.2-1.5 9.2-4 12.6l2 10.2c.4 1.7-.9 3.4-2.7 3.8H16.7c-1.8-.4-3.1-2.1-2.7-3.8l2-10.2C13.5 37.2 12 33.2 12 28 12 15.6 21.5 8 32 8Z" />
			<ellipse cx="23.5" cy="28" rx="5.2" ry="6.2" />
			<ellipse cx="40.5" cy="28" rx="5.2" ry="6.2" />
			<path d="M32 36.2v5.2" />
			<path d="M25.2 46.5c2 2 4.4 3 6.8 3s4.8-1 6.8-3" />
			<path d="M27 51h10" />
		</svg>
	);
}
