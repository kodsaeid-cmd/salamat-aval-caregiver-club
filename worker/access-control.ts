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

export type AccessAction = "view" | "create" | "update" | "delete";

type ModuleDefinition = {
  key: string;
  panel: "STAFF" | "CAREGIVER";
  label: string;
  icon: string;
  description: string;
};

type PermissionRow = {
  moduleKey: string;
  canView: number | null;
  canCreate: number | null;
  canUpdate: number | null;
  canDelete: number | null;
};

export const ROLE_DEFINITIONS = [
  { key: "ADMIN", label: "مدیر سامانه", panel: "STAFF" },
  { key: "CAREGIVER", label: "مراقب", panel: "CAREGIVER" },
  { key: "RECRUITER", label: "کارشناس جذب", panel: "STAFF" },
  { key: "HR", label: "منابع انسانی", panel: "STAFF" },
  { key: "SUPPORT", label: "پشتیبان", panel: "STAFF" },
  { key: "EVALUATOR", label: "ارزیاب", panel: "STAFF" },
  { key: "EDUCATION", label: "کارشناس آموزش", panel: "STAFF" },
  { key: "OPERATIONS", label: "مدیر عملیات", panel: "STAFF" },
  { key: "SALES_CONSULTANT", label: "مشاور فروش", panel: "STAFF" },
] as const;

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: "staff.dashboard", panel: "STAFF", label: "داشبورد مدیریتی", icon: "home", description: "نمای کلی و شاخص‌های مدیریتی" },
  { key: "staff.users", panel: "STAFF", label: "کاربران و دسترسی‌ها", icon: "users", description: "ساخت حساب، نقش و مجوزهای ماژولی" },
  { key: "staff.caregivers", panel: "STAFF", label: "پرونده مراقبین", icon: "caregiver", description: "مدیریت پرونده حرفه‌ای مراقبین" },
  { key: "staff.contracts", panel: "STAFF", label: "قراردادها", icon: "briefcase", description: "قراردادها و وضعیت همکاری" },
  { key: "staff.job_ads", panel: "STAFF", label: "بانک آگهی‌ها", icon: "megaphone", description: "ایجاد و انتشار آگهی، مدیریت اپلای مراقبین و امتیاز قرارداد" },
  { key: "staff.payroll", panel: "STAFF", label: "حقوق و پرداخت", icon: "money", description: "حقوق، مزایا، کسورات و پرداخت" },
  { key: "staff.financial_credits", panel: "STAFF", label: "اعتبارات و تسهیلات", icon: "wallet", description: "کیف پول، تسویه، اعتبار و تسهیلات مراقبین" },
  { key: "staff.training", panel: "STAFF", label: "بانک آموزش", icon: "book", description: "محتوا، دوره و تخصیص آموزش" },
  { key: "staff.evaluations", panel: "STAFF", label: "ارزیابی و پروانه", icon: "chart", description: "ارزیابی، امتیازدهی و پروانه حرفه‌ای" },
  { key: "staff.support", panel: "STAFF", label: "پشتیبانی و امنیت", icon: "message", description: "تیکت، پشتیبانی پرونده و گزارش امنیت" },
  { key: "staff.reports", panel: "STAFF", label: "گزارش‌ها", icon: "file", description: "گزارش‌های مدیریتی و عملیاتی" },
  { key: "staff.settings", panel: "STAFF", label: "تنظیمات و لاگ", icon: "settings", description: "تنظیمات سازمان و گزارش رخدادها" },
  { key: "caregiver.dashboard", panel: "CAREGIVER", label: "داشبورد", icon: "home", description: "خلاصه وضعیت مراقب" },
  { key: "caregiver.scorecard", panel: "CAREGIVER", label: "کارنامه کاری", icon: "chart", description: "نتایج ارزیابی و عملکرد" },
  { key: "caregiver.rank", panel: "CAREGIVER", label: "درجه و رتبه", icon: "badge", description: "رتبه و سطح حرفه‌ای" },
  { key: "caregiver.wallet", panel: "CAREGIVER", label: "کیف پول", icon: "wallet", description: "مانده و تراکنش‌ها" },
  { key: "caregiver.payroll", panel: "CAREGIVER", label: "حقوق و فیش حقوقی", icon: "money", description: "فیش‌ها و پرداخت‌های شخصی" },
  { key: "caregiver.contracts", panel: "CAREGIVER", label: "ساعات قرارداد", icon: "briefcase", description: "قرارداد و ساعات ثبت‌شده" },
  { key: "caregiver.training", panel: "CAREGIVER", label: "آموزش‌های من", icon: "book", description: "دوره‌های تخصیص‌یافته" },
  { key: "caregiver.support", panel: "CAREGIVER", label: "پشتیبانی پرونده", icon: "message", description: "ارتباط با پشتیبان پرونده" },
  { key: "caregiver.security", panel: "CAREGIVER", label: "گزارش امنیت", icon: "alert", description: "ثبت گزارش محرمانه" },
  { key: "caregiver.calendar", panel: "CAREGIVER", label: "تقویم کاری", icon: "calendar", description: "شیفت‌ها، مرخصی و برنامه کاری" },
];

const ACTION_COLUMNS: Record<AccessAction, keyof PermissionRow> = {
  view: "canView",
  create: "canCreate",
  update: "canUpdate",
  delete: "canDelete",
};
const ALL_ACTIONS: AccessAction[] = ["view", "create", "update", "delete"];
let accessSchemaReady: Promise<void> | undefined;

const roleDefaults: Record<string, Record<string, AccessAction[]>> = {
  ADMIN: Object.fromEntries(MODULE_DEFINITIONS.map((module) => [module.key, ALL_ACTIONS])),
  CAREGIVER: {
    "caregiver.dashboard": ["view"],
    "caregiver.scorecard": ["view"],
    "caregiver.rank": ["view"],
    "caregiver.wallet": ["view"],
    "caregiver.payroll": ["view"],
    "caregiver.contracts": ["view"],
    "caregiver.training": ["view", "update"],
    "caregiver.support": ["view", "create", "update"],
    "caregiver.security": ["view", "create"],
    "caregiver.calendar": ["view", "create", "update", "delete"],
  },
  RECRUITER: {
    "staff.dashboard": ["view"],
    "staff.users": ["view", "create", "update"],
    "staff.caregivers": ["view", "create", "update"],
    "staff.evaluations": ["view", "create", "update"],
    "staff.reports": ["view"],
  },
  HR: {
    "staff.dashboard": ["view"],
    "staff.caregivers": ["view", "update"],
    "staff.contracts": ["view", "create", "update", "delete"],
    "staff.payroll": ["view", "create", "update", "delete"],
    "staff.financial_credits": ["view", "create", "update", "delete"],
    "staff.training": ["view"],
    "staff.reports": ["view"],
  },
  SUPPORT: {
    "staff.dashboard": ["view"],
    "staff.caregivers": ["view"],
    "staff.support": ["view", "create", "update"],
    "staff.reports": ["view"],
  },
  EVALUATOR: {
    "staff.dashboard": ["view"],
    "staff.caregivers": ["view"],
    "staff.evaluations": ["view", "create", "update"],
    "staff.reports": ["view"],
  },
  EDUCATION: {
    "staff.dashboard": ["view"],
    "staff.caregivers": ["view"],
    "staff.training": ["view", "create", "update", "delete"],
    "staff.evaluations": ["view"],
    "staff.reports": ["view"],
  },
  OPERATIONS: {
    "staff.dashboard": ["view"],
    "staff.caregivers": ["view", "update"],
    "staff.contracts": ["view", "update"],
    "staff.support": ["view", "update"],
    "staff.reports": ["view"],
    "staff.settings": ["view"],
  },
  SALES_CONSULTANT: {
    "staff.dashboard": ["view"],
    "staff.job_ads": ["view", "create", "update"],
  },
};

function flag(actions: AccessAction[] | undefined, action: AccessAction) {
  return actions?.includes(action) ? 1 : 0;
}

export async function ensureAccessControlSchema(env: Env) {
  if (!accessSchemaReady) {
    accessSchemaReady = (async () => {
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS role_module_permissions (
          role TEXT NOT NULL,module_key TEXT NOT NULL,can_view INTEGER NOT NULL DEFAULT 0,
          can_create INTEGER NOT NULL DEFAULT 0,can_update INTEGER NOT NULL DEFAULT 0,
          can_delete INTEGER NOT NULL DEFAULT 0,updated_by_user_id TEXT,updated_at TEXT NOT NULL,
          PRIMARY KEY(role,module_key),FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_module_permissions (
          user_id TEXT NOT NULL,module_key TEXT NOT NULL,can_view INTEGER,can_create INTEGER,
          can_update INTEGER,can_delete INTEGER,updated_by_user_id TEXT,updated_at TEXT NOT NULL,
          PRIMARY KEY(user_id,module_key),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_role_module_permissions_role ON role_module_permissions(role)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user ON user_module_permissions(user_id)"),
      ]);
      const timestamp = nowIso();
      const seeds = [];
      for (const role of ROLE_DEFINITIONS) {
        for (const module of MODULE_DEFINITIONS) {
          const actions = roleDefaults[role.key]?.[module.key] || [];
          seeds.push(env.DB.prepare(`INSERT OR IGNORE INTO role_module_permissions(
            role,module_key,can_view,can_create,can_update,can_delete,updated_at
          ) VALUES(?,?,?,?,?,?,?)`).bind(role.key,module.key,flag(actions,"view"),flag(actions,"create"),flag(actions,"update"),flag(actions,"delete"),timestamp));
        }
      }
      if (seeds.length) await env.DB.batch(seeds);
    })().catch((error) => { accessSchemaReady = undefined; throw error; });
  }
  return accessSchemaReady;
}

function parseLegacyPermissions(user: AuthUser) {
  try {
    const parsed = JSON.parse(user.permissionsJson || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}
async function roleRows(env: Env, role: string) {
  const result = await env.DB.prepare(`SELECT module_key AS moduleKey,can_view AS canView,can_create AS canCreate,
    can_update AS canUpdate,can_delete AS canDelete FROM role_module_permissions WHERE role=?`).bind(role).all<PermissionRow>();
  return result.results || [];
}
async function userRows(env: Env, userId: string) {
  const result = await env.DB.prepare(`SELECT module_key AS moduleKey,can_view AS canView,can_create AS canCreate,
    can_update AS canUpdate,can_delete AS canDelete FROM user_module_permissions WHERE user_id=?`).bind(userId).all<PermissionRow>();
  return result.results || [];
}

export async function effectivePermissions(env: Env, user: AuthUser) {
  await ensureAccessControlSchema(env);
  const legacy = parseLegacyPermissions(user);
  const role = normalizeRole(user.role);
  const [roles, overrides] = await Promise.all([roleRows(env, role), userRows(env, user.id)]);
  const roleMap = new Map(roles.map((row) => [row.moduleKey, row]));
  const overrideMap = new Map(overrides.map((row) => [row.moduleKey, row]));
  return MODULE_DEFINITIONS.map((module) => {
    const base = roleMap.get(module.key);
    const override = overrideMap.get(module.key);
    const actions = Object.fromEntries(ALL_ACTIONS.map((action) => {
      if (role === "ADMIN") return [action, true];
      const column = ACTION_COLUMNS[action];
      const overrideValue = override?.[column];
      if (overrideValue !== undefined && overrideValue !== null) return [action, Boolean(overrideValue)];
      const baseValue = base?.[column];
      if (baseValue !== undefined && baseValue !== null) return [action, Boolean(baseValue)];
      const legacyAllowed = legacy.includes("*") || legacy.includes(`${module.key}.${action}`) || legacy.includes(module.key);
      return [action, legacyAllowed];
    })) as Record<AccessAction, boolean>;
    return { ...module, actions };
  });
}

export async function canAccess(env: Env, user: AuthUser | null, moduleKey: string, action: AccessAction = "view") {
  if (!user) return false;
  if (normalizeRole(user.role) === "ADMIN") return true;
  const module = (await effectivePermissions(env, user)).find((item) => item.key === moduleKey);
  return Boolean(module?.actions[action]);
}
export async function requireAccess(env: Env,user: AuthUser | null,moduleKey: string,action: AccessAction = "view") {
  return await canAccess(env,user,moduleKey,action) ? null : fail("برای این عملیات دسترسی ندارید.",403,"forbidden");
}

export async function accessMe(env: Env, user: AuthUser) {
  const modules = await effectivePermissions(env, user);
  const role = ROLE_DEFINITIONS.find((item) => item.key === normalizeRole(user.role));
  return json({ data: { user: { id:user.id,caregiverId:user.caregiverId,fullName:user.fullName,mobile:user.mobile,username:user.username,role:normalizeRole(user.role),roleLabel:role?.label||user.role,status:user.status },panel:role?.panel||"STAFF",modules:modules.filter((module)=>module.actions.view),allModules:modules } });
}

export async function accessConfiguration(env: Env, user: AuthUser) {
  if (normalizeRole(user.role) !== "ADMIN") return fail("فقط مدیر سامانه می‌تواند سیاست دسترسی را تغییر دهد.",403,"forbidden");
  await ensureAccessControlSchema(env);
  const result = await env.DB.prepare(`SELECT role,module_key AS moduleKey,can_view AS canView,can_create AS canCreate,can_update AS canUpdate,can_delete AS canDelete FROM role_module_permissions ORDER BY role,module_key`).all<Record<string, unknown>>();
  return json({ data:{roles:ROLE_DEFINITIONS,modules:MODULE_DEFINITIONS,rolePermissions:result.results||[]} });
}

function permissionPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const moduleKey = str(row.moduleKey || row.key);
  if (!MODULE_DEFINITIONS.some((module) => module.key === moduleKey)) return null;
  return { moduleKey,
    canView: row.view === undefined && row.canView === undefined ? null : Boolean(row.view ?? row.canView),
    canCreate: row.create === undefined && row.canCreate === undefined ? null : Boolean(row.create ?? row.canCreate),
    canUpdate: row.update === undefined && row.canUpdate === undefined ? null : Boolean(row.update ?? row.canUpdate),
    canDelete: row.delete === undefined && row.canDelete === undefined ? null : Boolean(row.delete ?? row.canDelete),
  };
}

export async function updateRolePermissions(request: Request, env: Env, actor: AuthUser, roleValue: string) {
  if (normalizeRole(actor.role) !== "ADMIN") return fail("فقط مدیر سامانه می‌تواند سیاست نقش‌ها را تغییر دهد.",403,"forbidden");
  const role = normalizeRole(roleValue);
  const body = await readBody(request);
  const permissions = Array.isArray(body?.permissions) ? body.permissions.map(permissionPayload).filter(Boolean) : [];
  if (!permissions.length) return fail("حداقل یک ماژول باید ارسال شود.");
  await ensureAccessControlSchema(env); const timestamp=nowIso();
  await env.DB.batch(permissions.map((permission)=>env.DB.prepare(`INSERT INTO role_module_permissions(role,module_key,can_view,can_create,can_update,can_delete,updated_by_user_id,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(role,module_key) DO UPDATE SET can_view=excluded.can_view,can_create=excluded.can_create,can_update=excluded.can_update,can_delete=excluded.can_delete,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`).bind(role,permission!.moduleKey,permission!.canView?1:0,permission!.canCreate?1:0,permission!.canUpdate?1:0,permission!.canDelete?1:0,actor.id,timestamp)));
  await audit(request,env,actor,"UPDATE_ROLE_PERMISSIONS","role",role,permissions); return json({ok:true,role,updatedAt:timestamp});
}

export async function getUserPermissions(env: Env, actor: AuthUser, userId: string) {
  if (normalizeRole(actor.role) !== "ADMIN") return fail("فقط مدیر سامانه می‌تواند دسترسی کاربران را مشاهده کند.",403,"forbidden");
  await ensureAccessControlSchema(env);
  const user = await env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,full_name AS fullName,mobile,username,role,status,permissions_json AS permissionsJson,created_at AS createdAt,updated_at AS updatedAt FROM users WHERE id=? LIMIT 1`).bind(userId).first<AuthUser & Record<string,unknown>>();
  if (!user) return fail("حساب کاربری پیدا نشد.",404,"user_not_found");
  const [effective,overrides]=await Promise.all([effectivePermissions(env,user),userRows(env,user.id)]);
  return json({data:{user:{...user,permissionsJson:undefined},effective,overrides}});
}

export async function updateUserPermissions(request: Request, env: Env, actor: AuthUser, userId: string) {
  if (normalizeRole(actor.role) !== "ADMIN") return fail("فقط مدیر سامانه می‌تواند دسترسی کاربران را تغییر دهد.",403,"forbidden");
  if (actor.id===userId) return fail("سطح دسترسی حساب مدیر جاری از این بخش قابل کاهش نیست.",409,"cannot_reduce_current_admin");
  const body=await readBody(request); if(!body)return fail("اطلاعات دسترسی معتبر نیست.");
  const account=await env.DB.prepare("SELECT id,role FROM users WHERE id=? LIMIT 1").bind(userId).first<{id:string;role:string}>();
  if(!account)return fail("حساب کاربری پیدا نشد.",404,"user_not_found");
  const role=body.role===undefined?normalizeRole(account.role):normalizeRole(body.role);
  const permissions=Array.isArray(body.permissions)?body.permissions.map(permissionPayload).filter(Boolean):[];
  await ensureAccessControlSchema(env); const timestamp=nowIso();
  const statements=[env.DB.prepare("UPDATE users SET role=?,updated_at=? WHERE id=?").bind(role,timestamp,userId),env.DB.prepare("DELETE FROM user_module_permissions WHERE user_id=?").bind(userId)];
  for(const permission of permissions) statements.push(env.DB.prepare(`INSERT INTO user_module_permissions(user_id,module_key,can_view,can_create,can_update,can_delete,updated_by_user_id,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(userId,permission!.moduleKey,permission!.canView===null?null:permission!.canView?1:0,permission!.canCreate===null?null:permission!.canCreate?1:0,permission!.canUpdate===null?null:permission!.canUpdate?1:0,permission!.canDelete===null?null:permission!.canDelete?1:0,actor.id,timestamp));
  await env.DB.batch(statements); await audit(request,env,actor,"UPDATE_USER_PERMISSIONS","user",userId,{role,permissions});
  return json({ok:true,userId,role,updatedAt:timestamp});
}
