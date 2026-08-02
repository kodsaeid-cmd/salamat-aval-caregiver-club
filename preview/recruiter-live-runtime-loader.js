(()=>{
'use strict';
if(window.__salamatRecruiterLiveRuntimeLoaderV3)return;
window.__salamatRecruiterLiveRuntimeLoaderV3=true;
window.__salamatRecruiterServerRuntimeV2=true;
if(window.__salamatRecruiterServerRuntimeV3)return;
const script=document.createElement('script');
script.src='./recruiter-server-runtime.js?v=3.0.0';
script.async=false;
script.dataset.recruiterLiveRuntime='true';
document.body.appendChild(script);
})();
