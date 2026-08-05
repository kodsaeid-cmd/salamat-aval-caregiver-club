import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  getUser,
  json,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

export const CAREGIVER_TRAINING_UNITY_VERSION = "3.0.0";
const HEARTBEAT_CAP_SECONDS = 30;
let schemaReady: Promise<void> | null = null;

type AssignmentRow = {
  enrollmentId: string;
  caregiverId: string;
  courseId: string;
  status: string;
  progress: number;
  score: number | null;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  contentUrl: string | null;
  durationMinutes: number;
  mandatory: number;
  credit: number;
  passingScore: number;
  assignedByName: string | null;
  assignedByRole: string | null;
  dueAt: string | null;
  assignmentNote: string | null;
  openCount: number;
  totalViewSeconds: number;
  lastOpenedAt: string | null;
  lastViewedAt: string | null;
};

type SessionRow = {
  id: string;
  enrollmentId: string;
  lastHeartbeatAt: string;
  closedAt: string | null;
  durationSeconds: number;
};

async function ensureTrainingSchema(env: Env) {
  await ensureSchema(env);
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT,category TEXT,
        cover_url TEXT,content_url TEXT,duration_minutes INTEGER NOT NULL DEFAULT 0,
        mandatory INTEGER NOT NULL DEFAULT 0 CHECK (mandatory IN (0,1)),credit INTEGER NOT NULL DEFAULT 0,
        passing_score INTEGER NOT NULL DEFAULT 60,target_levels_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'ACTIVE',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,course_id TEXT NOT NULL,assigned_by_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'ASSIGNED',progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        score INTEGER,assigned_at TEXT NOT NULL,started_at TEXT,completed_at TEXT,certificate_url TEXT,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY(assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(caregiver_id,course_id)
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_assignment_meta (
        enrollment_id TEXT PRIMARY KEY,due_at TEXT,assignment_note TEXT,assigned_from_role TEXT,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_engagement (
        enrollment_id TEXT PRIMARY KEY,open_count INTEGER NOT NULL DEFAULT 0,total_view_seconds INTEGER NOT NULL DEFAULT 0,
        last_opened_at TEXT,last_viewed_at TEXT,last_completed_at TEXT,updated_at TEXT NOT NULL,
        FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_view_sessions (
        id TEXT PRIMARY KEY,enrollment_id TEXT NOT NULL,caregiver_id TEXT NOT NULL,client_session_key TEXT NOT NULL,
        opened_at TEXT NOT NULL,last_heartbeat_at TEXT NOT NULL,closed_at TEXT,duration_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
        UNIQUE(enrollment_id,client_session_key)
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_enrollments_caregiver_status ON enrollments(caregiver_id,status)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_training_sessions_enrollment ON training_view_sessions(enrollment_id,opened_at DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_training_sessions_caregiver ON training_view_sessions(caregiver_id,opened_at DESC)"),
    ]).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

const assignmentSelect = `
  SELECT e.id AS enrollmentId,e.caregiver_id AS caregiverId,e.course_id AS courseId,e.status,e.progress,e.score,
    e.assigned_at AS assignedAt,e.started_at AS startedAt,e.completed_at AS completedAt,
    c.code,c.title,c.description,c.category,c.cover_url AS coverUrl,c.content_url AS contentUrl,
    c.duration_minutes AS durationMinutes,c.mandatory,c.credit,c.passing_score AS passingScore,
    COALESCE(NULLIF(u.full_name,''),'سامانه سلامت اول') AS assignedByName,
    COALESCE(NULLIF(u.role,''),NULLIF(m.assigned_from_role,''),'ADMIN') AS assignedByRole,
    m.due_at AS dueAt,m.assignment_note AS assignmentNote,
    COALESCE(g.open_count,0) AS openCount,COALESCE(g.total_view_seconds,0) AS totalViewSeconds,
    g.last_opened_at AS lastOpenedAt,g.last_viewed_at AS lastViewedAt
  FROM enrollments e
  JOIN courses c ON c.id=e.course_id
  LEFT JOIN users u ON u.id=e.assigned_by_user_id
  LEFT JOIN training_assignment_meta m ON m.enrollment_id=e.id
  LEFT JOIN training_engagement g ON g.enrollment_id=e.id`;

function roleLabel(value: unknown) {
  const role = str(value).toUpperCase();
  return ({ ADMIN: "مدیر سامانه", RECRUITER: "کارشناس جذب", HR: "کارشناس منابع انسانی" } as Record<string, string>)[role]
    || role
    || "سامانه سلامت اول";
}

function normalize(row: AssignmentRow) {
  return {
    ...row,
    assignedByName: str(row.assignedByName) || "سامانه سلامت اول",
    assignedByRole: str(row.assignedByRole) || "ADMIN",
    assignedByRoleLabel: roleLabel(row.assignedByRole),
    mandatory: Boolean(Number(row.mandatory || 0)),
    openCount: Number(row.openCount || 0),
    totalViewSeconds: Number(row.totalViewSeconds || 0),
    durationMinutes: Number(row.durationMinutes || 0),
    progress: Number(row.progress || 0),
  };
}

function caregiverActor(actor: AuthUser | null) {
  return Boolean(actor && actor.role.toUpperCase() === "CAREGIVER" && actor.caregiverId);
}

async function ownAssignment(env: Env, actor: AuthUser, enrollmentId: string) {
  return env.DB.prepare(`${assignmentSelect}
    WHERE e.id=? AND e.caregiver_id=? AND UPPER(c.status)='ACTIVE' LIMIT 1`)
    .bind(enrollmentId, actor.caregiverId).first<AssignmentRow>();
}

async function listTraining(env: Env, actor: AuthUser) {
  const caregiverId = str(actor.caregiverId);
  const result = await env.DB.prepare(`${assignmentSelect}
    WHERE e.caregiver_id=? AND UPPER(c.status)='ACTIVE' AND UPPER(e.status)<>'CANCELLED'
    ORDER BY CASE UPPER(e.status) WHEN 'ASSIGNED' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'COMPLETED' THEN 2 ELSE 3 END,e.assigned_at DESC`)
    .bind(caregiverId).all<AssignmentRow>();
  const assignments = (result.results || []).map(normalize);
  return securityHeaders(json({
    data: {
      caregiverId,
      assignments,
      summary: {
        assigned: assignments.length,
        opened: assignments.filter((item) => item.openCount > 0).length,
        completed: assignments.filter((item) => String(item.status).toUpperCase() === "COMPLETED").length,
        totalViewSeconds: assignments.reduce((sum, item) => sum + item.totalViewSeconds, 0),
      },
      source: "caregiver-training-unity-v3",
      version: CAREGIVER_TRAINING_UNITY_VERSION,
    },
  }));
}

async function openTraining(request: Request, env: Env, actor: AuthUser, enrollmentId: string) {
  const assignment = await ownAssignment(env, actor, enrollmentId);
  if (!assignment) return securityHeaders(fail("این آموزش برای پرونده شما تخصیص داده نشده است.", 404, "assignment_not_found"));
  const body = await readBody(request);
  const clientKey = str(body?.clientSessionKey) || randomId("client_");
  const existing = await env.DB.prepare(`SELECT id,closed_at AS closedAt
    FROM training_view_sessions WHERE enrollment_id=? AND client_session_key=? LIMIT 1`)
    .bind(enrollmentId, clientKey).first<{ id: string; closedAt: string | null }>();
  if (existing && !existing.closedAt) {
    return securityHeaders(json({ data: { sessionId: existing.id, assignment: normalize(assignment) } }));
  }

  const timestamp = nowIso();
  const sessionId = randomId("tvs_");
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO training_view_sessions(
      id,enrollment_id,caregiver_id,client_session_key,opened_at,last_heartbeat_at,duration_seconds,created_at
    ) VALUES(?,?,?,?,?,?,0,?)`).bind(sessionId, enrollmentId, actor.caregiverId, clientKey, timestamp, timestamp, timestamp),
    env.DB.prepare(`INSERT INTO training_engagement(
      enrollment_id,open_count,total_view_seconds,last_opened_at,last_viewed_at,updated_at
    ) VALUES(?,1,0,?,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET
      open_count=open_count+1,last_opened_at=excluded.last_opened_at,updated_at=excluded.updated_at`)
      .bind(enrollmentId, timestamp, timestamp, timestamp),
    env.DB.prepare(`UPDATE enrollments SET
      status=CASE WHEN UPPER(status)='ASSIGNED' THEN 'IN_PROGRESS' ELSE status END,
      started_at=COALESCE(started_at,?),progress=CASE WHEN progress=0 THEN 1 ELSE progress END,updated_at=?
      WHERE id=?`).bind(timestamp, timestamp, enrollmentId),
  ]);
  await audit(request, env, actor, "OPEN", "training_enrollment", enrollmentId, { sessionId, source: "caregiver-training-unity-v3" });
  return securityHeaders(json({
    data: {
      sessionId,
      assignment: normalize({ ...assignment, openCount: Number(assignment.openCount || 0) + 1 }),
    },
  }));
}

async function accrue(env: Env, actor: AuthUser, sessionId: string) {
  const session = await env.DB.prepare(`SELECT id,enrollment_id AS enrollmentId,last_heartbeat_at AS lastHeartbeatAt,
    closed_at AS closedAt,duration_seconds AS durationSeconds
    FROM training_view_sessions WHERE id=? AND caregiver_id=? LIMIT 1`)
    .bind(sessionId, actor.caregiverId).first<SessionRow>();
  if (!session || session.closedAt) return session;
  const timestamp = nowIso();
  const elapsed = Math.max(0, Math.floor((Date.parse(timestamp) - Date.parse(session.lastHeartbeatAt)) / 1000));
  const delta = Math.min(HEARTBEAT_CAP_SECONDS, elapsed);
  if (delta > 0) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE training_view_sessions SET last_heartbeat_at=?,duration_seconds=duration_seconds+?
        WHERE id=? AND closed_at IS NULL`).bind(timestamp, delta, sessionId),
      env.DB.prepare(`INSERT INTO training_engagement(
        enrollment_id,open_count,total_view_seconds,last_viewed_at,updated_at
      ) VALUES(?,0,?,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET
        total_view_seconds=total_view_seconds+excluded.total_view_seconds,
        last_viewed_at=excluded.last_viewed_at,updated_at=excluded.updated_at`)
        .bind(session.enrollmentId, delta, timestamp, timestamp),
    ]);
    session.durationSeconds = Number(session.durationSeconds || 0) + delta;
    session.lastHeartbeatAt = timestamp;
  }
  return session;
}

async function heartbeat(env: Env, actor: AuthUser, sessionId: string) {
  const session = await accrue(env, actor, sessionId);
  if (!session) return securityHeaders(fail("نشست مشاهده پیدا نشد.", 404, "session_not_found"));
  return securityHeaders(json({ data: { sessionId, durationSeconds: Number(session.durationSeconds || 0), closed: Boolean(session.closedAt) } }));
}

async function closeTraining(request: Request, env: Env, actor: AuthUser, sessionId: string) {
  const session = await accrue(env, actor, sessionId);
  if (!session) return securityHeaders(fail("نشست مشاهده پیدا نشد.", 404, "session_not_found"));
  if (!session.closedAt) {
    const timestamp = nowIso();
    await env.DB.prepare("UPDATE training_view_sessions SET closed_at=?,last_heartbeat_at=? WHERE id=? AND closed_at IS NULL")
      .bind(timestamp, timestamp, sessionId).run();
    await audit(request, env, actor, "CLOSE", "training_view_session", sessionId, { durationSeconds: session.durationSeconds });
  }
  return securityHeaders(json({ data: { sessionId, durationSeconds: Number(session.durationSeconds || 0), closed: true } }));
}

async function completeTraining(request: Request, env: Env, actor: AuthUser, enrollmentId: string) {
  const assignment = await ownAssignment(env, actor, enrollmentId);
  if (!assignment) return securityHeaders(fail("این آموزش برای پرونده شما تخصیص داده نشده است.", 404, "assignment_not_found"));
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare("UPDATE enrollments SET status='COMPLETED',progress=100,completed_at=?,updated_at=? WHERE id=?")
      .bind(timestamp, timestamp, enrollmentId),
    env.DB.prepare(`INSERT INTO training_engagement(
      enrollment_id,open_count,total_view_seconds,last_completed_at,updated_at
    ) VALUES(?,0,0,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET
      last_completed_at=excluded.last_completed_at,updated_at=excluded.updated_at`).bind(enrollmentId, timestamp, timestamp),
  ]);
  await audit(request, env, actor, "COMPLETE", "training_enrollment", enrollmentId, { source: "caregiver-training-unity-v3" });
  return securityHeaders(json({ ok: true, completedAt: timestamp }));
}

export async function routeCaregiverTrainingUnityV3(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const relevant = path === "/api/training/my"
    || /^\/api\/training\/enrollments\/[^/]+\/(?:open|complete)$/.test(path)
    || /^\/api\/training\/sessions\/[^/]+\/(?:heartbeat|close)$/.test(path);
  if (!relevant) return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  if (!caregiverActor(actor)) return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only"));
  await ensureTrainingSchema(env);

  if (method === "GET" && path === "/api/training/my") return listTraining(env, actor);
  const enrollment = path.match(/^\/api\/training\/enrollments\/([^/]+)\/(open|complete)$/);
  if (enrollment && method === "POST") {
    const id = decodeURIComponent(enrollment[1]);
    return enrollment[2] === "open" ? openTraining(request, env, actor, id) : completeTraining(request, env, actor, id);
  }
  const session = path.match(/^\/api\/training\/sessions\/([^/]+)\/(heartbeat|close)$/);
  if (session && method === "POST") {
    const id = decodeURIComponent(session[1]);
    return session[2] === "heartbeat" ? heartbeat(env, actor, id) : closeTraining(request, env, actor, id);
  }
  return securityHeaders(fail("مسیر آموزش معتبر نیست.", 405, "method_not_allowed"));
}
