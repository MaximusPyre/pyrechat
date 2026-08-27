import { useEffect, useRef, type ReactNode } from "react";

const LOCK = 12;
const FLICK = 0.45;

function ignoreTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return !!target.closest(
		"input, textarea, select, .no-swipe, .editor, .sheet, .shutter, .lens-row, .filter-row, .draw-layer, .composer",
	);
}

export function SwipePager({
	index,
	count,
	onIndex,
	children,
}: {
	index: number;
	count: number;
	onIndex: (i: number) => void;
	children: ReactNode;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const indexRef = useRef(index);
	const countRef = useRef(count);
	const onIndexRef = useRef(onIndex);
	const suppressClick = useRef(false);
	indexRef.current = index;
	countRef.current = count;
	onIndexRef.current = onIndex;

	useEffect(() => {
		const root = rootRef.current;
		const track = trackRef.current;
		if (!root || !track) return;

		const width = () => root.clientWidth || window.innerWidth;
		const rest = (i: number) => -i * width();
		const paint = (x: number, animate: boolean) => {
			track.style.transition = animate ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
			track.style.transform = `translate3d(${x}px,0,0)`;
		};

		paint(rest(indexRef.current), false);

		const gest = {
			id: -1,
			x0: 0,
			y0: 0,
			t0: 0,
			lastX: 0,
			lastT: 0,
			mode: "none" as "none" | "h" | "v",
		};

		const rubber = (i: number, dx: number) => {
			if ((i <= 0 && dx > 0) || (i >= countRef.current - 1 && dx < 0)) return dx * 0.32;
			return dx;
		};

		const onDown = (e: PointerEvent) => {
			if (e.pointerType === "mouse" && e.button !== 0) return;
			if (gest.id !== -1) return;
			if (ignoreTarget(e.target)) return;
			gest.id = e.pointerId;
			gest.x0 = e.clientX;
			gest.y0 = e.clientY;
			gest.t0 = e.timeStamp;
			gest.lastX = e.clientX;
			gest.lastT = e.timeStamp;
			gest.mode = "none";
		};

		const onMove = (e: PointerEvent) => {
			if (e.pointerId !== gest.id) return;
			const dx = e.clientX - gest.x0;
			const dy = e.clientY - gest.y0;
			if (gest.mode === "none") {
				if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
				gest.mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v";
				if (gest.mode === "h") {
					try {
						root.setPointerCapture(e.pointerId);
					} catch {
						/* capture is best-effort */
					}
				}
			}
			if (gest.mode !== "h") return;
			e.preventDefault();
			gest.lastX = e.clientX;
			gest.lastT = e.timeStamp;
			paint(rest(indexRef.current) + rubber(indexRef.current, dx), false);
		};

		const finish = (e: Event) => {
			if (gest.id === -1) return;
			const pe = e as PointerEvent;
			if (e.type !== "blur" && typeof pe.pointerId === "number" && pe.pointerId !== gest.id) return;
			const wasH = gest.mode === "h";
			const clientX = e.type === "blur" ? gest.lastX : pe.clientX;
			const dx = clientX - gest.x0;
			const t = e.type === "blur" ? gest.lastT : pe.timeStamp;
			const flick = (clientX - gest.lastX) / Math.max(16, t - gest.lastT);
			const pid = gest.id;
			gest.id = -1;
			gest.mode = "none";
			try {
				if (root.hasPointerCapture(pid)) root.releasePointerCapture(pid);
			} catch {
				/* ignore */
			}
			if (!wasH) return;
			const w = width();
			let next = indexRef.current;
			if (dx < -w * 0.18 || flick < -FLICK) next += 1;
			else if (dx > w * 0.18 || flick > FLICK) next -= 1;
			next = Math.max(0, Math.min(countRef.current - 1, next));
			if (next !== indexRef.current || Math.abs(dx) > 16) suppressClick.current = true;
			if (next !== indexRef.current) onIndexRef.current(next);
			else paint(rest(indexRef.current), true);
		};

		const onClick = (e: MouseEvent) => {
			if (!suppressClick.current) return;
			e.preventDefault();
			e.stopPropagation();
			suppressClick.current = false;
		};

		const onResize = () => paint(rest(indexRef.current), false);

		root.addEventListener("pointerdown", onDown);
		window.addEventListener("pointermove", onMove, { passive: false, capture: true });
		window.addEventListener("pointerup", finish, true);
		window.addEventListener("pointercancel", finish, true);
		window.addEventListener("blur", finish);
		root.addEventListener("click", onClick, true);
		window.addEventListener("resize", onResize);
		return () => {
			root.removeEventListener("pointerdown", onDown);
			window.removeEventListener("pointermove", onMove, true);
			window.removeEventListener("pointerup", finish, true);
			window.removeEventListener("pointercancel", finish, true);
			window.removeEventListener("blur", finish);
			root.removeEventListener("click", onClick, true);
			window.removeEventListener("resize", onResize);
		};
	}, []);

	useEffect(() => {
		const root = rootRef.current;
		const track = trackRef.current;
		if (!root || !track) return;
		track.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
		track.style.transform = `translate3d(${-index * root.clientWidth}px,0,0)`;
	}, [index]);

	return (
		<div className="pager swipe-pager" ref={rootRef}>
			<div className="pager-track" ref={trackRef}>
				{children}
			</div>
		</div>
	);
}

export function SwipePane({ children }: { children: ReactNode }) {
	return <div className="pager-pane">{children}</div>;
}
