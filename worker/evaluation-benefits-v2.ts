import { getFinancialBenefits } from "./benefits";
import { type AuthUser, type Env, json } from "./lib";

const DAY_MS = 86_400_000;
const BENEFITS_VERSION = "2.0.0";

type JsonRecord = Record<string, unknown>;
type Interval = { start: string; end: string };
type EvaluationRow = {
  id: string;
  startDate: string | null;
  endDate: string | null;
  finalScore: number;
  finalizedAt: string | null;
};
type BenefitRule = {
  key: string;
  type: "ALLOWANCE" | "LOAN";
  title: string;
  amountToman: number;
  serviceMode: "CONTINUOUS" | "CUMULATIVE";
  targetMonths: number;
  targetDays: number;
  scoreMode: "AVERAGE" | "MINIMUM";
  comparison: "GTE" | "GT";
  scoreThreshold: number;
};

type BenefitAssessment = BenefitRule & {
  eligible: boolean;
  status: "ELIGIBLE" | "IN_PROGRESS" | "PAUSED" | "NO_CONTRACTS" | "WAITING_EVALUATION" | "SCORE_BELOW_THRESHOLD";
  serviceDays: number;
  serviceDuration: { months: number; days: number };
  progressPercent: number;
  remainingDays: number;
  projectedEligibilityDate: string | null;
  evaluation: {
    count: number;
    averageScore: number | null;
    minimumScore: number | null;
    latestScore: number | null;
    metric: number | null;
    metricMode: "AVERAGE" | "MINIMUM";
    threshold: number;
    comparison: "GTE" | "GT";
    passed: boolean;
    windowStart: string | null;
    windowEnd: string | null;
  };
};

const ALLOWANCE_RULE: BenefitRule = {
  key: "ASSISTANCE_2M",
  type: "ALLOWANCE",
  title: "کمک‌هزینه ماندگاری دوماهه",
  amountToman: 7_000_000,
  serviceMode: "CONTINUOUS",
  targetMonths: 2,
  targetDays: 60,
  scoreMode: "MINIMUM",
  comparison: "GTE",
  scoreThreshold: 50,
};

const LOAN_RULES: BenefitRule[] = [
  {
    key: "LOAN_3M",
    type: "LOAN",
    title: "وام سه‌ماهه",
    amountToman: 7_000_000,
    serviceMode: "CONTINUOUS",
    targetMonths: 3,
    targetDays: 90,
    scoreMode: "AVERAGE",
    comparison: "GTE",
    scoreThreshold: 50,
  },
  {
    key: "LOAN_6M",
    type: "LOAN",
    title: "وام شش‌ماهه",
    amountToman: 12_000_000,
    serviceMode: "CONTINUOUS",
    targetMonths: 6,
    targetDays: 180,
    scoreMode: "AVERAGE",
    comparison: "GT",
    scoreThreshold: 60,
  },
  {
    key: "LOAN_12M",
    type: "LOAN",
    title: "وام دوازده‌ماهه",
    amountToman: 50_000_000,
    serviceMode: "CONTINUOUS",
    targetMonths: 12,
    targetDays: 365,
    scoreMode: "AVERAGE",
    comparison: "GT",
    scoreThreshold: 65,
  },
  {
    key: "LOAN_24M",
    type: "LOAN",
    title: "وام بیست‌وچهارماهه",
    amountToman: 300_000_000,
    serviceMode: "CONTINUOUS",
    targetMonths: 24,
    targetDays: 730,
    scoreMode: "AVERAGE",
    comparison: "GT",
    scoreThreshold: 70,
  },
  {
    key: "LOAN_70M_CUMULATIVE",
    type: "LOAN",
    title: "وام وفاداری سابقه تجمیعی",
    amountToman: 500_000_000,
    serviceMode: "CUMULATIVE",
    targetMonths: 70,
    targetDays: 2_100,
    scoreMode: "AVERAGE",
    comparison: "GTE",
    scoreThreshold: 65,
  },
];

const dateValue = (value: string) => Date.parse(`${value}T00:00:00Z`);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => isoDate(new Date(dateValue(value) + days * DAY_MS));
const daysInclusive = (start: string, end: string) => Math.max(0, Math.floor((dateValue(end) - dateValue(start)) / DAY_MS) + 1);
const monthParts = (days: number) => ({ months: Math.floor(days / 30), days: days % 30 });
const percent = (value: number, target: number) => Math.min(100, Math.round((Math.max(0, value) / target) * 1_000) / 10);

function mergeIntervals(source: Interval[]) {
  const rows = source
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.start) && /^\d{4}-\d{2}-\d{2}$/.test(row.end) && row.start <= row.end)
    .sort((left, right) => left.start.localeCompare(right.start));
  const merged: Interval[] = [];
  for (const row of rows) {
    const previous = merged.at(-1);
    if (!previous || dateValue(row.start) > dateValue(previous.end) + DAY_MS) merged.push({ ...row });
    else if (row.end > previous.end) previous.end = row.end;
  }
  return merged;
}

function serviceIntervals(contracts: JsonRecord[], today: string) {
  const intervals: Interval[] = [];
  for (const contract of contracts) {
    const status = String(contract.status || "").toUpperCase();
    if (!["ACTIVE", "COMPLETED"].includes(status)) continue;
    const start = String(contract.startsAt || "");
    let end = String(contract.endsAt || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start > today) continue;
    if (!end) {
      if (status !== "ACTIVE") continue;
      end = today;
    }
    if (end > today) end = today;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start) intervals.push({ start, end });
  }
  return mergeIntervals(intervals);
}

function evaluationDate(row: EvaluationRow) {
  const candidate = row.endDate || row.finalizedAt?.slice(0, 10) || row.startDate || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function evaluationStats(rows: EvaluationRow[], start?: string | null, end?: string | null, intervals?: Interval[]) {
  const selected = rows.filter((row) => {
    const date = evaluationDate(row);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (intervals?.length && !intervals.some((interval) => date >= interval.start && date <= interval.end)) return false;
    return true;
  });
  if (!selected.length) return { count: 0, averageScore: null, minimumScore: null, latestScore: null };
  const scores = selected.map((row) => Number(row.finalScore)).filter(Number.isFinite);
  if (!scores.length) return { count: 0, averageScore: null, minimumScore: null, latestScore: null };
  const averageScore = Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;
  const minimumScore = Math.min(...scores);
  const latest = [...selected].sort((left, right) => String(evaluationDate(right) || "").localeCompare(String(evaluationDate(left) || "")))[0];
  return { count: scores.length, averageScore, minimumScore, latestScore: Number(latest.finalScore) };
}

function passes(value: number | null, rule: BenefitRule) {
  if (value === null || !Number.isFinite(value)) return false;
  return rule.comparison === "GT" ? value > rule.scoreThreshold : value >= rule.scoreThreshold;
}

function preferredContinuousInterval(intervals: Interval[], targetDays: number, today: string) {
  const qualifying = intervals.filter((interval) => daysInclusive(interval.start, interval.end) >= targetDays);
  const activeQualifying = qualifying.find((interval) => interval.start <= today && interval.end >= today);
  if (activeQualifying) return { interval: activeQualifying, tenureMet: true };
  if (qualifying.length) return { interval: [...qualifying].sort((left, right) => right.end.localeCompare(left.end))[0], tenureMet: true };
  const active = intervals.find((interval) => interval.start <= today && interval.end >= today);
  if (active) return { interval: active, tenureMet: false };
  const longest = [...intervals].sort((left, right) => daysInclusive(right.start, right.end) - daysInclusive(left.start, left.end))[0] || null;
  return { interval: longest, tenureMet: false };
}

function assessContinuous(rule: BenefitRule, intervals: Interval[], evaluations: EvaluationRow[], today: string, hasContracts: boolean): BenefitAssessment {
  const selected = preferredContinuousInterval(intervals, rule.targetDays, today);
  const interval = selected.interval;
  const serviceDays = interval ? daysInclusive(interval.start, interval.end) : 0;
  const windowEnd = interval?.end || null;
  const candidateStart = windowEnd ? addDays(windowEnd, -(rule.targetDays - 1)) : null;
  const windowStart = interval && candidateStart ? (candidateStart < interval.start ? interval.start : candidateStart) : null;
  const stats = evaluationStats(evaluations, windowStart, windowEnd);
  const metric = rule.scoreMode === "MINIMUM" ? stats.minimumScore : stats.averageScore;
  const scorePassed = passes(metric, rule);
  const eligible = selected.tenureMet && scorePassed;
  const active = Boolean(interval && interval.start <= today && interval.end >= today);
  const remainingDays = selected.tenureMet ? 0 : Math.max(0, rule.targetDays - serviceDays);
  let status: BenefitAssessment["status"];
  if (eligible) status = "ELIGIBLE";
  else if (selected.tenureMet && !stats.count) status = "WAITING_EVALUATION";
  else if (selected.tenureMet && !scorePassed) status = "SCORE_BELOW_THRESHOLD";
  else if (active) status = "IN_PROGRESS";
  else status = hasContracts ? "PAUSED" : "NO_CONTRACTS";
  return {
    ...rule,
    eligible,
    status,
    serviceDays,
    serviceDuration: monthParts(serviceDays),
    progressPercent: percent(serviceDays, rule.targetDays),
    remainingDays,
    projectedEligibilityDate: !selected.tenureMet && active ? addDays(today, Math.max(0, remainingDays - 1)) : null,
    evaluation: {
      ...stats,
      metric,
      metricMode: rule.scoreMode,
      threshold: rule.scoreThreshold,
      comparison: rule.comparison,
      passed: scorePassed,
      windowStart,
      windowEnd,
    },
  };
}

function assessCumulative(rule: BenefitRule, intervals: Interval[], evaluations: EvaluationRow[], today: string, hasContracts: boolean): BenefitAssessment {
  const cumulativeDays = intervals.reduce((sum, interval) => sum + daysInclusive(interval.start, interval.end), 0);
  const stats = evaluationStats(evaluations, null, null, intervals);
  const metric = rule.scoreMode === "MINIMUM" ? stats.minimumScore : stats.averageScore;
  const scorePassed = passes(metric, rule);
  const tenureMet = cumulativeDays >= rule.targetDays;
  const eligible = tenureMet && scorePassed;
  const active = intervals.some((interval) => interval.start <= today && interval.end >= today);
  const remainingDays = Math.max(0, rule.targetDays - cumulativeDays);
  let status: BenefitAssessment["status"];
  if (eligible) status = "ELIGIBLE";
  else if (tenureMet && !stats.count) status = "WAITING_EVALUATION";
  else if (tenureMet && !scorePassed) status = "SCORE_BELOW_THRESHOLD";
  else if (active) status = "IN_PROGRESS";
  else status = hasContracts ? "PAUSED" : "NO_CONTRACTS";
  return {
    ...rule,
    eligible,
    status,
    serviceDays: cumulativeDays,
    serviceDuration: monthParts(cumulativeDays),
    progressPercent: percent(cumulativeDays, rule.targetDays),
    remainingDays,
    projectedEligibilityDate: !tenureMet && active ? addDays(today, Math.max(0, remainingDays - 1)) : null,
    evaluation: {
      ...stats,
      metric,
      metricMode: rule.scoreMode,
      threshold: rule.scoreThreshold,
      comparison: rule.comparison,
      passed: scorePassed,
      windowStart: intervals[0]?.start || null,
      windowEnd: intervals.at(-1)?.end || null,
    },
  };
}

async function finalizedEvaluations(env: Env, caregiverId: string) {
  try {
    const result = await env.DB.prepare(`SELECT id,start_date AS startDate,end_date AS endDate,
      final_score AS finalScore,finalized_at AS finalizedAt
      FROM caregiver_evaluation_periods
      WHERE caregiver_id=? AND status='FINAL' AND final_score IS NOT NULL
      ORDER BY COALESCE(end_date,substr(finalized_at,1,10),start_date),finalized_at`)
      .bind(caregiverId).all<EvaluationRow>();
    return (result.results || []).map((row) => ({ ...row, finalScore: Number(row.finalScore) })).filter((row) => Number.isFinite(row.finalScore));
  } catch (error) {
    console.warn("Evaluation benefits could not read finalized evaluation periods", error);
    return [];
  }
}

export async function getFinancialBenefitsV2(request: Request, env: Env, actor: AuthUser) {
  const baseResponse = await getFinancialBenefits(request, env, actor);
  if (!baseResponse.ok) return baseResponse;
  const payload = await baseResponse.clone().json().catch(() => null) as { data?: JsonRecord } | null;
  if (!payload?.data) return baseResponse;

  const data = payload.data;
  const caregiver = data.caregiver as JsonRecord | undefined;
  const caregiverId = String(caregiver?.id || "");
  if (!caregiverId) return baseResponse;
  const contracts = Array.isArray(data.contracts) ? data.contracts as JsonRecord[] : [];
  const today = String(data.calculatedAt || new Date().toISOString()).slice(0, 10);
  const intervals = serviceIntervals(contracts, today);
  const evaluations = await finalizedEvaluations(env, caregiverId);
  const allStats = evaluationStats(evaluations, null, null, intervals.length ? intervals : undefined);

  const allowance = assessContinuous(ALLOWANCE_RULE, intervals, evaluations, today, contracts.length > 0);
  const loans = LOAN_RULES.map((rule) => rule.serviceMode === "CUMULATIVE"
    ? assessCumulative(rule, intervals, evaluations, today, contracts.length > 0)
    : assessContinuous(rule, intervals, evaluations, today, contracts.length > 0));

  const eligibleLoans = loans.filter((loan) => loan.eligible).sort((left, right) => right.amountToman - left.amountToman);
  const selectedLoan = eligibleLoans[0] || loans.find((loan) => !loan.eligible) || loans.at(-1)!;
  const legacyCredit = data.credit as JsonRecord | undefined;

  data.benefitsVersion = BENEFITS_VERSION;
  data.evaluation = {
    finalizedPeriods: evaluations.length,
    servicePeriodCount: allStats.count,
    averageScore: allStats.averageScore,
    minimumScore: allStats.minimumScore,
    latestScore: allStats.latestScore,
    source: "caregiver_evaluation_periods:FINAL",
  };
  data.allowance = allowance;
  data.loans = loans;
  data.rules = {
    ...(data.rules as JsonRecord || {}),
    assistanceAmountToman: ALLOWANCE_RULE.amountToman,
    assistanceTargetMonths: ALLOWANCE_RULE.targetMonths,
    continuousTargetMonths: 24,
    cumulativeTargetMonths: 70,
    creditAmountToman: 500_000_000,
    loanTiers: LOAN_RULES.map((rule) => ({
      key: rule.key,
      amountToman: rule.amountToman,
      serviceMode: rule.serviceMode,
      targetMonths: rule.targetMonths,
      scoreMode: rule.scoreMode,
      comparison: rule.comparison,
      scoreThreshold: rule.scoreThreshold,
    })),
  };
  data.credit = {
    ...(legacyCredit || {}),
    eligible: selectedLoan.eligible,
    eligibleBy: selectedLoan.serviceMode,
    status: selectedLoan.status,
    amountToman: selectedLoan.amountToman,
    progressPercent: selectedLoan.progressPercent,
    remainingActiveDays: selectedLoan.remainingDays,
    projectedEligibilityDate: selectedLoan.projectedEligibilityDate,
    selectedTier: selectedLoan.key,
    scoreMetric: selectedLoan.evaluation.metric,
    scoreThreshold: selectedLoan.scoreThreshold,
  };

  return json({ data });
}
