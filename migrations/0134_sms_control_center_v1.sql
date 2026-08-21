CREATE TABLE IF NOT EXISTS sms_provider_delivery_reports (
  delivery_log_id TEXT PRIMARY KEY,
  provider_message_id TEXT NOT NULL,
  provider_state_code INTEGER,
  provider_state_text TEXT,
  provider_delivery_at TEXT,
  provider_send_at TEXT,
  provider_cost REAL,
  provider_line_number TEXT,
  last_checked_at TEXT NOT NULL,
  last_check_error TEXT,
  provider_status_json TEXT,
  FOREIGN KEY(delivery_log_id) REFERENCES sms_delivery_log(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sms_provider_delivery_message
  ON sms_provider_delivery_reports(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_provider_delivery_checked
  ON sms_provider_delivery_reports(last_checked_at DESC);

CREATE TABLE IF NOT EXISTS consultant_job_application_sms_outbox (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE,
  ad_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  consultant_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  delivery_log_id TEXT,
  provider_message_id TEXT,
  next_attempt_at TEXT,
  processing_at TEXT,
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(application_id) REFERENCES care_job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY(ad_id) REFERENCES care_job_ads(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(consultant_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(delivery_log_id) REFERENCES sms_delivery_log(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_consultant_job_sms_pending
  ON consultant_job_application_sms_outbox(status,next_attempt_at,created_at);
CREATE INDEX IF NOT EXISTS idx_consultant_job_sms_consultant
  ON consultant_job_application_sms_outbox(consultant_user_id,created_at DESC);
