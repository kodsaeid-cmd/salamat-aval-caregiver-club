import app from "./index-evaluation-benefits-v2";
import { getUser, type Env } from "./lib";
import { routeReferralRewardsV2 } from "./referral-rewards-v2";

const REFERRAL_RUNTIME = "referral-rewards-runtime-v1.js";
const REFERRAL_RUNTIME_VERSION = "1.1.0";
const REFERRAL_EXPERIENCE_RUNTIME = "referral-rewards-experience-v2.js";
const REFERRAL_REWARDS_VERSION = "2.2.0";
const LOGIN_TRANSITION_RUNTIME = "login-route-transition-v1.js";
const LOGIN_TRANSITION_VERSION = "1.0.0";
const EVALUATION_SEARCH_OWNER_RUNTIME = "evaluation-search-submit-owner-v1.js";
const EVALUATION_SEARCH_OWNER_VERSION = "1.0.0";
const PANEL_RUNTIME = "panel-route-bootstrap-v1.js";
const PANEL_ROUTE_VERSION = "1.3.0";
const ADMIN_STABILITY_RUNTIME = "admin-interaction-stability-v1.js";
const ADMIN_STABILITY_VERSION = "1.0.0";
const PANEL_PATH = "/panel";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

function redirectTo(request: Request, pathname: string, status = 302) {
  const target = new URL(pathname, request.url);
  return new Response(null, {
    status,
    headers: {
      location: target.toString(),
      "cache-control": "private, no-store, max-age=0",
      "x-salamat-route-redirect": pathname,
    },
  });
}

function isHtmlNavigation(request: Request) {
  if (request.method.toUpperCase() !== "GET") return false;
  const destination = request.headers.get("sec-fetch-dest") || "";
  const accept = request.headers.get("accept") || "";
  return destination === "document" || !accept || accept.includes("text/html") || accept.includes("*/*");
}

class RemoveElement {
  element(element: RewriterElement) {
    element.remove();
  }
}

class PanelLoginCompatibility {
  element(element: RewriterElement) {
    element.setAttribute("hidden", "");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    element.setAttribute("data-salamat-panel-compat", "true");
    element.setAttribute("style", "display:none!important;visibility:hidden!important;pointer-events:none!important");
    element.setInnerContent(
      `<div id="roleOptions"></div><div id="methodTabs"></div><div id="mobileFields"></div><div id="emailFields"></div><input id="mobileInput"><input id="otpInput"><button id="sendOtp" type="button"></button><form id="loginForm"><button class="primary-action" type="submit"></button></form>`,
      { html: true },
    );
  }
}

class PanelTitle {
  element(element: RewriterElement) {
    element.setInnerContent("پنل کاربری | باشگاه مراقبین سلامت اول");
  }
}

class PanelBody {
  element(element: RewriterElement) {
    element.setAttribute("data-salamat-route", "panel");
    element.setAttribute("data-salamat-panel-direct", "true");
  }
}

async function injectTopLevelRuntimes(response: Response, panelRoute = false) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  let html = await response.text();

  if (!panelRoute && !html.includes(LOGIN_TRANSITION_RUNTIME)) {
    const transitionTag = `<script src="./${LOGIN_TRANSITION_RUNTIME}?v=${LOGIN_TRANSITION_VERSION}"></script>`;
    html = /<head\b[^>]*>/i.test(html)
      ? html.replace(/<head\b[^>]*>/i, (head) => `${head}${transitionTag}`)
      : `${transitionTag}${html}`;
  }

  const tags: string[] = [];
  if (!html.includes(REFERRAL_RUNTIME)) {
    tags.push(`<script src="./${REFERRAL_RUNTIME}?v=${REFERRAL_RUNTIME_VERSION}"></script>`);
  }
  if (!html.includes(REFERRAL_EXPERIENCE_RUNTIME)) {
    tags.push(`<script src="./${REFERRAL_EXPERIENCE_RUNTIME}?v=${REFERRAL_REWARDS_VERSION}"></script>`);
  }
  if (panelRoute && !html.includes(EVALUATION_SEARCH_OWNER_RUNTIME)) {
    tags.push(`<script src="./${EVALUATION_SEARCH_OWNER_RUNTIME}?v=${EVALUATION_SEARCH_OWNER_VERSION}"></script>`);
  }
  if (panelRoute && !html.includes(PANEL_RUNTIME)) {
    tags.push(`<script src="./${PANEL_RUNTIME}?v=${PANEL_ROUTE_VERSION}"></script>`);
  }
  if (panelRoute && !html.includes(ADMIN_STABILITY_RUNTIME)) {
    tags.push(`<script src="./${ADMIN_STABILITY_RUNTIME}?v=${ADMIN_STABILITY_VERSION}"></script>`);
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
  headers.set("x-salamat-login-transition", panelRoute ? "not-applicable" : LOGIN_TRANSITION_VERSION);
  headers.set("x-salamat-panel-route", panelRoute ? PANEL_ROUTE_VERSION : "login");
  headers.set("x-salamat-evaluation-search-owner", panelRoute ? EVALUATION_SEARCH_OWNER_VERSION : "not-applicable");
  headers.set("x-salamat-admin-stability", panelRoute ? ADMIN_STABILITY_VERSION : "not-applicable");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function renderPanelShell(request: Request, env: Env, context: WorkerLifecycleContext) {
  const shellUrl = new URL(request.url);
  shellUrl.pathname = "/";
  shellUrl.search = "";
  const shellRequest = new Request(shellUrl.toString(), request);
  const response = await app.fetch(shellRequest, env, context);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-salamat-page-surface", "panel-only");

  const shell = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  return new HTMLRewriter()
    .on("title", new PanelTitle())
    .on("body", new PanelBody())
    .on("#loginView", new PanelLoginCompatibility())
    .on("#caregiverSignupLayer", new RemoveElement())
    .on('script[src*="auth-surface-gate-v1.js"]', new RemoveElement())
    .on('script[src*="login-route-transition-v1.js"]', new RemoveElement())
    .on('script[src*="mobile-login-video-fix.js"]', new RemoveElement())
    .on('script[src*="mobile-login-isolation-v1.js"]', new RemoveElement())
    .on('script[src*="hero-hq-avif-part-"]', new RemoveElement())
    .on('script[src*="hero-inline.js"]', new RemoveElement())
    .on('script[src*="caregiver-registration.js"]', new RemoveElement())
    .transform(shell);
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const referralResponse = await routeReferralRewardsV2(request, env);
    if (referralResponse) return referralResponse;

    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    if (pathname === "/panel/") return redirectTo(request, PANEL_PATH, 308);

    if (pathname === PANEL_PATH && method === "GET") {
      const actor = await getUser(request, env);
      if (!actor) return redirectTo(request, "/");
      return injectTopLevelRuntimes(await renderPanelShell(request, env, context), true);
    }

    if ((pathname === "/" || pathname === "/index.html") && isHtmlNavigation(request)) {
      const actor = await getUser(request, env);
      if (actor) return redirectTo(request, PANEL_PATH);
    }

    return injectTopLevelRuntimes(await app.fetch(request, env, context));
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
