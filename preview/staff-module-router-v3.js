(()=>{
'use strict';
if(window.__salamatStaffModuleRouterV5)return;
window.__salamatStaffModuleRouterV5=true;
// Prevent every superseded router from registering a competing handler.
window.__salamatStaffModuleRouterV4=true;
window.__salamatStaffModuleRouterV3=true;
window.__salamatPanelModuleIsolationV2=true;

const VERSION='5.0.0';
const ASSET_VERSION='2.4.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();
const roleRoute={ADMIN:'admin',CAREGIVER:'caregiver',RECRUITER:'recruiter',HR:'hr',SUPPORT:'admin',EVALUATOR:'admin',EDUCATION:'admin',OPERATIONS:'admin'};
const exactLabels={
  'داشبورد مدیریتی':'staff.dashboard','کاربران و دسترسی‌ها':'staff.users','مدیریت کاربران':'staff.users',
  'پرونده مراقبین':'staff.caregivers','مراقبین':'staff.caregivers','قراردادها':'staff.contracts',
  'حقوق و پرداخت':'staff.payroll','حقوق و دستمزد':'staff.payroll','اعتبارات مالی':'staff.financial_credits',
  'بانک آموزش':'staff.training','آموزش':'staff.training','ارزیابی و پروانه':'staff.evaluations',
  'پایش و امتیازات':'staff.evaluations','پشتیبانی':'staff.support','پشتیبانی و امنیت':'staff.support',
  'تنظیمات و لاگ':'staff.settings','تنظیمات سامانه':'staff.settings',
};
const hiddenKeys=new Set(['staff.reports']);
const state={access:null,loading:false,activeKey:'',observer:null,repairTimer:0,repairing:false,scriptLoads:new Map()};

async function api(path){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}
    return payload;
  }catch(error){if(error?.name==='AbortError')throw new Error('پاسخ سامانه بیش از حد طول کشید. صفحه را تازه‌سازی کنید.');throw error}
  finally{clearTimeout(timeout)}
}
function panel(){return String(state.access?.panel||'').toUpperCase()}
function modules(){return (state.access?.modules||[]).filter(module=>module.panel==='STAFF'&&module.actions?.view&&!hiddenKeys.has(module.key))}
function moduleByKey(key){return (state.access?.allModules||[]).find(module=>module.key===key)||modules().find(module=>module.key===key)}
function canView(key){return Boolean(moduleByKey(key)?.actions?.view)}
function labelKey(label){const clean=normalize(label);const direct=modules().find(module=>normalize(module.label)===clean);return direct?.key||exactLabels[clean]||''}
function setRoleBoundary(){const role=String(state.access?.user?.role||'').toUpperCase();try{window.selectedRole=roleRoute[role]||'admin'}catch{}window.__salamatResolvedPanel=panel();window.__salamatResolvedRole=role}
function navButtons(){return $$('#sidebarNav .nav-item,#sidebarNav>button')}
function buttonKey(button){return button?.dataset.panelModuleKey||button?.dataset.accessModule||labelKey(button?.textContent)||''}
function currentKey(){if(state.activeKey&&modules().some(module=>module.key===state.activeKey))return state.activeKey;const active=navButtons().find(button=>button.classList.contains('active'));return buttonKey(active)||labelKey($('#pageTitle')?.textContent)||modules()[0]?.key||''}
function canonicalSignature(){return modules().map(module=>module.key).join('|')}
function actualSignature(){return navButtons().map(button=>buttonKey(button)).filter(Boolean).join('|')}
function model(){const base=window.roles?.admin||{},user=state.access?.user||{};return {...base,name:user.fullName||base.name,role:user.roleLabel||base.role,title:`پنل ${user.roleLabel||'سازمانی'}`,subtitle:'دسترسی‌های عملیاتی و تفکیک‌شده سامانه',nav:modules().map(module=>[module.icon,module.label,null,module.key])}}
function setActive(key){state.activeKey=key;navButtons().forEach(button=>button.classList.toggle('active',buttonKey(button)===key));$('#sidebar')?.classList.remove('open')}
function canonicalButton(module,active){
  const badge=module.badge?`<span class="nav-badge">${esc(module.badge)}</span>`:'';
  return `<button class="nav-item ${module.key===active?'active':''}" type="button" data-panel-module-key="${esc(module.key)}" data-access-module="${esc(module.key)}" aria-label="${esc(module.label)}"><span data-icon="${esc(module.icon||'home')}"></span><span>${esc(module.label)}</span>${badge}</button>`;
}
function renderCanonicalNavigation(force=false){
  if(panel()!=='STAFF'||state.repairing)return false;
  const nav=$('#sidebarNav');if(!nav)return false;
  if(!force&&actualSignature()===canonicalSignature()){
    try{window.hydrateIcons?.(nav)}catch{}
    return true;
  }
  const list=modules();if(!list.length)return false;
  const previous=currentKey();const active=list.some(module=>module.key===previous)?previous:list[0].key;
  state.repairing=true;
  try{
    nav.innerHTML=list.map(module=>canonicalButton(module,active)).join('');
    try{window.hydrateIcons?.(nav)}catch{}
    state.activeKey=active;
    window.SalamatAccessModel=model();
    window.dispatchEvent(new CustomEvent('salamat-navigation-canonical',{detail:{version:VERSION,keys:list.map(module=>module.key)}}));
    return true;
  }finally{state.repairing=false}
}
function scheduleRepair(force=false){clearTimeout(state.repairTimer);state.repairTimer=setTimeout(()=>renderCanonicalNavigation(force),60)}
function observeNavigation(){const nav=$('#sidebarNav');if(!nav||state.observer)return;state.observer=new MutationObserver(()=>{if(!state.repairing)scheduleRepair(false)});state.observer.observe(nav,{childList:true,subtree:false})}
function setLoading(title,subtitle='در حال بارگذاری اطلاعات ماژول...'){if($('#pageTitle'))$('#pageTitle').textContent=title;if($('#pageSubtitle'))$('#pageSubtitle').textContent=subtitle;if($('#content'))$('#content').innerHTML='<section class="module-page"><div style="padding:42px;text-align:center;border:1px dashed #d0dfd7;border-radius:17px;color:#718078;background:#fbfdfc">در حال دریافت اطلاعات...</div></section>'}
function showRouteError(title,error){const message=error?.message||'ماژول بارگذاری نشد.';if($('#pageTitle'))$('#pageTitle').textContent=title;if($('#pageSubtitle'))$('#pageSubtitle').textContent='خطا در بارگذاری ماژول';if($('#content'))$('#content').innerHTML=`<section class="module-page"><div style="padding:24px;border:1px solid #f1c9cf;border-radius:16px;color:#a5283b;background:#fff5f6"><strong>${esc(title)}</strong><p style="margin:8px 0 0">${esc(message)}</p></div></section>`;try{window.toast?.('بارگذاری ماژول انجام نشد',message)}catch{}}
function loadScript(file){
  if(state.scriptLoads.has(file))return state.scriptLoads.get(file);
  const existing=[...document.scripts].find(script=>String(script.src||'').includes(`/${file}`));
  if(existing){const promise=existing.dataset.loaded==='true'?Promise.resolve():new Promise((resolve,reject)=>{if(window[existing.dataset.runtimeGlobal||''])resolve();else{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`فایل ${file} دریافت نشد.`)),{once:true});setTimeout(resolve,100)}});state.scriptLoads.set(file,promise);return promise}
  const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`./${file}?v=${ASSET_VERSION}`;script.async=true;script.onload=()=>{script.dataset.loaded='true';resolve()};script.onerror=()=>reject(new Error(`فایل ${file} دریافت نشد.`));document.body.appendChild(script)});state.scriptLoads.set(file,promise);return promise;
}
async function waitForRuntime(globalName,file){let runtime=window[globalName];if(runtime?.open)return runtime;await loadScript(file);const deadline=Date.now()+3000;while(Date.now()<deadline){runtime=window[globalName];if(runtime?.open)return runtime;await new Promise(resolve=>setTimeout(resolve,50))}throw new Error(`Runtime ماژول ${globalName} فعال نشد.`)}
async function openRuntime(key,globalName,file,title){setLoading(title);const runtime=await waitForRuntime(globalName,file);await Promise.resolve(runtime.open());window.dispatchEvent(new CustomEvent('salamat-module-opened',{detail:{key,title,routerVersion:VERSION}}))}
async function openManagementDashboard(){const deadline=Date.now()+2500;while(Date.now()<deadline){const access=window.SalamatAccessControl;if(typeof access?.openModule==='function'){await Promise.resolve(access.openModule('staff.dashboard'));if($('#content .spx-dashboard'))return true}await new Promise(resolve=>setTimeout(resolve,40))}throw new Error('داشبورد مدیریتی جدید آماده نشد.')}
function legacyRender(key){const module=moduleByKey(key);if(!module)return;const accessModel=window.SalamatAccessModel||model();window.SalamatAccessModel=accessModel;const item=[module.icon,module.label,null,module.key];if(typeof window.renderModule==='function')window.renderModule(accessModel,item)}
async function route(key){
  if(!key||panel()!=='STAFF')return;if(!canView(key)){window.toast?.('دسترسی غیرمجاز','این ماژول برای حساب شما فعال نیست.');return}
  setRoleBoundary();setActive(key);
  try{
    if(key==='staff.dashboard'){await openManagementDashboard();return}
    if(key==='staff.users'){window.SalamatAccessControl?.openUsers?.();return}
    if(key==='staff.financial_credits'){await openRuntime(key,'SalamatFinancialCredits','staff-financial-credits-runtime-v2.js','اعتبارات مالی');return}
    if(key==='staff.payroll'){await openRuntime(key,'SalamatStaffPayroll','staff-payroll-runtime-v1.js','حقوق و پرداخت');return}
    if(key==='staff.training'){legacyRender('staff.training');return}
    if(key==='staff.evaluations'){legacyRender('staff.evaluations');return}
    if(key==='staff.support'){await openRuntime(key,'SalamatStaffSupport','staff-support-runtime-v1.js','پشتیبانی');return}
    if(key==='staff.settings'){await openRuntime(key,'SalamatSystemTools','staff-system-settings-runtime-v1.js','تنظیمات و لاگ');return}
    legacyRender(key);
  }catch(error){showRouteError(moduleByKey(key)?.label||'ماژول',error)}
}
function captureNavigation(event){const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');if(!button||panel()!=='STAFF')return;const key=buttonKey(button);if(!key)return;if(key==='staff.users'&&window.SalamatAccessControl?.openUsers)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void route(key)}
async function loadAccess(force=false){if(state.loading&&!force)return;state.loading=true;try{const payload=await api('/api/access/me');state.access=payload.data||null;setRoleBoundary();observeNavigation();renderCanonicalNavigation(true)}catch(error){if(error.status!==401)console.error('Staff module router v5 access failed',error)}finally{state.loading=false}}
function boot(){document.addEventListener('click',captureNavigation,true);window.addEventListener('salamat-authenticated',()=>void loadAccess(true));window.addEventListener('salamat-access-changed',()=>void loadAccess(true));window.addEventListener('salamat-shell-ready',()=>scheduleRepair(true));window.addEventListener('salamat-access-ready',event=>{if(event.detail){state.access=event.detail;setRoleBoundary();observeNavigation();scheduleRepair(true)}});window.addEventListener('pageshow',()=>void loadAccess(false));void loadAccess(false);window.SalamatStaffModuleRouter={version:VERSION,reload:()=>loadAccess(true),route,sync:()=>scheduleRepair(true),get access(){return state.access}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();