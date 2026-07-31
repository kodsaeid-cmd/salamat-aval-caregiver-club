import application from "./index";
import { getFinancialBenefits, updateContractInsurance } from "./benefits";
import { type Env, fail, getUser, json, securityHeaders } from "./lib";

async function benefitRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/benefits/")) return null;

  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/benefits/summary") {
    return getFinancialBenefits(request, env, actor);
  }
  const insuranceMatch = path.match(/^\/api\/benefits\/contracts\/([^/]+)\/insurance$/);
  if (insuranceMatch && method === "PUT") {
    return updateContractInsurance(request, env, actor, decodeURIComponent(insuranceMatch[1]));
  }
  return fail("مسیر مزایا پیدا نشد.", 404, "not_found");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await benefitRoute(request, env);
      if (response) return securityHeaders(response);
      return application.fetch(request, env);
    } catch (error) {
      console.error("Benefits request failed", error);
      const detail = error instanceof Error ? error.message : "unknown error";
      return securityHeaders(json({ error: "internal_error", message: "خطای داخلی سرور رخ داد.", detail }, 500));
    }
  },
};
