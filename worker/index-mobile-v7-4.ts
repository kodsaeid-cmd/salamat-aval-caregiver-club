import app from "./index-unified-financial-v4";
import { type Env } from "./lib";

const VERSION = "7.4.0";
const ASSET = "mobile-functional-fixes-v7-4.js";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

function stripScript(html: string, fileName: string) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, "gi"),
    "",
  );
}

function injectCriticalMobileLayer(html: string) {
  const marker = `data-salamat-mobile-critical="${VERSION}"`;
  if (html.includes(marker)) return html;

  const style = `<style ${marker}>
#loginView .join-network-action,.mc5-login .join-network-action{width:100%!important;min-height:64px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:11px!important;border:0!important;border-radius:17px!important;padding:14px 18px!important;background:linear-gradient(135deg,#087a45,#0b9658)!important;color:#fff!important;box-shadow:0 13px 28px rgba(8,122,69,.24)!important;font:inherit!important;cursor:pointer!important;touch-action:manipulation!important}
#loginView .join-network-action strong,.mc5-login .join-network-action strong{display:block!important;color:#fff!important;font-size:13px!important;font-weight:900!important;line-height:1.8!important;text-align:center!important}
#loginView .join-network-action small,.mc5-login .join-network-action small,#loginView .join-network-block>small,.mc5-login .join-network-block>small{display:none!important}
#loginView .join-network-block,.mc5-login .join-network-block{margin:14px 0 0!important;padding:0!important}
#loginView .join-network-action [data-icon],.mc5-login .join-network-action [data-icon]{color:#fff!important;flex:0 0 auto!important}
#mc5SoundButton,.mc5-sound{display:none!important}
@media(max-width:760px){
 html.salamt-mobile-preboot-v74 #appView{visibility:hidden!important}
 html.salamt-mobile-preboot-v74 body{background:#f4f8f6!important}
 .sev4-root,.sev4-panel,.sev4-search-form,.sev4-list,.sev4-care{position:relative!important;pointer-events:auto!important}
 .sev4-search-form,.sev4-list{z-index:3!important}
 .sev4-care{z-index:4!important;touch-action:manipulation!important}
 .sev4-search{font-size:16px!important;touch-action:manipulation!important}
 .cgt3-card footer{display:flex!important;visibility:visible!important;opacity:1!important}
 .cgt3-card [data-cgt3-open]{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
}
</style>`;

  const code = `if(window.matchMedia&&window.matchMedia("(max-width:760px)").matches){document.documentElement.classList.add("salamat-mobile-preboot-v74");window.__salamatEvaluationSearchSubmitOwnerV1=true;window.__salamatEvaluationSearchCanonicalV1=true;window.__salamatServerEvaluationRuntime=true;window.__salamatServerEvaluationRuntimeV2=true;window.__salamatServerEvaluationRuntimeV3=true;}`;
  const script = `<script data-salamat-mobile-preboot="${VERSION}">${code}</script>`;
  const tags = `${style}${script}`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${tags}`);
  }
  return `${tags}${html}`;
}

function injectFunctionalFixes(html: string) {
  html = stripScript(html, ASSET);
  const tag = `<script defer src="./${ASSET}?v=${VERSION}"></script>`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}

async function transformHtml(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  let html = await response.text();
  html = injectCriticalMobileLayer(html);
  html = injectFunctionalFixes(html);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-salamat-mobile-functional-fixes", VERSION);
  headers.set("x-salamat-mobile-preboot", VERSION);
  headers.set("x-salamat-evaluation-mobile-owner", VERSION);
  headers.set("x-salamat-training-mobile-owner", VERSION);
  headers.set("x-salamat-login-cta", VERSION);
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const response = await app.fetch(request, env, context);
    return new URL(request.url).pathname.startsWith("/api/") ? response : transformHtml(response);
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
