CREATE TABLE IF NOT EXISTS contract_insurance_records (
  contract_id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  insurance_enabled INTEGER NOT NULL DEFAULT 1,
  registration_status TEXT NOT NULL DEFAULT 'ESTIMATED',
  coverage_starts_at TEXT,
  coverage_ends_at TEXT,
  policy_number TEXT,
  note TEXT,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_insurance_caregiver
ON contract_insurance_records(caregiver_id, registration_status);
