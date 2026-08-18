import { sendCaregiverNotificationSms } from "./sms-delivery-v1";
import { type Env, normalizeMobile, nowIso, str } from "./lib";

export const CAREGIVER_ACTIVATION_SMS_VERSION = "1.1.0";
export const CAREGIVER_ACTIVATION_SMS_TEMPLATE_STATUS = "فعال گردید";
export const CAREGIVER_ACTIVATION_SMS_TEMPLATE_PASSWORD_LABEL = "کد ملی";
const RETRY_DELAY_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 100;

type ActivationEvent = {
  id: string;
  caregiverId: string;
  userId: string | null;
  attemptCount: number;
};

type ActivationRecipient = {
  userId: string;
  caregiverId: string;
  mobile: string;
  userStatus: string;
  caregiverActive: number | null;
};

const activeStatus = (value: unknown) => ["ACTIVE", "APPROVED"].includes(str(value).toUpperCase());
const validMobile = (value: string) => /^09\d{9}$/.test(value);
const safeError = (value: unknown) => str(value instanceof Error ? value.message : value).slice(0, 500) || "activation_sms_failed";
const nextRetry = () => new Date(Date.now() + RETRY_DELAY_MS).toISOString();

function smsIrOnlyEnv(env: Env) {
  return new Proxy(env as Env & Record<string, unknown>, {
    get(target, property, receiver) {
      if (property === "SMS_PROVIDER") return "SMSIR";
      // Activation onboarding is intentionally independent from the broad
      // caregiver-change SMS switch. This does not enable other SMS events.
      if (property === "SMS_NOTIFICATIONS_ENABLED") return "true";
      // SMS.ir template variables are deliberately constant labels. No real
      // username, mobile-as-username value, national ID, or password is sent.
      if (property === "SMSIR_NOTIFICATION_TITLE_PARAMETER") {
        return str(Reflect.get(target, property, receiver)) || "STATUS";
      }
      if (property === "SMSIR_NOTIFICATION_MESSAGE_PARAMETER") {
        return str(Reflect.get(target, property, receiver)) || "PASSWORD";
      }
      return Reflect.get(target, property, receiver);
    },
  }) as any;
}

function activationTemplateConfigured(env: Env) {
  return Boolean(str((env as Env & Record<string, unknown>).SMSIR_NOTIFICATION_TEMPLATE_ID));
}

async function recipientForEvent(env: Env, event: ActivationEvent) {
  const preferredUser = event.userId
    ? "AND u.id=?"
    : "";
  const bindings: unknown[] = [event.caregiverId];
  if (event.userId) bindings.push(event.userId);
  let row = await env.DB.prepare(`SELECT
      u.id AS userId,u.caregiver_id AS caregiverId,u.mobile,u.status AS userStatus,
      c.active AS caregiverActive
    FROM users u
    JOIN caregivers c ON c.id=u.caregiver_id
    WHERE u.caregiver_id=? ${preferredUser}
      AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    ORDER BY CASE WHEN upper(u.status) IN ('ACTIVE','APPROVED') THEN 0 ELSE 1 END,u.created_at DESC
    LIMIT 1`).bind(...bindings).first<ActivationRecipient>();
  if (!row && event.userId) {
    row = await env.DB.prepare(`SELECT
        u.id AS userId,u.caregiver_id AS caregiverId,u.mobile,u.status AS userStatus,
        c.active AS caregiverActive
      FROM users u
      JOIN caregivers c ON c.id=u.caregiver_id
      WHERE u.caregiver_id=? AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
      ORDER BY CASE WHEN upper(u.status) IN ('ACTIVE','APPROVED') THEN 0 ELSE 1 END,u.created_at DESC
      LIMIT 1`).bind(event.caregiverId).first<ActivationRecipient>();
  }
  return row || null;
}

async function updateEvent(
  env: Env,
  eventId: string,
  input: { status: "SENT" | "FAILED" | "CANCELLED"; messageId?: string | null; error?: string | null; retry?: boolean },
) {
  const timestamp = nowIso();
  await env.DB.prepare(`UPDATE caregiver_activation_sms_events SET
      status=?,attempt_count=attempt_count+1,provider_message_id=?,last_error=?,next_attempt_at=?,sent_at=?,updated_at=?
    WHERE id=?`).bind(
      input.status,
      input.messageId || null,
      input.error || null,
      input.retry ? nextRetry() : null,
      input.status === "SENT" ? timestamp : null,
      timestamp,
      eventId,
    ).run();
}

async function dispatchActivationEvent(env: Env, event: ActivationEvent) {
  const recipient = await recipientForEvent(env, event);
  if (!recipient || Number(recipient.caregiverActive || 0) !== 1 || !activeStatus(recipient.userStatus)) {
    await updateEvent(env, event.id, { status: "CANCELLED", error: "caregiver_no_longer_active" });
    return { sent: 0, cancelled: 1 };
  }

  const mobile = normalizeMobile(recipient.mobile) || "";
  if (!validMobile(mobile)) {
    await updateEvent(env, event.id, { status: "FAILED", error: "caregiver_mobile_invalid", retry: true });
    return { sent: 0, failed: 1 };
  }

  // The activation SMS must use the approved SMS.ir template. We do not fall
  // back to bulk here because the desired production copy is fixed and the
  // provider template is the source of truth for its visible wording.
  if (!activationTemplateConfigured(env)) {
    await updateEvent(env, event.id, { status: "FAILED", error: "smsir_activation_template_not_configured", retry: true });
    return { sent: 0, failed: 1 };
  }

  // Expected approved SMS.ir template:
  // مراقب محترم سلامت اول
  // حساب شما #STATUS#
  // نام کاربری: شماره همراه
  // کلمه عبور: #PASSWORD#
  //
  // STATUS and PASSWORD are constant technical placeholders used only to
  // satisfy SMS.ir template requirements. No caregiver credential value is
  // disclosed in the API payload.
  const result = await sendCaregiverNotificationSms(smsIrOnlyEnv(env), {
    recipientUserId: recipient.userId,
    caregiverId: recipient.caregiverId,
    mobile,
    title: CAREGIVER_ACTIVATION_SMS_TEMPLATE_STATUS,
    message: CAREGIVER_ACTIVATION_SMS_TEMPLATE_PASSWORD_LABEL,
    kind: "PROFILE_ACTIVATED",
  });

  if (result.ok) {
    await updateEvent(env, event.id, { status: "SENT", messageId: result.messageId || null });
    return { sent: 1, failed: 0 };
  }
  await updateEvent(env, event.id, { status: "FAILED", error: safeError(result.error), retry: true });
  return { sent: 0, failed: 1 };
}

export async function processPendingCaregiverActivationSmsV1(env: Env, limit = 10) {
  const bounded = Math.max(1, Math.min(50, Math.trunc(limit) || 10));
  const now = nowIso();
  let rows: ActivationEvent[] = [];
  try {
    const result = await env.DB.prepare(`SELECT
        id,caregiver_id AS caregiverId,user_id AS userId,attempt_count AS attemptCount
      FROM caregiver_activation_sms_events
      WHERE status IN ('PENDING','FAILED')
        AND attempt_count<?
        AND (next_attempt_at IS NULL OR next_attempt_at<=?)
      ORDER BY created_at ASC
      LIMIT ?`).bind(MAX_ATTEMPTS, now, bounded).all<ActivationEvent>();
    rows = result.results || [];
  } catch (error) {
    // The migration is applied before production deployment. Keeping this
    // processor non-fatal also makes staged/preview environments safe.
    return { processed: 0, sent: 0, failed: 0, unavailable: true, error: safeError(error), version: CAREGIVER_ACTIVATION_SMS_VERSION };
  }

  let sent = 0;
  let failed = 0;
  let cancelled = 0;
  for (const event of rows) {
    try {
      const result = await dispatchActivationEvent(env, event);
      sent += Number(result.sent || 0);
      failed += Number((result as { failed?: number }).failed || 0);
      cancelled += Number((result as { cancelled?: number }).cancelled || 0);
    } catch (error) {
      failed += 1;
      await updateEvent(env, event.id, { status: "FAILED", error: safeError(error), retry: true }).catch(() => undefined);
    }
  }
  return { processed: rows.length, sent, failed, cancelled, version: CAREGIVER_ACTIVATION_SMS_VERSION };
}
