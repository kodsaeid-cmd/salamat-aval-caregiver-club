import { type Env, type JsonObject } from "./lib";
import { ensureProfileImageSchema } from "./profile-images";

type ImageRow = { id: string; userId: string | null; caregiverId: string | null };

export async function enrichStateProfileImages(env: Env, state: JsonObject) {
  await ensureProfileImageSchema(env);
  const result = await env.DB.prepare("SELECT id,user_id AS userId,caregiver_id AS caregiverId FROM profile_images ORDER BY updated_at DESC")
    .all<ImageRow>();
  const rows = result.results || [];
  const evaluation = state.evaluation && typeof state.evaluation === "object" ? state.evaluation as JsonObject : null;
  const caregivers = Array.isArray(evaluation?.caregivers) ? evaluation?.caregivers as JsonObject[] : [];
  for (const caregiver of caregivers) {
    const backendId = String(caregiver.backendId || "");
    const localId = String(caregiver.id || "");
    const image = rows.find((row) => row.caregiverId && [backendId, localId].includes(row.caregiverId));
    if (!image) continue;
    const profile = caregiver.profile && typeof caregiver.profile === "object" ? caregiver.profile as JsonObject : {};
    profile.photo = `/api/profile-images/${encodeURIComponent(image.id)}`;
    caregiver.profile = profile;
  }
  return state;
}
