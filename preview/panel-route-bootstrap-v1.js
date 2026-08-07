(()=>{
'use strict';
if(window.__salamatPanelRouteBootstrapV1)return;
window.__salamatPanelRouteBootstrapV1=true;

const VERSION='1.1.0';
const PANEL_PATH='/panel';
const LOGIN_PATH='/';
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
const $=selector=>document.querySelector(selector);
let observer=null;
let timeout=0;
let dashboardRetry=0;
let lastDashboardRequest=0;

function onPanelRoute(){return location.pathname===PANEL_PATH||location.pathname===`${PANEL_PATH}/`}
function currentUser(){
  try{return window.SalamatBackend?.getCurrentUser?.()||window.__salamatAuthenticatedStaffUser||null}catch{return window.__salamatAuthenticatedStaffUser||null}
}
function currentRole(){
  const user=currentUser();
  return String(user?.actualRole||user?.role||document.documentElement.dataset.currentUserRole||'').trim().toUpperCase();
}
function appReady(){
  const app=$('#appView');
  return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden&&app.getAttribute('aria-hidden')!=='true');
}
function staffNavigationReady(){return Boolean($('#sidebarNav [data-staff-module-key],#sidebarNav [data-panel-module-key="staff.dashboard"]'))}
function isStaffSession(){const role=currentRole();return STAFF_ROLES.has(role)||(!role&&staffNavigationReady())}
function canonicalStaffDashboardReady(){
  const content=$('#content');
  return Boolean(content&&(content.querySelector('.spx-dashboard')||content.querySelector('[data-module-key="staff.dashboard"]')||content.querySelector('[data-view="staff-dashboard"]')));
}
function stabilizeCompatibilitySurface(){
  const login=$('#loginView');
  if(login){
    login.classList.add('hidden');
    login.hidden=true;
    login.setAttribute('aria-hidden','true');
    login.setAttribute('inert','');
    login.style.setProperty('display','none','important');
    login.style.setProperty('visibility','hidden','important');
    login.style.setProperty('pointer-events','none','important');
  }
  $('#caregiverSignupLayer')?.remove();
  const video=$('#loginIntroVideo');
  try{video?.pause()}catch{}
}
function requestCanonicalDashboard(reason='panel-bootstrap'){
  const now=Date.now();
  if(now-lastDashboardRequest<120)return;
  lastDashboardRequest=now;
  try{
    if(typeof window.SalamatAccessControl?.openModule==='function'&&window.SalamatAccessControl.can?.('staff.dashboard','view')!==false){
      window.SalamatAccessControl.openModule('staff.dashboard');
      return;
    }
    if(typeof window.SalamatStaffDashboardEntry?.settle==='function'){
      window.SalamatStaffDashboardEntry.settle(reason,{reload:false});
      return;
    }
    if(typeof window.SalamatStaffDashboardEntry?.repair==='function')window.SalamatStaffDashboardEntry.repair(reason);
  }catch{}
}
function surfaceReady(){
  if(!appReady())return false;
  const role=currentRole();
  if(role==='CAREGIVER')return true;
  if(isStaffSession()){
    if(canonicalStaffDashboardReady())return true;
    requestCanonicalDashboard('panel-first-paint');
    return false;
  }
  /* Do not expose a legacy surface before the authenticated role is known. */
  return false;
}
function finish(){
  if(!surfaceReady())return false;
  clearTimeout(timeout);
  clearTimeout(dashboardRetry);
  stabilizeCompatibilitySurface();
  $('#salamatPanelRouteLoading')?.remove();
  document.documentElement.classList.add('salamat-panel-document-ready');
  document.body?.classList.add('salamat-panel-document-ready');
  observer?.disconnect();
  return true;
}
function retryCanonicalDashboard(){
  clearTimeout(dashboardRetry);
  if(finish())return;
  if(isStaffSession())requestCanonicalDashboard('panel-bootstrap-retry');
  dashboardRetry=setTimeout(retryCanonicalDashboard,180);
}
function showRecoveryMessage(){
  if(finish())return;
  const loader=$('#salamatPanelRouteLoading');
  const strong=loader?.querySelector('strong');
  if(strong)strong.textContent=isStaffSession()?'در حال آماده‌سازی داشبورد مدیریتی واقعی…':'راه‌اندازی پنل کامل نشد؛ در حال تلاش دوباره…';
  if(isStaffSession())requestCanonicalDashboard('panel-bootstrap-recovery');
  setTimeout(()=>{
    if(finish())return;
    if(strong)strong.textContent='پنل هنوز آماده نشده است. صفحه را یک‌بار تازه‌سازی کنید.';
  },4000);
}
function watch(){
  stabilizeCompatibilitySurface();
  const app=$('#appView');
  if(!app){location.replace(LOGIN_PATH);return}
  if(finish())return;
  observer=new MutationObserver(()=>finish());
  observer.observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden','style'],childList:true,subtree:true});
  for(const eventName of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-mobile-shell-recovery-ready','salamat-staff-dashboard-entry-fixed']){
    window.addEventListener(eventName,()=>{if(!finish()&&isStaffSession())requestCanonicalDashboard(eventName)});
  }
  retryCanonicalDashboard();
  timeout=setTimeout(showRecoveryMessage,8000);
}

if(!onPanelRoute())return;
document.documentElement.classList.add('salamat-panel-document');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
window.SalamatPanelRoute={version:VERSION,finish,get ready(){return surfaceReady()},get canonicalStaffReady(){return canonicalStaffDashboardReady()}};
})();
