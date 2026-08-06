import app from "./index-login-intro-media";
import { type Env } from "./lib";
import { routeReferralRewardsV1 } from "./referral-rewards-v1";

const REFERRAL_RUNTIME = "referral-rewards-runtime-v1.js";
const REFERRAL_REWARDS_VERSION = "1.0.0";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

async function injectReferralRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();
  if (!html.includes(REFERRAL_RUNTIME)) {
    const tag = `<script src="./${REFERRAL_RUNTIME}?v=${REFERRAL_REWARDS_VERSION}"></script>`;
    html = html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
  headers.set("x-salamat-referral-rewards", REFERRAL_REWARDS_VERSION);
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const referralResponse = await routeReferralRewardsV1(request, env);
    if (referralResponse) return referralResponse;
    return injectReferralRuntime(await app.fetch(request, env, context));
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
