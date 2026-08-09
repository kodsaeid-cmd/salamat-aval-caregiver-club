-- Data Safety Contract v1
-- Historical financial/point ledgers are append-only. Corrections must be compensating entries.
-- Core identities and historical business records are soft-delete/status-change only in normal production operation.

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

CREATE TRIGGER IF NOT EXISTS trg_users_no_hard_delete
BEFORE DELETE ON users
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: user accounts cannot be hard-deleted in normal operation; deactivate the account');
END;

CREATE TRIGGER IF NOT EXISTS trg_caregivers_no_hard_delete
BEFORE DELETE ON caregivers
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: caregiver identities cannot be hard-deleted in normal operation; use soft delete/status');
END;

CREATE TRIGGER IF NOT EXISTS trg_final_evaluations_no_delete
BEFORE DELETE ON caregiver_evaluation_periods
WHEN OLD.status='FINAL'
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: finalized evaluations cannot be deleted; create a corrective evaluation period');
END;

CREATE TRIGGER IF NOT EXISTS trg_credit_requests_no_delete
BEFORE DELETE ON caregiver_credit_requests
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: credit request history cannot be deleted; change status instead');
END;

CREATE TRIGGER IF NOT EXISTS trg_contracts_no_hard_delete
BEFORE DELETE ON contracts
BEGIN
  SELECT RAISE(ABORT, 'DATA_SAFETY: contracts cannot be hard-deleted; use deleted_at/status');
END;
