-- Persistent admin controls for automatic SMS flows.
-- Additive only: no existing SMS history or outbox rows are deleted.

CREATE TABLE IF NOT EXISTS sms_automation_controls (
  automation_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL,
  paused_at TEXT,
  FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO sms_automation_controls(
  automation_key,enabled,updated_by_user_id,updated_at,paused_at
) VALUES('JOB_BANK_REMINDER',1,NULL,CURRENT_TIMESTAMP,NULL);
