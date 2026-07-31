import {
  type AuthUser, type Env, audit, ensureSchema, fail, hasRole, json, nowIso, readBody, str,
} from "./lib";

const STAFF_ROLES = ["ADMIN", "HR", "OPERATIONS"];
const DAY_MS = 86_400_000;
const CONTINUOUS_TARGET_DAYS = 730;
const CUMULATIVE_TARGET_DAYS = 1_095;
const CREDIT_AMOUNT_TOMAN = 500_000_000;
const PERSIAN_MONTHS: Record<string, number> = {
  فروردین: 1, اردیبهشت: 2, خرداد: 3, تیر: 4, مرداد: 5, شهریور: 6,
  مهر: 7, آبان: 8, آذر: 9, دی: 10, بهمن: 11, اسفند: 12,
};
const persianDateFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});

type ContractRow = {
  id: string;
  caregiverId: string;
  contractNumber: string;
  familyName: string;
  serviceType: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  insuranceEnabled: number | null;
  insuranceStatus: string | null;
  coverageStartsAt: string | null;
  coverageEndsAt: string | null;
  policyNumber: string | null;
  insuranceNote: string | null;
};

type Interval = { start: string; end: string };
type LegacyObject = Record<string, unknown>;

const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
};
const digits = (value: unknown) => str(value)
  .replace(/[۰-۹]/g, (character) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(character)))
  .replace(/[٠-٩]/g, (character) => String("٠١٢٣٤٥٦٧٨٩".indexOf(character)));
const isIsoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(value));
const dateValue = (value: string) => Date.parse(`${value}T00:00:00Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => isoDate(new Date(dateValue(value) + days * DAY_MS));
const daysInclusive = (start: string, end: string) => Math.max(0, Math.floor((dateValue(end) - dateValue(start)) / DAY_MS) + 1);
const percent = (value: number, target: number) => Math.min(100, Math.round((value / target) * 1_000) / 10);
const monthParts = (days: number) => ({ months: Math.floor(days / 30), days: days % 30 });

function persianParts(date: Date) {
  const parts = { year: 0, month: 0, day: 0 };
  for (const part of persianDateFormatter.formatToParts(date)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") parts[part.type] = Number(part.value);
  }
  return parts;
}

const jalaliCache = new Map<string, string>();
function jalaliToIso(year: number, month: number, day: number) {
  const key = `${year}/${month}/${day}`;
  const cached = jalaliCache.get(key);
  if (cached) return cached;
  const cursor = new Date(Date.UTC(year + 620, 2, 1));
  for (let index = 0; index < 430; index += 1) {
    const current = new Date(cursor.getTime() + index * DAY_MS);
    const parts = persianParts(current);
    if (parts.year === year && parts.month === month && parts.day === day) {
      const result = isoDate(current); jalaliCache.set(key, result); return result;
    }
  }
  return null;
}

function parseContractDate(value: unknown) {
  const normalized = digits(value).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const iso = normalized.match(/^(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (iso) {
    const candidate = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return Number.isFinite(dateValue(candidate)) ? candidate : null;
  }
  const slash = normalized.match(/^(1[34]\d{2})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (slash) return jalaliToIso(Number(slash[1]), Number(slash[2]), Number(slash[3]));
  const named = normalized.match(/^(\d{1,2})\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(1[34]\d{2})$/);
  return named ? jalaliToIso(Number(named[3]), PERSIAN_MONTHS[named[2]], Number(named[1])) : null;
}

function contractStatus(value: unknown) {
  const status = str(value).toUpperCase().replace(/[‌\s_-]+/g, "");
  if (["ACTIVE", "APPROVED", "فعال", "جاری"].includes(status)) return "ACTIVE";
  if (["COMPLETED", "ENDED", "EXPIRED", "پایانیافته", "خاتمهیافته", "تمامشده", "منقضی"].includes(status)) return "COMPLETED";
  if (["CANCELLED", "CANCELED", "لغوشده", "فسخشده"].includes(status)) return "CANCELLED";
  if (["SUSPENDED", "تعلیق", "تعلیقشده"].includes(status)) return "SUSPENDED";
  return "DRAFT";
}

function safeId(value: unknown, fallback: string) {
  const output = str(value).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 90);
  return output || fallback;
}

async function importLegacyContracts(env: Env) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM contracts").first<{ count: number }>();
  if (Number(count?.count || 0) > 0) return { imported: 0, skipped: true };
  const row = await env.DB.prepare("SELECT state_json AS stateJson FROM ui_state WHERE scope='ORG' LIMIT 1")
    .first<{ stateJson: string }>();
  const state = parseJson<LegacyObject>(row?.stateJson, {});
  const admin = state.admin && typeof state.admin === "object" ? state.admin as LegacyObject : {};
  const contracts = Array.isArray(admin.contracts)
    ? admin.contracts.filter((item): item is LegacyObject => Boolean(item && typeof item === "object"))
    : [];
  if (!contracts.length) return { imported: 0, skipped: false };

  const caregivers = await env.DB.prepare("SELECT id,membership_code AS membershipCode FROM caregivers").all<{ id: string; membershipCode: string | null }>();
  const caregiverMap = new Map<string, string>();
  for (const caregiver of caregivers.results || []) {
    caregiverMap.set(caregiver.id, caregiver.id);
    if (caregiver.membershipCode) caregiverMap.set(caregiver.membershipCode, caregiver.id);
  }

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  let imported = 0;
  for (let index = 0; index < contracts.length; index += 1) {
    const item = contracts[index];
    const caregiverId = caregiverMap.get(str(item.caregiverId || item.caregiver_id));
    if (!caregiverId) continue;
    const contractNumber = str(item.contractNumber || item.contract_number || item.id) || `LEGACY-${index + 1}`;
    const id = safeId(item.backendId || item.id || contractNumber, `ctr_legacy_${index + 1}`);
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO contracts(
      id,caregiver_id,contract_number,family_name,service_type,status,starts_at,ends_at,work_days,
      monthly_hours,logged_hours,overtime_hours,absent_hours,payment_type,payment_rate,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, caregiverId, contractNumber, str(item.familyName || item.family) || "پرونده خدمت",
      str(item.serviceType || item.service) || null, contractStatus(item.status),
      parseContractDate(item.startsAt || item.start), parseContractDate(item.endsAt || item.end),
      JSON.stringify(Array.isArray(item.days) ? item.days : []), Number(item.monthlyHours || item.hours || 0),
      Number(item.loggedHours || item.logged || 0), Number(item.overtimeHours || item.overtime || 0),
      Number(item.absentHours || item.absent || 0), str(item.paymentType || item.type) || null,
      Number(item.paymentRate || item.rate || 0), str(item.createdAt) || timestamp, timestamp,
    ));
    imported += 1;
  }
  if (statements.length) await env.DB.batch(statements);
  return { imported, skipped: false };
}

export async function ensureBenefitsSchema(env: Env) {
  await ensureSchema(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS contract_insurance_records (
      contract_id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      insurance_enabled INTEGER NOT NULL DEFAULT 1,
      registration_status TEXT NOT NULL DEFAULT 'ESTIMATED',
      coverage_starts_at TEXT,
      coverage_ends_at TEXT,
      policy_number TEXT,
      note TEXT,
      updated_by_user_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
      FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_insurance_caregiver ON contract_insurance_records(caregiver_id,registration_status)"),
  ]);
}

function mergeIntervals(source: Interval[]) {
  const rows = source.filter((row) => isIsoDate(row.start) && isIsoDate(row.end) && row.start <= row.end)
    .sort((left, right) => left.start.localeCompare(right.start));
  const merged: Interval[] = [];
  for (const row of rows) {
    const previous = merged[merged.length - 1];
    if (!previous || dateValue(row.start) > dateValue(previous.end) + DAY_MS) merged.push({ ...row });
    else if (row.end > previous.end) previous.end = row.end;
  }
  return merged;
}

function resolveCaregiver(actor: AuthUser, requested: unknown) {
  if (actor.role.toUpperCase() === "CAREGIVER") return actor.caregiverId;
  return hasRole(actor, STAFF_ROLES) ? str(requested) || null : null;
}

function contractInterval(contract: ContractRow, today: string, insurance = false): Interval | null {
  const status = contractStatus(contract.status);
  if (!["ACTIVE", "COMPLETED"].includes(status)) return null;
  const start = insurance ? contract.coverageStartsAt || contract.startsAt : contract.startsAt;
  let end = insurance ? contract.coverageEndsAt || contract.endsAt : contract.endsAt;
  if (!start || start > today) return null;
  if (!end) {
    if (status !== "ACTIVE") return null;
    end = today;
  }
  if (end > today) end = today;
  return end >= start ? { start, end } : null;
}

export async function getFinancialBenefits(request: Request, env: Env, actor: AuthUser) {
  await ensureBenefitsSchema(env);
  const migration = await importLegacyContracts(env);
  const url = new URL(request.url);
  const caregiverId = resolveCaregiver(actor, url.searchParams.get("caregiverId"));
  if (!caregiverId) return fail("پرونده مراقب برای محاسبه اعتبار پیدا نشد.", 403, "benefits_forbidden");
  const caregiver = await env.DB.prepare("SELECT id,membership_code AS membershipCode,full_name AS fullName FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId).first<Record<string, unknown>>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  const result = await env.DB.prepare(`SELECT
    c.id,c.caregiver_id AS caregiverId,c.contract_number AS contractNumber,c.family_name AS familyName,
    c.service_type AS serviceType,c.status,c.starts_at AS startsAt,c.ends_at AS endsAt,
    i.insurance_enabled AS insuranceEnabled,i.registration_status AS insuranceStatus,
    i.coverage_starts_at AS coverageStartsAt,i.coverage_ends_at AS coverageEndsAt,
    i.policy_number AS policyNumber,i.note AS insuranceNote
    FROM contracts c LEFT JOIN contract_insurance_records i ON i.contract_id=c.id
    WHERE c.caregiver_id=? ORDER BY c.starts_at,c.created_at`).bind(caregiverId).all<ContractRow>();
  const contracts = result.results || [];
  const today = new Date().toISOString().slice(0, 10);

  const serviceIntervals = mergeIntervals(contracts.map((contract) => contractInterval(contract, today)).filter((row): row is Interval => Boolean(row)));
  const cumulativeDays = serviceIntervals.reduce((sum, row) => sum + daysInclusive(row.start, row.end), 0);
  const longestDays = serviceIntervals.reduce((maximum, row) => Math.max(maximum, daysInclusive(row.start, row.end)), 0);
  const activeInterval = serviceIntervals.find((row) => row.start <= today && row.end >= today) || null;
  const currentContinuousDays = activeInterval ? daysInclusive(activeInterval.start, today) : 0;
  const eligibleContinuous = longestDays >= CONTINUOUS_TARGET_DAYS;
  const eligibleCumulative = cumulativeDays >= CUMULATIVE_TARGET_DAYS;
  const eligible = eligibleContinuous || eligibleCumulative;
  const remainingContinuousDays = Math.max(0, CONTINUOUS_TARGET_DAYS - currentContinuousDays);
  const remainingCumulativeDays = Math.max(0, CUMULATIVE_TARGET_DAYS - cumulativeDays);
  const runningRemaining = activeInterval ? Math.min(remainingContinuousDays, remainingCumulativeDays) : Math.min(
    Math.max(0, CONTINUOUS_TARGET_DAYS - longestDays), remainingCumulativeDays,
  );
  const projectedEligibilityDate = eligible ? today : activeInterval ? addDays(today, Math.max(0, runningRemaining - 1)) : null;

  const insuranceContracts = contracts.filter((contract) => contract.insuranceEnabled !== 0 && String(contract.insuranceStatus || "ESTIMATED").toUpperCase() !== "EXCLUDED");
  const insuranceIntervals = mergeIntervals(insuranceContracts.map((contract) => contractInterval(contract, today, true)).filter((row): row is Interval => Boolean(row)));
  const insuranceDays = insuranceIntervals.reduce((sum, row) => sum + daysInclusive(row.start, row.end), 0);
  const confirmedIntervals = mergeIntervals(insuranceContracts
    .filter((contract) => String(contract.insuranceStatus || "").toUpperCase() === "CONFIRMED")
    .map((contract) => contractInterval(contract, today, true)).filter((row): row is Interval => Boolean(row)));
  const confirmedDays = confirmedIntervals.reduce((sum, row) => sum + daysInclusive(row.start, row.end), 0);
  const insuranceActive = insuranceIntervals.some((row) => row.start <= today && row.end >= today);

  const contractDetails = contracts.map((contract) => {
    const service = contractInterval(contract, today);
    const insured = contract.insuranceEnabled !== 0 && String(contract.insuranceStatus || "ESTIMATED").toUpperCase() !== "EXCLUDED";
    const insurance = insured ? contractInterval(contract, today, true) : null;
    const serviceDays = service ? daysInclusive(service.start, service.end) : 0;
    const insuranceContributionDays = insurance ? daysInclusive(insurance.start, insurance.end) : 0;
    return {
      id: contract.id, contractNumber: contract.contractNumber, familyName: contract.familyName,
      serviceType: contract.serviceType, status: contractStatus(contract.status), startsAt: contract.startsAt,
      endsAt: contract.endsAt, serviceDays, serviceDuration: monthParts(serviceDays),
      insurance: {
        enabled: insured, status: String(contract.insuranceStatus || "ESTIMATED").toUpperCase(),
        startsAt: insurance?.start || contract.coverageStartsAt || contract.startsAt,
        endsAt: insurance?.end || contract.coverageEndsAt || contract.endsAt,
        contributionDays: insuranceContributionDays, duration: monthParts(insuranceContributionDays),
        policyNumber: contract.policyNumber, note: contract.insuranceNote,
      },
    };
  });

  await audit(request, env, actor, "READ_FINANCIAL_BENEFITS", "caregiver", caregiverId, {
    eligible, cumulativeDays, longestDays, insuranceDays,
  });
  return json({
    data: {
      caregiver,
      rules: {
        creditAmountToman: CREDIT_AMOUNT_TOMAN,
        continuousTargetMonths: 24,
        cumulativeTargetMonths: 36,
      },
      credit: {
        eligible, eligibleBy: eligibleContinuous ? "CONTINUOUS" : eligibleCumulative ? "CUMULATIVE" : null,
        status: eligible ? "ELIGIBLE" : activeInterval ? "IN_PROGRESS" : contracts.length ? "PAUSED" : "NO_CONTRACTS",
        amountToman: CREDIT_AMOUNT_TOMAN,
        progressPercent: Math.max(percent(longestDays, CONTINUOUS_TARGET_DAYS), percent(cumulativeDays, CUMULATIVE_TARGET_DAYS)),
        remainingActiveDays: eligible ? 0 : runningRemaining,
        projectedEligibilityDate,
        continuous: {
          longestDays, currentDays: currentContinuousDays, duration: monthParts(longestDays),
          currentDuration: monthParts(currentContinuousDays), targetDays: CONTINUOUS_TARGET_DAYS,
          progressPercent: percent(longestDays, CONTINUOUS_TARGET_DAYS),
          remainingDays: Math.max(0, CONTINUOUS_TARGET_DAYS - longestDays), active: Boolean(activeInterval),
        },
        cumulative: {
          days: cumulativeDays, duration: monthParts(cumulativeDays), targetDays: CUMULATIVE_TARGET_DAYS,
          progressPercent: percent(cumulativeDays, CUMULATIVE_TARGET_DAYS), remainingDays: remainingCumulativeDays,
        },
      },
      insurance: {
        active: insuranceActive, totalDays: insuranceDays, duration: monthParts(insuranceDays),
        confirmedDays, confirmedDuration: monthParts(confirmedDays),
        estimatedDays: Math.max(0, insuranceDays - confirmedDays),
      },
      contracts: contractDetails,
      reconciliation: migration,
      calculatedAt: nowIso(),
    },
  });
}

export async function updateContractInsurance(request: Request, env: Env, actor: AuthUser, contractId: string) {
  if (!hasRole(actor, STAFF_ROLES)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  await ensureBenefitsSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات بیمه معتبر نیست.");
  const contract = await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,starts_at AS startsAt,ends_at AS endsAt FROM contracts WHERE id=? LIMIT 1")
    .bind(contractId).first<{ id: string; caregiverId: string; startsAt: string | null; endsAt: string | null }>();
  if (!contract) return fail("قرارداد پیدا نشد.", 404, "contract_not_found");
  const registrationStatus = str(body.registrationStatus || "CONFIRMED").toUpperCase();
  if (!["ESTIMATED", "CONFIRMED", "EXCLUDED"].includes(registrationStatus)) return fail("وضعیت سابقه بیمه معتبر نیست.");
  const coverageStartsAt = str(body.coverageStartsAt) || contract.startsAt;
  const coverageEndsAt = str(body.coverageEndsAt) || contract.endsAt;
  if (coverageStartsAt && !isIsoDate(coverageStartsAt)) return fail("تاریخ شروع بیمه معتبر نیست.");
  if (coverageEndsAt && !isIsoDate(coverageEndsAt)) return fail("تاریخ پایان بیمه معتبر نیست.");
  if (coverageStartsAt && coverageEndsAt && coverageStartsAt > coverageEndsAt) return fail("بازه بیمه معتبر نیست.");
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO contract_insurance_records(
    contract_id,caregiver_id,insurance_enabled,registration_status,coverage_starts_at,coverage_ends_at,
    policy_number,note,updated_by_user_id,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(contract_id) DO UPDATE SET
    insurance_enabled=excluded.insurance_enabled,registration_status=excluded.registration_status,
    coverage_starts_at=excluded.coverage_starts_at,coverage_ends_at=excluded.coverage_ends_at,
    policy_number=excluded.policy_number,note=excluded.note,updated_by_user_id=excluded.updated_by_user_id,
    updated_at=excluded.updated_at`).bind(
      contract.id, contract.caregiverId, body.insuranceEnabled === false ? 0 : 1, registrationStatus,
      coverageStartsAt || null, coverageEndsAt || null, str(body.policyNumber) || null,
      str(body.note) || null, actor.id, timestamp,
    ).run();
  await audit(request, env, actor, "UPDATE_CONTRACT_INSURANCE", "contract", contract.id, {
    registrationStatus, coverageStartsAt, coverageEndsAt,
  });
  return json({ data: { contractId: contract.id, registrationStatus, updatedAt: timestamp } });
}
