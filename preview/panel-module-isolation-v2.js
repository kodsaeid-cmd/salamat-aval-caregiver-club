(()=>{
'use strict';
if(window.__salamatPanelModuleIsolationV2)return;
window.__salamatPanelModuleIsolationV2=true;

const VERSION='2.0.1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const normalize=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();
const roleRoute={ADMIN:'admin',CAREGIVER:'caregiver',RECRUITER:'recruiter',HR:'hr',SUPPORT:'admin',EVALUATOR:'admin',EDUCATION:'admin',OPERATIONS:'admin'};
const exactLabels={
  'داشبورد مدیریتی':'staff.dashboard',
  'مدیریت کاربران':'staff.users',
  'کاربران و دسترسی‌ها':'staff.users',
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
  'پشتیبانی و امنیت':'staff.support',
  'پشتیبانی':'staff.support',
  'گزارش‌ها':'staff.reports',
  'تنظیمات و لاگ':'staff.settings',
  'تنظیمات سامانه':'staff.settings',
  'داشبورد':'caregiver.dashboard',
  'کارنامه کاری':'caregiver.scorecard',
  'کیف پول و اعتبارات':'caregiver.wallet',
  'کیف پول':'caregiver.wallet',
  'حقوق و فیش حقوقی':'caregiver.payroll',
  'آموزش‌های من':'caregiver.training',
  'پشتیبانی پرونده':'caregiver.support',
  'تقویم کاری':'caregiver.calendar',
};
const state={access:null,loading:false,navObserver:null,syncTimer:0,lastSignature:''};

async function api(path){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}
  return payload;
}
function currentPanel(){return String(state.access?.panel||'').toUpperCase()}
function visibleModules(){return (state.access?.modules||[]).filter(module=>module.panel===currentPanel()&&module.actions?.view)}
function moduleByKey(key){return (state.access?.allModules||[]).find(module=>module.key===key)||visibleModules().find(module=>module.key===key)}
function canView(key){return Boolean(moduleByKey(key)?.actions?.view)}
function selectedRoleForAccess(){return roleRoute[String(state.access?.user?.role||'').toUpperCase()]||'admin'}
function setRoleBoundary(){
  const role=selectedRoleForAccess();
  try{window.selectedRole=role}catch{}
  window.__salamatResolvedPanel=currentPanel();
  window.__salamatResolvedRole=String(state.access?.user?.role||'').toUpperCase();
}
function labelKey(label){
  const clean=normalize(label);
  const visible=visibleModules().find(module=>normalize(module.label)===clean);
  return visible?.key||exactLabels[clean]||'';
}
function navButtons(){return $$('#sidebarNav .nav-item,#sidebarNav>button')}
function annotateNavigation(){
  const modules=visibleModules(),buttons=navButtons();
  buttons.forEach((button,index)=>{
    const indexed=modules[index]?.key||'';
    const key=indexed||labelKey(button.textContent);
    if(key){button.dataset.panelModuleKey=key;button.dataset.accessModule=key}
  });
  const seen=new Set();
  for(const button of buttons){
    const key=button.dataset.panelModuleKey||'';
    if(!key||!seen.has(key)){if(key)seen.add(key);continue}
    button.remove();
  }
}
function expectedSignature(){return visibleModules().map(module=>module.key).join('|')}
function actualSignature(){return navButtons().map(button=>button.dataset.panelModuleKey||labelKey(button.textContent)).filter(Boolean).join('|')}
function modelForStaff(){
  const base=window.roles?.admin||{};
  const user=state.access?.user||{};
  return {...base,name:user.fullName||base.name,role:user.roleLabel||base.role,title:`پنل ${user.roleLabel||'سازمانی'}`,subtitle:'دسترسی‌های فعال و تفکیک‌شده سامانه',nav:visibleModules().map(module=>[module.icon,module.label,null,module.key])};
}
function rebuildStaffNavigation(){
  if(currentPanel()!=='STAFF'||typeof window.renderNav!=='function'||!window.roles?.admin)return false;
  const model=modelForStaff();
  window.SalamatAccessModel=model;
  window.renderNav(model);
  annotateNavigation();
  return true;
}
function syncNavigation(force=false){
  clearTimeout(state.syncTimer);
  state.syncTimer=setTimeout(()=>{
    setRoleBoundary();
    annotateNavigation();
    const expected=expectedSignature(),actual=actualSignature();
    if(currentPanel()==='STAFF'&&(force||expected!==actual))rebuildStaffNavigation();
    if(currentPanel()==='CAREGIVER'&&force)window.SalamatCaregiverPlatform?.reload?.();
    setTimeout(annotateNavigation,80);
    state.lastSignature=expected;
  },20);
}
function setActive(button){
  navButtons().forEach(item=>item.classList.toggle('active',item===button));
  $('#sidebar')?.classList.remove('open');
}
function nextWrappedRenderer(renderer){
  return renderer?.__base||renderer?.__trainingAdminClassicBase||renderer?.__serverTrainingBase||null;
}
function trainingRenderer(){
  let renderer=window.renderModule;
  const seen=new Set();
  while(typeof renderer==='function'&&!seen.has(renderer)){
    if(renderer.__trainingAdminClassicV2)return renderer;
    seen.add(renderer);
    renderer=nextWrappedRenderer(renderer);
  }
  return null;
}
function openTraining(button){
  setActive(button);
  setRoleBoundary();
  const model=window.SalamatAccessModel||modelForStaff();
  const item=['book','بانک آموزش',null,'staff.training'];
  const renderer=trainingRenderer()||window.renderModule;
  if(typeof renderer==='function')renderer(model,item);
}
function openFinance(button){
  setActive(button);
  window.SalamatFinancialCredits?.open?.();
}
function openStaffSupport(button){
  setActive(button);
  window.SalamatStaffSupport?.open?.();
}
function captureNavigation(event){
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');
  if(!button)return;
  const key=button.dataset.panelModuleKey||button.dataset.accessModule||labelKey(button.textContent);
  if(!key)return;
  button.dataset.panelModuleKey=key;
  if(currentPanel()==='STAFF')setRoleBoundary();
  if(!canView(key)){
    event.preventDefault();event.stopImmediatePropagation();
    window.toast?.('دسترسی غیرمجاز','این ماژول برای حساب شما فعال نیست.');
    return;
  }
  if(key==='staff.financial_credits'){
    event.preventDefault();event.stopImmediatePropagation();openFinance(button);return;
  }
  if(key==='staff.training'){
    event.preventDefault();event.stopImmediatePropagation();openTraining(button);return;
  }
  if(key==='staff.support'){
    event.preventDefault();event.stopImmediatePropagation();openStaffSupport(button);return;
  }
}
async function loadAccess(force=false){
  if(state.loading&&!force)return;
  state.loading=true;
  try{
    const payload=await api('/api/access/me');
    state.access=payload.data||null;
    setRoleBoundary();
    syncNavigation(true);
  }catch(error){
    if(error.status!==401)console.error('Panel module isolation access failed',error);
  }finally{state.loading=false}
}
function observeNavigation(){
  const nav=$('#sidebarNav');
  if(!nav||state.navObserver)return;
  state.navObserver=new MutationObserver(()=>syncNavigation(false));
  state.navObserver.observe(nav,{childList:true,subtree:false});
}
function boot(){
  document.addEventListener('click',captureNavigation,true);
  window.addEventListener('salamat-authenticated',()=>void loadAccess(true));
  window.addEventListener('salamat-access-changed',()=>void loadAccess(true));
  window.addEventListener('salamat-shell-ready',()=>syncNavigation(true));
  window.addEventListener('pageshow',()=>void loadAccess(false));
  observeNavigation();
  setInterval(()=>{observeNavigation();if(state.access)syncNavigation(false)},1200);
  void loadAccess(false);
  window.SalamatPanelModuleIsolation={version:VERSION,reload:()=>loadAccess(true),sync:()=>syncNavigation(true),get access(){return state.access}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
