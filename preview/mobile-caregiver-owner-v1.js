(()=>{
'use strict';
if(window.__salamatMobileCaregiverOwnerV1)return;
window.__salamatMobileCaregiverOwnerV1=true;
const VERSION='1.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const exactRole=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||'').toUpperCase();
const appVisible=()=>Boolean($('#appView:not(.hidden)'));
let claimed=false,attempts=0,timer=0;
function clearGenericShell(){
 document.documentElement.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app');
 document.body?.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app','salamat-mobile-nav-open');
 ['salamatMobileRoleHeaderV71','salamatMobileRoleLauncherV71','salamatMobileRoleBottomNavV71','salamatMobileRoleProfileV71','salamatMobileAppHeader','salamatMobileBottomNav','salamatUnifiedMobileHeaderV6','salamatUnifiedMobileNavV6','salamatUnifiedMobileDashboardV6','salamatMobileRoleHeaderV7','salamatMobileRoleLauncherV7','salamatMobileRoleBottomNavV7'].forEach(id=>$('#'+id)?.remove());
 $('#content')?.removeAttribute('aria-hidden');
}
async function activate(){
 if(claimed||!MEDIA.matches||!appVisible()||exactRole()!=='CAREGIVER')return false;
 claimed=true;
 clearGenericShell();
 try{window.SalamatCaregiverCanonicalRouteOwner?.sync?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
 await new Promise(r=>setTimeout(r,80));
 if(typeof window.SalamatCaregiverCanonicalRouteOwner?.openModule==='function'){
   try{await window.SalamatCaregiverCanonicalRouteOwner.openModule('caregiver.dashboard')}catch{}
 }
 try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
 document.documentElement.dataset.salamatMobileCaregiverOwner=VERSION;
 return true;
}
function poll(){clearTimeout(timer);if(claimed)return;void activate();if(++attempts<60)timer=setTimeout(poll,250)}
function kick(){if(claimed)return;attempts=0;poll()}
function install(){
 ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','pageshow'].forEach(n=>window.addEventListener(n,kick,{passive:true}));
 MEDIA.addEventListener?.('change',kick);
 poll();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.SalamatMobileCaregiverOwnerV1={version:VERSION,activate:kick};
})();
