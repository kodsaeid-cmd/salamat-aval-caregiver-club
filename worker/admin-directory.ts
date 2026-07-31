import { type AuthUser, type Env, audit, ensureSchema, json, normalizeMobile, nowIso, randomId, str } from "./lib";
import { reconcileCaregiverAccounts } from "./caregiver-accounts";

type LegacyObject = Record<string, unknown>;

type AccountDirectoryRow = {
  id: string;
  caregiverId: string | null;
  fullName: string;
  mobile: string;
  username: string | null;
  role: string;
  status: string;
  permissionsJson: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  membershipCode: string | null;
  caregiverFullName: string | null;
  caregiverMobile: string | null;
  fileStatus: string | null;
};

type CaregiverDirectoryRow = {
  id: string;
  membershipCode: string | null;
  nationalId: string | null;
  fullName: string;
  mobile: string;
  city: string | null;
  address: string | null;
  fileStatus: string | null;
  primaryType: string | null;
  workHistory: string | null;
  professionalLevel: string | null;
  professionalScore: number | null;
  createdAt: string;
  userId: string | null;
  username: string | null;
  accountStatus: string | null;
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
};

const cleanNationalId = (value: unknown) => {
  const digits = str(value).replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
};

const publicMobile = (value: unknown) => {
  const mobile = str(value);
  return /^(internal|legacy)-/i.test(mobile) ? "" : mobile;
};

const legacyId = (value: unknown) => {
  const candidate = str(value).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
  return candidate.length >= 3 ? candidate : `CP-LEGACY-${randomId().slice(0, 12).toUpperCase()}`;
};

function legacySkills(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => str(item)).filter(Boolean);
  return str(value).split(/[,،]/).map((item) => item.trim()).filter(Boolean);
}

async function migrateLegacyProfiles(env: Env) {
  const row = await env.DB.prepare("SELECT state_json AS stateJson FROM ui_state WHERE scope='ORG' LIMIT 1")
    .first<{ stateJson: string }>();
  const state = parseJson<LegacyObject>(row?.stateJson, {});
  const evaluation = state.evaluation && typeof state.evaluation === "object" ? state.evaluation as LegacyObject : {};
  const legacyRows = Array.isArray(evaluation.caregivers) ? evaluation.caregivers.filter((item): item is LegacyObject => Boolean(item && typeof item === "object")) : [];
  if (!legacyRows.length) return { scanned: 0, migrated: 0 };

  const existing = await env.DB.prepare("SELECT id,membership_code AS membershipCode,mobile,national_id AS nationalId FROM caregivers").all<Record<string, unknown>>();
  const ids = new Set<string>();
  const mobiles = new Set<string>();
  const nationals = new Set<string>();
  for (const item of existing.results || []) {
    ids.add(str(item.id));
    if (item.membershipCode) ids.add(str(item.membershipCode));
    if (item.mobile) mobiles.add(str(item.mobile));
    if (item.nationalId) nationals.add(str(item.nationalId));
  }

  const statements: D1PreparedStatement[] = [];
  let migrated = 0;
  for (const item of legacyRows) {
    const fullName = str(item.name || item.fullName);
    if (fullName.length < 3) continue;
    const backendId = str(item.backendId);
    const localId = str(item.id || item.membershipCode);
    const normalizedMobile = normalizeMobile(str(item.phone || item.mobile)) || "";
    const nationalId = cleanNationalId(item.nationalId);
    if ((backendId && ids.has(backendId)) || (localId && ids.has(localId)) || (normalizedMobile && mobiles.has(normalizedMobile)) || (nationalId && nationals.has(nationalId))) continue;

    let id = legacyId(backendId || localId);
    if (ids.has(id)) id = `CP-LEGACY-${randomId().slice(0, 12).toUpperCase()}`;
    const mobile = /^09\d{9}$/.test(normalizedMobile) && !mobiles.has(normalizedMobile)
      ? normalizedMobile
      : `legacy-${randomId().slice(0, 20)}`;
    const profile = item.profile && typeof item.profile === "object" ? item.profile as LegacyObject : {};
    const rank = item.rank && typeof item.rank === "object" ? item.rank as LegacyObject : {};
    const license = item.license && typeof item.license === "object" ? item.license as LegacyObject : {};
    const timestamp = nowIso();

    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO caregivers(
      id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,
      birth_date,primary_type,skills_json,work_history,recruitment_stage,professional_level,professional_score,
      club_points,license_status,profile_completed,last_synced_at,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,1,?,?,?)`).bind(
      id,
      `LEGACY-${randomId()}`,
      localId || id,
      nationalId,
      fullName,
      mobile,
      str(profile.city) || null,
      str(profile.address) || null,
      str(item.fileStatus || item.cooperationStatus) || "CP-03 نیازمند تکمیل مدارک",
      str(profile.birthDate) || null,
      str(item.serviceGroup || item.primaryType) || "مراقبت سالمند",
      JSON.stringify(legacySkills(profile.skills || item.skills)),
      str(profile.bio || item.bio || item.workHistory) || null,
      "LEGACY_UI_MIGRATION",
      str(rank.title || item.professionalLevel) || "در انتظار ارزیابی",
      Number.isFinite(Number(rank.pri || item.professionalScore)) ? Number(rank.pri || item.professionalScore) : null,
      Number.isFinite(Number(item.clubPoints)) ? Number(item.clubPoints) : 0,
      str(license.status || item.licenseStatus) || "ثبت نشده",
      timestamp,
      str(item.createdAt) || timestamp,
      timestamp,
    ));
    ids.add(id);
    if (localId) ids.add(localId);
    mobiles.add(mobile);
    if (nationalId) nationals.add(nationalId);
    migrated += 1;
  }

  if (statements.length) await env.DB.batch(statements);
  return { scanned: legacyRows.length, migrated };
}

export async function adminDirectory(request: Request, env: Env, actor: AuthUser) {
  await ensureSchema(env);
  const migration = await migrateLegacyProfiles(env);
  const reconciliation = await reconcileCaregiverAccounts(env);

  const [accountResult, caregiverResult] = await Promise.all([
    env.DB.prepare(`SELECT
      u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,u.role,u.status,
      u.permissions_json AS permissionsJson,u.last_login_at AS lastLoginAt,u.created_at AS createdAt,
      c.membership_code AS membershipCode,c.full_name AS caregiverFullName,c.mobile AS caregiverMobile,
      c.cooperation_status AS fileStatus
      FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
      ORDER BY CASE WHEN upper(u.role)='ADMIN' THEN 0 ELSE 1 END,u.created_at DESC`).all<AccountDirectoryRow>(),
    env.DB.prepare(`SELECT
      c.id,c.membership_code AS membershipCode,c.national_id AS nationalId,c.full_name AS fullName,c.mobile,
      c.city,c.service_region AS address,c.cooperation_status AS fileStatus,c.primary_type AS primaryType,
      c.work_history AS workHistory,c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.created_at AS createdAt,u.id AS userId,u.username,u.status AS accountStatus
      FROM caregivers c
      LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER'
      ORDER BY c.created_at DESC`).all<CaregiverDirectoryRow>(),
  ]);

  const accounts = (accountResult.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    caregiverMobile: publicMobile(row.caregiverMobile),
    permissions: parseJson(row.permissionsJson, [] as string[]),
    permissionsJson: undefined,
    linked: row.role.toUpperCase() !== "CAREGIVER" || Boolean(row.caregiverId && row.membershipCode),
  }));
  const caregivers = (caregiverResult.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    hasAccount: Boolean(row.userId),
  }));

  const counts = {
    accounts: accounts.length,
    caregiverAccounts: accounts.filter((row) => row.role.toUpperCase() === "CAREGIVER").length,
    caregiverProfiles: caregivers.length,
    activeAccounts: accounts.filter((row) => ["ACTIVE", "APPROVED"].includes(row.status.toUpperCase())).length,
    profilesWithoutAccounts: caregivers.filter((row) => !row.userId).length,
    accountsWithoutProfiles: accounts.filter((row) => row.role.toUpperCase() === "CAREGIVER" && !row.linked).length,
  };

  await audit(request, env, actor, "READ_CANONICAL_DIRECTORY", "system", null, { counts, migration, reconciliation });
  return json({ status: "ok", data: { accounts, caregivers, counts, migration, reconciliation, source: "cloudflare-d1" } });
}
