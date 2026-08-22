-- Durable unread state for caregiver-originated support conversations.
-- This is intentionally separate from generic system_notifications so the
-- red support badge cannot be cleared by unrelated notification rendering.

CREATE TABLE IF NOT EXISTS support_staff_unread (
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  unread_count INTEGER NOT NULL DEFAULT 1,
  last_message_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, thread_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(thread_id) REFERENCES support_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_staff_unread_user
  ON support_staff_unread(user_id, last_message_at DESC);

-- Preserve any unread caregiver-support notifications that already exist at
-- migration time without reintroducing messages that were previously read.
INSERT INTO support_staff_unread(user_id, thread_id, unread_count, last_message_at, created_at)
SELECT recipient_user_id, entity_id, COUNT(*), MAX(created_at), MIN(created_at)
FROM system_notifications
WHERE entity_type='support_thread' AND read_at IS NULL
GROUP BY recipient_user_id, entity_id
ON CONFLICT(user_id, thread_id) DO NOTHING;
