import { adminDirectory } from "./admin-directory";
import {
  type AuthUser,
  type Env,
  audit,
  fail,
  hasRole,
  json,
  nowIso,
  randomId,
  readBody,
  str,
} from "./lib";

type DirectoryPayload = {
  status?: string;
  data?: {
    accounts?: Array<Record<string, unknown>>;
    caregivers?: Array<Record<string, unknown>>;
    counts?: Record<string, number>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function requireAdmin(actor: AuthUser) {
  return hasRole(actor, ["ADMIN"]);
}

function recalculateCounts(data: NonNullable<DirectoryPayload["data"]>) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const caregivers = Array.isArray(data.caregivers) ? data.caregivers : [];
  return {
    accounts: accounts.length,
    caregiverAccounts: accounts.filter((row) => str(row.role).toUpperCase() === "CAREGIVER").length,
    caregiverProfiles: caregivers.length,
    activeAccounts: accounts.filter((row) => ["ACTIVE", "APPROVED"].includes(str(row.status).toUpperCase())).length,
    profilesWithoutAccounts: caregivers.filter((row) => !row.userId).length,
    accountsWithoutProfiles: accounts.filter((row) => str(row.role).toUpperCase() === "CAREGIVER" && !row.linked).length,
  };
}

export async function activeAdminDirectory(request: Request, env: Env, actor: AuthUser) {
  if (!requireAdmin(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const response = await adminDirectory(request, env, actor);
  if (!response.ok) return response;

  const payload = await response.json<DirectoryPayload>();
  const data = payload.data || {};
  data.accounts = (Array.isArray(data.accounts) ? data.accounts : [])
    .filter((row) => str(row.status).toUpperCase() !== "DELETED");
  data.caregivers = (Array.isArray(data.caregivers) ? data.caregivers : [])
    .filter((row) => str(row.fileStatus) !== "حذف‌شده");
  data.counts = recalculateCounts(data);
  payload.data = data;
  return json(payload);
}

export async function setCaregiverApprovalStatus(
  request: Request,
  env: Env,
  actor: AuthUser,
  caregiverId: string,
) {
  if (!requireAdmin(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const body = await readBody(request);
  const status = str(body?.status).toUpperCase();
  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    return fail("وضعیت ارسالی معتبر نیست.", 400, "invalid_status");
  }

  const caregiver = await env.DB.prepare("SELECT id,full_name AS fullName FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId)
    .first<{ id: string; fullName: string }>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  const account = await env.DB.prepare("SELECT id,status FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER' LIMIT 1")
    .bind(caregiverId)
    .first<{ id: string; status: string }>();
  if (!account) {
    return fail("این پرونده هنوز حساب ورود ندارد. ابتدا برای آن حساب متصل بسازید.", 409, "caregiver_account_missing");
  }

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE users SET status=?,updated_at=? WHERE id=?")
      .bind(status, timestamp, account.id),
  ];

  if (status === "ACTIVE") {
    statements.push(env.DB.prepare(`UPDATE caregivers SET
      active=1,
      recruitment_stage='APPROVED',
      cooperation_status=CASE
        WHEN cooperation_status IS NULL OR trim(cooperation_status)='' OR cooperation_status LIKE '%در انتظار%'
          THEN 'CP-01 فعال'
        ELSE cooperation_status
      END,
      updated_at=?
      WHERE id=?`).bind(timestamp, caregiverId));
  } else {
    statements.push(env.DB.prepare(`UPDATE caregivers SET
      active=0,
      recruitment_stage='SUSPENDED',
      cooperation_status='CP-04 غیرفعال',
      updated_at=?
      WHERE id=?`).bind(timestamp, caregiverId));
  }

  await env.DB.batch(statements);
  await audit(request, env, actor, status === "ACTIVE" ? "APPROVE" : "SUSPEND", "caregiver", caregiverId, {
    accountId: account.id,
    fullName: caregiver.fullName,
    previousStatus: account.status,
    status,
  });
  return json({ ok: true, caregiverId, accountId: account.id, status, updatedAt: timestamp });
}

export async function removeCaregiver(
  request: Request,
  env: Env,
  actor: AuthUser,
  caregiverId: string,
) {
  if (!requireAdmin(actor)) return fail("دسترسی کافی ندارید.", 403, "forbidden");
  const caregiver = await env.DB.prepare("SELECT id,full_name AS fullName,membership_code AS membershipCode FROM caregivers WHERE id=? LIMIT 1")
    .bind(caregiverId)
    .first<{ id: string; fullName: string; membershipCode: string | null }>();
  if (!caregiver) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  const linkedAccounts = await env.DB.prepare("SELECT id FROM users WHERE caregiver_id=?")
    .bind(caregiverId)
    .all<{ id: string }>();
  if ((linkedAccounts.results || []).some((row) => row.id === actor.id)) {
    return fail("حساب جاری قابل حذف نیست.", 409, "current_account_delete_forbidden");
  }

  const timestamp = nowIso();
  const tombstone = randomId("deleted_");
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE users SET
      status='DELETED',
      username='deleted-' || id || '-' || ?,
      mobile='deleted-' || id || '-' || ?,
      caregiver_id=NULL,
      updated_at=?
      WHERE caregiver_id=?`).bind(tombstone, tombstone, timestamp, caregiverId),
    env.DB.prepare(`UPDATE caregivers SET
      active=0,
      recruitment_stage='DELETED',
      cooperation_status='حذف‌شده',
      mobile='deleted-' || id || '-' || ?,
      national_id=NULL,
      membership_code='DELETED-' || id || '-' || ?,
      updated_at=?
      WHERE id=?`).bind(tombstone, tombstone, timestamp, caregiverId),
  ];
  await env.DB.batch(statements);
  await audit(request, env, actor, "DELETE", "caregiver", caregiverId, {
    fullName: caregiver.fullName,
    membershipCode: caregiver.membershipCode,
    linkedAccountIds: (linkedAccounts.results || []).map((row) => row.id),
    mode: "auditable_soft_delete",
  });
  return json({ ok: true, caregiverId, deletedAt: timestamp });
}
