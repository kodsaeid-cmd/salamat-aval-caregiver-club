-- Additive outbox for automatic caregiver SMS on job-application lifecycle changes.
-- No historical backfill and no deletion/rewriting of existing applications.
CREATE TABLE IF NOT EXISTS caregiver_job_status_sms_events(
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  transition_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  processing_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(application_id,transition_at,new_status)
);
CREATE INDEX IF NOT EXISTS idx_caregiver_job_status_sms_pending
ON caregiver_job_status_sms_events(status,next_attempt_at,created_at);
CREATE INDEX IF NOT EXISTS idx_caregiver_job_status_sms_application
ON caregiver_job_status_sms_events(application_id,transition_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_care_job_application_status_sms_outbox
AFTER UPDATE OF status,lifecycle_status ON care_job_applications
WHEN UPPER(COALESCE(NULLIF(NEW.lifecycle_status,''),NEW.status,'')) <> UPPER(COALESCE(NULLIF(OLD.lifecycle_status,''),OLD.status,''))
BEGIN
  INSERT OR IGNORE INTO caregiver_job_status_sms_events(
    id,application_id,caregiver_id,ad_id,previous_status,new_status,transition_at,status,created_at,updated_at
  ) VALUES(
    'jss_' || lower(hex(randomblob(16))),
    NEW.id,
    NEW.caregiver_id,
    NEW.ad_id,
    UPPER(COALESCE(NULLIF(OLD.lifecycle_status,''),OLD.status,'')),
    UPPER(COALESCE(NULLIF(NEW.lifecycle_status,''),NEW.status,'')),
    COALESCE(NEW.updated_at,CURRENT_TIMESTAMP),
    'PENDING',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
END;
