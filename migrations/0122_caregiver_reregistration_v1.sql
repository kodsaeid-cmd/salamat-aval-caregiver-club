PRAGMA foreign_keys = ON;

-- Registration events are append-only classification records. They preserve the caregiver ID so
-- historical evaluations, contracts, wallet ledgers and professional records remain attached.
CREATE TABLE IF NOT EXISTS caregiver_registration_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  user_id TEXT,
  registration_kind TEXT NOT NULL CHECK (registration_kind IN ('NEW','REREGISTRATION')),
  previous_mobile TEXT,
  new_mobile TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  admin_seen_at TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_caregiver_registration_events_caregiver ON caregiver_registration_events(caregiver_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_caregiver_registration_events_kind ON caregiver_registration_events(registration_kind, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_caregiver_registration_events_seen ON caregiver_registration_events(registration_kind, admin_seen_at, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_caregiver_registration_events_user ON caregiver_registration_events(user_id, registered_at DESC);

-- One-time network reset requested for the existing caregiver population.
-- This changes only current operational state; no historical evaluation, contract, wallet,
-- score, document or audit row is deleted or rewritten.
UPDATE caregivers
SET active = 0,
    recruitment_stage = 'INACTIVE',
    cooperation_status = 'CP-04 غیرفعال',
    updated_at = datetime('now')
WHERE COALESCE(cooperation_status,'') <> 'حذف‌شده';

UPDATE users
SET status = 'INACTIVE',
    updated_at = datetime('now')
WHERE upper(role) = 'CAREGIVER'
  AND upper(status) <> 'DELETED';

-- Expire, rather than delete, authenticated caregiver sessions to preserve the additive data-safety contract.
UPDATE sessions
SET expires_at = '1970-01-01T00:00:00.000Z',
    last_seen_at = datetime('now')
WHERE user_id IN (
  SELECT id FROM users WHERE upper(role) = 'CAREGIVER' AND upper(status) <> 'DELETED'
);
