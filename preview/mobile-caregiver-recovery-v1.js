(()=>{
'use strict';
if(window.__salamatMobileCaregiverRecoveryV1)return;
window.__salamatMobileCaregiverRecoveryV1=true;
const VERSION='1.1.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const normalize=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const role=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase();
function navLooksCaregiver(){const nav=$('#sidebarNav');if(!nav)return false;if(nav.querySelector('[data-caregiver-module-key],[data-access-module^="caregiver."]'))return true;const text=normalize(nav.textContent);return text.includes('آموزش‌های من')||text.includes('تقویم کاری')||text.includes('کارنامه من')||text.includes('پشتیبانی پرونده')}
const isCaregiver=()=>role()==='CAREGIVER'||normalize($('#sidebarRole')?.textContent).includes('مراقب')||navLooksCaregiver();
const conflictingIds=['salamatMobileRoleHeaderV71','salamatMobileRoleLauncherV71','salamatMobileRoleBottomNavV71','salamatMobileRoleProfileV71','salamatMobileAppHeader','salamatMobileBottomNav','salamatUnifiedMobileHeaderV6','salamatUnifiedMobileNavV6','salamatUnifiedMobileDashboardV6','salamatMobileRoleHeaderV7','salamatMobileRoleLauncherV7','salamatMobileRoleBottomNavV7'];
function clearConflicts(){
 document.documentElement.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app');
 document.body?.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app','salamat-mobile-nav-open');
 conflictingIds.forEach(id=>$('#'+id)?.remove());
 $('#mobileSidebarBackdrop')?.classList.remove('open');
 $('#sidebar')?.classList.remove('open');
 $('#content')?.removeAttribute('aria-hidden');
}
async function openCaregiverDashboard(){
 const owner=window.SalamatCaregiverCanonicalRouteOwner;
 if(typeof owner?.openModule==='function'){
   try{await owner.openModule('caregiver.dashboard');return true}catch{}
 }
 const source=$('[data-caregiver-module-key="caregiver.dashboard"],[data-access-module="caregiver.dashboard"]');
 if(source){try{HTMLElement.prototype.click.call(source);return true}catch{}}
 return false;
}
async function recover(){
 if(!MEDIA.matches||!isCaregiver())return false;
 const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;
 clearConflicts();
 app.classList.remove('hidden');
 try{window.SalamatCaregiverCanonicalRouteOwner?.sync?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
 await new Promise(resolve=>setTimeout(resolve,40));
 await openCaregiverDashboard();
 try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
 document.documentElement.dataset.salamatMobileCaregiverRecovery=VERSION;
 return true;
}
let timer=0,attempts=0,busy=false;
function retry(){clearTimeout(timer);if(!busy){busy=true;Promise.resolve(recover()).finally(()=>{busy=false})}if(++attempts<120)timer=setTimeout(retry,250)}
function kick(){attempts=0;retry()}
function start(){
 retry();
 ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-caregiver-access-ready','pageshow'].forEach(n=>window.addEventListener(n,kick,{passive:true}));
 const app=$('#appView');if(app)new MutationObserver(()=>{if(isCaregiver())kick()}).observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
 const nav=$('#sidebarNav');if(nav)new MutationObserver(()=>{if(isCaregiver())kick()}).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['data-caregiver-module-key','data-access-module','class']});
 const html=document.documentElement;new MutationObserver(()=>{if(isCaregiver()&&(html.classList.contains('salamat-mobile-panel-v71')||html.classList.contains('salamat-mobile-app')))kick()}).observe(html,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.SalamatMobileCaregiverRecoveryV1={version:VERSION,recover:kick};
})();
