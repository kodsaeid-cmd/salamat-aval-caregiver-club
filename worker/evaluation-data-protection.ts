import { ensureEvaluationSchema } from "./evaluations";
import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  json,
  nowIso,
  randomId,
  readBody,
  sha256,
  str,
} from "./lib";

export const EVALUATION_PROTECTION_SCHEMA_VERSION = "EVAL-PROTECT-1.0.0";
const DEFAULT_BACKFILL_LIMIT = 25;
let protectionReady: Promise<void> | undefined;
let lastMaintenanceAt = 0;

type ColumnRow = { name: string };
type CountRow = Record<string, number | string | null>;
type SnapshotPeriodRow = {
  id: string;
  caregiverId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  policyVersion: string;
  finalScore: number | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  finalizedByName: string | null;
  finalizedByRole: string | null;
};
type SnapshotCaregiverRow = {
  id: string;
  crmRecordId: string | null;
  membershipCode: string | null;
  nationalId: string | null;
  fullName: string;
  mobile: string | null;
  city: string | null;
  serviceRegion: string | null;
  primaryType: string | null;
  cooperationStatus: string | null;
  professionalLevel: string | null;
  professionalScore: number | null;
  licenseStatus: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
type SnapshotCriterionRow = {
  indicatorCode: string;
  indicatorTitle: string;
  indicatorSources: string;
  indicatorOrder: number;
  criterionCode: string;
  criterionTitle: string;
  criterionOrder: number;
  score: number | null;
  note: string | null;
  scoredByUserId: string | null;
  scoredByName: string | null;
  scoredByRole: string | null;
  scoredAt: string | null;
  updatedAt: string | null;
};

type PreparedSnapshot = {
  id: string;
  version: number;
  hash: string;
  payload: string;
  statement: D1PreparedStatement;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

async function ensureColumn(
  env: Env,
  table: "caregivers" | "caregiver_evaluation_periods",
  column: string,
  definition: string,
) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<ColumnRow>();
  if ((result.results || []).some((row) => row.name === column)) return;
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function protectionSchemaStatements(env: Env) {
  return [
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_score_revisions (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      caregiver_id TEXT NOT NULL,
      indicator_code TEXT NOT NULL,
      criterion_code TEXT NOT NULL,
      previous_score INTEGER,
      new_score INTEGER NOT NULL,
      previous_note TEXT,
      new_note TEXT,
      change_kind TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL,
      changed_by_name TEXT,
      changed_by_role TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_final_snapshots (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      caregiver_id TEXT NOT NULL,
      snapshot_version INTEGER NOT NULL,
      policy_version TEXT NOT NULL,
      final_score REAL NOT NULL,
      professional_level TEXT NOT NULL,
      caregiver_identity_json TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      snapshot_sha256 TEXT NOT NULL,
      finalized_by_user_id TEXT,
      finalized_by_name TEXT,
      finalized_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(evaluation_id,snapshot_version),
      UNIQUE(snapshot_sha256)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_archival_events (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      caregiver_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT,
      actor_role TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_archival_events (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      evaluation_count INTEGER NOT NULL DEFAULT 0,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT,
      actor_role TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS evaluation_data_protection_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_revisions_evaluation_created ON evaluation_score_revisions(evaluation_id,created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_revisions_caregiver_created ON evaluation_score_revisions(caregiver_id,created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_snapshots_evaluation_version ON evaluation_final_snapshots(evaluation_id,snapshot_version DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_eval_snapshots_caregiver_created ON evaluation_final_snapshots(caregiver_id,created_at DESC)"),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_revision_after_insert_v1
      AFTER INSERT ON caregiver_evaluation_scores
      BEGIN
        INSERT OR IGNORE INTO evaluation_score_revisions(
          id,evaluation_id,caregiver_id,indicator_code,criterion_code,
          previous_score,new_score,previous_note,new_note,change_kind,change_reason,
          changed_by_user_id,changed_by_name,changed_by_role,created_at
        )
        SELECT
          'rev_create_' || NEW.id,NEW.evaluation_id,p.caregiver_id,d.indicator_code,NEW.criterion_code,
          NULL,NEW.score,NULL,NEW.note,'CREATE','ثبت اولیه امتیاز',NEW.scored_by_user_id,
          u.full_name,u.role,NEW.created_at
        FROM caregiver_evaluation_periods p
        JOIN evaluation_criterion_definitions d ON d.code=NEW.criterion_code
        LEFT JOIN users u ON u.id=NEW.scored_by_user_id
        WHERE p.id=NEW.evaluation_id;
      END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_revision_after_update_v1
      AFTER UPDATE OF score,note,scored_by_user_id ON caregiver_evaluation_scores
      WHEN OLD.score IS NOT NEW.score OR OLD.note IS NOT NEW.note OR OLD.scored_by_user_id IS NOT NEW.scored_by_user_id
      BEGIN
        INSERT INTO evaluation_score_revisions(
          id,evaluation_id,caregiver_id,indicator_code,criterion_code,
          previous_score,new_score,previous_note,new_note,change_kind,change_reason,
          changed_by_user_id,changed_by_name,changed_by_role,created_at
        )
        SELECT
          'rev_' || lower(hex(randomblob(16))),NEW.evaluation_id,p.caregiver_id,d.indicator_code,NEW.criterion_code,
          OLD.score,NEW.score,OLD.note,NEW.note,'UPDATE','اصلاح امتیاز ارزیابی',NEW.scored_by_user_id,
          u.full_name,u.role,NEW.updated_at
        FROM caregiver_evaluation_periods p
        JOIN evaluation_criterion_definitions d ON d.code=NEW.criterion_code
        LEFT JOIN users u ON u.id=NEW.scored_by_user_id
        WHERE p.id=NEW.evaluation_id;
      END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_revision_no_update_v1
      BEFORE UPDATE ON evaluation_score_revisions
      BEGIN SELECT RAISE(ABORT,'evaluation_revision_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_revision_no_delete_v1
      BEFORE DELETE ON evaluation_score_revisions
      BEGIN SELECT RAISE(ABORT,'evaluation_revision_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_snapshot_no_update_v1
      BEFORE UPDATE ON evaluation_final_snapshots
      BEGIN SELECT RAISE(ABORT,'evaluation_snapshot_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_snapshot_no_delete_v1
      BEFORE DELETE ON evaluation_final_snapshots
      BEGIN SELECT RAISE(ABORT,'evaluation_snapshot_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_archive_event_no_update_v1
      BEFORE UPDATE ON evaluation_archival_events
      BEGIN SELECT RAISE(ABORT,'evaluation_archive_event_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_archive_event_no_delete_v1
      BEFORE DELETE ON evaluation_archival_events
      BEGIN SELECT RAISE(ABORT,'evaluation_archive_event_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_caregiver_archive_event_no_update_v1
      BEFORE UPDATE ON caregiver_archival_events
      BEGIN SELECT RAISE(ABORT,'caregiver_archive_event_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_caregiver_archive_event_no_delete_v1
      BEFORE DELETE ON caregiver_archival_events
      BEGIN SELECT RAISE(ABORT,'caregiver_archive_event_is_immutable'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_period_no_delete_v1
      BEFORE DELETE ON caregiver_evaluation_periods
      BEGIN SELECT RAISE(ABORT,'evaluation_period_delete_forbidden'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_score_no_delete_v1
      BEFORE DELETE ON caregiver_evaluation_scores
      BEGIN SELECT RAISE(ABORT,'evaluation_score_delete_forbidden'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_caregiver_no_hard_delete_v1
      BEFORE DELETE ON caregivers
      BEGIN SELECT RAISE(ABORT,'caregiver_hard_delete_forbidden'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_final_score_no_insert_v1
      BEFORE INSERT ON caregiver_evaluation_scores
      WHEN EXISTS(SELECT 1 FROM caregiver_evaluation_periods p WHERE p.id=NEW.evaluation_id AND p.status='FINAL')
      BEGIN SELECT RAISE(ABORT,'final_evaluation_is_locked'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_final_score_no_update_v1
      BEFORE UPDATE ON caregiver_evaluation_scores
      WHEN EXISTS(SELECT 1 FROM caregiver_evaluation_periods p WHERE p.id=NEW.evaluation_id AND p.status='FINAL')
      BEGIN SELECT RAISE(ABORT,'final_evaluation_is_locked'); END`),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_eval_final_period_immutable_v1
      BEFORE UPDATE ON caregiver_evaluation_periods
      WHEN OLD.status='FINAL' AND (
        NEW.caregiver_id IS NOT OLD.caregiver_id OR
        NEW.title IS NOT OLD.title OR
        NEW.start_date IS NOT OLD.start_date OR
        NEW.end_date IS NOT OLD.end_date OR
        NEW.status IS NOT OLD.status OR
        NEW.policy_version IS NOT OLD.policy_version OR
        NEW.final_score IS NOT OLD.final_score OR
        NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
        NEW.finalized_by_user_id IS NOT OLD.finalized_by_user_id OR
        NEW.finalized_at IS NOT OLD.finalized_at
      )
      BEGIN SELECT RAISE(ABORT,'final_evaluation_is_immutable'); END`),
  ];
}

async function seedRevisionBaseline(env: Env) {
  await env.DB.prepare(`INSERT OR IGNORE INTO evaluation_score_revisions(
      id,evaluation_id,caregiver_id,indicator_code,criterion_code,
      previous_score,new_score,previous_note,new_note,change_kind,change_reason,
      changed_by_user_id,changed_by_name,changed_by_role,created_at
    )
    SELECT
      'rev_baseline_' || s.id,s.evaluation_id,p.caregiver_id,d.indicator_code,s.criterion_code,
      NULL,s.score,NULL,s.note,'BASELINE','ثبت وضعیت موجود هنگام فعال‌سازی حفاظت داده',
      s.scored_by_user_id,u.full_name,u.role,s.created_at
    FROM caregiver_evaluation_scores s
    JOIN caregiver_evaluation_periods p ON p.id=s.evaluation_id
    JOIN evaluation_criterion_definitions d ON d.code=s.criterion_code
    LEFT JOIN users u ON u.id=s.scored_by_user_id
    WHERE NOT EXISTS(
      SELECT 1 FROM evaluation_score_revisions r WHERE r.evaluation_id=s.evaluation_id AND r.criterion_code=s.criterion_code
    )`).run();
}

export async function ensureEvaluationDataProtection(env: Env) {
  if (!protectionReady) {
    protectionReady = (async () => {
      await ensureSchema(env);
      await ensureEvaluationSchema(env);
      await ensureColumn(env, "caregivers", "deleted_at", "TEXT");
      await ensureColumn(env, "caregivers", "deleted_by_user_id", "TEXT");
      await ensureColumn(env, "caregivers", "deletion_reason", "TEXT");
      await ensureColumn(env, "caregiver_evaluation_periods", "archived_at", "TEXT");
      await ensureColumn(env, "caregiver_evaluation_periods", "archived_by_user_id", "TEXT");
      await ensureColumn(env, "caregiver_evaluation_periods", "archive_reason", "TEXT");
      await env.DB.batch(protectionSchemaStatements(env));
      await seedRevisionBaseline(env);
      await env.DB.prepare(`INSERT INTO evaluation_data_protection_meta(key,value,updated_at)
        VALUES('schema_version',?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
        .bind(EVALUATION_PROTECTION_SCHEMA_VERSION, nowIso())
        .run();
    })().catch((error) => {
      protectionReady = undefined;
      throw error;
    });
  }
  return protectionReady;
}

async function snapshotPeriod(env: Env, evaluationId: string) {
  return env.DB.prepare(`SELECT
      p.id,p.caregiver_id AS caregiverId,p.title,p.start_date AS startDate,p.end_date AS endDate,
      p.status,p.policy_version AS policyVersion,p.final_score AS finalScore,p.created_at AS createdAt,
      p.updated_at AS updatedAt,p.finalized_at AS finalizedAt,p.finalized_by_user_id AS finalizedByUserId,
      u.full_name AS finalizedByName,u.role AS finalizedByRole
    FROM caregiver_evaluation_periods p
    LEFT JOIN users u ON u.id=p.finalized_by_user_id
    WHERE p.id=? LIMIT 1`)
    .bind(evaluationId)
    .first<SnapshotPeriodRow>();
}

async function snapshotCaregiver(env: Env, caregiverId: string) {
  return env.DB.prepare(`SELECT
      id,crm_record_id AS crmRecordId,membership_code AS membershipCode,national_id AS nationalId,
      full_name AS fullName,mobile,city,service_region AS serviceRegion,primary_type AS primaryType,
      cooperation_status AS cooperationStatus,professional_level AS professionalLevel,
      professional_score AS professionalScore,license_status AS licenseStatus,
      created_at AS createdAt,updated_at AS updatedAt,deleted_at AS deletedAt
    FROM caregivers WHERE id=? LIMIT 1`)
    .bind(caregiverId)
    .first<SnapshotCaregiverRow>();
}

async function snapshotCriteria(env: Env, evaluationId: string) {
  const result = await env.DB.prepare(`SELECT
      i.code AS indicatorCode,i.title AS indicatorTitle,i.sources AS indicatorSources,i.sort_order AS indicatorOrder,
      c.code AS criterionCode,c.title AS criterionTitle,c.sort_order AS criterionOrder,
      s.score,s.note,s.scored_by_user_id AS scoredByUserId,u.full_name AS scoredByName,u.role AS scoredByRole,
      s.created_at AS scoredAt,s.updated_at AS updatedAt
    FROM evaluation_indicator_definitions i
    JOIN evaluation_criterion_definitions c ON c.indicator_code=i.code
    LEFT JOIN caregiver_evaluation_scores s ON s.criterion_code=c.code AND s.evaluation_id=?
    LEFT JOIN users u ON u.id=s.scored_by_user_id
    WHERE i.active=1 AND c.active=1
    ORDER BY i.sort_order,c.sort_order`)
    .bind(evaluationId)
    .all<SnapshotCriterionRow>();
  return result.results || [];
}

function groupedIndicators(rows: SnapshotCriterionRow[]) {
  const indicators = new Map<string, {
    code: string;
    title: string;
    sources: string;
    criteria: Array<Record<string, unknown>>;
  }>();
  for (const row of rows) {
    let indicator = indicators.get(row.indicatorCode);
    if (!indicator) {
      indicator = {
        code: row.indicatorCode,
        title: row.indicatorTitle,
        sources: row.indicatorSources,
        criteria: [],
      };
      indicators.set(row.indicatorCode, indicator);
    }
    indicator.criteria.push({
      code: row.criterionCode,
      title: row.criterionTitle,
      score: row.score,
      note: row.note || "",
      scoredBy: row.scoredByUserId ? {
        userId: row.scoredByUserId,
        fullName: row.scoredByName || "کاربر سازمانی",
        role: row.scoredByRole || "",
      } : null,
      scoredAt: row.scoredAt,
      updatedAt: row.updatedAt,
    });
  }
  return [...indicators.values()];
}

async function buildSnapshot(
  env: Env,
  evaluationId: string,
  override?: {
    finalScore: number;
    professionalLevel: string;
    finalizedAt: string;
    actor: AuthUser;
  },
): Promise<PreparedSnapshot | null> {
  const period = await snapshotPeriod(env, evaluationId);
  if (!period) return null;
  const caregiver = await snapshotCaregiver(env, period.caregiverId);
  if (!caregiver) return null;
  const rows = await snapshotCriteria(env, evaluationId);
  const versionRow = await env.DB.prepare(`SELECT COALESCE(MAX(snapshot_version),0) AS version
    FROM evaluation_final_snapshots WHERE evaluation_id=?`)
    .bind(evaluationId)
    .first<{ version: number }>();
  const version = Number(versionRow?.version || 0) + 1;
  const finalScore = Number(override?.finalScore ?? period.finalScore);
  if (!Number.isFinite(finalScore)) return null;
  const finalizedAt = override?.finalizedAt || period.finalizedAt || nowIso();
  const finalizedBy = override?.actor
    ? {
        userId: override.actor.id,
        fullName: override.actor.fullName,
        role: override.actor.role,
      }
    : {
        userId: period.finalizedByUserId,
        fullName: period.finalizedByName,
        role: period.finalizedByRole,
      };
  const professionalLevel = override?.professionalLevel || caregiver.professionalLevel || "ثبت‌نشده";
  const identityJson = stableJson(caregiver);
  const payloadObject = {
    schemaVersion: EVALUATION_PROTECTION_SCHEMA_VERSION,
    snapshotVersion: version,
    evaluation: {
      id: period.id,
      caregiverId: period.caregiverId,
      title: period.title,
      startDate: period.startDate,
      endDate: period.endDate,
      status: "FINAL",
      policyVersion: period.policyVersion,
      finalScore,
      professionalLevel,
      createdAt: period.createdAt,
      finalizedAt,
      finalizedBy,
      indicators: groupedIndicators(rows),
    },
    caregiverIdentity: caregiver,
  };
  const payload = stableJson(payloadObject);
  const hash = await sha256(payload);
  const id = randomId("evsnap_");
  return {
    id,
    version,
    hash,
    payload,
    statement: env.DB.prepare(`INSERT INTO evaluation_final_snapshots(
      id,evaluation_id,caregiver_id,snapshot_version,policy_version,final_score,professional_level,
      caregiver_identity_json,snapshot_json,snapshot_sha256,finalized_by_user_id,finalized_by_name,
      finalized_at,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id,
      evaluationId,
      period.caregiverId,
      version,
      period.policyVersion,
      finalScore,
      professionalLevel,
      identityJson,
      payload,
      hash,
      finalizedBy.userId,
      finalizedBy.fullName,
      finalizedAt,
      nowIso(),
    ),
  };
}

export async function prepareFinalEvaluationSnapshot(
  env: Env,
  actor: AuthUser,
  evaluationId: string,
  finalScore: number,
  professionalLevel: string,
  finalizedAt: string,
) {
  await ensureEvaluationDataProtection(env);
  return buildSnapshot(env, evaluationId, {
    finalScore,
    professionalLevel,
    finalizedAt,
    actor,
  });
}

export async function backfillFinalEvaluationSnapshots(
  env: Env,
  limit = DEFAULT_BACKFILL_LIMIT,
) {
  await ensureEvaluationDataProtection(env);
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const result = await env.DB.prepare(`SELECT p.id
    FROM caregiver_evaluation_periods p
    WHERE p.status='FINAL' AND NOT EXISTS(
      SELECT 1 FROM evaluation_final_snapshots s WHERE s.evaluation_id=p.id
    )
    ORDER BY p.finalized_at,p.created_at
    LIMIT ?`)
    .bind(safeLimit)
    .all<{ id: string }>();
  let created = 0;
  for (const row of result.results || []) {
    const prepared = await buildSnapshot(env, row.id);
    if (!prepared) continue;
    await prepared.statement.run();
    created += 1;
  }
  return { scanned: (result.results || []).length, created };
}

export async function softDeleteCaregiver(
  request: Request,
  env: Env,
  actor: AuthUser,
  identifier: string,
) {
  await ensureEvaluationDataProtection(env);
  const body = await readBody(request);
  const reason = str(body?.reason || body?.deletionReason) || "بایگانی پرونده مراقب توسط مدیر سامانه";
  const caregiver = await env.DB.prepare(`SELECT id,full_name AS fullName,deleted_at AS deletedAt
    FROM caregivers WHERE id=? OR membership_code=? LIMIT 1`)
    .bind(identifier, identifier)
    .first<{ id: string; fullName: string; deletedAt: string | null }>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  if (caregiver.deletedAt) {
    return json({ status: "ok", data: { id: caregiver.id, archived: true, alreadyArchived: true } });
  }
  const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM caregiver_evaluation_periods WHERE caregiver_id=?`)
    .bind(caregiver.id)
    .first<{ total: number }>();
  const evaluationCount = Number(count?.total || 0);
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE user_id IN(
      SELECT id FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER'
    )`).bind(caregiver.id),
    env.DB.prepare(`UPDATE users SET status='INACTIVE',updated_at=?
      WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED'`)
      .bind(timestamp, caregiver.id),
    env.DB.prepare(`UPDATE caregivers SET
      active=0,recruitment_stage='DELETED',cooperation_status='حذف‌شده',
      deleted_at=?,deleted_by_user_id=?,deletion_reason=?,updated_at=?
      WHERE id=?`).bind(timestamp, actor.id, reason, timestamp, caregiver.id),
    env.DB.prepare(`INSERT INTO caregiver_archival_events(
      id,caregiver_id,action,reason,evaluation_count,actor_user_id,actor_name,actor_role,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)`).bind(
      randomId("carc_"),
      caregiver.id,
      "ARCHIVE",
      reason,
      evaluationCount,
      actor.id,
      actor.fullName,
      actor.role,
      timestamp,
    ),
  ]);
  await audit(request, env, actor, "ARCHIVE_CAREGIVER", "caregiver", caregiver.id, {
    reason,
    evaluationCount,
    mode: "soft_delete_preserve_evaluations",
  });
  return json({
    status: "ok",
    data: {
      id: caregiver.id,
      fullName: caregiver.fullName,
      archived: true,
      evaluationCountPreserved: evaluationCount,
    },
  });
}

export async function archiveEvaluationPeriod(
  request: Request,
  env: Env,
  actor: AuthUser,
  evaluationId: string,
) {
  await ensureEvaluationDataProtection(env);
  const body = await readBody(request);
  const reason = str(body?.reason || body?.archiveReason);
  if (!reason) return fail("برای بایگانی ارزیابی، ثبت دلیل الزامی است.", 400, "archive_reason_required");
  const period = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,archived_at AS archivedAt
    FROM caregiver_evaluation_periods WHERE id=? LIMIT 1`)
    .bind(evaluationId)
    .first<{ id: string; caregiverId: string; archivedAt: string | null }>();
  if (!period) return fail("دوره ارزیابی پیدا نشد.", 404, "evaluation_not_found");
  if (period.archivedAt) {
    return json({ status: "ok", data: { id: evaluationId, archived: true, alreadyArchived: true } });
  }
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(`UPDATE caregiver_evaluation_periods SET
      archived_at=?,archived_by_user_id=?,archive_reason=?,updated_at=? WHERE id=?`)
      .bind(timestamp, actor.id, reason, timestamp, evaluationId),
    env.DB.prepare(`INSERT INTO evaluation_archival_events(
      id,evaluation_id,caregiver_id,action,reason,actor_user_id,actor_name,actor_role,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)`).bind(
      randomId("evarc_"),
      evaluationId,
      period.caregiverId,
      "ARCHIVE",
      reason,
      actor.id,
      actor.fullName,
      actor.role,
      timestamp,
    ),
  ]);
  await audit(request, env, actor, "ARCHIVE_EVALUATION", "caregiver_evaluation", evaluationId, {
    caregiverId: period.caregiverId,
    reason,
  });
  return json({ status: "ok", data: { id: evaluationId, archived: true, archivedAt: timestamp } });
}

async function verifySnapshotHashes(env: Env, limit = 100) {
  const result = await env.DB.prepare(`SELECT id,snapshot_json AS snapshotJson,snapshot_sha256 AS snapshotSha256
    FROM evaluation_final_snapshots ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<{ id: string; snapshotJson: string; snapshotSha256: string }>();
  const mismatches: string[] = [];
  for (const row of result.results || []) {
    if (await sha256(row.snapshotJson) !== row.snapshotSha256) mismatches.push(row.id);
  }
  return { checked: (result.results || []).length, mismatches };
}

export async function evaluationProtectionHealth(env: Env) {
  await ensureEvaluationDataProtection(env);
  const counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM caregiver_evaluation_periods) AS periods,
      (SELECT COUNT(*) FROM caregiver_evaluation_scores) AS scores,
      (SELECT COUNT(*) FROM evaluation_score_revisions) AS revisions,
      (SELECT COUNT(*) FROM caregiver_evaluation_periods WHERE status='FINAL') AS finalPeriods,
      (SELECT COUNT(*) FROM evaluation_final_snapshots) AS snapshots,
      (SELECT COUNT(*) FROM caregiver_evaluation_periods p WHERE p.status='FINAL' AND NOT EXISTS(
        SELECT 1 FROM evaluation_final_snapshots s WHERE s.evaluation_id=p.id
      )) AS finalWithoutSnapshot,
      (SELECT COUNT(*) FROM caregiver_evaluation_scores s WHERE NOT EXISTS(
        SELECT 1 FROM evaluation_score_revisions r
        WHERE r.evaluation_id=s.evaluation_id AND r.criterion_code=s.criterion_code
      )) AS scoresWithoutRevision,
      (SELECT COUNT(*) FROM caregiver_evaluation_scores s WHERE NOT EXISTS(
        SELECT 1 FROM caregiver_evaluation_periods p WHERE p.id=s.evaluation_id
      )) AS orphanScores,
      (SELECT COUNT(*) FROM caregivers WHERE deleted_at IS NOT NULL) AS archivedCaregivers`)
    .first<CountRow>();
  const hashes = await verifySnapshotHashes(env);
  const healthy = Number(counts?.finalWithoutSnapshot || 0) === 0
    && Number(counts?.scoresWithoutRevision || 0) === 0
    && Number(counts?.orphanScores || 0) === 0
    && hashes.mismatches.length === 0;
  return {
    status: healthy ? "healthy" : "attention_required",
    schemaVersion: EVALUATION_PROTECTION_SCHEMA_VERSION,
    counts: counts || {},
    snapshotHashes: hashes,
    guarantees: {
      caregiverHardDeleteBlocked: true,
      evaluationDeleteBlocked: true,
      scoreDeleteBlocked: true,
      revisionsAppendOnly: true,
      snapshotsImmutable: true,
      finalizedEvaluationsLocked: true,
    },
    checkedAt: nowIso(),
  };
}

export async function runEvaluationProtectionMaintenance(
  env: Env,
  options: { limit?: number; force?: boolean } = {},
) {
  const now = Date.now();
  if (!options.force && now - lastMaintenanceAt < 60 * 60 * 1000) {
    return { skipped: true, reason: "recently_completed" };
  }
  lastMaintenanceAt = now;
  await ensureEvaluationDataProtection(env);
  const backfill = await backfillFinalEvaluationSnapshots(env, options.limit || DEFAULT_BACKFILL_LIMIT);
  const health = await evaluationProtectionHealth(env);
  await env.DB.prepare(`INSERT INTO evaluation_data_protection_meta(key,value,updated_at)
    VALUES('last_maintenance',?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind(stableJson({ backfill, health }), nowIso())
    .run();
  return { skipped: false, backfill, health };
}
