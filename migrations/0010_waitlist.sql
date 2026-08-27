CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at);
