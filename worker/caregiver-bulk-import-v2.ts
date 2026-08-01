import {
  type AuthUser,
  type Env,
  fail,
  hashPassword,
  json,
  normalizeMobile,
  nowIso,
  randomId,
  readBody,
  sha256,
  str,
} from "./lib";

const MAX_BATCH = 25;
let schemaReady: Promise<void> | undefined;
const passwordHashes = new Map<string, Promise<string>>();

type ImportItem = {
  crmRecordId: string;
  membershipCode: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  fatherName?: string | null;
  gender?: string | null;
  ageGroup?: string | null;
  age?: number | null;
  nationalId?: string | null;
  mobile?: string | null;
  panelMobileRaw?: string | null;
  mobileRaw?: string | null;
  landline?: string | null;
  shiftServices?: string | null;
  documentsCompleted?: string | null;
  fileStatus?: string | null;
  documentsDelivered?: string | null;
  dialect?: string | null;
  homeRegion?: string | null;
  specialty?: string | null;
  activityRegion?: string | null;
  blacklisted?: boolean;
  motherAssistant?: string | null;
  employed?: string | null;
  returnReason?: string | null;
  returnDateRaw?: string | null;
  acquaintanceSource?: string | null;
  recoveryResult?: string | null;
  crmOwner?: string | null;
  documentsUpdatedAtRaw?: string | null;
  documentsCompletedAtRaw?: string | null;
  sourceChecksum?: string | null;
  sourceModifiedAtRaw?: string | null;
  createdAtRaw?: string | null;
};

type ExistingCaregiver = {
  id: string;
  crmRecordId: string;
  membershipCode: string;
  sourceChecksum: string | null;
};

type ExistingUser = {
  id: string;
  caregiverId: string | null;
  username: string | null;
  status: string;
};

async function ensureImportSchema(env: Env) {
  if (!schemaReady) {
    const statements = [
      `CREATE TABLE IF NOT EXISTS caregiver_crm_profiles (
        caregiver_id TEXT PRIMARY KEY,
        first_name TEXT,last_name TEXT,father_name TEXT,age_group TEXT,age INTEGER,
        panel_mobile_raw TEXT,mobile_raw TEXT,landline TEXT,shift_services TEXT,
        documents_completed TEXT,file_status TEXT,documents_delivered TEXT,dialect TEXT,
        home_region TEXT,specialty TEXT,activity_region TEXT,blacklisted INTEGER NOT NULL DEFAULT 0,
        mother_assistant TEXT,employed TEXT,return_reason TEXT,return_date_raw TEXT,
        acquaintance_source TEXT,recovery_result TEXT,crm_owner TEXT,
        documents_updated_at_raw TEXT,documents_completed_at_raw TEXT,
        source_checksum TEXT,source_modified_at_raw TEXT,created_at_raw TEXT,
        raw_json TEXT NOT NULL,imported_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_caregiver_crm_profiles_blacklisted
        ON caregiver_crm_profiles(blacklisted)`,
      `CREATE TABLE IF NOT EXISTS caregiver_import_runs (
        id TEXT PRIMARY KEY,actor_user_id TEXT,filename TEXT,
        received_count INTEGER NOT NULL DEFAULT 0,created_profiles INTEGER NOT NULL DEFAULT 0,
        updated_profiles INTEGER NOT NULL DEFAULT 0,created_accounts INTEGER NOT NULL DEFAULT 0,
        updated_accounts INTEGER NOT NULL DEFAULT 0,failed_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
    ];
    schemaReady = env.DB.batch(statements.map((sql) => env.DB.prepare(sql)))
      .then(() => undefined)
      .catch((error) => {
        schemaReady = undefined;
        throw error;
      });
  }
  return schemaReady;
}

function cleanDigits(value: unknown) {
  return str(value).replace(/\D/g, "");
}

function canonicalNationalId(value: unknown) {
  const digits = cleanDigits(value);
  return /^\d{10}$/.test(digits) ? digits : null;
}

function stableCaregiverId(crmRecordId: string) {
  const compact = crmRecordId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `crm_${compact || crypto.randomUUID().replaceAll("-", "")}`;
}

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(",");
}

function profileCompleted(value: unknown) {
  return ["بله", "بلی", "yes", "true", "1"].includes(str(value).toLowerCase()) ? 1 : 0;
}

function isFatalD1Error(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /(quota|limit.*exceed|exceed.*limit|daily.*limit|too many queries|overloaded|database is locked)/i.test(message);
}

async function sharedPasswordHash(password: string) {
  const key = await sha256(password);
  let pending = passwordHashes.get(key);
  if (!pending) {
    pending = hashPassword(password);
    passwordHashes.set(key, pending);
  }
  return pending;
}

export async function importCaregiverBatchV2(
  request: Request,
  env: Env,
  actor: AuthUser,
) {
  if (actor.role.toUpperCase() !== "ADMIN") {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }
  await ensureImportSchema(env);

  const body = await readBody(request);
  const rows = Array.isArray(body?.caregivers) ? body.caregivers as ImportItem[] : [];
  const initialPassword = str(body?.initialPassword);
  const importId = str(body?.importId) || randomId("imp_");
  const filename = str(body?.filename) || null;

  if (!rows.length) return fail("فهرست مراقبین خالی است.");
  if (rows.length > MAX_BATCH) {
    return fail(`حداکثر ${MAX_BATCH} پرونده در هر درخواست قابل ثبت است.`, 413, "batch_too_large");
  }
  if (initialPassword.length < 8) return fail("رمز اولیه باید حداقل ۸ کاراکتر باشد.");

  const normalized = rows.map((value) => ({
    ...value,
    crmRecordId: str(value?.crmRecordId),
    membershipCode: cleanDigits(value?.membershipCode),
    fullName: str(value?.fullName),
    mobile: normalizeMobile(str(value?.mobile)) || null,
    nationalId: canonicalNationalId(value?.nationalId),
    sourceChecksum: str(value?.sourceChecksum) || null,
  })).filter((value) => value.crmRecordId && value.membershipCode && value.fullName);

  if (!normalized.length) return fail("هیچ پرونده معتبری برای ثبت پیدا نشد.");

  const crmIds = [...new Set(normalized.map((item) => item.crmRecordId))];
  const codes = [...new Set(normalized.map((item) => item.membershipCode))];
  const caregiverResult = await env.DB.prepare(`SELECT
      c.id,c.crm_record_id AS crmRecordId,c.membership_code AS membershipCode,
      p.source_checksum AS sourceChecksum
    FROM caregivers c
    LEFT JOIN caregiver_crm_profiles p ON p.caregiver_id=c.id
    WHERE c.crm_record_id IN (${placeholders(crmIds.length)})
       OR c.membership_code IN (${placeholders(codes.length)})`)
    .bind(...crmIds, ...codes)
    .all<ExistingCaregiver>();

  const caregiverByCrm = new Map<string, ExistingCaregiver>();
  const caregiverByCode = new Map<string, ExistingCaregiver>();
  for (const row of caregiverResult.results || []) {
    caregiverByCrm.set(row.crmRecordId, row);
    caregiverByCode.set(row.membershipCode, row);
  }

  const candidateIds = normalized.map((item) => caregiverByCrm.get(item.crmRecordId)?.id
    || caregiverByCode.get(item.membershipCode)?.id
    || stableCaregiverId(item.crmRecordId));
  const userResult = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,username,status
    FROM users
    WHERE caregiver_id IN (${placeholders(candidateIds.length)})
       OR username IN (${placeholders(codes.length)})`)
    .bind(...candidateIds, ...codes)
    .all<ExistingUser>();
  const userByCaregiver = new Map<string, ExistingUser>();
  const userByUsername = new Map<string, ExistingUser>();
  for (const row of userResult.results || []) {
    if (row.caregiverId) userByCaregiver.set(row.caregiverId, row);
    if (row.username) userByUsername.set(row.username, row);
  }

  const nationalIds = [...new Set(normalized
    .map((item) => item.nationalId)
    .filter((value): value is string => Boolean(value)))];
  const nationalResult = nationalIds.length
    ? await env.DB.prepare(`SELECT id,national_id AS nationalId FROM caregivers
        WHERE national_id IN (${placeholders(nationalIds.length)})`)
      .bind(...nationalIds)
      .all<{ id: string; nationalId: string }>()
    : { results: [] as Array<{ id: string; nationalId: string }> };
  const nationalOwner = new Map((nationalResult.results || []).map((row) => [row.nationalId, row.id]));
  const claimedNational = new Set<string>();

  let createdProfiles = 0;
  let updatedProfiles = 0;
  let createdAccounts = 0;
  let updatedAccounts = 0;
  let skippedUnchanged = 0;
  const failures: Array<{ membershipCode: string; message: string; detail?: string }> = [];
  const timestamp = nowIso();
  let passwordHash: string | null = null;

  for (let index = 0; index < normalized.length; index += 1) {
    const item = normalized[index];
    const byCrm = caregiverByCrm.get(item.crmRecordId) || null;
    const byCode = caregiverByCode.get(item.membershipCode) || null;
    if (byCrm && byCode && byCrm.id !== byCode.id) {
      failures.push({
        membershipCode: item.membershipCode,
        message: "شماره پرونده و شناسه CRM به دو مراقب متفاوت متصل هستند.",
      });
      continue;
    }

    const existing = byCrm || byCode;
    const caregiverId = existing?.id || candidateIds[index];
    const byCaregiverUser = userByCaregiver.get(caregiverId) || null;
    const byUsernameUser = userByUsername.get(item.membershipCode) || null;
    if (byCaregiverUser && byUsernameUser && byCaregiverUser.id !== byUsernameUser.id) {
      failures.push({
        membershipCode: item.membershipCode,
        message: "نام کاربری و پرونده به دو حساب متفاوت متصل هستند.",
      });
      continue;
    }
    const userExisting = byCaregiverUser || byUsernameUser;
    const accountStatus = item.blacklisted ? "SUSPENDED" : "ACTIVE";

    const checksumMatches = Boolean(
      existing
      && item.sourceChecksum
      && existing.sourceChecksum
      && item.sourceChecksum === existing.sourceChecksum,
    );
    const accountMatches = Boolean(
      userExisting
      && userExisting.caregiverId === caregiverId
      && str(userExisting.username) === item.membershipCode
      && str(userExisting.status).toUpperCase() === accountStatus,
    );
    if (checksumMatches && accountMatches) {
      skippedUnchanged += 1;
      continue;
    }

    const statements: D1PreparedStatement[] = [];
    if (existing) {
      statements.push(env.DB.prepare(`UPDATE caregivers SET
        crm_record_id=?,membership_code=?,full_name=?,mobile=?,city=?,service_region=?,
        cooperation_status=?,active=?,gender=?,primary_type=?,accepted_shifts_json=?,
        profile_completed=?,last_synced_at=?,updated_at=? WHERE id=?`)
        .bind(
          item.crmRecordId,item.membershipCode,item.fullName,item.mobile,
          str(item.homeRegion) || null,str(item.activityRegion) || null,
          str(item.fileStatus) || null,item.blacklisted ? 0 : 1,
          str(item.gender) || null,str(item.specialty) || null,
          JSON.stringify(str(item.shiftServices) ? [str(item.shiftServices)] : []),
          profileCompleted(item.documentsCompleted),timestamp,timestamp,caregiverId,
        ));
    } else {
      statements.push(env.DB.prepare(`INSERT INTO caregivers(
        id,crm_record_id,membership_code,national_id,full_name,mobile,province,city,
        service_region,cooperation_status,active,crm_modified_on,last_synced_at,
        created_at,updated_at,gender,primary_type,accepted_shifts_json,
        recruitment_stage,professional_level,profile_completed
      ) VALUES(?,?,?,NULL,?,?,NULL,?,?,?,?,NULL,?,?,?,?,?,?,'CRM_IMPORTED','NEW',?)`)
        .bind(
          caregiverId,item.crmRecordId,item.membershipCode,item.fullName,item.mobile,
          str(item.homeRegion) || null,str(item.activityRegion) || null,
          str(item.fileStatus) || null,item.blacklisted ? 0 : 1,
          timestamp,timestamp,timestamp,str(item.gender) || null,
          str(item.specialty) || null,
          JSON.stringify(str(item.shiftServices) ? [str(item.shiftServices)] : []),
          profileCompleted(item.documentsCompleted),
        ));
    }

    const nationalId = item.nationalId;
    if (nationalId
      && !claimedNational.has(nationalId)
      && (!nationalOwner.has(nationalId) || nationalOwner.get(nationalId) === caregiverId)) {
      claimedNational.add(nationalId);
      statements.push(env.DB.prepare("UPDATE caregivers SET national_id=? WHERE id=?")
        .bind(nationalId, caregiverId));
    }

    statements.push(env.DB.prepare(`INSERT INTO caregiver_crm_profiles(
      caregiver_id,first_name,last_name,father_name,age_group,age,panel_mobile_raw,
      mobile_raw,landline,shift_services,documents_completed,file_status,
      documents_delivered,dialect,home_region,specialty,activity_region,blacklisted,
      mother_assistant,employed,return_reason,return_date_raw,acquaintance_source,
      recovery_result,crm_owner,documents_updated_at_raw,documents_completed_at_raw,
      source_checksum,source_modified_at_raw,created_at_raw,raw_json,imported_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(caregiver_id) DO UPDATE SET
      first_name=excluded.first_name,last_name=excluded.last_name,
      father_name=excluded.father_name,age_group=excluded.age_group,age=excluded.age,
      panel_mobile_raw=excluded.panel_mobile_raw,mobile_raw=excluded.mobile_raw,
      landline=excluded.landline,shift_services=excluded.shift_services,
      documents_completed=excluded.documents_completed,file_status=excluded.file_status,
      documents_delivered=excluded.documents_delivered,dialect=excluded.dialect,
      home_region=excluded.home_region,specialty=excluded.specialty,
      activity_region=excluded.activity_region,blacklisted=excluded.blacklisted,
      mother_assistant=excluded.mother_assistant,employed=excluded.employed,
      return_reason=excluded.return_reason,return_date_raw=excluded.return_date_raw,
      acquaintance_source=excluded.acquaintance_source,recovery_result=excluded.recovery_result,
      crm_owner=excluded.crm_owner,documents_updated_at_raw=excluded.documents_updated_at_raw,
      documents_completed_at_raw=excluded.documents_completed_at_raw,
      source_checksum=excluded.source_checksum,source_modified_at_raw=excluded.source_modified_at_raw,
      created_at_raw=excluded.created_at_raw,raw_json=excluded.raw_json,updated_at=excluded.updated_at`)
      .bind(
        caregiverId,str(item.firstName) || null,str(item.lastName) || null,
        str(item.fatherName) || null,str(item.ageGroup) || null,
        Number.isFinite(Number(item.age)) ? Math.trunc(Number(item.age)) : null,
        str(item.panelMobileRaw) || null,str(item.mobileRaw) || null,
        str(item.landline) || null,str(item.shiftServices) || null,
        str(item.documentsCompleted) || null,str(item.fileStatus) || null,
        str(item.documentsDelivered) || null,str(item.dialect) || null,
        str(item.homeRegion) || null,str(item.specialty) || null,
        str(item.activityRegion) || null,item.blacklisted ? 1 : 0,
        str(item.motherAssistant) || null,str(item.employed) || null,
        str(item.returnReason) || null,str(item.returnDateRaw) || null,
        str(item.acquaintanceSource) || null,str(item.recoveryResult) || null,
        str(item.crmOwner) || null,str(item.documentsUpdatedAtRaw) || null,
        str(item.documentsCompletedAtRaw) || null,item.sourceChecksum,
        str(item.sourceModifiedAtRaw) || null,str(item.createdAtRaw) || null,
        JSON.stringify({
          crmRecordId: item.crmRecordId,
          membershipCode: item.membershipCode,
          sourceChecksum: item.sourceChecksum,
        }),timestamp,timestamp,
      ));

    if (userExisting) {
      statements.push(env.DB.prepare(`UPDATE users SET
        caregiver_id=?,full_name=?,username=?,status=?,updated_at=? WHERE id=?`)
        .bind(caregiverId,item.fullName,item.membershipCode,accountStatus,timestamp,userExisting.id));
    } else {
      if (!passwordHash) passwordHash = await sharedPasswordHash(initialPassword);
      statements.push(env.DB.prepare(`INSERT INTO users(
        id,caregiver_id,full_name,mobile,username,password_hash,role,status,
        permissions_json,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,'CAREGIVER',?,'[]',?,?)`)
        .bind(
          randomId("usr_"),caregiverId,item.fullName,
          `crm-login-${item.membershipCode}`,item.membershipCode,passwordHash,
          accountStatus,timestamp,timestamp,
        ));
    }

    try {
      await env.DB.batch(statements);
      if (existing) updatedProfiles += 1; else createdProfiles += 1;
      if (userExisting) updatedAccounts += 1; else createdAccounts += 1;
      const storedCaregiver: ExistingCaregiver = {
        id: caregiverId,
        crmRecordId: item.crmRecordId,
        membershipCode: item.membershipCode,
        sourceChecksum: item.sourceChecksum,
      };
      caregiverByCrm.set(item.crmRecordId, storedCaregiver);
      caregiverByCode.set(item.membershipCode, storedCaregiver);
    } catch (error) {
      if (isFatalD1Error(error)) throw error;
      failures.push({
        membershipCode: item.membershipCode,
        message: "ثبت این پرونده انجام نشد.",
        detail: error instanceof Error ? error.message : "database_error",
      });
    }
  }

  const changed = createdProfiles + updatedProfiles + createdAccounts + updatedAccounts;
  if (changed || failures.length) {
    await env.DB.prepare(`INSERT INTO caregiver_import_runs(
      id,actor_user_id,filename,received_count,created_profiles,updated_profiles,
      created_accounts,updated_accounts,failed_count,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      received_count=received_count+excluded.received_count,
      created_profiles=created_profiles+excluded.created_profiles,
      updated_profiles=updated_profiles+excluded.updated_profiles,
      created_accounts=created_accounts+excluded.created_accounts,
      updated_accounts=updated_accounts+excluded.updated_accounts,
      failed_count=failed_count+excluded.failed_count,
      updated_at=excluded.updated_at`)
      .bind(
        importId,actor.id,filename,normalized.length,createdProfiles,updatedProfiles,
        createdAccounts,updatedAccounts,failures.length,timestamp,timestamp,
      ).run().catch(() => undefined);
  }

  return json({
    data: {
      importId,
      received: rows.length,
      valid: normalized.length,
      createdProfiles,
      updatedProfiles,
      createdAccounts,
      updatedAccounts,
      skippedUnchanged,
      failed: failures.length + (rows.length - normalized.length),
      failures: failures.slice(0, 25),
    },
  });
}
