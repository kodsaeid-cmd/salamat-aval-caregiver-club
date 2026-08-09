-- Data Safety Contract v1
-- Historical ledger entries are append-only. Corrections must be new compensating entries.

CREATE TRIGGER IF NOT EXISTS trg_wallet_transactions_no_update
BEFORE UPDATE ON caregiver_wallet_transactions
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: wallet ledger entries are immutable; create a compensating transaction');
END;

CREATE TRIGGER IF NOT EXISTS trg_wallet_transactions_no_delete
BEFORE DELETE ON caregiver_wallet_transactions
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: wallet ledger entries cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_contract_points_no_update
BEFORE UPDATE ON caregiver_contract_point_ledger
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: contract point ledger entries are immutable; create a compensating entry');
END;

CREATE TRIGGER IF NOT EXISTS trg_contract_points_no_delete
BEFORE DELETE ON caregiver_contract_point_ledger
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: contract point ledger entries cannot be deleted');
END;
