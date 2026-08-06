PRAGMA foreign_keys = ON;

-- Unified caregiver referral reward workflow.
-- Stage 1: 200,000 toman after admin registration approval.
-- Stage 2: 300,000 toman after admin manually confirms physical-contract entry.
CREATE TABLE IF NOT EXISTS caregiver_referral_cases (
  id TEXT PRIMARY KEY,
  referrer_caregiver_id TEXT NOT NULL,
  referred_caregiver_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  registration_reward_toman INTEGER NOT NULL DEFAULT 200000 CHECK(registration_reward_toman = 200000),
  contract_reward_toman INTEGER NOT NULL DEFAULT 300000 CHECK(contract_reward_toman = 300000),
  status TEXT NOT NULL DEFAULT 'PENDING_REGISTRATION_REVIEW'
    CHECK(status IN (
      'PENDING_REGISTRATION_REVIEW',
      'WAITING_CONTRACT',
      'COMPLETED',
      'REGISTRATION_REJECTED',
      'CONTRACT_REJECTED'
    )),
  registration_reward_transaction_id TEXT UNIQUE,
  contract_reward_transaction_id TEXT UNIQUE,
  registration_reviewed_by_user_id TEXT,
  registration_reviewed_at TEXT,
  registration_decision_note TEXT,
  contract_reviewed_by_user_id TEXT,
  contract_reviewed_at TEXT,
  contract_decision_note TEXT,
  contract_check_last_at TEXT,
  contract_check_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(referrer_caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(referred_caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(registration_reward_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
  FOREIGN KEY(contract_reward_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
  FOREIGN KEY(registration_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(contract_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_status_created
  ON caregiver_referral_cases(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_referrer_created
  ON caregiver_referral_cases(referrer_caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_referred
  ON caregiver_referral_cases(referred_caregiver_id);
