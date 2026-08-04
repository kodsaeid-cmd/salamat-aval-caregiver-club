-- Operational caregiver contracts used by the staff contracts module and caregiver calendar.
ALTER TABLE contracts ADD COLUMN subscriber_first_name TEXT;
ALTER TABLE contracts ADD COLUMN subscriber_last_name TEXT;
ALTER TABLE contracts ADD COLUMN subscriber_phone_primary TEXT;
ALTER TABLE contracts ADD COLUMN subscriber_phone_secondary TEXT;
ALTER TABLE contracts ADD COLUMN subscriber_national_id TEXT;
ALTER TABLE contracts ADD COLUMN subscriber_birth_date TEXT;
ALTER TABLE contracts ADD COLUMN recipient_same_as_subscriber INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN recipient_first_name TEXT;
ALTER TABLE contracts ADD COLUMN recipient_last_name TEXT;
ALTER TABLE contracts ADD COLUMN recipient_phone_primary TEXT;
ALTER TABLE contracts ADD COLUMN recipient_phone_secondary TEXT;
ALTER TABLE contracts ADD COLUMN recipient_national_id TEXT;
ALTER TABLE contracts ADD COLUMN recipient_birth_date TEXT;
ALTER TABLE contracts ADD COLUMN subscriber_relation_to_recipient TEXT;
ALTER TABLE contracts ADD COLUMN notes TEXT;
ALTER TABLE contracts ADD COLUMN created_by_user_id TEXT;
ALTER TABLE contracts ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_active_dates
  ON contracts(caregiver_id,status,starts_at,ends_at,deleted_at);
CREATE INDEX IF NOT EXISTS idx_contracts_subscriber_search
  ON contracts(subscriber_last_name,subscriber_phone_primary,subscriber_national_id);
CREATE INDEX IF NOT EXISTS idx_contracts_recipient_search
  ON contracts(recipient_last_name,recipient_phone_primary,recipient_national_id);
