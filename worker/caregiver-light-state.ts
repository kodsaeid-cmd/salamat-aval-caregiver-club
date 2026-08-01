import { pruneServerManagedCollections } from "./admin-light-state";
import { type AuthUser, type Env, json, str } from "./lib";

type JsonRecord = Record<string, unknown>;

function parse(value: unknown): JsonRecord {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : {};
  } catch {
    return {};
  }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object")) : [];
}

function matchesCaregiver(item: JsonRecord, ids: Set<string>, key = "caregiverId") {
  return ids.has(str(item[key]));
}

export async function caregiverLightState(env: Env, actor: AuthUser) {
  const [orgRow, personalRow, caregiver] = await Promise.all([
    env.DB.prepare("SELECT state_json AS stateJson,updated_at AS updatedAt FROM ui_state WHERE scope='ORG' LIMIT 1")
      .first<{ stateJson: string; updatedAt: string }>(),
    env.DB.prepare("SELECT state_json AS stateJson,updated_at AS updatedAt FROM ui_state WHERE scope=? LIMIT 1")
      .bind(`USER:${actor.id}`)
      .first<{ stateJson: string; updatedAt: string }>(),
    actor.caregiverId
      ? env.DB.prepare(`SELECT
          id,membership_code AS membershipCode,national_id AS nationalId,full_name AS fullName,mobile,
          city,service_region AS address,birth_date AS birthDate,cooperation_status AS fileStatus,
          primary_type AS primaryType,work_history AS workHistory,professional_level AS professionalLevel,
          professional_score AS professionalScore,license_status AS licenseStatus,created_at AS createdAt
        FROM caregivers WHERE id=? LIMIT 1`)
        .bind(actor.caregiverId)
        .first<Record<string, unknown>>()
      : Promise.resolve(null),
  ]);

  const orgState = pruneServerManagedCollections(parse(orgRow?.stateJson));
  const personalState = parse(personalRow?.stateJson);
  const membershipCode = str(caregiver?.membershipCode || caregiver?.id || actor.caregiverId);
  const backendId = str(caregiver?.id || actor.caregiverId);
  const ids = new Set([membershipCode, backendId].filter(Boolean));
  const admin = record(orgState.admin);
  const evaluation = record(orgState.evaluation);

  const assignments = rows(admin.assignments).filter((item) => matchesCaregiver(item, ids));
  const trainingIds = new Set(assignments.map((item) => str(item.trainingId || item.courseId)).filter(Boolean));
  const self = caregiver ? {
    id: membershipCode,
    backendId,
    name: caregiver.fullName,
    fullName: caregiver.fullName,
    phone: caregiver.mobile,
    mobile: caregiver.mobile,
    nationalId: caregiver.nationalId,
    serviceGroup: caregiver.primaryType || "مراقبت سالمند",
    fileStatus: caregiver.fileStatus || "در انتظار بررسی",
    createdAt: caregiver.createdAt,
    rank: {
      code: "",
      title: caregiver.professionalLevel || "در انتظار ارزیابی",
      stars: 0,
      pri: caregiver.professionalScore || null,
      decisionRef: "",
      validFrom: "",
      validTo: "",
    },
    license: {
      number: "",
      status: caregiver.licenseStatus || "ثبت نشده",
      issuedAt: "",
      expiresAt: "",
      decisionRef: "",
    },
    profile: {
      city: caregiver.city || "",
      birthDate: caregiver.birthDate || "",
      address: caregiver.address || "",
      skills: "",
      bio: caregiver.workHistory || "",
    },
  } : null;

  const state: JsonRecord = {
    ...orgState,
    auth: {
      users: [{
        id: actor.id,
        caregiverId: backendId || null,
        name: actor.fullName,
        username: actor.username,
        email: actor.username,
        mobile: actor.mobile,
        role: actor.role.toLowerCase(),
        status: "approved",
      }],
      audit: [],
    },
    evaluation: {
      ...evaluation,
      caregivers: self ? [self] : [],
      periods: rows(evaluation.periods).filter((item) => matchesCaregiver(item, ids)),
      events: rows(evaluation.events).filter((item) => matchesCaregiver(item, ids)),
      training: rows(evaluation.training).filter((item) => matchesCaregiver(item, ids)),
      complaints: rows(evaluation.complaints).filter((item) => matchesCaregiver(item, ids)),
      appeals: rows(evaluation.appeals).filter((item) => matchesCaregiver(item, ids)),
      correctiveActions: rows(evaluation.correctiveActions).filter((item) => matchesCaregiver(item, ids)),
      committeeDecisions: rows(evaluation.committeeDecisions).filter((item) => matchesCaregiver(item, ids)),
      audit: [],
    },
    admin: {
      ...admin,
      contracts: rows(admin.contracts).filter((item) => matchesCaregiver(item, ids)),
      payroll: rows(admin.payroll).filter((item) => matchesCaregiver(item, ids)),
      assignments,
      trainingLibrary: rows(admin.trainingLibrary).filter((item) => trainingIds.has(str(item.id))),
      tickets: rows(admin.tickets).filter((item) => matchesCaregiver(item, ids)),
      securityReports: rows(admin.securityReports).filter((item) => matchesCaregiver(item, ids)),
      audit: [],
      ui: { ...record(admin.ui), caregiverId: membershipCode },
    },
  };

  for (const key of ["caregiverPanel", "evaluationV1"]) {
    if (personalState[key] !== undefined) state[key] = personalState[key];
  }

  return json({
    data: {
      state,
      updatedAt: personalRow?.updatedAt || orgRow?.updatedAt || null,
      currentUser: actor,
      directoryMode: "SERVER_PAGINATED",
    },
  });
}
