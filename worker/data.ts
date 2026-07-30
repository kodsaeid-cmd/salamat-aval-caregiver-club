import {
  type AuthUser, type Env, type JsonObject, audit, fail, findCaregiverId, hashPassword,
  json, normalizeMobile, normalizeRole, normalizeStatus, nowIso, randomId, readBody, str,
} from "./lib";

const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
};

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (["password", "passwordHash", "token", "sessionToken"].includes(key)) continue;
    out[key] = scrub(child);
  }
  return out;
}

export async function users(env: Env) {
  const result = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson,last_login_at AS lastLoginAt,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY created_at DESC`).all<Record<string, unknown>>();
  return (result.results || []).map((row) => ({ ...row, permissions: parseJson(row.permissionsJson, []), permissionsJson: undefined }));
}

export async function caregivers(env: Env) {
  const result = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,national_id AS nationalId,full_name AS fullName,mobile,province,city,service_region AS address,cooperation_status AS cooperationStatus,active,birth_date AS birthDate,primary_type AS primaryType,skills_json AS skillsJson,work_history AS workHistory,recruitment_stage AS recruitmentStage,professional_level AS professionalLevel,professional_score AS professionalScore,club_points AS clubPoints,license_status AS licenseStatus,profile_completed AS profileCompleted,created_at AS createdAt,updated_at AS updatedAt FROM caregivers ORDER BY created_at DESC`).all<Record<string, unknown>>();
  return (result.results || []).map((row) => ({ ...row, skills: parseJson(row.skillsJson, []), skillsJson: undefined }));
}

async function readStateScope(env: Env, scope: string) {
  const row = await env.DB.prepare("SELECT state_json AS stateJson,updated_at AS updatedAt FROM ui_state WHERE scope=?")
    .bind(scope).first<{ stateJson: string; updatedAt: string }>();
  return { state: parseJson<JsonObject>(row?.stateJson, {}), updatedAt: row?.updatedAt || null };
}
const readOrgState = (env: Env) => readStateScope(env, "ORG");

function mergeCore(state: JsonObject, dbUsers: Record<string, unknown>[], dbCaregivers: Record<string, unknown>[]) {
  const auth = state.auth && typeof state.auth === "object" ? state.auth as JsonObject : { users: [], audit: [] };
  auth.users = dbUsers.map((user) => ({
    id: user.id, caregiverId: user.caregiverId, name: user.fullName, username: user.username,
    email: user.username, mobile: String(user.mobile || "").startsWith("internal-") ? "" : user.mobile,
    role: String(user.role || "CAREGIVER").toLowerCase(),
    status: String(user.status || "PENDING").toUpperCase() === "ACTIVE" ? "approved" : String(user.status || "pending").toLowerCase(),
    createdAt: user.createdAt,
  }));
  state.auth = auth;

  const evaluation = state.evaluation && typeof state.evaluation === "object" ? state.evaluation as JsonObject : {};
  const existing = Array.isArray(evaluation.caregivers) ? evaluation.caregivers as JsonObject[] : [];
  evaluation.caregivers = dbCaregivers.map((caregiver) => {
    const localId = String(caregiver.membershipCode || caregiver.id);
    const old = existing.find((item) => item.id === localId || item.backendId === caregiver.id) || {};
    return {
      ...old, id: localId, backendId: caregiver.id, name: caregiver.fullName, phone: caregiver.mobile,
      nationalId: caregiver.nationalId, serviceGroup: caregiver.primaryType || old.serviceGroup || "مراقبت سالمند",
      fileStatus: caregiver.cooperationStatus || old.fileStatus || "در انتظار تأیید مدیر", createdAt: caregiver.createdAt,
      rank: old.rank || { code: "", title: caregiver.professionalLevel || "در انتظار ارزیابی", stars: 0, pri: caregiver.professionalScore || null, decisionRef: "", validFrom: "", validTo: "" },
      license: old.license || { number: "", status: caregiver.licenseStatus || "ثبت نشده", issuedAt: "", expiresAt: "", decisionRef: "" },
      profile: { ...(old.profile as JsonObject || {}), city: caregiver.city, birthDate: caregiver.birthDate, address: caregiver.address, skills: Array.isArray(caregiver.skills) ? caregiver.skills.join("، ") : "", bio: caregiver.workHistory },
    };
  });
  evaluation.periods ||= []; evaluation.events ||= []; evaluation.training ||= []; evaluation.complaints ||= [];
  evaluation.appeals ||= []; evaluation.correctiveActions ||= []; evaluation.committeeDecisions ||= []; evaluation.audit ||= [];
  state.evaluation = evaluation;
  state.admin ||= { version: "1.5.0", contracts: [], payroll: [], trainingLibrary: [], assignments: [], tickets: [], securityReports: [], rolePermissions: {}, settings: {}, audit: [], ui: {} };
  return state;
}

function filterForCaregiver(state: JsonObject, user: AuthUser) {
  const caregiverId = user.caregiverId || "";
  const auth = state.auth as JsonObject | undefined;
  const evaluation = state.evaluation as JsonObject | undefined;
  const admin = state.admin as JsonObject | undefined;
  const caregiverRows = Array.isArray(evaluation?.caregivers) ? evaluation?.caregivers as JsonObject[] : [];
  const self = caregiverRows.find((x) => x.backendId === caregiverId || x.id === caregiverId);
  const localId = String(self?.id || caregiverId);
  const filter = (rows: unknown, key = "caregiverId") => Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object" && [localId, caregiverId].includes(String((row as JsonObject)[key] || ""))) : [];
  const assignments = filter(admin?.assignments);
  const trainingIds = new Set(assignments.map((x) => String((x as JsonObject).trainingId || "")));
  return {
    auth: { users: Array.isArray(auth?.users) ? (auth?.users as JsonObject[]).filter((x) => x.id === user.id) : [], audit: [] },
    evaluation: { ...(evaluation || {}), caregivers: self ? [self] : [], periods: filter(evaluation?.periods) },
    admin: {
      version: (admin?.version || "1.5.0"), contracts: filter(admin?.contracts), payroll: filter(admin?.payroll), assignments,
      trainingLibrary: Array.isArray(admin?.trainingLibrary) ? (admin?.trainingLibrary as JsonObject[]).filter((x) => trainingIds.has(String(x.id))) : [],
      tickets: filter(admin?.tickets), securityReports: filter(admin?.securityReports), rolePermissions: { caregiver: [] },
      settings: admin?.settings || {}, audit: [], ui: { caregiverId: localId },
    },
  };
}

export async function bootstrap(env: Env, user: AuthUser) {
  const personalScope = `USER:${user.id}`;
  const [stateRow, personalRow, dbUsers, dbCaregivers] = await Promise.all([
    readOrgState(env),
    user.role.toUpperCase() === "CAREGIVER" ? readStateScope(env, personalScope) : Promise.resolve({ state: {} as JsonObject, updatedAt: null as string | null }),
    users(env), caregivers(env),
  ]);
  const merged = mergeCore(stateRow.state, dbUsers, dbCaregivers);
  if (user.role.toUpperCase() !== "CAREGIVER") return { state: merged, updatedAt: stateRow.updatedAt, currentUser: user };
  const filtered = filterForCaregiver(merged, user) as JsonObject;
  for (const key of ["caregiverPanel", "evaluationV1"]) if (personalRow.state[key] !== undefined) filtered[key] = personalRow.state[key];
  return { state: filtered, updatedAt: personalRow.updatedAt || stateRow.updatedAt, currentUser: user };
}

async function syncCore(env: Env, state: JsonObject) {
  const auth = state.auth as JsonObject | undefined;
  const evaluation = state.evaluation as JsonObject | undefined;
  const userRows = Array.isArray(auth?.users) ? auth?.users as JsonObject[] : [];
  const caregiverRows = Array.isArray(evaluation?.caregivers) ? evaluation?.caregivers as JsonObject[] : [];
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (const user of userRows.slice(0, 5000)) {
    const id = str(user.id); if (!id) continue;
    statements.push(env.DB.prepare("UPDATE users SET full_name=?,role=?,status=?,updated_at=? WHERE id=?")
      .bind(str(user.name || user.fullName), normalizeRole(user.role), normalizeStatus(user.status), timestamp, id));
  }
  for (const caregiver of caregiverRows.slice(0, 5000)) {
    const membershipCode = str(caregiver.id); if (!membershipCode) continue;
    const backendId = str(caregiver.backendId) || membershipCode;
    const profile = caregiver.profile && typeof caregiver.profile === "object" ? caregiver.profile as JsonObject : {};
    const mobile = normalizeMobile(str(caregiver.phone || caregiver.mobile));
    statements.push(env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,birth_date,primary_type,skills_json,work_history,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?, 'UI_SYNC',?,1,?,?,?) ON CONFLICT(id) DO UPDATE SET membership_code=excluded.membership_code,national_id=excluded.national_id,full_name=excluded.full_name,mobile=excluded.mobile,city=excluded.city,service_region=excluded.service_region,cooperation_status=excluded.cooperation_status,birth_date=excluded.birth_date,primary_type=excluded.primary_type,skills_json=excluded.skills_json,work_history=excluded.work_history,updated_at=excluded.updated_at`)
      .bind(backendId, `UI-${backendId}`, membershipCode, str(caregiver.nationalId) || null, str(caregiver.name || caregiver.fullName), mobile, str(profile.city) || null, str(profile.address) || null, str(caregiver.fileStatus) || null, str(profile.birthDate) || null, str(caregiver.serviceGroup) || null, JSON.stringify(str(profile.skills).split(/[,،]/).map((x) => x.trim()).filter(Boolean)), str(profile.bio) || null, str((caregiver.rank as JsonObject | undefined)?.title) || "NEW", timestamp, timestamp, timestamp));
  }
  for (let i = 0; i < statements.length; i += 50) await env.DB.batch(statements.slice(i, i + 50));
}

export async function getState(env: Env, user: AuthUser) { return json({ data: await bootstrap(env, user) }); }

export async function putState(request: Request, env: Env, user: AuthUser) {
  const body = await readBody(request); const incoming = body?.state;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return fail("ساختار داده معتبر نیست.");
  const sanitized = scrub(incoming) as JsonObject; const serialized = JSON.stringify(sanitized);
  if (serialized.length > 1_500_000) return fail("حجم داده از حد مجاز بیشتر است.", 413, "state_too_large");
  const scope = user.role.toUpperCase() === "CAREGIVER" ? `USER:${user.id}` : "ORG";
  await env.DB.prepare(`INSERT INTO ui_state(scope,state_json,updated_by_user_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(scope) DO UPDATE SET state_json=excluded.state_json,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`)
    .bind(scope, serialized, user.id, nowIso()).run();
  if (scope === "ORG") await syncCore(env, sanitized);
  await audit(request, env, user, "SAVE", "ui_state", scope);
  return json({ ok: true, updatedAt: nowIso() });
}

export async function createUser(request: Request, env: Env, actor: AuthUser) {
  const body = await readBody(request); if (!body) return fail("اطلاعات کاربر معتبر نیست.");
  const fullName = str(body.fullName || body.name); const username = str(body.username || body.email).toLowerCase();
  const password = str(body.password); const mobile = normalizeMobile(str(body.mobile)) || `internal-${randomId()}`;
  if (!fullName || !username || password.length < 8) return fail("نام، نام کاربری و رمز حداقل ۸ کاراکتری لازم است.");
  const id = randomId("usr_"); const timestamp = nowIso();
  try {
    await env.DB.prepare(`INSERT INTO users(id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, fullName, mobile, username, await hashPassword(password), normalizeRole(body.role), normalizeStatus(body.status), JSON.stringify(Array.isArray(body.permissions) ? body.permissions : []), timestamp, timestamp).run();
  } catch { return fail("نام کاربری یا شماره همراه تکراری است.", 409, "duplicate_user"); }
  await audit(request, env, actor, "CREATE", "user", id, { username });
  return json({ data: { id, fullName, username, mobile, role: normalizeRole(body.role), status: normalizeStatus(body.status), createdAt: timestamp } }, 201);
}

export async function updateUser(request: Request, env: Env, actor: AuthUser, id: string) {
  const body = await readBody(request); if (!body) return fail("اطلاعات معتبر نیست.");
  const fields: string[] = [], values: unknown[] = [];
  const add = (column: string, value: unknown) => { fields.push(`${column}=?`); values.push(value); };
  if (body.fullName !== undefined || body.name !== undefined) add("full_name", str(body.fullName || body.name));
  if (body.status !== undefined) add("status", normalizeStatus(body.status));
  if (body.role !== undefined) add("role", normalizeRole(body.role));
  if (body.mobile !== undefined) add("mobile", normalizeMobile(str(body.mobile)) || str(body.mobile));
  if (body.permissions !== undefined) add("permissions_json", JSON.stringify(Array.isArray(body.permissions) ? body.permissions : []));
  if (body.password !== undefined) { const password = str(body.password); if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد."); add("password_hash", await hashPassword(password)); }
  if (!fields.length) return fail("تغییری ارسال نشده است."); add("updated_at", nowIso()); values.push(id);
  await env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
  await audit(request, env, actor, "UPDATE", "user", id, body); return json({ ok: true });
}

export async function deleteUser(request: Request, env: Env, actor: AuthUser, id: string) {
  if (actor.id === id) return fail("حساب جاری قابل حذف نیست.", 409);
  await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
  await audit(request, env, actor, "DELETE", "user", id); return json({ ok: true });
}

export async function createCaregiver(request: Request, env: Env, actor: AuthUser) {
  const body = await readBody(request); if (!body) return fail("اطلاعات مراقب معتبر نیست.");
  const fullName = str(body.fullName || body.name); const mobile = normalizeMobile(str(body.mobile || body.phone));
  if (!fullName || !mobile) return fail("نام و شماره همراه الزامی است.");
  const code = str(body.membershipCode || body.id) || `CP-${Date.now().toString(36).toUpperCase()}`; const timestamp = nowIso();
  try {
    await env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,primary_type,skills_json,work_history,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,'MANUAL','NEW',1,?,?,?)`)
      .bind(code, `MANUAL-${randomId()}`, code, str(body.nationalId) || null, fullName, mobile, str(body.city) || null, str(body.address) || null, str(body.fileStatus || body.cooperationStatus) || null, str(body.serviceGroup || body.primaryType) || null, "[]", str(body.bio || body.workHistory) || null, timestamp, timestamp, timestamp).run();
  } catch { return fail("کد عضویت، موبایل یا کد ملی تکراری است.", 409, "duplicate_caregiver"); }
  await audit(request, env, actor, "CREATE", "caregiver", code, { fullName, mobile });
  return json({ data: { id: code, membershipCode: code, fullName, mobile } }, 201);
}

export async function updateCaregiver(request: Request, env: Env, actor: AuthUser, identifier: string) {
  const id = await findCaregiverId(env, identifier); if (!id) return fail("پرونده مراقب پیدا نشد.", 404);
  const body = await readBody(request); if (!body) return fail("اطلاعات معتبر نیست.");
  const fields: string[] = [], values: unknown[] = [];
  const add = (column: string, value: unknown) => { fields.push(`${column}=?`); values.push(value); };
  const pairs: Array<[string, string, (x: unknown) => unknown]> = [
    ["name", "full_name", str], ["fullName", "full_name", str], ["phone", "mobile", (x) => normalizeMobile(str(x))],
    ["mobile", "mobile", (x) => normalizeMobile(str(x))], ["nationalId", "national_id", (x) => str(x) || null],
    ["city", "city", (x) => str(x) || null], ["address", "service_region", (x) => str(x) || null],
    ["fileStatus", "cooperation_status", (x) => str(x) || null], ["serviceGroup", "primary_type", (x) => str(x) || null],
    ["professionalLevel", "professional_level", str], ["professionalScore", "professional_score", Number], ["licenseStatus", "license_status", str],
  ];
  const used = new Set<string>();
  for (const [key, column, transform] of pairs) if (body[key] !== undefined && !used.has(column)) { add(column, transform(body[key])); used.add(column); }
  if (!fields.length) return fail("تغییری ارسال نشده است."); add("updated_at", nowIso()); values.push(id);
  await env.DB.prepare(`UPDATE caregivers SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
  await audit(request, env, actor, "UPDATE", "caregiver", id, body); return json({ ok: true });
}
