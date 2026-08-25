-- Admin-configurable schedule and message count for job-bank reminder SMS.
-- Additive only: existing reminder history and delivery logs are untouched.

CREATE TABLE IF NOT EXISTS job_bank_reminder_sms_settings (
  settings_key TEXT PRIMARY KEY,
  slot_1_time TEXT,
  slot_2_time TEXT,
  slot_3_time TEXT,
  count_override INTEGER,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK(count_override IS NULL OR (count_override >= 1 AND count_override <= 9999))
);

INSERT OR IGNORE INTO job_bank_reminder_sms_settings(
  settings_key,slot_1_time,slot_2_time,slot_3_time,count_override,updated_by_user_id,updated_at
) VALUES('JOB_BANK_REMINDER','10:10','12:30','16:45',NULL,NULL,CURRENT_TIMESTAMP);
