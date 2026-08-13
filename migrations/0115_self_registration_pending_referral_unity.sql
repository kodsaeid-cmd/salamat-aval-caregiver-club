-- Keep form-based network registrations pending until an authorized users/access approval.
UPDATE caregivers
SET active = 0,
    cooperation_status = 'در انتظار تأیید مدیر',
    updated_at = COALESCE(updated_at, datetime('now'))
WHERE upper(COALESCE(recruitment_stage,'')) = 'SELF_REGISTERED';

UPDATE users
SET status = 'PENDING',
    updated_at = COALESCE(updated_at, datetime('now'))
WHERE upper(COALESCE(role,'')) = 'CAREGIVER'
  AND upper(COALESCE(status,'')) NOT IN ('DELETED','PENDING')
  AND caregiver_id IN (
    SELECT id FROM caregivers
    WHERE upper(COALESCE(recruitment_stage,'')) = 'SELF_REGISTERED'
  );

CREATE INDEX IF NOT EXISTS idx_users_pending_caregiver_created
ON users(status, role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_caregivers_self_registered_created
ON caregivers(recruitment_stage, created_at DESC);
