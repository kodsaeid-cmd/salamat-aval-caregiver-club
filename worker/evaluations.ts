import {
  type AuthUser, type Env, type JsonObject, audit, ensureSchema, fail, hasRole, json,
  nowIso, randomId, readBody, str,
} from "./lib";

const POLICY_VERSION = "SAB-BB-1405-V2.0";
const SCORING_ROLES = ["ADMIN", "HR", "EVALUATOR"];
const READING_ROLES = ["ADMIN", "HR", "EVALUATOR", "RECRUITER", "SUPPORT", "OPERATIONS", "EDUCATION"];

const INDICATORS = [
  {
    code: "Q-01",
    title: "کیفیت ارائه خدمات",
    sources: "گزارش سوپروایزر، عملیات و نظارت",
    criteria: ["انجام کامل شرح وظایف", "رعایت برنامه مراقبتی", "دقت در انجام امور", "گزارش‌دهی صحیح", "پیشگیری از خطاهای مراقبتی"],
  },
  {
    code: "Q-02",
    title: "رضایت خدمت‌گیرنده و خانواده",
    sources: "نظرسنجی خانواده، CRM، شکایات و تقدیرها",
    criteria: ["امتیاز نظرسنجی", "تمدید قرارداد", "تقدیر ثبت‌شده", "عدم وجود شکایت مؤثر"],
  },
  {
    code: "Q-03",
    title: "رعایت کرامت و حقوق خدمت‌گیرنده",
    sources: "گزارش نظارت، بازدید میدانی و شکایات",
    criteria: ["حفظ احترام و شأن فرد", "رعایت حریم خصوصی", "رعایت محرمانگی اطلاعات", "رعایت استقلال فرد در تصمیم‌گیری", "پرهیز از رفتار تحقیرآمیز یا تبعیض‌آمیز"],
  },
  {
    code: "Q-04",
    title: "اخلاق و رفتار حرفه‌ای",
    sources: "گزارش عملیات، سوپروایزر و واحد ارزیابی",
    criteria: ["صداقت", "احترام", "مسئولیت‌پذیری", "رعایت پوشش سازمانی", "ارتباط حرفه‌ای با خانواده و همکاران"],
  },
  {
    code: "Q-05",
    title: "انضباط شغلی",
    sources: "حضور و غیاب، تأخیر، غیبت و نظم اداری",
    criteria: ["حضور به‌موقع", "رعایت برنامه کاری", "اعلام به‌موقع غیبت", "رعایت مقررات سازمان"],
  },
  {
    code: "Q-06",
    title: "رعایت استانداردهای سلامت اول",
    sources: "چک‌لیست استانداردهای خدمت",
    criteria: ["رعایت دستورالعمل‌های سازمان", "تکمیل صحیح مستندات", "رعایت الزامات ایمنی", "رعایت فرآیندهای خدمت"],
  },
  {
    code: "Q-07",
    title: "همکاری سازمانی",
    sources: "گزارش همکاری واحدها",
    criteria: ["پاسخ‌گویی مناسب", "همکاری با واحد عملیات", "همکاری با سوپروایزر", "مشارکت در حل مسائل پرونده"],
  },
  {
    code: "Q-08",
    title: "توسعه حرفه‌ای و آموزشی",
    sources: "سوابق آموزش، آزمون‌ها و بازآموزی",
    criteria: ["حضور در آموزش‌ها", "قبولی در آزمون‌ها", "مشارکت در انتقال تجربه", "به‌روزرسانی دانش حرفه‌ای"],
  },
] as const;

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
  updatedAt: string;
};

type CriterionDefinitionRow = {
  code: string;
  indicatorCode: string;
  title: string;
  sortOrder: number;
};

type IndicatorDefinitionRow = {
  code: string;
  title: string;
  sources: string;
  sortOrder: number;
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const criterionCode = (indicatorCode: string, index: number) => `${indicatorCode}-${String(index + 1).padStart(2, "0")}`;

export async function ensureEvaluationSchema(env: Env) {
  await ensureSchema(env);
  const schemaStatements: D1PreparedStatement[] = [
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_indicator_definitions (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sources TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_criterion_definitions (
      code TEXT PRIMARY KEY,
      indicator_code TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(indicator_code) REFERENCES evaluation_indicator_definitions(code)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_evaluation_periods (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      policy_version TEXT NOT NULL,
      final_score REAL,
      created_by_user_id TEXT NOT NULL,
      finalized_by_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finalized_at TEXT,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by_user_id) REFERENCES users(id),
      FOREIGN KEY(finalized_by_user_id) REFERENCES users(id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_evaluation_scores (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      criterion_code TEXT NOT NULL,
      score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      note TEXT,
      scored_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(evaluation_id, criterion_code),
      FOREIGN KEY(evaluation_id) REFERENCES caregiver_evaluation_periods(id) ON DELETE CASCADE,
      FOREIGN KEY(criterion_code) REFERENCES evaluation_criterion_definitions(code),
      FOREIGN KEY(scored_by_user_id) REFERENCES users(id)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_periods_caregiver ON caregiver_evaluation_periods(caregiver_id,created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_scores_period ON caregiver_evaluation_scores(evaluation_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_criteria_indicator ON evaluation_criterion_definitions(indicator_code,sort_order)"),
  ];
  await env.DB.batch(schemaStatements);

  const timestamp = nowIso();
  const seedStatements: D1PreparedStatement[] = [];
  INDICATORS.forEach((indicator, indicatorIndex) => {
    seedStatements.push(env.DB.prepare(`INSERT INTO evaluation_indicator_definitions(code,title,sources,sort_order,active,created_at,updated_at)
      VALUES(?,?,?,?,1,?,?)
      ON CONFLICT(code) DO UPDATE SET title=excluded.title,sources=excluded.sources,sort_order=excluded.sort_order,active=1,updated_at=excluded.updated_at`)
      .bind(indicator.code, indicator.title, indicator.sources, indicatorIndex + 1, timestamp, timestamp));
    indicator.criteria.forEach((title, criterionIndex) => {
      seedStatements.push(env.DB.prepare(`INSERT INTO evaluation_criterion_definitions(code,indicator_code,title,sort_order,active,created_at,updated_at)
        VALUES(?,?,?,?,1,?,?)
        ON CONFLICT(code) DO UPDATE SET indicator_code=excluded.indicator_code,title=excluded.title,sort_order=excluded.sort_order,active=1,updated_at=excluded.updated_at`)
        .bind(criterionCode(indicator.code, criterionIndex), indicator.code, title, criterionIndex + 1, timestamp, timestamp));
    });
  });
  await env.DB.batch(seedStatements);
}

function canRead(actor: AuthUser, caregiverId: string) {
  return hasRole(actor, READING_ROLES) || (actor.role.toUpperCase() === "CAREGIVER" && actor.caregiverId === caregiverId);
}

function canScore(actor: AuthUser) {
  return hasRole(actor, SCORING_ROLES);
}

async function caregiverExists(env: Env, caregiverId: string) {
  return env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first<{ id: string }>();
}

async function createPeriodRecord(
  env: Env,
  actor: AuthUser,
  caregiverId: string,
  title = "دوره ارزیابی جاری",
  startDate: string | null = null,
  endDate: string | null = null,
) {
  const timestamp = nowIso();
  const id = randomId("ev_");
  await env.DB.prepare(`INSERT INTO caregiver_evaluation_periods(
    id,caregiver_id,title,start_date,end_date,status,policy_version,created_by_user_id,created_at,updated_at
  ) VALUES(?,?,?,?,?,'DRAFT',?,?,?,?)`)
    .bind(id, caregiverId, title, startDate, endDate, POLICY_VERSION, actor.id, timestamp, timestamp).run();
  return id;
}

async function definitions(env: Env) {
  const [indicatorResult, criterionResult] = await Promise.all([
    env.DB.prepare(`SELECT code,title,sources,sort_order AS sortOrder
      FROM evaluation_indicator_definitions WHERE active=1 ORDER BY sort_order`).all<IndicatorDefinitionRow>(),
    env.DB.prepare(`SELECT code,indicator_code AS indicatorCode,title,sort_order AS sortOrder
      FROM evaluation_criterion_definitions WHERE active=1 ORDER BY indicator_code,sort_order`).all<CriterionDefinitionRow>(),
  ]);
  return {
    indicators: indicatorResult.results || [],
    criteria: criterionResult.results || [],
  };
}

async function periodRows(env: Env, caregiverId: string) {
  const result = await env.DB.prepare(`SELECT
    p.id,p.caregiver_id AS caregiverId,c.membership_code AS membershipCode,c.full_name AS caregiverName,
    p.title,p.start_date AS startDate,p.end_date AS endDate,p.status,p.policy_version AS policyVersion,
    p.final_score AS finalScore,p.created_at AS createdAt,p.updated_at AS updatedAt,p.finalized_at AS finalizedAt
    FROM caregiver_evaluation_periods p JOIN caregivers c ON c.id=p.caregiver_id
    WHERE p.caregiver_id=? ORDER BY p.created_at DESC`).bind(caregiverId).all<PeriodRow>();
  return result.results || [];
}

async function scoreRows(env: Env, evaluationId: string) {
  const result = await env.DB.prepare(`SELECT
    s.evaluation_id AS evaluationId,d.indicator_code AS indicatorCode,s.criterion_code AS criterionCode,
    s.score,s.note,s.updated_at AS updatedAt
    FROM caregiver_evaluation_scores s JOIN evaluation_criterion_definitions d ON d.code=s.criterion_code
    WHERE s.evaluation_id=? ORDER BY d.indicator_code,d.sort_order`).bind(evaluationId).all<ScoreRow>();
  return result.results || [];
}

function buildEvaluation(period: PeriodRow, catalog: Awaited<ReturnType<typeof definitions>>, scores: ScoreRow[]) {
  const scoreMap = new Map(scores.map((row) => [row.criterionCode, row]));
  const indicators = catalog.indicators.map((indicator) => {
    const criteria = catalog.criteria.filter((criterion) => criterion.indicatorCode === indicator.code).map((criterion) => {
      const saved = scoreMap.get(criterion.code);
      return {
        code: criterion.code,
        title: criterion.title,
        score: saved?.score ?? null,
        note: saved?.note ?? "",
        updatedAt: saved?.updatedAt ?? null,
      };
    });
    const scored = criteria.filter((criterion) => criterion.score !== null);
    const liveScore = scored.length ? round1(scored.reduce((sum, criterion) => sum + Number(criterion.score), 0) / scored.length * 20) : null;
    const complete = scored.length === criteria.length && criteria.length > 0;
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
  const calculatedFinalScore = completedIndicators.length === indicators.length && indicators.length > 0
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
  };
}

async function loadEvaluation(env: Env, caregiverId: string, evaluationId?: string | null) {
  const catalog = await definitions(env);
  const periods = await periodRows(env, caregiverId);
  const selected = evaluationId ? periods.find((period) => period.id === evaluationId) : periods[0];
  if (!selected) return { periods, evaluation: null, catalog };
  const scores = await scoreRows(env, selected.id);
  return { periods, evaluation: buildEvaluation(selected, catalog, scores), catalog };
}

export async function getCaregiverEvaluation(request: Request, env: Env, actor: AuthUser) {
  await ensureEvaluationSchema(env);
  const url = new URL(request.url);
  const caregiverId = str(url.searchParams.get("caregiverId")) || str(actor.caregiverId);
  const evaluationId = str(url.searchParams.get("evaluationId")) || null;
  if (!caregiverId) return fail("شناسه مراقب ارسال نشده است.", 400, "caregiver_required");
  if (!canRead(actor, caregiverId)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  if (!await caregiverExists(env, caregiverId)) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  let result = await loadEvaluation(env, caregiverId, evaluationId);
  if (!result.evaluation && canScore(actor)) {
    const periodId = await createPeriodRecord(env, actor, caregiverId);
    result = await loadEvaluation(env, caregiverId, periodId);
    await audit(request, env, actor, "CREATE_EVALUATION_PERIOD", "caregiver_evaluation", periodId, { caregiverId, automatic: true });
  }
  return json({ status: "ok", data: result });
}

export async function createEvaluationPeriod(request: Request, env: Env, actor: AuthUser) {
  await ensureEvaluationSchema(env);
  if (!canScore(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  if (!body) return fail("اطلاعات دوره معتبر نیست.");
  const caregiverId = str(body.caregiverId);
  if (!caregiverId || !await caregiverExists(env, caregiverId)) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  const title = str(body.title) || "دوره ارزیابی جدید";
  const periodId = await createPeriodRecord(env, actor, caregiverId, title, str(body.startDate) || null, str(body.endDate) || null);
  await audit(request, env, actor, "CREATE_EVALUATION_PERIOD", "caregiver_evaluation", periodId, { caregiverId, title });
  const result = await loadEvaluation(env, caregiverId, periodId);
  return json({ status: "ok", data: result }, 201);
}

export async function saveIndicatorScores(
  request: Request,
  env: Env,
  actor: AuthUser,
  evaluationId: string,
  indicatorCode: string,
) {
  await ensureEvaluationSchema(env);
  if (!canScore(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const period = await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,status FROM caregiver_evaluation_periods WHERE id=? LIMIT 1")
    .bind(evaluationId).first<{ id: string; caregiverId: string; status: string }>();
  if (!period) return fail("دوره ارزیابی پیدا نشد.", 404, "evaluation_not_found");
  if (period.status === "FINAL") return fail("ارزیابی نهایی‌شده قابل ویرایش نیست.", 409, "evaluation_locked");

  const body = await readBody(request);
  const submitted = Array.isArray(body?.scores) ? body?.scores as JsonObject[] : [];
  if (!submitted.length) return fail("حداقل یک امتیاز ارسال کنید.");
  const criteriaResult = await env.DB.prepare(`SELECT code FROM evaluation_criterion_definitions
    WHERE indicator_code=? AND active=1 ORDER BY sort_order`).bind(indicatorCode).all<{ code: string }>();
  const validCodes = new Set((criteriaResult.results || []).map((row) => row.code));
  if (!validCodes.size) return fail("شاخص ارزیابی معتبر نیست.", 404, "indicator_not_found");

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (const item of submitted) {
    const code = str(item.criterionCode);
    const score = Number(item.score);
    if (!validCodes.has(code)) return fail(`معیار ${code || "نامشخص"} متعلق به این شاخص نیست.`, 400, "invalid_criterion");
    if (!Number.isInteger(score) || score < 1 || score > 5) return fail("امتیاز هر معیار باید عدد صحیح بین ۱ تا ۵ باشد.", 400, "invalid_score");
    statements.push(env.DB.prepare(`INSERT INTO caregiver_evaluation_scores(
      id,evaluation_id,criterion_code,score,note,scored_by_user_id,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(evaluation_id,criterion_code) DO UPDATE SET
      score=excluded.score,note=excluded.note,scored_by_user_id=excluded.scored_by_user_id,updated_at=excluded.updated_at`)
      .bind(randomId("evs_"), evaluationId, code, score, str(item.note) || null, actor.id, timestamp, timestamp));
  }
  statements.push(env.DB.prepare("UPDATE caregiver_evaluation_periods SET updated_at=? WHERE id=?").bind(timestamp, evaluationId));
  await env.DB.batch(statements);
  await audit(request, env, actor, "SAVE_EVALUATION_INDICATOR", "caregiver_evaluation", evaluationId, {
    caregiverId: period.caregiverId,
    indicatorCode,
    scores: submitted.map((item) => ({ criterionCode: str(item.criterionCode), score: Number(item.score) })),
  });
  const result = await loadEvaluation(env, period.caregiverId, evaluationId);
  return json({ status: "ok", data: result });
}

function professionalLevel(score: number) {
  if (score >= 90) return "ممتاز";
  if (score >= 80) return "ارشد";
  if (score >= 70) return "حرفه‌ای";
  if (score >= 60) return "پایه";
  return "مشروط";
}

export async function finalizeEvaluation(request: Request, env: Env, actor: AuthUser, evaluationId: string) {
  await ensureEvaluationSchema(env);
  if (!canScore(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const period = await env.DB.prepare("SELECT caregiver_id AS caregiverId,status FROM caregiver_evaluation_periods WHERE id=? LIMIT 1")
    .bind(evaluationId).first<{ caregiverId: string; status: string }>();
  if (!period) return fail("دوره ارزیابی پیدا نشد.", 404, "evaluation_not_found");
  if (period.status === "FINAL") return fail("این ارزیابی قبلاً نهایی شده است.", 409, "already_final");
  const loaded = await loadEvaluation(env, period.caregiverId, evaluationId);
  const score = loaded.evaluation?.calculatedFinalScore;
  if (score === null || score === undefined) return fail("برای نهایی‌سازی باید تمام معیارهای هر هشت شاخص امتیاز داشته باشند.", 409, "evaluation_incomplete");
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(`UPDATE caregiver_evaluation_periods SET status='FINAL',final_score=?,finalized_by_user_id=?,finalized_at=?,updated_at=? WHERE id=?`)
      .bind(score, actor.id, timestamp, timestamp, evaluationId),
    env.DB.prepare("UPDATE caregivers SET professional_score=?,professional_level=?,updated_at=? WHERE id=?")
      .bind(score, professionalLevel(score), timestamp, period.caregiverId),
  ]);
  await audit(request, env, actor, "FINALIZE_EVALUATION", "caregiver_evaluation", evaluationId, {
    caregiverId: period.caregiverId,
    finalScore: score,
  });
  return json({ status: "ok", data: await loadEvaluation(env, period.caregiverId, evaluationId) });
}

export async function enrichStateEvaluations(env: Env, state: JsonObject) {
  await ensureEvaluationSchema(env);
  const evaluationState = state.evaluation && typeof state.evaluation === "object" ? state.evaluation as JsonObject : {};
  const caregivers = Array.isArray(evaluationState.caregivers) ? evaluationState.caregivers as JsonObject[] : [];
  const periodResult = await env.DB.prepare(`SELECT
    p.id,p.caregiver_id AS caregiverId,c.membership_code AS membershipCode,c.full_name AS caregiverName,
    p.title,p.start_date AS startDate,p.end_date AS endDate,p.status,p.policy_version AS policyVersion,
    p.final_score AS finalScore,p.created_at AS createdAt,p.updated_at AS updatedAt,p.finalized_at AS finalizedAt
    FROM caregiver_evaluation_periods p JOIN caregivers c ON c.id=p.caregiver_id ORDER BY p.created_at DESC`).all<PeriodRow>();
  const catalog = await definitions(env);
  const projectedPeriods: JsonObject[] = [];
  for (const row of periodResult.results || []) {
    const scores = await scoreRows(env, row.id);
    const built = buildEvaluation(row, catalog, scores);
    const localCaregiverId = row.membershipCode || row.caregiverId;
    projectedPeriods.push({
      id: row.id,
      caregiverId: localCaregiverId,
      backendCaregiverId: row.caregiverId,
      policyVersion: row.policyVersion,
      title: row.title,
      start: row.startDate || "",
      end: row.endDate || "",
      status: row.status === "FINAL" ? "نهایی" : "پیش‌نویس",
      assessor: "کارشناس ارزیابی",
      reviewer: "مسئول ارزیابی",
      criteria: Object.fromEntries(built.indicators.map((indicator) => [indicator.code, {
        code: indicator.code,
        title: indicator.title,
        score: indicator.complete ? indicator.score : null,
        liveScore: indicator.liveScore,
        status: indicator.complete ? "تکمیل" : indicator.scoredCount ? "در حال تکمیل" : "نیازمند بررسی تکمیلی",
        notes: `${indicator.scoredCount} از ${indicator.criteriaCount} معیار امتیازدهی شده`,
        evidence: [],
        updatedAt: row.updatedAt,
      }])),
      createdAt: row.createdAt,
      finalizedAt: row.finalizedAt,
      finalScore: row.status === "FINAL" ? row.finalScore : built.calculatedFinalScore,
    });
    const caregiver = caregivers.find((item) => [str(item.backendId), str(item.id), str(item.membershipCode)].includes(row.caregiverId)
      || [str(item.id), str(item.membershipCode)].includes(localCaregiverId));
    if (caregiver && row.status === "FINAL" && row.finalScore !== null) {
      const rank = caregiver.rank && typeof caregiver.rank === "object" ? caregiver.rank as JsonObject : {};
      rank.pri = row.finalScore;
      rank.title = professionalLevel(Number(row.finalScore));
      caregiver.rank = rank;
    }
  }
  const legacyPeriods = Array.isArray(evaluationState.periods) ? evaluationState.periods as JsonObject[] : [];
  const projectedIds = new Set(projectedPeriods.map((period) => str(period.id)));
  evaluationState.periods = [...projectedPeriods, ...legacyPeriods.filter((period) => !projectedIds.has(str(period.id)))];
  evaluationState.indicatorCatalog = INDICATORS.map((indicator) => ({
    code: indicator.code,
    title: indicator.title,
    sources: indicator.sources,
    criteria: indicator.criteria.map((title, index) => ({ code: criterionCode(indicator.code, index), title })),
  }));
  state.evaluation = evaluationState;
  return state;
}
