(()=>{
'use strict';
if(window.__salamatFinancialUiHotfixV4)return;
window.__salamatFinancialUiHotfixV4=true;
const VERSION='4.2.0';
// Compatibility asset only. Finance DOM ownership now belongs to the canonical
// route/runtime pair; this file must not observe, repair, replace, or intercept it.
window.SalamatFinancialUiHotfixV4={version:VERSION,tabOwner:false,repair:()=>false,observer:false};
})();
