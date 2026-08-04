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
function currentKey(){
  if(state.activeKey&&modules().some(module=>module.key===state.activeKey))return state.activeKey;
  const active=navButtons().find(button=>button.classList.contains('active'));
  return buttonKey(active)||labelKey($('#pageTitle')?.textContent)||modules()[0]?.key||'';
}
function canonicalButton(module,key){
  return `<button class="nav-item ${module.key===key?'active':''}" type="button" data-panel-module-key="${esc(module.key)}" data-access-module="${esc(module.key)}" aria-label="${esc(module.label)}"><span data-icon="${esc(module.icon||'circle')}"></span><span>${esc(module.label)}</span></button>`;
}
function renderCanonicalNavigation(){
  if(panel()!=='STAFF')return false;
  const nav=$('#sidebarNav');if(!nav)return false;
  const list=modules();const requested=currentKey();const key=list.some(module=>module.key===requested)?requested:(list[0]?.key||'');
  state.repairing=true;
  try{
    nav.innerHTML=list.map(module=>canonicalButton(module,key)).join('');
    window.hydrateIcons?.(nav);
    state.activeKey=key;
  }finally{queueMicrotask(()=>{state.repairing=false})}
  return true;
}
function canonicalSignature(){return modules().map(module=>`${module.key}:${module.label}`).join('|')}
function actualSignature(){return navButtons().map(button=>`${buttonKey(button)}:${normalize(button.textContent)}`).join('|')}
function scheduleRepair(){
  if(state.repairing||panel()!=='STAFF')return;
  clearTimeout(state.repairTimer);
  state.repairTimer=setTimeout(()=>{
    if(panel()==='STAFF'&&actualSignature()!==canonicalSignature())renderCanonicalNavigation();
  },30);
}
function observeNavigation(){
  const nav=$('#sidebarNav');if(!nav)return;
  state.observer?.disconnect();
  state.observer=new MutationObserver(scheduleRepair);
  state.observer.observe(nav,{childList:true,subtree:false});
}
function setActive(key){
  state.activeKey=key;
  navButtons().forEach(button=>button.classList.toggle('active',buttonKey(button)===key));
  $('#sidebar')?.classList.remove('open');
}
function legacyRender(key){
  const module=moduleByKey(key);if(!module)return;
  const accessModel=window.SalamatAccessModel||window.roles?.admin||{};
  window.SalamatAccessModel=accessModel;
  const item=[module.icon,module.label,null,module.key];
  if(key==='staff.dashboard'&&typeof window.renderDashboard==='function'){window.renderDashboard(accessModel);return}
  if(typeof window.renderModule==='function')window.renderModule(accessModel,item);
}
function scriptUrl(file){return `./${file}?v=${ASSET_VERSION}`}
async function openRuntime(globalName,file){
  if(window[globalName])return window[globalName];
  if(!state.scriptLoads.has(file)){
    state.scriptLoads.set(file,new Promise((resolve,reject)=>{
      const existing=$(`script[src*="${file}"]`);
      if(existing){existing.addEventListener('load',()=>resolve(window[globalName]),{once:true});existing.addEventListener('error',reject,{once:true});setTimeout(()=>resolve(window[globalName]),100);return}
      const script=document.createElement('script');script.src=scriptUrl(file);script.async=true;script.onload=()=>resolve(window[globalName]);script.onerror=()=>reject(new Error(`بارگذاری ${file} ناموفق بود.`));document.head.appendChild(script);
    }));
  }
  const runtime=await state.scriptLoads.get(file);
  if(!runtime)throw new Error(`Runtime ${globalName} آماده نشد.`);
  return runtime;
}
async function route(key){
  if(!key||panel()!=='STAFF')return;
  if(!canView(key)){window.toast?.('دسترسی غیرمجاز','این ماژول برای حساب شما فعال نیست.');return}
  setRoleBoundary();setActive(key);
  try{
    if(key==='staff.users'){const runtime=await openRuntime('SalamatAccessControl','access-control-runtime-v2.js');runtime.openUsers?.();return}
    if(key==='staff.financial_credits'){const runtime=await openRuntime('SalamatFinancialCredits','staff-financial-credits-runtime-v2.js');runtime.open?.();return}
    if(key==='staff.payroll'){const runtime=await openRuntime('SalamatStaffPayroll','staff-payroll-runtime-v1.js');runtime.open?.();return}
    if(key==='staff.support'){const runtime=await openRuntime('SalamatStaffSupport','staff-support-runtime-v1.js');runtime.open?.();return}
    if(key==='staff.settings'){const runtime=await openRuntime('SalamatSystemTools','staff-system-settings-runtime-v1.js');runtime.open?.();return}
    legacyRender(key);
  }catch(error){console.error('Staff module route failed',key,error);window.toast?.('خطای بارگذاری',error?.message||'ماژول آماده نشد.');}
}
function captureNavigation(event){
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');if(!button||panel()!=='STAFF')return;
  const key=buttonKey(button);if(!key)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void route(key);
}
async function loadAccess(force=false){
  if(state.loading&&!force)return;
  state.loading=true;
  try{
    const payload=await api('/api/access/me');state.access=payload.data||null;setRoleBoundary();
    if(panel()==='STAFF'){renderCanonicalNavigation();observeNavigation()}
  }catch(error){if(error.status!==401)console.error('Staff module router v5 access failed',error)}finally{state.loading=false}
}
function boot(){
  document.addEventListener('click',captureNavigation,true);
  window.addEventListener('salamat-authenticated',()=>void loadAccess(true));
  window.addEventListener('salamat-access-changed',()=>void loadAccess(true));
  window.addEventListener('salamat-shell-ready',()=>{if(state.access)renderCanonicalNavigation()});
  window.addEventListener('pageshow',()=>void loadAccess(false));
  void loadAccess(false);
  window.SalamatStaffModuleRouter={version:VERSION,assetVersion:ASSET_VERSION,reload:()=>loadAccess(true),route,sync:renderCanonicalNavigation,get access(){return state.access}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
