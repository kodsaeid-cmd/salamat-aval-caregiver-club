import {
  type AuthUser,
  type Env,
  audit,
  ensureSchema,
  fail,
  hashPassword,
  json,
  normalizeMobile,
  normalizeStatus,
  nowIso,
  readBody,
  str,
} from "./lib";
import { ensureProfileImageSchema } from "./profile-images";

let schemaReady: Promise<void> | undefined;

async function ensureCrmProfileSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS caregiver_crm_profiles (
      caregiver_id TEXT PRIMARY KEY,
      first_name TEXT,last_name TEXT,father_name TEXT,age_group TEXT,age INTEGER,
      panel_mobile_raw TEXT,mobile_raw TEXT,landline TEXT,shift_services TEXT,
      documents_completed TEXT,file_status TEXT,documents_delivered TEXT,dialect TEXT,
      home_region TEXT,specialty TEXT,activity_region TEXT,blacklisted INTEGER NOT NULL DEFAULT 0,
      mother_assistant TEXT,employed TEXT,return_reason TEXT,return_date_raw TEXT,
      acquaintance_source TEXT,recovery_result TEXT,crm_owner TEXT,
      documents_updated_at_raw TEXT,documents_completed_at_raw TEXT,
      source_checksum TEXT,source_modified_at_raw TEXT,created_at_raw TEXT,
      raw_json TEXT NOT NULL DEFAULT '{}',imported_at TEXT NOT NULL,updated_at TEXT NOT NULL,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE
    )`).run().then(() => undefined).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

function cleanNationalId(value: unknown) {
  const digits = str(value).replace(/\D/g, "");
  return digits ? (/^\d{10}$/.test(digits) ? digits : null) : null;
}

function cleanMembershipCode(value: unknown) {
  return str(value).replace(/\D/g, "");
}

function nullableText(value: unknown) {
  const text = str(value);
  return text || null;
}

function parseJsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(str(value) || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => str(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "بله", "بلی"].includes(str(value).toLowerCase());
}

function integerOrNull(value: unknown, min = 0, max = 150) {
  if (value === null || value === undefined || str(value) === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

async function getProfile(request: Request, env: Env) {
  const id = str(new URL(request.url).searchParams.get("id"));
  if (!id) return fail("شناسه پرونده ارسال نشده است.", 400, "caregiver_id_required");

  const row = await env.DB.prepare(`SELECT
      c.id,c.crm_record_id AS crmRecordId,c.membership_code AS membershipCode,
      c.national_id AS nationalId,c.full_name AS fullName,c.mobile,c.city,
      c.service_region AS serviceRegion,c.birth_date AS birthDate,
      c.cooperation_status AS cooperationStatus,c.active,c.gender,
      c.primary_type AS primaryType,c.accepted_shifts_json AS acceptedShiftsJson,
      c.work_history AS workHistory,c.profile_completed AS profileCompleted,
      c.professional_level AS professionalLevel,c.professional_score AS professionalScore,
      c.license_status AS licenseStatus,c.created_at AS createdAt,c.updated_at AS updatedAt,
      p.first_name AS firstName,p.last_name AS lastName,p.father_name AS fatherName,
      p.age_group AS ageGroup,p.age,p.panel_mobile_raw AS panelMobileRaw,
      p.mobile_raw AS mobileRaw,p.landline,p.shift_services AS shiftServices,
      p.documents_completed AS documentsCompleted,p.file_status AS fileStatus,
      p.documents_delivered AS documentsDelivered,p.dialect,p.home_region AS homeRegion,
      p.specialty,p.activity_region AS activityRegion,p.blacklisted,
      p.mother_assistant AS motherAssistant,p.employed,p.return_reason AS returnReason,
      p.return_date_raw AS returnDateRaw,p.acquaintance_source AS acquaintanceSource,
      p.recovery_result AS recoveryResult,p.crm_owner AS crmOwner,
      p.documents_updated_at_raw AS documentsUpdatedAtRaw,
      p.documents_completed_at_raw AS documentsCompletedAtRaw,
      p.source_checksum AS sourceChecksum,p.source_modified_at_raw AS sourceModifiedAtRaw,
      p.created_at_raw AS sourceCreatedAtRaw,p.imported_at AS importedAt,p.updated_at AS crmProfileUpdatedAt,
      u.id AS userId,u.username,u.status AS accountStatus,u.role AS accountRole,
      u.last_login_at AS lastLoginAt,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.caregiver_id=c.id OR (u.id IS NOT NULL AND pi.user_id=u.id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM caregivers c
    LEFT JOIN caregiver_crm_profiles p ON p.caregiver_id=c.id
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    WHERE c.id=? AND (c.cooperation_status IS NULL OR c.cooperation_status<>'حذف‌شده')
    LIMIT 1`)
    .bind(id)
    .first<Record<string, unknown>>();

  if (!row) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  return json({
    status: "ok",
    data: {
      ...row,
      acceptedShifts: parseJsonArray(row.acceptedShiftsJson),
      acceptedShiftsJson: undefined,
      blacklisted: Number(row.blacklisted || 0) === 1,
      active: Number(row.active || 0) === 1,
      profileCompleted: Number(row.profileCompleted || 0) === 1,
      avatarUrl: row.avatarId
        ? `/api/profile-images/${encodeURIComponent(str(row.avatarId))}`
        : null,
    },
  });
}

async function updateProfile(request: Request, env: Env, actor: AuthUser) {
  const body = await readBody(request);
  if (!body) return fail("اطلاعات پرونده معتبر نیست.");

  const caregiverId = str(body.caregiverId || body.id);
  if (!caregiverId) return fail("شناسه پرونده ارسال نشده است.", 400, "caregiver_id_required");

  const current = await env.DB.prepare(`SELECT
      c.id,c.crm_record_id AS crmRecordId,c.membership_code AS membershipCode,
      c.full_name AS fullName,c.mobile,u.id AS userId,u.username
    FROM caregivers c
    LEFT JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED'
    WHERE c.id=? LIMIT 1`)
    .bind(caregiverId)
    .first<Record<string, unknown>>();
  if (!current) return fail("پرونده مراقب پیدا نشد.", 404, "caregiver_not_found");

  const crmRecordId = str(body.crmRecordId || current.crmRecordId);
  const membershipCode = cleanMembershipCode(body.membershipCode || current.membershipCode);
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const fullName = str(body.fullName) || str(`${firstName} ${lastName}`);
  const nationalId = cleanNationalId(body.nationalId);
  const mobileText = str(body.mobile);
  const mobile = mobileText ? normalizeMobile(mobileText) : null;
  const age = integerOrNull(body.age);

  if (!crmRecordId) return fail("شناسه CRM الزامی است.");
  if (!membershipCode) return fail("شماره پرونده الزامی است.");
  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (str(body.nationalId) && !nationalId) return fail("کد ملی باید ۱۰ رقم باشد.");
  if (mobileText && !mobile) return fail("شماره همراه معتبر نیست.");
  if (str(body.age) && age === null) return fail("سن واردشده معتبر نیست.");

  const [duplicateCrm, duplicateCode, duplicateNational] = await Promise.all([
    env.DB.prepare("SELECT id FROM caregivers WHERE crm_record_id=? AND id<>? LIMIT 1")
      .bind(crmRecordId, caregiverId).first(),
    env.DB.prepare("SELECT id FROM caregivers WHERE membership_code=? AND id<>? LIMIT 1")
      .bind(membershipCode, caregiverId).first(),
    nationalId
      ? env.DB.prepare("SELECT id FROM caregivers WHERE national_id=? AND id<>? LIMIT 1")
        .bind(nationalId, caregiverId).first()
      : Promise.resolve(null),
  ]);
  if (duplicateCrm) return fail("این شناسه CRM به پرونده دیگری متصل است.", 409, "duplicate_crm_record");
  if (duplicateCode) return fail("این شماره پرونده قبلاً ثبت شده است.", 409, "duplicate_membership_code");
  if (duplicateNational) return fail("این کد ملی به پرونده دیگری متصل است.", 409, "duplicate_national_id");

  const timestamp = nowIso();
  const blacklisted = boolValue(body.blacklisted);
  const active = blacklisted ? false : (body.active === undefined ? true : boolValue(body.active));
  const acceptedShifts = Array.isArray(body.acceptedShifts)
    ? body.acceptedShifts.map((item: unknown) => str(item)).filter(Boolean)
    : str(body.shiftServices).split(/[,،]/).map((item) => item.trim()).filter(Boolean);
  const profileCompleted = body.profileCompleted === undefined
    ? boolValue(body.documentsCompleted)
    : boolValue(body.profileCompleted);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE caregivers SET
      crm_record_id=?,membership_code=?,national_id=?,full_name=?,mobile=?,city=?,
      service_region=?,birth_date=?,cooperation_status=?,active=?,gender=?,primary_type=?,
      accepted_shifts_json=?,work_history=?,profile_completed=?,last_synced_at=?,updated_at=?
      WHERE id=?`)
      .bind(
        crmRecordId,
        membershipCode,
        nationalId,
        fullName,
        mobile,
        nullableText(body.homeRegion || body.city),
        nullableText(body.activityRegion || body.serviceRegion),
        nullableText(body.birthDate),
        nullableText(body.fileStatus || body.cooperationStatus),
        active ? 1 : 0,
        nullableText(body.gender),
        nullableText(body.specialty || body.primaryType),
        JSON.stringify(acceptedShifts),
        nullableText(body.workHistory),
        profileCompleted ? 1 : 0,
        timestamp,
        timestamp,
        caregiverId,
      )),
    env.DB.prepare(`INSERT INTO caregiver_crm_profiles(
      caregiver_id,first_name,last_name,father_name,age_group,age,panel_mobile_raw,
      mobile_raw,landline,shift_services,documents_completed,file_status,
      documents_delivered,dialect,home_region,specialty,activity_region,blacklisted,
      mother_assistant,employed,return_reason,return_date_raw,acquaintance_source,
      recovery_result,crm_owner,documents_updated_at_raw,documents_completed_at_raw,
      source_checksum,source_modified_at_raw,created_at_raw,raw_json,imported_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?)
    ON CONFLICT(caregiver_id) DO UPDATE SET
      first_name=excluded.first_name,last_name=excluded.last_name,father_name=excluded.father_name,
      age_group=excluded.age_group,age=excluded.age,panel_mobile_raw=excluded.panel_mobile_raw,
      mobile_raw=excluded.mobile_raw,landline=excluded.landline,shift_services=excluded.shift_services,
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
      created_at_raw=excluded.created_at_raw,updated_at=excluded.updated_at`)
      .bind(
        caregiverId,
        nullableText(firstName),
        nullableText(lastName),
        nullableText(body.fatherName),
        nullableText(body.ageGroup),
        age,
        nullableText(body.panelMobileRaw),
        nullableText(body.mobileRaw),
        nullableText(body.landline),
        nullableText(body.shiftServices),
        nullableText(body.documentsCompleted),
        nullableText(body.fileStatus || body.cooperationStatus),
        nullableText(body.documentsDelivered),
        nullableText(body.dialect),
        nullableText(body.homeRegion || body.city),
        nullableText(body.specialty || body.primaryType),
        nullableText(body.activityRegion || body.serviceRegion),
        blacklisted ? 1 : 0,
        nullableText(body.motherAssistant),
        nullableText(body.employed),
        nullableText(body.returnReason),
        nullableText(body.returnDateRaw),
        nullableText(body.acquaintanceSource),
        nullableText(body.recoveryResult),
        nullableText(body.crmOwner),
        nullableText(body.documentsUpdatedAtRaw),
        nullableText(body.documentsCompletedAtRaw),
        nullableText(body.sourceChecksum),
        nullableText(body.sourceModifiedAtRaw),
        nullableText(body.sourceCreatedAtRaw),
        JSON.stringify({ manualEdit: true, editedAt: timestamp }),
        timestamp,
        timestamp,
      ),
  ];

  const userId = str(current.userId);
  if (userId) {
    const username = str(body.username || membershipCode).toLowerCase();
    if (!username) return fail("نام کاربری حساب الزامی است.");
    const duplicateUsername = await env.DB.prepare("SELECT id FROM users WHERE lower(username)=? AND id<>? LIMIT 1")
      .bind(username, userId).first();
    if (duplicateUsername) return fail("این نام کاربری قبلاً استفاده شده است.", 409, "duplicate_username");

    const accountStatus = blacklisted
      ? "SUSPENDED"
      : (body.accountStatus === undefined ? null : normalizeStatus(body.accountStatus, "ACTIVE"));
    const fields = ["full_name=?", "username=?", "updated_at=?"];
    const values: unknown[] = [fullName, username, timestamp];
    if (accountStatus) {
      fields.push("status=?");
      values.push(accountStatus);
    }
    if (str(body.password)) {
      const password = str(body.password);
      if (password.length < 8) return fail("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      fields.push("password_hash=?");
      values.push(await hashPassword(password));
    }
    values.push(userId);
    statements.push(env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).bind(...values));
  }

  await env.DB.batch(statements);
  await audit(request, env, actor, "UPDATE_CAREGIVER_CRM_PROFILE", "caregiver", caregiverId, {
    membershipCode,
    crmRecordId,
    blacklisted,
    active,
    manuallyEdited: true,
  });

  return json({ status: "ok", data: { caregiverId, membershipCode, updatedAt: timestamp } });
}

export async function caregiverProfileEditor(request: Request, env: Env, actor: AuthUser) {
  if (actor.role.toUpperCase() !== "ADMIN") {
    return fail("دسترسی کافی ندارید.", 403, "forbidden");
  }
  await ensureSchema(env);
  await ensureProfileImageSchema(env);
  await ensureCrmProfileSchema(env);

  const method = request.method.toUpperCase();
  if (method === "GET") return getProfile(request, env);
  if (method === "PATCH") return updateProfile(request, env, actor);
  return fail("متد درخواست پشتیبانی نمی‌شود.", 405, "method_not_allowed");
}
