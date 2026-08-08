(()=>{
'use strict';
if(window.__salamatRuntimeSingleOwnerV8)return;
window.__salamatRuntimeSingleOwnerV8=true;
const VERSION='8.0.0';
const MOBILE_EVALUATION_DRILLDOWN_VERSION='7.6.0';
const MOBILE_EVALUATION_DRILLDOWN_ASSET='mobile-evaluation-drilldown-v7-6.js';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=v=>Number(v||0).toLocaleString('fa-IR');
let adminPromise=null,walletPromise=null,routerPatched=false,accessPatched=false,patchAttempts=0;

function currentRole(){try{return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.__salamatPanelAccessV2?.user?.role||'').toUpperCase()}catch{return ''}}
function staffActive(){const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;return currentRole()==='ADMIN'||String($('#sidebarRole')?.textContent||'').includes('مدیر سامانه')||String(window.SalamatStaffModuleRouter?.access?.panel||'').toUpperCase()==='STAFF'}
function caregiverActive(){const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;return currentRole()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب')}
function buttonKey(button){return button?.dataset?.panelModuleKey||button?.dataset?.accessModule||button?.dataset?.caregiverModuleKey||''}
function setActive(key){$$('#sidebarNav .nav-item,#sidebarNav>button').forEach(button=>{const active=buttonKey(button)===key;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')})}
async function accessModel(){const existing=window.SalamatStaffModuleRouter?.access||window.SalamatAccessControl?.access;if(existing?.panel==='STAFF')return existing;const response=await fetch('/api/access/me',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('اطلاعات دسترسی مدیر دریافت نشد.');const payload=await response.json();return payload.data||null}
function dashboardMarkup(access){const modules=(access?.modules||[]).filter(module=>module.panel==='STAFF'&&module.actions?.view);const permissionCount=modules.reduce((sum,module)=>sum+Object.values(module.actions||{}).filter(Boolean).length,0);const roleLabel=access?.user?.roleLabel||'مدیر سامانه';return `<section class="module-page spx-root" data-single-owner-dashboard="${VERSION}"><div class="spx-dashboard"><div class="spx-kpis"><div class="spx-kpi"><small>ماژول‌های فعال</small><strong>${fa(modules.length)}</strong></div><div class="spx-kpi"><small>اختیارات فعال</small><strong>${fa(permissionCount)}</strong></div><div class="spx-kpi"><small>نقش سازمانی</small><strong style="font-size:15px">${esc(roleLabel)}</strong></div><div class="spx-kpi"><small>وضعیت سامانه</small><strong style="font-size:15px">آماده</strong></div></div><section class="spx-card"><header class="spx-head"><h3>ماژول‌های در دسترس</h3><p>دسترسی‌های مدیریتی حساب شما از همین داشبورد باز می‌شوند.</p></header><div class="spx-body"><div class="spx-modules">${modules.filter(module=>module.key!=='staff.dashboard').map(module=>`<button class="spx-module" type="button" data-s8-open="${esc(module.key)}"><strong>${esc(module.label)}</strong><small>${esc(module.description||'')}</small></button>`).join('')||'<div class="spx-empty">ماژول دیگری برای این حساب فعال نشده است.</div>'}</div></div></section></div></section>`}
async function openAdminDashboard(){if(!staffActive())return false;if(adminPromise)return adminPromise;adminPromise=(async()=>{const access=await accessModel();if(!access||access.panel!=='STAFF')return false;setActive('staff.dashboard');const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');if(title)title.textContent='داشبورد مدیریتی';if(subtitle)subtitle.textContent=`نمای سازمانی ${access.user?.roleLabel||'مدیر سامانه'}`;if(content)content.innerHTML=dashboardMarkup(access);try{window.hydrateIcons?.(content)}catch{}window.dispatchEvent(new CustomEvent('salamat-single-owner-dashboard',{detail:{version:VERSION}}));return true})().catch(error=>{console.error('Single-owner admin dashboard failed',error);return false}).finally(()=>{adminPromise=null});return adminPromise}

async function waitForFinance(){for(let i=0;i<20;i+=1){const runtime=window.SalamatUnifiedFinancialProfileV4;if(runtime?.refresh)return runtime;await new Promise(resolve=>setTimeout(resolve,25))}throw new Error('ماژول مالی مراقب آماده نشد.')}
async function openCaregiverWallet(){if(!caregiverActive())return false;if(walletPromise)return walletPromise;walletPromise=(async()=>{setActive('caregiver.wallet');const content=$('#content'),title=$('#pageTitle'),subtitle=$('#pageSubtitle');if(content&&!$('#caregiverUnifiedFinancialProfileV4',content))content.innerHTML='<section class="module-page ufp4-single-owner-host"></section>';if(title)title.textContent='کیف پول و اعتبارات';if(subtitle)subtitle.textContent='کارنامه مالی، تسهیلات و اقدامات کیف پول';const runtime=await waitForFinance();await Promise.resolve(runtime.refresh());window.dispatchEvent(new CustomEvent('salamat-single-owner-wallet',{detail:{version:VERSION}}));return true})().catch(error=>{console.error('Single-owner caregiver wallet failed',error);const host=$('#content .ufp4-single-owner-host')||$('#content');if(host)host.innerHTML=`<div class="ufp4-error">${esc(error.message||'کیف پول بارگذاری نشد.')}</div>`;return false}).finally(()=>{walletPromise=null});return walletPromise}

function loadMobileEvaluationDrilldown(){
  if(!window.matchMedia?.('(max-width:760px)').matches)return false;
  if(window.__salamatMobileEvaluationDrilldownV76||window.SalamatMobileEvaluationDrilldown)return true;
  const existing=[...document.scripts].find(script=>String(script.src||'').includes(`/${MOBILE_EVALUATION_DRILLDOWN_ASSET}`));
  if(existing)return true;
  const script=document.createElement('script');
  script.src=`./${MOBILE_EVALUATION_DRILLDOWN_ASSET}?v=${MOBILE_EVALUATION_DRILLDOWN_VERSION}`;
  script.async=true;
  script.dataset.salamatMobileEvaluationDrilldown=MOBILE_EVALUATION_DRILLDOWN_VERSION;
  script.onerror=()=>console.error('Mobile evaluation drill-down runtime failed to load');
  document.head.appendChild(script);
  return true;
}

function patchRouter(){const router=window.SalamatStaffModuleRouter;if(router&&!router.__singleOwnerV8&&typeof router.route==='function'){const original=router.route.bind(router);router.route=key=>key==='staff.dashboard'?openAdminDashboard():original(key);router.__singleOwnerV8=true;routerPatched=true}const access=window.SalamatAccessControl;if(access&&!access.__singleOwnerV8){if(typeof access.openModule!=='function')access.openModule=key=>key==='staff.dashboard'?openAdminDashboard():window.SalamatStaffModuleRouter?.route?.(key);access.__singleOwnerV8=true;accessPatched=true}}
function patchCaregiverPlatform(){const platform=window.SalamatCaregiverPlatform;if(platform&&!platform.__singleOwnerV8){platform.openWallet=openCaregiverWallet;platform.__singleOwnerV8=true}}
function patchGlobals(){patchRouter();patchCaregiverPlatform();if((routerPatched&&accessPatched&&window.SalamatCaregiverPlatform)||patchAttempts>=30)return;patchAttempts+=1;setTimeout(patchGlobals,40)}

function capture(event){const card=event.target?.closest?.('[data-s8-open]');if(card&&staffActive()){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const key=card.dataset.s8Open;if(key==='staff.dashboard')void openAdminDashboard();else void window.SalamatStaffModuleRouter?.route?.(key);return}const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');if(!button)return;const key=buttonKey(button);if(key==='staff.dashboard'&&staffActive()){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openAdminDashboard();return}if(key==='caregiver.wallet'&&caregiverActive()){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openCaregiverWallet()}}
function onAuthenticated(){loadMobileEvaluationDrilldown();patchGlobals();queueMicrotask(()=>{if(staffActive()){const active=buttonKey($('#sidebarNav .active'));if(!active||active==='staff.dashboard')void openAdminDashboard()}})}
function boot(){loadMobileEvaluationDrilldown();window.addEventListener('click',capture,true);window.addEventListener('salamat-authenticated',onAuthenticated);window.addEventListener('salamat-access-ready',()=>{loadMobileEvaluationDrilldown();patchGlobals();if(staffActive()&&!$('#content .spx-dashboard'))void openAdminDashboard()});window.addEventListener('salamat-navigation-canonical',()=>{patchGlobals();if(staffActive()&&!$('#content .spx-dashboard'))void openAdminDashboard()});patchGlobals();window.SalamatRuntimeSingleOwnerV8={version:VERSION,openAdminDashboard,openCaregiverWallet,loadMobileEvaluationDrilldown,patch:patchGlobals}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
