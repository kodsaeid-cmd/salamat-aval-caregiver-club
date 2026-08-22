-- Public/guest support chat is intentionally separate from caregiver support threads.
-- Visitor identity is an opaque browser token; only its SHA-256 hash is persisted.

CREATE TABLE IF NOT EXISTS public_support_conversations (
  id TEXT PRIMARY KEY,
  visitor_token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT,
  mobile TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PENDING','RESOLVED','CLOSED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_support_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_kind TEXT NOT NULL CHECK(sender_kind IN ('VISITOR','STAFF')),
  sender_user_id TEXT,
  text_content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(conversation_id) REFERENCES public_support_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_public_support_conversations_queue
  ON public_support_conversations(status,last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_support_messages_conversation
  ON public_support_messages(conversation_id,created_at ASC);

CREATE INDEX IF NOT EXISTS idx_public_support_notifications_recipient
  ON system_notifications(recipient_user_id,entity_type,entity_id,read_at,created_at DESC);
