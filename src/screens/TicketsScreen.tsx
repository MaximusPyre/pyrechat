import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Icon } from "../components/Icon";

type Ticket = {
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
};

const STATUS: Record<Ticket["status"], string> = {
	queued: "In queue",
	working: "Bot is on it",
	shipped: "Shipped",
	skipped: "Skipped",
	failed: "Failed",
};

export function TicketsScreen({ founder, onBack }: { founder?: boolean; onBack: () => void }) {
	const [kind, setKind] = useState<Ticket["kind"]>("bug");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [items, setItems] = useState<Ticket[]>([]);
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);
	const [closed, setClosed] = useState(false);

	const load = useCallback(async () => {
		try {
			const r = await api<{ tickets: Ticket[] }>("/api/tickets");
			setItems(r.tickets);
			setClosed(false);
		} catch (e) {
			if (e instanceof ApiError && e.status === 404) setClosed(true);
			else setMsg(e instanceof Error ? e.message : "Could not load tickets");
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function submit() {
		setMsg("");
		setBusy(true);
		try {
			await api("/api/tickets", {
				method: "POST",
				body: JSON.stringify({ kind, title, body }),
			});
			setTitle("");
			setBody("");
			setMsg("Filed. The beta bot will audit it and write back here.");
			await load();
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Could not file ticket");
		} finally {
			setBusy(false);
		}
	}

	if (closed) {
		return (
			<div className="overlay-page">
				<div className="page-head">
					<div>
						<div className="eyebrow">Beta</div>
						<h1>Tickets</h1>
					</div>
					<button className="icon-btn solid" onClick={onBack} aria-label="Close"><Icon name="close" size={20} /></button>
				</div>
				<div className="settings">
					<div className="card">Private beta tickets are closed. Thanks for helping build PyreChat.</div>
				</div>
			</div>
		);
	}

	return (
		<div className="overlay-page">
			<div className="page-head">
				<div>
					<div className="eyebrow">Beta</div>
					<h1>Tickets</h1>
				</div>
				<button className="icon-btn solid" onClick={onBack} aria-label="Close"><Icon name="close" size={20} /></button>
			</div>
			<div className="settings">
				<div className="card">
					<p className="muted" style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
						File a real bug or a feature. During private beta a builder bot audits it, implements it if it is viable, then writes the result back to your account. Nothing auto-merges.
					</p>
				</div>
				<div className="card">
					<h3>New ticket</h3>
					<select className="select" value={kind} onChange={(e) => setKind(e.target.value as Ticket["kind"])}>
						<option value="bug">Bug</option>
						<option value="feature">Feature</option>
					</select>
					<input className="field" placeholder="Short title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
					<textarea
						className="field"
						placeholder={kind === "bug" ? "What happened, where, and on which device" : "What you want and why it belongs in PyreChat"}
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={5}
						maxLength={4000}
						style={{ width: "100%", resize: "vertical", minHeight: 96 }}
					/>
					<button className="primary" disabled={busy} onClick={() => void submit()}>
						{busy ? "…" : "Send to the builder"}
					</button>
					{msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
				</div>
				{items.map((t) => (
					<div key={t.id} className="card">
						<div className="muted" style={{ fontWeight: 800, letterSpacing: "0.08em", fontSize: 11 }}>
							{t.kind.toUpperCase()} · {STATUS[t.status]}
							{founder && t.username ? ` · @${t.username}` : ""}
						</div>
						<h3 style={{ margin: "6px 0" }}>{t.title}</h3>
						<p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap", fontWeight: 600 }}>{t.body}</p>
						{t.note && <p className="muted" style={{ marginTop: 8 }}>{t.note}</p>}
						{t.prUrl && (
							<a className="link" href={t.prUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
								Pull request
							</a>
						)}
					</div>
				))}
				{items.length === 0 && <div className="empty">No tickets yet. First one through the door sets the tone.</div>}
			</div>
		</div>
	);
}
