PRAGMA foreign_keys = ON;

CREATE TABLE conversation_members_new (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO conversation_members_new (conversation_id, user_id, joined_at)
SELECT conversation_id, user_id, joined_at FROM conversation_members
WHERE user_id IN (SELECT id FROM users)
  AND conversation_id IN (SELECT id FROM conversations);

DROP TABLE conversation_members;
ALTER TABLE conversation_members_new RENAME TO conversation_members;
CREATE INDEX idx_members_user ON conversation_members(user_id);
