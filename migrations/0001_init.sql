-- PyreChat schema. No moderation, reports, or content-scan tables.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  birthday TEXT,
  bio TEXT NOT NULL DEFAULT '',
  phone TEXT,
  email TEXT,
  skullmoji TEXT NOT NULL DEFAULT '{}',
  snap_score INTEGER NOT NULL DEFAULT 0,
  story_privacy TEXT NOT NULL DEFAULT 'friends',
  who_can_contact TEXT NOT NULL DEFAULT 'everyone',
  map_mode TEXT NOT NULL DEFAULT 'friends',
  map_selected TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_active TEXT
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE friendships (
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE streaks (
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_snap_at TEXT,
  last_snap_user TEXT,
  expires_at TEXT,
  record INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_a, user_b)
);

CREATE TABLE blocks (
  user_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  is_group INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_members_user ON conversation_members(user_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT,
  media_key TEXT,
  extra TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_messages_convo ON messages(conversation_id, created_at);

CREATE TABLE message_saves (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE snaps (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  conversation_id TEXT,
  media_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 5,
  caption TEXT,
  overlay_json TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE snap_receipts (
  snap_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  viewed_at TEXT,
  replayed INTEGER NOT NULL DEFAULT 0,
  screenshot_at TEXT,
  PRIMARY KEY (snap_id, user_id)
);

CREATE INDEX idx_snaps_sender ON snaps(sender_id, created_at);
CREATE INDEX idx_receipts_user ON snap_receipts(user_id);

CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  caption TEXT,
  overlay_json TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_stories_user ON stories(user_id, created_at);
CREATE INDEX idx_stories_exp ON stories(expires_at);

CREATE TABLE story_views (
  story_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (story_id, viewer_id)
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL,
  month_key TEXT NOT NULL
);

CREATE INDEX idx_memories_user ON memories(user_id, created_at);

CREATE TABLE spotlight (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  hearts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_spotlight_created ON spotlight(created_at);

CREATE TABLE spotlight_hearts (
  spotlight_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (spotlight_id, user_id)
);

CREATE TABLE locations (
  user_id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  updated_at TEXT NOT NULL,
  activity TEXT NOT NULL DEFAULT 'default'
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  payload TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_notif_user ON notifications(user_id, created_at);
