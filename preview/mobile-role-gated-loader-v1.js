(()=>{
'use strict';
if(window.__salamatMobileRoleGatedLoaderV1)return;
window.__salamatMobileRoleGatedLoaderV1=true;

const VERSION='1.0.0';
const SHELL_VERSION='7.1.0';
const CACHE='8.4.7';
const MEDIA=window.matchMedia('(max-width:760px)');
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
let loading=false;
let loaded=false;
let retryTimer=0;
let retryCount=0;

const $=(s,r=document)=>r?.querySelector?.(s)||null;
const role=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||'').toUpperCase();
const panel=()=>String(window.SalamatStaffModuleRouter?.access?.panel||window.SalamatAccessControl?.panelType||window.__salamatResolvedPanel||'').toUpperCase();
const appVisible=()=>{const app=$('#appView');return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden&&app.getAttribute('aria-hidden')!=='true')};
const caregiver=()=>role()==='CAREGIVER'||panel()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب');
const staff=()=>panel()==='STAFF'||STAFF_ROLES.has(role());

function clearGenericShell(){
  ['salamatMobileRoleHeaderV71','salamatMobileRoleLauncherV71','salamatMobileRoleBottomNavV71','salamatMobileRoleProfileV71'].forEach(id=>$('#'+id)?.remove());
  document.documentElement.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71');
  document.body?.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71');
}
function releasePreboot(){
  document.documentElement.classList.remove('salamat-mobile-preboot-v74','salamat-mobile-route-pending-v75');
  const app=$('#appView');if(app&&appVisible()){app.style.removeProperty('visibility');app.style.removeProperty('pointer-events')}
}
function loadStaffShell(){
  if(!MEDIA.matches||!appVisible()||!staff()||caregiver()||loading||loaded)return;
  if(window.SalamatMobileRoleIconShell?.version){loaded=true;return}
  loading=true;
  try{delete window.__salamatMobileRoleIconShellV71}catch{window.__salamatMobileRoleIconShellV71=false}
  const script=document.createElement('script');
  script.src=`./mobile-role-icon-shell-v7-1.js?v=${SHELL_VERSION}-${CACHE}`;
  script.async=false;
  script.dataset.salamatRoleGatedShell=VERSION;
  script.onload=()=>{loading=false;loaded=true;releasePreboot();window.SalamatMobileRoleIconShell?.sync?.()};
  script.onerror=()=>{loading=false;console.error('Mobile role shell failed to load')};
  document.body.appendChild(script);
}
function ensureCaregiver(){
  if(!MEDIA.matches||!appVisible()||!caregiver())return false;
  window.__salamatMobileRoleIconShellV71=true;
  clearGenericShell();
  document.documentElement.classList.add('salamat-caregiver-mobile-v5');
  document.body?.classList.add('salamat-caregiver-mobile-v5');
  try{window.SalamatCaregiverCanonicalRouteOwner?.sync?.()}catch{}
  try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
  try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
  return true;
}
function sync(){
  releasePreboot();
  if(!MEDIA.matches||!appVisible())return;
  if(ensureCaregiver())return;
  if(staff()){loadStaffShell();return}
  if(retryCount<40){retryCount+=1;clearTimeout(retryTimer);retryTimer=setTimeout(sync,100)}
}
function resetRetry(){retryCount=0;sync()}
function boot(){
  releasePreboot();
  ['pageshow','salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-navigation-canonical'].forEach(name=>window.addEventListener(name,resetRetry,{passive:true}));
  window.addEventListener('salamat-logged-out',()=>{clearTimeout(retryTimer);clearGenericShell();releasePreboot();if(MEDIA.matches&&loaded)setTimeout(()=>location.reload(),0)},{passive:true});
  MEDIA.addEventListener?.('change',resetRetry);
  resetRetry();
  window.SalamatMobileRoleGatedLoader={version:VERSION,sync:resetRetry,get role(){return role()},get panel(){return panel()}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
