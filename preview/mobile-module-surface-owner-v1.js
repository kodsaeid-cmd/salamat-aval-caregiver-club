(()=>{
'use strict';
if(window.__salamatMobileModuleSurfaceOwnerV1)return;
window.__salamatMobileModuleSurfaceOwnerV1=true;

const VERSION='1.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const STAFF_LAUNCHER_ID='salamatMobileRoleLauncherV71';
const STAFF_NAV_ID='salamatMobileRoleBottomNavV71';
const STAFF_PROFILE_ID='salamatMobileRoleProfileV71';
const CAREGIVER_DASHBOARD_ID='salamatCaregiverDashboardV5';
const CAREGIVER_NAV_ID='salamatCaregiverBottomNavV5';
const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const appVisible=()=>Boolean($('#appView:not(.hidden)'));
const role=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase();
const caregiver=()=>role()==='CAREGIVER'||normalize($('#sidebarRole')?.textContent).includes('مراقب');
let mode='auto';
let frame=0;
let observer=null;

function important(node,property,value){if(node)node.style.setProperty(property,value,'important')}
function clear(node,property){node?.style?.removeProperty(property)}
function show(node){if(!node)return;important(node,'display','block');important(node,'visibility','visible');important(node,'opacity','1');important(node,'pointer-events','auto');node.setAttribute('aria-hidden','false')}
function hide(node){if(!node)return;important(node,'display','none');important(node,'visibility','hidden');important(node,'opacity','0');important(node,'pointer-events','none');node.setAttribute('aria-hidden','true')}
function contentNode(){return $('#content')}
function mainNode(){return $('.main-area')}

function enforceStaffModule(){
 const launcher=$('#'+STAFF_LAUNCHER_ID),content=contentNode(),main=mainNode();
 document.documentElement.classList.remove('salamat-mobile-icon-home-v71');
 document.body?.classList.remove('salamat-mobile-icon-home-v71');
 hide(launcher);show(content);show(main);
 document.documentElement.dataset.salamatMobileSurface='staff-module';
}
function enforceStaffHome(){
 const launcher=$('#'+STAFF_LAUNCHER_ID),content=contentNode(),main=mainNode();
 document.documentElement.classList.add('salamat-mobile-icon-home-v71');
 document.body?.classList.add('salamat-mobile-icon-home-v71');
 show(launcher);hide(content);show(main);
 document.documentElement.dataset.salamatMobileSurface='staff-home';
}
function enforceCaregiverModule(){
 const dashboard=$('#'+CAREGIVER_DASHBOARD_ID),content=contentNode(),main=mainNode();
 document.documentElement.classList.remove('salamat-caregiver-dashboard-v5');
 document.body?.classList.remove('salamat-caregiver-dashboard-v5');
 hide(dashboard);show(content);show(main);
 document.documentElement.dataset.salamatMobileSurface='caregiver-module';
}
function enforceCaregiverHome(){
 const dashboard=$('#'+CAREGIVER_DASHBOARD_ID),content=contentNode(),main=mainNode();
 document.documentElement.classList.add('salamat-caregiver-dashboard-v5');
 document.body?.classList.add('salamat-caregiver-dashboard-v5');
 show(dashboard);show(content);show(main);
 document.documentElement.dataset.salamatMobileSurface='caregiver-home';
}
function enforce(){
 frame=0;
 if(!MEDIA.matches||!appVisible())return;
 if(mode==='staff-module')enforceStaffModule();
 else if(mode==='staff-home')enforceStaffHome();
 else if(mode==='caregiver-module')enforceCaregiverModule();
 else if(mode==='caregiver-home')enforceCaregiverHome();
}
function schedule(){if(frame)return;frame=requestAnimationFrame(enforce)}
function setMode(next){mode=next;schedule();queueMicrotask(schedule);setTimeout(schedule,30);setTimeout(schedule,180)}

function openStaffProfileFallback(){
 const layer=$('#'+STAFF_PROFILE_ID);if(!layer)return;
 layer.classList.add('open');layer.setAttribute('aria-hidden','false');show(layer);
}
function openCaregiverProfile(){
 if(typeof window.SalamatCaregiverSelfProfile?.open==='function')window.SalamatCaregiverSelfProfile.open();
 else ($('.csp1-profile-trigger')||$('#topAvatar')||$('#sidebarAvatar'))?.click();
}
function handleTap(event){
 if(!MEDIA.matches||!appVisible())return;
 const target=event.target;
 if(!(target instanceof Element))return;

 const staffProfile=target.closest(`#${STAFF_NAV_ID} [data-nav-kind="profile"],#salamatMobileRoleHeaderV71 .m71-profile`);
 if(staffProfile&&!caregiver()){
   setTimeout(()=>{const layer=$('#'+STAFF_PROFILE_ID);if(!layer?.classList.contains('open'))openStaffProfileFallback()},0);
   return;
 }
 const caregiverProfile=target.closest(`#${CAREGIVER_NAV_ID} [data-mc5-action="profile"],#salamatCaregiverHeaderV5 .mc5-head-profile`);
 if(caregiverProfile&&caregiver()){
   setTimeout(openCaregiverProfile,0);
   return;
 }

 const staffHome=target.closest(`#${STAFF_NAV_ID} .m71-home,#${STAFF_NAV_ID} [data-nav-kind="home"]`);
 if(staffHome&&!caregiver()){setMode('staff-home');return}
 const staffModule=target.closest(`#${STAFF_LAUNCHER_ID} .m71-module[data-module-key],#${STAFF_NAV_ID} button[data-nav-key]:not(.m71-home):not([data-nav-kind="profile"])`);
 if(staffModule&&!caregiver()){setMode('staff-module');return}

 const caregiverHome=target.closest(`#${CAREGIVER_NAV_ID} [data-mc5-action="home"]`);
 if(caregiverHome&&caregiver()){setMode('caregiver-home');return}
 const caregiverModule=target.closest(`#${CAREGIVER_DASHBOARD_ID} .mc5-module,#${CAREGIVER_NAV_ID} [data-mc5-action="calendar"],#${CAREGIVER_NAV_ID} [data-mc5-action="support"],#${CAREGIVER_NAV_ID} [data-mc5-action="training"]`);
 if(caregiverModule&&caregiver()){setMode('caregiver-module')}
}

function infer(){
 if(!MEDIA.matches||!appVisible())return;
 if(caregiver()){
   if(document.documentElement.classList.contains('salamat-caregiver-dashboard-v5'))mode='caregiver-home';
   else if($('#'+CAREGIVER_DASHBOARD_ID))mode='caregiver-home';
 }else if($('#'+STAFF_LAUNCHER_ID)){
   mode=document.documentElement.classList.contains('salamat-mobile-icon-home-v71')?'staff-home':(mode==='auto'?'staff-home':mode);
 }
 schedule();
}
function installObserver(){
 observer?.disconnect();
 const app=$('#appView');if(!app)return;
 observer=new MutationObserver(schedule);
 observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-hidden','style']});
}
function boot(){
 document.addEventListener('click',handleTap,true);
 window.addEventListener('salamat-mobile-v71-route',()=>setMode('staff-module'));
 window.addEventListener('salamat-mobile-v71-home',()=>setMode('staff-home'));
 window.addEventListener('salamat-authenticated',()=>setTimeout(()=>{installObserver();mode='auto';infer()},0));
 window.addEventListener('salamat-access-ready',()=>setTimeout(infer,0));
 window.addEventListener('salamat-shell-ready',()=>setTimeout(infer,0));
 window.addEventListener('pageshow',()=>setTimeout(()=>{installObserver();infer()},0));
 window.addEventListener('salamat-logged-out',()=>{mode='auto';delete document.documentElement.dataset.salamatMobileSurface});
 MEDIA.addEventListener?.('change',infer);
 installObserver();infer();
 window.SalamatMobileModuleSurfaceOwner={version:VERSION,module:()=>setMode(caregiver()?'caregiver-module':'staff-module'),home:()=>setMode(caregiver()?'caregiver-home':'staff-home'),sync:schedule,get mode(){return mode}};
 window.dispatchEvent(new CustomEvent('salamat-mobile-module-surface-owner-ready',{detail:{version:VERSION}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();