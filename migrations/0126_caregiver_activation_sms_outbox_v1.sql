-- Caregiver activation SMS outbox v1
-- Additive only. No caregiver, user, audit, notification or SMS delivery record is rewritten or deleted.

CREATE TABLE IF NOT EXISTS caregiver_activation_sms_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  user_id TEXT,
  previous_active INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  activated_at TEXT NOT NULL,
  next_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_caregiver_activation_sms_pending
  ON caregiver_activation_sms_events(status,next_attempt_at,created_at);
CREATE INDEX IF NOT EXISTS idx_caregiver_activation_sms_caregiver
  ON caregiver_activation_sms_events(caregiver_id,activated_at DESC);

-- caregiver_id is intentionally retained as immutable historical evidence even
-- if a future administrative cleanup removes the source caregiver record.
-- A profile activation is defined by the professional caregiver profile moving
-- from any non-active value to active=1. This is deliberately not tied to a UI
-- route, so desktop, mobile, delegated approvals and future server-side flows
-- all create exactly one durable SMS event for the same database transition.
CREATE TRIGGER IF NOT EXISTS trg_caregiver_activation_sms_outbox_v1
AFTER UPDATE OF active ON caregivers
WHEN COALESCE(OLD.active,0) <> 1 AND COALESCE(NEW.active,0) = 1
BEGIN
  INSERT INTO caregiver_activation_sms_events(
    id,caregiver_id,user_id,previous_active,status,attempt_count,activated_at,next_attempt_at,created_at,updated_at
  ) VALUES(
    'act_' || lower(hex(randomblob(16))),
    NEW.id,
    (
      SELECT id FROM users
      WHERE caregiver_id=NEW.id
        AND upper(role)='CAREGIVER'
        AND upper(status)<>'DELETED'
      ORDER BY CASE WHEN upper(status) IN ('ACTIVE','APPROVED') THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1
    ),
    COALESCE(OLD.active,0),
    'PENDING',
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
END;