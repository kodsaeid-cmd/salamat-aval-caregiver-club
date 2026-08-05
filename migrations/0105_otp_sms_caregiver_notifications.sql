-- OTP, SMS delivery evidence and caregiver notification unity v1
-- Additive only. No caregiver, user, notification or OTP record is deleted.

CREATE INDEX IF NOT EXISTS idx_otp_mobile_active_created
  ON otp_challenges(mobile,purpose,consumed_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_expiry
  ON otp_challenges(expires_at,consumed_at);

CREATE TABLE IF NOT EXISTS sms_delivery_log (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT,
  caregiver_id TEXT,
  mobile_hash TEXT NOT NULL,
  message_kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('SENT','FAILED','DEBUG')),
  provider_message_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_recipient_created
  ON sms_delivery_log(recipient_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_caregiver_created
  ON sms_delivery_log(caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_status_created
  ON sms_delivery_log(status,created_at DESC);

CREATE TABLE IF NOT EXISTS caregiver_change_dispatches (
  audit_id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('NOTIFIED','SKIPPED','FAILED')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  processed_at TEXT NOT NULL,
  FOREIGN KEY(audit_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_caregiver_change_dispatch_status
  ON caregiver_change_dispatches(status,processed_at DESC);

-- Delivery records are evidence and must never be rewritten or removed.
CREATE TRIGGER IF NOT EXISTS trg_sms_delivery_no_update_v1
BEFORE UPDATE ON sms_delivery_log
BEGIN SELECT RAISE(ABORT,'sms_delivery_log_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_sms_delivery_no_delete_v1
BEFORE DELETE ON sms_delivery_log
BEGIN SELECT RAISE(ABORT,'sms_delivery_log_is_immutable'); END;
