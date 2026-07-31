import {
  type AuthUser, type Env, audit, ensureSchema, fail, findCaregiverId, hasRole, json,
  nowIso, randomId, readBody, str,
} from "./lib";

const CALENDAR_STAFF_ROLES = ["ADMIN", "SUPPORT", "OPERATIONS", "HR"];
const LEAVE_DECISION_ROLES = ["ADMIN", "SUPPORT", "OPERATIONS", "HR"];
const EVENT_TYPES = new Set(["SHIFT", "MEDICATION", "CARE_TASK", "APPOINTMENT", "NOTE"]);
const SUBJECT_TYPES = new Set(["ELDERLY", "CHILD", "PATIENT", "GENERAL"]);
const RECURRENCES = new Set(["NONE", "DAILY", "WEEKLY"]);
const LEAVE_TYPES = new Set(["DAY", "HOUR"]);
const LEAVE_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

const isIsoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(value));
const isTime = (value: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(str(value));
const clampReminder = (value: unknown) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 15;
  return Math.max(0, Math.min(24 * 60, Math.trunc(minutes)));
};

export async function ensureCalendarSchema(env: Env) {
  await ensureSchema(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_support_assignments (
      caregiver_id TEXT PRIMARY KEY,
      support_user_id TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      assigned_by_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
      FOREIGN KEY(support_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_calendar_events (
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
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_leave_requests (
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
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS system_notifications (
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
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_calendar_events_caregiver_date ON caregiver_calendar_events(caregiver_id,event_date,status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence ON caregiver_calendar_events(caregiver_id,recurrence,event_date,repeat_until)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leave_caregiver_date ON caregiver_leave_requests(caregiver_id,leave_date,status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leave_support_status ON caregiver_leave_requests(support_user_id,status,leave_date)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON system_notifications(recipient_user_id,read_at,created_at DESC)"),
  ]);
}

async function resolveCalendarCaregiver(env: Env, actor: AuthUser, requested: unknown) {
  const requestedId = str(requested);
  if (actor.role.toUpperCase() === "CAREGIVER") {
    if (!actor.caregiverId) return null;
    if (requestedId) {
      const found = await findCaregiverId(env, requestedId);
      if (found && found !== actor.caregiverId) return null;
    }
    return actor.caregiverId;
  }
  if (!hasRole(actor, CALENDAR_STAFF_ROLES)) return null;
  return requestedId ? await findCaregiverId(env, requestedId) : null;
}

async function assignedSupport(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT u.id,u.full_name AS fullName
    FROM caregiver_support_assignments a JOIN users u ON u.id=a.support_user_id
    WHERE a.caregiver_id=? AND a.active=1 AND upper(u.role)='SUPPORT' AND upper(u.status) IN ('ACTIVE','APPROVED')
    LIMIT 1`).bind(caregiverId).first<{ id: string; fullName: string }>();
}

async function notificationRecipientsForLeave(env: Env, caregiverId: string) {
  const assigned = await assignedSupport(env, caregiverId);
  if (assigned) return [assigned];
  const supports = await env.DB.prepare(`SELECT id,full_name AS fullName FROM users
    WHERE upper(role)='SUPPORT' AND upper(status) IN ('ACTIVE','APPROVED') ORDER BY created_at`).all<{ id: string; fullName: string }>();
  if ((supports.results || []).length) return supports.results || [];
  const admins = await env.DB.prepare(`SELECT id,full_name AS fullName FROM users
    WHERE upper(role)='ADMIN' AND upper(status) IN ('ACTIVE','APPROVED') ORDER BY created_at`).all<{ id: string; fullName: string }>();
  return admins.results || [];
}

async function notifyUsers(
  env: Env,
  recipients: Array<{ id: string }>,
  caregiverId: string | null,
  category: string,
  title: string,
  message: string,
  route: string,
  entityType: string,
  entityId: string,
) {
  if (!recipients.length) return;
  const createdAt = nowIso();
  await env.DB.batch(recipients.map((recipient) => env.DB.prepare(`INSERT INTO system_notifications(
    id,recipient_user_id,caregiver_id,category,title,message,route,entity_type,entity_id,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
    randomId("ntf_"), recipient.id, caregiverId, category, title, message, route, entityType, entityId, createdAt,
  )));
}

export async function getCalendar(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  const url = new URL(request.url);
  const caregiverId = await resolveCalendarCaregiver(env, actor, url.searchParams.get("caregiverId"));
  if (!caregiverId) return fail("پرونده مراقب برای تقویم پیدا نشد یا دسترسی کافی ندارید.", 403, "calendar_forbidden");
  const start = str(url.searchParams.get("start"));
  const end = str(url.searchParams.get("end"));
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return fail("بازه تقویم معتبر نیست.", 400, "invalid_calendar_range");

  const [eventResult, leaveResult, caregiver, support] = await Promise.all([
    env.DB.prepare(`SELECT
      id,caregiver_id AS caregiverId,event_type AS eventType,subject_type AS subjectType,subject_name AS subjectName,
      title,event_date AS eventDate,start_time AS startTime,end_time AS endTime,reminder_minutes AS reminderMinutes,
      recurrence,repeat_until AS repeatUntil,medication_name AS medicationName,medication_dose AS medicationDose,
      notes,status,created_at AS createdAt,updated_at AS updatedAt
      FROM caregiver_calendar_events
      WHERE caregiver_id=? AND status='ACTIVE' AND (
        (event_date BETWEEN ? AND ?) OR
        (recurrence IN ('DAILY','WEEKLY') AND event_date<=? AND (repeat_until IS NULL OR repeat_until>=?))
      ) ORDER BY event_date,start_time,created_at`).bind(caregiverId, start, end, end, start).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT
      id,caregiver_id AS caregiverId,support_user_id AS supportUserId,leave_type AS leaveType,leave_date AS leaveDate,
      start_time AS startTime,end_time AS endTime,reason,status,decision_note AS decisionNote,requested_at AS requestedAt,
      updated_at AS updatedAt,decided_at AS decidedAt
      FROM caregiver_leave_requests WHERE caregiver_id=? AND leave_date BETWEEN ? AND ? AND status<>'CANCELLED'
      ORDER BY leave_date,start_time,requested_at`).bind(caregiverId, start, end).all<Record<string, unknown>>(),
    env.DB.prepare("SELECT id,membership_code AS membershipCode,full_name AS fullName,primary_type AS primaryType FROM caregivers WHERE id=?")
      .bind(caregiverId).first<Record<string, unknown>>(),
    assignedSupport(env, caregiverId),
  ]);

  return json({
    data: {
      caregiver,
      support: support || null,
      events: eventResult.results || [],
      leaves: leaveResult.results || [],
      range: { start, end },
    },
  });
}

export async function createCalendarEvent(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات رویداد معتبر نیست.");
  const caregiverId = await resolveCalendarCaregiver(env, actor, body.caregiverId);
  if (!caregiverId) return fail("دسترسی ثبت رویداد برای این مراقب وجود ندارد.", 403, "calendar_forbidden");

  const eventType = str(body.eventType).toUpperCase();
  const subjectType = str(body.subjectType || "GENERAL").toUpperCase();
  const recurrence = str(body.recurrence || "NONE").toUpperCase();
  const title = str(body.title);
  const eventDate = str(body.eventDate);
  const startTime = str(body.startTime) || null;
  const endTime = str(body.endTime) || null;
  const repeatUntil = str(body.repeatUntil) || null;
  const medicationName = str(body.medicationName) || null;
  if (!EVENT_TYPES.has(eventType)) return fail("نوع رویداد معتبر نیست.");
  if (!SUBJECT_TYPES.has(subjectType)) return fail("نوع خدمت‌گیرنده معتبر نیست.");
  if (!RECURRENCES.has(recurrence)) return fail("الگوی تکرار معتبر نیست.");
  if (!title || !isIsoDate(eventDate)) return fail("عنوان و تاریخ رویداد الزامی است.");
  if (startTime && !isTime(startTime)) return fail("ساعت شروع معتبر نیست.");
  if (endTime && !isTime(endTime)) return fail("ساعت پایان معتبر نیست.");
  if (repeatUntil && (!isIsoDate(repeatUntil) || repeatUntil < eventDate)) return fail("پایان تکرار معتبر نیست.");
  if (eventType === "SHIFT" && (!startTime || !endTime)) return fail("برای شیفت، ساعت شروع و پایان الزامی است.");
  if (eventType === "MEDICATION" && (!startTime || !medicationName)) return fail("نام دارو و ساعت دریافت دارو الزامی است.");

  const id = randomId("cal_");
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO caregiver_calendar_events(
    id,caregiver_id,event_type,subject_type,subject_name,title,event_date,start_time,end_time,reminder_minutes,
    recurrence,repeat_until,medication_name,medication_dose,notes,status,created_by_user_id,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?)`).bind(
    id, caregiverId, eventType, subjectType, str(body.subjectName) || null, title, eventDate, startTime, endTime,
    clampReminder(body.reminderMinutes), recurrence, repeatUntil, medicationName, str(body.medicationDose) || null,
    str(body.notes) || null, actor.id, timestamp, timestamp,
  ).run();
  await audit(request, env, actor, "CREATE_CALENDAR_EVENT", "calendar_event", id, { caregiverId, eventType, eventDate });
  return json({ data: { id, caregiverId, eventType, eventDate, createdAt: timestamp } }, 201);
}

export async function updateCalendarEvent(request: Request, env: Env, actor: AuthUser, eventId: string) {
  await ensureCalendarSchema(env);
  const existing = await env.DB.prepare("SELECT caregiver_id AS caregiverId,status FROM caregiver_calendar_events WHERE id=? LIMIT 1")
    .bind(eventId).first<{ caregiverId: string; status: string }>();
  if (!existing || existing.status !== "ACTIVE") return fail("رویداد پیدا نشد.", 404, "calendar_event_not_found");
  const allowedCaregiver = await resolveCalendarCaregiver(env, actor, existing.caregiverId);
  if (!allowedCaregiver || allowedCaregiver !== existing.caregiverId) return fail("دسترسی کافی ندارید.", 403, "calendar_forbidden");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات رویداد معتبر نیست.");

  const fields: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => { fields.push(`${column}=?`); values.push(value); };
  if (body.eventType !== undefined) {
    const value = str(body.eventType).toUpperCase();
    if (!EVENT_TYPES.has(value)) return fail("نوع رویداد معتبر نیست.");
    add("event_type", value);
  }
  if (body.subjectType !== undefined) {
    const value = str(body.subjectType).toUpperCase();
    if (!SUBJECT_TYPES.has(value)) return fail("نوع خدمت‌گیرنده معتبر نیست.");
    add("subject_type", value);
  }
  if (body.subjectName !== undefined) add("subject_name", str(body.subjectName) || null);
  if (body.title !== undefined) {
    const value = str(body.title);
    if (!value) return fail("عنوان رویداد الزامی است.");
    add("title", value);
  }
  if (body.eventDate !== undefined) {
    const value = str(body.eventDate);
    if (!isIsoDate(value)) return fail("تاریخ رویداد معتبر نیست.");
    add("event_date", value);
  }
  if (body.startTime !== undefined) {
    const value = str(body.startTime) || null;
    if (value && !isTime(value)) return fail("ساعت شروع معتبر نیست.");
    add("start_time", value);
  }
  if (body.endTime !== undefined) {
    const value = str(body.endTime) || null;
    if (value && !isTime(value)) return fail("ساعت پایان معتبر نیست.");
    add("end_time", value);
  }
  if (body.reminderMinutes !== undefined) add("reminder_minutes", clampReminder(body.reminderMinutes));
  if (body.recurrence !== undefined) {
    const value = str(body.recurrence).toUpperCase();
    if (!RECURRENCES.has(value)) return fail("الگوی تکرار معتبر نیست.");
    add("recurrence", value);
  }
  if (body.repeatUntil !== undefined) {
    const value = str(body.repeatUntil) || null;
    if (value && !isIsoDate(value)) return fail("پایان تکرار معتبر نیست.");
    add("repeat_until", value);
  }
  if (body.medicationName !== undefined) add("medication_name", str(body.medicationName) || null);
  if (body.medicationDose !== undefined) add("medication_dose", str(body.medicationDose) || null);
  if (body.notes !== undefined) add("notes", str(body.notes) || null);
  if (!fields.length) return fail("تغییری برای ذخیره ارسال نشده است.");
  add("updated_at", nowIso());
  values.push(eventId);
  await env.DB.prepare(`UPDATE caregiver_calendar_events SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
  await audit(request, env, actor, "UPDATE_CALENDAR_EVENT", "calendar_event", eventId, body);
  return json({ ok: true, updatedAt: nowIso() });
}

export async function deleteCalendarEvent(request: Request, env: Env, actor: AuthUser, eventId: string) {
  await ensureCalendarSchema(env);
  const existing = await env.DB.prepare("SELECT caregiver_id AS caregiverId,status FROM caregiver_calendar_events WHERE id=? LIMIT 1")
    .bind(eventId).first<{ caregiverId: string; status: string }>();
  if (!existing || existing.status !== "ACTIVE") return fail("رویداد پیدا نشد.", 404, "calendar_event_not_found");
  const allowedCaregiver = await resolveCalendarCaregiver(env, actor, existing.caregiverId);
  if (!allowedCaregiver || allowedCaregiver !== existing.caregiverId) return fail("دسترسی کافی ندارید.", 403, "calendar_forbidden");
  await env.DB.prepare("UPDATE caregiver_calendar_events SET status='CANCELLED',updated_at=? WHERE id=?")
    .bind(nowIso(), eventId).run();
  await audit(request, env, actor, "DELETE_CALENDAR_EVENT", "calendar_event", eventId);
  return json({ ok: true });
}

export async function createLeaveRequest(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات مرخصی معتبر نیست.");
  const caregiverId = await resolveCalendarCaregiver(env, actor, body.caregiverId);
  if (!caregiverId) return fail("دسترسی ثبت مرخصی برای این مراقب وجود ندارد.", 403, "calendar_forbidden");
  const leaveType = str(body.leaveType).toUpperCase();
  const leaveDate = str(body.leaveDate);
  const startTime = str(body.startTime) || null;
  const endTime = str(body.endTime) || null;
  const reason = str(body.reason);
  if (!LEAVE_TYPES.has(leaveType) || !isIsoDate(leaveDate) || !reason) return fail("نوع، تاریخ و دلیل مرخصی الزامی است.");
  if (leaveType === "HOUR" && (!startTime || !endTime || !isTime(startTime) || !isTime(endTime))) {
    return fail("برای مرخصی ساعتی، ساعت شروع و پایان معتبر لازم است.");
  }

  const recipients = await notificationRecipientsForLeave(env, caregiverId);
  const supportUserId = recipients[0]?.id || null;
  const caregiver = await env.DB.prepare("SELECT full_name AS fullName,membership_code AS membershipCode FROM caregivers WHERE id=?")
    .bind(caregiverId).first<{ fullName: string; membershipCode: string | null }>();
  const id = randomId("lev_");
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO caregiver_leave_requests(
    id,caregiver_id,support_user_id,leave_type,leave_date,start_time,end_time,reason,status,requested_by_user_id,requested_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?, 'PENDING',?,?,?)`).bind(
    id, caregiverId, supportUserId, leaveType, leaveDate, leaveType === "HOUR" ? startTime : null,
    leaveType === "HOUR" ? endTime : null, reason, actor.id, timestamp, timestamp,
  ).run();

  const leaveLabel = leaveType === "DAY" ? "روزانه" : `ساعتی ${startTime} تا ${endTime}`;
  await notifyUsers(
    env, recipients, caregiverId, "LEAVE_REQUEST", "درخواست مرخصی جدید",
    `${caregiver?.fullName || caregiverId} (${caregiver?.membershipCode || caregiverId}) برای ${leaveDate} مرخصی ${leaveLabel} ثبت کرده است. دلیل: ${reason}`,
    "پشتیبانی و امنیت", "leave_request", id,
  );
  await audit(request, env, actor, "CREATE_LEAVE_REQUEST", "leave_request", id, { caregiverId, leaveType, leaveDate, supportUserId });
  return json({
    data: {
      id,
      caregiverId,
      leaveType,
      leaveDate,
      status: "PENDING",
      supportNotified: recipients.length > 0,
      supportName: recipients.length === 1 ? recipients[0].fullName : recipients.length > 1 ? "واحد پشتیبانی" : null,
      requestedAt: timestamp,
    },
  }, 201);
}

export async function listLeaveRequests(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  const url = new URL(request.url);
  const requestedCaregiver = str(url.searchParams.get("caregiverId"));
  const status = str(url.searchParams.get("status")).toUpperCase();
  const where: string[] = [];
  const values: unknown[] = [];
  if (actor.role.toUpperCase() === "CAREGIVER") {
    if (!actor.caregiverId) return fail("پرونده مراقب پیدا نشد.", 404);
    where.push("l.caregiver_id=?");
    values.push(actor.caregiverId);
  } else if (hasRole(actor, LEAVE_DECISION_ROLES)) {
    if (requestedCaregiver) {
      const caregiverId = await findCaregiverId(env, requestedCaregiver);
      if (!caregiverId) return fail("پرونده مراقب پیدا نشد.", 404);
      where.push("l.caregiver_id=?");
      values.push(caregiverId);
    } else if (actor.role.toUpperCase() === "SUPPORT") {
      where.push("(l.support_user_id=? OR l.support_user_id IS NULL)");
      values.push(actor.id);
    }
  } else {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }
  if (status && LEAVE_STATUSES.has(status)) {
    where.push("l.status=?");
    values.push(status);
  }
  const result = await env.DB.prepare(`SELECT
    l.id,l.caregiver_id AS caregiverId,c.membership_code AS membershipCode,c.full_name AS caregiverName,
    l.support_user_id AS supportUserId,l.leave_type AS leaveType,l.leave_date AS leaveDate,l.start_time AS startTime,
    l.end_time AS endTime,l.reason,l.status,l.decision_note AS decisionNote,l.requested_at AS requestedAt,
    l.updated_at AS updatedAt,l.decided_at AS decidedAt
    FROM caregiver_leave_requests l JOIN caregivers c ON c.id=l.caregiver_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE WHEN l.status='PENDING' THEN 0 ELSE 1 END,l.leave_date,l.requested_at DESC LIMIT 200`)
    .bind(...values).all<Record<string, unknown>>();
  return json({ data: result.results || [] });
}

export async function decideLeaveRequest(request: Request, env: Env, actor: AuthUser, leaveId: string) {
  await ensureCalendarSchema(env);
  if (!hasRole(actor, LEAVE_DECISION_ROLES)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  const status = str(body?.status).toUpperCase();
  if (!body || !["APPROVED", "REJECTED"].includes(status)) return fail("تصمیم مرخصی معتبر نیست.");
  const leave = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,leave_date AS leaveDate,leave_type AS leaveType,status
    FROM caregiver_leave_requests WHERE id=? LIMIT 1`).bind(leaveId)
    .first<{ id: string; caregiverId: string; leaveDate: string; leaveType: string; status: string }>();
  if (!leave) return fail("درخواست مرخصی پیدا نشد.", 404, "leave_not_found");
  if (leave.status !== "PENDING") return fail("این درخواست قبلاً تعیین تکلیف شده است.", 409, "leave_already_decided");
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_leave_requests SET status=?,decision_note=?,decided_by_user_id=?,decided_at=?,updated_at=? WHERE id=?`)
    .bind(status, str(body.decisionNote) || null, actor.id, timestamp, timestamp, leaveId).run();
  const caregiverUsers = await env.DB.prepare(`SELECT id FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status) IN ('ACTIVE','APPROVED')`)
    .bind(leave.caregiverId).all<{ id: string }>();
  await notifyUsers(
    env, caregiverUsers.results || [], leave.caregiverId, "LEAVE_DECISION",
    status === "APPROVED" ? "مرخصی شما تأیید شد" : "درخواست مرخصی شما رد شد",
    `درخواست مرخصی ${leave.leaveDate} ${status === "APPROVED" ? "تأیید" : "رد"} شد.${str(body.decisionNote) ? ` توضیح: ${str(body.decisionNote)}` : ""}`,
    "تقویم کاری", "leave_request", leaveId,
  );
  await audit(request, env, actor, "DECIDE_LEAVE_REQUEST", "leave_request", leaveId, { status, decisionNote: body.decisionNote });
  return json({ ok: true, status, decidedAt: timestamp });
}

export async function cancelLeaveRequest(request: Request, env: Env, actor: AuthUser, leaveId: string) {
  await ensureCalendarSchema(env);
  const leave = await env.DB.prepare("SELECT caregiver_id AS caregiverId,status FROM caregiver_leave_requests WHERE id=? LIMIT 1")
    .bind(leaveId).first<{ caregiverId: string; status: string }>();
  if (!leave) return fail("درخواست مرخصی پیدا نشد.", 404, "leave_not_found");
  const caregiverId = await resolveCalendarCaregiver(env, actor, leave.caregiverId);
  if (!caregiverId || caregiverId !== leave.caregiverId) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  if (leave.status !== "PENDING") return fail("فقط درخواست در انتظار بررسی قابل لغو است.", 409, "leave_not_pending");
  await env.DB.prepare("UPDATE caregiver_leave_requests SET status='CANCELLED',updated_at=? WHERE id=?").bind(nowIso(), leaveId).run();
  await audit(request, env, actor, "CANCEL_LEAVE_REQUEST", "leave_request", leaveId);
  return json({ ok: true });
}

export async function setSupportAssignment(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  if (!hasRole(actor, ["ADMIN"])) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات تخصیص معتبر نیست.");
  const caregiverId = await findCaregiverId(env, body.caregiverId);
  const supportUserId = str(body.supportUserId);
  if (!caregiverId || !supportUserId) return fail("مراقب و کارشناس پشتیبانی الزامی هستند.");
  const support = await env.DB.prepare("SELECT id FROM users WHERE id=? AND upper(role)='SUPPORT' AND upper(status) IN ('ACTIVE','APPROVED') LIMIT 1")
    .bind(supportUserId).first();
  if (!support) return fail("کارشناس پشتیبانی فعال پیدا نشد.", 404, "support_not_found");
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO caregiver_support_assignments(caregiver_id,support_user_id,active,assigned_by_user_id,created_at,updated_at)
    VALUES(?,?,1,?,?,?) ON CONFLICT(caregiver_id) DO UPDATE SET support_user_id=excluded.support_user_id,active=1,assigned_by_user_id=excluded.assigned_by_user_id,updated_at=excluded.updated_at`)
    .bind(caregiverId, supportUserId, actor.id, timestamp, timestamp).run();
  await audit(request, env, actor, "ASSIGN_SUPPORT", "caregiver", caregiverId, { supportUserId });
  return json({ ok: true, caregiverId, supportUserId });
}

export async function getNotifications(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 30)));
  const result = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,category,title,message,route,entity_type AS entityType,
    entity_id AS entityId,read_at AS readAt,created_at AS createdAt
    FROM system_notifications WHERE recipient_user_id=? ORDER BY created_at DESC LIMIT ?`)
    .bind(actor.id, limit).all<Record<string, unknown>>();
  const unread = await env.DB.prepare("SELECT COUNT(*) AS count FROM system_notifications WHERE recipient_user_id=? AND read_at IS NULL")
    .bind(actor.id).first<{ count: number }>();
  return json({ data: result.results || [], unread: Number(unread?.count || 0) });
}

export async function readNotification(request: Request, env: Env, actor: AuthUser, notificationId: string) {
  await ensureCalendarSchema(env);
  const result = await env.DB.prepare("UPDATE system_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_user_id=?")
    .bind(nowIso(), notificationId, actor.id).run();
  if (!result.meta.changes) return fail("اعلان پیدا نشد.", 404, "notification_not_found");
  return json({ ok: true });
}

export async function readAllNotifications(request: Request, env: Env, actor: AuthUser) {
  await ensureCalendarSchema(env);
  await env.DB.prepare("UPDATE system_notifications SET read_at=COALESCE(read_at,?) WHERE recipient_user_id=?")
    .bind(nowIso(), actor.id).run();
  await audit(request, env, actor, "READ_ALL_NOTIFICATIONS", "notification", null);
  return json({ ok: true });
}
