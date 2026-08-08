(()=>{
'use strict';
if(window.__salamatMobileCaregiverRecoveryV1)return;
window.__salamatMobileCaregiverRecoveryV1=true;
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const role=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase();
const isCaregiver=()=>role()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب');
const ids=['salamatMobileRoleHeaderV71','salamatMobileRoleLauncherV71','salamatMobileRoleBottomNavV71','salamatMobileRoleProfileV71'];
function recover(){
 if(!MEDIA.matches||!isCaregiver())return false;
 const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;
 document.documentElement.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71');
 document.body?.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71');
 ids.forEach(id=>$('#'+id)?.remove());
 $('#content')?.removeAttribute('aria-hidden');
 $('#appView')?.classList.remove('hidden');
 try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
 try{window.SalamatCaregiverCanonicalRouteOwner?.sync?.()}catch{}
 document.documentElement.dataset.salamatMobileCaregiverRecovery='1.0.0';
 return true;
}
let timer=0,attempts=0;
function retry(){clearTimeout(timer);recover();if(++attempts<80)timer=setTimeout(retry,250)}
function start(){retry();['salamat-authenticated','salamat-access-ready','salamat-shell-ready','pageshow'].forEach(n=>window.addEventListener(n,()=>{attempts=0;retry()},{passive:true}));const app=$('#appView');if(app)new MutationObserver(()=>{if(isCaregiver()){attempts=0;retry()}}).observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});const html=document.documentElement;new MutationObserver(()=>{if(isCaregiver()&&html.classList.contains('salamat-mobile-panel-v71')){attempts=0;retry()}}).observe(html,{attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.SalamatMobileCaregiverRecoveryV1={version:'1.0.0',recover};
})();
