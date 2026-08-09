(()=>{
'use strict';
if(window.__salamatMobilePanelInteractionStabilityV1)return;
window.__salamatMobilePanelInteractionStabilityV1=true;

const VERSION='1.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
let frame=0;
let boundaryObserver=null;

function role(){
  const backend=window.SalamatBackend?.getCurrentUser?.()||{};
  return String(backend.actualRole||backend.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.__salamatResolvedRole||window.selectedRole||'').toUpperCase();
}
function panel(){
  return String(window.SalamatStaffModuleRouter?.access?.panel||window.SalamatAccessControl?.panelType||window.__salamatResolvedPanel||'').toUpperCase();
}
function appVisible(){const app=$('#appView');return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden&&app.getAttribute('aria-hidden')!=='true')}
function caregiver(){return appVisible()&&(role()==='CAREGIVER'||panel()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب'))}
function staff(){return appVisible()&&(panel()==='STAFF'||['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS'].includes(role()))}

function addStyles(){
  if($('#salamatMobilePanelInteractionStabilityV1Styles'))return;
  const style=document.createElement('style');style.id='salamatMobilePanelInteractionStabilityV1Styles';style.textContent=`
@media(max-width:760px){
 html.salamat-mobile-caregiver-owner #salamatMobileRoleHeaderV71,
 html.salamat-mobile-caregiver-owner #salamatMobileRoleLauncherV71,
 html.salamat-mobile-caregiver-owner #salamatMobileRoleBottomNavV71,
 html.salamat-mobile-caregiver-owner #salamatMobileRoleProfileV71{display:none!important;visibility:hidden!important;pointer-events:none!important}
 html.salamat-mobile-caregiver-owner #salamatCaregiverHeaderV5{display:flex!important;visibility:visible!important;pointer-events:auto!important}
 html.salamat-mobile-caregiver-owner #salamatCaregiverBottomNavV5{display:grid!important;visibility:visible!important;pointer-events:auto!important}
 html.salamat-mobile-caregiver-owner #salamatCaregiverDashboardV5{visibility:visible!important;pointer-events:auto!important}
 html.salamat-mobile-caregiver-owner #content{display:block!important;visibility:visible!important;pointer-events:auto!important}
 html.salamat-mobile-caregiver-owner .main-area{display:block!important;padding-top:calc(72px + env(safe-area-inset-top))!important;padding-bottom:calc(94px + env(safe-area-inset-bottom))!important}
 html.salamat-mobile-caregiver-owner #sidebar,html.salamat-mobile-caregiver-owner #mobileSidebarBackdrop,html.salamat-mobile-caregiver-owner .topbar{display:none!important;visibility:hidden!important;pointer-events:none!important}
 #salamatMobileRoleLauncherV71 .m71-module,#salamatMobileRoleBottomNavV71 button,#salamatMobileRoleHeaderV71 button{pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
 #salamatMobileRoleLauncherV71 .m71-module>*,#salamatMobileRoleBottomNavV71 button>*{pointer-events:none!important}
}`;(document.head||document.documentElement).appendChild(style);
}

function enforceCaregiver(){
  if(!MEDIA.matches||!caregiver()){
    document.documentElement.classList.remove('salamat-mobile-caregiver-owner');
    document.body?.classList.remove('salamat-mobile-caregiver-owner');
    return false;
  }
  const html=document.documentElement,body=document.body;
  html.classList.add('salamat-mobile-caregiver-owner','salamat-caregiver-mobile-v5');
  body?.classList.add('salamat-mobile-caregiver-owner','salamat-caregiver-mobile-v5');
  html.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app');
  body?.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app','salamat-mobile-nav-open');
  $('#content')?.removeAttribute('aria-hidden');
  try{window.SalamatCaregiverCanonicalRouteOwner?.sync?.()}catch{}
  try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
  try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
  html.dataset.salamatMobileRoleOwner='caregiver';
  return true;
}
function sync(){frame=0;addStyles();enforceCaregiver()}
function schedule(){if(frame)return;frame=requestAnimationFrame(sync)}

function moduleKey(button){return String(button?.dataset?.moduleKey||button?.dataset?.navKey||'')}
function captureAdminTap(event){
  if(!MEDIA.matches||!staff()||caregiver())return;
  const target=event.target;if(!(target instanceof Element))return;
  const module=target.closest('#salamatMobileRoleLauncherV71 .m71-module');
  if(module){
    const key=moduleKey(module);if(!key)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const shell=window.SalamatMobileRoleIconShell;
    if(typeof shell?.route==='function')void Promise.resolve(shell.route(key)).then(ok=>{if(ok===false)window.SalamatStaffModuleRouter?.route?.(key)}).catch(()=>window.SalamatStaffModuleRouter?.route?.(key));
    else void window.SalamatStaffModuleRouter?.route?.(key);
    return;
  }
  const nav=target.closest('#salamatMobileRoleBottomNavV71 button');
  if(!nav||nav.dataset.navKind==='profile')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(nav.classList.contains('m71-home')){window.SalamatMobileRoleIconShell?.home?.();return}
  const key=moduleKey(nav);if(!key){window.SalamatMobileRoleIconShell?.home?.();return}
  const shell=window.SalamatMobileRoleIconShell;
  if(typeof shell?.route==='function')void Promise.resolve(shell.route(key)).then(ok=>{if(ok===false)window.SalamatStaffModuleRouter?.route?.(key)}).catch(()=>window.SalamatStaffModuleRouter?.route?.(key));
  else void window.SalamatStaffModuleRouter?.route?.(key);
}

function installBoundaryObserver(){
  boundaryObserver?.disconnect();
  boundaryObserver=new MutationObserver(()=>{if(caregiver())schedule()});
  boundaryObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  if(document.body)boundaryObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const app=$('#appView');if(app)boundaryObserver.observe(app,{childList:true,subtree:false,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
}
function boot(){
  addStyles();installBoundaryObserver();document.addEventListener('click',captureAdminTap,true);
  ['pageshow','salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-navigation-canonical','salamat-mobile-role-icon-shell-ready'].forEach(name=>window.addEventListener(name,schedule,{passive:true}));
  MEDIA.addEventListener?.('change',schedule);schedule();
  window.SalamatMobilePanelInteractionStability={version:VERSION,sync:schedule,get role(){return role()},get panel(){return panel()}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
