CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_config (key, value) VALUES ('android_version_code', '2');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('android_version_name', '1.1');

CREATE TABLE IF NOT EXISTS app_notices (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL
);
