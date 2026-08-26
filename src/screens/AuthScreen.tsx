import { useState, type FormEvent } from "react";
import { login, signup } from "../lib/api";
import type { User } from "../lib/types";
import { SkullLogo } from "../components/Skull";

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;
const MIN_PASSWORD = 6;

export function AuthScreen({ onAuthed }: { onAuthed: (user: User) => void }) {
	const [mode, setMode] = useState<"login" | "signup">("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [birthday, setBirthday] = useState("");
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(e: FormEvent) {
		e.preventDefault();
		const name = username.trim();
		setErr("");
		if (mode === "signup") {
			if (!USERNAME_RE.test(name)) {
				setErr("Username must be 3–24 letters, numbers, dots, or underscores");
				return;
			}
			if (password.length < MIN_PASSWORD) {
				setErr(`Password must be at least ${MIN_PASSWORD} characters`);
				return;
			}
		} else if (!name || !password) {
			setErr("Enter username and password");
			return;
		}
		setBusy(true);
		try {
			const out =
				mode === "login"
					? await login(name, password)
					: await signup(name, password, (displayName || name).trim(), birthday || undefined);
			onAuthed(out.user);
		} catch (caught) {
			setErr(caught instanceof Error ? caught.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="auth">
			<SkullLogo size={88} />
			<h1>PyreChat</h1>
			<p className="tag">Direct messages. Camera. Chronological feed. No ranking. No AI.</p>
			<form className="auth-form" onSubmit={(e) => void submit(e)}>
				{mode === "signup" && (
					<input
						className="field"
						placeholder="Display name"
						autoComplete="nickname"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
					/>
				)}
				<input
					className="field"
					placeholder="Username"
					autoCapitalize="none"
					autoCorrect="off"
					autoComplete="username"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
				/>
				<input
					className="field"
					placeholder={mode === "signup" ? `Password (${MIN_PASSWORD}+ characters)` : "Password"}
					type="password"
					autoComplete={mode === "signup" ? "new-password" : "current-password"}
					minLength={mode === "signup" ? MIN_PASSWORD : undefined}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				{mode === "signup" && (
					<input className="field" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
				)}
				{err && <p className="auth-err">{err}</p>}
				<button className="primary" disabled={busy} type="submit">
					{busy ? "…" : mode === "login" ? "Log in" : "Create account"}
				</button>
			</form>
			<button
				className="link"
				type="button"
				onClick={() => {
					setMode(mode === "login" ? "signup" : "login");
					setErr("");
				}}
			>
				{mode === "login" ? "New here? Sign up" : "Have an account? Log in"}
			</button>
			<a className="link" href="https://github.com/MaximusPyre/pyrechat" target="_blank" rel="noreferrer">
				Source on GitHub
			</a>
		</div>
	);
}
