PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS caregivers (
  id TEXT PRIMARY KEY,
  crm_record_id TEXT NOT NULL UNIQUE,
  membership_code TEXT NOT NULL UNIQUE,
  national_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  mobile TEXT,
  province TEXT,
  city TEXT,
  service_region TEXT,
  cooperation_status TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  crm_modified_on TEXT,
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_caregivers_mobile ON caregivers(mobile);
CREATE INDEX IF NOT EXISTS idx_caregivers_national_id ON caregivers(national_id);
CREATE INDEX IF NOT EXISTS idx_caregivers_last_synced_at ON caregivers(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_caregivers_active ON caregivers(active);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  received_count INTEGER NOT NULL DEFAULT 0,
  succeeded_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_created_at ON sync_runs(created_at DESC);
