(()=>{
'use strict';
if(window.__salamatPanelRouteBootstrapV1)return;
window.__salamatPanelRouteBootstrapV1=true;

const VERSION='1.2.0';
const PANEL_PATH='/panel';
const LOGIN_PATH='/';
const STAFF_BOOT_TIMEOUT_MS=3200;
const RETRY_MS=160;
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
const LEGACY_PHRASES=['مدیریت یکپارچه باشگاه مراقبین','مرکز فرمان باشگاه','داشبورد مدیر سامانه'];
const $=selector=>document.querySelector(selector);
let observer=null;
let retryTimer=0;
let deadlineTimer=0;
let recoveryTimer=0;
let startedAt=0;
let lastSurfaceRequest=0;
let released=false;

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
function normalizedText(node){return String(node?.textContent||'').replace(/\s+/g,' ').trim()}
function legacyStaffSurfacePresent(){
  const content=$('#content');
  if(!content)return false;
  if(content.querySelector('.role-hero'))return true;
  const text=`${normalizedText($('#pageTitle'))} ${normalizedText(content)}`;
  return LEGACY_PHRASES.some(phrase=>text.includes(phrase));
}
function canonicalStaffSurfaceReady(){
  const content=$('#content');
  if(!content||legacyStaffSurfacePresent())return false;
  if(content.querySelector('.spx-dashboard,.spx-root,.sev4-root,[data-salamat-staff-surface="ready"],[data-module-key^="staff."],[data-view^="staff-"]'))return true;
  const active=$('#sidebarNav [data-staff-module-key].active,#sidebarNav [data-staff-module-key][aria-current="page"]');
  if(active&&content.children.length>0&&!content.querySelector('[data-salamat-staff-surface="loading"]'))return true;
  return false;
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
function sanitizeLegacyStaffSurface(){
  if(!legacyStaffSurfacePresent())return false;
  const content=$('#content');
  if(content)content.innerHTML='<div class="staff-shell-loading" data-salamat-staff-surface="loading">در حال آماده‌سازی پنل مدیریتی…</div>';
  const title=$('#pageTitle');if(title)title.textContent='پنل مدیریتی';
  const subtitle=$('#pageSubtitle');if(subtitle)subtitle.textContent='در حال دریافت دسترسی‌ها و ماژول‌های مجاز شما';
  document.documentElement.setAttribute('data-salamat-staff-surface','sanitized');
  return true;
}
function staffModuleButtons(){return [...document.querySelectorAll('#sidebarNav [data-staff-module-key]')]}
function preferredStaffModuleKey(){
  const buttons=staffModuleButtons();
  if(!buttons.length)return '';
  const access=window.SalamatAccessControl;
  const allowed=key=>{try{return typeof access?.can==='function'?access.can(key,'view')!==false:true}catch{return true}};
  const dashboard=buttons.find(button=>button.dataset.staffModuleKey==='staff.dashboard'&&allowed('staff.dashboard'));
  if(dashboard)return 'staff.dashboard';
  return buttons.find(button=>button.dataset.staffModuleKey&&allowed(button.dataset.staffModuleKey))?.dataset.staffModuleKey||'';
}
function requestPreferredStaffSurface(reason='panel-bootstrap'){
  const now=Date.now();
  if(now-lastSurfaceRequest<120)return false;
  lastSurfaceRequest=now;
  sanitizeLegacyStaffSurface();
  const access=window.SalamatAccessControl;
  try{
    const key=preferredStaffModuleKey();
    if(key&&typeof access?.openModule==='function'){
      access.openModule(key);
      window.dispatchEvent(new CustomEvent('salamat-panel-canonical-surface-requested',{detail:{reason,key,version:VERSION}}));
      return true;
    }
    if(typeof access?.reload==='function'){
      Promise.resolve(access.reload()).then(()=>{
        if(released)return;
        const retryKey=preferredStaffModuleKey();
        if(retryKey&&typeof window.SalamatAccessControl?.openModule==='function')window.SalamatAccessControl.openModule(retryKey);
        finish();
      }).catch(()=>{});
      return true;
    }
    if(typeof window.SalamatStaffDashboardEntry?.settle==='function'){
      window.SalamatStaffDashboardEntry.settle(reason,{reload:false});
      return true;
    }
  }catch{}
  return false;
}
function surfaceReady(){
  if(!appReady())return false;
  const role=currentRole();
  if(role==='CAREGIVER')return true;
  if(isStaffSession()){
    if(canonicalStaffSurfaceReady())return true;
    sanitizeLegacyStaffSurface();
    requestPreferredStaffSurface('panel-first-paint');
    return canonicalStaffSurfaceReady();
  }
  return !legacyStaffSurfacePresent()&&Boolean(role);
}
function releasePanel(reason='ready'){
  if(released)return true;
  released=true;
  clearTimeout(retryTimer);
  clearTimeout(deadlineTimer);
  clearTimeout(recoveryTimer);
  stabilizeCompatibilitySurface();
  $('#salamatPanelRouteLoading')?.remove();
  document.documentElement.classList.add('salamat-panel-document-ready');
  document.body?.classList.add('salamat-panel-document-ready');
  document.documentElement.setAttribute('data-salamat-panel-release',reason);
  observer?.disconnect();
  window.dispatchEvent(new CustomEvent('salamat-panel-route-ready',{detail:{reason,version:VERSION}}));
  return true;
}
function finish(){
  if(released)return true;
  if(!surfaceReady())return false;
  return releasePanel('canonical-surface');
}
function retryUntilDeadline(){
  clearTimeout(retryTimer);
  if(finish())return;
  if(isStaffSession())requestPreferredStaffSurface('panel-bootstrap-retry');
  if(performance.now()-startedAt<STAFF_BOOT_TIMEOUT_MS)retryTimer=setTimeout(retryUntilDeadline,RETRY_MS);
}
function forceReleaseAfterDeadline(){
  if(finish())return;
  const loader=$('#salamatPanelRouteLoading');
  const strong=loader?.querySelector('strong');
  if(!appReady()){
    if(strong)strong.textContent='پنل در حال تکمیل راه‌اندازی است…';
    recoveryTimer=setTimeout(()=>{
      if(finish())return;
      if(appReady())forceReleaseAfterDeadline();
      else if(strong)strong.textContent='راه‌اندازی پنل کامل نشد. لطفاً صفحه را یک‌بار تازه‌سازی کنید.';
    },1800);
    return;
  }
  if(isStaffSession()||staffNavigationReady()){
    sanitizeLegacyStaffSurface();
    requestPreferredStaffSurface('panel-bootstrap-deadline');
    if(canonicalStaffSurfaceReady())return releasePanel('canonical-surface-deadline');
    /* The canonical staff router owns the navigation at this point. Never keep
       the full-screen route loader forever; expose only the sanitized panel
       frame/placeholder while the selected module finishes asynchronously. */
    if(staffNavigationReady()&&!legacyStaffSurfacePresent())return releasePanel('staff-shell-bounded-fallback');
  }
  if(!legacyStaffSurfacePresent())return releasePanel('bounded-fallback');
  sanitizeLegacyStaffSurface();
  return releasePanel('sanitized-bounded-fallback');
}
function watch(){
  stabilizeCompatibilitySurface();
  startedAt=performance.now();
  const app=$('#appView');
  if(!app){location.replace(LOGIN_PATH);return}
  if(finish())return;
  observer=new MutationObserver(()=>{
    if(finish())return;
    if(isStaffSession()&&legacyStaffSurfacePresent()){
      sanitizeLegacyStaffSurface();
      requestPreferredStaffSurface('legacy-surface-mutation');
    }
  });
  observer.observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden','style'],childList:true,subtree:true});
  for(const eventName of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-mobile-shell-recovery-ready','salamat-staff-dashboard-entry-fixed']){
    window.addEventListener(eventName,()=>{
      if(finish())return;
      if(isStaffSession())requestPreferredStaffSurface(eventName);
    });
  }
  retryUntilDeadline();
  deadlineTimer=setTimeout(forceReleaseAfterDeadline,STAFF_BOOT_TIMEOUT_MS);
}

if(!onPanelRoute())return;
document.documentElement.classList.add('salamat-panel-document');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
window.SalamatPanelRoute={version:VERSION,finish,forceReleaseAfterDeadline,get ready(){return surfaceReady()},get canonicalStaffReady(){return canonicalStaffSurfaceReady()}};
})();
