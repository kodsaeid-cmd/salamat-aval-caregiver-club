import application from "./index";
import { getFinancialBenefits, updateContractInsurance } from "./benefits";
import { syncContractsForBenefits } from "./benefits-sync";
import { getTrainingAdminDashboard } from "./training-admin";
import { getAssignedTrainingContent } from "./training-content";
import { getAssignedTrainingFile } from "./training-file-access";
import {
  assignCourse, closeTraining, completeTraining, createCourse, getMyTraining,
  heartbeatTraining, openTraining, updateCourse,
} from "./training";
import { type Env, fail, getUser, json, securityHeaders } from "./lib";

async function benefitRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/benefits/")) return null;

  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/benefits/summary") {
    await syncContractsForBenefits(env);
    return getFinancialBenefits(request, env, actor);
  }
  const insuranceMatch = path.match(/^\/api\/benefits\/contracts\/([^/]+)\/insurance$/);
  if (insuranceMatch && method === "PUT") {
    return updateContractInsurance(request, env, actor, decodeURIComponent(insuranceMatch[1]));
  }
  return fail("مسیر مزایا پیدا نشد.", 404, "not_found");
}

async function trainingRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/training/")) return null;

  const actor = await getUser(request, env);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401, "unauthorized");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/training/my") return getMyTraining(request, env, actor);
  if (method === "GET" && path === "/api/training/admin") return getTrainingAdminDashboard(env, actor);
  if (method === "POST" && path === "/api/training/courses") return createCourse(request, env, actor);
  if (method === "POST" && path === "/api/training/assignments") return assignCourse(request, env, actor);

  const courseMatch = path.match(/^\/api\/training\/courses\/([^/]+)$/);
  if (courseMatch && method === "PATCH") return updateCourse(request, env, actor, decodeURIComponent(courseMatch[1]));
  const enrollmentContentMatch = path.match(/^\/api\/training\/enrollments\/([^/]+)\/content$/);
  if (enrollmentContentMatch && method === "GET") return getAssignedTrainingContent(request, env, actor, decodeURIComponent(enrollmentContentMatch[1]));
  const enrollmentOpenMatch = path.match(/^\/api\/training\/enrollments\/([^/]+)\/open$/);
  if (enrollmentOpenMatch && method === "POST") return openTraining(request, env, actor, decodeURIComponent(enrollmentOpenMatch[1]));
  const enrollmentCompleteMatch = path.match(/^\/api\/training\/enrollments\/([^/]+)\/complete$/);
  if (enrollmentCompleteMatch && method === "POST") return completeTraining(request, env, actor, decodeURIComponent(enrollmentCompleteMatch[1]));
  const heartbeatMatch = path.match(/^\/api\/training\/sessions\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && method === "POST") return heartbeatTraining(env, actor, decodeURIComponent(heartbeatMatch[1]));
  const closeMatch = path.match(/^\/api\/training\/sessions\/([^/]+)\/close$/);
  if (closeMatch && method === "POST") return closeTraining(request, env, actor, decodeURIComponent(closeMatch[1]));
  return fail("مسیر آموزش پیدا نشد.", 404, "not_found");
}

async function assignedTrainingFileRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/files\/([^/]+)\/download$/);
  if (!match || request.method.toUpperCase() !== "GET") return null;
  const actor = await getUser(request, env);
  if (!actor || actor.role.toUpperCase() !== "CAREGIVER") return null;
  return getAssignedTrainingFile(request, env, actor, decodeURIComponent(match[1]));
}

function isInlineTrainingContent(request: Request, response: Response) {
  const path = new URL(request.url).pathname;
  if (path.includes("/api/training/enrollments/") && path.endsWith("/content")) return response.ok;
  if (path.startsWith("/api/files/") && path.endsWith("/download")) return response.ok && !response.headers.get("content-type")?.includes("application/json");
  return false;
}

const adminHeroRuntime = `<script>(()=>{
  if(window.__salamatAdminHeroV2)return;
  window.__salamatAdminHeroV2=true;
  const style=document.createElement('style');
  style.id='salamatAdminHeroV2Styles';
  style.textContent='.adm-hero.adm-hero-v2{padding:0!important;min-height:clamp(270px,23vw,420px);display:grid!important;grid-template-columns:minmax(0,1.04fr) minmax(430px,.96fr);gap:0!important;overflow:hidden;border-radius:32px!important;background:linear-gradient(135deg,#0a6f43,#064b31)!important;box-shadow:0 18px 45px rgba(7,89,52,.16);direction:ltr}.adm-hero-v2 .adm-hero-photo{position:relative;min-height:100%;overflow:hidden;background:#edf3ef}.adm-hero-v2 .adm-hero-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 72%,rgba(7,88,52,.42));pointer-events:none}.adm-hero-v2 .adm-hero-photo img{width:100%;height:100%;display:block;object-fit:cover;object-position:center}.adm-hero-v2 .adm-hero-copy{direction:rtl;display:flex;flex-direction:column;justify-content:center;padding:42px clamp(30px,4vw,72px);color:#fff;text-align:right}.adm-hero-v2 .adm-hero-copy small{font-size:clamp(12px,1.05vw,18px);font-weight:800;opacity:.92}.adm-hero-v2 .adm-hero-copy h2{margin:18px 0 14px;font-size:clamp(28px,3vw,52px);line-height:1.45;color:#fff}.adm-hero-v2 .adm-hero-copy p{margin:0;max-width:760px;font-size:clamp(13px,1.25vw,20px);line-height:2;color:rgba(255,255,255,.88)}.adm-hero-v2 .adm-hero-divider{width:72%;height:1px;margin:8px 0 16px;background:linear-gradient(90deg,transparent,#17a766 24%,#17a766 76%,transparent)}.adm-hero-v2 .adm-hero-actions,[data-admin-go="کاربران و دسترسی‌ها"],[data-admin-go="پرونده مراقبین"]{display:none!important}@media(max-width:1000px){.adm-hero.adm-hero-v2{grid-template-columns:1fr;min-height:auto}.adm-hero-v2 .adm-hero-photo{min-height:300px}.adm-hero-v2 .adm-hero-copy{padding:30px}.adm-hero-v2 .adm-hero-photo:after{background:linear-gradient(180deg,transparent 70%,rgba(7,88,52,.45))}}';
  document.head.appendChild(style);
  const imageSource=()=>document.querySelector('.login-visual-photo')?.getAttribute('src')||'';
  const removeLegacyActions=root=>{
    root.querySelectorAll?.('.adm-hero-actions').forEach(node=>node.remove());
    root.querySelectorAll?.('button').forEach(button=>{
      const text=String(button.textContent||'').trim();
      if(text==='تأیید کاربران'||text==='پرونده جدید')button.remove();
    });
  };
  const apply=()=>{
    const content=document.getElementById('content');
    if(!content)return;
    removeLegacyActions(content);
    const hero=content.querySelector('.adm-hero');
    if(!hero||hero.dataset.salHero==='2')return;
    const src=imageSource();
    hero.dataset.salHero='2';
    hero.className='adm-hero adm-hero-v2';
    hero.innerHTML='<div class="adm-hero-photo"><img alt="مراقب سلامت اول در حال همراهی سالمند"></div><div class="adm-hero-copy"><small>سلام مدیر، به مرکز فرمان باشگاه خوش آمدید</small><h2>مدیریت یکپارچه باشگاه مراقبین سلامت اول</h2><div class="adm-hero-divider"></div><p>پرونده‌ها، کاربران، آموزش، ارزیابی و پرداخت‌ها را یکجا، دقیق و لحظه‌ای مدیریت کنید.</p></div>';
    const img=hero.querySelector('img');
    if(img&&src)img.src=src;
  };
  const start=()=>{
    apply();
    const content=document.getElementById('content');
    if(content)new MutationObserver(apply).observe(content,{childList:true,subtree:true});
    const loginPhoto=document.querySelector('.login-visual-photo');
    if(loginPhoto)new MutationObserver(()=>{
      const heroImage=document.querySelector('.adm-hero-v2 img');
      const src=imageSource();
      if(heroImage&&src)heroImage.src=src;
    }).observe(loginPhoto,{attributes:true,attributeFilter:['src']});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();</script>`;

async function injectRuntime(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  const scripts: string[] = [];
  if (!html.includes("server-training-runtime.js")) {
    scripts.push('<script src="./server-training-runtime.js?v=1.0.1"></script>');
  }
  if (!html.includes("training-admin-classic-runtime.js")) {
    scripts.push('<script src="./training-admin-classic-runtime.js?v=1.0.0"></script>');
  }
  if (!html.includes("__salamatAdminHeroV2")) scripts.push(adminHeroRuntime);
  if (scripts.length) html = html.replace("</body>", `${scripts.join("")}</body>`);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const trainingResponse = await trainingRoute(request, env);
      if (trainingResponse) return isInlineTrainingContent(request, trainingResponse) ? trainingResponse : securityHeaders(trainingResponse);
      const assignedFileResponse = await assignedTrainingFileRoute(request, env);
      if (assignedFileResponse) return isInlineTrainingContent(request, assignedFileResponse) ? assignedFileResponse : securityHeaders(assignedFileResponse);
      const benefitResponse = await benefitRoute(request, env);
      if (benefitResponse) return securityHeaders(benefitResponse);
      return injectRuntime(await application.fetch(request, env));
    } catch (error) {
      console.error("Extended worker request failed", error);
      const detail = error instanceof Error ? error.message : "unknown error";
      return securityHeaders(json({ error: "internal_error", message: "خطای داخلی سرور رخ داد.", detail }, 500));
    }
  },
};
