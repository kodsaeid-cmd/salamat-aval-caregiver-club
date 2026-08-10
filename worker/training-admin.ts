import { requireAccess } from "./access-control";
import { type AuthUser, type Env, ensureSchema, fail, json } from "./lib";

let schemaReady: Promise<void> | undefined;
type Row = Record<string, unknown>;

async function ensureTables(env: Env) {
  await ensureSchema(env);
  if (!schemaReady) {
    const statements = [
      `CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT,category TEXT,
        cover_url TEXT,content_url TEXT,duration_minutes INTEGER NOT NULL DEFAULT 0,
        mandatory INTEGER NOT NULL DEFAULT 0 CHECK (mandatory IN (0,1)),credit INTEGER NOT NULL DEFAULT 0,
        passing_score INTEGER NOT NULL DEFAULT 60,target_levels_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'ACTIVE',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,course_id TEXT NOT NULL,assigned_by_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'ASSIGNED',progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        score INTEGER,assigned_at TEXT NOT NULL,started_at TEXT,completed_at TEXT,certificate_url TEXT,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY(assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(caregiver_id,course_id)
      )`,
      `CREATE TABLE IF NOT EXISTS training_assignment_meta (
        enrollment_id TEXT PRIMARY KEY,due_at TEXT,assignment_note TEXT,assigned_from_role TEXT,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS training_engagement (
        enrollment_id TEXT PRIMARY KEY,open_count INTEGER NOT NULL DEFAULT 0,total_view_seconds INTEGER NOT NULL DEFAULT 0,
        last_opened_at TEXT,last_viewed_at TEXT,last_completed_at TEXT,updated_at TEXT NOT NULL,
        FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
      )`,
    ];
    schemaReady = env.DB.batch(statements.map((sql) => env.DB.prepare(sql)))
      .then(() => undefined)
      .catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

function roleLabel(value: unknown) {
  const role = String(value || "").toUpperCase();
  return ({ ADMIN:"مدیر سامانه",RECRUITER:"کارشناس جذب",HR:"منابع انسانی",SUPPORT:"پشتیبان",EVALUATOR:"ارزیاب",EDUCATION:"کارشناس آموزش",OPERATIONS:"مدیر عملیات",SALES_CONSULTANT:"مشاور فروش" } as Record<string,string>)[role] || role;
}

export async function getTrainingAdminDashboard(env: Env, actor: AuthUser) {
  await ensureTables(env);
  const denied = await requireAccess(env, actor, "staff.training", "view");
  if (denied) return denied;
  const [courseResult, assignmentResult] = await Promise.all([
    env.DB.prepare(`SELECT c.id,c.code,c.title,c.description,c.category,c.cover_url AS coverUrl,c.content_url AS contentUrl,
      c.duration_minutes AS durationMinutes,c.mandatory,c.credit,c.passing_score AS passingScore,c.status,
      c.created_at AS createdAt,c.updated_at AS updatedAt,COUNT(e.id) AS assignedCount,
      SUM(CASE WHEN COALESCE(g.open_count,0)>0 THEN 1 ELSE 0 END) AS openedCaregiverCount,
      COALESCE(SUM(g.open_count),0) AS totalOpenCount,COALESCE(SUM(g.total_view_seconds),0) AS totalViewSeconds
      FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id LEFT JOIN training_engagement g ON g.enrollment_id=e.id
      WHERE c.status<>'DELETED' GROUP BY c.id ORDER BY c.created_at DESC`).all<Row>(),
    env.DB.prepare(`SELECT e.id AS enrollmentId,e.caregiver_id AS caregiverId,cg.full_name AS caregiverName,cg.membership_code AS membershipCode,
      c.id AS courseId,c.title,c.code,e.status,e.progress,e.assigned_at AS assignedAt,e.started_at AS startedAt,e.completed_at AS completedAt,
      u.full_name AS assignedByName,u.role AS assignedByRole,m.due_at AS dueAt,m.assignment_note AS assignmentNote,
      COALESCE(g.open_count,0) AS openCount,COALESCE(g.total_view_seconds,0) AS totalViewSeconds,
      g.last_opened_at AS lastOpenedAt,g.last_viewed_at AS lastViewedAt
      FROM enrollments e JOIN courses c ON c.id=e.course_id JOIN caregivers cg ON cg.id=e.caregiver_id
      LEFT JOIN users u ON u.id=e.assigned_by_user_id LEFT JOIN training_assignment_meta m ON m.enrollment_id=e.id
      LEFT JOIN training_engagement g ON g.enrollment_id=e.id WHERE c.status<>'DELETED'
      ORDER BY e.assigned_at DESC LIMIT 500`).all<Row>(),
  ]);
  return json({ data: {
    courses: (courseResult.results || []).map((row) => ({...row,mandatory:Boolean(Number(row.mandatory||0)),durationMinutes:Number(row.durationMinutes||0),assignedCount:Number(row.assignedCount||0),openedCaregiverCount:Number(row.openedCaregiverCount||0),totalOpenCount:Number(row.totalOpenCount||0),totalViewSeconds:Number(row.totalViewSeconds||0)})),
    assignments: (assignmentResult.results || []).map((row) => ({...row,progress:Number(row.progress||0),openCount:Number(row.openCount||0),totalViewSeconds:Number(row.totalViewSeconds||0),assignedByRoleLabel:roleLabel(row.assignedByRole)})),
  } });
}
