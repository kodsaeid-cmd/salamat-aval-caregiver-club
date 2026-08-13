PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS caregiver_referral_milestone_cohorts (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL UNIQUE,
  cohort_size INTEGER NOT NULL DEFAULT 10 CHECK(cohort_size = 10),
  referral_case_ids_json TEXT NOT NULL,
  achieved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS caregiver_referral_milestone_requests (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL CHECK(milestone_key IN ('NETWORK_10','CONTRACT_7')),
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
  UNIQUE(caregiver_id,milestone_key),
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(cohort_id) REFERENCES caregiver_referral_milestone_cohorts(id) ON DELETE RESTRICT,
  FOREIGN KEY(requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS caregiver_referral_milestone_request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES caregiver_referral_milestone_requests(id) ON DELETE RESTRICT,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_referral_milestone_request_status_created ON caregiver_referral_milestone_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_milestone_request_caregiver ON caregiver_referral_milestone_requests(caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_milestone_events_request_created ON caregiver_referral_milestone_request_events(request_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_referral_milestone_cohort_no_update BEFORE UPDATE ON caregiver_referral_milestone_cohorts BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral cohort is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_milestone_cohort_no_delete BEFORE DELETE ON caregiver_referral_milestone_cohorts BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral cohort cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_milestone_request_no_delete BEFORE DELETE ON caregiver_referral_milestone_requests BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral milestone request history cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_milestone_request_identity_immutable BEFORE UPDATE OF caregiver_id,cohort_id,milestone_key,eligibility_snapshot_json,requested_by_user_id,requested_at,created_at ON caregiver_referral_milestone_requests BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral milestone request identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_milestone_events_no_update BEFORE UPDATE ON caregiver_referral_milestone_request_events BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral milestone events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_milestone_events_no_delete BEFORE DELETE ON caregiver_referral_milestone_request_events BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral milestone events cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_case_identity_immutable_v3 BEFORE UPDATE OF referrer_caregiver_id,referred_caregiver_id,referral_code ON caregiver_referral_cases BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral attribution identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_referral_case_no_delete_v3 BEFORE DELETE ON caregiver_referral_cases BEGIN SELECT RAISE(ABORT,'DATA_SAFETY: referral history cannot be deleted'); END;
