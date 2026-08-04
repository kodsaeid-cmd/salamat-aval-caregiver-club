(()=>{
'use strict';
if(window.__salamatStaffModuleRouterV3)return;
window.__salamatStaffModuleRouterV3=true;
// The legacy positional router must not register its click handler after this file.
window.__salamatPanelModuleIsolationV2=true;

const VERSION='3.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const normalize=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();
const roleRoute={ADMIN:'admin',CAREGIVER:'caregiver',RECRUITER:'recruiter',HR:'hr',SUPPORT:'admin',EVALUATOR:'admin',EDUCATION:'admin',OPERATIONS:'admin'};
const exactLabels={
  'داشبورد مدیریتی':'staff.dashboard',
  'کاربران و دسترسی‌ها':'staff.users',
  'مدیریت کاربران':'staff.users',
  'پرونده مراقبین':'staff.caregivers',
  'مراقبین':'staff.caregivers',
  'قراردادها':'staff.contracts',
  'حقوق و پرداخت':'staff.payroll',
  'حقوق و دستمزد':'staff.payroll',
  'اعتبارات مالی':'staff.financial_credits',
  'بانک آموزش':'staff.training',
  'آموزش':'staff.training',
  'ارزیابی و پروانه':'staff.evaluations',
  'پایش و امتیازات':'staff.evaluations',
  'پشتیبانی':'staff.support',
  'پشتیبانی و امنیت':'staff.support',
  'تنظیمات و لاگ':'staff.settings',
  'تنظیمات سامانه':'staff.settings',
};
const hiddenKeys=new Set(['staff.reports']);
const state={access:null,loading:false,activeKey:'',observer:null,renderTimer:0,legacyRenderNav:null};

async function api(path){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}
  return payload;
}
function panel(){return String(state.access?.panel||'').toUpperCase()}
function modules(){return (state.access?.modules||[]).filter(module=>module.panel==='STAFF'&&module.actions?.view&&!hiddenKeys.has(module.key))}
function moduleByKey(key){return (state.access?.allModules||[]).find(module=>module.key===key)||modules().find(module=>module.key===key)}
function canView(key){return Boolean(moduleByKey(key)?.actions?.view)}
function labelKey(label){
  const clean=normalize(label);
  const direct=modules().find(module=>normalize(module.label)===clean);
  return direct?.key||exactLabels[clean]||'';
}
function setRoleBoundary(){
  const role=String(state.access?.user?.role||'').toUpperCase();
  const route=roleRoute[role]||'admin';
  try{window.selectedRole=route}catch{}
  window.__salamatResolvedPanel=panel();
  window.__salamatResolvedRole=role;
}
function navButtons(){return $$('#sidebarNav .nav-item,#sidebarNav>button')}
function iconMarkup(name){
  try{return typeof window.icon==='function'?window.icon(name):`<span data-icon="${name}"></span>`}catch{return `<span data-icon="${name}"></span>`}
}
function currentKey(){
  if(state.activeKey&&modules().some(module=>module.key===state.activeKey))return state.activeKey;
  const active=navButtons().find(button=>button.classList.contains('active'));
  const fromActive=active?.dataset.panelModuleKey||active?.dataset.accessModule||labelKey(active?.textContent);
  if(fromActive)return fromActive;
  const fromTitle=labelKey($('#pageTitle')?.textContent);
  return fromTitle||modules()[0]?.key||'';
}
function canonicalSignature(){return modules().map(module=>module.key).join('|')}
function actualSignature(){return navButtons().map(button=>button.dataset.panelModuleKey||'').filter(Boolean).join('|')}
function renderCanonicalNavigation(){
  if(panel()!=='STAFF')return false;
  const nav=$('#sidebarNav');if(!nav)return false;
  const list=modules();
  const active=currentKey();
  nav.innerHTML=list.map(module=>`<button class="nav-item ${module.key===active?'active':''}" type="button" data-panel-module-key="${module.key}" data-access-module="${module.key}" aria-label="${String(module.label).replace(/"/g,'&quot;')}">${iconMarkup(module.icon)}<span>${module.label}</span></button>`).join('');
  try{window.hydrateIcons?.(nav)}catch{}
  state.activeKey=list.some(module=>module.key===active)?active:(list[0]?.key||'');
  return true;
}
function scheduleCanonical(force=false){
  clearTimeout(state.renderTimer);
  state.renderTimer=setTimeout(()=>{
    if(panel()!=='STAFF')return;
    if(force||actualSignature()!==canonicalSignature())renderCanonicalNavigation();
  },20);
}
function model(){
  const base=window.roles?.admin||{};
  const user=state.access?.user||{};
  return {...base,name:user.fullName||base.name,role:user.roleLabel||base.role,title:`پنل ${user.roleLabel||'سازمانی'}`,subtitle:'دسترسی‌های عملیاتی و تفکیک‌شده سامانه',nav:modules().map(module=>[module.icon,module.label,null,module.key])};
}
function setActive(key){
  state.activeKey=key;
  navButtons().forEach(button=>button.classList.toggle('active',button.dataset.panelModuleKey===key));
  $('#sidebar')?.classList.remove('open');
}
function legacyRender(key){
  const module=moduleByKey(key);if(!module)return;
  const accessModel=window.SalamatAccessModel||model();
  window.SalamatAccessModel=accessModel;
  const item=[module.icon,module.label,null,module.key];
  if(key==='staff.dashboard'&&typeof window.renderDashboard==='function'){window.renderDashboard(accessModel);return}
  if(typeof window.renderModule==='function')window.renderModule(accessModel,item);
}
function route(key){
  if(!key||panel()!=='STAFF')return;
  if(!canView(key)){
    window.toast?.('دسترسی غیرمجاز','این ماژول برای حساب شما فعال نیست.');
    return;
  }
  setRoleBoundary();setActive(key);
  if(key==='staff.users'){window.SalamatAccessControl?.openUsers?.();return}
  if(key==='staff.financial_credits'){window.SalamatFinancialCredits?.open?.();return}
  if(key==='staff.payroll'){window.SalamatStaffPayroll?.open?.();return}
  if(key==='staff.support'){window.SalamatStaffSupport?.open?.();return}
  if(key==='staff.settings'){window.SalamatSystemTools?.open?.();return}
  // Training and evaluation retain their mature existing renderers, but receive an exact key and exact label.
  legacyRender(key);
}
function captureNavigation(event){
  const button=event.target?.closest?.('#sidebarNav [data-panel-module-key]');
  if(!button||panel()!=='STAFF')return;
  const key=button.dataset.panelModuleKey||'';
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  route(key);
}
function installRenderGuard(){
  const current=window.renderNav;
  if(typeof current!=='function'||current.__staffModuleRouterV3)return;
  state.legacyRenderNav=current;
  const guarded=function(...args){
    if(panel()==='STAFF'){renderCanonicalNavigation();return}
    return current.apply(this,args);
  };
  Object.assign(guarded,current);guarded.__staffModuleRouterV3=true;guarded.__base=current;
  window.renderNav=guarded;
  try{renderNav=guarded}catch{}
}
function observeNavigation(){
  const nav=$('#sidebarNav');
  if(!nav)return;
  if(state.observer)state.observer.disconnect();
  state.observer=new MutationObserver(()=>scheduleCanonical(false));
  state.observer.observe(nav,{childList:true,subtree:false});
}
async function loadAccess(force=false){
  if(state.loading&&!force)return;
  state.loading=true;
  try{
    const payload=await api('/api/access/me');
    state.access=payload.data||null;
    setRoleBoundary();installRenderGuard();observeNavigation();scheduleCanonical(true);
  }catch(error){if(error.status!==401)console.error('Staff module router v3 access failed',error)}finally{state.loading=false}
}
function boot(){
  document.addEventListener('click',captureNavigation,true);
  window.addEventListener('salamat-authenticated',()=>void loadAccess(true));
  window.addEventListener('salamat-access-changed',()=>void loadAccess(true));
  window.addEventListener('salamat-shell-ready',()=>scheduleCanonical(true));
  window.addEventListener('pageshow',()=>void loadAccess(false));
  setInterval(()=>{installRenderGuard();observeNavigation();if(state.access)scheduleCanonical(false)},1000);
  void loadAccess(false);
  window.SalamatStaffModuleRouter={version:VERSION,reload:()=>loadAccess(true),route,sync:()=>scheduleCanonical(true),get access(){return state.access}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
