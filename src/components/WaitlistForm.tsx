import { useState, type FormEvent } from "react";
import { joinWaitlist } from "../lib/api";

export function WaitlistForm({ source, compact = false }: { source: string; compact?: boolean }) {
	const [email, setEmail] = useState("");
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(e: FormEvent) {
		e.preventDefault();
		setMsg("");
		setBusy(true);
		try {
			await joinWaitlist(email, source);
			setEmail("");
			setMsg("You're on the list. We'll mail you at launch.");
		} catch (err) {
			setMsg(err instanceof Error ? err.message : "Could not save that email");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className={`waitlist ${compact ? "compact" : ""}`} onSubmit={(e) => void submit(e)}>
			<input
				className="field"
				type="email"
				inputMode="email"
				autoComplete="email"
				placeholder="Email for launch"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
			/>
			<button className="primary" type="submit" disabled={busy}>
				{busy ? "…" : "Notify me"}
			</button>
			<p className="waitlist-note">
				{msg || (
					<>
						We email launch only.{" "}
						<a href="/privacy" onClick={(e) => { e.preventDefault(); history.pushState({}, "", "/privacy"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
							Privacy
						</a>
					</>
				)}
			</p>
		</form>
	);
}
