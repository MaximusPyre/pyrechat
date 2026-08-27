const FOUNDER_USERNAME = "maximuspyre";

export function isFounderUsername(username: string | null | undefined): boolean {
	return (username || "").trim().toLowerCase() === FOUNDER_USERNAME;
}

export function isKindlingFlag(value: boolean | number | string | null | undefined): boolean {
	return value === true || value === 1 || value === "1";
}

export function DisplayName({
	name,
	username,
	kindling,
	className,
}: {
	name: string;
	username?: string | null;
	kindling?: boolean | number | string | null;
	className?: string;
}) {
	const founder = isFounderUsername(username);
	const ember = !founder && isKindlingFlag(kindling);
	if (!founder && !ember) {
		return <span className={className}>{name}</span>;
	}
	return (
		<span className={`founder-name ${className || ""}`}>
			<span className={founder ? "founder-text" : undefined}>{name}</span>
			{founder ? <span className="founder-badge">FOUNDER</span> : null}
			{ember ? <span className="kindling-badge">KINDLING</span> : null}
		</span>
	);
}
