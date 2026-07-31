import { type AuthUser, type Env } from "./lib";
import { getAssignedTrainingContent } from "./training-content";

export async function getAssignedTrainingFile(request: Request, env: Env, actor: AuthUser, fileId: string) {
  if (actor.role.toUpperCase() !== "CAREGIVER" || !actor.caregiverId) return null;
  const patterns = [
    `/api/files/${fileId}/download`,
    `/api/files/${fileId}/download?inline=1`,
  ];
  const placeholders = patterns.map(() => "?").join(",");
  const row = await env.DB.prepare(`SELECT e.id AS enrollmentId FROM enrollments e
    JOIN courses c ON c.id=e.course_id
    JOIN users u ON u.id=e.assigned_by_user_id AND UPPER(u.role) IN ('ADMIN','RECRUITER','HR')
    WHERE e.caregiver_id=? AND c.status='ACTIVE' AND c.content_url IN (${placeholders}) LIMIT 1`)
    .bind(actor.caregiverId, ...patterns).first<{ enrollmentId: string }>();
  if (!row) return null;
  return getAssignedTrainingContent(request, env, actor, row.enrollmentId);
}
