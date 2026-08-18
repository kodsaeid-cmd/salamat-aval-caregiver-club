-- Job-bank reminder SMS outbox v1
-- Additive only: no historical rows are rewritten or deleted.

CREATE TABLE IF NOT EXISTS caregiver_job_bank_sms_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  user_id TEXT,
  local_date TEXT NOT NULL,
  slot_key TEXT NOT NULL CHECK(slot_key IN ('1010','1230','1645')),
  scheduled_at TEXT NOT NULL,
  eligible_ad_count INTEGER NOT NULL CHECK(eligible_ad_count > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','QUEUED','PROCESSING','SENT','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  queued_at TEXT,
  processing_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(caregiver_id, local_date, slot_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_bank_sms_status_slot
  ON caregiver_job_bank_sms_events(status, local_date, slot_key, created_at);

CREATE INDEX IF NOT EXISTS idx_job_bank_sms_caregiver_date
  ON caregiver_job_bank_sms_events(caregiver_id, local_date DESC, slot_key);
