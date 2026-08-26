export function Icon({
	name,
	size = 24,
	color = "currentColor",
}: {
	name: string;
	size?: number;
	color?: string;
}) {
	const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
	switch (name) {
		case "map":
			return <svg {...p}><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" /><path d="M9 3v15M15 6v15" /></svg>;
		case "chat":
			return <svg {...p}><path d="M21 12a8.5 8.5 0 01-12 7.7L3 21l1.4-5A8.5 8.5 0 1121 12z" /></svg>;
		case "user":
			return <svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.5 3.5-5 7-5s5.8 1.5 7 5" /></svg>;
		case "feed":
			return <svg {...p}><rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /></svg>;
		case "stories":
			return <svg {...p}><rect x="3" y="5" width="14" height="14" rx="3" /><path d="M8 3h11a2 2 0 012 2v11" /></svg>;
		case "spotlight":
			return <svg {...p}><polygon points="8,5 19,12 8,19" /></svg>;
		case "search":
			return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
		case "add":
			return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
		case "close":
			return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
		case "chevron":
			return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>;
		case "back":
			return <svg {...p}><path d="M15 6l-6 6 6 6" /></svg>;
		case "send":
			return <svg {...p} fill={color} stroke="none"><path d="M3 11.5L21 3l-7 18-2.5-7.5L3 11.5z" /></svg>;
		case "cam":
			return <svg {...p}><path d="M4 8h4l2-3h4l2 3h4v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
		case "flip":
			return <svg {...p}><path d="M4 12a8 8 0 0114.5-4.5M20 12a8 8 0 01-14.5 4.5" /><path d="M18 3v5h-5M6 21v-5h5" /></svg>;
		case "flash":
			return <svg {...p}><path d="M13 2L4 14h7l-1 8 10-13h-8l1-7z" /></svg>;
		case "download":
			return <svg {...p}><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>;
		case "text":
			return <svg {...p}><path d="M5 6h14M12 6v14" /></svg>;
		case "pen":
			return <svg {...p}><path d="M4 20l4.5-1.5L19 8l-3-3L5.5 15.5 4 20z" /></svg>;
		case "sticker":
			return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5M9 10h.01M15 10h.01" /></svg>;
		case "timer":
			return <svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 3h6" /></svg>;
		case "check":
			return <svg {...p}><path d="M5 12l5 5 9-9" /></svg>;
		case "phone":
			return <svg {...p}><path d="M6 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z" /></svg>;
		case "video":
			return <svg {...p}><rect x="3" y="7" width="12" height="10" rx="2" /><path d="M15 11l6-3v8l-6-3z" /></svg>;
		case "mic":
			return <svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>;
		case "gear":
			return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
		case "off":
			return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M8 8l8 8" /></svg>;
		case "skull":
			return <svg {...p}><ellipse cx="12" cy="11" rx="7" ry="8" /><circle cx="9" cy="11" r="1.4" fill={color} stroke="none" /><circle cx="15" cy="11" r="1.4" fill={color} stroke="none" /><path d="M12 13v3M9 17h6" /></svg>;
		case "fire":
			return <svg {...p}><path d="M12 3c2 4-1 5 1 8 1.2 1.8 4 2.2 4 6a5 5 0 11-10 0c0-3 2-5 3-8 1-2.5-1-4.2 2-6z" /></svg>;
		case "crown":
			return <svg {...p}><path d="M4 16l1-9 5 5 3-7 3 7 5-5 1 9H4z" /></svg>;
		case "shades":
			return <svg {...p}><path d="M3 10h18M5 10h5v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4zm9 0h5v4a2 2 0 01-2 2h-1a2 2 0 01-2-2v-4z" /></svg>;
		case "ember":
			return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" /></svg>;
		case "mem":
			return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 16l-5-5-4 4-2-2-5 5" /></svg>;
		case "heart":
			return <svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 017-2 4 4 0 017 2c0 5.6-7 10-7 10z" /></svg>;
		case "share":
			return <svg {...p}><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11l8-4M8 13l8 4" /></svg>;
		case "loc":
			return <svg {...p}><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" /></svg>;
		default:
			return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
	}
}
