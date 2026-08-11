PRAGMA foreign_keys = ON;

-- Loan policy v3 + caregiver retention rewards.
-- Additive only: existing contracts, credit requests and wallet entries are preserved.
ALTER TABLE contracts ADD COLUMN franchise_toman INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS caregiver_retention_rewards (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  reward_type TEXT NOT NULL
    CHECK(reward_type IN ('FIRST_CONTRACT_RETENTION','CONTRACT_CONTINUITY')),
  target_contract_id TEXT NOT NULL,
  source_contract_id TEXT NOT NULL,
  target_contract_sequence INTEGER NOT NULL DEFAULT 1 CHECK(target_contract_sequence > 0),
  source_contract_sequence INTEGER NOT NULL DEFAULT 1 CHECK(source_contract_sequence > 0),
  rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(rate_basis_points IN (0,800,1100,1500)),
  franchise_toman INTEGER NOT NULL DEFAULT 0 CHECK(franchise_toman >= 0),
  reward_toman INTEGER NOT NULL DEFAULT 0 CHECK(reward_toman >= 0),
  service_days INTEGER NOT NULL DEFAULT 0 CHECK(service_days >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK(status IN ('WAITING_FRANCHISE','PENDING_APPROVAL','PAID','REJECTED')),
  wallet_transaction_id TEXT UNIQUE,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(reward_type,target_contract_id),
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(target_contract_id) REFERENCES contracts(id) ON DELETE RESTRICT,
  FOREIGN KEY(source_contract_id) REFERENCES contracts(id) ON DELETE RESTRICT,
  FOREIGN KEY(wallet_transaction_id) REFERENCES caregiver_wallet_transactions(id) ON DELETE RESTRICT,
  FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_retention_rewards_caregiver_created
  ON caregiver_retention_rewards(caregiver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_rewards_status_created
  ON caregiver_retention_rewards(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_caregiver_start_status
  ON contracts(caregiver_id,starts_at,status,created_at);
