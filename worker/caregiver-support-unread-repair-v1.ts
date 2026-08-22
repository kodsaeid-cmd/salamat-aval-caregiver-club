import { canAccess, requireAccess } from "./access-control";
import {
  type AuthUser,
  type Env,
  fail,
  getUser,
  json,
  nowIso,
  securityHeaders,
} from "./lib";

const VERSION = "1.0.0";
const THREADS_PATH = "/api/caregiver/platform/support/threads";
const UNREAD_PATH = "/api/staff/support/unread-summary";
let schemaReady: Promise<void> | undefined;

async function ensureSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_staff_unread (
        user_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        unread_count INTEGER NOT NULL DEFAULT 1,
        last_message_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(user_id,thread_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(thread_id) REFERENCES support_threads(id) ON DELETE CASCADE
      )`).run();
      await env.DB.batch([
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_staff_unread_user ON support_staff_unread(user_id,last_message_at DESC)"),
        env.DB.prepare(`INSERT INTO support_staff_unread(user_id,thread_id,unread_count,last_message_at,created_at)
          SELECT recipient_user_id,entity_id,COUNT(*),MAX(created_at),MIN(created_at)
          FROM system_notifications
          WHERE entity_type='support_thread' AND read_at IS NULL
          GROUP BY recipient_user_id,entity_id
          ON CONFLICT(user_id,thread_id) DO NOTHING`),
      ]);
    })().catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

async function supportStaffRecipients(env: Env, senderId: string) {
  const result = await env.DB.prepare(`SELECT
      id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,
      permissions_json AS permissionsJson
    FROM users
    WHERE upper(status) IN ('ACTIVE','APPROVED') AND upper(role)<>'CAREGIVER' AND id<>?
    ORDER BY created_at`).bind(senderId).all<AuthUser>();
  const recipients: AuthUser[] = [];
  for (const user of result.results || []) {
    if (await canAccess(env,user,"staff.support","view")) recipients.push(user);
  }
  return recipients;
}

function supportPostPath(path: string) {
  if (path === THREADS_PATH) return true;
  return /^\/api\/caregiver\/platform\/support\/threads\/[^/]+\/messages$/.test(path);
}

function supportMessagesGetThreadId(path: string) {
  const match = path.match(/^\/api\/caregiver\/platform\/support\/threads\/([^/]+)\/messages$/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function markStaffUnreadFromCaregiver(request: Request, env: Env, response: Response) {
  const method = request.method.toUpperCase();
  const path = new URL(request.url).pathname;
  if (method !== "POST" || !supportPostPath(path) || !response.ok) return;
  const actor = await getUser(request,env);
  if (!actor || actor.role.toUpperCase() !== "CAREGIVER") return;
  const payload: any = await response.clone().json().catch(() => null);
  const threadId = String(payload?.data?.threadId || payload?.data?.id || "").trim();
  if (!threadId) return;
  const recipients = await supportStaffRecipients(env,actor.id);
  if (!recipients.length) return;
  const at = String(payload?.data?.createdAt || nowIso());
  await env.DB.batch(recipients.map((recipient) => env.DB.prepare(`INSERT INTO support_staff_unread(
      user_id,thread_id,unread_count,last_message_at,created_at
    ) VALUES(?,?,1,?,?)
    ON CONFLICT(user_id,thread_id) DO UPDATE SET
      unread_count=support_staff_unread.unread_count+1,
      last_message_at=excluded.last_message_at`).bind(recipient.id,threadId,at,at)));
}

async function markStaffThreadRead(request: Request, env: Env, response: Response) {
  if (request.method.toUpperCase() !== "GET" || !response.ok) return;
  const threadId = supportMessagesGetThreadId(new URL(request.url).pathname);
  if (!threadId) return;
  const actor = await getUser(request,env);
  if (!actor || actor.role.toUpperCase() === "CAREGIVER") return;
  await env.DB.prepare("DELETE FROM support_staff_unread WHERE user_id=? AND thread_id=?")
    .bind(actor.id,threadId).run();
}

async function unreadSummary(request: Request, env: Env) {
  const actor = await getUser(request,env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
  if (actor.role.toUpperCase() === "CAREGIVER") return securityHeaders(fail("دسترسی مجاز نیست.",403,"forbidden"));
  const denied = await requireAccess(env,actor,"staff.support","view");
  if (denied) return securityHeaders(denied);
  await ensureSchema(env);
  const caregiver = await env.DB.prepare(`SELECT COUNT(*) AS count FROM support_staff_unread
    WHERE user_id=? AND unread_count>0`).bind(actor.id).first<{count:number}>();
  const legacy = await env.DB.prepare(`SELECT COUNT(DISTINCT entity_id) AS count FROM system_notifications n
    WHERE n.recipient_user_id=? AND n.entity_type='support_thread' AND n.read_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM support_staff_unread u WHERE u.user_id=n.recipient_user_id AND u.thread_id=n.entity_id
      )`).bind(actor.id).first<{count:number}>();
  const publicCount = await env.DB.prepare(`SELECT COUNT(DISTINCT entity_id) AS count FROM system_notifications
    WHERE recipient_user_id=? AND entity_type='public_support_conversation' AND read_at IS NULL`).bind(actor.id).first<{count:number}>();
  const caregiverUnread = Number(caregiver?.count || 0) + Number(legacy?.count || 0);
  const publicUnread = Number(publicCount?.count || 0);
  return securityHeaders(json({data:{caregiverUnread,publicUnread,totalUnread:caregiverUnread+publicUnread},version:VERSION,source:"caregiver-support-unread-repair-v1"}));
}

export async function routeCaregiverSupportUnreadRepairV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== UNREAD_PATH || request.method.toUpperCase() !== "GET") return null;
  return unreadSummary(request,env);
}

export async function decorateCaregiverSupportUnreadRepairV1(request: Request, env: Env, response: Response) {
  const path = new URL(request.url).pathname;
  const relevant = path === THREADS_PATH || path.startsWith(`${THREADS_PATH}/`);
  if (!relevant || !response.ok) return response;
  await ensureSchema(env);
  await markStaffUnreadFromCaregiver(request,env,response);
  await markStaffThreadRead(request,env,response);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-caregiver-support-unread",VERSION);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
