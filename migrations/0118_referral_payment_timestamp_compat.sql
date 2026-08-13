PRAGMA foreign_keys = ON;

-- caregiver-financial-profile-v4 historically reads these timestamps. The
-- authoritative payout evidence remains the immutable wallet transaction id;
-- these columns mirror its created_at so referral lists never collapse to an
-- empty result because of a schema mismatch.
ALTER TABLE caregiver_referral_cases ADD COLUMN registration_payment_at TEXT;
ALTER TABLE caregiver_referral_cases ADD COLUMN contract_payment_at TEXT;

UPDATE caregiver_referral_cases
SET registration_payment_at=(
  SELECT w.created_at FROM caregiver_wallet_transactions w
  WHERE w.id=caregiver_referral_cases.registration_reward_transaction_id
)
WHERE registration_reward_transaction_id IS NOT NULL
  AND registration_payment_at IS NULL;

UPDATE caregiver_referral_cases
SET contract_payment_at=(
  SELECT w.created_at FROM caregiver_wallet_transactions w
  WHERE w.id=caregiver_referral_cases.contract_reward_transaction_id
)
WHERE contract_reward_transaction_id IS NOT NULL
  AND contract_payment_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_referral_registration_payment_timestamp
AFTER UPDATE OF registration_reward_transaction_id ON caregiver_referral_cases
WHEN NEW.registration_reward_transaction_id IS NOT NULL AND NEW.registration_payment_at IS NULL
BEGIN
  UPDATE caregiver_referral_cases
  SET registration_payment_at=(SELECT created_at FROM caregiver_wallet_transactions WHERE id=NEW.registration_reward_transaction_id)
  WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_referral_contract_payment_timestamp
AFTER UPDATE OF contract_reward_transaction_id ON caregiver_referral_cases
WHEN NEW.contract_reward_transaction_id IS NOT NULL AND NEW.contract_payment_at IS NULL
BEGIN
  UPDATE caregiver_referral_cases
  SET contract_payment_at=(SELECT created_at FROM caregiver_wallet_transactions WHERE id=NEW.contract_reward_transaction_id)
  WHERE id=NEW.id;
END;
