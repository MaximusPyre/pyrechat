-- Beta tickets. Attachments live in R2 (MEDIA); rows here are the index.
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  note TEXT,
  pr_url TEXT,
  agent_url TEXT,
  rollout TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at);

CREATE TABLE IF NOT EXISTS ticket_callbacks (
  ticket_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT,
  user_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_user ON ticket_attachments(user_id, created_at);
