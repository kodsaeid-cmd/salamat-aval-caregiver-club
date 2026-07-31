CREATE TABLE IF NOT EXISTS caregiver_calendar_events (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  contract_id TEXT,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  recipient_type TEXT,
  recipient_name TEXT,
  details TEXT,
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS caregiver_leave_requests (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  contract_id TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  reason TEXT NOT NULL,
  replacement_needed INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewer_user_id TEXT,
  reviewer_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewer_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS support_notifications (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'UNREAD',
  created_at TEXT NOT NULL,
  read_at TEXT,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_calendar_caregiver_date ON caregiver_calendar_events(caregiver_id,event_date,event_time);
CREATE INDEX IF NOT EXISTS idx_leave_caregiver_date ON caregiver_leave_requests(caregiver_id,starts_on,ends_on);
CREATE INDEX IF NOT EXISTS idx_support_notifications_status ON support_notifications(status,created_at DESC);
