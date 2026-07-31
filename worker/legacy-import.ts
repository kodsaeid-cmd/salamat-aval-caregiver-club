import { type AuthUser, type Env, audit, fail, json, nowIso, readBody, str } from "./lib";

type JsonObject = Record<string, unknown>;

const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return fallback; }
};

function cleanProfile(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as JsonObject;
  const name = str(item.name || item.fullName);
  if (name.length < 3) return null;
  const profile = item.profile && typeof item.profile === "object" && !Array.isArray(item.profile) ? item.profile as JsonObject : {};
  const rank = item.rank && typeof item.rank === "object" && !Array.isArray(item.rank) ? item.rank as JsonObject : {};
  const license = item.license && typeof item.license === "object" && !Array.isArray(item.license) ? item.license as JsonObject : {};
  return {
    id: str(item.id || item.membershipCode),
    backendId: str(item.backendId),
    membershipCode: str(item.membershipCode || item.id),
    name,
    phone: str(item.phone || item.mobile),
    nationalId: str(item.nationalId),
    serviceGroup: str(item.serviceGroup || item.primaryType),
    fileStatus: str(item.fileStatus || item.cooperationStatus),
    createdAt: str(item.createdAt),
    profile: {
      city: str(profile.city || item.city),
      address: str(profile.address || item.address),
      birthDate: str(profile.birthDate || item.birthDate),
      skills: Array.isArray(profile.skills) ? profile.skills.map((x) => str(x)).filter(Boolean) : str(profile.skills || item.skills),
      bio: str(profile.bio || item.bio || item.workHistory),
    },
    rank: { title: str(rank.title || item.professionalLevel), pri: rank.pri ?? item.professionalScore ?? null },
    license: { status: str(license.status || item.licenseStatus) },
  };
}

const identity = (item: JsonObject) => [str(item.backendId), str(item.id), str(item.membershipCode), str(item.phone), str(item.nationalId)].filter(Boolean);

export async function importLegacyBrowserProfiles(request: Request, env: Env, actor: AuthUser) {
  const body = await readBody(request);
  const incoming = Array.isArray(body?.profiles) ? body.profiles.map(cleanProfile).filter((item): item is JsonObject => Boolean(item)) : [];
  if (!incoming.length) return json({ data: { received: 0, queued: 0 } });
  if (incoming.length > 500) return fail("تعداد رکوردهای مهاجرتی بیش از حد مجاز است.", 413, "too_many_profiles");

  const row = await env.DB.prepare("SELECT state_json AS stateJson FROM ui_state WHERE scope='ORG' LIMIT 1")
    .first<{ stateJson: string }>();
  const state = parseJson<JsonObject>(row?.stateJson, {});
  const evaluation = state.evaluation && typeof state.evaluation === "object" && !Array.isArray(state.evaluation) ? state.evaluation as JsonObject : {};
  const existing = Array.isArray(evaluation.caregivers) ? evaluation.caregivers.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
  const known = new Set(existing.flatMap(identity));
  let queued = 0;
  for (const item of incoming) {
    const keys = identity(item);
    if (keys.some((key) => known.has(key))) continue;
    existing.push(item);
    keys.forEach((key) => known.add(key));
    queued += 1;
  }
  evaluation.caregivers = existing;
  state.evaluation = evaluation;
  const serialized = JSON.stringify(state);
  if (serialized.length > 1_500_000) return fail("حجم اطلاعات مهاجرتی بیش از حد مجاز است.", 413, "legacy_state_too_large");
  const timestamp = nowIso();
  await env.DB.prepare(`INSERT INTO ui_state(scope,state_json,updated_by_user_id,updated_at) VALUES('ORG',?,?,?) ON CONFLICT(scope) DO UPDATE SET state_json=excluded.state_json,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`)
    .bind(serialized, actor.id, timestamp).run();
  await audit(request, env, actor, "IMPORT_LEGACY_BROWSER_PROFILES", "ui_state", "ORG", { received: incoming.length, queued });
  return json({ data: { received: incoming.length, queued } });
}
