import {
  type AuthUser, type Env, audit, ensureSchema, fail, findCaregiverId, hasRole, json,
  nowIso, randomId, readBody, str,
} from "./lib";

const ASSIGNER_ROLES = ["ADMIN", "RECRUITER", "HR"];
const HEARTBEAT_CAP_SECONDS = 30;
let trainingSchemaReady: Promise<void> | undefined;

type TrainingRow = Record<string, unknown>;

async function ensureTrainingSchema(env: Env) {
  await ensureSchema(env);
  if (!trainingSchemaReady) {
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
      `CREATE INDEX IF NOT EXISTS idx_enrollments_caregiver_status ON enrollments(caregiver_id,status)`,
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
      `CREATE TABLE IF NOT EXISTS training_view_sessions (
        id TEXT PRIMARY KEY,enrollment_id TEXT NOT NULL,caregiver_id TEXT NOT NULL,client_session_key TEXT NOT NULL,
        opened_at TEXT NOT NULL,last_heartbeat_at TEXT NOT NULL,closed_at TEXT,duration_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
        UNIQUE(enrollment_id,client_session_key)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_training_sessions_enrollment ON training_view_sessions(enrollment_id,opened_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_training_sessions_caregiver ON training_view_sessions(caregiver_id,opened_at DESC)`,
    ];
    trainingSchemaReady = env.DB.batch(statements.map((sql) => env.DB.prepare(sql)))
      .then(() => undefined)
      .catch((error) => { trainingSchemaReady = undefined; throw error; });
  }
  return trainingSchemaReady;
}

function staffAllowed(actor: AuthUser) {
  return hasRole(actor, ASSIGNER_ROLES);
}

function roleLabel(role: unknown) {
  return ({ ADMIN: "مدیر سامانه", RECRUITER: "کارشناس جذب", HR: "کارشناس منابع انسانی" } as Record<string, string>)[str(role).toUpperCase()] || str(role);
}

async function caregiverScope(request: Request, env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() === "CAREGIVER") return actor.caregiverId;
  if (!staffAllowed(actor)) return null;
  const requested = new URL(request.url).searchParams.get("caregiverId");
  return requested ? findCaregiverId(env, requested) : null;
}

const assignmentSelect = `
  SELECT e.id AS enrollmentId,e.caregiver_id AS caregiverId,e.course_id AS courseId,e.status,e.progress,e.score,
    e.assigned_at AS assignedAt,e.started_at AS startedAt,e.completed_at AS completedAt,
    c.code,c.title,c.description,c.category,c.cover_url AS coverUrl,c.content_url AS contentUrl,
    c.duration_minutes AS durationMinutes,c.mandatory,c.credit,c.passing_score AS passingScore,
    u.full_name AS assignedByName,u.role AS assignedByRole,
    m.due_at AS dueAt,m.assignment_note AS assignmentNote,
    COALESCE(g.open_count,0) AS openCount,COALESCE(g.total_view_seconds,0) AS totalViewSeconds,
    g.last_opened_at AS lastOpenedAt,g.last_viewed_at AS lastViewedAt
  FROM enrollments e
  JOIN courses c ON c.id=e.course_id
  JOIN users u ON u.id=e.assigned_by_user_id AND UPPER(u.role) IN ('ADMIN','RECRUITER','HR')
  LEFT JOIN training_assignment_meta m ON m.enrollment_id=e.id
  LEFT JOIN training_engagement g ON g.enrollment_id=e.id`;

function normalizeAssignment(row: TrainingRow) {
  return {
    ...row,
    mandatory: Boolean(Number(row.mandatory || 0)),
    assignedByRoleLabel: roleLabel(row.assignedByRole),
    openCount: Number(row.openCount || 0),
    totalViewSeconds: Number(row.totalViewSeconds || 0),
    durationMinutes: Number(row.durationMinutes || 0),
    progress: Number(row.progress || 0),
  };
}

export async function getMyTraining(request: Request, env: Env, actor: AuthUser) {
  await ensureTrainingSchema(env);
  const caregiverId = await caregiverScope(request, env, actor);
  if (!caregiverId) {
    return fail(actor.role.toUpperCase() === "CAREGIVER" ? "حساب شما به پرونده مراقب متصل نیست." : "شناسه مراقب لازم است.", 409, "caregiver_profile_missing");
  }
  const result = await env.DB.prepare(`${assignmentSelect}
    WHERE e.caregiver_id=? AND c.status='ACTIVE'
    ORDER BY CASE e.status WHEN 'ASSIGNED' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'COMPLETED' THEN 2 ELSE 3 END,e.assigned_at DESC`)
    .bind(caregiverId).all<TrainingRow>();
  const assignments = (result.results || []).map(normalizeAssignment);
  return json({ data: {
    caregiverId,
    assignments,
    summary: {
      assigned: assignments.length,
      opened: assignments.filter((item) => Number(item.openCount || 0) > 0).length,
      completed: assignments.filter((item) => String(item.status) === "COMPLETED").length,
      totalViewSeconds: assignments.reduce((sum, item) => sum + Number(item.totalViewSeconds || 0), 0),
    },
  } });
}

export async function getTrainingAdmin(env: Env, actor: AuthUser) {
  await ensureTrainingSchema(env);
  if (!staffAllowed(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const [courses, assignments] = await Promise.all([
    env.DB.prepare(`SELECT c.id,c.code,c.title,c.description,c.category,c.cover_url AS coverUrl,c.content_url AS contentUrl,
      c.duration_minutes AS durationMinutes,c.mandatory,c.credit,c.passing_score AS passingScore,c.status,
      c.created_at AS createdAt,c.updated_at AS updatedAt,
      COUNT(e.id) AS assignedCount,
      SUM(CASE WHEN COALESCE(g.open_count,0)>0 THEN 1 ELSE 0 END) AS openedCaregiverCount,
      COALESCE(SUM(g.open_count),0) AS totalOpenCount,COALESCE(SUM(g.total_view_seconds),0) AS totalViewSeconds
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id=c.id
      LEFT JOIN training_engagement g ON g.enrollment_id=e.id
      GROUP BY c.id ORDER BY c.created_at DESC`).all<TrainingRow>(),
    env.DB.prepare(`${assignmentSelect}
      JOIN caregivers cg ON cg.id=e.caregiver_id
      WHERE c.status<>'DELETED'
      ORDER BY e.assigned_at DESC LIMIT 500`).all<TrainingRow & { fullName?: string }>(),
  ]);
  const assignmentRows = await env.DB.prepare(`${assignmentSelect.replace("FROM enrollments e", "FROM enrollments e")},
    caregivers.full_name AS caregiverName,caregivers.membership_code AS membershipCode
    FROM enrollments e`).all().catch(() => null);
  void assignmentRows;
  const detailed = await env.DB.prepare(`SELECT e.id AS enrollmentId,e.caregiver_id AS caregiverId,cg.full_name AS caregiverName,
    cg.membership_code AS membershipCode,c.title,c.code,e.status,e.progress,e.assigned_at AS assignedAt,
    u.full_name AS assignedByName,u.role AS assignedByRole,m.due_at AS dueAt,m.assignment_note AS assignmentNote,
    COALESCE(g.open_count,0) AS openCount,COALESCE(g.total_view_seconds,0) AS totalViewSeconds,
    g.last_opened_at AS lastOpenedAt,g.last_viewed_at AS lastViewedAt
    FROM enrollments e JOIN courses c ON c.id=e.course_id JOIN caregivers cg ON cg.id=e.caregiver_id
    JOIN users u ON u.id=e.assigned_by_user_id AND UPPER(u.role) IN ('ADMIN','RECRUITER','HR')
    LEFT JOIN training_assignment_meta m ON m.enrollment_id=e.id
    LEFT JOIN training_engagement g ON g.enrollment_id=e.id
    WHERE c.status<>'DELETED' ORDER BY e.assigned_at DESC LIMIT 500`).all<TrainingRow>();
  return json({ data: {
    courses: (courses.results || []).map((row) => ({ ...row, mandatory: Boolean(Number(row.mandatory || 0)) })),
    assignments: (detailed.results || []).map((row) => ({ ...normalizeAssignment(row), caregiverName: row.caregiverName, membershipCode: row.membershipCode })),
  } });
}

export async function createCourse(request: Request, env: Env, actor: AuthUser) {
  await ensureTrainingSchema(env);
  if (!staffAllowed(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  const title = str(body?.title);
  if (!title) return fail("عنوان آموزش الزامی است.");
  const id = randomId("crs_");
  const timestamp = nowIso();
  const code = str(body?.code) || `TRN-${Date.now().toString(36).toUpperCase()}`;
  const row = {
    id, code, title,
    description: str(body?.description) || null,
    category: str(body?.category) || "عمومی",
    coverUrl: str(body?.coverUrl) || null,
    contentUrl: str(body?.contentUrl) || null,
    durationMinutes: Math.max(0, Math.trunc(Number(body?.durationMinutes || 0))),
    mandatory: body?.mandatory ? 1 : 0,
    credit: Math.max(0, Math.trunc(Number(body?.credit || 0))),
    passingScore: Math.min(100, Math.max(0, Math.trunc(Number(body?.passingScore || 60)))),
  };
  try {
    await env.DB.prepare(`INSERT INTO courses(id,code,title,description,category,cover_url,content_url,duration_minutes,mandatory,credit,passing_score,target_levels_json,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,'[]','ACTIVE',?,?)`)
      .bind(row.id,row.code,row.title,row.description,row.category,row.coverUrl,row.contentUrl,row.durationMinutes,row.mandatory,row.credit,row.passingScore,timestamp,timestamp).run();
  } catch {
    return fail("کد آموزش تکراری است.", 409, "duplicate_course");
  }
  await audit(request, env, actor, "CREATE", "course", id, row);
  return json({ data: { ...row, mandatory: Boolean(row.mandatory), createdAt: timestamp } }, 201);
}

export async function updateCourse(request: Request, env: Env, actor: AuthUser, id: string) {
  await ensureTrainingSchema(env);
  if (!staffAllowed(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات معتبر نیست.");
  const fields: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => { fields.push(`${column}=?`); values.push(value); };
  if (body.title !== undefined) add("title", str(body.title));
  if (body.description !== undefined) add("description", str(body.description) || null);
  if (body.category !== undefined) add("category", str(body.category) || null);
  if (body.coverUrl !== undefined) add("cover_url", str(body.coverUrl) || null);
  if (body.contentUrl !== undefined) add("content_url", str(body.contentUrl) || null);
  if (body.durationMinutes !== undefined) add("duration_minutes", Math.max(0, Math.trunc(Number(body.durationMinutes || 0))));
  if (body.mandatory !== undefined) add("mandatory", body.mandatory ? 1 : 0);
  if (body.credit !== undefined) add("credit", Math.max(0, Math.trunc(Number(body.credit || 0))));
  if (body.status !== undefined) add("status", str(body.status).toUpperCase() || "ACTIVE");
  if (!fields.length) return fail("تغییری ارسال نشده است.");
  add("updated_at", nowIso());
  values.push(id);
  await env.DB.prepare(`UPDATE courses SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
  await audit(request, env, actor, "UPDATE", "course", id, body);
  return json({ ok: true });
}

export async function assignCourse(request: Request, env: Env, actor: AuthUser) {
  await ensureTrainingSchema(env);
  if (!staffAllowed(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  const courseId = str(body?.courseId);
  const requested = Array.isArray(body?.caregiverIds) ? body?.caregiverIds : [body?.caregiverId];
  if (!courseId || !requested.length) return fail("آموزش و حداقل یک مراقب باید انتخاب شود.");
  const course = await env.DB.prepare("SELECT id,title FROM courses WHERE id=? AND status='ACTIVE' LIMIT 1").bind(courseId).first<{ id: string; title: string }>();
  if (!course) return fail("آموزش فعال پیدا نشد.", 404, "course_not_found");
  const caregiverIds = [...new Set((await Promise.all(requested.map((value) => findCaregiverId(env, value)))).filter(Boolean))] as string[];
  if (!caregiverIds.length) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  const timestamp = nowIso();
  const dueAt = str(body?.dueAt) || null;
  const assignmentNote = str(body?.assignmentNote) || null;
  const assigned: string[] = [];
  for (const caregiverId of caregiverIds.slice(0, 100)) {
    let enrollment = await env.DB.prepare("SELECT id FROM enrollments WHERE caregiver_id=? AND course_id=? LIMIT 1")
      .bind(caregiverId, courseId).first<{ id: string }>();
    if (!enrollment) {
      const id = randomId("enr_");
      await env.DB.prepare(`INSERT INTO enrollments(id,caregiver_id,course_id,assigned_by_user_id,status,progress,assigned_at,created_at,updated_at)
        VALUES(?,?,?,?,'ASSIGNED',0,?,?,?)`).bind(id,caregiverId,courseId,actor.id,timestamp,timestamp,timestamp).run();
      enrollment = { id };
    } else {
      await env.DB.prepare("UPDATE enrollments SET assigned_by_user_id=?,assigned_at=?,updated_at=? WHERE id=?")
        .bind(actor.id,timestamp,timestamp,enrollment.id).run();
    }
    await env.DB.prepare(`INSERT INTO training_assignment_meta(enrollment_id,due_at,assignment_note,assigned_from_role,created_at,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET due_at=excluded.due_at,assignment_note=excluded.assignment_note,
      assigned_from_role=excluded.assigned_from_role,updated_at=excluded.updated_at`)
      .bind(enrollment.id,dueAt,assignmentNote,actor.role.toUpperCase(),timestamp,timestamp).run();
    await env.DB.prepare(`INSERT INTO notifications(id,caregiver_id,user_id,type,title,body,action_url,created_at)
      VALUES(?,?,NULL,'TRAINING_ASSIGNED','آموزش جدید برای شما ارسال شد',?, '/training',?)`)
      .bind(randomId("ntf_"),caregiverId,`${course.title} توسط ${actor.fullName} برای شما ارسال شد.`,timestamp).run().catch(() => undefined);
    assigned.push(enrollment.id);
  }
  await audit(request, env, actor, "ASSIGN", "course", courseId, { caregiverIds, dueAt });
  return json({ data: { courseId, assignedCount: assigned.length, enrollmentIds: assigned } }, 201);
}

async function ownEnrollment(env: Env, actor: AuthUser, enrollmentId: string) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) return null;
  return env.DB.prepare(`${assignmentSelect} WHERE e.id=? AND e.caregiver_id=? AND c.status='ACTIVE' LIMIT 1`)
    .bind(enrollmentId, actor.caregiverId).first<TrainingRow>();
}

export async function openTraining(request: Request, env: Env, actor: AuthUser, enrollmentId: string) {
  await ensureTrainingSchema(env);
  const enrollment = await ownEnrollment(env, actor, enrollmentId);
  if (!enrollment) return fail("این آموزش برای شما ارسال نشده است.", 404, "assignment_not_found");
  const body = await readBody(request);
  const clientKey = str(body?.clientSessionKey) || randomId("client_");
  const existing = await env.DB.prepare("SELECT id,closed_at AS closedAt FROM training_view_sessions WHERE enrollment_id=? AND client_session_key=? LIMIT 1")
    .bind(enrollmentId,clientKey).first<{ id: string; closedAt: string | null }>();
  if (existing && !existing.closedAt) return json({ data: { sessionId: existing.id, assignment: normalizeAssignment(enrollment) } });
  const timestamp = nowIso();
  const sessionId = randomId("tvs_");
  await env.DB.prepare(`INSERT INTO training_view_sessions(id,enrollment_id,caregiver_id,client_session_key,opened_at,last_heartbeat_at,duration_seconds,created_at)
    VALUES(?,?,?,?,?,?,0,?)`).bind(sessionId,enrollmentId,actor.caregiverId,clientKey,timestamp,timestamp,timestamp).run();
  await env.DB.prepare(`INSERT INTO training_engagement(enrollment_id,open_count,total_view_seconds,last_opened_at,last_viewed_at,updated_at)
    VALUES(?,1,0,?,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET open_count=open_count+1,last_opened_at=excluded.last_opened_at,updated_at=excluded.updated_at`)
    .bind(enrollmentId,timestamp,timestamp,timestamp).run();
  await env.DB.prepare(`UPDATE enrollments SET status=CASE WHEN status='ASSIGNED' THEN 'IN_PROGRESS' ELSE status END,
    started_at=COALESCE(started_at,?),progress=CASE WHEN progress=0 THEN 1 ELSE progress END,updated_at=? WHERE id=?`)
    .bind(timestamp,timestamp,enrollmentId).run();
  await audit(request, env, actor, "OPEN", "training_enrollment", enrollmentId, { sessionId });
  return json({ data: { sessionId, assignment: normalizeAssignment({ ...enrollment, openCount: Number(enrollment.openCount || 0) + 1 }) } });
}

async function accrueSession(env: Env, actor: AuthUser, sessionId: string) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) return null;
  const session = await env.DB.prepare(`SELECT id,enrollment_id AS enrollmentId,last_heartbeat_at AS lastHeartbeatAt,
    closed_at AS closedAt,duration_seconds AS durationSeconds FROM training_view_sessions WHERE id=? AND caregiver_id=? LIMIT 1`)
    .bind(sessionId,actor.caregiverId).first<{ id: string; enrollmentId: string; lastHeartbeatAt: string; closedAt: string | null; durationSeconds: number }>();
  if (!session || session.closedAt) return session;
  const timestamp = nowIso();
  const elapsed = Math.max(0, Math.floor((Date.parse(timestamp) - Date.parse(session.lastHeartbeatAt)) / 1000));
  const delta = Math.min(HEARTBEAT_CAP_SECONDS, elapsed);
  if (delta > 0) {
    await env.DB.batch([
      env.DB.prepare("UPDATE training_view_sessions SET last_heartbeat_at=?,duration_seconds=duration_seconds+? WHERE id=? AND closed_at IS NULL")
        .bind(timestamp,delta,sessionId),
      env.DB.prepare(`INSERT INTO training_engagement(enrollment_id,open_count,total_view_seconds,last_viewed_at,updated_at)
        VALUES(?,0,?,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET total_view_seconds=total_view_seconds+excluded.total_view_seconds,
        last_viewed_at=excluded.last_viewed_at,updated_at=excluded.updated_at`)
        .bind(session.enrollmentId,delta,timestamp,timestamp),
    ]);
    session.durationSeconds = Number(session.durationSeconds || 0) + delta;
    session.lastHeartbeatAt = timestamp;
  }
  return session;
}

export async function heartbeatTraining(env: Env, actor: AuthUser, sessionId: string) {
  await ensureTrainingSchema(env);
  const session = await accrueSession(env, actor, sessionId);
  if (!session) return fail("نشست مشاهده پیدا نشد.", 404, "session_not_found");
  return json({ data: { sessionId, durationSeconds: Number(session.durationSeconds || 0), closed: Boolean(session.closedAt) } });
}

export async function closeTraining(request: Request, env: Env, actor: AuthUser, sessionId: string) {
  await ensureTrainingSchema(env);
  const session = await accrueSession(env, actor, sessionId);
  if (!session) return fail("نشست مشاهده پیدا نشد.", 404, "session_not_found");
  if (!session.closedAt) {
    const timestamp = nowIso();
    await env.DB.prepare("UPDATE training_view_sessions SET closed_at=?,last_heartbeat_at=? WHERE id=? AND closed_at IS NULL")
      .bind(timestamp,timestamp,sessionId).run();
    await audit(request, env, actor, "CLOSE", "training_view_session", sessionId, { durationSeconds: session.durationSeconds });
  }
  return json({ data: { sessionId, durationSeconds: Number(session.durationSeconds || 0), closed: true } });
}

export async function completeTraining(request: Request, env: Env, actor: AuthUser, enrollmentId: string) {
  await ensureTrainingSchema(env);
  const enrollment = await ownEnrollment(env, actor, enrollmentId);
  if (!enrollment) return fail("این آموزش برای شما ارسال نشده است.", 404, "assignment_not_found");
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare("UPDATE enrollments SET status='COMPLETED',progress=100,completed_at=?,updated_at=? WHERE id=?")
      .bind(timestamp,timestamp,enrollmentId),
    env.DB.prepare(`INSERT INTO training_engagement(enrollment_id,open_count,total_view_seconds,last_completed_at,updated_at)
      VALUES(?,0,0,?,?) ON CONFLICT(enrollment_id) DO UPDATE SET last_completed_at=excluded.last_completed_at,updated_at=excluded.updated_at`)
      .bind(enrollmentId,timestamp,timestamp),
  ]);
  await audit(request, env, actor, "COMPLETE", "training_enrollment", enrollmentId);
  return json({ ok: true, completedAt: timestamp });
}
