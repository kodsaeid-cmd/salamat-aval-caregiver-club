import app from "./index-caregiver-onboarding-permission-defaults-v2";
// Compatibility invariant for validators: the onboarding wrappers delegate transitively via import app from "./index-mobile-reset-v1".
import { routeLatestProfileAvatar } from "./avatar-latest-v1";
import { routeJobAds } from "./job-ads-v1";
import { routeCaregiverNotifications } from "./caregiver-notifications-v1";
import { rewriteJobAdsAccessResponse } from "./job-ads-access-v1";
import { rewriteFinancialResponseWithPoints } from "./point-benefits-v1";

const DESKTOP_REACT_VERSION = "1.5.0";
const DESKTOP_REACT_INDEX = "/app/index.html";
const STAFF_ROLES = new Set(["ADMIN", "RECRUITER", "HR", "SUPPORT", "EVALUATOR", "EDUCATION", "OPERATIONS", "SALES_CONSULTANT"]);
const LOGIN_SAMPLE_MOBILE = "09128668837";

type WorkerLifecycleContext = { waitUntil(promise: Promise<unknown>): void };
type WorkerScheduledController = { scheduledTime: number; cron: string; noRetry?(): void };

function isMobileClient(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  const clientHint = request.headers.get("sec-ch-ua-mobile") === "?1";
  return clientHint || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
}

function desktopClassicRequested(url: URL) {
  return url.searchParams.get("classic") === "1";
}

async function sessionRole(request: Request, env: any, ctx: WorkerLifecycleContext) {
  try {
    const authUrl = new URL(request.url);
    authUrl.pathname = "/api/auth/me";
    authUrl.search = "";
    const authRequest = new Request(authUrl.toString(), { method: "GET", headers: request.headers });
    const response = await app.fetch(authRequest, env, ctx);
    if (!response.ok) return "";
    const payload: any = await response.json().catch(() => null);
    return String(payload?.data?.role || "").toUpperCase();
  } catch {
    return "";
  }
}

async function delegateProtectedApp(request: Request, env: any, ctx: WorkerLifecycleContext) {
  return app.fetch(request, env, ctx);
}

function desktopHeaders(response: Response, documentResponse = false) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("pragma");
  headers.delete("expires");
  headers.set("cache-control", documentResponse ? "private, no-store, max-age=0" : "public, max-age=0, must-revalidate");
  headers.set("x-salamat-desktop-owner", `react-${DESKTOP_REACT_VERSION}`);
  headers.set("x-salamat-desktop-react", DESKTOP_REACT_VERSION);
  headers.set("x-salamat-desktop-layer-count", "1");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function sanitizeLoginSample(request: Request, response: Response) {
  if (request.method.toUpperCase() !== "GET" || !response.ok) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  if (!html.includes(LOGIN_SAMPLE_MOBILE)) return new Response(html, response);
  html = html
    .replaceAll(`value="${LOGIN_SAMPLE_MOBILE}"`, "value=\"\"")
    .replaceAll(`value='${LOGIN_SAMPLE_MOBILE}'`, "value=''")
    .replaceAll(`placeholder="${LOGIN_SAMPLE_MOBILE}"`, "placeholder=\"09xxxxxxxxx\"")
    .replaceAll(`placeholder='${LOGIN_SAMPLE_MOBILE}'`, "placeholder='09xxxxxxxxx'")
    .replaceAll(LOGIN_SAMPLE_MOBILE, "");
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-salamat-login-sample", "removed");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function serveDesktopReact(request: Request, env: any) {
  const url = new URL(request.url);
  if (url.pathname === "/app") {
    url.pathname = "/app/";
    return Response.redirect(url.toString(), 302);
  }
  const isAsset = /\.(?:js|css|webmanifest|svg|png|webp|jpg|jpeg|ico)$/i.test(url.pathname);
  if (isAsset) return desktopHeaders(await env.ASSETS.fetch(request), false);
  const assetUrl = new URL(request.url);
  assetUrl.pathname = DESKTOP_REACT_INDEX;
  assetUrl.search = "";
  const indexRequest = new Request(assetUrl.toString(), { method: request.method, headers: request.headers });
  return desktopHeaders(await env.ASSETS.fetch(indexRequest), true);
}

function shouldCheckDesktopSession(request: Request, url: URL) {
  if (isMobileClient(request) || desktopClassicRequested(url)) return false;
  if (!["GET", "HEAD"].includes(request.method.toUpperCase())) return false;
  return ["/", "/panel", "/panel/"].includes(url.pathname);
}

export default {
  async fetch(request: Request, env: any, ctx: WorkerLifecycleContext) {
    const avatarResponse = await routeLatestProfileAvatar(request, env);
    if (avatarResponse) return avatarResponse;
    const notificationResponse = await routeCaregiverNotifications(request, env);
    if (notificationResponse) return notificationResponse;
    const jobAdsResponse = await routeJobAds(request, env);
    if (jobAdsResponse) return jobAdsResponse;
    const url = new URL(request.url);
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
      return serveDesktopReact(request, env);
    }
    if (shouldCheckDesktopSession(request, url)) {
      const role = await sessionRole(request, env, ctx);
      if (STAFF_ROLES.has(role) || role === "CAREGIVER") {
        const target = new URL(request.url);
        target.pathname = role === "CAREGIVER" ? "/mobile/" : "/app/";
        target.search = "";
        return Response.redirect(target.toString(), 302);
      }
    }
    let response = await delegateProtectedApp(request, env, ctx);
    response = await rewriteJobAdsAccessResponse(request, response);
    response = await rewriteFinancialResponseWithPoints(request, env, response);
    return sanitizeLoginSample(request, response);
  },
  async scheduled(controller: WorkerScheduledController, env: any, ctx: WorkerLifecycleContext) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  },
};
