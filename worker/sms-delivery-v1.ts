type SmsEnv = {
  DB: D1Database;
  SMS_PROVIDER?: string;
  SMSIR_API_KEY?: string;
  SMSIR_OTP_TEMPLATE_ID?: string;
  SMSIR_OTP_PARAMETER?: string;
  SMSIR_NOTIFICATION_TEMPLATE_ID?: string;
  SMSIR_NOTIFICATION_TITLE_PARAMETER?: string;
  SMSIR_NOTIFICATION_MESSAGE_PARAMETER?: string;
  SMSIR_LINE_NUMBER?: string;
  SMS_GATEWAY_URL?: string;
  SMS_GATEWAY_TOKEN?: string;
  SMS_NOTIFICATIONS_ENABLED?: string;
  OTP_DEBUG?: string;
};

export const SMS_DELIVERY_VERSION = "1.0.0";
export const OTP_TTL_SECONDS = 120;
const PROVIDER_TIMEOUT_MS = 8_000;
const encoder = new TextEncoder();

const iso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
const text = (value: unknown) => String(value ?? "").trim();
const enabled = (value: unknown) => ["1", "true", "yes", "on"].includes(text(value).toLowerCase());
const normalizeMobile = (value: unknown) => {
  const digits = text(value).replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98")) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`;
  return digits;
};
const safeError = (value: unknown) => text(value instanceof Error ? value.message : value).slice(0, 700);
const providerName = (env: SmsEnv) => text(env.SMS_PROVIDER || (env.SMSIR_API_KEY ? "SMSIR" : env.SMS_GATEWAY_URL ? "WEBHOOK" : "")).toUpperCase();

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function ensureSmsDeliverySchema(env: SmsEnv) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sms_delivery_log (
      id TEXT PRIMARY KEY,
      recipient_user_id TEXT,
      caregiver_id TEXT,
      mobile_hash TEXT NOT NULL,
      message_kind TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SENT','FAILED','DEBUG')),
      provider_message_id TEXT,
      error_code TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sms_delivery_recipient_created ON sms_delivery_log(recipient_user_id,created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sms_delivery_caregiver_created ON sms_delivery_log(caregiver_id,created_at DESC)"),
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
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON system_notifications(recipient_user_id,read_at,created_at DESC)"),
  ]);
}

async function providerFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let body: Record<string, unknown> = {};
    try { body = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { body = { raw: raw.slice(0, 500) }; }
    if (!response.ok || Number(body.status || 1) === 0) {
      throw new Error(`sms_provider_${response.status}:${text(body.message || body.raw || "unknown_error")}`);
    }
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
    return { messageId: text(data.messageId || data.packId || body.messageId || "") || null };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendSmsIrVerify(env: SmsEnv, mobile: string, templateId: string, parameters: Array<{ name: string; value: string }>) {
  if (!env.SMSIR_API_KEY || !templateId) throw new Error("smsir_verify_not_configured");
  return providerFetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-api-key": env.SMSIR_API_KEY },
    body: JSON.stringify({ mobile, templateId: Number(templateId), parameters }),
  });
}

async function sendSmsIrBulk(env: SmsEnv, mobile: string, message: string) {
  if (!env.SMSIR_API_KEY || !env.SMSIR_LINE_NUMBER) throw new Error("smsir_bulk_not_configured");
  return providerFetch("https://api.sms.ir/v1/send/bulk", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-api-key": env.SMSIR_API_KEY },
    body: JSON.stringify({ lineNumber: Number(env.SMSIR_LINE_NUMBER), messageText: message, mobiles: [mobile], sendDateTime: null }),
  });
}

async function sendWebhook(env: SmsEnv, payload: Record<string, unknown>) {
  if (!env.SMS_GATEWAY_URL) throw new Error("sms_webhook_not_configured");
  return providerFetch(env.SMS_GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(env.SMS_GATEWAY_TOKEN ? { authorization: `Bearer ${env.SMS_GATEWAY_TOKEN}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function recordDelivery(
  env: SmsEnv,
  input: { recipientUserId?: string | null; caregiverId?: string | null; mobile: string; kind: string; provider: string; status: "SENT" | "FAILED" | "DEBUG"; messageId?: string | null; error?: string | null },
) {
  await ensureSmsDeliverySchema(env);
  await env.DB.prepare(`INSERT INTO sms_delivery_log(
    id,recipient_user_id,caregiver_id,mobile_hash,message_kind,provider,status,provider_message_id,error_code,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
    id("sms_"), input.recipientUserId || null, input.caregiverId || null, await digest(input.mobile), input.kind,
    input.provider || "NONE", input.status, input.messageId || null, input.error || null, iso(),
  ).run().catch(() => undefined);
}

export function smsProviderConfigured(env: SmsEnv) {
  const provider = providerName(env);
  if (provider === "SMSIR") return Boolean(env.SMSIR_API_KEY && env.SMSIR_OTP_TEMPLATE_ID);
  if (provider === "WEBHOOK") return Boolean(env.SMS_GATEWAY_URL);
  return false;
}

export async function sendOtpCode(env: SmsEnv, mobileValue: string, code: string) {
  const mobile = normalizeMobile(mobileValue);
  const provider = providerName(env);
  if (env.OTP_DEBUG === "true" && !smsProviderConfigured(env)) {
    await recordDelivery(env, { mobile, kind: "OTP", provider: "DEBUG", status: "DEBUG" });
    return { ok: true, provider: "DEBUG", debug: true, messageId: null };
  }
  try {
    let result: { messageId: string | null };
    if (provider === "SMSIR") {
      result = await sendSmsIrVerify(env, mobile, text(env.SMSIR_OTP_TEMPLATE_ID), [{ name: text(env.SMSIR_OTP_PARAMETER) || "CODE", value: code }]);
    } else if (provider === "WEBHOOK") {
      result = await sendWebhook(env, { kind: "OTP", mobile, code, ttlSeconds: OTP_TTL_SECONDS });
    } else {
      throw new Error("otp_provider_not_configured");
    }
    await recordDelivery(env, { mobile, kind: "OTP", provider, status: "SENT", messageId: result.messageId });
    return { ok: true, provider, debug: false, messageId: result.messageId };
  } catch (error) {
    await recordDelivery(env, { mobile, kind: "OTP", provider, status: "FAILED", error: safeError(error) });
    return { ok: false, provider, debug: false, error: safeError(error) };
  }
}

export async function sendCaregiverNotificationSms(
  env: SmsEnv,
  input: { recipientUserId: string; caregiverId: string; mobile: string; title: string; message: string; kind?: string },
) {
  if (!enabled(env.SMS_NOTIFICATIONS_ENABLED)) return { ok: false, skipped: true, error: "sms_notifications_disabled" };
  const mobile = normalizeMobile(input.mobile);
  const provider = providerName(env);
  const kind = input.kind || "CAREGIVER_CHANGE";
  try {
    let result: { messageId: string | null };
    if (provider === "SMSIR") {
      if (env.SMSIR_NOTIFICATION_TEMPLATE_ID) {
        result = await sendSmsIrVerify(env, mobile, text(env.SMSIR_NOTIFICATION_TEMPLATE_ID), [
          { name: text(env.SMSIR_NOTIFICATION_TITLE_PARAMETER) || "TITLE", value: input.title.slice(0, 60) },
          { name: text(env.SMSIR_NOTIFICATION_MESSAGE_PARAMETER) || "MESSAGE", value: input.message.slice(0, 220) },
        ]);
      } else {
        result = await sendSmsIrBulk(env, mobile, `${input.title}\n${input.message}\nباشگاه مراقبین سلامت اول`);
      }
    } else if (provider === "WEBHOOK") {
      result = await sendWebhook(env, { kind, mobile, title: input.title, message: input.message, caregiverId: input.caregiverId });
    } else {
      throw new Error("sms_provider_not_configured");
    }
    await recordDelivery(env, { recipientUserId: input.recipientUserId, caregiverId: input.caregiverId, mobile, kind, provider, status: "SENT", messageId: result.messageId });
    return { ok: true, provider, messageId: result.messageId };
  } catch (error) {
    await recordDelivery(env, { recipientUserId: input.recipientUserId, caregiverId: input.caregiverId, mobile, kind, provider, status: "FAILED", error: safeError(error) });
    return { ok: false, provider, error: safeError(error) };
  }
}

const ignoredActions = /(?:LOGIN|LOGOUT|READ|VIEW|LIST|SEARCH|SETUP|SELF_REGISTER|IMPORT|BACKFILL|SYNC|MAINTENANCE|HEALTH|SMOKE|SUPPORT_MESSAGE|SUPPORT_THREAD)/i;

async function caregiverFromEntity(env: SmsEnv, entityTypeValue: string, entityIdValue: string | null, after: unknown) {
  const entityType = text(entityTypeValue).toLowerCase();
  const entityId = text(entityIdValue);
  const payload = after && typeof after === "object" && !Array.isArray(after) ? after as Record<string, unknown> : {};
  const direct = text(payload.caregiverId || payload.caregiver_id);
  if (direct) return direct;
  if ((entityType === "caregiver" || entityType.includes("professional_meta")) && entityId) return entityId;
  if (!entityId) return null;
  const sources: Array<[RegExp, string]> = [
    [/^user$/, "SELECT caregiver_id AS caregiverId FROM users WHERE id=?"],
    [/contract/, "SELECT caregiver_id AS caregiverId FROM contracts WHERE id=?"],
    [/payroll/, "SELECT caregiver_id AS caregiverId FROM caregiver_payroll_slips WHERE id=? UNION ALL SELECT caregiver_id AS caregiverId FROM payroll_statements WHERE id=? LIMIT 1"],
    [/evaluation/, "SELECT caregiver_id AS caregiverId FROM evaluations WHERE id=?"],
    [/enrollment|training_assignment/, "SELECT caregiver_id AS caregiverId FROM enrollments WHERE id=?"],
    [/calendar_event/, "SELECT caregiver_id AS caregiverId FROM caregiver_calendar_events WHERE id=?"],
    [/leave_request/, "SELECT caregiver_id AS caregiverId FROM caregiver_leave_requests WHERE id=?"],
    [/settlement/, "SELECT caregiver_id AS caregiverId FROM caregiver_settlement_requests WHERE id=?"],
    [/credit_request/, "SELECT caregiver_id AS caregiverId FROM caregiver_credit_requests WHERE id=?"],
    [/wallet/, "SELECT caregiver_id AS caregiverId FROM caregiver_wallet_transactions WHERE id=?"],
    [/case_assignment/, "SELECT caregiver_id AS caregiverId FROM case_assignments WHERE id=?"],
    [/shift/, "SELECT caregiver_id AS caregiverId FROM shifts WHERE id=?"],
    [/document/, "SELECT caregiver_id AS caregiverId FROM caregiver_documents WHERE id=?"],
    [/stored_file/, "SELECT caregiver_id AS caregiverId FROM stored_files WHERE id=?"],
  ];
  for (const [pattern, sql] of sources) {
    if (!pattern.test(entityType)) continue;
    const bindings = (sql.match(/\?/g) || []).map(() => entityId);
    const row = await env.DB.prepare(sql).bind(...bindings).first<{ caregiverId: string | null }>().catch(() => null);
    if (row?.caregiverId) return row.caregiverId;
  }
  return null;
}

function changeCopy(actionValue: string, entityTypeValue: string) {
  const source = `${actionValue} ${entityTypeValue}`.toUpperCase();
  if (/CONTRACT/.test(source)) return { category: "CONTRACT", title: "قرارداد شما به‌روزرسانی شد", message: "تغییری در اطلاعات قرارداد شما ثبت شده است. جزئیات را در باشگاه مراقبین بررسی کنید.", route: "caregiver.contracts" };
  if (/PAYROLL|SETTLEMENT|CREDIT|WALLET|FINANC/.test(source)) return { category: "FINANCE", title: "اطلاعات مالی شما به‌روزرسانی شد", message: "تغییری در کیف پول، تسویه، اعتبار یا پرداخت شما ثبت شده است.", route: "caregiver.wallet" };
  if (/EVALUATION|SCORE|RANK|LICENSE|PROFESSIONAL/.test(source)) return { category: "EVALUATION", title: "کارنامه حرفه‌ای شما به‌روزرسانی شد", message: "نتیجه یا وضعیت ارزیابی حرفه‌ای شما تغییر کرده است.", route: "caregiver.scorecard" };
  if (/TRAIN|COURSE|ENROLL/.test(source)) return { category: "TRAINING", title: "آموزش‌های شما به‌روزرسانی شد", message: "دوره یا تکلیف آموزشی جدیدی برای شما ثبت یا به‌روزرسانی شده است.", route: "caregiver.training" };
  if (/CALENDAR|SHIFT|LEAVE|ASSIGNMENT|CASE/.test(source)) return { category: "WORK", title: "برنامه یا پرونده کاری شما تغییر کرد", message: "تغییری در برنامه، شیفت یا پرونده ارجاعی شما ثبت شده است.", route: "caregiver.dashboard" };
  if (/DOCUMENT|PROFILE|CAREGIVER|APPROVE|STATUS/.test(source)) return { category: "PROFILE", title: "پرونده شما به‌روزرسانی شد", message: "یکی از اطلاعات یا وضعیت‌های پرونده مراقب شما تغییر کرده است.", route: "caregiver.profile" };
  return { category: "ACCOUNT", title: "اطلاعات شما در باشگاه به‌روزرسانی شد", message: "یک تغییر جدید از سوی تیم سلامت اول برای حساب شما ثبت شده است.", route: "caregiver.dashboard" };
}

export async function notifyCaregiverChangeFromAudit(
  env: SmsEnv,
  input: { actorRole?: string | null; action: string; entityType: string; entityId: string | null; after?: unknown },
) {
  if (!input.actorRole || text(input.actorRole).toUpperCase() === "CAREGIVER" || ignoredActions.test(input.action)) return { notified: 0, skipped: true };
  await ensureSmsDeliverySchema(env);
  const caregiverId = await caregiverFromEntity(env, input.entityType, input.entityId, input.after);
  if (!caregiverId) return { notified: 0, skipped: true };
  const users = await env.DB.prepare(`SELECT id,mobile FROM users
    WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status) IN ('ACTIVE','APPROVED')`).bind(caregiverId).all<{ id: string; mobile: string }>();
  const recipients = users.results || [];
  if (!recipients.length) return { notified: 0, skipped: true };
  const copy = changeCopy(input.action, input.entityType);
  const createdAt = iso();
  await env.DB.batch(recipients.map((recipient) => env.DB.prepare(`INSERT INTO system_notifications(
    id,recipient_user_id,caregiver_id,category,title,message,route,entity_type,entity_id,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
    id("ntf_"), recipient.id, caregiverId, copy.category, copy.title, copy.message, copy.route,
    input.entityType, input.entityId, createdAt,
  ))).catch(() => undefined);
  await Promise.all(recipients.map((recipient) => sendCaregiverNotificationSms(env, {
    recipientUserId: recipient.id,
    caregiverId,
    mobile: recipient.mobile,
    title: copy.title,
    message: copy.message,
  })));
  return { notified: recipients.length, caregiverId };
}
