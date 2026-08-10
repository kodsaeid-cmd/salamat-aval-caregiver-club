import app from "./index-mobile-reset-v1";
import { invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import { individualGetUserPermissions, individualRequireAccess, individualUpdateUserPermissions } from "./individual-access-v2";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  getUser,
  hashPassword,
  json,
  normalizeMobile,
  normalizeRole,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const PAGE_SIZE = 50;
const PROFILE_PREFIX = "profile:";
const REGISTRATION_RUNTIME = "/caregiver-registration-accountless-v2.js";

type WorkerContext = { waitUntil(promise: Promise<unknown>): void };

type CaregiverRow = {
  id: string;
  fullName: string;
  mobile: string;
  membershipCode: string | null;
};

function exactAdmin(actor: AuthUser | null) {
  return Boolean(actor && normalizeRole(actor.role) === "ADMIN");
}

function profileUserId(caregiverId: string) {
  return `${PROFILE_PREFIX}${caregiverId}`;
}

function caregiverIdFromProfileUserId(value: string) {
  return value.startsWith(PROFILE_PREFIX) ? value.slice(PROFILE_PREFIX.length) : "";
}

async function activeCaregiverAccount(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson
    FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED' ORDER BY created_at DESC LIMIT 1`)
    .bind(caregiverId)
    .first<AuthUser>();
}

async function readCaregiver(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT id,full_name AS fullName,mobile,membership_code AS membershipCode
    FROM caregivers WHERE id=? AND COALESCE(cooperation_status,'')<>'حذف‌شده' LIMIT 1`)
    .bind(caregiverId)
    .first<CaregiverRow>();
}

async function createOrApproveAccount(request: Request, env: Env, actor: AuthUser, caregiverId: string, body: Record<string, unknown>) {
  if (!exactAdmin(actor)) return fail("ایجاد یا تغییر اطلاعات ورود مراقب فقط در اختیار مدیر سامانه است.", 403, "admin_only_credentials");
  const caregiver = await readCaregiver(env, caregiverId);
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  const status = str(body.status || "ACTIVE").toUpperCase();
  if (!["ACTIVE", "APPROVED", "SUSPENDED"].includes(status)) return fail("وضعیت حساب معتبر نیست.");
  const existing = await activeCaregiverAccount(env, caregiverId);
  const username = str(body.username ?? existing?.username).toLowerCase();
  const password = str(body.password);
  if ((status === "ACTIVE" || status === "APPROVED") && !username) return fail("برای تأیید مراقب نام کاربری را وارد کنید.");
  if (!existing && (status === "ACTIVE" || status === "APPROVED") && password.length < 8) return fail("برای ساخت حساب، رمز عبور حداقل ۸ کاراکتری لازم است.");
  if (password && password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  if (username) {
    const duplicate = await env.DB.prepare("SELECT id FROM users WHERE lower(username)=? AND upper(status)<>'DELETED' AND id<>? LIMIT 1")
      .bind(username, existing?.id || "").first<{ id: string }>();
    if (duplicate) return fail("این نام کاربری قبلاً استفاده شده است.", 409, "duplicate_username");
  }
  const timestamp = nowIso();
  let accountId = existing?.id || "";
  let accountCreated = false;
  if (!existing) {
    if (status === "SUSPENDED") {
      await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='SUSPENDED',cooperation_status='CP-04 غیرفعال',updated_at=? WHERE id=?`)
        .bind(timestamp, caregiverId).run();
      await audit(request, env, actor, "SUSPEND", "caregiver", caregiverId, { accountCreated: false });
      return json({ ok: true, caregiverId, accountId: null, accountCreated: false, status: "SUSPENDED", updatedAt: timestamp });
    }
    accountId = randomId("usr_");
    const mobile = normalizeMobile(caregiver.mobile) || `internal-${accountId}`;
    try {
      await env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,'CAREGIVER','ACTIVE','[]',?,?)`)
        .bind(accountId, caregiverId, caregiver.fullName, mobile, username, await hashPassword(password), timestamp, timestamp).run();
    } catch {
      return fail("نام کاربری یا شماره همراه با حساب دیگری تداخل دارد.", 409, "duplicate_account");
    }
    accountCreated = true;
  } else {
    const fields = ["status=?", "username=?", "full_name=?", "mobile=?", "updated_at=?"];
    const values: unknown[] = [status === "APPROVED" ? "ACTIVE" : status, username || existing.username, caregiver.fullName, normalizeMobile(caregiver.mobile) || existing.mobile, timestamp];
    if (password) {
      fields.push("password_hash=?");
      values.push(await hashPassword(password));
    }
    values.push(existing.id);
    try {
      await env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
    } catch {
      return fail("نام کاربری یا شماره همراه با حساب دیگری تداخل دارد.", 409, "duplicate_account");
    }
  }
  const normalizedStatus = status === "APPROVED" ? "ACTIVE" : status;
  if (normalizedStatus === "ACTIVE") {
    await env.DB.prepare(`UPDATE caregivers SET active=1,recruitment_stage='APPROVED',cooperation_status=CASE
      WHEN cooperation_status IS NULL OR trim(cooperation_status)='' OR cooperation_status LIKE '%در انتظار%' THEN 'CP-01 فعال'
      ELSE cooperation_status END,updated_at=? WHERE id=?`).bind(timestamp, caregiverId).run();
  } else {
    await env.DB.prepare(`UPDATE caregivers SET active=0,recruitment_stage='SUSPENDED',cooperation_status='CP-04 غیرفعال',updated_at=? WHERE id=?`)
      .bind(timestamp, caregiverId).run();
  }
  invalidateAdminDirectoryCounts();
  invalidateCaregiverDirectoryCache();
  await audit(request, env, actor, accountCreated ? "APPROVE_AND_CREATE_ACCOUNT" : "UPDATE_CAREGIVER_CREDENTIALS", "caregiver", caregiverId, {
    accountId,
    username,
    fullName: caregiver.fullName,
    status: normalizedStatus,
    accountCreated,
    passwordChanged: Boolean(password),
  });
  return json({ ok: true, data: { id: accountId, userId: accountId, caregiverId, fullName: caregiver.fullName, mobile: caregiver.mobile, username, role: "CAREGIVER", status: normalizedStatus, accountCreated }, updatedAt: timestamp });
}

async function registerProfileOnly(request: Request, env: Env) {
  await ensureSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات ثبت‌نام معتبر نیست.");
  const fullName = str(body.fullName || body.name);
  const mobile = normalizeMobile(str(body.mobile));
  const nationalId = str(body.nationalId).replace(/\D/g, "") || null;
  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (!mobile || !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.");
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");
  const duplicate = await env.DB.prepare(`SELECT id FROM caregivers WHERE mobile=? OR (national_id=? AND ? IS NOT NULL)
    UNION ALL SELECT id FROM users WHERE mobile=? AND upper(status)<>'DELETED' LIMIT 1`)
    .bind(mobile, nationalId, nationalId, mobile).first<{ id: string }>();
  if (duplicate) return fail("برای این شماره همراه یا کد ملی قبلاً پرونده ثبت شده است.", 409, "duplicate_registration");
  const caregiverId = `CP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const requestCode = randomId("req_");
  const timestamp = nowIso();
  const skills = str(body.skills).split(/[,،]/).map((item) => item.trim()).filter(Boolean);
  try {
    await env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,birth_date,primary_type,skills_json,work_history,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?,?, 'SELF_REGISTERED','NEW',1,?,?,?)`)
      .bind(caregiverId, `SELF-PROFILE-${requestCode}`, caregiverId, nationalId, fullName, mobile, str(body.city) || null, str(body.address) || null, "در انتظار تأیید مدیر", str(body.birthDate) || null, str(body.serviceGroup) || null, JSON.stringify(skills), str(body.bio) || null, timestamp, timestamp, timestamp).run();
  } catch {
    return fail("ثبت پرونده انجام نشد؛ شماره همراه، کد ملی یا کد عضویت تکراری است.", 409, "duplicate_registration");
  }
  invalidateAdminDirectoryCounts();
  invalidateCaregiverDirectoryCache();
  await audit(request, env, null, "SELF_REGISTER_PROFILE", "caregiver", caregiverId, { fullName, mobile, requestCode, accountCreated: false });
  return json({ data: { requestCode, caregiverId, membershipCode: caregiverId, status: "PENDING", accountCreated: false } }, 201);
}

async function unifiedUsers(request: Request, env: Env, actor: AuthUser) {
  const denied = await individualRequireAccess(env, actor, "staff.users", "view");
  if (denied) return denied;
  await ensureSchema(env);
  const url = new URL(request.url);
  const q = str(url.searchParams.get("q")).slice(0, 120);
  const requested = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pattern = `%${q}%`;
  const where = q ? "WHERE (fullName LIKE ? OR COALESCE(mobile,'') LIKE ? OR COALESCE(username,'') LIKE ? OR COALESCE(membershipCode,'') LIKE ? OR COALESCE(nationalId,'') LIKE ?)" : "";
  const args: unknown[] = q ? [pattern, pattern, pattern, pattern, pattern] : [];
  const cte = `WITH directory AS (
    SELECT u.id AS id,u.caregiver_id AS caregiverId,u.full_name AS fullName,
      CASE WHEN u.mobile LIKE 'internal-%' OR u.mobile LIKE 'deleted-%' THEN '' ELSE u.mobile END AS mobile,
      u.username AS username,u.role AS role,u.status AS status,u.last_login_at AS lastLoginAt,u.created_at AS createdAt,
      COALESCE(c.membership_code,'') AS membershipCode,COALESCE(c.national_id,'') AS nationalId,0 AS profileOnly
    FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
    WHERE upper(u.status)<>'DELETED'
    UNION ALL
    SELECT '${PROFILE_PREFIX}'||c.id AS id,c.id AS caregiverId,c.full_name AS fullName,c.mobile AS mobile,NULL AS username,
      'CAREGIVER' AS role,'PENDING' AS status,NULL AS lastLoginAt,c.created_at AS createdAt,
      COALESCE(c.membership_code,'') AS membershipCode,COALESCE(c.national_id,'') AS nationalId,1 AS profileOnly
    FROM caregivers c
    WHERE COALESCE(c.cooperation_status,'')<>'حذف‌شده'
      AND TRIM(COALESCE(c.full_name,'')) NOT IN ('در انتظار ورود','در انتظار ورود در انتظار ورود')
      AND NOT EXISTS(SELECT 1 FROM users u WHERE u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED')
  )`;
  const totalRow = await env.DB.prepare(`${cte} SELECT COUNT(*) AS total FROM directory ${where}`).bind(...args).first<{ total: number }>();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const offset = (page - 1) * PAGE_SIZE;
  const result = await env.DB.prepare(`${cte} SELECT * FROM directory ${where}
    ORDER BY profileOnly DESC,CASE WHEN upper(role)='ADMIN' THEN 0 WHEN upper(role)<>'CAREGIVER' THEN 1 ELSE 2 END,createdAt DESC
    LIMIT ? OFFSET ?`).bind(...args, PAGE_SIZE, offset).all<Record<string, unknown>>();
  const rows = (result.results || []).map((row) => ({
    ...row,
    profileOnly: Boolean(row.profileOnly),
    pendingAccount: Boolean(row.profileOnly),
    linked: !Boolean(row.profileOnly),
  }));
  return json({ data: rows, pagination: { page, pageSize: PAGE_SIZE, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 }, query: q });
}

async function syntheticAccessRoute(request: Request, env: Env, actor: AuthUser, syntheticId: string, method: string) {
  if (!exactAdmin(actor)) return fail("جزئیات و تغییر دسترسی‌ها فقط برای مدیر سامانه مجاز است.", 403, "admin_only");
  const caregiverId = caregiverIdFromProfileUserId(syntheticId);
  if (!caregiverId) return null;
  const account = await activeCaregiverAccount(env, caregiverId);
  if (method === "GET" && !account) {
    return json({ data: { user: { id: syntheticId, caregiverId, role: "CAREGIVER", status: "PENDING" }, effective: [], overrides: [], policy: { precedence: "USER_THEN_ROLE_THEN_LEGACY", pendingProfile: true } } });
  }
  if (!account) return fail("ابتدا حساب ورود مراقب را ایجاد و تأیید کنید.", 409, "caregiver_account_missing");
  return method === "GET"
    ? individualGetUserPermissions(env, actor, account.id)
    : individualUpdateUserPermissions(request, env, actor, account.id);
}

async function restrictCredentialMutation(request: Request, env: Env, actor: AuthUser) {
  if (exactAdmin(actor)) return null;
  const body = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
  if (body.username !== undefined || body.email !== undefined || (body.password !== undefined && str(body.password))) {
    return fail("تغییر نام کاربری و رمز عبور فقط در اختیار مدیر سامانه است.", 403, "admin_only_credentials");
  }
  return null;
}

async function injectRegistrationRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();
  const tag = `<script defer src="${REGISTRATION_RUNTIME}?v=2.0.0"></script>`;
  if (!html.includes("caregiver-registration-accountless-v2.js")) html = html.replace("</body>", `${tag}</body>`);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "private, no-store, max-age=0");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    if (pathname === "/api/public/caregivers/register" && method === "POST") {
      return securityHeaders(await registerProfileOnly(request, env));
    }

    if (pathname === "/api/users" && method === "GET") {
      const actor = await getUser(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      return securityHeaders(await unifiedUsers(request, env, actor));
    }

    const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && method === "PATCH") {
      const actor = await getUser(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const userId = decodeURIComponent(userMatch[1]);
      const caregiverId = caregiverIdFromProfileUserId(userId);
      if (caregiverId) {
        const denied = await individualRequireAccess(env, actor, "staff.users", "update");
        if (denied) return securityHeaders(denied);
        const body = await readBody(request.clone());
        return securityHeaders(await createOrApproveAccount(request, env, actor, caregiverId, body || {}));
      }
      const blocked = await restrictCredentialMutation(request, env, actor);
      if (blocked) return securityHeaders(blocked);
    }

    const accessMatch = pathname.match(/^\/api\/admin\/access\/users\/([^/]+)$/);
    if (accessMatch && ["GET", "PUT"].includes(method)) {
      const syntheticId = decodeURIComponent(accessMatch[1]);
      if (caregiverIdFromProfileUserId(syntheticId)) {
        const actor = await getUser(request, env);
        if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
        const response = await syntheticAccessRoute(request, env, actor, syntheticId, method);
        if (response) return securityHeaders(response);
      }
    }

    const approvalMatch = pathname.match(/^\/api\/admin\/caregivers\/([^/]+)\/status$/);
    if (approvalMatch && method === "PATCH") {
      const actor = await getUser(request, env);
      if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
      const body = await readBody(request.clone());
      return securityHeaders(await createOrApproveAccount(request, env, actor, decodeURIComponent(approvalMatch[1]), body || {}));
    }

    const response = await app.fetch(request, env, ctx);
    if (pathname.startsWith("/api/") || pathname.startsWith("/media/") || /\.[a-z0-9]{2,5}$/i.test(pathname)) return response;
    return injectRegistrationRuntime(response);
  },
  async scheduled(controller: any, env: Env, ctx: WorkerContext) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  },
};
