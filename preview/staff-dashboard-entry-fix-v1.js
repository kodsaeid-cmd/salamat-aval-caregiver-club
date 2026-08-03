(()=>{
'use strict';
if(window.__salamatStaffDashboardEntryFixV1)return;
window.__salamatStaffDashboardEntryFixV1=true;

const VERSION='1.0.0';
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
const SETTLE_DELAYS=[0,60,140,280,520,900,1500,2400];
let settleToken=0;
let mutationFrame=0;
let appObserver=null;
let contentObserver=null;
let repairing=false;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const normalize=value=>String(value||'')
  .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
  .replace(/[يى]/g,'ی')
  .replace(/ك/g,'ک')
  .replace(/\s+/g,' ')
  .trim();

function roleOf(user){
  return String(user?.actualRole||user?.role||document.documentElement.dataset.currentUserRole||'').trim().toUpperCase();
}
function currentUser(){
  try{return window.SalamatBackend?.getCurrentUser?.()||window.__salamatAuthenticatedStaffUser||null}catch{return window.__salamatAuthenticatedStaffUser||null}
}
function appVisible(){
  const app=$('#appView'),login=$('#loginView');
  return Boolean(app&&!app.classList.contains('hidden')&&(!login||login.classList.contains('hidden')));
}
function staffNavigation(){
  return $$('#sidebarNav [data-staff-module-key]');
}
function activeStaffButton(){
  return staffNavigation().find(button=>button.classList.contains('active')||button.getAttribute('aria-current')==='page')||null;
}
function dashboardButton(){
  return staffNavigation().find(button=>button.dataset.staffModuleKey==='staff.dashboard')
    || $$('#sidebarNav .nav-item,#sidebarNav>button').find(button=>normalize(button.textContent).includes('داشبورد'))
    || null;
}
function isStaffSession(){
  const role=roleOf(currentUser());
  if(STAFF_ROLES.has(role))return true;
  return staffNavigation().length>0&&Boolean(dashboardButton());
}
function hasRealDashboard(){
  const content=$('#content');
  if(!content)return false;
  return Boolean($('.spx-dashboard',content)||$('[data-module-key="staff.dashboard"]',content)||$('[data-view="staff-dashboard"]',content));
}
function hasLegacyDashboard(){
  const content=$('#content');
  if(!content)return false;
  if($('.role-hero',content))return true;
  const title=normalize($('#pageTitle')?.textContent);
  const heading=normalize($('#content h2')?.textContent);
  return title.includes('داشبورد مدیر سامانه')
    || heading.includes('مرکز فرمان باشگاه')
    || heading.includes('مدیریت یکپارچه باشگاه مراقبین');
}
function dashboardIsSelected(){
  const active=activeStaffButton();
  if(!active)return Boolean(dashboardButton()?.classList.contains('active'));
  return active.dataset.staffModuleKey==='staff.dashboard'||normalize(active.textContent).includes('داشبورد');
}
function otherModuleIsSelected(){
  const active=activeStaffButton();
  return Boolean(active&&active.dataset.staffModuleKey&&active.dataset.staffModuleKey!=='staff.dashboard');
}
function canOpenDashboard(){
  const access=window.SalamatAccessControl;
  if(typeof access?.openModule!=='function')return false;
  try{return access.can?.('staff.dashboard','view')!==false}catch{return true}
}
function shouldRepair(){
  if(!appVisible()||!isStaffSession()||!canOpenDashboard())return false;
  if(otherModuleIsSelected())return false;
  if(hasRealDashboard())return false;
  return hasLegacyDashboard()||dashboardIsSelected();
}
function markDashboardNavigation(){
  const target=dashboardButton();
  if(!target)return;
  staffNavigation().forEach(button=>{
    const active=button===target;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });
}
function repair(reason='unknown'){
  if(repairing||!shouldRepair())return false;
  repairing=true;
  try{
    markDashboardNavigation();
    window.SalamatAccessControl.openModule('staff.dashboard');
    requestAnimationFrame(()=>{
      window.dispatchEvent(new CustomEvent('salamat-staff-dashboard-entry-fixed',{detail:{reason,version:VERSION}}));
    });
    return true;
  }catch(error){
    console.error('Staff dashboard entry repair failed',error);
    return false;
  }finally{
    repairing=false;
  }
}
function scheduleMutationRepair(){
  cancelAnimationFrame(mutationFrame);
  mutationFrame=requestAnimationFrame(()=>repair('legacy-dashboard-mutation'));
}
function settle(reason,{reload=false}={}){
  const token=++settleToken;
  const begin=async()=>{
    if(reload&&typeof window.SalamatAccessControl?.reload==='function'){
      try{await window.SalamatAccessControl.reload()}catch{}
    }
    for(const delay of SETTLE_DELAYS){
      if(token!==settleToken)return;
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      if(token!==settleToken)return;
      if(repair(reason)&&hasRealDashboard())return;
      if(appVisible()&&hasRealDashboard())return;
      if(otherModuleIsSelected())return;
    }
  };
  void begin();
}
function observe(){
  appObserver?.disconnect();contentObserver?.disconnect();
  const app=$('#appView'),login=$('#loginView'),content=$('#content');
  appObserver=new MutationObserver(()=>settle('surface-visibility'));
  [app,login].filter(Boolean).forEach(node=>appObserver.observe(node,{attributes:true,attributeFilter:['class','hidden','aria-hidden']}));
  if(content){
    contentObserver=new MutationObserver(()=>{
      if(hasLegacyDashboard()&&dashboardIsSelected())scheduleMutationRepair();
    });
    contentObserver.observe(content,{childList:true,subtree:true});
  }
  settle('initial-load');
}

window.addEventListener('salamat-authenticated',()=>settle('authenticated',{reload:true}));
window.addEventListener('salamat-shell-ready',()=>settle('shell-ready'));
window.addEventListener('salamat-mobile-login-surface',event=>{if(event.detail?.active===false)settle('mobile-login-complete')});
window.addEventListener('pageshow',()=>settle('pageshow'));
window.addEventListener('popstate',()=>setTimeout(()=>settle('history'),40));

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();

window.SalamatStaffDashboardEntry={version:VERSION,settle,repair,get legacyVisible(){return hasLegacyDashboard()},get realVisible(){return hasRealDashboard()}};
})();