CREATE TABLE IF NOT EXISTS legal_notices (
  id TEXT PRIMARY KEY,
  reporter_id TEXT,
  contact TEXT NOT NULL,
  target_url TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0
);
