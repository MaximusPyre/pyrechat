import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Icon } from "../components/Icon";
import { SkullmojiAvatar } from "../components/Skull";
import { DisplayName } from "../components/DisplayName";

type Person = { id: string; username: string; display_name: string; skullmoji: string; kindling?: number | boolean };
type Pane = "home" | "sent" | "hidden" | "deleted";

const HOME_PREVIEW = 8;

export function AddFriendsScreen({ onBack, pendingUsername }: { onBack: () => void; pendingUsername?: string }) {
	const [q, setQ] = useState("");
	const [pane, setPane] = useState<Pane>("home");
	const [menu, setMenu] = useState(false);
	const [incoming, setIncoming] = useState<Person[]>([]);
	const [sent, setSent] = useState<Person[]>([]);
	const [hidden, setHidden] = useState<Person[]>([]);
	const [deleted, setDeleted] = useState<Person[]>([]);
	const [quick, setQuick] = useState<Person[]>([]);
	const [hits, setHits] = useState<Person[]>([]);
	const [busy, setBusy] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [showAllIncoming, setShowAllIncoming] = useState(false);
	const [showAllQuick, setShowAllQuick] = useState(false);
	const [confirmName, setConfirmName] = useState(pendingUsername?.trim() || "");

	useEffect(() => {
		if (pendingUsername?.trim()) setConfirmName(pendingUsername.trim());
	}, [pendingUsername]);

	const load = useCallback(() => {
		void api<{
			incoming: Person[];
			sent: Person[];
			hidden: Person[];
			deleted: Person[];
			suggestions: Person[];
		}>("/api/friends/adds").then((r) => {
			setIncoming(r.incoming);
			setSent(r.sent);
			setHidden(r.hidden);
			setDeleted(r.deleted);
			setQuick(r.suggestions);
			setReady(true);
		});
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		const t = window.setTimeout(() => {
			if (!q.trim()) {
				setHits([]);
				return;
			}
			void api<{ users: Person[] }>(`/api/users/search?q=${encodeURIComponent(q.trim())}`).then((r) => setHits(r.users));
		}, 200);
		return () => window.clearTimeout(t);
	}, [q]);

	async function run(id: string, fn: () => Promise<unknown>) {
		if (busy) return;
		setBusy(id);
		try {
			await fn();
			load();
		} finally {
			setBusy(null);
		}
	}

	function add(id: string) {
		return run(id, () => api("/api/friends/add", { method: "POST", body: JSON.stringify({ userId: id }) }));
	}
	async function addByUsername(username: string) {
		if (busy) return;
		setBusy(username);
		try {
			await api("/api/friends/add", { method: "POST", body: JSON.stringify({ username }) });
			setConfirmName("");
			load();
		} finally {
			setBusy(null);
		}
	}
	function dismiss(id: string, kind: "hidden" | "deleted") {
		return run(id, () => api("/api/friends/dismiss", { method: "POST", body: JSON.stringify({ userId: id, kind }) }));
	}
	function restore(id: string) {
		return run(id, () => api("/api/friends/restore", { method: "POST", body: JSON.stringify({ userId: id }) }));
	}
	function cancel(id: string) {
		return run(id, () => api("/api/friends/remove", { method: "POST", body: JSON.stringify({ userId: id }) }));
	}

	const searching = q.trim().length > 0;
	const titles: Record<Pane, string> = {
		home: "Add Friends",
		sent: "Sent",
		hidden: "Hidden",
		deleted: "Deleted",
	};
	const incomingShown = showAllIncoming ? incoming : incoming.slice(0, HOME_PREVIEW);
	const quickShown = showAllQuick ? quick : quick.slice(0, HOME_PREVIEW);

	return (
		<div className="add-friends">
			<header className="add-friends-head">
				<div className="add-friends-titlebar">
					<button
						className="icon-btn ghost"
						onClick={() => (pane === "home" ? onBack() : setPane("home"))}
						aria-label={pane === "home" ? "Close" : "Back"}
					>
						<Icon name={pane === "home" ? "down" : "back"} size={22} />
					</button>
					<h1>{titles[pane]}</h1>
					<button className="icon-btn ghost" onClick={() => setMenu(true)} aria-label="More">
						<Icon name="more" size={22} />
					</button>
				</div>
				<label className="add-friends-search">
					<Icon name="search" size={18} color="#8d8d93" />
					<input
						placeholder="Find friends"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						autoComplete="off"
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						enterKeyHint="search"
						inputMode="search"
						data-lpignore="true"
						data-1p-ignore="true"
						data-form-type="other"
					/>
				</label>
			</header>

			<div className="add-friends-body">
				{searching ? (
					<>
						{hits.length === 0 && <div className="add-empty">No people match “{q.trim()}”.</div>}
						{hits.map((u) => (
							<PersonRow
								key={u.id}
								person={u}
								source=""
								busy={busy === u.id}
								primary={{ label: "Add", onClick: () => void add(u.id) }}
							/>
						))}
					</>
				) : pane === "home" ? (
					<>
						<section>
							<div className="add-sec">
								<h2>Added Me</h2>
							</div>
							{ready && incoming.length === 0 && <div className="add-empty sm">No pending adds.</div>}
							{incomingShown.map((u) => (
								<PersonRow
									key={u.id}
									person={u}
									source="Added you"
									busy={busy === u.id}
									primary={{ label: "Accept", filled: true, onClick: () => void add(u.id) }}
									onDismiss={() => void dismiss(u.id, "deleted")}
								/>
							))}
							{incoming.length > HOME_PREVIEW && !showAllIncoming && (
								<button className="add-more" onClick={() => setShowAllIncoming(true)}>
									View {incoming.length - HOME_PREVIEW} more
								</button>
							)}
						</section>
						<section>
							<div className="add-sec">
								<h2>Quick Add</h2>
							</div>
							{ready && quick.length === 0 && <div className="add-empty sm">Nobody new right now.</div>}
							{quickShown.map((u) => (
								<PersonRow
									key={u.id}
									person={u}
									source="New on PyreChat"
									busy={busy === u.id}
									primary={{ label: "Add", onClick: () => void add(u.id) }}
									onDismiss={() => void dismiss(u.id, "hidden")}
								/>
							))}
							{quick.length > HOME_PREVIEW && !showAllQuick && (
								<button className="add-more" onClick={() => setShowAllQuick(true)}>
									View {quick.length - HOME_PREVIEW} more
								</button>
							)}
						</section>
					</>
				) : pane === "sent" ? (
					<>
						<p className="add-hint">Adds you sent that haven’t been accepted yet.</p>
						{ready && sent.length === 0 && <div className="add-empty">Nothing waiting.</div>}
						{sent.map((u) => (
							<PersonRow
								key={u.id}
								person={u}
								source="Waiting"
								busy={busy === u.id}
								primary={{ label: "Requested", disabled: true, onClick: () => undefined }}
								onDismiss={() => void cancel(u.id)}
							/>
						))}
					</>
				) : pane === "hidden" ? (
					<>
						<p className="add-hint">People you hid from Quick Add. Unhide to see them again.</p>
						{ready && hidden.length === 0 && <div className="add-empty">Nobody hidden.</div>}
						{hidden.map((u) => (
							<PersonRow
								key={u.id}
								person={u}
								source="Hidden"
								busy={busy === u.id}
								primary={{ label: "Unhide", onClick: () => void restore(u.id) }}
								secondary={{ label: "Add", onClick: () => void add(u.id) }}
							/>
						))}
					</>
				) : (
					<>
						<p className="add-hint">Adds you ignored. Undo to put them back in Added Me.</p>
						{ready && deleted.length === 0 && <div className="add-empty">Nobody deleted.</div>}
						{deleted.map((u) => (
							<PersonRow
								key={u.id}
								person={u}
								source="Ignored"
								busy={busy === u.id}
								primary={{ label: "Undo", onClick: () => void restore(u.id) }}
								secondary={{ label: "Accept", filled: true, onClick: () => void add(u.id) }}
							/>
						))}
					</>
				)}
			</div>

			{confirmName && (
				<div className="sheet" onClick={() => setConfirmName("")}>
					<div className="sheet-card" onClick={(e) => e.stopPropagation()}>
						<div className="sheet-title">Add @{confirmName}?</div>
						<p className="add-hint">They will get a friend request. Nothing is sent until you confirm.</p>
						<button
							className="primary"
							disabled={!!busy}
							onClick={() => void addByUsername(confirmName)}
						>
							Send request
						</button>
						<button className="link" type="button" onClick={() => setConfirmName("")}>
							Cancel
						</button>
					</div>
				</div>
			)}
			{menu && (
				<div className="sheet" onClick={() => setMenu(false)}>
					<div className="sheet-card" onClick={(e) => e.stopPropagation()}>
						<div className="sheet-title">Manage adds</div>
						<button
							className="row"
							onClick={() => {
								setPane("sent");
								setMenu(false);
								setQ("");
							}}
						>
							<div className="row-body">
								<div className="row-title">Sent</div>
								<div className="row-sub">{sent.length} waiting</div>
							</div>
							<Icon name="chevron" color="#8d8d93" />
						</button>
						<button
							className="row"
							onClick={() => {
								setPane("hidden");
								setMenu(false);
								setQ("");
							}}
						>
							<div className="row-body">
								<div className="row-title">Hidden</div>
								<div className="row-sub">{hidden.length} hidden</div>
							</div>
							<Icon name="chevron" color="#8d8d93" />
						</button>
						<button
							className="row"
							onClick={() => {
								setPane("deleted");
								setMenu(false);
								setQ("");
							}}
						>
							<div className="row-body">
								<div className="row-title">Deleted</div>
								<div className="row-sub">{deleted.length} ignored</div>
							</div>
							<Icon name="chevron" color="#8d8d93" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function PersonRow({
	person,
	source,
	busy,
	primary,
	secondary,
	onDismiss,
}: {
	person: Person;
	source: string;
	busy: boolean;
	primary: { label: string; filled?: boolean; disabled?: boolean; onClick: () => void };
	secondary?: { label: string; filled?: boolean; onClick: () => void };
	onDismiss?: () => void;
}) {
	return (
		<div className={`add-person${busy ? " busy" : ""}`}>
			<SkullmojiAvatar value={person.skullmoji} size={48} />
			<div className="add-person-meta">
				<div className="add-name"><DisplayName name={person.display_name} username={person.username} kindling={person.kindling} /></div>
				<div className="add-user">@{person.username}</div>
				{source ? <div className="add-src">{source}</div> : null}
			</div>
			<div className="add-actions">
				{secondary && (
					<button className={`add-pill${secondary.filled ? " filled" : ""}`} disabled={busy} onClick={secondary.onClick}>
						{secondary.label}
					</button>
				)}
				<button
					className={`add-pill${primary.filled ? " filled" : ""}`}
					disabled={busy || primary.disabled}
					onClick={primary.onClick}
				>
					{primary.filled ? <Icon name="person-add" size={14} color="currentColor" /> : null}
					{!primary.filled && primary.label === "Add" ? <span className="add-plus">+</span> : null}
					{primary.label}
				</button>
				{onDismiss && (
					<button className="add-x" disabled={busy} onClick={onDismiss} aria-label="Dismiss">
						<Icon name="close" size={16} color="#8d8d93" />
					</button>
				)}
			</div>
		</div>
	);
}
