import { requireAccess } from "./access-control";
import { ensureProfileImageSchema } from "./profile-images";
import {
  type Env,
  fail,
  getUser,
  json,
  securityHeaders,
  str,
} from "./lib";

type UserRow = {
  id: string;
  caregiverId: string | null;
  fullName: string;
  mobile: string | null;
  username: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  nationalId: string | null;
  membershipCode: string | null;
  avatarId: string | null;
};

const DIRECTORY_PATH = "/api/users";
const DEFAULT_PAGE_SIZE = 20;

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function routeUserDirectoryUnityV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== DIRECTORY_PATH || request.method.toUpperCase() !== "GET") return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const denied = await requireAccess(env, actor, "staff.users", "view");
  if (denied) return securityHeaders(denied);

  await ensureProfileImageSchema(env);
  const page = positiveInteger(url.searchParams.get("page"), 1, 100_000);
  const pageSize = positiveInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 100);
  const query = str(url.searchParams.get("q"));
  const terms: string[] = [
    "upper(COALESCE(u.status,''))<>'DELETED'",
    "u.id NOT LIKE 'RC-%'",
    "lower(COALESCE(u.username,'')) NOT LIKE 'rc-%@invalid.local'",
    "COALESCE(u.full_name,'') NOT LIKE 'آزمون انتشار%'",
  ];
  const bindings: unknown[] = [];
  if (query) {
    const like = `%${query}%`;
    terms.push(`(
      u.full_name LIKE ? OR u.mobile LIKE ? OR u.username LIKE ? OR
      c.national_id LIKE ? OR c.membership_code LIKE ?
    )`);
    bindings.push(like, like, like, like, like);
  }
  const where = terms.join(" AND ");
  const count = await env.DB.prepare(`SELECT COUNT(*) AS total
    FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
    WHERE ${where}`).bind(...bindings).first<{ total: number }>();
  const total = Number(count?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = await env.DB.prepare(`SELECT
      u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,
      u.role,u.status,u.created_at AS createdAt,u.updated_at AS updatedAt,
      c.national_id AS nationalId,c.membership_code AS membershipCode,
      (SELECT pi.id FROM profile_images pi
        WHERE pi.user_id=u.id OR (u.caregiver_id IS NOT NULL AND pi.caregiver_id=u.caregiver_id)
        ORDER BY pi.updated_at DESC LIMIT 1) AS avatarId
    FROM users u LEFT JOIN caregivers c ON c.id=u.caregiver_id
    WHERE ${where}
    ORDER BY CASE upper(u.status) WHEN 'ACTIVE' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
      u.updated_at DESC,u.created_at DESC
    LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all<UserRow>();

  return securityHeaders(json({
    data: (rows.results || []).map((row) => ({
      ...row,
      avatarUrl: row.avatarId
        ? `/api/profile-images/${encodeURIComponent(row.avatarId)}`
        : null,
    })),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasPrevious: safePage > 1,
      hasNext: safePage < totalPages,
    },
    source: "canonical-user-directory-v1",
  }));
}
