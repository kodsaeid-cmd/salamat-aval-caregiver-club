import {
  MODULE_DEFINITIONS,
  ROLE_DEFINITIONS,
  ensureAccessControlSchema,
  type AccessAction,
} from "./access-control";
import { type AuthUser, type Env, fail, json, normalizeRole } from "./lib";

type PermissionRow = {
  moduleKey: string;
  canView: number | null;
  canCreate: number | null;
  canUpdate: number | null;
  canDelete: number | null;
};

const ACTION_COLUMN: Record<AccessAction, keyof PermissionRow> = {
  view: "canView",
  create: "canCreate",
  update: "canUpdate",
  delete: "canDelete",
};
const ACTIONS: AccessAction[] = ["view", "create", "update", "delete"];

function legacyPermissions(user: AuthUser) {
  try {
    const parsed = JSON.parse(user.permissionsJson || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function roleRows(env: Env, role: string) {
  const result = await env.DB.prepare(`SELECT
    module_key AS moduleKey,can_view AS canView,can_create AS canCreate,
    can_update AS canUpdate,can_delete AS canDelete
    FROM role_module_permissions WHERE role=?`)
    .bind(role)
    .all<PermissionRow>();
  return result.results || [];
}

async function userRows(env: Env, userId: string) {
  const result = await env.DB.prepare(`SELECT
    module_key AS moduleKey,can_view AS canView,can_create AS canCreate,
    can_update AS canUpdate,can_delete AS canDelete
    FROM user_module_permissions WHERE user_id=?`)
    .bind(userId)
    .all<PermissionRow>();
  return result.results || [];
}

export async function strictEffectivePermissions(env: Env, user: AuthUser) {
  await ensureAccessControlSchema(env);
  const role = normalizeRole(user.role);
  const legacy = legacyPermissions(user);
  const [rolePermissions, userPermissions] = await Promise.all([
    roleRows(env, role),
    userRows(env, user.id),
  ]);
  const roleMap = new Map(rolePermissions.map((row) => [row.moduleKey, row]));
  const userMap = new Map(userPermissions.map((row) => [row.moduleKey, row]));

  return MODULE_DEFINITIONS.map((module) => {
    const roleRow = roleMap.get(module.key);
    const userRow = userMap.get(module.key);
    const actions = Object.fromEntries(ACTIONS.map((action) => {
      if (role === "ADMIN") return [action, true];
      const column = ACTION_COLUMN[action];
      const explicitUserValue = userRow?.[column];
      const explicitRoleValue = roleRow?.[column];

      // An explicit user value, including zero, always wins. This is the key
      // rule that makes an unchecked box remove a module instead of allowing a
      // historical permissions_json grant to bring it back.
      if (explicitUserValue !== undefined && explicitUserValue !== null) {
        return [action, Boolean(explicitUserValue)];
      }
      if (explicitRoleValue !== undefined && explicitRoleValue !== null) {
        return [action, Boolean(explicitRoleValue)];
      }

      // Legacy permissions are only a migration fallback when no modern role
      // or user policy row exists at all.
      const fallback = legacy.includes("*")
        || legacy.includes(module.key)
        || legacy.includes(`${module.key}.${action}`);
      return [action, fallback];
    })) as Record<AccessAction, boolean>;
    return { ...module, actions };
  });
}

export async function strictCanAccess(
  env: Env,
  user: AuthUser | null,
  moduleKey: string,
  action: AccessAction = "view",
) {
  if (!user) return false;
  const module = (await strictEffectivePermissions(env, user))
    .find((item) => item.key === moduleKey);
  return Boolean(module?.actions[action]);
}

export async function strictRequireAccess(
  env: Env,
  user: AuthUser | null,
  moduleKey: string,
  action: AccessAction = "view",
) {
  return await strictCanAccess(env, user, moduleKey, action)
    ? null
    : fail("برای این عملیات دسترسی ندارید.", 403, "forbidden");
}

export async function strictAccessMe(env: Env, user: AuthUser) {
  const modules = await strictEffectivePermissions(env, user);
  const role = ROLE_DEFINITIONS.find((item) => item.key === normalizeRole(user.role));
  return json({
    data: {
      user: {
        id: user.id,
        caregiverId: user.caregiverId,
        fullName: user.fullName,
        mobile: user.mobile,
        username: user.username,
        role: normalizeRole(user.role),
        roleLabel: role?.label || user.role,
        status: user.status,
      },
      panel: role?.panel || "STAFF",
      modules: modules.filter((module) => module.actions.view),
      allModules: modules,
    },
  });
}
