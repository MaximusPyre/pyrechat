import { nowIso } from "./lib/util.js";

export async function expireContent(env: Env): Promise<void> {
	const now = nowIso();
	const oldSnaps = await env.DB.prepare(
		"SELECT id, media_key FROM snaps WHERE expires_at < ? AND id NOT IN (SELECT snap_id FROM snap_receipts WHERE viewed_at IS NULL)",
	)
		.bind(now)
		.all<{ id: string; media_key: string }>();
	for (const snap of oldSnaps.results) {
		await env.MEDIA.delete(snap.media_key).catch(() => undefined);
		await env.DB.prepare("DELETE FROM snap_receipts WHERE snap_id = ?").bind(snap.id).run();
		await env.DB.prepare("DELETE FROM snaps WHERE id = ?").bind(snap.id).run();
	}

	const viewed = await env.DB.prepare(
		`SELECT s.id, s.media_key FROM snaps s
     WHERE NOT EXISTS (SELECT 1 FROM snap_receipts r WHERE r.snap_id = s.id AND r.viewed_at IS NULL)
       AND EXISTS (SELECT 1 FROM snap_receipts r WHERE r.snap_id = s.id)`,
	).all<{ id: string; media_key: string }>();
	for (const snap of viewed.results) {
		const still = await env.DB.prepare(
			"SELECT 1 FROM snap_receipts WHERE snap_id = ? AND (viewed_at IS NULL OR replayed = 0)",
		)
			.bind(snap.id)
			.first();
		if (still) continue;
		await env.MEDIA.delete(snap.media_key).catch(() => undefined);
		await env.DB.prepare("DELETE FROM snap_receipts WHERE snap_id = ?").bind(snap.id).run();
		await env.DB.prepare("DELETE FROM snaps WHERE id = ?").bind(snap.id).run();
	}

	const oldStories = await env.DB.prepare("SELECT id, media_key FROM stories WHERE expires_at < ?")
		.bind(now)
		.all<{ id: string; media_key: string }>();
	for (const story of oldStories.results) {
		await env.MEDIA.delete(story.media_key).catch(() => undefined);
		await env.DB.prepare("DELETE FROM story_views WHERE story_id = ?").bind(story.id).run();
		await env.DB.prepare("DELETE FROM stories WHERE id = ?").bind(story.id).run();
	}

	await env.DB.prepare(
		"UPDATE streaks SET count = 0, last_snap_at = NULL, last_snap_user = NULL, expires_at = NULL WHERE expires_at IS NOT NULL AND expires_at < ?",
	)
		.bind(now)
		.run();

	await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
}
