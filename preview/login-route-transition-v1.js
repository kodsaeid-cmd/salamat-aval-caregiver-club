(()=>{
'use strict';
if(window.__salamatLoginRouteTransitionV1)return;
window.__salamatLoginRouteTransitionV1=true;

const VERSION='1.0.0';
const PANEL_PATH='/panel';
const LOGIN_PATHS=new Set(['/','/index.html']);
const AUTH_PATHS=new Set(['/api/auth/login','/api/auth/verify-otp']);
const nativeFetch=window.fetch.bind(window);
let navigating=false;

function requestMeta(input,init){
  try{
    const request=input instanceof Request?input:null;
    const url=new URL(request?.url||String(input),location.href);
    const method=String(init?.method||request?.method||'GET').toUpperCase();
    return {pathname:url.pathname,method};
  }catch{return {pathname:'',method:''}}
}

window.fetch=async function salamatRouteAwareFetch(input,init){
  const meta=requestMeta(input,init);
  const response=await nativeFetch(input,init);
  if(!navigating&&response.ok&&meta.method==='POST'&&AUTH_PATHS.has(meta.pathname)){
    navigating=true;
    location.replace(PANEL_PATH);
    return new Promise(()=>{});
  }
  return response;
};

if(!LOGIN_PATHS.has(location.pathname))return;
window.SalamatLoginRouteTransition={version:VERSION,panelPath:PANEL_PATH,get navigating(){return navigating}};
})();
