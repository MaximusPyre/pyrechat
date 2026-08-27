-- Snapchat Spotlight verification + snapscore import (one-time per user).
CREATE TABLE snapchat_onboard (
  user_id TEXT PRIMARY KEY,
  snapchat_username TEXT NOT NULL,
  verify_code TEXT NOT NULL,
  spotlight_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  snap_score_claimed INTEGER,
  verified_at TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_snapchat_onboard_status ON snapchat_onboard(status);
