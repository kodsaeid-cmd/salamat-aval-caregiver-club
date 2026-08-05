import { canAccess, requireAccess } from "./access-control";
import { ensureCalendarSchema } from "./calendar";
import { ensureCaregiverPlatformSchema } from "./caregiver-platform-v1";
import {
  type AuthUser,
  type Env,
  audit,
  fail,
  findCaregiverId,
  getUser,
  json,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const VERSION = "3.0.0";
const THREADS_PATH = "/api/caregiver/platform/support/threads";
const CATEGORIES = new Set(["CASE", "URGENT_SECURITY"]);
const STATUSES = new Set(["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
const ACTIVE_USER_STATUSES = ["ACTIVE", "APPROVED"];

type SupportThread = {
  id: string;
  caregiverId: string;
  contractId: string | null;
  category: string;
  subject: string;
  dangerConfirmed: number;
  priority: string;
  status: string;
  assignedUserId: string | null;
  assignedUserName?: string | null;
  caregiverName?: string;
  membershipCode?: string | null;
  contractNumber?: string | null;
  familyName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
};

type SupportMessageRow = {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string | null;
  senderRole: string | null;
  messageType: string;
  textContent: string | null;
  storedFileId: string | null;
  contentType: string | null;
  originalName: string | null;
  createdAt: string;
};

function isCaregiver(actor: AuthUser) {
  return actor.role.toUpperCase() === "CAREGIVER";
}

function isSystemAdmin(actor: AuthUser) {
  return actor.role.toUpperCase() === "ADMIN";
}

function roleLabel(role: string | null) {
  return ({
    ADMIN: "مدیر سامانه",
    SUPPORT: "پشتیبان",
    OPERATIONS: "مدیر عملیات",
    HR: "منابع انسانی",
    RECRUITER: "کارشناس جذب",
    EVALUATOR: "ارزیاب",
    EDUCATION: "کارشناس آموزش",
    CAREGIVER: "مراقب",
  } as Record<string, string>)[String(role || "").toUpperCase()] || "کاربر سامانه";
}

async function ensureSupportUnitySchema(env: Env) {
  await Promise.all([ensureCaregiverPlatformSchema(env), ensureCalendarSchema(env)]);
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_threads_category_queue ON support_threads(category,status,last_message_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_messages_thread_sender ON support_messages(thread_id,sender_user_id,created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_notifications_thread ON system_notifications(recipient_user_id,entity_type,entity_id,read_at,created_at DESC)"),
  ]);
}

async function requireSupportAccess(env: Env, actor: AuthUser, action: "view" | "create" | "update") {
  return isCaregiver(actor)
    ? requireAccess(env, actor, "caregiver.support", action)
    : requireAccess(env, actor, "staff.support", action);
}

async function resolveCaregiver(env: Env, actor: AuthUser, requested?: unknown) {
  if (isCaregiver(actor)) return actor.caregiverId || null;
  return requested === undefined ? null : findCaregiverId(env, requested);
}

async function threadForActor(env: Env, actor: AuthUser, threadId: string) {
  const thread = await env.DB.prepare(`SELECT
      t.id,t.caregiver_id AS caregiverId,t.contract_id AS contractId,t.category,t.subject,
      t.danger_confirmed AS dangerConfirmed,t.priority,t.status,t.assigned_user_id AS assignedUserId,
      au.full_name AS assignedUserName,c.full_name AS caregiverName,c.membership_code AS membershipCode,
      ct.contract_number AS contractNumber,ct.family_name AS familyName,
      t.created_at AS createdAt,t.updated_at AS updatedAt,t.last_message_at AS lastMessageAt
    FROM support_threads t
    JOIN caregivers c ON c.id=t.caregiver_id
    LEFT JOIN users au ON au.id=t.assigned_user_id
    LEFT JOIN contracts ct ON ct.id=t.contract_id
    WHERE t.id=? LIMIT 1`).bind(threadId).first<SupportThread>();
  if (!thread) return null;
  if (isCaregiver(actor) && thread.caregiverId !== actor.caregiverId) return null;
  return thread;
}

async function activeSupportRecipients(env: Env, senderId: string) {
  const result = await env.DB.prepare(`SELECT
      id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,
      permissions_json AS permissionsJson
    FROM users
    WHERE upper(status) IN ('ACTIVE','APPROVED') AND upper(role)<>'CAREGIVER' AND id<>?
    ORDER BY created_at`).bind(senderId).all<AuthUser>();
  const recipients: AuthUser[] = [];
  for (const user of result.results || []) {
    if (await canAccess(env, user, "staff.support", "view")) recipients.push(user);
  }
  return recipients;
}

async function activeCaregiverRecipients(env: Env, caregiverId: string, senderId: string) {
  const result = await env.DB.prepare(`SELECT
      id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,
      permissions_json AS permissionsJson
    FROM users
    WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status) IN ('ACTIVE','APPROVED') AND id<>?
    ORDER BY created_at`).bind(caregiverId, senderId).all<AuthUser>();
  return result.results || [];
}

async function createSupportNotifications(
  env: Env,
  actor: AuthUser,
  thread: SupportThread,
  messageType: "TEXT" | "VOICE" | "THREAD",
) {
  const recipients = isCaregiver(actor)
    ? await activeSupportRecipients(env, actor.id)
    : await activeCaregiverRecipients(env, thread.caregiverId, actor.id);
  if (!recipients.length) return 0;

  const createdAt = nowIso();
  const urgent = thread.category === "URGENT_SECURITY";
  const title = isCaregiver(actor)
    ? urgent
      ? `پیام فوری از ${thread.caregiverName || actor.fullName}`
      : `پیام پشتیبانی از ${thread.caregiverName || actor.fullName}`
    : urgent
      ? "پاسخ جدید پشتیبانی فوری"
      : "پاسخ جدید پشتیبانی پرونده";
  const contentLabel = messageType === "VOICE" ? "پیام صوتی" : messageType === "THREAD" ? "گفت‌وگوی جدید" : "پیام جدید";
  const message = isCaregiver(actor)
    ? `${contentLabel} در ${urgent ? "پشتیبانی فوری و امنیتی" : "پشتیبانی پرونده"} ثبت شده است.`
    : "شما یک پیام خوانده‌نشده از پشتیبانی دارید.";

  await env.DB.batch(recipients.map((recipient) => env.DB.prepare(`INSERT INTO system_notifications(
      id,recipient_user_id,caregiver_id,category,title,message,route,entity_type,entity_id,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
      randomId("ntf_"),
      recipient.id,
      thread.caregiverId,
      "SUPPORT_MESSAGE",
      title,
      message,
      `support:${thread.id}`,
      "support_thread",
      thread.id,
      createdAt,
    )));
  return recipients.length;
}

async function markThreadRead(env: Env, actor: AuthUser, threadId: string) {
  await env.DB.prepare(`UPDATE system_notifications
    SET read_at=COALESCE(read_at,?)
    WHERE recipient_user_id=? AND entity_type='support_thread' AND entity_id=?`)
    .bind(nowIso(), actor.id, threadId).run();
}

function serializeMessage(row: SupportMessageRow, actor: AuthUser) {
  const mine = row.senderUserId === actor.id;
  const senderRole = String(row.senderRole || "").toUpperCase();
  const senderIsCaregiver = senderRole === "CAREGIVER";
  const revealStaffIdentity = isSystemAdmin(actor);
  let senderDisplayName = "پشتیبانی سلامت اول";
  if (mine) senderDisplayName = "شما";
  else if (senderIsCaregiver) senderDisplayName = row.senderName || "مراقب";
  else if (revealStaffIdentity) senderDisplayName = row.senderName || "کارشناس پشتیبانی";

  return {
    id: row.id,
    threadId: row.threadId,
    messageType: row.messageType,
    textContent: row.textContent,
    storedFileId: row.storedFileId,
    contentType: row.contentType,
    originalName: row.originalName,
    createdAt: row.createdAt,
    isMine: mine,
    senderKind: senderIsCaregiver ? "CAREGIVER" : "SUPPORT",
    senderDisplayName,
    senderName: senderDisplayName,
    senderUserId: revealStaffIdentity || mine ? row.senderUserId : null,
    senderRole: revealStaffIdentity ? senderRole : senderIsCaregiver ? "CAREGIVER" : "SUPPORT",
    senderRoleLabel: revealStaffIdentity ? roleLabel(senderRole) : senderIsCaregiver ? "مراقب" : "پشتیبانی سلامت اول",
    responderIdentityVisible: revealStaffIdentity && !senderIsCaregiver,
  };
}

async function listThreads(request: Request, env: Env, actor: AuthUser) {
  const denied = await requireSupportAccess(env, actor, "view");
  if (denied) return denied;
  const url = new URL(request.url);
  const category = str(url.searchParams.get("category")).toUpperCase();
  const where: string[] = [];
  const values: unknown[] = [actor.id];
  if (isCaregiver(actor)) {
    if (!actor.caregiverId) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_profile_missing");
    where.push("t.caregiver_id=?");
    values.push(actor.caregiverId);
  }
  if (category && CATEGORIES.has(category)) {
    where.push("t.category=?");
    values.push(category);
  }

  const result = await env.DB.prepare(`SELECT
      t.id,t.caregiver_id AS caregiverId,t.contract_id AS contractId,t.category,t.subject,
      t.danger_confirmed AS dangerConfirmed,t.priority,t.status,t.assigned_user_id AS assignedUserId,
      ${isSystemAdmin(actor) ? "au.full_name" : "NULL"} AS assignedUserName,
      c.full_name AS caregiverName,c.membership_code AS membershipCode,
      ct.contract_number AS contractNumber,ct.family_name AS familyName,
      t.created_at AS createdAt,t.updated_at AS updatedAt,t.last_message_at AS lastMessageAt,
      (SELECT COUNT(*) FROM system_notifications n
        WHERE n.recipient_user_id=? AND n.entity_type='support_thread' AND n.entity_id=t.id AND n.read_at IS NULL) AS unreadCount,
      (SELECT CASE WHEN m.message_type='VOICE' THEN 'پیام صوتی' ELSE substr(COALESCE(m.text_content,''),1,120) END
        FROM support_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS lastMessagePreview
    FROM support_threads t
    JOIN caregivers c ON c.id=t.caregiver_id
    LEFT JOIN users au ON au.id=t.assigned_user_id
    LEFT JOIN contracts ct ON ct.id=t.contract_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE WHEN t.category='URGENT_SECURITY' AND t.status IN ('OPEN','PENDING') THEN 0 ELSE 1 END,
      unreadCount DESC,COALESCE(t.last_message_at,t.updated_at) DESC
    LIMIT 500`).bind(...values).all<Record<string, unknown>>();

  return json({
    data: {
      threads: result.results || [],
      categories: [
        { key: "CASE", label: "پشتیبانی پرونده" },
        { key: "URGENT_SECURITY", label: "پشتیبانی فوری و امنیتی" },
      ],
      canViewResponderIdentity: isSystemAdmin(actor),
      source: "support-conversation-unity-v3",
    },
    version: VERSION,
  });
}

async function createThread(request: Request, env: Env, actor: AuthUser) {
  const denied = await requireSupportAccess(env, actor, "create");
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return fail("اطلاعات گفت‌وگو معتبر نیست.");
  const category = str(body.category || "CASE").toUpperCase();
  if (!CATEGORIES.has(category)) return fail("نوع پشتیبانی معتبر نیست.");
  if (category === "URGENT_SECURITY" && !Boolean(body.dangerConfirmed)) {
    return fail("برای مسیر فوری و امنیتی باید وجود خطر تأیید شود.", 400, "danger_confirmation_required");
  }
  const caregiverId = await resolveCaregiver(env, actor, body.caregiverId);
  if (!caregiverId) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_profile_missing");
  const caregiver = await env.DB.prepare("SELECT id,full_name AS caregiverName,membership_code AS membershipCode FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId).first<{ id: string; caregiverName: string; membershipCode: string | null }>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_profile_missing");

  const contractId = str(body.contractId) || null;
  if (contractId) {
    const contract = await env.DB.prepare("SELECT id FROM contracts WHERE id=? AND caregiver_id=? LIMIT 1")
      .bind(contractId, caregiverId).first();
    if (!contract) return fail("قرارداد انتخاب‌شده متعلق به این مراقب نیست.", 409, "contract_mismatch");
  }
  const subject = str(body.subject) || (category === "URGENT_SECURITY" ? "درخواست فوری و امنیتی" : "پشتیبانی پرونده");
  const openingText = str(body.message);
  const threadId = randomId("sup_");
  const createdAt = nowIso();
  const statements = [env.DB.prepare(`INSERT INTO support_threads(
      id,caregiver_id,contract_id,category,subject,danger_confirmed,priority,status,assigned_user_id,
      created_by_user_id,last_message_at,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,'OPEN',NULL,?,?,?,?)`).bind(
      threadId,
      caregiverId,
      contractId,
      category,
      subject,
      category === "URGENT_SECURITY" ? 1 : 0,
      category === "URGENT_SECURITY" ? "CRITICAL" : "NORMAL",
      actor.id,
      createdAt,
      createdAt,
      createdAt,
    )];
  if (openingText) {
    statements.push(env.DB.prepare(`INSERT INTO support_messages(
      id,thread_id,sender_user_id,message_type,text_content,stored_file_id,created_at
    ) VALUES(?,?,?,'TEXT',?,NULL,?)`).bind(randomId("msg_"), threadId, actor.id, openingText, createdAt));
  }
  await env.DB.batch(statements);
  const thread: SupportThread = {
    id: threadId,
    caregiverId,
    contractId,
    category,
    subject,
    dangerConfirmed: category === "URGENT_SECURITY" ? 1 : 0,
    priority: category === "URGENT_SECURITY" ? "CRITICAL" : "NORMAL",
    status: "OPEN",
    assignedUserId: null,
    caregiverName: caregiver.caregiverName,
    membershipCode: caregiver.membershipCode,
    createdAt,
    updatedAt: createdAt,
    lastMessageAt: createdAt,
  };
  const notified = await createSupportNotifications(env, actor, thread, openingText ? "TEXT" : "THREAD");
  await audit(request, env, actor, "CREATE_SUPPORT_THREAD", "support_thread", threadId, {
    caregiverId,
    category,
    contractId,
    notified,
    source: "support-conversation-unity-v3",
  });
  return json({ data: { ...thread, unreadCount: 0, notified }, version: VERSION }, 201);
}

async function listMessages(request: Request, env: Env, actor: AuthUser, threadId: string) {
  const denied = await requireSupportAccess(env, actor, "view");
  if (denied) return denied;
  const thread = await threadForActor(env, actor, threadId);
  if (!thread) return fail("گفت‌وگو پیدا نشد یا دسترسی ندارید.", 404, "support_thread_not_found");

  const result = await env.DB.prepare(`SELECT
      m.id,m.thread_id AS threadId,m.sender_user_id AS senderUserId,
      u.full_name AS senderName,u.role AS senderRole,m.message_type AS messageType,
      m.text_content AS textContent,m.stored_file_id AS storedFileId,
      f.content_type AS contentType,f.original_name AS originalName,m.created_at AS createdAt
    FROM support_messages m
    JOIN users u ON u.id=m.sender_user_id
    LEFT JOIN stored_files f ON f.id=m.stored_file_id
    WHERE m.thread_id=? ORDER BY m.created_at,m.id`).bind(threadId).all<SupportMessageRow>();
  await markThreadRead(env, actor, threadId);

  return json({
    data: {
      thread: {
        ...thread,
        assignedUserName: isSystemAdmin(actor) ? thread.assignedUserName || null : null,
      },
      messages: (result.results || []).map((row) => serializeMessage(row, actor)),
      canViewResponderIdentity: isSystemAdmin(actor),
      readAt: nowIso(),
      source: "support-conversation-unity-v3",
    },
    version: VERSION,
  });
}

async function createMessage(request: Request, env: Env, actor: AuthUser, threadId: string) {
  const denied = await requireSupportAccess(env, actor, "update");
  if (denied) return denied;
  const thread = await threadForActor(env, actor, threadId);
  if (!thread) return fail("گفت‌وگو پیدا نشد یا دسترسی ندارید.", 404, "support_thread_not_found");
  if (thread.status === "CLOSED") return fail("گفت‌وگوی بسته قابل پاسخ نیست.", 409, "support_thread_closed");
  const body = await readBody(request);
  if (!body) return fail("پیام معتبر نیست.");
  const textContent = str(body.text || body.textContent);
  const storedFileId = str(body.storedFileId) || null;
  if ((!textContent && !storedFileId) || (textContent && storedFileId)) {
    return fail("پیام باید فقط متنی یا فقط صوتی باشد.", 400, "invalid_support_message");
  }

  let messageType: "TEXT" | "VOICE" = "TEXT";
  if (storedFileId) {
    const file = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,category,content_type AS contentType,
      uploaded_by_user_id AS uploadedByUserId,deleted_at AS deletedAt
      FROM stored_files WHERE id=? LIMIT 1`).bind(storedFileId).first<{
        id: string;
        caregiverId: string | null;
        category: string;
        contentType: string;
        uploadedByUserId: string;
        deletedAt: string | null;
      }>();
    if (!file || file.deletedAt) return fail("فایل صوتی پیدا نشد.", 404, "support_voice_not_found");
    if (file.category.toLowerCase() !== "support" || !file.contentType.toLowerCase().startsWith("audio/")) {
      return fail("فایل انتخاب‌شده صوت پشتیبانی نیست.", 409, "invalid_support_voice");
    }
    if (file.caregiverId !== thread.caregiverId || file.uploadedByUserId !== actor.id) {
      return fail("فایل صوتی با این گفت‌وگو یا فرستنده تطابق ندارد.", 403, "support_voice_forbidden");
    }
    messageType = "VOICE";
  }

  const messageId = randomId("msg_");
  const createdAt = nowIso();
  const nextStatus = isCaregiver(actor) ? "OPEN" : "PENDING";
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO support_messages(
      id,thread_id,sender_user_id,message_type,text_content,stored_file_id,created_at
    ) VALUES(?,?,?,?,?,?,?)`).bind(
      messageId,
      threadId,
      actor.id,
      messageType,
      textContent || null,
      storedFileId,
      createdAt,
    ),
    env.DB.prepare("UPDATE support_threads SET status=?,last_message_at=?,updated_at=? WHERE id=?")
      .bind(nextStatus, createdAt, createdAt, threadId),
  ]);
  const updatedThread = { ...thread, status: nextStatus, lastMessageAt: createdAt, updatedAt: createdAt };
  const notified = await createSupportNotifications(env, actor, updatedThread, messageType);
  await markThreadRead(env, actor, threadId);
  await audit(request, env, actor, "CREATE_SUPPORT_MESSAGE", "support_message", messageId, {
    threadId,
    caregiverId: thread.caregiverId,
    messageType,
    notified,
    source: "support-conversation-unity-v3",
  });
  return json({
    data: {
      id: messageId,
      threadId,
      messageType,
      textContent: textContent || null,
      storedFileId,
      createdAt,
      isMine: true,
      senderDisplayName: "شما",
      senderName: "شما",
      senderUserId: actor.id,
      senderRole: actor.role,
      senderRoleLabel: roleLabel(actor.role),
      notified,
    },
    version: VERSION,
  }, 201);
}

async function updateThread(request: Request, env: Env, actor: AuthUser, threadId: string) {
  if (isCaregiver(actor)) return fail("تغییر وضعیت گفت‌وگو فقط برای افراد مجاز پشتیبانی است.", 403, "forbidden");
  const denied = await requireSupportAccess(env, actor, "update");
  if (denied) return denied;
  const thread = await threadForActor(env, actor, threadId);
  if (!thread) return fail("گفت‌وگو پیدا نشد.", 404, "support_thread_not_found");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات وضعیت معتبر نیست.");
  const status = str(body.status || thread.status).toUpperCase();
  if (!STATUSES.has(status)) return fail("وضعیت گفت‌وگو معتبر نیست.");
  const assignedUserId = body.assignedUserId === undefined ? thread.assignedUserId : str(body.assignedUserId) || null;
  if (assignedUserId) {
    const assignee = await env.DB.prepare("SELECT id FROM users WHERE id=? AND upper(status) IN ('ACTIVE','APPROVED') LIMIT 1")
      .bind(assignedUserId).first();
    if (!assignee) return fail("کاربر تخصیص‌یافته فعال نیست.", 404, "assignee_not_found");
  }
  const updatedAt = nowIso();
  await env.DB.prepare("UPDATE support_threads SET status=?,assigned_user_id=?,updated_at=? WHERE id=?")
    .bind(status, assignedUserId, updatedAt, threadId).run();
  await audit(request, env, actor, "UPDATE_SUPPORT_THREAD", "support_thread", threadId, {
    status,
    assignedUserId,
    source: "support-conversation-unity-v3",
  });
  return json({ data: { id: threadId, status, assignedUserId, updatedAt }, version: VERSION });
}

export async function routeSupportConversationUnityV3(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  if (path !== THREADS_PATH && !path.startsWith(`${THREADS_PATH}/`)) return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  await ensureSupportUnitySchema(env);

  let response: Response;
  if (path === THREADS_PATH && method === "GET") response = await listThreads(request, env, actor);
  else if (path === THREADS_PATH && method === "POST") response = await createThread(request, env, actor);
  else {
    const messageMatch = path.match(/^\/api\/caregiver\/platform\/support\/threads\/([^/]+)\/messages$/);
    const threadMatch = path.match(/^\/api\/caregiver\/platform\/support\/threads\/([^/]+)$/);
    if (messageMatch && method === "GET") response = await listMessages(request, env, actor, decodeURIComponent(messageMatch[1]));
    else if (messageMatch && method === "POST") response = await createMessage(request, env, actor, decodeURIComponent(messageMatch[1]));
    else if (threadMatch && method === "PATCH") response = await updateThread(request, env, actor, decodeURIComponent(threadMatch[1]));
    else response = fail("مسیر پشتیبانی پیدا نشد.", 404, "support_route_not_found");
  }
  const headers = new Headers(response.headers);
  headers.set("x-salamat-support-unity", VERSION);
  headers.set("cache-control", "private, no-store, max-age=0");
  return securityHeaders(new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }));
}
