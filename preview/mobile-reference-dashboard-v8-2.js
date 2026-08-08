(()=>{
'use strict';
// Compatibility contract only. The V8.2 photo presentation is permanently retired.
const VERSION='8.2.0';
if(window.__salamatMobileReferenceDashboardV82Compat)return;
window.__salamatMobileReferenceDashboardV82Compat=true;
window.__salamatMobileReferenceDashboardV82=true;
if(window.__salamatMobileFlatDashboardV83)return;
const SRC='./mobile-flat-dashboard-v8-3.js?v=8.3.2';
const existing=[...document.scripts].some(s=>String(s.src||'').includes('mobile-flat-dashboard-v8-3.js'));
if(existing)return;
const script=document.createElement('script');
script.src=SRC;
script.defer=true;
script.dataset.salamatMobileV82Compat=VERSION;
(document.head||document.documentElement).appendChild(script);
})();
