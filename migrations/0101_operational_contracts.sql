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

-- Contract audit entries must never retain subscriber or recipient PII. The
-- application may send a richer operational payload, but D1 persists only the
-- fields needed to prove who changed which contract and its scheduling scope.
CREATE TRIGGER IF NOT EXISTS minimize_contract_audit_payload
AFTER INSERT ON audit_logs
WHEN NEW.entity_type = 'contract'
  AND NEW.action IN ('CREATE_CONTRACT','UPDATE_CONTRACT')
BEGIN
  UPDATE audit_logs
  SET after_json = json_object(
    'caregiverId', json_extract(NEW.after_json, '$.caregiverId'),
    'contractNumber', json_extract(NEW.after_json, '$.contractNumber'),
    'status', json_extract(NEW.after_json, '$.status'),
    'startsAt', json_extract(NEW.after_json, '$.startsAt'),
    'endsAt', json_extract(NEW.after_json, '$.endsAt'),
    'workDays', json_extract(NEW.after_json, '$.workDays'),
    'recipientSameAsSubscriber', json_extract(NEW.after_json, '$.recipientSameAsSubscriber')
  )
  WHERE id = NEW.id;
END;
