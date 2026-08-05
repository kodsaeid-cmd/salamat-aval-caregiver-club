import { notifyCaregiverChangeFromAudit, sendCaregiverNotificationSms } from "./sms-delivery-v1";
import type { Env } from "./lib";

export const CAREGIVER_CHANGE_DISPATCHER_VERSION = "1.0.0";
const id = (prefix: string) => `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
const nowIso = () => new Date().toISOString();
const text = (value: unknown) => String(value ?? "").trim();

async function ensureDispatcherSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_change_dispatches (
      audit_id TEXT PRIMARY KEY,
      caregiver_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('NOTIFIED','SKIPPED','FAILED')),
      recipient_count INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      processed_at TEXT NOT NULL,
      FOREIGN KEY(audit_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_caregiver_change_dispatch_status ON caregiver_change_dispatches(status,processed_at DESC)"),
  ]);
}

async function dispatchSupportSms(env: Env, row: { action: string; afterJson: string | null; actorRole: string | null }) {
  if (!row.actorRole || text(row.actorRole).toUpperCase() === "CAREGIVER") return { notified: 0, skipped: true, caregiverId: null as string | null };
  if (!/CREATE_SUPPORT_(?:MESSAGE|THREAD)/i.test(row.action)) return null;
  let after: Record<string, unknown> = {};
  try { after = row.afterJson ? JSON.parse(row.afterJson) as Record<string, unknown> : {}; } catch { after = {}; }
  const caregiverId = text(after.caregiverId || after.caregiver_id);
  if (!caregiverId) return { notified: 0, skipped: true, caregiverId: null as string | null };
  const result = await env.DB.prepare(`SELECT id,mobile FROM users
    WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status) IN ('ACTIVE','APPROVED')`).bind(caregiverId).all<{ id: string; mobile: string }>();
  const recipients = result.results || [];
  const title = row.action.toUpperCase().includes("MESSAGE") ? "پیام جدید از پشتیبانی سلامت اول" : "گفت‌وگوی پشتیبانی برای شما ایجاد شد";
  const message = "برای مشاهده و پاسخ، بخش پشتیبانی باشگاه مراقبین سلامت اول را باز کنید.";
  await Promise.all(recipients.map((recipient) => sendCaregiverNotificationSms(env, {
    recipientUserId: recipient.id,
    caregiverId,
    mobile: recipient.mobile,
    title,
    message,
    kind: "SUPPORT_MESSAGE",
  })));
  return { notified: recipients.length, skipped: recipients.length === 0, caregiverId };
}

export async function processPendingCaregiverChangeNotifications(env: Env, limit = 20) {
  await ensureDispatcherSchema(env);
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit) || 20));
  const rows = await env.DB.prepare(`SELECT
      a.id,a.action,a.entity_type AS entityType,a.entity_id AS entityId,a.after_json AS afterJson,
      u.role AS actorRole
    FROM audit_logs a
    LEFT JOIN users u ON u.id=a.actor_user_id
    LEFT JOIN caregiver_change_dispatches d ON d.audit_id=a.id
    WHERE d.audit_id IS NULL
    ORDER BY a.created_at ASC
    LIMIT ?`).bind(bounded).all<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      afterJson: string | null;
      actorRole: string | null;
    }>();

  let processed = 0;
  let notified = 0;
  for (const row of rows.results || []) {
    let caregiverId: string | null = null;
    let recipientCount = 0;
    let status: "NOTIFIED" | "SKIPPED" | "FAILED" = "SKIPPED";
    let errorCode: string | null = null;
    try {
      const support = await dispatchSupportSms(env, row);
      if (support) {
        caregiverId = support.caregiverId;
        recipientCount = support.notified;
        status = recipientCount ? "NOTIFIED" : "SKIPPED";
      } else {
        let after: unknown = undefined;
        try { after = row.afterJson ? JSON.parse(row.afterJson) : undefined; } catch { after = undefined; }
        const result = await notifyCaregiverChangeFromAudit(env, {
          actorRole: row.actorRole,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          after,
        });
        caregiverId = text(result.caregiverId) || null;
        recipientCount = Number(result.notified || 0);
        status = recipientCount ? "NOTIFIED" : "SKIPPED";
      }
    } catch (error) {
      status = "FAILED";
      errorCode = text(error instanceof Error ? error.message : error).slice(0, 500) || "dispatch_failed";
    }
    await env.DB.prepare(`INSERT OR IGNORE INTO caregiver_change_dispatches(
      audit_id,caregiver_id,status,recipient_count,error_code,processed_at
    ) VALUES(?,?,?,?,?,?)`).bind(row.id, caregiverId, status, recipientCount, errorCode, nowIso()).run();
    processed += 1;
    notified += recipientCount;
  }
  return { processed, notified, version: CAREGIVER_CHANGE_DISPATCHER_VERSION, runId: id("chg_") };
}
