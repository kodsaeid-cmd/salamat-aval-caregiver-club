PRAGMA foreign_keys = ON;

-- Recurring referral-loan requests are intentionally independent from the frozen
-- first-ten cohort introduced in 0116. Existing 0116 rows remain immutable history.
CREATE TABLE IF NOT EXISTS caregiver_referral_recurring_loan_requests (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL CHECK(milestone_key IN ('NETWORK_10','CONTRACT_7')),
  cycle_number INTEGER NOT NULL CHECK(cycle_number >= 1),
  target_count INTEGER NOT NULL CHECK(target_count IN (7,10)),
  qualified_count_at_request INTEGER NOT NULL CHECK(qualified_count_at_request >= target_count),
  eligibility_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','UNDER_REVIEW','REJECTED','COMPLETED')),
  requested_by_user_id TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  decision_note TEXT,
  completion_reference_id TEXT UNIQUE,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(caregiver_id,milestone_key,cycle_number),
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS caregiver_referral_recurring_loan_request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES caregiver_referral_recurring_loan_requests(id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Preserve any request already created under the one-time 0116 model as cycle 1.
-- Keeping the same request id preserves wallet reference idempotency for completed rows.
INSERT OR IGNORE INTO caregiver_referral_recurring_loan_requests(
  id,caregiver_id,milestone_key,cycle_number,target_count,qualified_count_at_request,
  eligibility_snapshot_json,status,requested_by_user_id,requested_at,reviewed_by_user_id,
  reviewed_at,decision_note,completion_reference_id,completed_at,created_at,updated_at
)
SELECT
  id,caregiver_id,milestone_key,1,
  CASE milestone_key WHEN 'NETWORK_10' THEN 10 ELSE 7 END,
  CASE milestone_key WHEN 'NETWORK_10' THEN 10 ELSE 7 END,
  eligibility_snapshot_json,status,requested_by_user_id,requested_at,reviewed_by_user_id,
  reviewed_at,decision_note,completion_reference_id,completed_at,created_at,updated_at
FROM caregiver_referral_milestone_requests;

INSERT OR IGNORE INTO caregiver_referral_recurring_loan_request_events(
  id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at
)
SELECT id,request_id,event_type,previous_status,new_status,actor_user_id,snapshot_json,created_at
FROM caregiver_referral_milestone_request_events;

CREATE INDEX IF NOT EXISTS idx_referral_recurring_request_status_created ON caregiver_referral_recurring_loan_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_recurring_request_caregiver_key_cycle ON caregiver_referral_recurring_loan_requests(caregiver_id,milestone_key,cycle_number DESC);
CREATE INDEX IF NOT EXISTS idx_referral_recurring_events_request_created ON caregiver_referral_recurring_loan_request_events(request_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_referral_recurring_request_no_delete
BEFORE DELETE ON caregiver_referral_recurring_loan_requests
BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: recurring referral loan request history cannot be deleted'); END;

CREATE TRIGGER IF NOT EXISTS trg_referral_recurring_request_identity_immutable
BEFORE UPDATE OF caregiver_id,milestone_key,cycle_number,target_count,qualified_count_at_request,eligibility_snapshot_json,requested_by_user_id,requested_at,created_at
ON caregiver_referral_recurring_loan_requests
BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: recurring referral loan request identity is immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_referral_recurring_events_no_update
BEFORE UPDATE ON caregiver_referral_recurring_loan_request_events
BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: recurring referral loan events are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_referral_recurring_events_no_delete
BEFORE DELETE ON caregiver_referral_recurring_loan_request_events
BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: recurring referral loan events cannot be deleted'); END;
