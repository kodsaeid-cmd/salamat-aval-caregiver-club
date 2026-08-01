import { type AuthUser, type Env, json, nowIso, readBody } from "./lib";

type JsonRecord = Record<string, unknown>;

function parseState(value: unknown): JsonRecord {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function pruneServerManagedCollections(input: unknown): JsonRecord {
  const state = asRecord(input);
  const auth = asRecord(state.auth);
  const evaluation = asRecord(state.evaluation);

  return {
    ...state,
    auth: {
      ...auth,
      users: [],
    },
    evaluation: {
      ...evaluation,
      caregivers: [],
    },
  };
}

export async function readPrunedOrgState(env: Env) {
  const row = await env.DB.prepare(
    "SELECT state_json AS stateJson,updated_at AS updatedAt FROM ui_state WHERE scope='ORG' LIMIT 1",
  ).first<{ stateJson: string; updatedAt: string }>();

  const original = parseState(row?.stateJson);
  const auth = asRecord(original.auth);
  const evaluation = asRecord(original.evaluation);
  const hadServerManagedRows = (Array.isArray(auth.users) && auth.users.length > 0)
    || (Array.isArray(evaluation.caregivers) && evaluation.caregivers.length > 0);
  const state = pruneServerManagedCollections(original);

  if (row && hadServerManagedRows) {
    const updatedAt = nowIso();
    await env.DB.prepare("UPDATE ui_state SET state_json=?,updated_at=? WHERE scope='ORG'")
      .bind(JSON.stringify(state), updatedAt)
      .run()
      .catch(() => undefined);
    return { state, updatedAt, repaired: true };
  }

  return { state, updatedAt: row?.updatedAt || null, repaired: false };
}

export async function adminLightState(env: Env, actor: AuthUser) {
  const row = await readPrunedOrgState(env);
  return json({
    data: {
      state: row.state,
      updatedAt: row.updatedAt,
      currentUser: actor,
      directoryMode: "SERVER_PAGINATED",
      repairedLegacyState: row.repaired,
    },
  });
}

export async function prunedAdminStateRequest(request: Request) {
  const body = await readBody(request);
  const state = pruneServerManagedCollections(body?.state);
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify({ state, clientUpdatedAt: nowIso() }),
  });
}
