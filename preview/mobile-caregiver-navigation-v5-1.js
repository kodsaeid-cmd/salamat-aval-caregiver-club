(()=>{
'use strict';
if(window.__salamatMobileCaregiverNavigationV51)return;
window.__salamatMobileCaregiverNavigationV51=true;

const VERSION='5.1.0';
const media=window.matchMedia('(max-width:760px)');
const HEADER_ID='salamatCaregiverHeaderV5';
const NAV_ID='salamatCaregiverBottomNavV5';
const DASHBOARD_ID='salamatCaregiverDashboardV5';
const STYLE_ID='salamatMobileCaregiverNavigationV51Styles';
const BACK_ID='salamatCaregiverBackV51';
let queued=false;

const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const sourceNav=()=>$$('#sidebarNav .nav-item,#sidebarNav>button');
const sourceLabel=source=>{
  if(!source)return'';
  const clone=source.cloneNode(true);
  clone.querySelectorAll('b,[data-icon],svg').forEach(node=>node.remove());
  return normalize(clone.textContent);
};
const moduleKey=source=>String(source?.dataset?.caregiverModuleKey||source?.dataset?.accessModule||source?.dataset?.panelModuleKey||'').trim();
const appVisible=()=>Boolean($('#appView:not(.hidden)'));
const caregiverActive=()=>{
  if(!media.matches||!appVisible())return false;
  const role=normalize(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||$('#sidebarRole')?.textContent).toUpperCase();
  return role==='CAREGIVER'||role.includes('مراقب')||Boolean($('#sidebarNav [data-caregiver-module-key^="caregiver."]'));
};

function addStyles(){
  if($('#'+STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
@media(max-width:760px){
  html.salamat-caregiver-mobile-v5 #${HEADER_ID}{
    display:grid!important;grid-template-columns:42px minmax(0,1fr) 42px!important;align-items:center!important;gap:10px!important;direction:ltr!important;
    border-bottom:0!important;box-shadow:0 7px 24px rgba(24,64,42,.07)!important;
  }
  html.salamat-caregiver-mobile-v5 #${HEADER_ID}:after{content:"";position:absolute;right:0;left:0;bottom:0;height:2px;background:linear-gradient(90deg,rgba(229,43,49,.92) 0 24%,rgba(8,116,63,.9) 24% 100%)}
  html.salamat-caregiver-mobile-v5 #${HEADER_ID} .mc5-head-profile{grid-column:1!important;grid-row:1!important;direction:rtl!important;position:relative!important;background:#fff2f2!important;color:#d72e34!important;box-shadow:inset 0 0 0 1px rgba(229,43,49,.14)!important}
  html.salamat-caregiver-mobile-v5 #${HEADER_ID} .mc5-head-profile>*{opacity:0!important}
  html.salamat-caregiver-mobile-v5 #${HEADER_ID} .mc5-head-profile:after{content:"";position:absolute;width:22px;height:22px;background:currentColor;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 22a8 8 0 0 1 16 0' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 22a8 8 0 0 1 16 0' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat}
  html.salamat-caregiver-mobile-v5 #${HEADER_ID} .mc5-head-copy{grid-column:2!important;grid-row:1!important;direction:rtl!important;text-align:right!important}
  html.salamat-caregiver-mobile-v5 #${BACK_ID}{grid-column:3!important;grid-row:1!important;width:42px;height:42px;padding:0;border:1px solid rgba(229,43,49,.14);border-radius:14px;display:grid;place-items:center;background:#fff6f6;color:#d92d34;cursor:pointer;-webkit-tap-highlight-color:transparent}
  html.salamat-caregiver-mobile-v5 #${BACK_ID}[hidden]{display:none!important}
  html.salamat-caregiver-mobile-v5 #${BACK_ID} svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  html.salamat-caregiver-mobile-v5 #${NAV_ID}{border-color:rgba(229,43,49,.10)!important;box-shadow:0 18px 50px rgba(10,62,35,.16),0 0 0 1px rgba(229,43,49,.025)!important}
  html.salamat-caregiver-mobile-v5 #${NAV_ID} button{touch-action:manipulation!important;cursor:pointer!important}
  html.salamat-caregiver-mobile-v5 #${NAV_ID} button.active:not(.home):after{content:"";position:absolute;bottom:2px;width:5px;height:5px;border-radius:50%;background:#e52b31}
  html.salamat-caregiver-mobile-v5 #${NAV_ID} button[data-mc5-action="profile"] .mc5-nav-icon{position:relative;color:#d72e34!important}
  html.salamat-caregiver-mobile-v5 #${NAV_ID} button[data-mc5-action="profile"] .mc5-nav-icon>*{opacity:0!important}
  html.salamat-caregiver-mobile-v5 #${NAV_ID} button[data-mc5-action="profile"] .mc5-nav-icon:after{content:"";position:absolute;width:22px;height:22px;background:currentColor;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 22a8 8 0 0 1 16 0' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M4 22a8 8 0 0 1 16 0' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat}
  html.salamat-caregiver-mobile-v5 #${NAV_ID} button.home .mc5-home-circle{box-shadow:0 12px 28px rgba(8,116,63,.28),0 0 0 3px rgba(229,43,49,.08)!important}
  html.salamat-caregiver-dashboard-v5 #${DASHBOARD_ID} .mc5-welcome{position:relative;overflow:hidden}
  html.salamat-caregiver-dashboard-v5 #${DASHBOARD_ID} .mc5-welcome:before{content:"";position:absolute;top:0;right:0;width:4px;height:100%;border-radius:0 22px 22px 0;background:#e52b31}
  html.salamat-caregiver-dashboard-v5 #${DASHBOARD_ID} .mc5-module:nth-child(3n+2) .mc5-module-icon{background:#fff1f2!important;color:#d8343a!important;border-color:#f5d0d3!important}
}
`;
  (document.head||document.documentElement).appendChild(style);
}

function createBackButton(){
  const button=document.createElement('button');
  button.id=BACK_ID;
  button.type='button';
  button.setAttribute('aria-label','بازگشت به داشبورد');
  button.setAttribute('title','بازگشت');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d','M5 12h14M13 6l6 6-6 6');
  svg.appendChild(path);button.appendChild(svg);
  return button;
}

function ensureBackButton(){
  const header=$('#'+HEADER_ID);if(!header)return null;
  let button=$('#'+BACK_ID,header);
  if(!button){button=createBackButton();header.appendChild(button)}
  return button;
}

function findSourceByAliases(aliases){
  const normalized=aliases.map(normalize);
  return sourceNav().find(source=>{
    const label=sourceLabel(source);
    return normalized.some(alias=>label===alias||label.includes(alias));
  })||null;
}
function sourceForAction(action){
  if(action==='home')return findSourceByAliases(['داشبورد']);
  if(action==='calendar')return findSourceByAliases(['تقویم کاری','تقویم']);
  if(action==='support')return findSourceByAliases(['پشتیبانی قراردادها','پشتیبانی پرونده','پشتیبانی']);
  if(action==='training')return findSourceByAliases(['آموزش‌های من','آموزش']);
  return null;
}
function sourceForModuleButton(button){
  const label=normalize($('.mc5-module-label',button)?.textContent);
  if(!label)return null;
  return sourceNav().find(source=>sourceLabel(source)===label)||sourceNav().find(source=>sourceLabel(source).includes(label))||null;
}

function afterNavigation(key){
  try{window.SalamatMobileShell?.close?.({restoreFocus:false})}catch{}
  try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
  window.dispatchEvent(new CustomEvent('salamat-mobile-caregiver-navigation',{detail:{version:VERSION,key}}));
  setTimeout(sync,0);setTimeout(sync,120);
}
async function openSource(source){
  if(!source)return false;
  const key=moduleKey(source);
  const owner=window.SalamatCaregiverCanonicalRouteOwner;
  try{
    if(key&&typeof owner?.openModule==='function'){
      await owner.openModule(key);
      afterNavigation(key);return true;
    }
    if(key==='caregiver.dashboard'&&typeof owner?.openDashboard==='function'){
      await owner.openDashboard();afterNavigation(key);return true;
    }
  }catch(error){console.warn('[mobile-caregiver-navigation] canonical route failed',key,error)}
  try{
    source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    afterNavigation(key||sourceLabel(source));return true;
  }catch(error){console.warn('[mobile-caregiver-navigation] source route failed',error);return false}
}
function openProfile(){
  if(typeof window.SalamatCaregiverSelfProfile?.open==='function'){
    window.SalamatCaregiverSelfProfile.open();afterNavigation('profile');return true;
  }
  const source=$('.csp1-profile-trigger')||$('#topAvatar')||$('#sidebarAvatar');
  if(source){source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));afterNavigation('profile');return true}
  return false;
}
function openAction(action){
  if(action==='profile')return openProfile();
  return openSource(sourceForAction(action));
}

function dashboardActive(){
  const active=$('#sidebarNav [data-caregiver-module-key].active');
  const key=moduleKey(active);
  if(key)return key==='caregiver.dashboard';
  return normalize($('#pageTitle')?.textContent).includes('داشبورد');
}
function sync(){
  queued=false;
  if(!caregiverActive())return;
  addStyles();
  const back=ensureBackButton();
  if(back)back.hidden=dashboardActive();
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(sync)}

function captureNavigation(event){
  if(!caregiverActive()||!(event.target instanceof Element))return;
  const back=event.target.closest('#'+BACK_ID);
  if(back){event.preventDefault();event.stopImmediatePropagation();void openAction('home');return}
  const navButton=event.target.closest('#'+NAV_ID+' button[data-mc5-action]');
  if(navButton){
    event.preventDefault();event.stopImmediatePropagation();
    void openAction(String(navButton.dataset.mc5Action||''));return;
  }
  const moduleButton=event.target.closest('#'+DASHBOARD_ID+' .mc5-module');
  if(moduleButton){
    event.preventDefault();event.stopImmediatePropagation();
    void openSource(sourceForModuleButton(moduleButton));
  }
}

function boot(){
  addStyles();
  document.addEventListener('click',captureNavigation,true);
  window.addEventListener('salamat-authenticated',()=>setTimeout(schedule,0));
  window.addEventListener('salamat-access-ready',()=>setTimeout(schedule,0));
  window.addEventListener('salamat-caregiver-route-changed',schedule);
  window.addEventListener('pageshow',schedule);
  media.addEventListener?.('change',schedule);
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-caregiver-module-key']});
  schedule();
  window.SalamatMobileCaregiverNavigationV51={version:VERSION,openAction,openSource,sync};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();