import { invalidateAdminDirectoryCounts } from "./admin-directory-light";
import { invalidateCaregiverDirectoryCache } from "./caregiver-directory-page";
import { invalidateRecruiterDirectoryCache } from "./recruiter-directory";
import { invalidateTrainingCaregiverCache } from "./training-caregivers";
import { uploadProfileImage } from "./profile-images";
import {
  type Env,
  fail,
  getUser,
  securityHeaders,
  str,
} from "./lib";

const SELF_AVATAR_PATH = "/api/caregiver/platform/profile/avatar";

export async function routeCaregiverAvatarUnityV2(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== SELF_AVATAR_PATH || request.method.toUpperCase() !== "POST") return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const caregiverId = str(actor.caregiverId);
  if (actor.role.toUpperCase() !== "CAREGIVER" || !caregiverId) {
    return securityHeaders(fail("این مسیر فقط برای حساب مراقب فعال است.", 403, "caregiver_only"));
  }

  // The same image row owns both identity keys. This prevents the caregiver
  // shell, admin users directory and professional scorecard from resolving
  // different avatar records for the same person.
  const uploadUrl = new URL("/api/profile-images", request.url);
  uploadUrl.searchParams.set("caregiverId", caregiverId);
  uploadUrl.searchParams.set("userId", actor.id);
  const body = await request.arrayBuffer();
  const forwarded = new Request(uploadUrl.toString(), {
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
  return securityHeaders(response);
}
