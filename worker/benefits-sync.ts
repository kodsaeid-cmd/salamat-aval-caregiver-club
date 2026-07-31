import { type Env, nowIso, str } from "./lib";

const DAY_MS = 86_400_000;
const MONTHS: Record<string, number> = {
  فروردین: 1, اردیبهشت: 2, خرداد: 3, تیر: 4, مرداد: 5, شهریور: 6,
  مهر: 7, آبان: 8, آذر: 9, دی: 10, بهمن: 11, اسفند: 12,
};
const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});
type JsonObject = Record<string, unknown>;

const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
};
const digits = (value: unknown) => str(value)
  .replace(/[۰-۹]/g, (character) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(character)))
  .replace(/[٠-٩]/g, (character) => String("٠١٢٣٤٥٦٧٨٩".indexOf(character)));
const iso = (date: Date) => date.toISOString().slice(0, 10);
function parts(date: Date) {
  const output = { year: 0, month: 0, day: 0 };
  for (const part of formatter.formatToParts(date)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") output[part.type] = Number(part.value);
  }
  return output;
}
function jalaliToIso(year: number, month: number, day: number) {
  const cursor = new Date(Date.UTC(year + 620, 2, 1));
  for (let index = 0; index < 430; index += 1) {
    const candidate = new Date(cursor.getTime() + index * DAY_MS);
    const current = parts(candidate);
    if (current.year === year && current.month === month && current.day === day) return iso(candidate);
  }
  return null;
}
function parseDate(value: unknown) {
  const normalized = digits(value).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const gregorian = normalized.match(/^(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (gregorian) return `${gregorian[1]}-${gregorian[2].padStart(2, "0")}-${gregorian[3].padStart(2, "0")}`;
  const jalali = normalized.match(/^(1[34]\d{2})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (jalali) return jalaliToIso(Number(jalali[1]), Number(jalali[2]), Number(jalali[3]));
  const named = normalized.match(/^(\d{1,2})\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(1[34]\d{2})$/);
  return named ? jalaliToIso(Number(named[3]), MONTHS[named[2]], Number(named[1])) : null;
}
function status(value: unknown) {
  const normalized = str(value).toUpperCase().replace(/[‌\s_-]+/g, "");
  if (["ACTIVE", "APPROVED", "فعال", "جاری"].includes(normalized)) return "ACTIVE";
  if (["COMPLETED", "ENDED", "EXPIRED", "پایانیافته", "خاتمهیافته", "تمامشده", "منقضی"].includes(normalized)) return "COMPLETED";
  if (["CANCELLED", "CANCELED", "لغوشده", "فسخشده"].includes(normalized)) return "CANCELLED";
  return "DRAFT";
}
function safeId(value: unknown, fallback: string) {
  return str(value).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 90) || fallback;
}

export async function syncContractsForBenefits(env: Env) {
  const stateRow = await env.DB.prepare("SELECT state_json AS stateJson FROM ui_state WHERE scope='ORG' LIMIT 1")
    .first<{ stateJson: string }>();
  const state = parseJson<JsonObject>(stateRow?.stateJson, {});
  const admin = state.admin && typeof state.admin === "object" ? state.admin as JsonObject : {};
  const legacy = Array.isArray(admin.contracts)
    ? admin.contracts.filter((item): item is JsonObject => Boolean(item && typeof item === "object"))
    : [];
  if (!legacy.length) return { scanned: 0, inserted: 0 };

  const [caregivers, existing] = await Promise.all([
    env.DB.prepare("SELECT id,membership_code AS membershipCode FROM caregivers").all<{ id: string; membershipCode: string | null }>(),
    env.DB.prepare("SELECT id,contract_number AS contractNumber FROM contracts").all<{ id: string; contractNumber: string }>(),
  ]);
  const caregiverMap = new Map<string, string>();
  for (const caregiver of caregivers.results || []) {
    caregiverMap.set(caregiver.id, caregiver.id);
    if (caregiver.membershipCode) caregiverMap.set(caregiver.membershipCode, caregiver.id);
  }
  const known = new Set<string>();
  for (const contract of existing.results || []) { known.add(contract.id); known.add(contract.contractNumber); }

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < legacy.length; index += 1) {
    const item = legacy[index];
    const caregiverId = caregiverMap.get(str(item.caregiverId || item.caregiver_id));
    if (!caregiverId) continue;
    const contractNumber = str(item.contractNumber || item.contract_number || item.id) || `LEGACY-${index + 1}`;
    const id = safeId(item.backendId || item.id || contractNumber, `ctr_legacy_${index + 1}`);
    if (known.has(id) || known.has(contractNumber)) continue;
    known.add(id); known.add(contractNumber);
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO contracts(
      id,caregiver_id,contract_number,family_name,service_type,status,starts_at,ends_at,work_days,
      monthly_hours,logged_hours,overtime_hours,absent_hours,payment_type,payment_rate,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, caregiverId, contractNumber, str(item.familyName || item.family) || "پرونده خدمت",
      str(item.serviceType || item.service) || null, status(item.status), parseDate(item.startsAt || item.start),
      parseDate(item.endsAt || item.end), JSON.stringify(Array.isArray(item.days) ? item.days : []),
      Number(item.monthlyHours || item.hours || 0), Number(item.loggedHours || item.logged || 0),
      Number(item.overtimeHours || item.overtime || 0), Number(item.absentHours || item.absent || 0),
      str(item.paymentType || item.type) || null, Number(item.paymentRate || item.rate || 0),
      str(item.createdAt) || timestamp, timestamp,
    ));
  }
  if (statements.length) await env.DB.batch(statements);
  return { scanned: legacy.length, inserted: statements.length };
}
