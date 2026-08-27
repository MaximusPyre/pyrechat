/// <reference types="vite/client" />

export type Skullmoji = {
	color: string;
	eyes: "hollow" | "dots" | "fire";
	jaw: "grin" | "flat" | "open";
	hat: "none" | "crown" | "bandana" | "shades";
	bg: string;
};

export type User = {
	id: string;
	username: string;
	displayName: string;
	bio: string;
	skullmoji: Skullmoji;
	snapScore: number;
	storyPrivacy: string;
	whoCanContact: string;
	mapMode: string;
	mapSelected: string[];
	birthday: string | null;
	phone: string | null;
	email: string | null;
	createdAt: string;
	lastActive: string | null;
	founder?: boolean;
	kindling?: boolean;
	betaTickets?: boolean;
	hasRecovery?: boolean;
};

export type Friend = {
	id: string;
	username: string;
	display_name: string;
	skullmoji: string;
	snap_score: number;
	last_active: string | null;
	status: string;
	streak: number | null;
	streak_expires: string | null;
	streak_record: number | null;
	kindling?: number | boolean;
};

export type ChatRow = {
	id: string;
	is_group: number;
	name: string | null;
	members: { id: string; username: string; display_name: string; skullmoji: string; last_active: string | null; kindling?: number | boolean; story_key?: string | null; story_kind?: string | null }[];
	last: { kind: string; body: string; created_at: string; sender_id: string } | null;
	unopenedSnaps: number;
	streak: number;
	streakExpires: string | null;
	created_at: string;
};

export type Tab = "inbox" | "capture" | "feed" | "you";

export type TicketAttachment = {
	id: string;
	name: string;
	contentType: string;
	size: number;
	url: string;
	image: boolean;
};

export type Ticket = {
	id: string;
	kind: "bug" | "feature";
	title: string;
	body: string;
	status: "queued" | "working" | "shipped" | "skipped" | "failed";
	agentUrl: string | null;
	prUrl: string | null;
	note: string | null;
	createdAt: string;
	username?: string;
	attachments?: TicketAttachment[];
};
