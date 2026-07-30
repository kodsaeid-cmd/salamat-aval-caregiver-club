PRAGMA foreign_keys = ON;

-- Staff and caregiver authentication identities
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'CAREGIVER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_caregiver_id ON users(caregiver_id);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'LOGIN',
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_mobile_created ON otp_challenges(mobile, created_at DESC);

-- Extended caregiver profile
ALTER TABLE caregivers ADD COLUMN birth_date TEXT;
ALTER TABLE caregivers ADD COLUMN gender TEXT;
ALTER TABLE caregivers ADD COLUMN marital_status TEXT;
ALTER TABLE caregivers ADD COLUMN photo_url TEXT;
ALTER TABLE caregivers ADD COLUMN primary_type TEXT;
ALTER TABLE caregivers ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE caregivers ADD COLUMN work_history TEXT;
ALTER TABLE caregivers ADD COLUMN accepted_shifts_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE caregivers ADD COLUMN start_availability TEXT;
ALTER TABLE caregivers ADD COLUMN cooperation_type TEXT;
ALTER TABLE caregivers ADD COLUMN salary_expectation INTEGER;
ALTER TABLE caregivers ADD COLUMN recruitment_stage TEXT NOT NULL DEFAULT 'IMPORTED';
ALTER TABLE caregivers ADD COLUMN professional_level TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE caregivers ADD COLUMN professional_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE caregivers ADD COLUMN club_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE caregivers ADD COLUMN license_status TEXT NOT NULL DEFAULT 'NOT_ISSUED';
ALTER TABLE caregivers ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 0 CHECK (profile_completed IN (0,1));

CREATE INDEX IF NOT EXISTS idx_caregivers_professional_level ON caregivers(professional_level);
CREATE INDEX IF NOT EXISTS idx_caregivers_recruitment_stage ON caregivers(recruitment_stage);
CREATE INDEX IF NOT EXISTS idx_caregivers_city_status ON caregivers(city, cooperation_status);

-- Documents and credential verification
CREATE TABLE IF NOT EXISTS caregiver_documents (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  verified_by_user_id TEXT,
  verified_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_caregiver ON caregiver_documents(caregiver_id, status);

-- Evaluation system and scorecards
CREATE TABLE IF NOT EXISTS evaluation_periods (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  evaluator_user_id TEXT,
  period_id TEXT,
  period_label TEXT NOT NULL,
  service_quality INTEGER NOT NULL DEFAULT 0,
  family_satisfaction INTEGER NOT NULL DEFAULT 0,
  dignity INTEGER NOT NULL DEFAULT 0,
  professional_conduct INTEGER NOT NULL DEFAULT 0,
  job_discipline INTEGER NOT NULL DEFAULT 0,
  organizational_cooperation INTEGER NOT NULL DEFAULT 0,
  standards_compliance INTEGER NOT NULL DEFAULT 0,
  learning_participation INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  grade TEXT,
  strengths TEXT,
  improvement_areas TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluator_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluations_caregiver_period ON evaluations(caregiver_id, period_label DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);

CREATE TABLE IF NOT EXISTS evaluation_evidence (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  file_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
);

-- Training and learning
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  cover_url TEXT,
  content_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  mandatory INTEGER NOT NULL DEFAULT 0 CHECK (mandatory IN (0,1)),
  credit INTEGER NOT NULL DEFAULT 0,
  passing_score INTEGER NOT NULL DEFAULT 60,
  target_levels_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  assigned_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  score INTEGER,
  assigned_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  certificate_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(caregiver_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_caregiver_status ON enrollments(caregiver_id, status);

-- Referred cases, assignments and shifts
CREATE TABLE IF NOT EXISTS service_cases (
  id TEXT PRIMARY KEY,
  crm_record_id TEXT UNIQUE,
  case_code TEXT NOT NULL UNIQUE,
  patient_display_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  province TEXT,
  city TEXT,
  address_summary TEXT,
  start_date TEXT,
  end_date TEXT,
  shift_pattern TEXT,
  required_skills_json TEXT NOT NULL DEFAULT '[]',
  case_status TEXT NOT NULL DEFAULT 'OPEN',
  support_owner_user_id TEXT,
  crm_modified_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (support_owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_status_city ON service_cases(case_status, city);

CREATE TABLE IF NOT EXISTS case_assignments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  assignment_status TEXT NOT NULL DEFAULT 'REFERRED',
  referred_at TEXT NOT NULL,
  responded_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  rejection_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  UNIQUE(case_id, caregiver_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_caregiver_status ON case_assignments(caregiver_id, assignment_status);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  attendance_status TEXT NOT NULL DEFAULT 'SCHEDULED',
  check_in_at TEXT,
  check_out_at TEXT,
  approved_minutes INTEGER,
  incident_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (assignment_id) REFERENCES case_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shifts_caregiver_date ON shifts(caregiver_id, starts_at DESC);

-- Payroll and financial statements
CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_statements (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  gross_amount INTEGER NOT NULL DEFAULT 0,
  deductions_amount INTEGER NOT NULL DEFAULT 0,
  bonuses_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'CALCULATED',
  paid_at TEXT,
  payment_reference TEXT,
  details_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
  UNIQUE(caregiver_id, period_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_caregiver ON payroll_statements(caregiver_id, created_at DESC);

-- Support communication
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  caregiver_id TEXT,
  opened_by_user_id TEXT,
  case_id TEXT,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'OPEN',
  description TEXT NOT NULL,
  assigned_to_user_id TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL,
  FOREIGN KEY (opened_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_caregiver_status ON support_tickets(caregiver_id, status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  sender_user_id TEXT,
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

-- Notifications and club engagement
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_caregiver_unread ON notifications(caregiver_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_points_caregiver ON point_transactions(caregiver_id, created_at DESC);

-- CRM integration state and auditability
CREATE TABLE IF NOT EXISTS sync_cursors (
  source TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  last_modified_on TEXT,
  last_record_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(source, entity_name)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
