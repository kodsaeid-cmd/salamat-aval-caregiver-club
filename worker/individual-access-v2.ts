import {
  MODULE_DEFINITIONS,
  ROLE_DEFINITIONS,
  ensureAccessControlSchema,
  type AccessAction,
} from "./access-control";
import {
  type AuthUser,
  type Env,
  audit,
  fail,
  json,
  normalizeRole,
  nowIso,
  readBody,
  str,
} from "./lib";

type PermissionRow = {
  moduleKey: string;
  canView: number | null;
  canCreate: number | null;
  canUpdate: number | null;
  canDelete: number | null;
};

type PermissionPayload = {
  moduleKey: string;
  canView: boolean | null;
  canCreate: boolean | null;
  canUpdate: boolean | null;
  canDelete: boolean | null;
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

export function isProtectedRootAccount(user: Pick<AuthUser, "id" | "username" | "role" | "permissionsJson">) {
  if (normalizeRole(user.role) !== "ADMIN") return false;
  const legacy = legacyPermissions(user as AuthUser);
  return user.id === "SYS-ADMIN"
    || str(user.username).toLowerCase() === "admin"
    || legacy.includes("*");
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

export async function individualEffectivePermissions(env: Env, user: AuthUser) {
  await ensureAccessControlSchema(env);
  const role = normalizeRole(user.role);
  const root = isProtectedRootAccount(user);
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
      if (root) return [action, true];
      const column = ACTION_COLUMN[action];
      const explicitUserValue = userRow?.[column];
      const roleTemplateValue = roleRow?.[column];

      // Every explicit account-level value wins, including zero. A role is a
      // reusable template and identity label; it is never a forced grant.
      if (explicitUserValue !== undefined && explicitUserValue !== null) {
        return [action, Boolean(explicitUserValue)];
      }
      if (roleTemplateValue !== undefined && roleTemplateValue !== null) {
        return [action, Boolean(roleTemplateValue)];
      }

      // Legacy JSON is used only when neither modern user nor role policy has
      // a value. Saving an account clears this legacy field atomically.
      const fallback = legacy.includes("*")
        || legacy.includes(module.key)
        || legacy.includes(`${module.key}.${action}`);
      return [action, fallback];
    })) as Record<AccessAction, boolean>;
    return { ...module, actions };
  });
}

export async function individualCanAccess(
  env: Env,
  user: AuthUser | null,
  moduleKey: string,
  action: AccessAction = "view",
) {
  if (!user) return false;
  const module = (await individualEffectivePermissions(env, user))
    .find((item) => item.key === moduleKey);
  return Boolean(module?.actions[action]);
}

export async function individualRequireAccess(
  env: Env,
  user: AuthUser | null,
  moduleKey: string,
  action: AccessAction = "view",
) {
  return await individualCanAccess(env, user, moduleKey, action)
    ? null
    : fail("برای این عملیات دسترسی ندارید.", 403, "forbidden");
}

export async function individualAccessMe(env: Env, user: AuthUser) {
  const modules = await individualEffectivePermissions(env, user);
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
        protectedRoot: isProtectedRootAccount(user),
      },
      panel: role?.panel || "STAFF",
      modules: modules.filter((module) => module.actions.view),
      allModules: modules,
      permissionPolicy: "USER_OVERRIDES_ROLE_TEMPLATE",
    },
  });
}

function permissionPayload(value: unknown): PermissionPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const moduleKey = str(row.moduleKey || row.key);
  if (!MODULE_DEFINITIONS.some((module) => module.key === moduleKey)) return null;
  const valueOrNull = (primary: unknown, alternate: unknown) => primary === undefined && alternate === undefined
    ? null
    : Boolean(primary ?? alternate);
  return {
    moduleKey,
    canView: valueOrNull(row.view, row.canView),
    canCreate: valueOrNull(row.create, row.canCreate),
    canUpdate: valueOrNull(row.update, row.canUpdate),
    canDelete: valueOrNull(row.delete, row.canDelete),
  };
}

async function accountById(env: Env, userId: string) {
  return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,
    role,status,permissions_json AS permissionsJson
    FROM users WHERE id=? LIMIT 1`)
    .bind(userId)
    .first<AuthUser>();
}

export async function individualGetUserPermissions(
  env: Env,
  actor: AuthUser,
  userId: string,
) {
  const denied = await individualRequireAccess(env, actor, "staff.users", "view");
  if (denied) return denied;
  await ensureAccessControlSchema(env);
  const user = await accountById(env, userId);
  if (!user) return fail("حساب کاربری پیدا نشد.", 404, "user_not_found");
  const [effective, overrides] = await Promise.all([
    individualEffectivePermissions(env, user),
    userRows(env, user.id),
  ]);
  return json({
    data: {
      user: { ...user, permissionsJson: undefined },
      effective,
      overrides,
      policy: {
        precedence: "USER_THEN_ROLE_THEN_LEGACY",
        protectedRoot: isProtectedRootAccount(user),
      },
    },
  });
}

export async function individualUpdateUserPermissions(
  request: Request,
  env: Env,
  actor: AuthUser,
  userId: string,
) {
  const denied = await individualRequireAccess(env, actor, "staff.users", "update");
  if (denied) return denied;
  if (actor.id === userId) {
    return fail("سطح دسترسی حساب جاری از همین نشست قابل تغییر نیست.", 409, "cannot_edit_current_account");
  }
  const body = await readBody(request);
  if (!body) return fail("اطلاعات دسترسی معتبر نیست.");
  const account = await accountById(env, userId);
  if (!account) return fail("حساب کاربری پیدا نشد.", 404, "user_not_found");
  if (isProtectedRootAccount(account)) {
    return fail("دسترسی حساب مدیر اصلی سامانه قابل کاهش نیست.", 409, "protected_root_account");
  }

  const role = body.role === undefined ? normalizeRole(account.role) : normalizeRole(body.role);
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.map(permissionPayload).filter((item): item is PermissionPayload => Boolean(item))
    : [];
  await ensureAccessControlSchema(env);
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE users SET role=?,permissions_json='[]',updated_at=? WHERE id=?")
      .bind(role, timestamp, userId),
    env.DB.prepare("DELETE FROM user_module_permissions WHERE user_id=?").bind(userId),
  ];
  for (const permission of permissions) {
    statements.push(env.DB.prepare(`INSERT INTO user_module_permissions(
      user_id,module_key,can_view,can_create,can_update,can_delete,updated_by_user_id,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)`).bind(
      userId,
      permission.moduleKey,
      permission.canView === null ? null : permission.canView ? 1 : 0,
      permission.canCreate === null ? null : permission.canCreate ? 1 : 0,
      permission.canUpdate === null ? null : permission.canUpdate ? 1 : 0,
      permission.canDelete === null ? null : permission.canDelete ? 1 : 0,
      actor.id,
      timestamp,
    ));
  }
  await env.DB.batch(statements);
  await audit(request, env, actor, "UPDATE_INDIVIDUAL_PERMISSIONS", "user", userId, {
    role,
    permissions,
    precedence: "USER_OVERRIDES_ROLE_TEMPLATE",
  });
  return json({ ok: true, userId, role, updatedAt: timestamp });
}
