import { type AuthUser, type Env, audit, ensureSchema, fail, hasRole, json, nowIso, randomId, readBody, str } from "./lib";

const STAFF = ["ADMIN", "HR", "SUPPORT", "OPERATIONS"];
const EVENT_TYPES = ["MEDICATION", "SHIFT_START", "SHIFT_END", "CARE_TASK", "NOTE"];

export async function ensureWorkCalendarSchema(env: Env) {
  await ensureSchema(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_calendar_events (
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
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_leave_requests (
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
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_notifications (
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
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_calendar_caregiver_date ON caregiver_calendar_events(caregiver_id,event_date,event_time)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leave_caregiver_date ON caregiver_leave_requests(caregiver_id,starts_on,ends_on)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_notifications_status ON support_notifications(status,created_at DESC)"),
  ]);
}

function ownCaregiver(actor: AuthUser, requested?: string | null) {
  const role = actor.role.toUpperCase();
  if (role === "CAREGIVER") return actor.caregiverId || null;
  return hasRole(actor, STAFF) ? str(requested) || null : null;
}

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function validTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

export async function getWorkCalendar(request: Request, env: Env, actor: AuthUser) {
  await ensureWorkCalendarSchema(env);
  const url = new URL(request.url);
  const caregiverId = ownCaregiver(actor, url.searchParams.get("caregiverId"));
  if (!caregiverId) return fail("پرونده مراقب مشخص نیست.", 400, "caregiver_required");
  const month = str(url.searchParams.get("month"));
  const start = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : new Date().toISOString().slice(0, 8) + "01";
  const endDate = new Date(`${start}T00:00:00Z"); endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);
  const [events, leaves, caregiver] = await Promise.all([
    env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_id AS contractId,event_date AS eventDate,event_time AS eventTime,event_type AS eventType,title,recipient_type AS recipientType,recipient_name AS recipientName,details,reminder_minutes AS reminderMinutes,status,created_at AS createdAt,completed_at AS completedAt FROM caregiver_calendar_events WHERE caregiver_id=? AND event_date>=? AND event_date<? ORDER BY event_date,event_time`).bind(caregiverId, start, end).all(),
    env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,contract_id AS contractId,starts_on AS startsOn,ends_on AS endsOn,reason,replacement_needed AS replacementNeeded,status,reviewer_note AS reviewerNote,created_at AS createdAt FROM caregiver_leave_requests WHERE caregiver_id=? AND ends_on>=? AND starts_on<? ORDER BY starts_on`).bind(caregiverId, start, end).all(),
    env.DB.prepare("SELECT id,full_name AS fullName,membership_code AS membershipCode,primary_type AS primaryType FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first(),
  ]);
  return json({ data: { caregiver, month: start.slice(0, 7), events: events.results || [], leaves: leaves.results || [] } });
}

export async function createCalendarEvent(request: Request, env: Env, actor: AuthUser) {
  await ensureWorkCalendarSchema(env);
  const body = await readBody(request);
  const caregiverId = ownCaregiver(actor, str(body.caregiverId));
  const eventDate = str(body.eventDate), eventTime = str(body.eventTime), eventType = str(body.eventType).toUpperCase();
  const title = str(body.title), recipientType = str(body.recipientType), recipientName = str(body.recipientName), details = str(body.details);
  const reminderMinutes = Math.max(0, Math.min(1440, Number(body.reminderMinutes ?? 15)));
  if (!caregiverId || !validDate(eventDate) || !validTime(eventTime) || !EVENT_TYPES.includes(eventType) || !title) return fail("اطلاعات رویداد کامل یا معتبر نیست.", 400, "invalid_event");
  const id = randomId("cal_"); const at = nowIso();
  await env.DB.prepare(`INSERT INTO caregiver_calendar_events(id,caregiver_id,contract_id,event_date,event_time,event_type,title,recipient_type,recipient_name,details,reminder_minutes,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?)`)
    .bind(id, caregiverId, str(body.contractId) || null, eventDate, eventTime, eventType, title, recipientType || null, recipientName || null, details || null, reminderMinutes, actor.id, at, at).run();
  await audit(request, env, actor, "calendar_event_created", "caregiver_calendar_event", id, { caregiverId, eventDate, eventTime, eventType });
  return json({ data: { id } }, 201);
}

export async function completeCalendarEvent(request: Request, env: Env, actor: AuthUser, id: string) {
  await ensureWorkCalendarSchema(env);
  const row = await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM caregiver_calendar_events WHERE id=?").bind(id).first<{ caregiverId: string }>();
  if (!row || (!hasRole(actor, STAFF) && actor.caregiverId !== row.caregiverId)) return fail("رویداد پیدا نشد.", 404, "not_found");
  const at = nowIso();
  await env.DB.prepare("UPDATE caregiver_calendar_events SET status='COMPLETED',completed_at=?,updated_at=? WHERE id=?").bind(at, at, id).run();
  return json({ data: { id, status: "COMPLETED" } });
}

export async function deleteCalendarEvent(request: Request, env: Env, actor: AuthUser, id: string) {
  await ensureWorkCalendarSchema(env);
  const row = await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM caregiver_calendar_events WHERE id=?").bind(id).first<{ caregiverId: string }>();
  if (!row || (!hasRole(actor, STAFF) && actor.caregiverId !== row.caregiverId)) return fail("رویداد پیدا نشد.", 404, "not_found");
  await env.DB.prepare("DELETE FROM caregiver_calendar_events WHERE id=?").bind(id).run();
  return json({ data: { id, deleted: true } });
}

export async function createLeaveRequest(request: Request, env: Env, actor: AuthUser) {
  await ensureWorkCalendarSchema(env);
  const body = await readBody(request);
  const caregiverId = ownCaregiver(actor, str(body.caregiverId));
  const startsOn = str(body.startsOn), endsOn = str(body.endsOn), reason = str(body.reason);
  if (!caregiverId || !validDate(startsOn) || !validDate(endsOn) || startsOn > endsOn || !reason) return fail("اطلاعات مرخصی کامل یا معتبر نیست.", 400, "invalid_leave");
  const id = randomId("lev_"); const at = nowIso();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO caregiver_leave_requests(id,caregiver_id,contract_id,starts_on,ends_on,reason,replacement_needed,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'PENDING',?,?)`).bind(id, caregiverId, str(body.contractId) || null, startsOn, endsOn, reason, body.replacementNeeded === false ? 0 : 1, at, at),
    env.DB.prepare(`INSERT INTO support_notifications(id,caregiver_id,type,title,message,entity_type,entity_id,status,created_at) VALUES(?,?,'LEAVE_REQUEST','درخواست مرخصی مراقب',?,'caregiver_leave_request',?,'UNREAD',?)`).bind(randomId("ntf_"), caregiverId, `مرخصی از ${startsOn} تا ${endsOn}: ${reason}`, id, at),
  ]);
  await audit(request, env, actor, "leave_request_created", "caregiver_leave_request", id, { caregiverId, startsOn, endsOn });
  return json({ data: { id, status: "PENDING", supportNotified: true } }, 201);
}

export async function reviewLeaveRequest(request: Request, env: Env, actor: AuthUser, id: string) {
  if (!hasRole(actor, STAFF)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  await ensureWorkCalendarSchema(env);
  const body = await readBody(request); const status = str(body.status).toUpperCase();
  if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status)) return fail("وضعیت معتبر نیست.", 400, "invalid_status");
  const at = nowIso();
  await env.DB.prepare("UPDATE caregiver_leave_requests SET status=?,reviewer_user_id=?,reviewer_note=?,reviewed_at=?,updated_at=? WHERE id=?").bind(status, actor.id, str(body.note) || null, at, at, id).run();
  return json({ data: { id, status } });
}
