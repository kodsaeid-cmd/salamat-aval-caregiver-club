ALTER TABLE courses ADD COLUMN exam_url TEXT;

CREATE TABLE IF NOT EXISTS training_exam_results (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  enrollment_id TEXT,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 20),
  exam_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  note TEXT,
  recorded_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
  FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
  FOREIGN KEY(recorded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_training_exam_results_caregiver
  ON training_exam_results(caregiver_id, exam_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_exam_results_course
  ON training_exam_results(course_id, exam_date DESC, created_at DESC);
