import { getCalendar } from "./calendar";
import { contractCalendarEvents } from "./staff-contracts-v1";
import { type Env, fail, getUser, json, securityHeaders } from "./lib";

type CalendarPayload = {
  data?: {
    caregiver?: { id?: string } | null;
    events?: Record<string, unknown>[];
    range?: { start?: string; end?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function routeContractCalendarOverlayV1(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method.toUpperCase() !== "GET" || url.pathname !== "/api/calendar") return null;

  const actor = await getUser(request, env);
  if (!actor) return securityHeaders(fail("ابتدا وارد حساب شوید.", 401, "unauthorized"));
  const response = await getCalendar(request, env, actor);
  const payload = await response.json().catch(() => null) as CalendarPayload | null;
  if (!response.ok || !payload?.data) {
    return securityHeaders(json(payload || { error: "calendar_failed", message: "تقویم دریافت نشد." }, response.status));
  }

  const caregiverId = String(payload.data.caregiver?.id || actor.caregiverId || "");
  const start = String(payload.data.range?.start || url.searchParams.get("start") || "");
  const end = String(payload.data.range?.end || url.searchParams.get("end") || "");
  if (!caregiverId || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return securityHeaders(json(payload, response.status));
  }

  const contractEvents = await contractCalendarEvents(env, caregiverId, start, end);
  payload.data.events = [...(Array.isArray(payload.data.events) ? payload.data.events : []), ...contractEvents];
  payload.data.contractCalendar = {
    source: "contracts",
    generatedEvents: contractEvents.length,
    readOnly: true,
  };
  return securityHeaders(json(payload, response.status));
}
