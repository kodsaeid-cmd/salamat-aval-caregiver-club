import { type Env, fail, getUser, json } from "./lib";
import { jobAdWeekdaysOrDefault } from "../shared/job-ad-weekday-policy-v1";

const DAY_MS = 86_400_000;
const POINT_SCALE = 100;

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const unitsToPoints = (value: unknown) => round2(Number(value || 0) / POINT_SCALE);

function conditionLabel(contractType: unknown, condition: unknown) {
  const key = `${String(contractType || "").toUpperCase()}:${String(condition || "").toUpperCase()}`;
  return ({
    "ELDERLY:HEALTHY": "سالم",
    "ELDERLY:WALKER": "واکری",
    "ELDERLY:DIAPER": "پوشکی",
    "ELDERLY:BEDPAN": "لگنی",
    "ELDERLY:GAVAGE": "گاواژ",
    "ELDERLY:PARKINSON": "پارکینسون",
    "ELDERLY:ALZHEIMER": "آلزایمر",
    "CHILD:MOTHER_ASSISTANT": "مادریار",
    "CHILD:CHILD_CARE": "کودکیار",
    "HOUSEKEEPING:HOUSEHOLD": "امور منزل",
  } as Record<string, string>)[key] || "";
}

async function safePoints(env: Env, caregiverId: string) {
  const legacy = await env.DB.prepare(
    "SELECT COALESCE(SUM(points),0) AS points,COUNT(*) AS contracts FROM caregiver_contract_point_ledger WHERE caregiver_id=?",
  ).bind(caregiverId).first<{ points: number; contracts: number }>().catch((error) => {
    console.error("caregiver_job_bank_legacy_points_read_failed", { caregiverId, error: String(error) });
    return null;
  });

  const daily = await env.DB.prepare(
    "SELECT COALESCE(SUM(points_units),0) AS units,COUNT(DISTINCT contract_id) AS contracts FROM caregiver_contract_point_daily_ledger WHERE caregiver_id=?",
  ).bind(caregiverId).first<{ units: number; contracts: number }>().catch((error) => {
    console.error("caregiver_job_bank_daily_points_read_failed", { caregiverId, error: String(error) });
    return null;
  });

  const legacyPoints = round2(Number(legacy?.points || 0));
  const dailyEarnedPoints = unitsToPoints(daily?.units || 0);
  const totalPoints = round2(legacyPoints + dailyEarnedPoints);
  const thresholds = [200, 400, 600, 800];
  const nextThreshold = thresholds.find((value) => totalPoints < value) || 800;
  return {
    totalPoints,
    awardedContracts: Number(legacy?.contracts || 0) + Number(daily?.contracts || 0),
    legacyPoints,
    dailyEarnedPoints,
    nextThreshold,
    remainingToNext: round2(Math.max(0, nextThreshold - totalPoints)),
    maxThreshold: 800,
    progressPercent: round2(Math.min(100, totalPoints / 800 * 100)),
  };
}

async function readActiveContract(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT
    c.id,c.ad_id AS adId,c.application_id AS applicationId,c.started_at AS startedAt,
    c.scheduled_end_at AS scheduledEndAt,c.duration_days AS durationDays,
    c.total_points_units AS totalPointsUnits,c.earned_points_units AS earnedPointsUnits,
    c.last_reconciled_day AS lastReconciledDay,c.status,c.points_model AS pointsModel,
    c.welcome_seen_at AS welcomeSeenAt,
    a.customer_full_name AS customerFullName,a.city,a.region,a.contract_type AS contractType,
    a.shift_type AS shiftType,a.caregiver_salary_rial AS caregiverSalaryRial,
    a.description,a.recipient_condition AS recipientCondition,a.points_mode AS pointsMode,
    u.full_name AS salesConsultantName
    FROM caregiver_job_contracts c
    LEFT JOIN care_job_ads a ON a.id=c.ad_id
    LEFT JOIN users u ON u.id=a.sales_consultant_user_id
    WHERE c.caregiver_id=? AND c.status='ACTIVE'
    ORDER BY c.created_at DESC LIMIT 1`)
    .bind(caregiverId)
    .first<any>()
    .catch((error) => {
      console.error("caregiver_job_bank_active_contract_read_failed", { caregiverId, error: String(error) });
      return null;
    });
}

function presentReadOnlyContract(row: any) {
  const duration = Math.max(1, Number(row?.durationDays || 1));
  const started = Date.parse(String(row?.startedAt || ""));
  const now = Date.now();
  const elapsedMs = Number.isFinite(started) ? Math.max(0, now - started) : 0;
  const completed = clamp(Math.floor(elapsedMs / DAY_MS), 0, duration);
  const currentDay = completed >= duration ? duration : completed + 1;
  const partial = completed >= duration ? 1 : clamp((elapsedMs - completed * DAY_MS) / DAY_MS, 0, 1);
  const total = unitsToPoints(row?.totalPointsUnits);
  const earned = unitsToPoints(row?.earnedPointsUnits);
  const totalElapsed = clamp((completed + partial) / duration, 0, 1);
  const dayStartUnits = Math.floor(Number(row?.totalPointsUnits || 0) * completed / duration);
  const dayEndUnits = completed >= duration
    ? Number(row?.totalPointsUnits || 0)
    : Math.floor(Number(row?.totalPointsUnits || 0) * (completed + 1) / duration);
  const todayPotentialPoints = unitsToPoints(Math.max(0, dayEndUnits - dayStartUnits));
  const ad = row?.adId ? {
    id: row.adId,
    customerFullName: row.customerFullName || null,
    city: row.city || null,
    region: row.region || null,
    contractType: row.contractType || null,
    shiftType: row.shiftType || null,
    caregiverSalaryRial: Number(row.caregiverSalaryRial || 0),
    durationDays: duration,
    contractPoints: total,
    description: row.description || "",
    recipientCondition: row.recipientCondition || null,
    recipientConditionLabel: conditionLabel(row.contractType, row.recipientCondition),
    pointsMode: row.pointsMode || null,
    salesConsultantName: row.salesConsultantName || null,
  } : null;

  return {
    id: row.id,
    adId: row.adId,
    applicationId: row.applicationId,
    status: row.status,
    pointsModel: row.pointsModel,
    startedAt: row.startedAt,
    scheduledEndAt: row.scheduledEndAt,
    durationDays: duration,
    completedDays: completed,
    currentDay,
    remainingDays: Math.max(0, duration - completed),
    totalPoints: total,
    earnedPoints: earned,
    remainingPoints: round2(Math.max(0, total - earned)),
    earnedProgressPercent: total > 0 ? round2(clamp(earned / total * 100, 0, 100)) : 0,
    contractProgressPercent: round2(totalElapsed * 100),
    todayProgressPercent: round2(partial * 100),
    todayPotentialPoints,
    nextAwardAt: completed >= duration || !Number.isFinite(started)
      ? null
      : new Date(started + (completed + 1) * DAY_MS).toISOString(),
    welcomePending: false,
    ad,
  };
}

function normalizeAd(row: any) {
  const myApplication = row.myApplicationId ? {
    id: String(row.myApplicationId),
    status: String(row.myApplicationStatus || ""),
    appliedAt: row.myApplicationAppliedAt || null,
  } : null;
  return {
    id: row.id,
    customerFullName: row.customerFullName,
    salesConsultantUserId: row.salesConsultantUserId,
    salesConsultantName: row.salesConsultantName,
    city: row.city,
    region: row.region,
    contractType: row.contractType,
    shiftType: row.shiftType,
    caregiverSalaryRial: Number(row.caregiverSalaryRial || 0),
    durationDays: Number(row.durationDays || 0),
    contractPoints: Number(row.contractPoints || 0),
    description: row.description || "",
    status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    recipientCondition: row.recipientCondition || null,
    recipientConditionLabel: conditionLabel(row.contractType, row.recipientCondition),
    autoContractPoints: row.autoContractPoints == null ? null : Number(row.autoContractPoints),
    pointsMode: row.pointsMode || null,
    pointsBasisDays: row.pointsBasisDays == null ? null : Number(row.pointsBasisDays),
    pointsBaseValue: row.pointsBaseValue == null ? null : Number(row.pointsBaseValue),
    heavyWeight: Number(row.heavyWeight || 0) === 1,
    workWeekdays: jobAdWeekdaysOrDefault(row.workWeekdaysJson),
    caregiverGender: String(row.caregiverGender || "").toUpperCase() || null,
    applicationCount: Number(row.applicationCount || 0),
    myApplication,
  };
}

async function readAds(env: Env, caregiverId: string, q: string) {
  const like = `%${q}%`;
  try {
    const rows = await env.DB.prepare(`SELECT
      a.id,a.customer_full_name AS customerFullName,a.sales_consultant_user_id AS salesConsultantUserId,
      u.full_name AS salesConsultantName,a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,
      a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,
      COALESCE(a.reward_points,a.contract_points) AS contractPoints,a.description,a.status,
      a.published_at AS publishedAt,a.created_at AS createdAt,a.updated_at AS updatedAt,
      a.recipient_condition AS recipientCondition,a.auto_contract_points AS autoContractPoints,
      a.points_mode AS pointsMode,a.points_basis_days AS pointsBasisDays,a.points_base_value AS pointsBaseValue,
      a.heavy_weight AS heavyWeight,a.work_weekdays_json AS workWeekdaysJson,
      a.required_caregiver_gender AS caregiverGender,
      (SELECT COUNT(*) FROM care_job_applications cnt WHERE cnt.ad_id=a.id) AS applicationCount,
      mine.id AS myApplicationId,mine.status AS myApplicationStatus,mine.applied_at AS myApplicationAppliedAt
      FROM care_job_ads a
      LEFT JOIN users u ON u.id=a.sales_consultant_user_id
      LEFT JOIN care_job_applications mine ON mine.ad_id=a.id AND mine.caregiver_id=?
      WHERE a.status='PUBLISHED' AND a.deleted_at IS NULL
        AND (mine.id IS NULL OR UPPER(COALESCE(mine.status,''))<>'REJECTED')
        AND (?='' OR a.customer_full_name LIKE ? OR a.description LIKE ? OR u.full_name LIKE ? OR a.city LIKE ? OR a.region LIKE ?)
      ORDER BY a.published_at DESC,a.created_at DESC
      LIMIT 150`)
      .bind(caregiverId, q, like, like, like, like, like)
      .all<any>();
    return (rows.results || []).map(normalizeAd);
  } catch (error) {
    console.error("caregiver_job_bank_primary_read_failed", { caregiverId, error: String(error) });
    try {
      const rows = await env.DB.prepare(`SELECT
        a.id,a.customer_full_name AS customerFullName,a.sales_consultant_user_id AS salesConsultantUserId,
        u.full_name AS salesConsultantName,a.city,a.region,a.contract_type AS contractType,a.shift_type AS shiftType,
        a.caregiver_salary_rial AS caregiverSalaryRial,a.duration_days AS durationDays,
        a.contract_points AS contractPoints,a.description,a.status,a.published_at AS publishedAt,
        a.created_at AS createdAt,a.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM care_job_applications cnt WHERE cnt.ad_id=a.id) AS applicationCount,
        mine.id AS myApplicationId,mine.status AS myApplicationStatus,mine.applied_at AS myApplicationAppliedAt
        FROM care_job_ads a
        LEFT JOIN users u ON u.id=a.sales_consultant_user_id
        LEFT JOIN care_job_applications mine ON mine.ad_id=a.id AND mine.caregiver_id=?
        WHERE a.status='PUBLISHED'
          AND (mine.id IS NULL OR UPPER(COALESCE(mine.status,''))<>'REJECTED')
          AND (?='' OR a.customer_full_name LIKE ? OR a.description LIKE ? OR u.full_name LIKE ? OR a.city LIKE ? OR a.region LIKE ?)
        ORDER BY a.published_at DESC,a.created_at DESC
        LIMIT 150`)
        .bind(caregiverId, q, like, like, like, like, like)
        .all<any>();
      return (rows.results || []).map((row: any) => normalizeAd({ ...row, workWeekdaysJson: null }));
    } catch (fallbackError) {
      console.error("caregiver_job_bank_fallback_read_failed", { caregiverId, error: String(fallbackError) });
      return [];
    }
  }
}

export async function routeCaregiverJobBankReadonlyV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method.toUpperCase() !== "GET" || url.pathname !== "/api/caregiver/job-ads") return null;

  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return fail("این مسیر مخصوص مراقبین است.", 403, "caregiver_only");
  }

  const caregiverId = actor.caregiverId;
  const points = await safePoints(env, caregiverId);
  const active = await readActiveContract(env, caregiverId);
  if (active) {
    return json({ data: { ads: [], activeContract: presentReadOnlyContract(active), locked: true, points } }, 200, { "x-salamat-job-bank-route": "readonly-v2" });
  }

  const q = String(url.searchParams.get("q") || "").trim();
  const ads = await readAds(env, caregiverId, q);
  return json({ data: { ads, activeContract: null, locked: false, points } }, 200, { "x-salamat-job-bank-route": "readonly-v2" });
}
