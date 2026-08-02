(()=>{
'use strict';
if(window.__salamatEvaluationModuleControllerV1)return;
window.__salamatEvaluationModuleControllerV1=true;

/* Retire all historical evaluation routers and recruiter-specific overrides. */
window.__salamatEvaluationModuleBootstrapV6=true;
window.__salamatEvaluationDirectoryPaginationFixV5=true;
window.__salamatEvaluationDirectoryPaginationFixV4=true;
window.__salamatEvaluationDirectoryPaginationFixV3=true;
window.__salamatEvaluationDirectoryPaginationFixV2=true;
window.__salamatEvaluationSearchCanonicalV1=true;
window.__salamatServerEvaluationRuntimeV2=true;
window.__salamatRecruiterLiveRuntimeLoaderV5=true;
window.__salamatRecruiterServerRuntimeV2=true;

const MODULE_KEY='staff.evaluations';
const EVALUATION_LABELS=['ارزیابی و پروانه','میزکار ارزیابی','ارزیابی و امتیازدهی'];
let runtimePromise=null;
let accessPromise=null;
let openToken=0;

function normalize(value){return String(value||'').replace(/\s+/g,' ').trim()}
function isEvaluationLabel(value){const text=normalize(value);return EVALUATION_LABELS.some(label=>text.includes(label))}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function markActive(target){
  document.querySelectorAll('#sidebarNav .nav-item,#sidebarNav button').forEach(button=>{
    const active=target?button===target:(button.dataset.staffModuleKey===MODULE_KEY||isEvaluationLabel(button.textContent));
    button.classList.toggle('active',active);
  });
}
async function accessSnapshot(){
  if(window.SalamatAccessControl?.can)return null;
  if(accessPromise)return accessPromise;
  accessPromise=fetch('/api/access/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})
    .then(async response=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||'دریافت سطح دسترسی انجام نشد.');
      return payload?.data||null;
    })
    .finally(()=>{accessPromise=null});
  return accessPromise;
}
async function canView(){
  if(window.SalamatAccessControl?.can)return Boolean(window.SalamatAccessControl.can(MODULE_KEY,'view'));
  const access=await accessSnapshot();
  return Boolean(access?.allModules?.find(module=>module.key===MODULE_KEY)?.actions?.view);
}
function loadRuntime(){
  if(window.SalamatEvaluationModuleV3)return Promise.resolve(window.SalamatEvaluationModuleV3);
  if(runtimePromise)return runtimePromise;
  runtimePromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-server-evaluation-runtime-v3]');
    if(existing){
      existing.addEventListener('load',()=>resolve(window.SalamatEvaluationModuleV3),{once:true});
      existing.addEventListener('error',()=>reject(new Error('بارگذاری ماژول ارزیابی انجام نشد.')),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='./server-evaluation-runtime-v3.js?v=1.0.0';
    script.async=true;
    script.dataset.serverEvaluationRuntimeV3='true';
    script.onload=()=>window.SalamatEvaluationModuleV3?resolve(window.SalamatEvaluationModuleV3):reject(new Error('ماژول ارزیابی آماده نشد.'));
    script.onerror=()=>reject(new Error('فایل ماژول ارزیابی دریافت نشد.'));
    document.head.appendChild(script);
  }).catch(error=>{runtimePromise=null;throw error});
  return runtimePromise;
}
async function open(target=null){
  const token=++openToken;
  try{
    if(!await canView()){
      notify('دسترسی محدود است','ماژول ارزیابی و پروانه برای این حساب فعال نشده است.');
      return;
    }
    if(token!==openToken)return;
    markActive(target);
    const runtime=await loadRuntime();
    if(token!==openToken)return;
    await runtime.open();
    document.querySelector('#sidebar')?.classList.remove('open');
  }catch(error){
    notify('بازکردن ارزیابی انجام نشد',error?.message||'خطای نامشخص');
  }
}
function close(){
  openToken+=1;
  try{window.SalamatEvaluationModuleV3?.close?.()}catch{}
}
function stop(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
function clickTarget(event){return event.target?.closest?.('[data-spx-open],#sidebarNav .nav-item,#sidebarNav button')||null}

/* Registered in <head>, before app.js and the staff platform runtime. */
window.addEventListener('click',event=>{
  const target=clickTarget(event);
  if(!target)return;
  const key=target.dataset?.spxOpen||target.dataset?.staffModuleKey||'';
  if(key===MODULE_KEY||isEvaluationLabel(target.textContent)){
    stop(event);
    void open(target.closest?.('#sidebarNav .nav-item,#sidebarNav button')||null);
    return;
  }
  if(target.closest?.('#sidebarNav')||target.dataset?.spxOpen)close();
},true);

function installRenderBridge(){
  const current=window.renderModule;
  if(typeof current!=='function'||current.__salamatEvaluationControllerV1)return Boolean(current?.__salamatEvaluationControllerV1);
  const wrapped=function(roleModel,module){
    if(isEvaluationLabel(Array.isArray(module)?module[1]:module)){
      void open();
      return;
    }
    close();
    return current.apply(this,arguments);
  };
  wrapped.__salamatEvaluationControllerV1=true;
  wrapped.__base=current;
  window.renderModule=wrapped;
  return true;
}
let attempts=0;
function waitForRender(){
  attempts+=1;
  if(installRenderBridge()||attempts>=180)return;
  requestAnimationFrame(waitForRender);
}
requestAnimationFrame(waitForRender);

window.SalamatEvaluationController={open,close,canView};
})();
