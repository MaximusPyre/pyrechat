import { SkullLogo } from "../components/Skull";

export function LegalScreen({ kind }: { kind: "privacy" | "terms" }) {
	const title = kind === "privacy" ? "Privacy" : "Terms";
	return (
		<div className="overlay-page legal-page">
			<div className="page-head">
				<div>
					<div className="eyebrow">PyreChat</div>
					<h1>{title}</h1>
				</div>
				<a className="icon-btn solid" href="/" aria-label="Back">←</a>
			</div>
			<div className="legal-body">
				{kind === "privacy" ? <PrivacyCopy /> : <TermsCopy />}
			</div>
		</div>
	);
}

function PrivacyCopy() {
	return (
		<>
			<p>Effective 27 August 2026. PyreChat is operated by Pyre Arms for chat.pyrearms.dev and the Android app <code>dev.pyrearms.chat</code>.</p>
			<h3>What we store</h3>
			<ul>
				<li>Account: username, display name, birthday (age gate), password hash, optional recovery key hash, optional email you add in settings.</li>
				<li>Launch waitlist: email you submit on the site, the page it came from, and a short user-agent. That list is ours. Google Play pre-registration is Google’s — we never receive those addresses.</li>
				<li>Messages, Pyres, stories, memories, and friends you create. Media lives in our object storage until it expires or you delete it.</li>
				<li>Device camera and microphone stay on your device for capture. We only receive a photo or video if you send, save, or post it.</li>
			</ul>
			<h3>What we do not do</h3>
			<p>No ads in chat. No sale of personal data. No AI ranking of your friends. We do not scan legal private messages for “policy.” Illegal material (CSAM, court-ordered content, and the like) is removed when we are put on notice.</p>
			<h3>Google Play</h3>
			<p>If you tap Pre-register / Install on Google Play, Google’s privacy policy applies to that action. Use their listing if you only want a Play notification at launch and do not want us to have your email.</p>
			<h3>Contact</h3>
			<p>Questions or deletion requests: through the in-app illegal-content notice with your contact email, or the GitHub repo linked on the site.</p>
		</>
	);
}

function TermsCopy() {
	return (
		<>
			<p>You must be 13 or older. This is a camera messenger for humans. Do not post or send illegal content. We will remove illegal material and may close accounts used for it.</p>
			<p>Capture, chat, and memories are provided as-is. We may ship live updates to the web app and the Android WebView without a store resubmit. Google Play pre-registration does not guarantee a launch date.</p>
			<p>Kindling / early badges are cosmetic. We do not owe ranking, discovery, or ads. Block people yourself.</p>
			<p>See <a href="/privacy">Privacy</a> for what we store.</p>
		</>
	);
}

export function LegalMark() {
	return (
		<div className="legal-mark">
			<SkullLogo size={28} />
			<a href="/privacy">Privacy</a>
			<span>·</span>
			<a href="/terms">Terms</a>
		</div>
	);
}
