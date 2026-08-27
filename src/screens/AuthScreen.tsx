import { useState, type FormEvent } from "react";
import { login, signup, recover, ApiError, track } from "../lib/api";
import type { User } from "../lib/types";
import { SkullLogo } from "../components/Skull";
import { AuthInstallActions, isNativeApp } from "../components/GetApp";
import { RecoveryKeySheet } from "../components/RecoveryKey";
import { PLAY_PRE_REG_URL } from "../lib/play";

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;
const MIN_PASSWORD = 8;

export function AuthScreen({ onAuthed }: { onAuthed: (user: User) => void }) {
	const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [birthday, setBirthday] = useState("");
	const [seed, setSeed] = useState("");
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState<{ user: User; recoveryKey: string } | null>(null);

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
		} else if (mode === "recover") {
			if (!name || !seed.trim() || password.length < MIN_PASSWORD) {
				setErr("Enter your username, recovery key, and a new password");
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
					: mode === "recover"
						? await recover(name, seed.trim(), password)
						: await signup(name, password, (displayName || name).trim(), birthday);
			const key = "recoveryKey" in out ? out.recoveryKey : undefined;
			if (typeof key === "string" && key) setPending({ user: out.user, recoveryKey: key });
			else onAuthed(out.user);
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

	if (pending) {
		return (
			<RecoveryKeySheet
				recoveryKey={pending.recoveryKey}
				onDone={() => onAuthed({ ...pending.user, hasRecovery: true })}
			/>
		);
	}

	return (
		<div className="auth">
			<div className="auth-brand">
				<SkullLogo size={88} />
				<h1>PyreChat</h1>
				<p className="tag">No ads in chat. Your memories stay yours. Chronological. No AI ranking. No mystery bans.</p>
				{mode === "signup" && (
					<p className="tag" style={{ fontSize: 13 }}>
						Sign up now and you get the <strong>Kindling</strong> badge — you were here before private beta.
					</p>
				)}
			</div>
			<div className="auth-card">
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
				{mode === "recover" && (
					<textarea
						className="field"
						placeholder="Recovery key"
						value={seed}
						onChange={(e) => setSeed(e.target.value)}
						rows={5}
						autoComplete="off"
						spellCheck={false}
						style={{ width: "100%", maxWidth: 360, minHeight: 96, resize: "vertical" }}
					/>
				)}
				{mode !== "recover" && (
					<input
						className="field"
						placeholder={mode === "login" ? "Password" : `Password (${MIN_PASSWORD}+ characters)`}
						type="password"
						autoComplete={mode === "login" ? "current-password" : "new-password"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				)}
				{mode === "recover" && (
					<input
						className="field"
						placeholder={`New password (${MIN_PASSWORD}+ characters)`}
						type="password"
						autoComplete="new-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				)}
				{mode === "signup" && (
					<>
						<input className="field" type="date" required value={birthday} onChange={(e) => setBirthday(e.target.value)} />
						<p className="tag" style={{ marginTop: 0, fontSize: 13 }}>You must be 13 or older.</p>
					</>
				)}
				{err && <p className="auth-err">{err}</p>}
				<button className="primary" disabled={busy} type="submit">
					{busy ? "…" : mode === "login" ? "Log in" : mode === "recover" ? "Reset password" : "Create account"}
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
			<button
				className="link"
				type="button"
				onClick={() => {
					setMode("recover");
					setErr("");
				}}
			>
				Forgot password? Use recovery key
			</button>
			{!isNativeApp() && (
				<a
					className="play-btn"
					href={PLAY_PRE_REG_URL}
					target="_blank"
					rel="noreferrer"
					onClick={() => track("play_prereg_login")}
				>
					Pre-register on Google Play
				</a>
			)}
			{!isNativeApp() && <AuthInstallActions />}
			<button
				className="link"
				type="button"
				onClick={() => {
					history.pushState({}, "", "/");
					window.dispatchEvent(new PopStateEvent("popstate"));
				}}
			>
				Try the camera first
			</button>
			<a className="link" href="https://github.com/MaximusPyre/pyrechat" target="_blank" rel="noreferrer">
				Source on GitHub
			</a>
			<a className="link" href="/privacy">Privacy</a>
			</div>
		</div>
	);
}
