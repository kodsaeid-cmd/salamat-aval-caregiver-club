(()=>{
'use strict';
if(window.__salamatMobileCaregiverOwnerV1)return;
window.__salamatMobileCaregiverOwnerV1=true;
const VERSION='2.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const normalize=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const exactRole=()=>String(window.SalamatBackend?.getCurrentUser?.()?.actualRole||window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||'').toUpperCase();
const appVisible=()=>Boolean($('#appView:not(.hidden)'));
const active=()=>MEDIA.matches&&appVisible()&&exactRole()==='CAREGIVER';
let frame=0,observer=null,activated=false;

function clearGenericShell(){
 document.documentElement.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app');
 document.body?.classList.remove('salamat-mobile-panel-v71','salamat-mobile-icon-home-v71','salamat-mobile-panel-v7','salamat-mobile-panel-v6','salamat-mobile-app','salamat-mobile-nav-open');
 ['salamatMobileRoleHeaderV71','salamatMobileRoleLauncherV71','salamatMobileRoleBottomNavV71','salamatMobileRoleProfileV71','salamatMobileAppHeader','salamatMobileBottomNav','salamatUnifiedMobileHeaderV6','salamatUnifiedMobileNavV6','salamatUnifiedMobileDashboardV6','salamatMobileRoleHeaderV7','salamatMobileRoleLauncherV7','salamatMobileRoleBottomNavV7'].forEach(id=>$('#'+id)?.remove());
 $('#content')?.removeAttribute('aria-hidden');
}
function sourceLabel(source){
 if(!source)return'';const clone=source.cloneNode(true);clone.querySelectorAll('b,[data-icon],svg,.badge,.count').forEach(node=>node.remove());return normalize(clone.textContent);
}
function sourceKey(source){const d=source?.dataset||{};return String(d.caregiverModuleKey||d.moduleKey||d.route||d.view||d.key||'')}
function sources(){return $$('#sidebarNav .nav-item,#sidebarNav>button')}
function findSource(labels){
 const terms=labels.map(normalize);return sources().find(source=>{const label=sourceLabel(source);return terms.some(term=>label===term||label.includes(term))})||null;
}
async function openKey(key,source){
 if(!key)return false;
 try{
  if(typeof window.SalamatCaregiverCanonicalRouteOwner?.openModule==='function'){
   await window.SalamatCaregiverCanonicalRouteOwner.openModule(key);
   try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
   window.scrollTo({top:0,left:0,behavior:'auto'});return true;
  }
 }catch(error){console.warn('[caregiver-owner-v2] canonical route failed',key,error)}
 const fallback=source||$(`[data-caregiver-module-key="${window.CSS?.escape?CSS.escape(key):key}"]`);
 if(!fallback)return false;
 try{HTMLElement.prototype.click.call(fallback);window.scrollTo({top:0,left:0,behavior:'auto'});return true}catch{return false}
}
function routeAction(action){
 if(action==='home')return openKey('caregiver.dashboard',findSource(['داشبورد']));
 const map={calendar:['تقویم کاری','تقویم'],support:['پشتیبانی قراردادها','پشتیبانی پرونده','پشتیبانی'],training:['آموزش‌های من','آموزش']};
 const source=findSource(map[action]||[]);return source?openKey(sourceKey(source),source):Promise.resolve(false);
}
function ensureLogout(){
 const modal=$('.csp1-backdrop');const actions=$('.csp1-actions div',modal);if(!modal||!actions||$('#csp1Logout',modal))return;
 const button=document.createElement('button');button.id='csp1Logout';button.type='button';button.className='csp1-btn';button.textContent='خروج از حساب کاربری';
 button.style.setProperty('background','#d83429','important');button.style.setProperty('color','#fff','important');
 button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();modal.remove();const logout=$('#logoutButton');if(logout)HTMLElement.prototype.click.call(logout)});
 actions.prepend(button);
}
function maintain(){
 frame=0;
 if(!active()){
  document.documentElement.classList.remove('salamat-caregiver-owner-v2');document.body?.classList.remove('salamat-caregiver-owner-v2');return false;
 }
 document.documentElement.classList.add('salamat-caregiver-owner-v2','salamat-caregiver-mobile-v5');
 document.body?.classList.add('salamat-caregiver-owner-v2','salamat-caregiver-mobile-v5');
 clearGenericShell();
 try{window.SalamatCaregiverCanonicalRouteOwner?.sync?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.rebuild?.()}catch{}
 try{window.SalamatMobileCaregiverShellV5?.sync?.()}catch{}
 ensureLogout();activated=true;document.documentElement.dataset.salamatMobileCaregiverOwner=VERSION;return true;
}
function schedule(){if(frame)return;frame=requestAnimationFrame(maintain)}
function capture(event){
 if(!active())return;const target=event.target;if(!(target instanceof Element))return;
 if(target.closest('.csp1-backdrop')){ensureLogout();return}
 const profile=target.closest('#salamatCaregiverHeaderV5 .mc5-head-profile,#salamatCaregiverBottomNavV5 button[data-mc5-action="profile"]');
 if(profile){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();window.SalamatCaregiverSelfProfile?.open?.();setTimeout(ensureLogout,0);return}
 const nav=target.closest('#salamatCaregiverBottomNavV5 button[data-mc5-action]');
 if(nav){const action=String(nav.dataset.mc5Action||'');if(action){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void routeAction(action);return}}
 const card=target.closest('#salamatCaregiverDashboardV5 .mc5-module');
 if(card){const label=normalize(card.getAttribute('aria-label')||card.textContent);const source=findSource([label]);const key=sourceKey(source);if(key){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openKey(key,source)}}
}
function observe(){
 observer?.disconnect();observer=new MutationObserver(schedule);
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 const app=$('#appView');if(app)observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
}
function install(){
 document.addEventListener('click',capture,true);
 ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','pageshow','salamat-caregiver-profile-updated'].forEach(n=>window.addEventListener(n,schedule,{passive:true}));
 MEDIA.addEventListener?.('change',schedule);observe();schedule();setInterval(()=>{if(active())schedule()},1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.SalamatMobileCaregiverOwnerV1={version:VERSION,activate:schedule,get active(){return active()},get claimed(){return activated}};
})();
