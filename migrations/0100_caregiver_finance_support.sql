-- Caregiver finance, payroll and support platform v1
-- Additive migration. Existing evaluation and caregiver records are not altered or deleted.

CREATE TABLE IF NOT EXISTS caregiver_wallet_transactions (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('CREDIT','DEBIT')),
  transaction_type TEXT NOT NULL,
  amount_toman INTEGER NOT NULL CHECK(amount_toman > 0),
  title TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_reference_unique
  ON caregiver_wallet_transactions(reference_type,reference_id,direction)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_caregiver_created
  ON caregiver_wallet_transactions(caregiver_id,created_at DESC);

CREATE TABLE IF NOT EXISTS caregiver_settlement_requests (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  amount_toman INTEGER NOT NULL CHECK(amount_toman > 0),
  account_holder_name TEXT NOT NULL,
  iban TEXT,
  account_number TEXT,
  bank_name TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK(status IN ('REQUESTED','APPROVED','REJECTED','PAID','CANCELLED')),
  requested_by_user_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  decision_note TEXT,
  paid_by_user_id TEXT,
  paid_at TEXT,
  payment_tracking_number TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK(iban IS NOT NULL OR account_number IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_settlement_status_created
  ON caregiver_settlement_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_caregiver_created
  ON caregiver_settlement_requests(caregiver_id,created_at DESC);

CREATE TABLE IF NOT EXISTS caregiver_credit_requests (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  requested_amount_toman INTEGER NOT NULL DEFAULT 500000000,
  eligibility_path TEXT NOT NULL CHECK(eligibility_path IN ('CONTINUOUS','CUMULATIVE')),
  continuous_days INTEGER NOT NULL DEFAULT 0,
  cumulative_days INTEGER NOT NULL DEFAULT 0,
  eligibility_snapshot_json TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK(status IN ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED')),
  requested_by_user_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_credit_request_status_created
  ON caregiver_credit_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_request_caregiver_created
  ON caregiver_credit_requests(caregiver_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_request_one_open
  ON caregiver_credit_requests(caregiver_id)
  WHERE status IN ('REQUESTED','UNDER_REVIEW','APPROVED');

CREATE TABLE IF NOT EXISTS caregiver_payroll_slips (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  contract_id TEXT,
  period_key TEXT NOT NULL,
  period_title TEXT NOT NULL,
  scheduled_hours REAL NOT NULL DEFAULT 0,
  logged_hours REAL NOT NULL DEFAULT 0,
  overtime_hours REAL NOT NULL DEFAULT 0,
  absent_hours REAL NOT NULL DEFAULT 0,
  hourly_rate_toman INTEGER NOT NULL DEFAULT 0,
  gross_toman INTEGER NOT NULL DEFAULT 0,
  benefits_toman INTEGER NOT NULL DEFAULT 0,
  deductions_toman INTEGER NOT NULL DEFAULT 0,
  net_toman INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ISSUED'
    CHECK(status IN ('DRAFT','ISSUED','PAID','VOID')),
  note TEXT,
  issued_by_user_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  paid_by_user_id TEXT,
  paid_at TEXT,
  payment_tracking_number TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(caregiver_id,contract_id,period_key),
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  FOREIGN KEY(issued_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_caregiver_period
  ON caregiver_payroll_slips(caregiver_id,period_key DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_status_issued
  ON caregiver_payroll_slips(status,issued_at DESC);

CREATE TABLE IF NOT EXISTS support_threads (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  contract_id TEXT,
  category TEXT NOT NULL CHECK(category IN ('CASE','URGENT_SECURITY')),
  subject TEXT NOT NULL,
  danger_confirmed INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK(priority IN ('NORMAL','HIGH','CRITICAL')),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK(status IN ('OPEN','PENDING','RESOLVED','CLOSED')),
  assigned_user_id TEXT,
  created_by_user_id TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  FOREIGN KEY(assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_support_thread_caregiver_updated
  ON support_threads(caregiver_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_thread_queue
  ON support_threads(category,status,priority,updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK(message_type IN ('TEXT','VOICE','SYSTEM')),
  text_content TEXT,
  stored_file_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES support_threads(id) ON DELETE RESTRICT,
  FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(stored_file_id) REFERENCES stored_files(id) ON DELETE RESTRICT,
  CHECK(text_content IS NOT NULL OR stored_file_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread_created
  ON support_messages(thread_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_wallet_transaction_no_update_v1
BEFORE UPDATE ON caregiver_wallet_transactions
BEGIN SELECT RAISE(ABORT,'wallet_transaction_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_wallet_transaction_no_delete_v1
BEFORE DELETE ON caregiver_wallet_transactions
BEGIN SELECT RAISE(ABORT,'wallet_transaction_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_support_message_no_update_v1
BEFORE UPDATE ON support_messages
BEGIN SELECT RAISE(ABORT,'support_message_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_support_message_no_delete_v1
BEFORE DELETE ON support_messages
BEGIN SELECT RAISE(ABORT,'support_message_is_immutable'); END;
