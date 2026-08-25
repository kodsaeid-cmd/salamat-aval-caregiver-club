import { type Env, normalizeMobile, nowIso, str } from "./lib";
import { sendSmsIrTemplateV1 } from "./sms-ir-template-v1";

export const JOB_BANK_REMINDER_SMS_VERSION = "1.2.0";
export const JOB_BANK_SMS_QUEUE_NAME = "salamat-aval-job-bank-sms";
export const JOB_BANK_REMINDER_AUTOMATION_KEY = "JOB_BANK_REMINDER";

const IRAN_OFFSET_MS = 210 * 60 * 1000;
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const MAX_RECIPIENTS_PER_SLOT = 100_000;
const QUEUE_BATCH_SIZE = 100;
const RETRY_DELAY_SECONDS = 180;
const JOB_BANK_SCHEDULER_CRON = "* * * * *";
const DEFAULT_SCHEDULE_TIMES = ["10:10", "12:30", "16:45"] as const;
const SLOT_KEYS = ["1010", "1230", "1645"] as const;
let controlSchemaReady: Promise<void> | undefined;

type SlotKey = (typeof SLOT_KEYS)[number];
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

type ReminderSettingsRow = {
  slot1Time: string | null;
  slot2Time: string | null;
  slot3Time: string | null;
  countOverride: number | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

type RuntimeConfig = {
  enabled: boolean;
  pausedAt: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
  scheduleTimes: string[];
  countOverride: number | null;
  settingsUpdatedAt: string | null;
  settingsUpdatedByUserId: string | null;
};

const safeError = (value: unknown) => str(value instanceof Error ? value.message : value).slice(0, 500) || "job_bank_sms_failed";
const localDateIran = (timestampMs: number) => new Date(timestampMs + IRAN_OFFSET_MS).toISOString().slice(0, 10);
const localTimeIran = (timestampMs: number) => new Date(timestampMs + IRAN_OFFSET_MS).toISOString().slice(11, 16);
const templateId = (env: JobBankEnv) => str(env.SMSIR_JOB_BANK_TEMPLATE_ID);
const countParameter = (env: JobBankEnv) => str(env.SMSIR_JOB_BANK_COUNT_PARAMETER) || "COUNT";
const validMobile = (value: string) => /^09\d{9}$/.test(value);
const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

function tehranDayBoundsIso(at = Date.now()) {
  const local = new Date(at + IRAN_OFFSET_MS);
  const localMidnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(localMidnightUtc - IRAN_OFFSET_MS);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function normalizeScheduleTimes(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const raw of values) {
    const value = str(raw);
    if (!value) continue;
    if (!validTime(value)) throw new Error("invalid_reminder_time");
    unique.add(value);
  }
  const result = [...unique].sort((a, b) => a.localeCompare(b));
  if (result.length < 1 || result.length > 3) throw new Error("invalid_reminder_schedule_count");
  return result;
}

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
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS job_bank_reminder_sms_settings (
        settings_key TEXT PRIMARY KEY,
        slot_1_time TEXT,
        slot_2_time TEXT,
        slot_3_time TEXT,
        count_override INTEGER,
        updated_by_user_id TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CHECK(count_override IS NULL OR (count_override >= 1 AND count_override <= 9999))
      )`).run();
      await env.DB.prepare(`INSERT OR IGNORE INTO job_bank_reminder_sms_settings(
        settings_key,slot_1_time,slot_2_time,slot_3_time,count_override,updated_by_user_id,updated_at
      ) VALUES(?,?,?,?,NULL,NULL,?)`).bind(
        JOB_BANK_REMINDER_AUTOMATION_KEY,
        DEFAULT_SCHEDULE_TIMES[0],
        DEFAULT_SCHEDULE_TIMES[1],
        DEFAULT_SCHEDULE_TIMES[2],
        nowIso(),
      ).run();
    })().catch((error) => { controlSchemaReady = undefined; throw error; });
  }
  return controlSchemaReady;
}

async function loadRuntimeConfig(env: JobBankEnv): Promise<RuntimeConfig> {
  await ensureJobBankReminderControlSchemaV1(env);
  const [control, settings] = await Promise.all([
    env.DB.prepare(`SELECT
        enabled,updated_by_user_id AS updatedByUserId,updated_at AS updatedAt,paused_at AS pausedAt
      FROM sms_automation_controls WHERE automation_key=? LIMIT 1`)
      .bind(JOB_BANK_REMINDER_AUTOMATION_KEY).first<AutomationControlRow>(),
    env.DB.prepare(`SELECT
        slot_1_time AS slot1Time,slot_2_time AS slot2Time,slot_3_time AS slot3Time,
        count_override AS countOverride,updated_by_user_id AS updatedByUserId,updated_at AS updatedAt
      FROM job_bank_reminder_sms_settings WHERE settings_key=? LIMIT 1`)
      .bind(JOB_BANK_REMINDER_AUTOMATION_KEY).first<ReminderSettingsRow>(),
  ]);
  const scheduleTimes = [settings?.slot1Time, settings?.slot2Time, settings?.slot3Time]
    .map((value) => str(value))
    .filter((value) => validTime(value));
  return {
    enabled: Number(control?.enabled ?? 1) === 1,
    pausedAt: control?.pausedAt || null,
    updatedAt: control?.updatedAt || null,
    updatedByUserId: control?.updatedByUserId || null,
    scheduleTimes: scheduleTimes.length ? scheduleTimes : [...DEFAULT_SCHEDULE_TIMES],
    countOverride: settings?.countOverride == null ? null : Math.max(1, Math.min(9999, Math.trunc(Number(settings.countOverride)))),
    settingsUpdatedAt: settings?.updatedAt || null,
    settingsUpdatedByUserId: settings?.updatedByUserId || null,
  };
}

async function dailyPublishedAdCount(env: JobBankEnv, at = Date.now()) {
  const { start, end } = tehranDayBoundsIso(at);
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count
    FROM care_job_ads
    WHERE UPPER(status)='PUBLISHED'
      AND published_at IS NOT NULL
      AND published_at>=? AND published_at<?`).bind(start, end).first<{ count: number }>();
  return Math.max(0, Number(row?.count || 0));
}

async function effectiveMessageCount(env: JobBankEnv, countOverride: number | null, at = Date.now()) {
  if (countOverride != null) return Math.max(1, Math.min(9999, Math.trunc(countOverride)));
  return dailyPublishedAdCount(env, at);
}

const ACTIVE_CAREGIVER_WHERE = `COALESCE(c.active,0)=1
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
  AND NOT EXISTS (
    SELECT 1 FROM care_job_applications ap
    WHERE ap.caregiver_id=c.id
      AND upper(COALESCE(ap.lifecycle_status,ap.status,''))='IN_CONTRACT'
  )`;

async function targetCaregiverCount(env: JobBankEnv) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count
    FROM caregivers c
    JOIN users u ON u.caregiver_id=c.id
    WHERE ${ACTIVE_CAREGIVER_WHERE}`).first<{ count: number }>();
  return Math.max(0, Number(row?.count || 0));
}

export async function getJobBankReminderAutomationStateV1(envValue: Env) {
  const env = envValue as JobBankEnv;
  const config = await loadRuntimeConfig(env);
  const [publishedToday, targetCount] = await Promise.all([
    dailyPublishedAdCount(env),
    targetCaregiverCount(env),
  ]);
  return {
    automationKey: JOB_BANK_REMINDER_AUTOMATION_KEY,
    enabled: config.enabled,
    updatedByUserId: config.updatedByUserId,
    updatedAt: config.updatedAt,
    pausedAt: config.pausedAt,
    scheduleTimes: config.scheduleTimes,
    countOverride: config.countOverride,
    dailyPublishedCount: publishedToday,
    effectiveCount: config.countOverride ?? publishedToday,
    targetCaregiverCount: targetCount,
    audience: "ACTIVE_CAREGIVERS_NOT_IN_CONTRACT",
    timezone: "Asia/Tehran",
    settingsUpdatedAt: config.settingsUpdatedAt,
    settingsUpdatedByUserId: config.settingsUpdatedByUserId,
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

export async function updateJobBankReminderSettingsV1(
  envValue: Env,
  input: { scheduleTimes: unknown; countOverride: unknown },
  actorUserId: string | null = null,
) {
  const env = envValue as JobBankEnv;
  await ensureJobBankReminderControlSchemaV1(env);
  const scheduleTimes = normalizeScheduleTimes(input.scheduleTimes);
  let countOverride: number | null = null;
  if (input.countOverride !== null && input.countOverride !== undefined && str(input.countOverride) !== "") {
    const numeric = Number(input.countOverride);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 9999) throw new Error("invalid_count_override");
    countOverride = Math.trunc(numeric);
  }
  const ts = nowIso();
  await env.DB.prepare(`INSERT INTO job_bank_reminder_sms_settings(
      settings_key,slot_1_time,slot_2_time,slot_3_time,count_override,updated_by_user_id,updated_at
    ) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(settings_key) DO UPDATE SET
      slot_1_time=excluded.slot_1_time,
      slot_2_time=excluded.slot_2_time,
      slot_3_time=excluded.slot_3_time,
      count_override=excluded.count_override,
      updated_by_user_id=excluded.updated_by_user_id,
      updated_at=excluded.updated_at`)
    .bind(
      JOB_BANK_REMINDER_AUTOMATION_KEY,
      scheduleTimes[0] || null,
      scheduleTimes[1] || null,
      scheduleTimes[2] || null,
      countOverride,
      actorUserId,
      ts,
    ).run();
  const cancelled = await cancelUnsentJobBankReminderEventsV1(env, "automation_settings_changed_by_admin");
  return { ...(await getJobBankReminderAutomationStateV1(env)), cancelled };
}

export function isJobBankReminderCronV1(cron: string) {
  return cron === JOB_BANK_SCHEDULER_CRON;
}

function slotForScheduledTime(config: RuntimeConfig, scheduledTime: number): SlotKey | null {
  const current = localTimeIran(scheduledTime);
  const index = config.scheduleTimes.findIndex((time) => time === current);
  return index >= 0 && index < SLOT_KEYS.length ? SLOT_KEYS[index] : null;
}

async function eligibleRecipients(env: JobBankEnv): Promise<EligibleRecipient[]> {
  const rows = await env.DB.prepare(`SELECT
      c.id AS caregiverId,
      u.id AS userId,
      COALESCE(NULLIF(u.mobile,''),c.mobile) AS mobile
    FROM caregivers c
    JOIN users u ON u.caregiver_id=c.id
    WHERE ${ACTIVE_CAREGIVER_WHERE}
    ORDER BY c.id
    LIMIT ?`).bind(MAX_RECIPIENTS_PER_SLOT).all<EligibleRecipient>();
  return rows.results || [];
}

async function recipientStillEligible(env: JobBankEnv, caregiverId: string, userId: string | null) {
  if (!userId) return null;
  return env.DB.prepare(`SELECT
      u.id AS userId,c.id AS caregiverId,COALESCE(NULLIF(u.mobile,''),c.mobile) AS mobile
    FROM caregivers c
    JOIN users u ON u.caregiver_id=c.id
    WHERE c.id=? AND u.id=?
      AND ${ACTIVE_CAREGIVER_WHERE}
    LIMIT 1`).bind(caregiverId, userId).first<{ userId: string; caregiverId: string; mobile: string }>();
}

async function materializeEvents(
  env: JobBankEnv,
  recipients: EligibleRecipient[],
  messageCount: number,
  localDate: string,
  slotKey: SlotKey,
  scheduledAt: string,
) {
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
      messageCount,
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
  if (!isJobBankReminderCronV1(cron)) {
    return { skipped: true, reason: "not_job_bank_reminder_cron", version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  const config = await loadRuntimeConfig(env);
  const slotKey = slotForScheduledTime(config, scheduledTime);
  if (!slotKey) return { skipped: true, reason: "not_configured_reminder_time", version: JOB_BANK_REMINDER_SMS_VERSION };
  if (!config.enabled) {
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
  const count = await effectiveMessageCount(env, config.countOverride, scheduledTime);
  const localDate = localDateIran(scheduledTime);
  if (count <= 0) {
    return { skipped: true, reason: "no_published_ads_today", localDate, slotKey, version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  const scheduledAt = new Date(scheduledTime).toISOString();
  const recipients = await eligibleRecipients(env);
  if (!recipients.length) return { skipped: true, reason: "no_eligible_recipients", localDate, slotKey, count, version: JOB_BANK_REMINDER_SMS_VERSION };
  const materialized = await materializeEvents(env, recipients, count, localDate, slotKey, scheduledAt);
  const afterMaterialize = await loadRuntimeConfig(env);
  if (!afterMaterialize.enabled || afterMaterialize.settingsUpdatedAt !== config.settingsUpdatedAt) {
    const reason = !afterMaterialize.enabled ? "automation_paused_by_admin" : "automation_settings_changed_by_admin";
    const cancelled = await cancelUnsentJobBankReminderEventsV1(env, reason);
    return { skipped: true, reason, localDate, slotKey, cancelled, version: JOB_BANK_REMINDER_SMS_VERSION };
  }
  const queued = await enqueueSlotEvents(env, localDate, slotKey);
  console.log("job_bank_sms_slot_queued", { localDate, slotKey, configuredTime: localTimeIran(scheduledTime), count, eligible: recipients.length, materialized: materialized.materialized, queued });
  return { localDate, slotKey, configuredTime: localTimeIran(scheduledTime), count, eligible: recipients.length, materialized: materialized.materialized, queued, version: JOB_BANK_REMINDER_SMS_VERSION };
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
    await setEventState(env, event.id, "CANCELLED", { error: "previous_delivery_state_uncertain" });
    message.ack();
    return;
  }

  const config = await loadRuntimeConfig(env);
  if (!config.enabled) {
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

  const count = await effectiveMessageCount(env, config.countOverride, Date.now());
  if (count <= 0) {
    await setEventState(env, event.id, "CANCELLED", { error: "no_published_ads_today" });
    message.ack();
    return;
  }

  const currentTemplateId = templateId(env);
  if (!currentTemplateId) {
    await setEventState(env, event.id, "FAILED", { count, error: "smsir_job_bank_template_not_configured" });
    message.retry({ delaySeconds: RETRY_DELAY_SECONDS });
    return;
  }

  const beforeSend = await loadRuntimeConfig(env);
  if (!beforeSend.enabled || beforeSend.settingsUpdatedAt !== config.settingsUpdatedAt) {
    await setEventState(env, event.id, "CANCELLED", {
      count,
      error: beforeSend.enabled ? "automation_settings_changed_by_admin" : "automation_paused_by_admin",
    });
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
