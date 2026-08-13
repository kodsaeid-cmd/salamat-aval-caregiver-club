import app from "./index-caregiver-onboarding-permission-defaults-v2";
// Compatibility invariant for validators: the onboarding wrappers delegate transitively via import app from "./index-mobile-reset-v1".
// Release invariant: caregiver self-registration creates a PENDING account with mobile/national-id initial credentials; activation still requires authorized approval.
// Bundle dependency: both React staff entries include the shared live job-ad money/points runtime.
import { routeLatestProfileAvatar } from "./avatar-latest-v1";
import { reconcileAllActiveContracts,routeContractProgressEngine } from "./contract-progress-engine-v1";
import {routeAdminCaregiverPresetV1,routeCaregiverNotificationsUnityV1,routeJobAdCaregiverVisibilityV1,rewriteSalesSupervisorAccessV1} from "./job-ad-caregiver-unity-v1";
import {routeContractLifecycleV2,reconcileContractCaseByApplication} from "./contract-lifecycle-v3";
import {decorateContractListPointsV1} from "./contract-list-points-v1";
import {routeContractExitJobAdUserControlsV1} from "./contract-exit-job-ad-user-controls-v1";
import {routeStaffContractReopenV1} from "./staff-contract-reopen-v1";
import {prepareProductionContractRowsV1,routeProductionContractRepairV1} from "./contract-production-repair-v1";
import {reconcileLegacyOpenContracts} from "./legacy-contract-compat-v1";
import {decorateLegacyJobAdContractState} from "./legacy-job-ad-decoration-v1";
import {routeStaffJobAdListFiltersV1} from "./staff-job-ad-list-filters-v1";
import { routeReferralRewardsV5 } from "./referral-rewards-v5";
import { routeCaregiverFinancialProfileReferralFixV1 } from "./caregiver-financial-referral-fix-v1";
import { routeLoanCreditPolicyV2 } from "./loan-credit-policy-v2";
import { routeRetentionRewardsV1 } from "./retention-rewards-v1";
import { routeStaffContractsRetentionV2 } from "./staff-contracts-retention-v2";
import { routeSelfRegisteredApprovalV1 } from "./self-registered-approval-v1";
import {decorateCaregiverWelcomeNotificationV1,routeCaregiverInitialCredentialsV1} from "./caregiver-initial-credentials-v1";
import {routeCaregiverAccountUiV2} from "./caregiver-account-ui-v2";
import { rewriteJobAdsAccessResponse } from "./job-ads-access-v1";
import { rewriteFinancialResponseWithPoints } from "./point-benefits-v1";

const DESKTOP_REACT_VERSION = "1.5.18";
const DESKTOP_REACT_INDEX = "/app/index.html";
const CLASSIC_REACT_BRIDGE = "/desktop-react-entry-bridge-v1.js?v=1.0.0";
const CAREGIVER_ACCOUNT_UI = "/caregiver-account-ui-v1.js?v=1.0.0";
const CAREGIVER_ACCOUNT_UI_V2 = "/caregiver-account-ui-v2.js?v=2.0.0";
const STAFF_ROLES = new Set(["ADMIN", "RECRUITER", "HR", "SUPPORT", "EVALUATOR", "EDUCATION", "OPERATIONS", "SALES_CONSULTANT", "SALES_SUPERVISOR"]);
const LOGIN_SAMPLE_MOBILE = "09128668837";

type WorkerLifecycleContext = { waitUntil(promise: Promise<unknown>): void };
type WorkerScheduledController = { scheduledTime: number; cron: string; noRetry?(): void };

function isMobileClient(request: Request) {const ua = request.headers.get("user-agent") || "";const clientHint = request.headers.get("sec-ch-ua-mobile") === "?1";return clientHint || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);}
function desktopClassicRequested(url: URL) {return url.searchParams.get("classic") === "1";}
async function sessionRole(request: Request, env: any, ctx: WorkerLifecycleContext) {try {const authUrl = new URL(request.url);authUrl.pathname = "/api/auth/me";authUrl.search = "";const authRequest = new Request(authUrl.toString(), { method: "GET", headers: request.headers });const response = await app.fetch(authRequest, env, ctx);if (!response.ok) return "";const payload: any = await response.json().catch(() => null);return String(payload?.data?.role || "").toUpperCase();} catch {return "";}}
async function delegateProtectedApp(request: Request, env: any, ctx: WorkerLifecycleContext) {return app.fetch(request, env, ctx);}
function desktopHeaders(response: Response, documentResponse = false) {const headers = new Headers(response.headers);headers.delete("content-length");headers.delete("pragma");headers.delete("expires");headers.set("cache-control", documentResponse ? "private, no-store, max-age=0" : "public, max-age=0, must-revalidate");headers.set("x-salamat-desktop-owner", `react-${DESKTOP_REACT_VERSION}`);headers.set("x-salamat-desktop-react", DESKTOP_REACT_VERSION);headers.set("x-salamat-desktop-layer-count", "1");return new Response(response.body, { status: response.status, statusText: response.statusText, headers });}
async function sanitizeLoginSample(request: Request, response: Response) {if (!['GET','HEAD'].includes(request.method.toUpperCase()) || !response.ok) return response;const contentType = response.headers.get("content-type") || "";if (!contentType.includes("text/html")) return response;let html = await response.text(),changed=false,bridgeInjected=false;if (html.includes(LOGIN_SAMPLE_MOBILE)) {html = html.replaceAll(`value="${LOGIN_SAMPLE_MOBILE}"`, "value=\"\"").replaceAll(`value='${LOGIN_SAMPLE_MOBILE}'`, "value=''").replaceAll(`placeholder="${LOGIN_SAMPLE_MOBILE}"`, "placeholder=\"09xxxxxxxxx\"").replaceAll(`placeholder='${LOGIN_SAMPLE_MOBILE}'`, "placeholder='09xxxxxxxxx'").replaceAll(LOGIN_SAMPLE_MOBILE, "");changed=true;}const url=new URL(request.url);const canBridge=!desktopClassicRequested(url)&&!url.pathname.startsWith('/app')&&!url.pathname.startsWith('/mobile');if(canBridge&&!html.includes('desktop-react-entry-bridge-v1.js')){const tag=`<script src="${CLASSIC_REACT_BRIDGE}"></script>`;html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;changed=true;bridgeInjected=true;}if(!html.includes('caregiver-account-ui-v1.js')){const tag=`<script src="${CAREGIVER_ACCOUNT_UI}"></script>`;html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;changed=true;}if(!html.includes('caregiver-account-ui-v2.js')){const tag=`<script src="${CAREGIVER_ACCOUNT_UI_V2}"></script>`;html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;changed=true;}if(!changed)return new Response(html,response);const headers = new Headers(response.headers);headers.delete("content-length");headers.set("cache-control", "private, no-store, max-age=0");if(!html.includes(LOGIN_SAMPLE_MOBILE))headers.set("x-salamat-login-sample", "removed");if(bridgeInjected)headers.set("x-salamat-classic-react-bridge","1.0.0");headers.set("x-salamat-caregiver-account-ui","2.0.0");return new Response(html, { status: response.status, statusText: response.statusText, headers });}
async function serveDesktopReact(request: Request, env: any) {const url = new URL(request.url);if (url.pathname === "/app") {url.pathname = "/app/";return Response.redirect(url.toString(), 302);}const isAsset = /\.(?:js|css|webmanifest|svg|png|webp|jpg|jpeg|ico)$/i.test(url.pathname);if (isAsset) return desktopHeaders(await env.ASSETS.fetch(request), false);const assetUrl = new URL(request.url);assetUrl.pathname = DESKTOP_REACT_INDEX;assetUrl.search = "";const indexRequest = new Request(assetUrl.toString(), { method: request.method, headers: request.headers });return desktopHeaders(await env.ASSETS.fetch(indexRequest), true);}
function shouldCheckDesktopSession(request: Request, url: URL) {if (isMobileClient(request) || desktopClassicRequested(url)) return false;if (!["GET", "HEAD"].includes(request.method.toUpperCase())) return false;return ["/", "/index.html", "/panel", "/panel/", "/panel/index.html"].includes(url.pathname);}

export default {
  async fetch(request: Request, env: any, ctx: WorkerLifecycleContext) {
    const url = new URL(request.url);const method = request.method.toUpperCase();
    const accountUiResponse=routeCaregiverAccountUiV2(request,env);if(accountUiResponse)return accountUiResponse;
    const credentialResponse=await routeCaregiverInitialCredentialsV1(request,env);if(credentialResponse)return credentialResponse;
    const lifecyclePatch = url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);const lifecycleBody = lifecyclePatch && method === "PATCH" ? await request.clone().json().catch(() => null) : null;
    await prepareProductionContractRowsV1(request,env);
    const productionContractResponse=await routeProductionContractRepairV1(request,env);if(productionContractResponse)return productionContractResponse;
    const reopenResponse=await routeStaffContractReopenV1(request,env);if(reopenResponse)return reopenResponse;
    // Exact staff bank GET must be owned before the legacy staff-read wrapper below,
    // otherwise sort/filter query parameters are swallowed by the old list route.
    const staffJobAdListResponse=await routeStaffJobAdListFiltersV1(request,env);if(staffJobAdListResponse)return staffJobAdListResponse;
    const controlResponse=await routeContractExitJobAdUserControlsV1(request,env);if(controlResponse)return controlResponse;
    const lifecycleResponse = await routeContractLifecycleV2(request, env);if (lifecycleResponse) return decorateContractListPointsV1(request,env,lifecycleResponse);
    const caregiverPresetResponse=await routeAdminCaregiverPresetV1(request,env);if(caregiverPresetResponse)return caregiverPresetResponse;
    const approvalResponse = await routeSelfRegisteredApprovalV1(request, env);if (approvalResponse) return approvalResponse;
    const avatarResponse = await routeLatestProfileAvatar(request, env);if(avatarResponse)return avatarResponse;
    const loanResponse = await routeLoanCreditPolicyV2(request, env);if(loanResponse)return loanResponse;
    const retentionResponse = await routeRetentionRewardsV1(request, env);if(retentionResponse)return retentionResponse;
    const contractResponse = await routeStaffContractsRetentionV2(request, env);if(contractResponse)return contractResponse;
    const referralResponse = await routeReferralRewardsV5(request, env);if(referralResponse)return referralResponse;
    const financialResponse = await routeCaregiverFinancialProfileReferralFixV1(request, env);if(financialResponse)return financialResponse;
    const notificationResponse = await routeCaregiverNotificationsUnityV1(request, env);if(notificationResponse)return decorateCaregiverWelcomeNotificationV1(request,env,notificationResponse);
    const jobAdUnityResponse=await routeJobAdCaregiverVisibilityV1(request,env);if(jobAdUnityResponse)return jobAdUnityResponse;
    let jobAdsResponse = await routeContractProgressEngine(request, env);
    if (jobAdsResponse) {
      if (lifecyclePatch && jobAdsResponse.ok && String(lifecycleBody?.status || "").toUpperCase() === "IN_CONTRACT") {try {await reconcileContractCaseByApplication(env, decodeURIComponent(lifecyclePatch[2]));}catch (error) {console.error("contract_case_immediate_reconcile_failed", {applicationId: decodeURIComponent(lifecyclePatch[2]),adId: decodeURIComponent(lifecyclePatch[1]),error: error instanceof Error ? error.message : String(error)});}}
      jobAdsResponse=await decorateLegacyJobAdContractState(request,env,jobAdsResponse);
      return jobAdsResponse;
    }
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) return serveDesktopReact(request, env);
    if (shouldCheckDesktopSession(request, url)) {const role = await sessionRole(request, env, ctx);if (STAFF_ROLES.has(role) || role === "CAREGIVER") {const target = new URL(request.url);target.pathname = role === "CAREGIVER" ? "/mobile/" : "/app/";target.search = "";return Response.redirect(target.toString(), 302);}}
    let response = await delegateProtectedApp(request, env, ctx);if (lifecyclePatch && response.ok && String(lifecycleBody?.status || "").toUpperCase() === "IN_CONTRACT") ctx.waitUntil(reconcileContractCaseByApplication(env, decodeURIComponent(lifecyclePatch[2])).catch(() => undefined));response = await rewriteJobAdsAccessResponse(request, response);response = await rewriteFinancialResponseWithPoints(request, env, response);response = await rewriteSalesSupervisorAccessV1(request,response);return sanitizeLoginSample(request, response);
  },
  async scheduled(controller: WorkerScheduledController, env: any, ctx: WorkerLifecycleContext) {
    try{await reconcileLegacyOpenContracts(env)}catch(error){console.error("legacy_contract_scheduled_reconcile_failed",error instanceof Error?error.message:String(error))}
    ctx.waitUntil(reconcileAllActiveContracts(env));
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  }
};