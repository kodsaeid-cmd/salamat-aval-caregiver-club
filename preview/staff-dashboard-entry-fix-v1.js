(()=>{
'use strict';
if(window.__salamatStaffDashboardEntryFixV1)return;
window.__salamatStaffDashboardEntryFixV1=true;
const VERSION='1.1.0';
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let scheduled=false,opening=false,lastReason='';
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
function currentUser(){try{return window.SalamatBackend?.getCurrentUser?.()||window.__salamatAuthenticatedStaffUser||window.SalamatAccessControl?.access?.user||null}catch{return window.__salamatAuthenticatedStaffUser||null}}
function roleOf(user){return String(user?.actualRole||user?.role||document.documentElement.dataset.currentUserRole||'').trim().toUpperCase()}
function appVisible(){const app=$('#appView'),login=$('#loginView');return Boolean(app&&!app.classList.contains('hidden')&&(!login||login.classList.contains('hidden')))}
function staffNavigation(){return $$('#sidebarNav [data-panel-module-key],#sidebarNav [data-staff-module-key]')}
function keyOf(button){return button?.dataset.panelModuleKey||button?.dataset.staffModuleKey||button?.dataset.accessModule||''}
function activeStaffButton(){return staffNavigation().find(button=>button.classList.contains('active')||button.getAttribute('aria-current')==='page')||null}
function dashboardButton(){return staffNavigation().find(button=>keyOf(button)==='staff.dashboard')||staffNavigation().find(button=>normalize(button.textContent).includes('داشبورد'))||null}
function isStaffSession(){const role=roleOf(currentUser());return STAFF_ROLES.has(role)||Boolean(dashboardButton())}
function hasRealDashboard(){const content=$('#content');return Boolean(content&&($('.spx-dashboard',content)||$('[data-module-key="staff.dashboard"]',content)||$('[data-view="staff-dashboard"]',content)))}
function otherModuleIsSelected(){const active=activeStaffButton(),key=keyOf(active);return Boolean(active&&key&&key!=='staff.dashboard')}
function canViewDashboard(){try{return typeof window.SalamatAccessControl?.can!=='function'||window.SalamatAccessControl.can('staff.dashboard','view')!==false}catch{return true}}
function markDashboardNavigation(){const target=dashboardButton();if(!target)return;staffNavigation().forEach(button=>{const active=button===target;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false')})}
async function openDashboard(reason='entry'){
 if(opening||!appVisible()||!isStaffSession()||!canViewDashboard()||otherModuleIsSelected()||hasRealDashboard())return false;
 const router=window.SalamatStaffModuleRouter;if(typeof router?.route!=='function')return false;
 opening=true;lastReason=reason;
 try{markDashboardNavigation();await Promise.resolve(router.route('staff.dashboard'));window.dispatchEvent(new CustomEvent('salamat-staff-dashboard-entry-fixed',{detail:{reason,version:VERSION}}));return true}
 catch(error){console.error('Staff dashboard direct entry failed',error);return false}
 finally{opening=false}
}
function settle(reason='unknown'){
 lastReason=reason;if(scheduled)return;scheduled=true;
 queueMicrotask(async()=>{scheduled=false;if(await openDashboard(lastReason))return;setTimeout(()=>void openDashboard(`${lastReason}-retry`),80)});
}
window.addEventListener('salamat-authenticated',()=>settle('authenticated'));
window.addEventListener('salamat-access-ready',()=>settle('access-ready'));
window.addEventListener('salamat-shell-ready',()=>settle('shell-ready'));
window.addEventListener('salamat-navigation-canonical',()=>settle('navigation-ready'));
window.addEventListener('pageshow',()=>settle('pageshow'));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>settle('dom-ready'),{once:true});else settle('initial');
window.SalamatStaffDashboardEntry={version:VERSION,settle,repair:openDashboard,get realVisible(){return hasRealDashboard()}};
})();
