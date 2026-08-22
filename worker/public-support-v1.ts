import { canAccess, requireAccess } from "./access-control";
import {
  type AuthUser,
  type Env,
  cookies,
  fail,
  getUser,
  json,
  normalizeMobile,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  sha256,
  str,
} from "./lib";

const VERSION = "1.0.0";
const COOKIE_NAME = "salamat_public_support";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const PUBLIC_BASE = "/api/public-support";
const STAFF_BASE = "/api/staff/public-support";
const UNREAD_PATH = "/api/staff/support/unread-summary";
const STATUSES = new Set(["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
const ACTIVE_USER_STATUSES = ["ACTIVE", "APPROVED"];
let schemaReady: Promise<void> | undefined;

type PublicConversation = {
  id: string;
  visitorTokenHash: string;
  displayName: string | null;
  mobile: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  unreadCount?: number;
  lastMessage?: string | null;
};

type PublicMessage = {
  id: string;
  conversationId: string;
  senderKind: "VISITOR" | "STAFF";
  senderUserId: string | null;
  senderName?: string | null;
  textContent: string;
  createdAt: string;
};

function setCookieHeader(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

function newVisitorToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function sameOriginUnsafeRequest(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function ensurePublicSupportSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS public_support_conversations (
        id TEXT PRIMARY KEY,
        visitor_token_hash TEXT NOT NULL UNIQUE,
        display_name TEXT,
        mobile TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PENDING','RESOLVED','CLOSED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS public_support_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_kind TEXT NOT NULL CHECK(sender_kind IN ('VISITOR','STAFF')),
        sender_user_id TEXT,
        text_content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES public_support_conversations(id) ON DELETE CASCADE,
        FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE SET NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_public_support_conversations_queue ON public_support_conversations(status,last_message_at DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_public_support_messages_conversation ON public_support_messages(conversation_id,created_at ASC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_public_support_notifications_recipient ON system_notifications(recipient_user_id,entity_type,entity_id,read_at,created_at DESC)"),
    ]).then(() => undefined).catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

async function visitorConversation(request: Request, env: Env) {
  const token = cookies(request)[COOKIE_NAME];
  if (!token || token.length < 32 || token.length > 128) return { token: "", hash: "", conversation: null as PublicConversation | null };
  const hash = await sha256(token);
  const conversation = await env.DB.prepare(`SELECT
      id,visitor_token_hash AS visitorTokenHash,display_name AS displayName,mobile,status,
      created_at AS createdAt,updated_at AS updatedAt,last_message_at AS lastMessageAt
    FROM public_support_conversations WHERE visitor_token_hash=? LIMIT 1`)
    .bind(hash).first<PublicConversation>();
  return { token, hash, conversation: conversation || null };
}

async function conversationMessages(env: Env, conversationId: string, staffView = false) {
  const rows = await env.DB.prepare(`SELECT
      m.id,m.conversation_id AS conversationId,m.sender_kind AS senderKind,m.sender_user_id AS senderUserId,
      u.full_name AS senderName,m.text_content AS textContent,m.created_at AS createdAt
    FROM public_support_messages m
    LEFT JOIN users u ON u.id=m.sender_user_id
    WHERE m.conversation_id=? ORDER BY m.created_at ASC LIMIT 500`)
    .bind(conversationId).all<PublicMessage>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    senderKind: row.senderKind,
    senderUserId: staffView ? row.senderUserId : null,
    senderName: row.senderKind === "STAFF" ? (staffView ? row.senderName || "کارشناس پشتیبانی" : "پشتیبانی سلامت اول") : "شما",
    textContent: row.textContent,
    createdAt: row.createdAt,
  }));
}

async function activeSupportRecipients(env: Env) {
  const rows = await env.DB.prepare(`SELECT
      id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson
    FROM users
    WHERE upper(status) IN ('ACTIVE','APPROVED') AND upper(role)<>'CAREGIVER'
    ORDER BY created_at`).all<AuthUser>();
  const recipients: AuthUser[] = [];
  for (const user of rows.results || []) {
    if (await canAccess(env, user, "staff.support", "view")) recipients.push(user);
  }
  return recipients;
}

async function notifyStaff(env: Env, conversation: PublicConversation) {
  const recipients = await activeSupportRecipients(env);
  if (!recipients.length) return;
  const createdAt = nowIso();
  const label = conversation.displayName || conversation.mobile || "بازدیدکننده سایت";
  await env.DB.batch(recipients.map((recipient) => env.DB.prepare(`INSERT INTO system_notifications(
      id,recipient_user_id,caregiver_id,category,title,message,route,entity_type,entity_id,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
      randomId("ntf_"),recipient.id,null,"PUBLIC_SUPPORT_MESSAGE",`پیام عمومی از ${label}`,
      "یک پیام جدید از چت عمومی صفحه ورود ثبت شده است.","support",
      "public_support_conversation",conversation.id,createdAt,
    )));
}

async function markPublicRead(env: Env, actor: AuthUser, conversationId: string) {
  await env.DB.prepare(`UPDATE system_notifications SET read_at=COALESCE(read_at,?)
    WHERE recipient_user_id=? AND entity_type='public_support_conversation' AND entity_id=?`)
    .bind(nowIso(),actor.id,conversationId).run();
}

async function publicGet(request: Request, env: Env) {
  await ensurePublicSupportSchema(env);
  const visitor = await visitorConversation(request, env);
  if (!visitor.conversation) return json({ data: { conversation: null, messages: [] }, version: VERSION });
  const messages = await conversationMessages(env, visitor.conversation.id, false);
  return json({ data: { conversation: {
    id: visitor.conversation.id,
    displayName: visitor.conversation.displayName,
    mobile: visitor.conversation.mobile,
    status: visitor.conversation.status,
    createdAt: visitor.conversation.createdAt,
    updatedAt: visitor.conversation.updatedAt,
    lastMessageAt: visitor.conversation.lastMessageAt,
  }, messages }, version: VERSION });
}

async function publicSend(request: Request, env: Env) {
  if (!sameOriginUnsafeRequest(request)) return fail("درخواست نامعتبر است.",403,"invalid_origin");
  await ensurePublicSupportSchema(env);
  const body = await readBody(request);
  const message = str(body?.message);
  if (!message) return fail("متن پیام را وارد کنید.",400,"message_required");
  if (message.length > 2000) return fail("متن پیام حداکثر می‌تواند ۲۰۰۰ کاراکتر باشد.",400,"message_too_long");
  const displayName = str(body?.displayName).slice(0,120) || null;
  const mobile = normalizeMobile(str(body?.mobile)) || null;
  if (mobile && !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.",400,"invalid_mobile");

  let visitor = await visitorConversation(request, env);
  let setCookie = "";
  let conversation = visitor.conversation;
  const at = nowIso();
  if (!conversation) {
    const token = newVisitorToken();
    const hash = await sha256(token);
    const id = randomId("psc_");
    await env.DB.prepare(`INSERT INTO public_support_conversations(
      id,visitor_token_hash,display_name,mobile,status,created_at,updated_at,last_message_at
    ) VALUES(?,?,?,?,?,?,?,?)`).bind(id,hash,displayName,mobile,"OPEN",at,at,at).run();
    conversation = { id,visitorTokenHash:hash,displayName,mobile,status:"OPEN",createdAt:at,updatedAt:at,lastMessageAt:at };
    setCookie = setCookieHeader(token);
  } else {
    const recent = await env.DB.prepare(`SELECT COUNT(*) AS count FROM public_support_messages
      WHERE conversation_id=? AND sender_kind='VISITOR' AND created_at>=?`)
      .bind(conversation.id,new Date(Date.now()-60_000).toISOString()).first<{count:number}>();
    if (Number(recent?.count || 0) >= 15) return fail("تعداد پیام‌ها زیاد است؛ یک دقیقه بعد دوباره تلاش کنید.",429,"rate_limited");
    const nextName = conversation.displayName || displayName;
    const nextMobile = conversation.mobile || mobile;
    await env.DB.prepare(`UPDATE public_support_conversations
      SET display_name=?,mobile=?,status='OPEN',updated_at=?,last_message_at=? WHERE id=?`)
      .bind(nextName,nextMobile,at,at,conversation.id).run();
    conversation = { ...conversation,displayName:nextName,mobile:nextMobile,status:"OPEN",updatedAt:at,lastMessageAt:at };
  }

  await env.DB.prepare(`INSERT INTO public_support_messages(
    id,conversation_id,sender_kind,sender_user_id,text_content,created_at
  ) VALUES(?,?,?,?,?,?)`).bind(randomId("psm_"),conversation.id,"VISITOR",null,message,at).run();
  await notifyStaff(env, conversation);
  const messages = await conversationMessages(env, conversation.id, false);
  const headers = setCookie ? { "set-cookie": setCookie } : undefined;
  return json({ data: { conversation: {
    id: conversation.id,displayName:conversation.displayName,mobile:conversation.mobile,status:conversation.status,
    createdAt:conversation.createdAt,updatedAt:conversation.updatedAt,lastMessageAt:conversation.lastMessageAt,
  }, messages }, version: VERSION },201,headers);
}

async function requireStaffSupport(request: Request, env: Env, action: "view"|"create"|"update") {
  const actor = await getUser(request,env);
  if (!actor) return { actor:null as AuthUser|null, denied: fail("ابتدا وارد حساب شوید.",401,"unauthorized") };
  if (actor.role.toUpperCase() === "CAREGIVER") return { actor, denied: fail("دسترسی مجاز نیست.",403,"forbidden") };
  const denied = await requireAccess(env,actor,"staff.support",action);
  return { actor, denied };
}

async function staffList(request: Request, env: Env, actor: AuthUser) {
  const rows = await env.DB.prepare(`SELECT
      c.id,c.display_name AS displayName,c.mobile,c.status,c.created_at AS createdAt,c.updated_at AS updatedAt,
      c.last_message_at AS lastMessageAt,
      (SELECT text_content FROM public_support_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS lastMessage,
      (SELECT COUNT(*) FROM system_notifications n WHERE n.recipient_user_id=?
        AND n.entity_type='public_support_conversation' AND n.entity_id=c.id AND n.read_at IS NULL) AS unreadCount
    FROM public_support_conversations c ORDER BY unreadCount DESC,c.last_message_at DESC LIMIT 250`)
    .bind(actor.id).all<PublicConversation>();
  return json({data:{conversations:rows.results||[]},version:VERSION});
}

async function staffConversation(request: Request, env: Env, actor: AuthUser, id: string) {
  const conversation = await env.DB.prepare(`SELECT
      id,display_name AS displayName,mobile,status,created_at AS createdAt,updated_at AS updatedAt,last_message_at AS lastMessageAt
    FROM public_support_conversations WHERE id=? LIMIT 1`).bind(id).first<PublicConversation>();
  if (!conversation) return fail("گفت‌وگوی عمومی پیدا نشد.",404,"conversation_not_found");
  await markPublicRead(env,actor,id);
  const messages = await conversationMessages(env,id,true);
  return json({data:{conversation,messages},version:VERSION});
}

async function staffSend(request: Request, env: Env, actor: AuthUser, id: string) {
  const body = await readBody(request);const message=str(body?.message);
  if(!message)return fail("متن پاسخ را وارد کنید.",400,"message_required");
  if(message.length>2000)return fail("متن پاسخ حداکثر می‌تواند ۲۰۰۰ کاراکتر باشد.",400,"message_too_long");
  const conversation=await env.DB.prepare("SELECT id FROM public_support_conversations WHERE id=? LIMIT 1").bind(id).first<{id:string}>();
  if(!conversation)return fail("گفت‌وگوی عمومی پیدا نشد.",404,"conversation_not_found");
  const at=nowIso();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO public_support_messages(id,conversation_id,sender_kind,sender_user_id,text_content,created_at)
      VALUES(?,?,?,?,?,?)`).bind(randomId("psm_"),id,"STAFF",actor.id,message,at),
    env.DB.prepare("UPDATE public_support_conversations SET status='PENDING',updated_at=?,last_message_at=? WHERE id=?").bind(at,at,id),
  ]);
  await markPublicRead(env,actor,id);
  return staffConversation(request,env,actor,id);
}

async function staffStatus(request: Request, env: Env, actor: AuthUser, id: string) {
  const body=await readBody(request);const status=str(body?.status).toUpperCase();
  if(!STATUSES.has(status))return fail("وضعیت گفت‌وگو معتبر نیست.",400,"invalid_status");
  const result=await env.DB.prepare("UPDATE public_support_conversations SET status=?,updated_at=? WHERE id=?")
    .bind(status,nowIso(),id).run();
  if(!result.meta.changes)return fail("گفت‌وگوی عمومی پیدا نشد.",404,"conversation_not_found");
  await markPublicRead(env,actor,id);
  return staffConversation(request,env,actor,id);
}

async function unreadSummary(request: Request, env: Env, actor: AuthUser) {
  const caregiver = await env.DB.prepare(`SELECT COUNT(DISTINCT entity_id) AS count FROM system_notifications
    WHERE recipient_user_id=? AND entity_type='support_thread' AND read_at IS NULL`).bind(actor.id).first<{count:number}>();
  const publicCount = await env.DB.prepare(`SELECT COUNT(DISTINCT entity_id) AS count FROM system_notifications
    WHERE recipient_user_id=? AND entity_type='public_support_conversation' AND read_at IS NULL`).bind(actor.id).first<{count:number}>();
  const caregiverUnread=Number(caregiver?.count||0),publicUnread=Number(publicCount?.count||0);
  return json({data:{caregiverUnread,publicUnread,totalUnread:caregiverUnread+publicUnread},version:VERSION});
}

export async function routePublicSupportV1(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url),method=request.method.toUpperCase();
  if(url.pathname===`${PUBLIC_BASE}/conversation`&&method==="GET")return publicGet(request,env);
  if(url.pathname===`${PUBLIC_BASE}/messages`&&method==="POST")return publicSend(request,env);
  if(!url.pathname.startsWith(STAFF_BASE)&&url.pathname!==UNREAD_PATH)return null;
  await ensurePublicSupportSchema(env);
  const action: "view"|"create"|"update" = method==="GET"?"view":method==="POST"?"create":"update";
  const access=await requireStaffSupport(request,env,action);if(access.denied)return securityHeaders(access.denied);const actor=access.actor!;
  if(url.pathname===UNREAD_PATH&&method==="GET")return securityHeaders(await unreadSummary(request,env,actor));
  if(url.pathname===STAFF_BASE&&method==="GET")return securityHeaders(await staffList(request,env,actor));
  const match=url.pathname.match(/^\/api\/staff\/public-support\/([^/]+)(?:\/(messages))?$/);if(!match)return null;
  const id=decodeURIComponent(match[1]),tail=match[2]||"";
  if(!tail&&method==="GET")return securityHeaders(await staffConversation(request,env,actor,id));
  if(tail==="messages"&&method==="POST")return securityHeaders(await staffSend(request,env,actor,id));
  if(!tail&&method==="PATCH")return securityHeaders(await staffStatus(request,env,actor,id));
  return null;
}

export async function decoratePublicSupportLoginChatV1(request:Request,response:Response){
  if(!["GET","HEAD"].includes(request.method.toUpperCase())||!response.ok)return response;
  const type=response.headers.get("content-type")||"";if(!type.includes("text/html"))return response;
  const url=new URL(request.url);if(url.pathname.startsWith("/app")||url.pathname.startsWith("/mobile/admin"))return response;
  let html=await response.text();if(html.includes("public-support-chat-v1.js"))return new Response(html,response);
  const css='<link rel="stylesheet" href="/public-support-chat-v1.css?v=1.0.0" />';
  const js='<script defer src="/public-support-chat-v1.js?v=1.0.0"></script>';
  html=html.includes("</head>")?html.replace("</head>",`${css}</head>`):`${css}${html}`;
  html=html.includes("</body>")?html.replace("</body>",`${js}</body>`):`${html}${js}`;
  const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-public-support-chat",VERSION);
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
