import { Icon } from "./Icon";
import { INK } from "../lib/brand";
import { SkullmojiAvatar } from "./Skull";
import type { User } from "../lib/types";

const LENSES = [
	{ id: "cam", icon: "cam" },
	{ id: "skull", icon: "skull" },
	{ id: "fire", icon: "fire" },
	{ id: "pen", icon: "pen" },
];

export function DeskHome({ me, onCamera }: { me: User; onCamera: () => void }) {
	return (
		<div className="desk-home">
			<div className="desk-sky" aria-hidden>
				<span className="balloon b1" />
				<span className="balloon b2" />
				<span className="balloon b3" />
				<span className="balloon b4" />
				<span className="balloon b5" />
			</div>
			<button type="button" className="desk-cam-card" onClick={onCamera}>
				<span className="desk-cam-shutter" aria-hidden>
					<Icon name="cam" size={36} color={INK} />
				</span>
				<strong>Click the Camera to send Pyres</strong>
				<span className="desk-cam-lenses">
					{LENSES.map((l) => (
						<i key={l.id} className="desk-cam-lens">
							<Icon name={l.icon} size={14} />
						</i>
					))}
				</span>
			</button>
			<div className="desk-home-avatar">
				<SkullmojiAvatar value={me.skullmoji} size={168} />
			</div>
		</div>
	);
}
