CREATE TABLE IF NOT EXISTS caregiver_support_assignments (
  caregiver_id TEXT PRIMARY KEY,
  support_user_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  assigned_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(support_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS caregiver_calendar_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'GENERAL',
  subject_name TEXT,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  recurrence TEXT NOT NULL DEFAULT 'NONE',
  repeat_until TEXT,
  medication_name TEXT,
  medication_dose TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS caregiver_leave_requests (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  support_user_id TEXT,
  leave_type TEXT NOT NULL,
  leave_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_by_user_id TEXT NOT NULL,
  decided_by_user_id TEXT,
  decision_note TEXT,
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(support_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(requested_by_user_id) REFERENCES users(id),
  FOREIGN KEY(decided_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  caregiver_id TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  route TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_caregiver_date ON caregiver_calendar_events(caregiver_id,event_date,status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence ON caregiver_calendar_events(caregiver_id,recurrence,event_date,repeat_until);
CREATE INDEX IF NOT EXISTS idx_leave_caregiver_date ON caregiver_leave_requests(caregiver_id,leave_date,status);
CREATE INDEX IF NOT EXISTS idx_leave_support_status ON caregiver_leave_requests(support_user_id,status,leave_date);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON system_notifications(recipient_user_id,read_at,created_at DESC);
