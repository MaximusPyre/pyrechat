export function RecoveryKeySheet({
	recoveryKey,
	title,
	onDone,
}: {
	recoveryKey: string;
	title?: string;
	onDone: () => void;
}) {
	return (
		<div className="auth" style={{ position: "fixed", inset: 0, zIndex: 5000, background: "var(--ink)" }}>
			<h1>{title || "Save your recovery key"}</h1>
			<p className="tag" style={{ maxWidth: 360 }}>
				This is the only way to reset your password if you get locked out. We cannot show it again. Screenshot it or write it down.
			</p>
			<textarea
				className="field"
				readOnly
				value={recoveryKey}
				rows={5}
				style={{ width: "100%", maxWidth: 360, minHeight: 96 }}
			/>
			<button
				className="primary"
				type="button"
				onClick={() => {
					void navigator.clipboard.writeText(recoveryKey).catch(() => undefined);
				}}
			>
				Copy key
			</button>
			<button className="primary" type="button" onClick={onDone} style={{ marginTop: 8 }}>
				I saved it
			</button>
		</div>
	);
}
