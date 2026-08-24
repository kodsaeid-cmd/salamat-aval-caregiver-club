import { type Env, normalizeMobile, nowIso, str } from "./lib";
import { sendSmsIrTemplateV1 } from "./sms-ir-template-v1";

export const JOB_BANK_REMINDER_SMS_VERSION = "1.1.0";
export const JOB_BANK_SMS_QUEUE_NAME = "salamat-aval-job-bank-sms";
export const JOB_BANK_REMINDER_AUTOMATION_KEY = "JOB_BANK_REMINDER";

const IRAN_OFFSET_MS = 210 * 60 * 1000;
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const MAX_RECIPIENTS_PER_SLOT = 100_000;
const QUEUE_BATCH_SIZE = 100;
const RETRY_DELAY_SECONDS = 180;
let controlSchemaReady: Promise<void> | undefined;

const SLOT_BY_CRON = new Map<string, "1010" | "1230" | "1645">([
  ["40 6 * * *", "1010"],
  ["0 9 * * *", "1230"],
  ["15 13 * * *", "1645"],
]);

type SlotKey = "1010" | "1230" | "1645";
type QueueBody = { eventId: string };
type QueueBinding = {
  sendBatch(messages: Array<{ body: QueueBody }>): Promise<unknown>;
};
type QueueMessage = {
  body: QueueBody;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};
export type JobBankReminderMessageBatch = {
  queue: string;
  messages: readonly QueueMessage[];
};

type JobBankEnv = Env & {
  JOB_BANK_SMS_QUEUE?: QueueBinding;
  SMSIR_API_KEY?: string;
  SMSIR_JOB_BANK_TEMPLATE_ID?: string;
  SMSIR_JOB_BANK_COUNT_PARAMETER?: string;
};

type EligibleRecipient = {
  caregiverId: string;
  userId: string;
  mobile: string;
  eligibleAdCount: number;
};

type ReminderEvent = {
  id: string;
  caregiverId: string;
  userId: string | null;
  mobile: string | null;
  localDate: string;
  slotKey: SlotKey;
  scheduledAt: string;
  eligibleAdCount: number;
  status: string;
  processingAt: string | null;
};

type AutomationControlRow = {
  enabled: number;
  updatedByUserId: string | null;
  updatedAt: string | null;
  pausedAt: string | null;
};

const safeError = (value: unknown) => str(value instanceof Error ? value.message : value).slice(0, 500) || "job_bank_sms_failed";
const localDateIran = (timestampMs: number) => new Date(timestampMs + IRAN_OFFSET_MS).toISOString().slice(0, 10);
const templateId = (env: JobBankEnv) => str(env.SMSIR_JOB_BANK_TEMPLATE_ID);
const countParameter = (env: JobBankEnv) => str(env.SMSIR_JOB_BANK_COUNT_PARAMETER) || "COUNT";
const validMobile = (value: string) => /^09\d{9}$/.test(value);

async function ensureJobBankReminderControlSchemaV1(env: JobBankEnv) {
  if (!controlSchemaReady) {
    controlSchemaReady = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sms_automation_controls (
        automation_key TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
        updated_by_user_id TEXT,
        updated_at TEXT NOT NULL,
        paused_at TEXT,
        FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )`).run();
      await env.DB.prepare(`INSERT OR IGNORE INTO sms_automation_controls(
        automation_key,enabled,updated_by_user_id,updated_at,paused_at
      ) VALUES(?,1,NULL,?,NULL)`).bind(JOB_BANK_REMINDER_AUTOMATION_KEY, nowIso()).run();
    })().catch((error) => { controlSchemaReady = undefined; throw error; });
  }
  return controlSchemaReady;
}

export async function getJobBankReminderAutomationStateV1(envValue: Env) {
  const env = envValue as JobBankEnv;
  await ensureJobBankReminderControlSchemaV1(env);
  const row = await env.DB.prepare(`SELECT
      enabled,updated_by_user_id AS updatedByUserId,updated_at AS updatedAt,paused_at AS pausedAt
    FROM sms_automation_controls WHERE automation_key=? LIMIT 1`)
    .bind(JOB_BANK_REMINDER_AUTOMATION_KEY).first<AutomationControlRow>();
  return {
    automationKey: JOB_BANK_REMINDER_AUTOMATION_KEY,
    enabled: Number(row?.enabled ?? 1) === 1,
    updatedByUserId: row?.updatedByUserId || null,
    updatedAt: row?.updatedAt || null,
    pausedAt: row?.pausedAt || null,
  };
}

async function cancelUnsentJobBankReminderEventsV1(env: JobBankEnv, reason: string) {
  const ts = nowIso();
  const result = await env.DB.prepare(`UPDATE caregiver_job_bank_sms_events
    SET status='CANCELLED',last_error=?,updated_at=?
    WHERE status IN ('PENDING','QUEUED','FAILED')`).bind(reason, ts).run().catch(() => null as any);
  return Number(result?.meta?.changes || 0);
}

export async function setJobBankReminderAutomationEnabledV1(envValue: Env, enabled: boolean, actorUserId: string | null = null) {
  const env = envValue as JobBankEnv;
  await ensureJobBankReminderControlSchemaV1(env);
  const ts = nowIso();
  await env.DB.prepare(`INSERT INTO sms_automation_controls(
      automation_key,enabled,updated_by_user_id,updated_at,paused_at
    ) VALUES(?,?,?,?,?)
    ON CONFLICT(automation_key) DO UPDATE SET
      enabled=excluded.enabled,
      updated_by_user_id=excluded.updated_by_user_id,
      updated_at=excluded.updated_at,
      paused_at=excluded.paused_at`)
    .bind(JOB_BANK_REMINDER_AUTOMATION_KEY, enabled ? 1 : 0, actorUserId, ts, enabled ? null : ts).run();
  const cancelled = enabled ? 0 : await cancelUnsentJobBankReminderEventsV1(env, "automation_paused_by_admin");
  return { ...(await getJobBankReminderAutomationStateV1(env)), cancelled };
}

export function isJobBankReminderCronV1(cron: string) {
  return SLOT_BY_CRON.has(cron);
}

function slotForCron(cron: string) {
  return SLOT_BY_CRON.get(cron) || null;
}

async function eligibleRecipients(env: JobBankEnv): Promise<EligibleRecipient[]> {
  const rows = await env.DB.prepare(`WITH
    published AS (
      SELECT COUNT(*) AS total
      FROM care_job_ads
      WHERE status='PUBLISHED'
    ),
    applied AS (
      SELECT ap.caregiver_id AS caregiverId,COUNT(*) AS appliedCount
      FROM care_job_applications ap
      JOIN care_job_ads a ON a.id=ap.ad_id
      WHERE a.status='PUBLISHED'
      GROUP BY ap.caregiver_id
    ),
    eligible AS (
      SELECT
        c.id AS caregiverId,
        u.id AS userId,
        COALESCE(NULLIF(u.mobile,''),c.mobile) AS mobile,
        CAST((SELECT total FROM published)-COALESCE(ap.appliedCount,0) AS INTEGER) AS eligibleAdCount
      FROM caregivers c
      JOIN users u ON u.caregiver_id=c.id
      LEFT JOIN applied ap ON ap.caregiverId=c.id
      WHERE COALESCE(c.active,0)=1
        AND upper(u.role)='CAREGIVER'
        AND upper(u.status) IN ('ACTIVE','APPROVED')
        AND u.id=(
          SELECT u2.id FROM users u2
          WHERE u2.caregiver_id=c.id
            AND upper(u2.role)='CAREGIVER'
            AND upper(u2.status) IN ('ACTIVE','APPROVED')
          ORDER BY u2.created_at DESC,u2.id DESC
          LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM caregiver_job_contracts jc
          WHERE jc.caregiver_id=c.id AND upper(jc.status)='ACTIVE'
        )
    )
    SELECT caregiverId,userId,mobile,eligibleAdCount
    FROM eligible
    WHERE eligibleAdCount>0
    ORDER BY caregiverId
    LIMIT ?`).bind(MAX_RECIPIENTS_PER_SLOT).all<EligibleRecipient>();
  return (rows.results || []).map((row) => ({
    ...row,
    eligibleAdCount: Number(row.eligibleAdCount || 0),
  }));
}

async function currentEligibleAdCount(env: JobBankEnv, caregiverId: string) {
  const row = await env.DB.prepare(`SELECT
      CASE WHEN publishedCount-appliedCount>0 THEN publishedCount-appliedCount ELSE 0 END AS count
    FROM
      (SELECT COUNT(*) AS publishedCount FROM care_job_ads WHERE status='PUBLISHED'),
      (SELECT COUNT(*) AS appliedCount
       FROM care_job_applications ap
       JOIN care_job_ads a ON a.id=ap.ad_id
       WHERE ap.caregiver_id=? AND a.status='PUBLISHED')`).bind(caregiverId).first<{ count: number }>();
  return Math.max(0, Number(row?.count || 0));
}

async function recipientStillEligible(env: JobBankEnv, caregiverId: string, userId: string | null) {
  if (!userId) return null;
  return env.DB.prepare(`SELECT
      u.id AS userId,c.id AS caregiverId,COALESCE(NULLIF(u.mobile,''),c.mobile) AS mobile
    FROM caregivers c
    JOIN users u ON u.caregiver_id=c.id
    WHERE c.id=? AND u.id=?
      AND COALESCE(c.active,0)=1
      AND upper(u.role)='CAREGIVER'
      AND upper(u.status) IN ('ACTIVE','APPROVED')
      AND NOT EXISTS (
        SELECT 1 FROM caregiver_job_contracts jc
        WHERE jc.caregiver_id=c.id AND upper(jc.status)='ACTIVE'
      )
    LIMIT 1`).bind(caregiverId, userId).first<{ userId: string; caregiverId: string; mobile: string }>();
}

async function materializeEvents(env: JobBankEnv, recipients: EligibleRecipient[], localDate: string, slotKey: SlotKey, scheduledAt: string) {
  const ts = nowIso();
  const valid = recipients.filter((recipient) => validMobile(normalizeMobile(recipient.mobile) || ""));
  for (let offset = 0; offset < valid.length; offset += 50) {
    const group = valid.slice(offset, offset + 50);
    await env.DB.batch(group.map((recipient) => env.DB.prepare(`INSERT OR IGNORE INTO caregiver_job_bank_sms_events(
      id,caregiver_id,user_id,local_date,slot_key,scheduled_at,eligible_ad_count,status,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,'PENDING',?,?)`).bind(
      `jbs_${crypto.randomUUID().replaceAll("-", "")}`,
      recipient.caregiverId,
      recipient.userId,
      localDate,
      slotKey,
      scheduledAt,
      recipient.eligibleAdCount,
      ts,
      ts,
    )));
  }
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count
    FROM caregiver_job_bank_sms_events
    WHERE local_date=? AND slot_key=?`).bind(localDate, slotKey).first<{ count: number }>();
  return { materialized: Number(row?.count || 0), validRecipients: valid.length };
}

async function enqueueSlotEvents(env: JobBankEnv, localDate: string, slotKey: SlotKey) {
  const queue = env.JOB_BANK_SMS_QUEUE;
  if (!queue) throw new Error("job_bank_sms_queue_not_configured");
  const rows = await env.DB.prepare(`SELECT id
    FROM caregiver_job_bank_sms_events
    WHERE local_date=? AND slot_key=? AND status='PENDING' AND queued_at IS NULL
    ORDER BY created_at ASC
    LIMIT ?`).bind(localDate, slotKey, MAX_RECIPIENTS_PER_SLOT).all<{ id: string }>();
  const pending = rows.results || [];
  let queued = 0;
  for (let offset = 0; offset < pending.length; offset += QUEUE_BATCH_SIZE) {
    const group = pending.slice(offset, offset + QUEUE_BATCH_SIZE);
    let sent = false;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3 && !sent; attempt += 1) {
      try {
        await queue.sendBatch(group.map((row) => ({ body: { eventId: row.id } })));
        sent = true;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    if (!sent) throw new Error(`job_bank_sms_queue_publish_failed:${safeError(lastError)}`);
    const ts = nowIso();
    await env.DB.batch(group.map((row) => env.DB.prepare(`UPDATE caregiver_job_bank_sms_events
      SET status='QUEUED',queued_at=?,updated_at=?
      WHERE id=? AND status='PENDING'`).bind(ts, ts, row.id)));
    queued += group.length;
  }
  return queued;
}

export async function scheduleJobBankReminderSlotV1(envValue: Env, scheduledTime: number, cron: string) {
  const env = envValue as JobBankEnv;
  const slotKey = slotForCron(cron);
  if (!slotKey) return { skipped: true, reason: "not_job_bank_reminder_cron", version: JOB_BANK_REMINDER_SMS_VERSION };
  const control = await getJobBankReminderAutomationStateV1(env);
  if (!control.enabled) {
    return { skipped: true, reason: "automation_paused", slotKey, version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  if (!templateId(env)) {
    console.warn("job_bank_sms_template_not_configured", { slotKey });
    return { skipped: true, reason: "template_not_configured", slotKey, version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  if (!env.JOB_BANK_SMS_QUEUE) {
    console.error("job_bank_sms_queue_not_configured", { slotKey });
    return { skipped: true, reason: "queue_not_configured", slotKey, version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  const localDate = localDateIran(scheduledTime);
  const scheduledAt = new Date(scheduledTime).toISOString();
  const recipients = await eligibleRecipients(env);
  if (!recipients.length) return { skipped: true, reason: "no_eligible_recipients", localDate, slotKey, version: JOB_BANK_REMINDER_SMS_VERSION };
  const materialized = await materializeEvents(env, recipients, localDate, slotKey, scheduledAt);
  if (!(await getJobBankReminderAutomationStateV1(env)).enabled) {
    const cancelled = await cancelUnsentJobBankReminderEventsV1(env, "automation_paused_by_admin");
    return { skipped: true, reason: "automation_paused", localDate, slotKey, cancelled, version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  const queued = await enqueueSlotEvents(env, localDate, slotKey);
  console.log("job_bank_sms_slot_queued", { localDate, slotKey, eligible: recipients.length, materialized: materialized.materialized, queued });
  return { localDate, slotKey, eligible: recipients.length, materialized: materialized.materialized, queued, version: JOB_BANK_REMINDER_SMS_VERSION };
}

async function loadEvent(env: JobBankEnv, eventId: string) {
  return env.DB.prepare(`SELECT
      e.id,e.caregiver_id AS caregiverId,e.user_id AS userId,
      COALESCE(NULLIF(u.mobile,''),c.mobile) AS mobile,
      e.local_date AS localDate,e.slot_key AS slotKey,e.scheduled_at AS scheduledAt,
      e.eligible_ad_count AS eligibleAdCount,e.status,e.processing_at AS processingAt
    FROM caregiver_job_bank_sms_events e
    LEFT JOIN caregivers c ON c.id=e.caregiver_id
    LEFT JOIN users u ON u.id=e.user_id
    WHERE e.id=? LIMIT 1`).bind(eventId).first<ReminderEvent>();
}

async function setEventState(
  env: JobBankEnv,
  eventId: string,
  status: "PROCESSING" | "SENT" | "FAILED" | "CANCELLED",
  input: { count?: number; messageId?: string | null; error?: string | null } = {},
) {
  const ts = nowIso();
  await env.DB.prepare(`UPDATE caregiver_job_bank_sms_events SET
      status=?,
      attempt_count=attempt_count+CASE WHEN ?='PROCESSING' THEN 1 ELSE 0 END,
      eligible_ad_count=COALESCE(?,eligible_ad_count),
      provider_message_id=?,last_error=?,
      processing_at=CASE WHEN ?='PROCESSING' THEN ? ELSE processing_at END,
      sent_at=CASE WHEN ?='SENT' THEN ? ELSE sent_at END,
      updated_at=?
    WHERE id=?`).bind(
      status,
      status,
      input.count ?? null,
      input.messageId || null,
      input.error || null,
      status, ts,
      status, ts,
      ts,
      eventId,
    ).run();
}

async function processQueueMessage(env: JobBankEnv, message: QueueMessage) {
  const eventId = str(message.body?.eventId);
  if (!eventId) { message.ack(); return; }
  const event = await loadEvent(env, eventId);
  if (!event) { message.ack(); return; }
  if (["SENT", "CANCELLED"].includes(event.status)) { message.ack(); return; }
  if (event.status === "PROCESSING") {
    // An external SMS request may already have succeeded. Prefer at-most-once
    // semantics over risking a duplicate message when delivery state is unknown.
    await setEventState(env, event.id, "CANCELLED", { error: "previous_delivery_state_uncertain" });
    message.ack();
    return;
  }

  if (!(await getJobBankReminderAutomationStateV1(env)).enabled) {
    await setEventState(env, event.id, "CANCELLED", { error: "automation_paused_by_admin" });
    message.ack();
    return;
  }

  const scheduledMs = Date.parse(event.scheduledAt);
  if (!Number.isFinite(scheduledMs) || Date.now() - scheduledMs > STALE_AFTER_MS || event.localDate !== localDateIran(Date.now())) {
    await setEventState(env, event.id, "CANCELLED", { error: "job_bank_sms_stale" });
    message.ack();
    return;
  }

  const recipient = await recipientStillEligible(env, event.caregiverId, event.userId);
  const mobile = normalizeMobile(recipient?.mobile || event.mobile || "") || "";
  if (!recipient || !validMobile(mobile)) {
    await setEventState(env, event.id, "CANCELLED", { error: recipient ? "caregiver_mobile_invalid" : "caregiver_no_longer_eligible" });
    message.ack();
    return;
  }

  const count = await currentEligibleAdCount(env, event.caregiverId);
  if (count <= 0) {
    await setEventState(env, event.id, "CANCELLED", { error: "no_eligible_job_ads" });
    message.ack();
    return;
  }

  const currentTemplateId = templateId(env);
  if (!currentTemplateId) {
    await setEventState(env, event.id, "FAILED", { count, error: "smsir_job_bank_template_not_configured" });
    message.retry({ delaySeconds: RETRY_DELAY_SECONDS });
    return;
  }

  if (!(await getJobBankReminderAutomationStateV1(env)).enabled) {
    await setEventState(env, event.id, "CANCELLED", { count, error: "automation_paused_by_admin" });
    message.ack();
    return;
  }

  await setEventState(env, event.id, "PROCESSING", { count });
  const result = await sendSmsIrTemplateV1(env, {
    recipientUserId: recipient.userId,
    caregiverId: recipient.caregiverId,
    mobile,
    templateId: currentTemplateId,
    parameters: [{ name: countParameter(env), value: String(count) }],
    kind: "JOB_BANK_REMINDER",
  });

  if (result.ok) {
    await setEventState(env, event.id, "SENT", { count, messageId: result.messageId || null });
    message.ack();
    return;
  }

  await setEventState(env, event.id, "FAILED", { count, error: safeError(result.error) });
  message.retry({ delaySeconds: RETRY_DELAY_SECONDS });
}

export async function consumeJobBankReminderQueueV1(batch: JobBankReminderMessageBatch, envValue: Env) {
  if (batch.queue !== JOB_BANK_SMS_QUEUE_NAME) return false;
  const env = envValue as JobBankEnv;
  for (const message of batch.messages) {
    try {
      await processQueueMessage(env, message);
    } catch (error) {
      console.error("job_bank_sms_queue_message_failed", { eventId: str(message.body?.eventId), error: safeError(error) });
      message.retry({ delaySeconds: RETRY_DELAY_SECONDS });
    }
  }
  return true;
}
