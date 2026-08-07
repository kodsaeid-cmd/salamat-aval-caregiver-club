PRAGMA foreign_keys = ON;

-- Referral security and confirmation v2.
-- Existing referral rows predate referrer confirmation, so the additive column
-- defaults to APPROVED. New v2 registrations explicitly write PENDING.
ALTER TABLE caregiver_referral_cases
  ADD COLUMN referrer_confirmation_status TEXT NOT NULL DEFAULT 'APPROVED'
  CHECK(referrer_confirmation_status IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE caregiver_referral_cases
  ADD COLUMN referrer_confirmed_at TEXT;
ALTER TABLE caregiver_referral_cases
  ADD COLUMN referrer_rejected_at TEXT;
ALTER TABLE caregiver_referral_cases
  ADD COLUMN referrer_decision_note TEXT;

CREATE TABLE IF NOT EXISTS caregiver_referral_codes (
  caregiver_id TEXT PRIMARY KEY,
  referral_code TEXT NOT NULL UNIQUE
    CHECK(length(referral_code)=6 AND referral_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'),
  created_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_code_unique
  ON caregiver_referral_codes(referral_code);

CREATE TABLE IF NOT EXISTS caregiver_referral_milestones (
  caregiver_id TEXT NOT NULL,
  milestone_number INTEGER NOT NULL CHECK(milestone_number > 0 AND milestone_number % 10 = 0),
  reward_toman INTEGER NOT NULL DEFAULT 5000000 CHECK(reward_toman = 5000000),
  wallet_transaction_id TEXT NOT NULL UNIQUE,
  approved_by_user_id TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  PRIMARY KEY(caregiver_id,milestone_number),
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(wallet_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_referral_milestone_awarded
  ON caregiver_referral_milestones(awarded_at DESC);
