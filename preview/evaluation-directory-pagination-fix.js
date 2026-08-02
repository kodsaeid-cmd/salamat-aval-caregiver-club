(()=>{
'use strict';
if(window.__salamatEvaluationModuleBootstrapV6)return;
window.__salamatEvaluationModuleBootstrapV6=true;

/* Disable every legacy search patch before loading the rewritten module. */
window.__salamatEvaluationDirectoryPaginationFixV5=true;
window.__salamatEvaluationDirectoryPaginationFixV4=true;
window.__salamatEvaluationDirectoryPaginationFixV3=true;
window.__salamatEvaluationDirectoryPaginationFixV2=true;
window.__salamatEvaluationSearchCanonicalV1=true;

if(window.__salamatServerEvaluationRuntimeV2)return;
if(document.querySelector('script[data-server-evaluation-runtime-v2]'))return;

const script=document.createElement('script');
script.src='./server-evaluation-runtime-v2.js?v=2.0.0';
script.async=false;
script.dataset.serverEvaluationRuntimeV2='true';
document.body.appendChild(script);
})();
