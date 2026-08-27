ALTER TABLE users ADD COLUMN kindling INTEGER NOT NULL DEFAULT 0;

UPDATE users SET kindling = 1 WHERE lower(username) != 'maximuspyre';

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  agent_id TEXT,
  agent_url TEXT,
  pr_url TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created ON tickets(created_at);
