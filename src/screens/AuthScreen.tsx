import { useState, type FormEvent } from "react";
import { login, signup, ApiError } from "../lib/api";
import type { User } from "../lib/types";
import { SkullLogo } from "../components/Skull";
import { AuthInstallActions, isNativeApp } from "../components/GetApp";

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;
const MIN_PASSWORD = 8;

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
			if (!birthday) {
				setErr("Enter your birthday. You must be at least 13.");
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
					: await signup(name, password, (displayName || name).trim(), birthday);
			onAuthed(out.user);
		} catch (caught) {
			const msg =
				caught instanceof ApiError && caught.status === 0
					? caught.message
					: caught instanceof Error
						? caught.message
						: "Failed";
			setErr(msg);
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
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				{mode === "signup" && (
					<>
						<input className="field" type="date" required value={birthday} onChange={(e) => setBirthday(e.target.value)} />
						<p className="tag" style={{ marginTop: 0, fontSize: 13 }}>You must be 13 or older.</p>
					</>
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
			{!isNativeApp() && <AuthInstallActions />}
			<a className="link" href="https://github.com/MaximusPyre/pyrechat" target="_blank" rel="noreferrer">
				Source on GitHub
			</a>
		</div>
	);
}
