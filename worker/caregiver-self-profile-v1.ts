import { invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import { caregiverProfileEditor } from "./caregiver-profile-editor";
import { invalidateRecruiterDirectoryCache } from "./recruiter-directory";
import { invalidateTrainingCaregiverCache } from "./training-caregivers";
import { uploadProfileImage } from "./profile-images";
import {
  type AuthUser,
  type Env,
  audit,
  fail,
  getUser,
  hashPassword,
  json,
  normalizeMobile,
  nowIso,
  readBody,
  securityHeaders,
  str,
} from "./lib";

type JsonRecord = Record<string, unknown>;

type ProfilePayload = {
  status?: string;
  data?: JsonRecord;
  message?: string;
};

const SELF_PROFILE_PATH = "/api/caregiver/platform/profile";
const SELF_AVATAR_PATH = "/api/caregiver/platform/profile/avatar";

function asAdmin(actor: AuthUser): AuthUser {
  return { ...actor, role: "ADMIN" };
}

function nullableText(value: unknown) {
  const text = str(value);
  return text || null;
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

function arrayValue(value: unknown, fallback: unknown[] = []) {
  if (Array.isArray(value)) return value.map((item) => str(item)).filter(Boolean);
  const text = str(value);
  if (!text) return fallback.map((item) => str(item)).filter(Boolean);
  return text.split(/[,،\n]/).map((item) => item.trim()).filter(Boolean);
}

function cleanNationalId(value: unknown) {
  const digits = str(value).replace(/\D/g, "");
  return digits || null;
}

function profileComplete(profile: JsonRecord) {
  return Boolean(
    str(profile.fullName)
    && /^09\d{9}$/.test(str(profile.mobile))
    && /^\d{10}$/.test(str(profile.nationalId))
    && str(profile.primaryType || profile.specialty)
    && str(profile.homeRegion || profile.city)
    && str(profile.activityRegion || profile.serviceRegion),
  );
}

async function canonicalProfileResponse(request: Request, env: Env, actor: AuthUser) {
  const url = new URL("/api/admin/caregiver-profile", request.url);
  url.searchParams.set("id", str(actor.caregiverId));
  return caregiverProfileEditor(new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  }), env, asAdmin(actor));
}

async function canonicalProfile(request: Request, env: Env, actor: AuthUser) {
  const response = await canonicalProfileResponse(request, env, actor);
  const payload = await response.json().catch(() => ({})) as ProfilePayload;
  if (!response.ok || !payload.data) {
    return { response, payload, profile: null as JsonRecord | null };
  }
  const specialtyResult = await env.DB.prepare(`SELECT skills_json AS specialtiesJson
    FROM caregivers WHERE id=? LIMIT 1`)
    .bind(actor.caregiverId)
    .first<{ specialtiesJson: string | null }>();
  let specialties: string[] = [];
  try {
    const parsed = JSON.parse(specialtyResult?.specialtiesJson || "[]");
    specialties = Array.isArray(parsed) ? parsed.map((item) => str(item)).filter(Boolean) : [];
  } catch {
    specialties = [];
  }
  const primary = str(payload.data.primaryType || payload.data.specialty);
  if (primary && !specialties.includes(primary)) specialties.unshift(primary);
  return {
    response,
    payload,
    profile: { ...payload.data, specialties },
  };
}

function publicProfile(profile: JsonRecord) {
  return {
    id: profile.id,
    userId: profile.userId,
    membershipCode: profile.membershipCode,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,
    fatherName: profile.fatherName,
    nationalId: profile.nationalId,
    gender: profile.gender,
    ageGroup: profile.ageGroup,
    age: profile.age,
    birthDate: profile.birthDate,
    mobile: profile.mobile,
    landline: profile.landline,
    dialect: profile.dialect,
    city: profile.city,
    homeRegion: profile.homeRegion || profile.city,
    serviceRegion: profile.serviceRegion,
    activityRegion: profile.activityRegion || profile.serviceRegion,
    specialty: profile.specialty || profile.primaryType,
    primaryType: profile.primaryType || profile.specialty,
    specialties: Array.isArray(profile.specialties) ? profile.specialties : [],
    acceptedShifts: Array.isArray(profile.acceptedShifts) ? profile.acceptedShifts : [],
    shiftServices: profile.shiftServices,
    motherAssistant: profile.motherAssistant,
    employed: profile.employed,
    workHistory: profile.workHistory,
    username: profile.username,
    avatarId: profile.avatarId,
    avatarUrl: profile.avatarUrl,
    accountStatus: profile.accountStatus,
    fileStatus: profile.fileStatus || profile.cooperationStatus,
    profileCompleted: Boolean(profile.profileCompleted),
    professionalLevel: profile.professionalLevel,
    professionalScore: profile.professionalScore,
    licenseStatus: profile.licenseStatus,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function getSelfProfile(request: Request, env: Env, actor: AuthUser) {
  const current = await canonicalProfile(request, env, actor);
  if (!current.profile) return current.response;
  return json({ status: "ok", data: publicProfile(current.profile), source: "canonical" });
}

async function duplicateCheck(
  env: Env,
  actor: AuthUser,
  caregiverId: string,
  nationalId: string | null,
  mobile: string,
  username: string,
) {
  const [nationalDuplicate, caregiverMobileDuplicate, userMobileDuplicate, usernameDuplicate] = await Promise.all([
    nationalId
      ? env.DB.prepare("SELECT id FROM caregivers WHERE national_id=? AND id<>? LIMIT 1")
        .bind(nationalId, caregiverId).first()
      : Promise.resolve(null),
    env.DB.prepare("SELECT id FROM caregivers WHERE mobile=? AND id<>? LIMIT 1")
      .bind(mobile, caregiverId).first(),
    env.DB.prepare("SELECT id FROM users WHERE mobile=? AND id<>? AND upper(status)<>'DELETED' LIMIT 1")
      .bind(mobile, actor.id).first(),
    env.DB.prepare("SELECT id FROM users WHERE lower(username)=? AND id<>? AND upper(status)<>'DELETED' LIMIT 1")
      .bind(username.toLowerCase(), actor.id).first(),
  ]);
  if (nationalDuplicate) return fail("این کد ملی به پرونده دیگری متصل است.", 409, "duplicate_national_id");
  if (caregiverMobileDuplicate || userMobileDuplicate) return fail("این شماره همراه قبلاً در سامانه استفاده شده است.", 409, "duplicate_mobile");
  if (usernameDuplicate) return fail("این نام کاربری قبلاً استفاده شده است.", 409, "duplicate_username");
  return null;
}

async function updateSelfProfile(request: Request, env: Env, actor: AuthUser) {
  const body = await readBody(request);
  if (!body) return fail("اطلاعات پروفایل معتبر نیست.");
  const caregiverId = str(actor.caregiverId);
  if (!caregiverId) return fail("پرونده مراقب به حساب شما متصل نیست.", 409, "caregiver_profile_not_linked");

  const currentResult = await canonicalProfile(request, env, actor);
  if (!currentResult.profile) return currentResult.response;
  const current = currentResult.profile;

  const firstName = body.firstName === undefined ? str(current.firstName) : str(body.firstName);
  const lastName = body.lastName === undefined ? str(current.lastName) : str(body.lastName);
  const fullName = str(body.fullName) || str(`${firstName} ${lastName}`) || str(current.fullName);
  const nationalId = body.nationalId === undefined
    ? cleanNationalId(current.nationalId)
    : cleanNationalId(body.nationalId);
  const mobileInput = body.mobile === undefined ? str(current.mobile) : str(body.mobile);
  const mobile = normalizeMobile(mobileInput) || "";
  const username = (body.username === undefined ? str(current.username) : str(body.username)).toLowerCase();
  const age = body.age === undefined ? integerOrNull(current.age) : integerOrNull(body.age);
  const birthDate = body.birthDate === undefined ? str(current.birthDate) : str(body.birthDate);
  const homeRegion = body.homeRegion === undefined
    ? str(current.homeRegion || current.city)
    : str(body.homeRegion);
  const activityRegion = body.activityRegion === undefined
    ? str(current.activityRegion || current.serviceRegion)
    : str(body.activityRegion);
  const primaryType = str(body.primaryType || body.specialty || current.primaryType || current.specialty);
  const currentSpecialties = Array.isArray(current.specialties) ? current.specialties : [];
  const specialties = body.specialties === undefined
    ? arrayValue(currentSpecialties)
    : arrayValue(body.specialties);
  if (primaryType && !specialties.includes(primaryType)) specialties.unshift(primaryType);
  const acceptedShifts = body.acceptedShifts === undefined && body.shiftServices === undefined
    ? arrayValue(current.acceptedShifts || current.shiftServices)
    : arrayValue(body.acceptedShifts ?? body.shiftServices);
  const password = str(body.password);

  if (fullName.length < 3) return fail("نام و نام خانوادگی را کامل وارد کنید.");
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");
  if (!/^09\d{9}$/.test(mobile)) return fail("شماره همراه باید با 09 شروع شود و ۱۱ رقم باشد.");
  if (!username) return fail("نام کاربری ورود الزامی است.");
  if (body.age !== undefined && str(body.age) && age === null) return fail("سن واردشده معتبر نیست.");
  if (password && password.length < 8) return fail("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.");

  const duplicate = await duplicateCheck(env, actor, caregiverId, nationalId, mobile, username);
  if (duplicate) return duplicate;

  const next: JsonRecord = {
    ...current,
    firstName,
    lastName,
    fullName,
    fatherName: body.fatherName === undefined ? current.fatherName : str(body.fatherName),
    nationalId,
    gender: body.gender === undefined ? current.gender : str(body.gender),
    ageGroup: body.ageGroup === undefined ? current.ageGroup : str(body.ageGroup),
    age,
    birthDate,
    mobile,
    landline: body.landline === undefined ? current.landline : str(body.landline),
    dialect: body.dialect === undefined ? current.dialect : str(body.dialect),
    homeRegion,
    city: homeRegion,
    activityRegion,
    serviceRegion: activityRegion,
    specialty: primaryType,
    primaryType,
    specialties,
    acceptedShifts,
    shiftServices: acceptedShifts.join("، "),
    motherAssistant: body.motherAssistant === undefined ? current.motherAssistant : str(body.motherAssistant),
    employed: body.employed === undefined ? current.employed : str(body.employed),
    workHistory: body.workHistory === undefined ? current.workHistory : str(body.workHistory),
    username,
  };
  next.profileCompleted = profileComplete(next);

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE caregivers SET
      national_id=?,full_name=?,mobile=?,city=?,service_region=?,birth_date=?,gender=?,
      primary_type=?,skills_json=?,accepted_shifts_json=?,work_history=?,profile_completed=?,
      last_synced_at=?,updated_at=? WHERE id=?`)
      .bind(
        nationalId,
        fullName,
        mobile,
        nullableText(homeRegion),
        nullableText(activityRegion),
        nullableText(birthDate),
        nullableText(next.gender),
        nullableText(primaryType),
        JSON.stringify(specialties),
        JSON.stringify(acceptedShifts),
        nullableText(next.workHistory),
        next.profileCompleted ? 1 : 0,
        timestamp,
        timestamp,
        caregiverId,
      ),
    env.DB.prepare(`INSERT INTO caregiver_crm_profiles(
      caregiver_id,first_name,last_name,father_name,age_group,age,panel_mobile_raw,
      mobile_raw,landline,shift_services,documents_completed,file_status,
      documents_delivered,dialect,home_region,specialty,activity_region,blacklisted,
      mother_assistant,employed,return_reason,return_date_raw,acquaintance_source,
      recovery_result,crm_owner,documents_updated_at_raw,documents_completed_at_raw,
      source_checksum,source_modified_at_raw,created_at_raw,raw_json,imported_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        nullableText(next.fatherName),
        nullableText(next.ageGroup),
        age,
        nullableText(current.panelMobileRaw),
        nullableText(current.mobileRaw || mobile),
        nullableText(next.landline),
        nullableText(next.shiftServices),
        nullableText(current.documentsCompleted),
        nullableText(current.fileStatus || current.cooperationStatus),
        nullableText(current.documentsDelivered),
        nullableText(next.dialect),
        nullableText(homeRegion),
        nullableText(primaryType),
        nullableText(activityRegion),
        boolValue(current.blacklisted) ? 1 : 0,
        nullableText(next.motherAssistant),
        nullableText(next.employed),
        nullableText(current.returnReason),
        nullableText(current.returnDateRaw),
        nullableText(current.acquaintanceSource),
        nullableText(current.recoveryResult),
        nullableText(current.crmOwner),
        nullableText(current.documentsUpdatedAtRaw),
        nullableText(current.documentsCompletedAtRaw),
        nullableText(current.sourceChecksum),
        nullableText(current.sourceModifiedAtRaw),
        nullableText(current.sourceCreatedAtRaw),
        JSON.stringify({ selfServiceEdit: true, editedAt: timestamp, specialties }),
        nullableText(current.importedAt) || timestamp,
        timestamp,
      ),
  ];

  const userFields = ["full_name=?", "mobile=?", "username=?", "updated_at=?"];
  const userValues: unknown[] = [fullName, mobile, username, timestamp];
  if (password) {
    userFields.push("password_hash=?");
    userValues.push(await hashPassword(password));
  }
  userValues.push(actor.id);
  statements.push(env.DB.prepare(`UPDATE users SET ${userFields.join(",")} WHERE id=? AND caregiver_id=?`)
    .bind(...userValues, caregiverId));

  await env.DB.batch(statements);
  invalidateAdminDirectoryCounts();
  invalidateCaregiverDirectoryCache();
  invalidateRecruiterDirectoryCache();
  invalidateTrainingCaregiverCache();
  await audit(request, env, actor, "SELF_UPDATE_CAREGIVER_PROFILE", "caregiver", caregiverId, {
    fields: Object.keys(body).filter((key) => key !== "password"),
    profileCompleted: next.profileCompleted,
    specialties,
  });

  const freshResult = await canonicalProfile(request, env, actor);
  if (!freshResult.profile) return freshResult.response;
  return json({
    status: "ok",
    data: publicProfile(freshResult.profile),
    source: "canonical",
    updatedAt: timestamp,
  });
}

async function updateSelfAvatar(request: Request, env: Env, actor: AuthUser) {
  const caregiverId = str(actor.caregiverId);
  if (!caregiverId) return fail("پرونده مراقب به حساب شما متصل نیست.", 409, "caregiver_profile_not_linked");
  const url = new URL("/api/profile-images", request.url);
  url.searchParams.set("caregiverId", caregiverId);
  const body = await request.arrayBuffer();
  const forwarded = new Request(url.toString(), {
    method: "POST",
    headers: request.headers,
    body,
  });
  const response = await uploadProfileImage(forwarded, env, actor);
  if (response.ok) {
    invalidateAdminDirectoryCounts();
    invalidateCaregiverDirectoryCache();
    invalidateRecruiterDirectoryCache();
    invalidateTrainingCaregiverCache();
  }
  return response;
}

export async function routeCaregiverSelfProfileV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  if (![SELF_PROFILE_PATH, SELF_AVATAR_PATH].includes(path)) return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) {
    return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only"));
  }

  let response: Response;
  if (path === SELF_PROFILE_PATH && method === "GET") response = await getSelfProfile(request, env, actor);
  else if (path === SELF_PROFILE_PATH && method === "PATCH") response = await updateSelfProfile(request, env, actor);
  else if (path === SELF_AVATAR_PATH && method === "POST") response = await updateSelfAvatar(request, env, actor);
  else response = fail("متد درخواست پشتیبانی نمی‌شود.", 405, "method_not_allowed");
  return securityHeaders(response);
}
