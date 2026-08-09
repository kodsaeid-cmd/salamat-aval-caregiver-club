import { requireAccess } from "./access-control";
import { ensureEvaluationDataProtection } from "./evaluation-data-protection";
import {
  type AuthUser,
  type Env,
  fail,
  getUser,
  json,
  securityHeaders,
  str,
} from "./lib";

type JsonRow = Record<string, unknown>;
type PeriodRow = {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  policyVersion: string | null;
  finalScore: number | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};
type IndicatorRow = {
  code: string;
  title: string;
  sources: string | null;
  sortOrder: number;
};
type CriterionRow = {
  code: string;
  indicatorCode: string;
  title: string;
  sortOrder: number;
};
type ScoreRow = {
  criterionCode: string;
  score: number;
  note: string | null;
  updatedAt: string;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

async function all<T>(env: Env, sql: string, bindings: unknown[] = []) {
  const result = await env.DB.prepare(sql).bind(...bindings).all<T>();
  return result.results || [];
}

async function safeCount(env: Env, sql: string, caregiverId: string) {
  try {
    const row = await env.DB.prepare(sql).bind(caregiverId).first<{ count: number }>();
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

function rankFor(score: number | null, complete: boolean) {
  if (score === null || !complete) {
    return { code: "", title: "در انتظار تکمیل ارزیابی", stars: 0 };
  }
  if (score >= 90) return { code: "R-1", title: "ممتاز", stars: 5 };
  if (score >= 80) return { code: "R-2", title: "ارشد", stars: 4 };
  if (score >= 70) return { code: "R-3", title: "حرفه‌ای", stars: 3 };
  if (score >= 60) return { code: "R-4", title: "پایه", stars: 2 };
  return { code: "R-5", title: "مشروط", stars: 1 };
}

function licenseNumber(membershipCode: unknown, caregiverId: unknown) {
  const source = str(membershipCode) || str(caregiverId);
  const match = source.match(/(\d{4})[-_](\d+)$/);
  if (match) return `SA-LIC-${match[1]}-${String(match[2]).padStart(4, "0")}`;
  const compact = source.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return compact ? `SA-LIC-${compact}` : "";
}

export async function loadScorecard(env: Env, caregiverId: string, evaluationId: string | null) {
  await ensureEvaluationDataProtection(env);

  const caregiver = await env.DB.prepare(`SELECT
      c.id,c.membership_code AS membershipCode,c.full_name AS fullName,
      c.national_id AS nationalId,c.mobile,c.city,c.primary_type AS serviceGroup,
      c.cooperation_status AS fileStatus,c.professional_level AS professionalLevel,
      c.professional_score AS professionalScore,c.license_status AS licenseStatus,
      c.birth_date AS birthDate,c.created_at AS createdAt,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    WHERE c.id=? AND (c.deleted_at IS NULL)
    LIMIT 1`).bind(caregiverId).first<JsonRow>();
  if (!caregiver) return null;

  const periods = await all<PeriodRow>(env, `SELECT
      id,title,start_date AS startDate,end_date AS endDate,status,
      policy_version AS policyVersion,final_score AS finalScore,
      created_at AS createdAt,updated_at AS updatedAt,finalized_at AS finalizedAt
    FROM caregiver_evaluation_periods
    WHERE caregiver_id=? AND archived_at IS NULL
    ORDER BY CASE status WHEN 'FINAL' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
      COALESCE(finalized_at,updated_at,created_at) DESC`, [caregiverId]);

  const selected = evaluationId
    ? periods.find((period) => period.id === evaluationId) || periods[0] || null
    : periods[0] || null;

  const [indicatorRows, criterionRows, scoreRows] = await Promise.all([
    all<IndicatorRow>(env, `SELECT code,title,sources,sort_order AS sortOrder
      FROM evaluation_indicator_definitions WHERE active=1 ORDER BY sort_order`),
    all<CriterionRow>(env, `SELECT code,indicator_code AS indicatorCode,title,
      sort_order AS sortOrder FROM evaluation_criterion_definitions
      WHERE active=1 ORDER BY indicator_code,sort_order`),
    selected
      ? all<ScoreRow>(env, `SELECT criterion_code AS criterionCode,score,note,
          updated_at AS updatedAt FROM caregiver_evaluation_scores
        WHERE evaluation_id=? ORDER BY criterion_code`, [selected.id])
      : Promise.resolve([]),
  ]);

  const scoreMap = new Map(scoreRows.map((row) => [row.criterionCode, row]));
  const indicators = indicatorRows.map((indicator) => {
    const criteria = criterionRows
      .filter((criterion) => criterion.indicatorCode === indicator.code)
      .map((criterion) => {
        const saved = scoreMap.get(criterion.code);
        return {
          code: criterion.code,
          title: criterion.title,
          score: saved?.score ?? null,
          note: saved?.note || "",
          updatedAt: saved?.updatedAt || null,
        };
      });
    const scored = criteria.filter((criterion) => criterion.score !== null);
    const liveScore = scored.length
      ? round1(scored.reduce((sum, criterion) => sum + Number(criterion.score), 0) / scored.length * 20)
      : null;
    const complete = criteria.length > 0 && scored.length === criteria.length;
    return {
      code: indicator.code,
      title: indicator.title,
      sources: indicator.sources || "",
      criteria,
      scoredCount: scored.length,
      criteriaCount: criteria.length,
      complete,
      liveScore,
      score: complete ? liveScore : null,
    };
  });

  const completedIndicators = indicators.filter((indicator) => indicator.complete);
  const liveIndicators = indicators.filter((indicator) => indicator.liveScore !== null);
  const liveOverallScore = liveIndicators.length
    ? round1(liveIndicators.reduce((sum, indicator) => sum + Number(indicator.liveScore), 0) / liveIndicators.length)
    : null;
  const calculatedFinalScore = indicators.length > 0 && completedIndicators.length === indicators.length
    ? round1(completedIndicators.reduce((sum, indicator) => sum + Number(indicator.score), 0) / indicators.length)
    : null;
  const official = selected?.status === "FINAL";
  const score = official && selected?.finalScore !== null && selected?.finalScore !== undefined
    ? Number(selected.finalScore)
    : calculatedFinalScore ?? liveOverallScore;
  const rank = rankFor(score, completedIndicators.length === indicators.length && official);

  const [contractsCount, trainingCount, completedTrainingCount] = await Promise.all([
    safeCount(env, "SELECT COUNT(*) AS count FROM contracts WHERE caregiver_id=? AND deleted_at IS NULL", caregiverId),
    safeCount(env, "SELECT COUNT(*) AS count FROM enrollments WHERE caregiver_id=?", caregiverId),
    safeCount(env, "SELECT COUNT(*) AS count FROM enrollments WHERE caregiver_id=? AND status='COMPLETED'", caregiverId),
  ]);

  const history = periods.map((period) => ({
    id: period.id,
    title: period.title,
    status: period.status,
    startDate: period.startDate,
    endDate: period.endDate,
    finalScore: period.finalScore,
    finalizedAt: period.finalizedAt,
    updatedAt: period.updatedAt,
  }));

  return {
    caregiver: {
      ...caregiver,
      avatarUrl: caregiver.avatarId
        ? `/api/profile-images/${encodeURIComponent(str(caregiver.avatarId))}`
        : null,
    },
    periods: history,
    selectedPeriod: selected,
    indicators,
    summary: {
      official,
      score,
      liveOverallScore,
      calculatedFinalScore,
      completedIndicators: completedIndicators.length,
      totalIndicators: indicators.length,
      scoredCriteria: indicators.reduce((sum, indicator) => sum + indicator.scoredCount, 0),
      totalCriteria: indicators.reduce((sum, indicator) => sum + indicator.criteriaCount, 0),
      notice: official
        ? "این کارنامه بر اساس دوره نهایی‌شده نمایش داده می‌شود."
        : "این کارنامه هنوز رسمی نیست و پس از نهایی‌شدن دوره ارزیابی رسمی خواهد شد.",
    },
    rank,
    license: {
      number: licenseNumber(caregiver.membershipCode, caregiver.id),
      status: str(caregiver.licenseStatus) || "ثبت نشده",
      professionalLevel: str(caregiver.professionalLevel) || "ارزیابی نشده",
    },
    records: {
      contractsCount,
      trainingCount,
      completedTrainingCount,
    },
    history,
    source: "server",
    version: "2.1.0",
  };
}

export async function routeCaregiverScorecardV2(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method.toUpperCase() !== "GET") return null;
  const caregiverSelf = url.pathname === "/api/caregiver/platform/scorecard-v2";
  const staffView = url.pathname === "/api/admin/caregiver-scorecard-v2";
  if (!caregiverSelf && !staffView) return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));

  let caregiverId = "";
  if (caregiverSelf) {
    if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
      return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only"));
    }
    caregiverId = actor.caregiverId;
  } else {
    const denied = await requireAccess(env, actor, "staff.caregivers", "view");
    if (denied) return denied;
    caregiverId = str(url.searchParams.get("caregiverId"));
    if (!caregiverId) return securityHeaders(fail("شناسه مراقب الزامی است.", 400, "caregiver_id_required"));
  }

  const data = await loadScorecard(env, caregiverId, str(url.searchParams.get("evaluationId")) || null);
  if (!data) return securityHeaders(fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found"));
  return securityHeaders(json({ status: "ok", data }));
}