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
	betaTickets?: boolean;
};

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
	kind: "bug" | "feature" | string;
	title: string;
	body: string;
	status: "queued" | "working" | "shipped" | "skipped" | "failed" | string;
	note: string | null;
	prUrl: string | null;
	agentUrl?: string | null;
	rollout?: string | null;
	createdAt: string;
	updatedAt: string;
	username?: string;
	attachments: TicketAttachment[];
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
};

export type ChatRow = {
	id: string;
	is_group: number;
	name: string | null;
	members: { id: string; username: string; display_name: string; skullmoji: string; last_active: string | null }[];
	last: { kind: string; body: string; created_at: string; sender_id: string } | null;
	unopenedSnaps: number;
	streak: number;
	streakExpires: string | null;
	created_at: string;
};

export type Tab = "inbox" | "capture" | "feed" | "you";
