import {
  type AuthUser,
  type Env,
  type JsonObject,
  audit,
  fail,
  json,
  nowIso,
  randomId,
  readBody,
  str,
} from "./lib";
import {
  ensureEvaluationDataProtection,
  prepareFinalEvaluationSnapshot,
} from "./evaluation-data-protection";

const POLICY_VERSION = "SAB-BB-1405-V2.0";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

type IndicatorDefinitionRow = {
  code: string;
  title: string;
  sources: string;
  sortOrder: number;
};

type CriterionDefinitionRow = {
  code: string;
  indicatorCode: string;
  title: string;
  sortOrder: number;
};

type PeriodRow = {
  id: string;
  caregiverId: string;
  membershipCode: string | null;
  caregiverName: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  policyVersion: string;
  finalScore: number | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};

type ScoreRow = {
  evaluationId: string;
  indicatorCode: string;
  criterionCode: string;
  score: number;
  note: string | null;
  scoredByUserId: string;
  scoredByName: string | null;
  scoredByRole: string | null;
  createdAt: string;
  updatedAt: string;
};

type Catalog = {
  indicators: IndicatorDefinitionRow[];
  criteria: CriterionDefinitionRow[];
};

let catalogCache: { expiresAt: number; value: Catalog } | null = null;

const round1 = (value: number) => Math.round(value * 10) / 10;
const isAdmin = (actor: AuthUser) => actor.role.toUpperCase() === "ADMIN";
const isStaff = (actor: AuthUser) => actor.role.toUpperCase() !== "CAREGIVER";

async function definitions(env: Env): Promise<Catalog> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.value;
  const [indicatorResult, criterionResult] = await Promise.all([
    env.DB.prepare(`SELECT code,title,sources,sort_order AS sortOrder
      FROM evaluation_indicator_definitions
      WHERE active=1 ORDER BY sort_order`).all<IndicatorDefinitionRow>(),
    env.DB.prepare(`SELECT code,indicator_code AS indicatorCode,title,sort_order AS sortOrder
      FROM evaluation_criterion_definitions
      WHERE active=1 ORDER BY indicator_code,sort_order`).all<CriterionDefinitionRow>(),
  ]);
  const value = {
    indicators: indicatorResult.results || [],
    criteria: criterionResult.results || [],
  };
  catalogCache = { expiresAt: Date.now() + CATALOG_CACHE_TTL_MS, value };
  return value;
}

async function caregiverExists(env: Env, caregiverId: string) {
  return env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId)
    .first<{ id: string }>();
}

async function caregiverAvailableForNewEvaluation(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT id FROM caregivers
    WHERE id=? AND deleted_at IS NULL AND active=1 LIMIT 1`)
    .bind(caregiverId)
    .first<{ id: string }>();
}

async function periodRows(env: Env, caregiverId: string) {
  const result = await env.DB.prepare(`SELECT
      p.id,p.caregiver_id AS caregiverId,c.membership_code AS membershipCode,
      c.full_name AS caregiverName,p.title,p.start_date AS startDate,p.end_date AS endDate,
      p.status,p.policy_version AS policyVersion,p.final_score AS finalScore,
      p.created_at AS createdAt,p.updated_at AS updatedAt,p.finalized_at AS finalizedAt
    FROM caregiver_evaluation_periods p
    JOIN caregivers c ON c.id=p.caregiver_id
    WHERE p.caregiver_id=?
    ORDER BY CASE WHEN p.status='DRAFT' THEN 0 ELSE 1 END,p.created_at DESC`)
    .bind(caregiverId)
    .all<PeriodRow>();
  return result.results || [];
}

async function scoreRows(env: Env, evaluationId: string) {
  const result = await env.DB.prepare(`SELECT
      s.evaluation_id AS evaluationId,d.indicator_code AS indicatorCode,
      s.criterion_code AS criterionCode,s.score,s.note,
      s.scored_by_user_id AS scoredByUserId,u.full_name AS scoredByName,u.role AS scoredByRole,
      s.created_at AS createdAt,s.updated_at AS updatedAt
    FROM caregiver_evaluation_scores s
    JOIN evaluation_criterion_definitions d ON d.code=s.criterion_code
    LEFT JOIN users u ON u.id=s.scored_by_user_id
    WHERE s.evaluation_id=?
    ORDER BY d.indicator_code,d.sort_order`)
    .bind(evaluationId)
    .all<ScoreRow>();
  return result.results || [];
}

function buildEvaluation(period: PeriodRow, catalog: Catalog, scores: ScoreRow[], includeAudit: boolean) {
  const scoreMap = new Map(scores.map((row) => [row.criterionCode, row]));
  const indicators = catalog.indicators.map((indicator) => {
    const criteria = catalog.criteria
      .filter((criterion) => criterion.indicatorCode === indicator.code)
      .map((criterion) => {
        const saved = scoreMap.get(criterion.code);
        return {
          code: criterion.code,
          title: criterion.title,
          score: saved?.score ?? null,
          note: saved?.note ?? "",
          ...(includeAudit && saved
            ? {
                scoredBy: {
                  userId: saved.scoredByUserId,
                  fullName: saved.scoredByName || "کاربر سازمانی",
                  role: saved.scoredByRole || "",
                  createdAt: saved.createdAt,
                  updatedAt: saved.updatedAt,
                },
              }
            : {}),
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
      sources: indicator.sources,
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
  return {
    ...period,
    indicators,
    totalCriteria: indicators.reduce((sum, indicator) => sum + indicator.criteriaCount, 0),
    scoredCriteria: indicators.reduce((sum, indicator) => sum + indicator.scoredCount, 0),
    completedIndicators: completedIndicators.length,
    liveOverallScore,
    calculatedFinalScore,
    auditVisible: includeAudit,
  };
}

async function loadEvaluation(
  env: Env,
  caregiverId: string,
  evaluationId: string | null,
  includeAudit: boolean,
) {
  const [catalog, periods] = await Promise.all([definitions(env), periodRows(env, caregiverId)]);
  const selected = evaluationId
    ? periods.find((period) => period.id === evaluationId)
    : periods[0];
  if (!selected) return { periods, evaluation: null, catalog, auditVisible: includeAudit };
  const scores = await scoreRows(env, selected.id);
  return {
    periods,
    evaluation: buildEvaluation(selected, catalog, scores, includeAudit),
    catalog,
    auditVisible: includeAudit,
  };
}

async function createPeriodRecord(
  env: Env,
  actor: AuthUser,
  caregiverId: string,
  title: string,
  startDate: string | null,
  endDate: string | null,
) {
  const timestamp = nowIso();
  const id = randomId("ev_");
  await env.DB.prepare(`INSERT INTO caregiver_evaluation_periods(
      id,caregiver_id,title,start_date,end_date,status,policy_version,
      created_by_user_id,created_at,updated_at
    ) VALUES(?,?,?,?,?,'DRAFT',?,?,?,?)`)
    .bind(id, caregiverId, title, startDate, endDate, POLICY_VERSION, actor.id, timestamp, timestamp)
    .run();
  return id;
}

function professionalLevel(score: number) {
  if (score >= 90) return "ممتاز";
  if (score >= 80) return "ارشد";
  if (score >= 70) return "حرفه‌ای";
  if (score >= 60) return "پایه";
  return "مشروط";
}

export async function getCaregiverEvaluationV2(request: Request, env: Env, actor: AuthUser) {
  await ensureEvaluationDataProtection(env);
  if (!isStaff(actor)) return fail("این مسیر مخصوص کاربران سازمانی است.", 403, "staff_only");
  const url = new URL(request.url);
  const caregiverId = str(url.searchParams.get("caregiverId"));
  const evaluationId = str(url.searchParams.get("evaluationId")) || null;
  if (!caregiverId) return fail("شناسه مراقب ارسال نشده است.", 400, "caregiver_required");
  if (!await caregiverExists(env, caregiverId)) {
    return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  }
  return json({
    status: "ok",
    data: await loadEvaluation(env, caregiverId, evaluationId, isAdmin(actor)),
  });
}

export async function createEvaluationPeriodV2(request: Request, env: Env, actor: AuthUser) {
  await ensureEvaluationDataProtection(env);
  if (!isStaff(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات دوره معتبر نیست.");
  const caregiverId = str(body.caregiverId);
  if (!caregiverId || !await caregiverAvailableForNewEvaluation(env, caregiverId)) {
    return fail("پرونده مراقب فعال پیدا نشد.", 404, "caregiver_not_found");
  }
  const title = str(body.title) || "دوره ارزیابی جدید";
  const periodId = await createPeriodRecord(
    env,
    actor,
    caregiverId,
    title,
    str(body.startDate) || null,
    str(body.endDate) || null,
  );
  await audit(request, env, actor, "CREATE_EVALUATION_PERIOD", "caregiver_evaluation", periodId, {
    caregiverId,
    title,
  });
  return json({
    status: "ok",
    data: await loadEvaluation(env, caregiverId, periodId, isAdmin(actor)),
  }, 201);
}

export async function saveIndicatorScoresV2(
  request: Request,
  env: Env,
  actor: AuthUser,
  evaluationId: string,
  indicatorCode: string,
) {
  await ensureEvaluationDataProtection(env);
  if (!isStaff(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const period = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,status
    FROM caregiver_evaluation_periods WHERE id=? LIMIT 1`)
    .bind(evaluationId)
    .first<{ id: string; caregiverId: string; status: string }>();
  if (!period) return fail("دوره ارزیابی پیدا نشد.", 404, "evaluation_not_found");
  if (period.status === "FINAL") {
    return fail("ارزیابی نهایی‌شده قابل ویرایش نیست.", 409, "evaluation_locked");
  }
  const body = await readBody(request);
  const submitted = Array.isArray(body?.scores) ? body.scores as JsonObject[] : [];
  if (!submitted.length) return fail("حداقل یک امتیاز ارسال کنید.");
  const criteriaResult = await env.DB.prepare(`SELECT code FROM evaluation_criterion_definitions
    WHERE indicator_code=? AND active=1 ORDER BY sort_order`)
    .bind(indicatorCode)
    .all<{ code: string }>();
  const validCodes = new Set((criteriaResult.results || []).map((row) => row.code));
  if (!validCodes.size) return fail("شاخص ارزیابی معتبر نیست.", 404, "indicator_not_found");

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (const item of submitted) {
    const code = str(item.criterionCode);
    const score = Number(item.score);
    if (!validCodes.has(code)) {
      return fail(`معیار ${code || "نامشخص"} متعلق به این شاخص نیست.`, 400, "invalid_criterion");
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return fail("امتیاز هر معیار باید عدد صحیح بین ۱ تا ۵ باشد.", 400, "invalid_score");
    }
    statements.push(env.DB.prepare(`INSERT INTO caregiver_evaluation_scores(
        id,evaluation_id,criterion_code,score,note,scored_by_user_id,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(evaluation_id,criterion_code) DO UPDATE SET
        score=excluded.score,note=excluded.note,
        scored_by_user_id=excluded.scored_by_user_id,updated_at=excluded.updated_at`)
      .bind(
        randomId("evs_"),
        evaluationId,
        code,
        score,
        str(item.note) || null,
        actor.id,
        timestamp,
        timestamp,
      ));
  }
  statements.push(
    env.DB.prepare("UPDATE caregiver_evaluation_periods SET updated_at=? WHERE id=?")
      .bind(timestamp, evaluationId),
  );
  await env.DB.batch(statements);
  await audit(request, env, actor, "SAVE_EVALUATION_INDICATOR", "caregiver_evaluation", evaluationId, {
    caregiverId: period.caregiverId,
    indicatorCode,
    scores: submitted.map((item) => ({
      criterionCode: str(item.criterionCode),
      score: Number(item.score),
    })),
    revisionHistory: "append_only_database_trigger",
  });
  return json({
    status: "ok",
    data: await loadEvaluation(env, period.caregiverId, evaluationId, isAdmin(actor)),
  });
}

export async function finalizeEvaluationV2(
  request: Request,
  env: Env,
  actor: AuthUser,
  evaluationId: string,
) {
  await ensureEvaluationDataProtection(env);
  if (!isStaff(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const period = await env.DB.prepare(`SELECT caregiver_id AS caregiverId,status
    FROM caregiver_evaluation_periods WHERE id=? LIMIT 1`)
    .bind(evaluationId)
    .first<{ caregiverId: string; status: string }>();
  if (!period) return fail("دوره ارزیابی پیدا نشد.", 404, "evaluation_not_found");
  if (period.status === "FINAL") {
    return fail("این ارزیابی قبلاً نهایی شده است.", 409, "already_final");
  }
  const loaded = await loadEvaluation(env, period.caregiverId, evaluationId, true);
  const score = loaded.evaluation?.calculatedFinalScore;
  if (score === null || score === undefined) {
    return fail(
      "برای نهایی‌سازی باید تمام معیارهای هر هشت شاخص امتیاز داشته باشند.",
      409,
      "evaluation_incomplete",
    );
  }
  const timestamp = nowIso();
  const level = professionalLevel(Number(score));
  const snapshot = await prepareFinalEvaluationSnapshot(
    env,
    actor,
    evaluationId,
    Number(score),
    level,
    timestamp,
  );
  if (!snapshot) {
    return fail(
      "ساخت نسخه غیرقابل‌تغییر کارنامه انجام نشد؛ ارزیابی نهایی نشد.",
      503,
      "snapshot_creation_failed",
    );
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE caregiver_evaluation_periods
      SET status='FINAL',final_score=?,finalized_by_user_id=?,finalized_at=?,updated_at=?
      WHERE id=? AND status<>'FINAL'`)
      .bind(score, actor.id, timestamp, timestamp, evaluationId),
    env.DB.prepare(`UPDATE caregivers
      SET professional_score=?,professional_level=?,updated_at=? WHERE id=?`)
      .bind(score, level, timestamp, period.caregiverId),
    snapshot.statement,
  ]);
  await audit(request, env, actor, "FINALIZE_EVALUATION", "caregiver_evaluation", evaluationId, {
    caregiverId: period.caregiverId,
    finalScore: score,
    professionalLevel: level,
    immutableSnapshot: {
      id: snapshot.id,
      version: snapshot.version,
      sha256: snapshot.hash,
    },
  });
  return json({
    status: "ok",
    data: await loadEvaluation(env, period.caregiverId, evaluationId, isAdmin(actor)),
  });
}
