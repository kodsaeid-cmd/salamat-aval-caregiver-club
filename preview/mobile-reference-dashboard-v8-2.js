(()=>{
'use strict';
// V8.2 photo tiles are permanently retired. This compatibility shim exists only
// for stale HTML/browser caches that still request the old filename.
if(window.__salamatMobileReferenceDashboardV82Compat)return;
window.__salamatMobileReferenceDashboardV82Compat=true;
window.__salamatMobileReferenceDashboardV82=true;
const SRC='./mobile-flat-dashboard-v8-3.js?v=8.3.2';
if(window.__salamatMobileFlatDashboardV83)return;
const existing=[...document.scripts].some(s=>String(s.src||'').includes('mobile-flat-dashboard-v8-3.js'));
if(existing)return;
const script=document.createElement('script');
script.src=SRC;
script.defer=true;
script.dataset.salamatMobileV82Compat='flat-v8.3.2';
(document.head||document.documentElement).appendChild(script);
})();
