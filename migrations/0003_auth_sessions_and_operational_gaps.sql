PRAGMA foreign_keys = ON;

-- Server-side authenticated sessions. Only a SHA-256 digest of the browser token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- Contract records used by the current admin and caregiver interfaces.
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  contract_number TEXT NOT NULL UNIQUE,
  family_name TEXT NOT NULL,
  service_type TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  starts_at TEXT,
  ends_at TEXT,
  work_days TEXT,
  monthly_hours INTEGER NOT NULL DEFAULT 0,
  logged_hours INTEGER NOT NULL DEFAULT 0,
  overtime_hours INTEGER NOT NULL DEFAULT 0,
  absent_hours INTEGER NOT NULL DEFAULT 0,
  payment_type TEXT,
  payment_rate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contracts_caregiver_status ON contracts(caregiver_id, status);

-- Confidential safety and security reports are intentionally separate from support tickets.
CREATE TABLE IF NOT EXISTS security_reports (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_by_user_id TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_security_reports_status ON security_reports(status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- The UI treats rank and technical license as live governance records rather than profile text.
CREATE TABLE IF NOT EXISTS caregiver_professional_meta (
  caregiver_id TEXT PRIMARY KEY,
  rank_code TEXT,
  rank_title TEXT,
  rank_stars INTEGER NOT NULL DEFAULT 0,
  pri_score INTEGER,
  rank_decision_ref TEXT,
  rank_valid_from TEXT,
  rank_valid_to TEXT,
  license_number TEXT,
  license_status TEXT NOT NULL DEFAULT 'NOT_ISSUED',
  license_expires_at TEXT,
  license_decision_ref TEXT,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
