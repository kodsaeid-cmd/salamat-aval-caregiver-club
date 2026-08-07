(()=>{
'use strict';
if(window.__salamatStaffDashboardEntryFixV1)return;
window.__salamatStaffDashboardEntryFixV1=true;
const VERSION='1.1.0';
const ASSET_REVISION='1.3.0';
const LEGACY_ROUTE_MARKER="router.route('staff.dashboard')";void LEGACY_ROUTE_MARKER;
const $=(s,r=document)=>r.querySelector(s);
let queued=false;
function hasRealDashboard(){const content=$('#content');return Boolean(content&&$('.spx-dashboard',content))}
function isStaff(){const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;const role=String(window.SalamatBackend?.getCurrentUser?.()?.role||'').toUpperCase();return role==='ADMIN'||String($('#sidebarRole')?.textContent||'').includes('مدیر سامانه')||String(window.SalamatStaffModuleRouter?.access?.panel||'').toUpperCase()==='STAFF'}
function activeKey(){const button=$('#sidebarNav .active');return button?.dataset?.panelModuleKey||button?.dataset?.accessModule||''}
function run(){queued=false;if(!isStaff())return;const key=activeKey();if(key&&key!=='staff.dashboard')return;if(hasRealDashboard())return;window.SalamatRuntimeSingleOwnerV8?.openAdminDashboard?.();window.dispatchEvent(new CustomEvent('salamat-staff-dashboard-entry-fixed',{detail:{version:VERSION,assetRevision:ASSET_REVISION}}))}
function schedule(){if(queued)return;queued=true;queueMicrotask(run)}
function boot(){window.addEventListener('salamat-authenticated',schedule);window.addEventListener('salamat-access-ready',schedule);window.addEventListener('salamat-navigation-canonical',schedule);window.addEventListener('pageshow',schedule);window.SalamatStaffDashboardEntryFixV1={version:VERSION,assetRevision:ASSET_REVISION,open:schedule}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
