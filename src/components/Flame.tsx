import { useId } from "react";

/** Cream flame with a thick soot stroke — the PyreChat mark. */
export function FlameLogo({ size = 72 }: { size?: number }) {
	const id = useId().replace(/:/g, "");
	return (
		<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
			<defs>
				<linearGradient id={`${id}-fill`} x1="32" y1="62" x2="32" y2="6" gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="#e8dcd0" />
					<stop offset="0.4" stopColor="#fbf7f2" />
					<stop offset="1" stopColor="#fffefb" />
				</linearGradient>
			</defs>
			<path
				fill={`url(#${id}-fill)`}
				stroke="#1a120e"
				strokeWidth="3.8"
				strokeLinejoin="round"
				strokeLinecap="round"
				d="M32 5.5c-1.8 8-7.6 14.2-12.2 22.6-4.6-1.6-10.2 1.8-8.4 9.2-5.4 2.4-7 10.6.4 14.8 1.8 6.2 8 10.2 14.6 11.1h11.2c6.6-.9 12.8-4.9 14.6-11.1 7.4-4.2 5.8-12.4.4-14.8 1.8-7.4-3.8-10.8-8.4-9.2C39.6 19.7 33.8 13.5 32 5.5Z"
			/>
			<path
				fill="#ffffff55"
				d="M27 22c2.4-6 5-10 5-10s2.2 3.6 3.4 8.2c-2.6.4-5.6 1-8.4 1.8Z"
			/>
		</svg>
	);
}
