-- Canonical support conversation and notification unity.
-- Messages remain append-only; unread state is the related system notification read_at.

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS system_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  caregiver_id TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  route TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_threads_category_queue
  ON support_threads(category,status,last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread_sender
  ON support_messages(thread_id,sender_user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_support_notifications_thread
  ON system_notifications(recipient_user_id,entity_type,entity_id,read_at,created_at DESC);

-- Existing support messages are not copied into a second notification store.
-- New support notifications reference the canonical thread through
-- entity_type='support_thread' and entity_id=thread id.
