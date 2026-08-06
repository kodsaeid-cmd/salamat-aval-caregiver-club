import app from "./index-login-intro-media";
import { type Env } from "./lib";
import { routeReferralRewardsV1 } from "./referral-rewards-v1";

const REFERRAL_RUNTIME = "referral-rewards-runtime-v1.js";
const REFERRAL_REWARDS_VERSION = "1.0.0";
const AUTH_SURFACE_RUNTIME = "auth-surface-gate-v1.js";
const AUTH_SURFACE_VERSION = "1.0.0";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

async function injectTopLevelRuntimes(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();
  const tags: string[] = [];
  if (!html.includes(REFERRAL_RUNTIME)) {
    tags.push(`<script src="./${REFERRAL_RUNTIME}?v=${REFERRAL_REWARDS_VERSION}"></script>`);
  }
  if (!html.includes(AUTH_SURFACE_RUNTIME)) {
    tags.push(`<script src="./${AUTH_SURFACE_RUNTIME}?v=${AUTH_SURFACE_VERSION}"></script>`);
  }
  if (tags.length) {
    html = html.includes("</body>")
      ? html.replace("</body>", `${tags.join("")}</body>`)
      : `${html}${tags.join("")}`;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "private, no-cache, max-age=0, must-revalidate");
  headers.set("x-salamat-referral-rewards", REFERRAL_REWARDS_VERSION);
  headers.set("x-salamat-auth-surface-gate", AUTH_SURFACE_VERSION);
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
    return injectTopLevelRuntimes(await app.fetch(request, env, context));
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
