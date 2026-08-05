import {
  type AuthUser, type Env, audit, cookies, createSession, ensureSchema, fail, getUser,
  hashPassword, json, normalizeMobile, nowIso, randomId, readBody,
  sessionCookie, sha256, str, verifyPassword,
} from "./lib";
import { OTP_TTL_SECONDS, sendOtpCode } from "./sms-delivery-v1";

export async function setupStatus(env: Env) {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE upper(role)='ADMIN'").first<{ count: number }>();
  return json({ adminExists: Number(row?.count || 0) > 0, setupKeyConfigured: Boolean(env.ADMIN_SETUP_KEY || env.CRM_SYNC_API_KEY) });
}

export async function setupAdmin(request: Request, env: Env) {
  await ensureSchema(env);
  const expected = env.ADMIN_SETUP_KEY || env.CRM_SYNC_API_KEY;
  if (!expected) return fail("ابتدا Secret با نام ADMIN_SETUP_KEY را در Cloudflare تنظیم کنید.", 503, "setup_key_missing");
  if (request.headers.get("x-setup-key") !== expected) return fail("کد راه‌اندازی صحیح نیست.", 401, "invalid_setup_key");
  if (await env.DB.prepare("SELECT id FROM users WHERE upper(role)='ADMIN' LIMIT 1").first()) return fail("مدیر اصلی قبلاً ساخته شده است.", 409, "admin_exists");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات معتبر نیست.");
  const fullName = str(body.fullName) || "مدیر سامانه";
  const username = str(body.username || body.email).toLowerCase();
  const password = str(body.password);
  const mobile = normalizeMobile(str(body.mobile)) || `internal-${randomId()}`;
  if (!username || password.length < 8) return fail("نام کاربری و رمز حداقل ۸ کاراکتری لازم است.");
  const id = randomId("usr_");
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO users(id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,'ADMIN','ACTIVE','["*"]',?,?)`)
    .bind(id, fullName, mobile, username, await hashPassword(password), timestamp, timestamp).run();
  await audit(request, env, null, "SETUP_ADMIN", "user", id, { username });
  return json({ data: { id, fullName, username, role: "ADMIN", status: "ACTIVE" } }, 201);
}

export async function login(request: Request, env: Env) {
  const body = await readBody(request);
  if (!body) return fail("اطلاعات ورود معتبر نیست.");
  const identifier = str(body.identifier).toLowerCase();
  const password = str(body.password);
  const mobile = normalizeMobile(identifier);
  const user = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,password_hash AS passwordHash,role,status,permissions_json AS permissionsJson FROM users WHERE lower(username)=? OR mobile=? LIMIT 1`)
    .bind(identifier, mobile || identifier).first<AuthUser & { passwordHash: string | null }>();
  if (!user || !await verifyPassword(password, user.passwordHash)) return fail("نام کاربری یا رمز عبور صحیح نیست.", 401, "invalid_credentials");
  if (!["ACTIVE", "APPROVED"].includes(user.status.toUpperCase())) {
    return fail(user.status.toUpperCase() === "PENDING" ? "حساب شما هنوز توسط مدیر تأیید نشده است." : "حساب شما فعال نیست.", 403, "account_inactive");
  }
  const session = await createSession(request, env, user.id);
  await env.DB.prepare("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?").bind(nowIso(), nowIso(), user.id).run();
  await audit(request, env, user, "LOGIN", "session", null);
  const data = { id: user.id, caregiverId: user.caregiverId, fullName: user.fullName, mobile: user.mobile, username: user.username, role: user.role, status: user.status, permissions: JSON.parse(user.permissionsJson || "[]") };
  return json({ data, expiresAt: session.expiresAt }, 200, { "set-cookie": sessionCookie(session.token) });
}

export async function logout(request: Request, env: Env) {
  const token = cookies(request).salamat_session;
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run().catch(() => undefined);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

export async function me(request: Request, env: Env) {
  const user = await getUser(request, env);
  if (!user) return fail("نشست معتبر نیست.", 401, "unauthorized");
  return json({ data: { ...user, permissions: JSON.parse(user.permissionsJson || "[]") } });
}

export async function requestOtp(request: Request, env: Env) {
  await ensureSchema(env);
  const body = await readBody(request);
  const mobile = normalizeMobile(str(body?.mobile));
  if (!mobile || !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.");
  const user = await env.DB.prepare("SELECT id FROM users WHERE mobile=? AND upper(status) IN ('ACTIVE','APPROVED') LIMIT 1")
    .bind(mobile).first<{ id: string }>();
  if (!user) return fail("حساب فعال مرتبط با این شماره پیدا نشد.", 404, "mobile_account_not_found");

  const latest = await env.DB.prepare(`SELECT created_at AS createdAt FROM otp_challenges
    WHERE mobile=? AND purpose='LOGIN' AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1`).bind(mobile).first<{ createdAt: string }>();
  const latestAt = Date.parse(latest?.createdAt || "");
  const elapsedSeconds = latestAt ? Math.floor((Date.now() - latestAt) / 1000) : OTP_TTL_SECONDS;
  if (elapsedSeconds < OTP_TTL_SECONDS) {
    const retryAfterSeconds = OTP_TTL_SECONDS - Math.max(0, elapsedSeconds);
    return json({ error: "otp_resend_limited", message: `برای ارسال مجدد ${retryAfterSeconds} ثانیه صبر کنید.`, retryAfterSeconds }, 429);
  }

  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS count FROM otp_challenges
    WHERE mobile=? AND purpose='LOGIN' AND created_at>=?`).bind(mobile, windowStart).first<{ count: number }>();
  if (Number(recent?.count || 0) >= 5) return fail("تعداد درخواست‌های کد ورود زیاد است. پانزده دقیقه بعد دوباره تلاش کنید.", 429, "otp_rate_limited");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = randomId("otp_");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("UPDATE otp_challenges SET consumed_at=? WHERE mobile=? AND purpose='LOGIN' AND consumed_at IS NULL")
    .bind(createdAt, mobile).run();
  await env.DB.prepare(`INSERT INTO otp_challenges(id,mobile,purpose,code_hash,expires_at,created_at) VALUES(?,?,'LOGIN',?,?,?)`)
    .bind(challengeId, mobile, await sha256(code), expiresAt, createdAt).run();

  const delivery = await sendOtpCode(env, mobile, code);
  if (!delivery.ok) {
    await env.DB.prepare("UPDATE otp_challenges SET consumed_at=? WHERE id=?").bind(nowIso(), challengeId).run();
    const notConfigured = delivery.error?.includes("not_configured");
    return fail(
      notConfigured ? "درگاه پیامک هنوز فعال نشده است؛ فعلاً از ورود با ایمیل سازمانی استفاده کنید." : "ارسال پیامک انجام نشد. چند لحظه بعد دوباره تلاش کنید.",
      503,
      notConfigured ? "otp_provider_not_configured" : "otp_delivery_failed",
    );
  }
  await audit(request, env, null, "REQUEST_OTP", "otp_challenge", challengeId, { mobile: `${mobile.slice(0, 4)}***${mobile.slice(-4)}`, provider: delivery.provider });
  return json({
    ok: true,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_TTL_SECONDS,
    ...(delivery.debug ? { debugCode: code } : {}),
  });
}

export async function verifyOtp(request: Request, env: Env) {
  const body = await readBody(request);
  const mobile = normalizeMobile(str(body?.mobile));
  const code = str(body?.code).replace(/\D/g, "");
  if (!mobile || !/^09\d{9}$/.test(mobile) || !/^\d{6}$/.test(code)) return fail("شماره همراه و کد شش‌رقمی لازم است.");
  const challenge = await env.DB.prepare(`SELECT id,code_hash AS codeHash,attempt_count AS attemptCount FROM otp_challenges WHERE mobile=? AND purpose='LOGIN' AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1`)
    .bind(mobile, nowIso()).first<{ id: string; codeHash: string; attemptCount: number }>();
  if (!challenge || challenge.attemptCount >= 5 || await sha256(code) !== challenge.codeHash) {
    if (challenge) await env.DB.prepare("UPDATE otp_challenges SET attempt_count=attempt_count+1 WHERE id=?").bind(challenge.id).run();
    return fail("کد ورود معتبر نیست یا زمان آن به پایان رسیده است.", 401, "invalid_otp");
  }
  const user = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson FROM users WHERE mobile=? LIMIT 1`)
    .bind(mobile).first<AuthUser>();
  if (!user || !["ACTIVE", "APPROVED"].includes(user.status.toUpperCase())) return fail("حساب فعال نیست.", 403);
  const timestamp = nowIso();
  await env.DB.prepare("UPDATE otp_challenges SET consumed_at=? WHERE id=?").bind(timestamp, challenge.id).run();
  await env.DB.prepare("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?").bind(timestamp, timestamp, user.id).run();
  const session = await createSession(request, env, user.id);
  await audit(request, env, user, "LOGIN_OTP", "session", null, { challengeId: challenge.id });
  return json({ data: { ...user, permissions: JSON.parse(user.permissionsJson || "[]") }, expiresAt: session.expiresAt }, 200, { "set-cookie": sessionCookie(session.token) });
}

export async function registerCaregiver(request: Request, env: Env) {
  const body = await readBody(request);
  if (!body) return fail("اطلاعات ثبت‌نام معتبر نیست.");
  const fullName = str(body.fullName || body.name);
  const mobile = normalizeMobile(str(body.mobile));
  const nationalId = str(body.nationalId).replace(/\D/g, "") || null;
  const username = str(body.email || body.username).toLowerCase();
  const password = str(body.password);
  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (!mobile || !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.");
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return fail("ایمیل ورود معتبر نیست.");
  if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  const duplicate = await env.DB.prepare(`SELECT id FROM users WHERE mobile=? OR lower(username)=? UNION ALL SELECT id FROM caregivers WHERE national_id=? AND ? IS NOT NULL LIMIT 1`)
    .bind(mobile, username, nationalId, nationalId).first();
  if (duplicate) return fail("برای این شماره، ایمیل یا کد ملی قبلاً ثبت‌نام شده است.", 409, "duplicate_registration");
  const code = `CP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const userId = randomId("usr_");
  const timestamp = nowIso();
  const skills = str(body.skills).split(/[,،]/).map((x) => x.trim()).filter(Boolean);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,birth_date,primary_type,skills_json,work_history,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?, 'SELF_REGISTERED','NEW',1,?,?,?)`)
      .bind(code, `SELF-${userId}`, code, nationalId, fullName, mobile, str(body.city) || null, str(body.address) || null, str(body.serviceGroup) || "PENDING_APPROVAL", str(body.birthDate) || null, str(body.serviceGroup) || null, JSON.stringify(skills), str(body.bio) || null, timestamp, timestamp, timestamp),
    env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER','PENDING','[]',?,?)`)
      .bind(userId, code, fullName, mobile, username, await hashPassword(password), timestamp, timestamp),
  ]);
  await audit(request, env, null, "SELF_REGISTER", "caregiver", code, { fullName, mobile, username });
  return json({ data: { requestCode: userId, caregiverId: code, membershipCode: code, status: "PENDING" } }, 201);
}
