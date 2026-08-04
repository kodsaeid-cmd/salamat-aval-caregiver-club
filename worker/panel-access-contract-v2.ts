import {
  accessConfiguration,
  accessMe,
  canAccess,
  type AccessAction,
} from "./access-control";
import {
  type AuthUser,
  type Env,
  fail,
  getUser,
  json,
  securityHeaders,
} from "./lib";

const FINANCE_KEY = "staff.financial_credits";
const HIDDEN_KEYS = new Set([
  "caregiver.rank",
  "caregiver.contracts",
  "caregiver.security",
  "staff.reports",
]);
const ACTIONS: AccessAction[] = ["view", "create", "update", "delete"];

const FINANCE_MODULE = {
  key: FINANCE_KEY,
  panel: "STAFF",
  label: "اعتبارات مالی",
  icon: "wallet",
  description: "پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار",
};

type ModuleRow = typeof FINANCE_MODULE & {
  actions?: Record<AccessAction, boolean>;
};

type AccessPayload = {
  data?: {
    user?: { role?: string };
    panel?: string;
    modules?: ModuleRow[];
    allModules?: ModuleRow[];
  };
  [key: string]: unknown;
};

function insertAfterPayroll(modules: ModuleRow[], module: ModuleRow) {
  const withoutDuplicate = modules.filter((item) => item.key !== module.key);
  const payrollIndex = withoutDuplicate.findIndex((item) => item.key === "staff.payroll");
  withoutDuplicate.splice(payrollIndex < 0 ? withoutDuplicate.length : payrollIndex + 1, 0, module);
  return withoutDuplicate;
}

function normalizeModule(module: ModuleRow): ModuleRow {
  if (module.key === "caregiver.wallet") {
    return {
      ...module,
      label: "کیف پول و اعتبارات",
      description: "پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار",
    };
  }
  if (module.key === "caregiver.support") {
    return {
      ...module,
      label: "پشتیبانی",
      description: "پشتیبانی پرونده و پشتیبانی فوری و امنیتی",
    };
  }
  if (module.key === "staff.support") {
    return {
      ...module,
      label: "پشتیبانی",
      description: "گفت‌وگوی پرونده و صف فوری و امنیتی مراقبین",
    };
  }
  if (module.key === "staff.settings") {
    return {
      ...module,
      label: "تنظیمات و لاگ",
      description: "تنظیمات عملیاتی سامانه و رخدادهای واقعی حسابرسی",
    };
  }
  if (module.key === FINANCE_KEY) return { ...module, ...FINANCE_MODULE };
  return module;
}

async function financeActions(env: Env, actor: AuthUser) {
  const entries = await Promise.all(ACTIONS.map(async (action) => [
    action,
    await canAccess(env, actor, FINANCE_KEY, action),
  ] as const));
  return Object.fromEntries(entries) as Record<AccessAction, boolean>;
}

async function normalizedAccessMe(env: Env, actor: AuthUser) {
  const base = await accessMe(env, actor);
  const payload = await base.json() as AccessPayload;
  const data = payload.data || {};
  let allModules = Array.isArray(data.allModules) ? data.allModules : [];

  allModules = allModules
    .filter((module) => !HIDDEN_KEYS.has(module.key))
    .map(normalizeModule);

  const actions = await financeActions(env, actor);
  const finance = {
    ...FINANCE_MODULE,
    ...(allModules.find((module) => module.key === FINANCE_KEY) || {}),
    ...FINANCE_MODULE,
    actions,
  } satisfies ModuleRow;
  allModules = insertAfterPayroll(allModules, finance);

  const panel = String(data.panel || "STAFF").toUpperCase();
  const modules = allModules.filter((module) => module.panel === panel && Boolean(module.actions?.view));

  return securityHeaders(json({
    ...payload,
    data: {
      ...data,
      panel,
      modules,
      allModules,
      moduleContractVersion: "3.0.0",
    },
  }));
}

async function normalizedAccessConfiguration(env: Env, actor: AuthUser) {
  const base = await accessConfiguration(env, actor);
  if (!base.ok) return securityHeaders(base);
  const payload = await base.json() as Record<string, any>;
  const data = payload.data || {};
  let modules = Array.isArray(data.modules) ? data.modules : [];
  modules = modules
    .filter((module: ModuleRow) => !HIDDEN_KEYS.has(module.key))
    .map((module: ModuleRow) => normalizeModule(module));
  modules = insertAfterPayroll(modules, FINANCE_MODULE);

  const rolePermissions = Array.isArray(data.rolePermissions) ? [...data.rolePermissions] : [];
  for (const row of rolePermissions) {
    if (HIDDEN_KEYS.has(String(row.moduleKey || ""))) row.hidden = true;
    if (row.moduleKey !== FINANCE_KEY || String(row.role || "").toUpperCase() !== "ADMIN") continue;
    row.canView = 1;
    row.canCreate = 1;
    row.canUpdate = 1;
    row.canDelete = 1;
  }
  const known = new Set(rolePermissions
    .filter((row) => row.moduleKey === FINANCE_KEY)
    .map((row) => String(row.role || "").toUpperCase()));
  const roles = Array.isArray(data.roles) ? data.roles : [];
  for (const role of roles) {
    const key = String(role.key || "").toUpperCase();
    if (!key || known.has(key)) continue;
    const admin = key === "ADMIN";
    rolePermissions.push({
      role: key,
      moduleKey: FINANCE_KEY,
      canView: admin ? 1 : 0,
      canCreate: admin ? 1 : 0,
      canUpdate: admin ? 1 : 0,
      canDelete: admin ? 1 : 0,
    });
  }

  return securityHeaders(json({
    ...payload,
    data: {
      ...data,
      modules,
      rolePermissions: rolePermissions.filter((row) => !HIDDEN_KEYS.has(String(row.moduleKey || ""))),
      moduleContractVersion: "3.0.0",
    },
  }));
}

export async function routePanelAccessContractV2(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method !== "GET") return null;
  if (url.pathname !== "/api/access/me" && url.pathname !== "/api/access/configuration") return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  if (url.pathname === "/api/access/me") return normalizedAccessMe(env, actor);
  return normalizedAccessConfiguration(env, actor);
}
