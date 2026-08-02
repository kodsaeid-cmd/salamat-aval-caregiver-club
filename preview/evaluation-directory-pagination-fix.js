(()=>{
'use strict';
if(window.__salamatEvaluationDirectoryPaginationFixV5)return;
window.__salamatEvaluationDirectoryPaginationFixV5=true;
window.__salamatEvaluationDirectoryPaginationFixV4=true;
window.__salamatEvaluationDirectoryPaginationFixV3=true;
window.__salamatEvaluationDirectoryPaginationFixV2=true;

if(window.__salamatEvaluationSearchCanonicalV1)return;
if(document.querySelector('script[data-evaluation-search-canonical]'))return;

const script=document.createElement('script');
script.src='./evaluation-search-canonical-runtime.js?v=1.0.0';
script.async=false;
script.dataset.evaluationSearchCanonical='true';
document.body.appendChild(script);
})();
