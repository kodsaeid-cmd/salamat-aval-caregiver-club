import {
  type AuthUser, type Env, audit, ensureSchema, fail, hashPassword, json, normalizeMobile,
  normalizeRole, normalizeStatus, nowIso, randomId, readBody, str,
} from "./lib";
import { reconcileCaregiverAccounts } from "./caregiver-accounts";
import { ensureProfileImageSchema } from "./profile-images";

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
  avatarId: string | null;
};

type CaregiverDirectoryRow = {
  id: string;
  membershipCode: string | null;
  nationalId: string | null;
  fullName: string;
  mobile: string;
  city: string | null;
  address: string | null;
  birthDate: string | null;
  fileStatus: string | null;
  primaryType: string | null;
  workHistory: string | null;
  professionalLevel: string | null;
  professionalScore: number | null;
  licenseStatus: string | null;
  createdAt: string;
  userId: string | null;
  username: string | null;
  accountStatus: string | null;
  avatarId: string | null;
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
  const legacyRows = Array.isArray(evaluation.caregivers)
    ? evaluation.caregivers.filter((item): item is LegacyObject => Boolean(item && typeof item === "object"))
    : [];
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
  await ensureProfileImageSchema(env);
  const migration = await migrateLegacyProfiles(env);
  const reconciliation = await reconcileCaregiverAccounts(env);

  const [accountResult, caregiverResult] = await Promise.all([
    env.DB.prepare(`SELECT
      u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,u.role,u.status,
      u.permissions_json AS permissionsJson,u.last_login_at AS lastLoginAt,u.created_at AS createdAt,
      c.membership_code AS membershipCode,c.full_name AS caregiverFullName,c.mobile AS caregiverMobile,
      c.cooperation_status AS fileStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.user_id=u.id OR (u.caregiver_id IS NOT NULL AND pi.caregiver_id=u.caregiver_id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
      FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
      ORDER BY CASE WHEN upper(u.role)='ADMIN' THEN 0 ELSE 1 END,u.created_at DESC`).all<AccountDirectoryRow>(),
    env.DB.prepare(`SELECT
      c.id,c.membership_code AS membershipCode,c.national_id AS nationalId,c.full_name AS fullName,c.mobile,
      c.city,c.service_region AS address,c.birth_date AS birthDate,c.cooperation_status AS fileStatus,c.primary_type AS primaryType,
      c.work_history AS workHistory,c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.license_status AS licenseStatus,c.created_at AS createdAt,u.id AS userId,u.username,u.status AS accountStatus,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
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
    avatarUrl: row.avatarId ? `/api/profile-images/${encodeURIComponent(row.avatarId)}` : null,
    linked: row.role.toUpperCase() !== "CAREGIVER" || Boolean(row.caregiverId && row.membershipCode),
  }));
  const caregivers = (caregiverResult.results || []).map((row) => ({
    ...row,
    mobile: publicMobile(row.mobile),
    avatarUrl: row.avatarId ? `/api/profile-images/${encodeURIComponent(row.avatarId)}` : null,
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

  await audit(request, env, actor, "READ_ADMIN_DIRECTORY", "system", null, { counts, migration, reconciliation });
  return json({ status: "ok", data: { accounts, caregivers, counts, migration, reconciliation } });
}

export async function updateDirectoryProfile(request: Request, env: Env, actor: AuthUser) {
  await ensureSchema(env);
  const body = await readBody(request);
  if (!body) return fail("اطلاعات پروفایل معتبر نیست.");

  const userId = str(body.userId) || null;
  const caregiverId = str(body.caregiverId) || null;
  if (!userId && !caregiverId) return fail("شناسه پروفایل ارسال نشده است.", 400, "profile_id_required");

  const user = userId
    ? await env.DB.prepare("SELECT id,caregiver_id AS caregiverId,role FROM users WHERE id=? LIMIT 1")
      .bind(userId).first<{ id: string; caregiverId: string | null; role: string }>()
    : null;
  if (userId && !user) return fail("حساب کاربری پیدا نشد.", 404, "user_not_found");
  const resolvedCaregiverId = caregiverId || user?.caregiverId || null;
  if (resolvedCaregiverId && !await env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1").bind(resolvedCaregiverId).first()) {
    return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");
  }

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];

  if (user) {
    const userFields: string[] = [];
    const userValues: unknown[] = [];
    const addUser = (column: string, value: unknown) => { userFields.push(`${column}=?`); userValues.push(value); };

    const fullName = body.fullName !== undefined ? str(body.fullName) : null;
    const username = body.username !== undefined ? str(body.username).toLowerCase() : null;
    const mobile = body.mobile !== undefined ? normalizeMobile(str(body.mobile)) : null;
    if (fullName !== null && fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
    if (username !== null && !username) return fail("نام کاربری یا ایمیل ورود الزامی است.");
    if (mobile !== null && mobile && !/^09\d{9}$/.test(mobile)) return fail("شماره همراه معتبر نیست.");

    if (username !== null) {
      const duplicate = await env.DB.prepare("SELECT id FROM users WHERE lower(username)=? AND id<>? LIMIT 1")
        .bind(username, user.id).first();
      if (duplicate) return fail("این نام کاربری قبلاً استفاده شده است.", 409, "duplicate_username");
      addUser("username", username);
    }
    if (mobile !== null && mobile) {
      const duplicate = await env.DB.prepare("SELECT id FROM users WHERE mobile=? AND id<>? LIMIT 1")
        .bind(mobile, user.id).first();
      if (duplicate) return fail("این شماره همراه قبلاً استفاده شده است.", 409, "duplicate_mobile");
      addUser("mobile", mobile);
    }
    if (fullName !== null) addUser("full_name", fullName);
    if (body.role !== undefined) {
      const nextRole = normalizeRole(body.role);
      if (nextRole === "CAREGIVER" && !resolvedCaregiverId) return fail("برای نقش مراقب ابتدا پرونده حرفه‌ای لازم است.", 409, "caregiver_profile_required");
      addUser("role", nextRole);
    }
    if (body.status !== undefined) addUser("status", normalizeStatus(body.status, "ACTIVE"));
    if (body.permissions !== undefined) addUser("permissions_json", JSON.stringify(Array.isArray(body.permissions) ? body.permissions : []));
    if (body.password !== undefined && str(body.password)) {
      const password = str(body.password);
      if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      addUser("password_hash", await hashPassword(password));
    }
    if (userFields.length) {
      addUser("updated_at", timestamp);
      userValues.push(user.id);
      statements.push(env.DB.prepare(`UPDATE users SET ${userFields.join(",")} WHERE id=?`).bind(...userValues));
    }
  }

  if (resolvedCaregiverId) {
    const caregiverFields: string[] = [];
    const caregiverValues: unknown[] = [];
    const addCaregiver = (column: string, value: unknown) => { caregiverFields.push(`${column}=?`); caregiverValues.push(value); };
    const caregiverName = body.fullName !== undefined ? str(body.fullName) : null;
    const caregiverMobile = body.mobile !== undefined ? normalizeMobile(str(body.mobile)) : null;
    const nationalId = body.nationalId !== undefined ? cleanNationalId(body.nationalId) : undefined;
    if (body.nationalId !== undefined && str(body.nationalId) && !nationalId) return fail("کد ملی باید ۱۰ رقم باشد.");

    if (caregiverName !== null) addCaregiver("full_name", caregiverName);
    if (caregiverMobile !== null && caregiverMobile) addCaregiver("mobile", caregiverMobile);
    if (nationalId !== undefined) addCaregiver("national_id", nationalId);
    if (body.city !== undefined) addCaregiver("city", str(body.city) || null);
    if (body.address !== undefined) addCaregiver("service_region", str(body.address) || null);
    if (body.birthDate !== undefined) addCaregiver("birth_date", str(body.birthDate) || null);
    if (body.primaryType !== undefined || body.serviceGroup !== undefined) addCaregiver("primary_type", str(body.primaryType || body.serviceGroup) || null);
    if (body.fileStatus !== undefined) addCaregiver("cooperation_status", str(body.fileStatus) || null);
    if (body.workHistory !== undefined || body.bio !== undefined) addCaregiver("work_history", str(body.workHistory || body.bio) || null);
    if (body.professionalLevel !== undefined) addCaregiver("professional_level", str(body.professionalLevel) || "NEW");
    if (caregiverFields.length) {
      addCaregiver("updated_at", timestamp);
      caregiverValues.push(resolvedCaregiverId);
      statements.push(env.DB.prepare(`UPDATE caregivers SET ${caregiverFields.join(",")} WHERE id=?`).bind(...caregiverValues));
    }
  }

  if (!statements.length) return fail("تغییری برای ذخیره ارسال نشده است.");
  await env.DB.batch(statements);
  await audit(request, env, actor, "UPDATE_DIRECTORY_PROFILE", "profile", userId || resolvedCaregiverId, {
    userId,
    caregiverId: resolvedCaregiverId,
  });
  return json({ ok: true, updatedAt: timestamp });
}
