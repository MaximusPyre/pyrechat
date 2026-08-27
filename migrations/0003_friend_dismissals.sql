CREATE TABLE IF NOT EXISTS friend_dismissals (
  user_id TEXT NOT NULL,
  other_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, other_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (other_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dismissals_user_kind ON friend_dismissals(user_id, kind);
