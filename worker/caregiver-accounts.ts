import { AwsClient } from "aws4fetch";
import {
  type AuthUser, type Env, audit, fail, hashPassword, json, normalizeMobile,
  normalizeStatus, nowIso, randomId, readBody, str,
} from "./lib";

type UserRow = {
  id: string;
  caregiverId: string | null;
  fullName: string;
  mobile: string;
  username: string | null;
  status: string;
};

type CaregiverRow = {
  id: string;
  membershipCode: string | null;
  fullName: string;
  mobile: string;
  nationalId: string | null;
};

const cleanNationalId = (value: unknown) => str(value).replace(/\D/g, "") || null;
const normalizedName = (value: unknown) => str(value).replace(/\s+/g, " ").toLowerCase();
const caregiverCode = () => `CP-${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase()}`;

async function findMatchingCaregiver(
  env: Env,
  requestedId: string,
  mobile: string,
  nationalId: string | null,
  fullName: string,
) {
  if (requestedId) {
    const row = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,mobile,national_id AS nationalId FROM caregivers WHERE id=? OR membership_code=? LIMIT 1`)
      .bind(requestedId, requestedId).first<CaregiverRow>();
    if (row) return row;
  }
  if (mobile) {
    const row = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,mobile,national_id AS nationalId FROM caregivers WHERE mobile=? LIMIT 1`)
      .bind(mobile).first<CaregiverRow>();
    if (row) return row;
  }
  if (nationalId) {
    const row = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,mobile,national_id AS nationalId FROM caregivers WHERE national_id=? LIMIT 1`)
      .bind(nationalId).first<CaregiverRow>();
    if (row) return row;
  }
  const byName = await env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,mobile,national_id AS nationalId FROM caregivers WHERE lower(trim(full_name))=lower(trim(?)) LIMIT 2`)
    .bind(fullName).all<CaregiverRow>();
  return byName.results?.length === 1 ? byName.results[0] : null;
}

export async function createCaregiverAccount(request: Request, env: Env, actor: AuthUser) {
  const body = await readBody(request);
  if (!body) return fail("اطلاعات حساب مراقب معتبر نیست.");

  const fullName = str(body.fullName || body.name);
  const username = str(body.username || body.email).toLowerCase();
  const password = str(body.password);
  const mobile = normalizeMobile(str(body.mobile || body.phone)) || "";
  const nationalId = cleanNationalId(body.nationalId);
  const status = normalizeStatus(body.status, "ACTIVE");
  const requestedId = str(body.caregiverId || body.membershipCode || body.id);

  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (!username) return fail("نام کاربری یا ایمیل ورود الزامی است.");
  if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  if (!/^09\d{9}$/.test(mobile)) return fail("شماره همراه مراقب معتبر نیست.");
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");

  const duplicateUser = await env.DB.prepare(`SELECT id FROM users WHERE lower(username)=? OR mobile=? LIMIT 1`)
    .bind(username, mobile).first<{ id: string }>();
  if (duplicateUser) return fail("برای این نام کاربری یا شماره همراه قبلاً حساب ساخته شده است.", 409, "duplicate_user");

  let caregiver = await findMatchingCaregiver(env, requestedId, mobile, nationalId, fullName);
  if (caregiver) {
    const linked = await env.DB.prepare("SELECT id FROM users WHERE caregiver_id=? LIMIT 1")
      .bind(caregiver.id).first<{ id: string }>();
    if (linked) return fail("این پرونده حرفه‌ای قبلاً به یک حساب ورود متصل است.", 409, "caregiver_already_linked");
  }

  const userId = randomId("usr_");
  const timestamp = nowIso();
  const passwordHash = await hashPassword(password);
  const permissions = JSON.stringify(Array.isArray(body.permissions) ? body.permissions : []);

  if (!caregiver) {
    const id = caregiverCode();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,city,service_region,cooperation_status,active,primary_type,skills_json,work_history,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,'ADMIN_CREATED','NEW',1,?,?,?)`)
        .bind(
          id,
          `ACCOUNT-${userId}`,
          id,
          nationalId,
          fullName,
          mobile,
          str(body.city) || null,
          str(body.address) || null,
          str(body.fileStatus || body.cooperationStatus) || (status === "ACTIVE" ? "CP-03 نیازمند تکمیل مدارک" : "در انتظار تأیید مدیر"),
          str(body.serviceGroup || body.primaryType) || "مراقبت سالمند",
          "[]",
          str(body.bio || body.workHistory) || null,
          timestamp,
          timestamp,
          timestamp,
        ),
      env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER',?,?,?,?)`)
        .bind(userId, id, fullName, mobile, username, passwordHash, status, permissions, timestamp, timestamp),
    ]);
    caregiver = { id, membershipCode: id, fullName, mobile, nationalId };
  } else {
    await env.DB.batch([
      env.DB.prepare(`UPDATE caregivers SET national_id=COALESCE(national_id,?),city=COALESCE(NULLIF(city,''),?),service_region=COALESCE(NULLIF(service_region,''),?),primary_type=COALESCE(NULLIF(primary_type,''),?),work_history=COALESCE(NULLIF(work_history,''),?),updated_at=? WHERE id=?`)
        .bind(
          nationalId,
          str(body.city) || null,
          str(body.address) || null,
          str(body.serviceGroup || body.primaryType) || null,
          str(body.bio || body.workHistory) || null,
          timestamp,
          caregiver.id,
        ),
      env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER',?,?,?,?)`)
        .bind(userId, caregiver.id, fullName, mobile, username, passwordHash, status, permissions, timestamp, timestamp),
    ]);
  }

  await audit(request, env, actor, "CREATE_CAREGIVER_ACCOUNT", "user", userId, {
    caregiverId: caregiver.id,
    username,
    status,
  });

  return json({
    data: {
      user: { id: userId, fullName, username, mobile, role: "CAREGIVER", status },
      caregiver: { id: caregiver.id, membershipCode: caregiver.membershipCode || caregiver.id },
      linked: true,
    },
  }, 201);
}

export async function reconcileCaregiverAccounts(env: Env) {
  const [userResult, caregiverResult] = await Promise.all([
    env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,status FROM users WHERE upper(role)='CAREGIVER' ORDER BY created_at`).all<UserRow>(),
    env.DB.prepare(`SELECT id,membership_code AS membershipCode,full_name AS fullName,mobile,national_id AS nationalId FROM caregivers ORDER BY created_at`).all<CaregiverRow>(),
  ]);

  const users = userResult.results || [];
  const caregivers = caregiverResult.results || [];
  const byId = new Map(caregivers.map((row) => [row.id, row]));
  const byMobile = new Map<string, CaregiverRow[]>();
  const byName = new Map<string, CaregiverRow[]>();
  for (const row of caregivers) {
    if (row.mobile) byMobile.set(row.mobile, [...(byMobile.get(row.mobile) || []), row]);
    const name = normalizedName(row.fullName);
    if (name) byName.set(name, [...(byName.get(name) || []), row]);
  }

  const claimed = new Set(users.map((user) => user.caregiverId).filter((id): id is string => Boolean(id && byId.has(id))));
  const statements = [];
  let linkedExisting = 0;
  let createdProfiles = 0;

  for (const user of users) {
    if (user.caregiverId && byId.has(user.caregiverId)) continue;
    let match = (byMobile.get(user.mobile) || []).find((row) => !claimed.has(row.id)) || null;
    if (!match) {
      const named = (byName.get(normalizedName(user.fullName)) || []).filter((row) => !claimed.has(row.id));
      if (named.length === 1) match = named[0];
    }

    if (!match) {
      const id = caregiverCode();
      const timestamp = nowIso();
      statements.push(
        env.DB.prepare(`INSERT INTO caregivers(id,crm_record_id,membership_code,national_id,full_name,mobile,cooperation_status,active,primary_type,skills_json,recruitment_stage,professional_level,profile_completed,last_synced_at,created_at,updated_at) VALUES(?,?,?,NULL,?,?,?,1,?,'[]','ACCOUNT_REPAIR','NEW',1,?,?,?)`)
          .bind(id, `REPAIR-${user.id}`, id, user.fullName, user.mobile, user.status.toUpperCase() === "ACTIVE" ? "CP-03 نیازمند تکمیل مدارک" : "در انتظار تأیید مدیر", "مراقبت سالمند", timestamp, timestamp, timestamp),
      );
      match = { id, membershipCode: id, fullName: user.fullName, mobile: user.mobile, nationalId: null };
      byId.set(id, match);
      createdProfiles += 1;
    } else {
      linkedExisting += 1;
    }

    claimed.add(match.id);
    statements.push(env.DB.prepare("UPDATE users SET caregiver_id=?,updated_at=? WHERE id=?").bind(match.id, nowIso(), user.id));
  }

  if (statements.length) await env.DB.batch(statements);

  const report = await env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM users WHERE upper(role)='CAREGIVER') AS caregiverUsers,
    (SELECT COUNT(*) FROM caregivers) AS caregiverProfiles,
    (SELECT COUNT(*) FROM users u WHERE upper(u.role)='CAREGIVER' AND (u.caregiver_id IS NULL OR NOT EXISTS(SELECT 1 FROM caregivers c WHERE c.id=u.caregiver_id))) AS usersWithoutProfiles,
    (SELECT COUNT(*) FROM caregivers c WHERE NOT EXISTS(SELECT 1 FROM users u WHERE u.caregiver_id=c.id AND upper(u.role)='CAREGIVER')) AS profilesWithoutAccounts
  `).first<Record<string, number>>();

  return {
    repaired: statements.length > 0,
    linkedExisting,
    createdProfiles,
    caregiverUsers: Number(report?.caregiverUsers || 0),
    caregiverProfiles: Number(report?.caregiverProfiles || 0),
    usersWithoutProfiles: Number(report?.usersWithoutProfiles || 0),
    profilesWithoutAccounts: Number(report?.profilesWithoutAccounts || 0),
  };
}

function encodedPath(value: string) {
  return value.split("/").filter(Boolean).map((part) => encodeURIComponent(part)).join("/");
}

async function latestStoredFileCheck(env: Env) {
  const latest = await env.DB.prepare(`SELECT id,original_name AS originalName,object_key AS objectKey,content_type AS contentType,size_bytes AS sizeBytes,created_at AS createdAt FROM stored_files WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)
    .first<{ id: string; originalName: string; objectKey: string; contentType: string; sizeBytes: number; createdAt: string }>();
  if (!latest) return { found: false, objectExists: false };

  const endpointRaw = str(env.PARSPACK_S3_ENDPOINT);
  const bucket = str(env.PARSPACK_S3_BUCKET);
  const accessKeyId = str(env.PARSPACK_S3_ACCESS_KEY);
  const secretAccessKey = str(env.PARSPACK_S3_SECRET_KEY);
  if (!endpointRaw || !bucket || !accessKeyId || !secretAccessKey) {
    return { found: true, objectExists: false, providerStatus: null, latest, error: "storage_not_configured" };
  }

  const endpoint = new URL(/^https?:\/\//i.test(endpointRaw) ? endpointRaw : `https://${endpointRaw}`);
  const segments = endpoint.pathname.split("/").filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  if (segments.at(-1) !== bucket) segments.push(bucket);
  endpoint.pathname = `/${segments.map((part) => encodeURIComponent(part)).join("/")}/${encodedPath(latest.objectKey)}`;
  endpoint.search = "";
  endpoint.hash = "";

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: str(env.PARSPACK_S3_REGION) || "us-east-1",
  });
  const response = await client.fetch(endpoint.toString(), { method: "HEAD" });
  return {
    found: true,
    objectExists: response.ok,
    providerStatus: response.status,
    latest: {
      id: latest.id,
      originalName: latest.originalName,
      contentType: latest.contentType,
      sizeBytes: latest.sizeBytes,
      createdAt: latest.createdAt,
    },
  };
}

export async function caregiverIntegrity(request: Request, env: Env, actor: AuthUser, repair = false) {
  const reconciliation = repair ? await reconcileCaregiverAccounts(env) : null;
  const latestFile = await latestStoredFileCheck(env);
  const report = reconciliation || await reconcileCaregiverAccounts(env);
  await audit(request, env, actor, repair ? "REPAIR_CAREGIVER_INTEGRITY" : "CHECK_CAREGIVER_INTEGRITY", "system", null, report);
  return json({ status: "ok", data: { accounts: report, latestFile } });
}
