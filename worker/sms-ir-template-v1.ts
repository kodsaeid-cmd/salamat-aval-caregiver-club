import { ensureSmsDeliverySchema } from "./sms-delivery-v1";

export const SMS_IR_TEMPLATE_SENDER_VERSION = "1.0.1";
const PROVIDER_TIMEOUT_MS = 8_000;
const encoder = new TextEncoder();

type TemplateEnv = {
  DB: D1Database;
  SMSIR_API_KEY?: string;
};

type TemplateParameter = { name: string; value: string };

type TemplateInput = {
  recipientUserId?: string | null;
  caregiverId?: string | null;
  mobile: string;
  templateId: string;
  parameters: TemplateParameter[];
  kind: string;
};

const text = (value: unknown) => String(value ?? "").trim();
const safeError = (value: unknown) => text(value instanceof Error ? value.message : value).slice(0, 700) || "smsir_template_failed";
const normalizeMobile = (value: unknown) => {
  const digits = text(value).replace(/\D/g, "");
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98")) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`;
  return digits;
};

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function recordDelivery(
  env: TemplateEnv,
  input: TemplateInput,
  status: "SENT" | "FAILED",
  messageId?: string | null,
  error?: string | null,
) {
  await ensureSmsDeliverySchema(env as any);
  await env.DB.prepare(`INSERT INTO sms_delivery_log(
    id,recipient_user_id,caregiver_id,mobile_hash,message_kind,provider,status,provider_message_id,error_code,created_at
  ) VALUES(?,?,?,?,?,'SMSIR',?,?,?,?)`).bind(
    `sms_${crypto.randomUUID().replaceAll("-", "")}`,
    input.recipientUserId || null,
    input.caregiverId || null,
    await digest(normalizeMobile(input.mobile)),
    input.kind,
    status,
    messageId || null,
    error || null,
    new Date().toISOString(),
  ).run().catch(() => undefined);
}

export async function sendSmsIrTemplateV1(env: TemplateEnv, input: TemplateInput) {
  const mobile = normalizeMobile(input.mobile);
  const templateId = text(input.templateId);
  const numericTemplateId = Number(templateId);
  if (!/^09\d{9}$/.test(mobile)) return { ok: false, provider: "SMSIR", error: "smsir_mobile_invalid" };
  if (!env.SMSIR_API_KEY || !templateId || !Number.isFinite(numericTemplateId) || numericTemplateId <= 0) {
    return { ok: false, provider: "SMSIR", error: "smsir_template_not_configured" };
  }
  const parameters = input.parameters
    .map((parameter) => ({ name: text(parameter.name), value: text(parameter.value) }))
    .filter((parameter) => parameter.name && parameter.value);
  if (!parameters.length) return { ok: false, provider: "SMSIR", error: "smsir_template_parameters_missing" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": env.SMSIR_API_KEY,
      },
      body: JSON.stringify({ mobile, templateId: numericTemplateId, parameters }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: Record<string, unknown> = {};
    try { body = raw ? JSON.parse(raw) as Record<string, unknown> : {}; }
    catch { body = { raw: raw.slice(0, 500) }; }
    if (!response.ok || Number(body.status || 1) === 0) {
      throw new Error(`sms_provider_${response.status}:${text(body.message || body.raw || "unknown_error")}`);
    }
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
    const messageId = text(data.messageId || data.packId || body.messageId || "") || null;
    await recordDelivery(env, input, "SENT", messageId, null);
    return { ok: true, provider: "SMSIR", messageId };
  } catch (error) {
    const message = safeError(error);
    await recordDelivery(env, input, "FAILED", null, message);
    return { ok: false, provider: "SMSIR", error: message };
  } finally {
    clearTimeout(timeout);
  }
}
