import { requireAccess, type AccessAction } from "./access-control";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  getUser,
  json,
  nowIso,
  randomId,
  readBody,
  securityHeaders,
  str,
} from "./lib";

const MODULE_KEY = "staff.contracts";
const CONTRACT_STATUSES = new Set(["DRAFT", "ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]);
export const CONTRACT_WEEKDAYS = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;
type ContractWeekday = typeof CONTRACT_WEEKDAYS[number];

type ContractInput = {
  caregiverId: string;
  contractNumber: string;
  serviceType: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  workDays: ContractWeekday[];
  subscriberFirstName: string;
  subscriberLastName: string;
  subscriberPhonePrimary: string;
  subscriberPhoneSecondary: string | null;
  subscriberNationalId: string;
  subscriberBirthDate: string;
  recipientSameAsSubscriber: boolean;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhonePrimary: string;
  recipientPhoneSecondary: string | null;
  recipientNationalId: string;
  recipientBirthDate: string;
  subscriberRelationToRecipient: string;
  notes: string | null;
};

type ContractRecord = Record<string, unknown>;
type ContractCalendarRow = {
  id: string;
  caregiverId: string;
  contractNumber: string;
  startsAt: string;
  endsAt: string;
  workDays: string;
  recipientFirstName: string | null;
  recipientLastName: string | null;
  subscriberFirstName: string | null;
  subscriberLastName: string | null;
  subscriberRelationToRecipient: string | null;
  serviceType: string | null;
  createdAt: string;
  updatedAt: string;
};

let contractSchemaReady: Promise<void> | undefined;

const OPERATIONAL_COLUMNS: Array<[string, string]> = [
  ["subscriber_first_name", "TEXT"],
  ["subscriber_last_name", "TEXT"],
  ["subscriber_phone_primary", "TEXT"],
  ["subscriber_phone_secondary", "TEXT"],
  ["subscriber_national_id", "TEXT"],
  ["subscriber_birth_date", "TEXT"],
  ["recipient_same_as_subscriber", "INTEGER NOT NULL DEFAULT 0"],
  ["recipient_first_name", "TEXT"],
  ["recipient_last_name", "TEXT"],
  ["recipient_phone_primary", "TEXT"],
  ["recipient_phone_secondary", "TEXT"],
  ["recipient_national_id", "TEXT"],
  ["recipient_birth_date", "TEXT"],
  ["subscriber_relation_to_recipient", "TEXT"],
  ["notes", "TEXT"],
  ["created_by_user_id", "TEXT"],
  ["deleted_at", "TEXT"],
];

function digits(value: unknown) {
  return str(value)
    .replace(/[۰-۹]/g, (character) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(character)))
    .replace(/[٠-٩]/g, (character) => String("٠١٢٣٤٥٦٧٨٩".indexOf(character)));
}

function cleanText(value: unknown, max = 120) {
  return str(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function phone(value: unknown, required = false) {
  const result = digits(value).replace(/[^0-9+]/g, "").slice(0, 20);
  if (!result && !required) return null;
  return result;
}

function nationalId(value: unknown) {
  return digits(value).replace(/\D/g, "").slice(0, 10);
}

function isoDate(value: unknown) {
  const normalized = digits(value).replaceAll("/", "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(timestamp) ? normalized : "";
}

function parseWorkDays(value: unknown): ContractWeekday[] {
  const source = Array.isArray(value) ? value : [];
  const allowed = new Set<string>(CONTRACT_WEEKDAYS);
  return [...new Set(source.map((item) => str(item).toUpperCase()).filter((item) => allowed.has(item)))] as ContractWeekday[];
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
}

export async function ensureOperationalContractsSchema(env: Env) {
  if (!contractSchemaReady) {
    contractSchemaReady = (async () => {
      await ensureSchema(env);
      const columns = await env.DB.prepare("PRAGMA table_info(contracts)").all<{ name: string }>();
      const present = new Set((columns.results || []).map((column) => column.name));
      for (const [name, definition] of OPERATIONAL_COLUMNS) {
        if (!present.has(name)) {
          await env.DB.prepare(`ALTER TABLE contracts ADD COLUMN ${name} ${definition}`).run();
        }
      }
      await env.DB.batch([
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contracts_active_dates ON contracts(caregiver_id,status,starts_at,ends_at,deleted_at)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contracts_subscriber_search ON contracts(subscriber_last_name,subscriber_phone_primary,subscriber_national_id)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contracts_recipient_search ON contracts(recipient_last_name,recipient_phone_primary,recipient_national_id)"),
      ]);
    })().catch((error) => {
      contractSchemaReady = undefined;
      throw error;
    });
  }
  return contractSchemaReady;
}

async function actorFor(request: Request, env: Env, action: AccessAction) {
  const actor = await getUser(request, env);
  if (!actor) return { response: securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized")) };
  const denied = await requireAccess(env, actor, MODULE_KEY, action);
  return denied ? { response: securityHeaders(denied) } : { actor };
}

async function caregiverExists(env: Env, caregiverId: string) {
  return env.DB.prepare("SELECT id FROM caregivers WHERE id=? OR membership_code=? LIMIT 1")
    .bind(caregiverId, caregiverId).first<{ id: string }>();
}

function normalizeInput(body: Record<string, unknown>, existing: ContractRecord | null = null): ContractInput | Response {
  const value = (key: string) => body[key] !== undefined ? body[key] : existing?.[key];
  const caregiverId = cleanText(value("caregiverId"), 100);
  const contractNumber = cleanText(value("contractNumber"), 80);
  const serviceType = cleanText(value("serviceType"), 100) || null;
  const status = cleanText(value("status") || "ACTIVE", 20).toUpperCase();
  const startsAt = isoDate(value("startsAt"));
  const endsAt = isoDate(value("endsAt"));
  const workDays = parseWorkDays(value("workDays"));
  const subscriberFirstName = cleanText(value("subscriberFirstName"), 80);
  const subscriberLastName = cleanText(value("subscriberLastName"), 80);
  const subscriberPhonePrimary = phone(value("subscriberPhonePrimary"), true) || "";
  const subscriberPhoneSecondary = phone(value("subscriberPhoneSecondary"));
  const subscriberNationalId = nationalId(value("subscriberNationalId"));
  const subscriberBirthDate = isoDate(value("subscriberBirthDate"));
  const recipientSameAsSubscriber = body.recipientSameAsSubscriber !== undefined
    ? body.recipientSameAsSubscriber === true || body.recipientSameAsSubscriber === 1 || str(body.recipientSameAsSubscriber) === "1"
    : Boolean(existing?.recipientSameAsSubscriber);

  let recipientFirstName = cleanText(value("recipientFirstName"), 80);
  let recipientLastName = cleanText(value("recipientLastName"), 80);
  let recipientPhonePrimary = phone(value("recipientPhonePrimary"), true) || "";
  let recipientPhoneSecondary = phone(value("recipientPhoneSecondary"));
  let recipientNationalId = nationalId(value("recipientNationalId"));
  let recipientBirthDate = isoDate(value("recipientBirthDate"));
  let subscriberRelationToRecipient = cleanText(value("subscriberRelationToRecipient"), 80);
  const notes = cleanText(value("notes"), 1000) || null;

  if (recipientSameAsSubscriber) {
    recipientFirstName = subscriberFirstName;
    recipientLastName = subscriberLastName;
    recipientPhonePrimary = subscriberPhonePrimary;
    recipientPhoneSecondary = subscriberPhoneSecondary;
    recipientNationalId = subscriberNationalId;
    recipientBirthDate = subscriberBirthDate;
    subscriberRelationToRecipient = "خود";
  }

  if (!caregiverId) return fail("انتخاب مراقب الزامی است.", 400, "caregiver_required");
  if (!CONTRACT_STATUSES.has(status)) return fail("وضعیت قرارداد معتبر نیست.", 400, "invalid_contract_status");
  if (!startsAt || !endsAt || startsAt > endsAt) return fail("تاریخ آغاز و پایان قرارداد معتبر نیست.", 400, "invalid_contract_dates");
  if (!workDays.length) return fail("حداقل یک روز قرارداد انتخاب کنید.", 400, "contract_days_required");
  if (!subscriberFirstName || !subscriberLastName || !subscriberPhonePrimary || subscriberNationalId.length !== 10 || !subscriberBirthDate) {
    return fail("نام، تلفن، کد ملی ده‌رقمی و تاریخ تولد مشترک الزامی است.", 400, "subscriber_incomplete");
  }
  if (!recipientFirstName || !recipientLastName || !recipientPhonePrimary || recipientNationalId.length !== 10 || !recipientBirthDate) {
    return fail("نام، تلفن، کد ملی ده‌رقمی و تاریخ تولد خدمت‌گیرنده الزامی است.", 400, "recipient_incomplete");
  }
  if (!subscriberRelationToRecipient) return fail("نسبت مشترک با خدمت‌گیرنده الزامی است.", 400, "relation_required");

  return {
    caregiverId,
    contractNumber,
    serviceType,
    status,
    startsAt,
    endsAt,
    workDays,
    subscriberFirstName,
    subscriberLastName,
    subscriberPhonePrimary,
    subscriberPhoneSecondary,
    subscriberNationalId,
    subscriberBirthDate,
    recipientSameAsSubscriber,
    recipientFirstName,
    recipientLastName,
    recipientPhonePrimary,
    recipientPhoneSecondary,
    recipientNationalId,
    recipientBirthDate,
    subscriberRelationToRecipient,
    notes,
  };
}

const CONTRACT_SELECT = `SELECT
  c.id,c.caregiver_id AS caregiverId,c.contract_number AS contractNumber,c.family_name AS familyName,
  c.service_type AS serviceType,c.status,c.starts_at AS startsAt,c.ends_at AS endsAt,c.work_days AS workDaysJson,
  c.subscriber_first_name AS subscriberFirstName,c.subscriber_last_name AS subscriberLastName,
  c.subscriber_phone_primary AS subscriberPhonePrimary,c.subscriber_phone_secondary AS subscriberPhoneSecondary,
  c.subscriber_national_id AS subscriberNationalId,c.subscriber_birth_date AS subscriberBirthDate,
  c.recipient_same_as_subscriber AS recipientSameAsSubscriber,
  c.recipient_first_name AS recipientFirstName,c.recipient_last_name AS recipientLastName,
  c.recipient_phone_primary AS recipientPhonePrimary,c.recipient_phone_secondary AS recipientPhoneSecondary,
  c.recipient_national_id AS recipientNationalId,c.recipient_birth_date AS recipientBirthDate,
  c.subscriber_relation_to_recipient AS subscriberRelationToRecipient,c.notes,
  c.created_by_user_id AS createdByUserId,c.created_at AS createdAt,c.updated_at AS updatedAt,c.deleted_at AS deletedAt,
  g.membership_code AS caregiverMembershipCode,g.full_name AS caregiverName,g.mobile AS caregiverMobile,
  g.national_id AS caregiverNationalId,g.primary_type AS caregiverType
  FROM contracts c JOIN caregivers g ON g.id=c.caregiver_id`;

function mapContract(row: ContractRecord) {
  return {
    ...row,
    workDays: parseJson<string[]>(row.workDaysJson, []),
    workDaysJson: undefined,
    recipientSameAsSubscriber: Boolean(Number(row.recipientSameAsSubscriber || 0)),
  };
}

async function listCaregivers(request: Request, env: Env) {
  await ensureOperationalContractsSchema(env);
  const url = new URL(request.url);
  const query = cleanText(url.searchParams.get("q"), 100);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(10, Math.min(100, Number.parseInt(url.searchParams.get("pageSize") || "30", 10) || 30));
  const offset = (page - 1) * pageSize;
  const where = query
    ? "WHERE (c.full_name LIKE ? OR c.mobile LIKE ? OR c.national_id LIKE ? OR c.membership_code LIKE ?)"
    : "";
  const bindings = query ? Array(4).fill(`%${query}%`) : [];
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT c.id,c.membership_code AS membershipCode,c.full_name AS fullName,c.mobile,
      c.national_id AS nationalId,c.birth_date AS birthDate,c.primary_type AS primaryType,
      c.cooperation_status AS cooperationStatus,c.active,
      (SELECT COUNT(*) FROM contracts x WHERE x.caregiver_id=c.id AND x.deleted_at IS NULL) AS contractCount
      FROM caregivers c ${where}
      ORDER BY c.active DESC,c.full_name LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM caregivers c ${where}`).bind(...bindings).first<{ total: number }>(),
  ]);
  const total = Number(count?.total || 0);
  return securityHeaders(json({
    data: {
      caregivers: rows.results || [],
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      query,
    },
  }));
}

async function listContracts(request: Request, env: Env) {
  await ensureOperationalContractsSchema(env);
  const url = new URL(request.url);
  const caregiverId = cleanText(url.searchParams.get("caregiverId"), 100);
  const query = cleanText(url.searchParams.get("q"), 100);
  const status = cleanText(url.searchParams.get("status"), 20).toUpperCase();
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(10, Math.min(100, Number.parseInt(url.searchParams.get("pageSize") || "30", 10) || 30));
  const offset = (page - 1) * pageSize;
  const clauses = ["c.deleted_at IS NULL"];
  const bindings: unknown[] = [];
  if (caregiverId) { clauses.push("(c.caregiver_id=? OR g.membership_code=?)"); bindings.push(caregiverId, caregiverId); }
  if (status && CONTRACT_STATUSES.has(status)) { clauses.push("c.status=?"); bindings.push(status); }
  if (query) {
    const like = `%${query}%`;
    clauses.push(`(c.contract_number LIKE ? OR g.full_name LIKE ? OR c.subscriber_first_name LIKE ? OR
      c.subscriber_last_name LIKE ? OR c.subscriber_phone_primary LIKE ? OR c.subscriber_national_id LIKE ? OR
      c.recipient_first_name LIKE ? OR c.recipient_last_name LIKE ? OR c.recipient_phone_primary LIKE ? OR c.recipient_national_id LIKE ?)`);
    bindings.push(...Array(10).fill(like));
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const [rows, count] = await Promise.all([
    env.DB.prepare(`${CONTRACT_SELECT} ${where} ORDER BY c.starts_at DESC,c.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, offset).all<ContractRecord>(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM contracts c JOIN caregivers g ON g.id=c.caregiver_id ${where}`)
      .bind(...bindings).first<{ total: number }>(),
  ]);
  const total = Number(count?.total || 0);
  return securityHeaders(json({
    data: {
      contracts: (rows.results || []).map(mapContract),
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      filters: { caregiverId, query, status },
    },
  }));
}

function generatedContractNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `CTR-${stamp}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
}

async function createContract(request: Request, env: Env, actor: AuthUser) {
  await ensureOperationalContractsSchema(env);
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات قرارداد معتبر نیست."));
  const normalized = normalizeInput(body);
  if (normalized instanceof Response) return securityHeaders(normalized);
  const caregiver = await caregiverExists(env, normalized.caregiverId);
  if (!caregiver) return securityHeaders(fail("مراقب انتخاب‌شده پیدا نشد.", 404, "caregiver_not_found"));
  normalized.caregiverId = caregiver.id;
  const id = randomId("ctr_");
  const timestamp = nowIso();
  const contractNumber = normalized.contractNumber || generatedContractNumber();
  try {
    await env.DB.prepare(`INSERT INTO contracts(
      id,caregiver_id,contract_number,family_name,service_type,status,starts_at,ends_at,work_days,
      subscriber_first_name,subscriber_last_name,subscriber_phone_primary,subscriber_phone_secondary,
      subscriber_national_id,subscriber_birth_date,recipient_same_as_subscriber,recipient_first_name,
      recipient_last_name,recipient_phone_primary,recipient_phone_secondary,recipient_national_id,
      recipient_birth_date,subscriber_relation_to_recipient,notes,created_by_user_id,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, normalized.caregiverId, contractNumber, normalized.recipientLastName, normalized.serviceType,
      normalized.status, normalized.startsAt, normalized.endsAt, JSON.stringify(normalized.workDays),
      normalized.subscriberFirstName, normalized.subscriberLastName, normalized.subscriberPhonePrimary,
      normalized.subscriberPhoneSecondary, normalized.subscriberNationalId, normalized.subscriberBirthDate,
      normalized.recipientSameAsSubscriber ? 1 : 0, normalized.recipientFirstName, normalized.recipientLastName,
      normalized.recipientPhonePrimary, normalized.recipientPhoneSecondary, normalized.recipientNationalId,
      normalized.recipientBirthDate, normalized.subscriberRelationToRecipient, normalized.notes, actor.id,
      timestamp, timestamp,
    ).run();
  } catch (error) {
    return securityHeaders(fail(`ثبت قرارداد انجام نشد: ${error instanceof Error ? error.message : "شماره قرارداد تکراری است."}`, 409, "contract_create_failed"));
  }
  await audit(request, env, actor, "CREATE_CONTRACT", "contract", id, { ...normalized, contractNumber });
  return securityHeaders(json({ data: { id, contractNumber, caregiverId: normalized.caregiverId, createdAt: timestamp } }, 201));
}

async function updateContract(request: Request, env: Env, actor: AuthUser, contractId: string) {
  await ensureOperationalContractsSchema(env);
  const row = await env.DB.prepare(`${CONTRACT_SELECT} WHERE c.id=? AND c.deleted_at IS NULL LIMIT 1`)
    .bind(contractId).first<ContractRecord>();
  if (!row) return securityHeaders(fail("قرارداد پیدا نشد.", 404, "contract_not_found"));
  const existing = mapContract(row) as ContractRecord;
  const body = await readBody(request);
  if (!body) return securityHeaders(fail("اطلاعات قرارداد معتبر نیست."));
  const normalized = normalizeInput(body, existing);
  if (normalized instanceof Response) return securityHeaders(normalized);
  const caregiver = await caregiverExists(env, normalized.caregiverId);
  if (!caregiver) return securityHeaders(fail("مراقب انتخاب‌شده پیدا نشد.", 404, "caregiver_not_found"));
  normalized.caregiverId = caregiver.id;
  const timestamp = nowIso();
  const contractNumber = normalized.contractNumber || str(existing.contractNumber);
  try {
    await env.DB.prepare(`UPDATE contracts SET
      caregiver_id=?,contract_number=?,family_name=?,service_type=?,status=?,starts_at=?,ends_at=?,work_days=?,
      subscriber_first_name=?,subscriber_last_name=?,subscriber_phone_primary=?,subscriber_phone_secondary=?,
      subscriber_national_id=?,subscriber_birth_date=?,recipient_same_as_subscriber=?,recipient_first_name=?,
      recipient_last_name=?,recipient_phone_primary=?,recipient_phone_secondary=?,recipient_national_id=?,
      recipient_birth_date=?,subscriber_relation_to_recipient=?,notes=?,updated_at=? WHERE id=? AND deleted_at IS NULL`).bind(
      normalized.caregiverId, contractNumber, normalized.recipientLastName, normalized.serviceType,
      normalized.status, normalized.startsAt, normalized.endsAt, JSON.stringify(normalized.workDays),
      normalized.subscriberFirstName, normalized.subscriberLastName, normalized.subscriberPhonePrimary,
      normalized.subscriberPhoneSecondary, normalized.subscriberNationalId, normalized.subscriberBirthDate,
      normalized.recipientSameAsSubscriber ? 1 : 0, normalized.recipientFirstName, normalized.recipientLastName,
      normalized.recipientPhonePrimary, normalized.recipientPhoneSecondary, normalized.recipientNationalId,
      normalized.recipientBirthDate, normalized.subscriberRelationToRecipient, normalized.notes, timestamp, contractId,
    ).run();
  } catch (error) {
    return securityHeaders(fail(`ویرایش قرارداد انجام نشد: ${error instanceof Error ? error.message : "شماره قرارداد تکراری است."}`, 409, "contract_update_failed"));
  }
  await audit(request, env, actor, "UPDATE_CONTRACT", "contract", contractId, { ...normalized, contractNumber });
  return securityHeaders(json({ data: { id: contractId, contractNumber, updatedAt: timestamp } }));
}

async function deleteContract(request: Request, env: Env, actor: AuthUser, contractId: string) {
  await ensureOperationalContractsSchema(env);
  const timestamp = nowIso();
  const result = await env.DB.prepare("UPDATE contracts SET status='CANCELLED',deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL")
    .bind(timestamp, timestamp, contractId).run();
  if (!result.meta.changes) return securityHeaders(fail("قرارداد پیدا نشد.", 404, "contract_not_found"));
  await audit(request, env, actor, "DELETE_CONTRACT", "contract", contractId, { deletedAt: timestamp });
  return securityHeaders(json({ data: { id: contractId, deleted: true, deletedAt: timestamp } }));
}

const JS_WEEKDAY: Record<ContractWeekday, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function maxDate(left: string, right: string) { return left > right ? left : right; }
function firstWeekdayOnOrAfter(value: string, weekday: ContractWeekday) {
  const date = new Date(`${value}T12:00:00Z`);
  const delta = (JS_WEEKDAY[weekday] - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export async function contractCalendarEvents(env: Env, caregiverId: string, start: string, end: string) {
  await ensureOperationalContractsSchema(env);
  const result = await env.DB.prepare(`SELECT
    id,caregiver_id AS caregiverId,contract_number AS contractNumber,starts_at AS startsAt,ends_at AS endsAt,
    work_days AS workDays,recipient_first_name AS recipientFirstName,recipient_last_name AS recipientLastName,
    subscriber_first_name AS subscriberFirstName,subscriber_last_name AS subscriberLastName,
    subscriber_relation_to_recipient AS subscriberRelationToRecipient,service_type AS serviceType,
    created_at AS createdAt,updated_at AS updatedAt
    FROM contracts WHERE caregiver_id=? AND status='ACTIVE' AND deleted_at IS NULL
      AND starts_at<=? AND ends_at>=? ORDER BY starts_at,created_at`).bind(caregiverId, end, start).all<ContractCalendarRow>();
  const events: Record<string, unknown>[] = [];
  for (const contract of result.results || []) {
    const workDays = parseWorkDays(parseJson<unknown[]>(contract.workDays, []));
    const recipientName = `${contract.recipientFirstName || ""} ${contract.recipientLastName || ""}`.trim()
      || `${contract.subscriberFirstName || ""} ${contract.subscriberLastName || ""}`.trim()
      || "خدمت‌گیرنده";
    const rangeStart = maxDate(contract.startsAt, start);
    for (const weekday of workDays) {
      const eventDate = firstWeekdayOnOrAfter(rangeStart, weekday);
      if (eventDate > end || eventDate > contract.endsAt) continue;
      events.push({
        id: `contract:${contract.id}:${weekday}`,
        caregiverId: contract.caregiverId,
        contractId: contract.id,
        eventType: "SHIFT",
        subjectType: "GENERAL",
        subjectName: recipientName,
        title: `قرارداد خدمت ${recipientName}`,
        eventDate,
        startTime: null,
        endTime: null,
        reminderMinutes: 0,
        recurrence: "WEEKLY",
        repeatUntil: contract.endsAt,
        medicationName: null,
        medicationDose: null,
        notes: [
          `شماره قرارداد: ${contract.contractNumber}`,
          contract.serviceType ? `نوع خدمت: ${contract.serviceType}` : "",
          contract.subscriberRelationToRecipient ? `نسبت مشترک: ${contract.subscriberRelationToRecipient}` : "",
        ].filter(Boolean).join(" • "),
        status: "ACTIVE",
        source: "CONTRACT",
        readOnly: true,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      });
    }
  }
  return events;
}

export async function routeStaffContractsV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;
  const isContractRoute = path === "/api/staff/contracts"
    || path === "/api/staff/contracts/caregivers"
    || /^\/api\/staff\/contracts\/[^/]+$/.test(path);
  if (!isContractRoute) return null;

  const action: AccessAction = method === "GET" ? "view" : method === "POST" ? "create" : method === "PATCH" ? "update" : "delete";
  const auth = await actorFor(request, env, action);
  if (auth.response) return auth.response;
  const actor = auth.actor!;

  if (path === "/api/staff/contracts/caregivers" && method === "GET") return listCaregivers(request, env);
  if (path === "/api/staff/contracts" && method === "GET") return listContracts(request, env);
  if (path === "/api/staff/contracts" && method === "POST") return createContract(request, env, actor);
  const match = path.match(/^\/api\/staff\/contracts\/([^/]+)$/);
  if (match && method === "PATCH") return updateContract(request, env, actor, decodeURIComponent(match[1]));
  if (match && method === "DELETE") return deleteContract(request, env, actor, decodeURIComponent(match[1]));
  return securityHeaders(fail("روش درخواست پشتیبانی نمی‌شود.", 405, "method_not_allowed"));
}
