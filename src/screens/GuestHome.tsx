import { lazy, Suspense, useState } from "react";
import { WaitlistForm } from "../components/WaitlistForm";
import { LegalMark } from "./LegalScreens";
import { SkullLogo } from "../components/Skull";
import { isNativeApp } from "../components/GetApp";
import { PLAY_PRE_REG_URL } from "../lib/play";
import { track } from "../lib/api";
import type { User } from "../lib/types";

const CameraScreen = lazy(() => import("./CameraScreen").then((m) => ({ default: m.CameraScreen })));

function goLogin(): void {
	history.pushState({}, "", "/login");
	window.dispatchEvent(new PopStateEvent("popstate"));
}

export function GuestHome({ onAuthed: _onAuthed }: { onAuthed: (user: User) => void }) {
	const [gate, setGate] = useState(false);

	return (
		<div className="guest">
			<div className="guest-cam">
				<Suspense fallback={<div className="perm-card"><p>Opening camera…</p></div>}>
					<CameraScreen
						demo
						active
						onOpenMemories={() => setGate(true)}
						onNeedAccount={() => setGate(true)}
					/>
				</Suspense>
			</div>
			<div className="guest-chrome">
				<div className="guest-top">
					<div className="guest-brand">
						<SkullLogo size={28} />
						<span>PyreChat</span>
					</div>
					<button className="guest-login" type="button" onClick={goLogin}>
						Log in
					</button>
				</div>
				<div className="guest-cta">
					{!isNativeApp() && (
						<a
							className="play-btn"
							href={PLAY_PRE_REG_URL}
							target="_blank"
							rel="noreferrer"
							onClick={() => track("play_prereg")}
						>
							Pre-register on Google Play
						</a>
					)}
					<p className="guest-pitch">Try the camera. Then take it with you — no ads in chat, no AI ranking, no mystery bans.</p>
					<WaitlistForm source="demo" compact />
					<button className="link" type="button" onClick={goLogin}>
						Have an account? Log in
					</button>
					<LegalMark />
				</div>
			</div>
			{gate && (
				<div className="sheet" onClick={() => setGate(false)}>
					<div className="sheet-card" onClick={(e) => e.stopPropagation()}>
						<div className="sheet-title">Send it for real</div>
						<p className="tag" style={{ marginTop: 0 }}>
							Friends, Story, and Memories need an account. Pre-register so the app is on your phone the day we launch.
						</p>
						<a
							className="play-btn"
							href={PLAY_PRE_REG_URL}
							target="_blank"
							rel="noreferrer"
							onClick={() => track("play_prereg_send")}
						>
							Pre-register on Google Play
						</a>
						<WaitlistForm source="send" />
						<button className="primary" type="button" onClick={goLogin}>
							Create account
						</button>
						<button className="link" type="button" onClick={() => setGate(false)}>Keep playing with the camera</button>
					</div>
				</div>
			)}
		</div>
	);
}
