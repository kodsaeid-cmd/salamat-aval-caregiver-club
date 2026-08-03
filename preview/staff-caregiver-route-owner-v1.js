(()=>{
'use strict';
if(window.__salamatStaffCaregiverRouteOwnerV1)return;
window.__salamatStaffCaregiverRouteOwnerV1=true;

const VERSION='1.0.0';
const MODULE_KEY='staff.caregivers';
const NAV_SELECTOR=`#sidebarNav [data-staff-module-key="${MODULE_KEY}"]`;
const CARD_SELECTOR=`[data-spx-open="${MODULE_KEY}"]`;
const CANONICAL_SELECTOR='[data-view="staff-caregiver-list"],[data-view="staff-caregiver-detail"]';
const LOADING_SELECTOR='[data-view="staff-caregiver-server-loading"]';
const RETRY_DELAYS=[0,30,70,140,260,480,800,1300,2100,3400];
let routeToken=0;
let repairing=false;
let patchedAccess=null;
let observer=null;
let lastClaim={target:null,at:0};

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const canonicalVisible=()=>Boolean($(CANONICAL_SELECTOR,$('#content')||document));
const loadingVisible=()=>Boolean($(LOADING_SELECTOR,$('#content')||document));
const navButton=()=>$(NAV_SELECTOR);
const caregiverSelected=()=>{
 const nav=navButton();
 return Boolean(nav&&(nav.classList.contains('active')||nav.getAttribute('aria-current')==='page'));
};

function markSelected(){
 const target=navButton();
 if(!target)return;
 $$('#sidebarNav [data-staff-module-key]').forEach(button=>{
  const active=button===target;
  button.classList.toggle('active',active);
  button.setAttribute('aria-current',active?'page':'false');
 });
}
function showServerLoading(reason){
 if(canonicalVisible()||loadingVisible())return;
 markSelected();
 const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
 if(title)title.textContent='پرونده مراقبین';
 if(subtitle)subtitle.textContent='فهرست زنده و متصل به دیتابیس';
 if(content)content.innerHTML=`<section class="module-page scv-route-loading" data-view="staff-caregiver-server-loading" data-module-key="${MODULE_KEY}" data-route-reason="${String(reason||'route')}"><div class="scv-route-spinner" aria-hidden="true"></div><strong>در حال دریافت فهرست به‌روز مراقبین…</strong><small>اطلاعات مستقیماً از دیتابیس بارگذاری می‌شود.</small></section>`;
}
function accessAllowed(){
 try{return window.SalamatAccessControl?.can?.(MODULE_KEY,'view')!==false}catch{return true}
}
async function openServerDirectory(reason='route'){
 const token=++routeToken;
 if(!accessAllowed())return false;
 markSelected();
 showServerLoading(reason);
 for(const delay of RETRY_DELAYS){
  if(token!==routeToken)return false;
  if(delay)await sleep(delay);
  if(token!==routeToken)return false;
  if(canonicalVisible())return true;
  const controller=window.SalamatStaffCaregivers;
  if(typeof controller?.openList==='function'){
   try{
    await controller.openList({force:true,source:'route-owner',reason});
   }catch(error){
    console.error('Server caregiver directory route failed',error);
   }
   await new Promise(resolve=>requestAnimationFrame(resolve));
   if(canonicalVisible()){
    window.dispatchEvent(new CustomEvent('salamat-caregiver-server-route-opened',{detail:{reason,version:VERSION}}));
    return true;
   }
  }
 }
 if(token===routeToken){
  const content=$('#content');
  if(content&&!canonicalVisible())content.innerHTML='<section class="module-page scv-route-loading error" data-view="staff-caregiver-server-loading"><strong>دریافت فهرست مراقبین انجام نشد.</strong><small>صفحه را تازه‌سازی کنید؛ نمای قدیمی محلی دیگر نمایش داده نمی‌شود.</small></section>';
 }
 return false;
}
function claim(event,reason){
 const target=event.target?.closest?.(`${NAV_SELECTOR},${CARD_SELECTOR}`);
 if(!target)return false;
 if('button'in event&&event.button!==0)return false;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 const now=performance.now();
 if(lastClaim.target===target&&now-lastClaim.at<260)return true;
 lastClaim={target,at:now};
 void openServerDirectory(reason);
 $('#sidebar')?.classList.remove('open');
 window.SalamatMobileShell?.close?.({restoreFocus:false});
 return true;
}
function onPointerDown(event){
 const target=event.target?.closest?.(`${NAV_SELECTOR},${CARD_SELECTOR}`);
 if(!target||('button'in event&&event.button!==0))return;
 markSelected();
 showServerLoading('pointerdown');
}
function onClick(event){claim(event,'click')}
function onKeyDown(event){
 if(!['Enter',' '].includes(event.key))return;
 claim(event,'keyboard');
}
function patchAccessRouter(){
 const access=window.SalamatAccessControl;
 if(!access||patchedAccess===access)return Boolean(patchedAccess);
 const original=access.openModule;
 if(typeof original!=='function')return false;
 if(original.__salamatCaregiverRouteOwnerV1){patchedAccess=access;return true}
 const wrapped=function(key){
  if(String(key)===MODULE_KEY){void openServerDirectory('access-router');return true}
  routeToken+=1;
  return original.apply(this,arguments);
 };
 wrapped.__salamatCaregiverRouteOwnerV1=true;
 wrapped.__base=original;
 access.openModule=wrapped;
 patchedAccess=access;
 return true;
}
function installRouterPatch(){
 let attempts=0;
 const run=()=>{
  attempts+=1;
  if(patchAccessRouter())return;
  if(attempts<300)requestAnimationFrame(run);
 };
 run();
}
function staleCaregiverView(){
 if(!caregiverSelected()||canonicalVisible()||loadingVisible())return false;
 const content=$('#content');
 if(!content)return false;
 const title=String($('#pageTitle')?.textContent||'');
 return title.includes('پرونده مراقب')||Boolean(content.children.length);
}
function repairStaleView(reason){
 if(repairing||!staleCaregiverView())return;
 repairing=true;
 requestAnimationFrame(()=>{
  repairing=false;
  if(staleCaregiverView())void openServerDirectory(reason);
 });
}
function observeContent(){
 observer?.disconnect();
 const content=$('#content');
 if(!content){requestAnimationFrame(observeContent);return}
 observer=new MutationObserver(()=>repairStaleView('legacy-view-replaced'));
 observer.observe(content,{childList:true,subtree:true});
}

document.addEventListener('pointerdown',onPointerDown,true);
document.addEventListener('click',onClick,true);
document.addEventListener('keydown',onKeyDown,true);
window.addEventListener('salamat-shell-ready',()=>{patchAccessRouter();repairStaleView('shell-ready')});
window.addEventListener('salamat-authenticated',()=>{installRouterPatch();repairStaleView('authenticated')});
window.addEventListener('salamat-history-restored',()=>{patchAccessRouter();repairStaleView('history')});
window.addEventListener('pageshow',()=>{patchAccessRouter();repairStaleView('pageshow')});

const style=document.createElement('style');
style.id='salamatStaffCaregiverRouteOwnerStylesV1';
style.textContent=`
.scv-route-loading{min-height:320px;display:grid;place-items:center;align-content:center;gap:11px;border:1px solid #dce8e2;border-radius:22px;background:#fbfdfc;color:#185b38;text-align:center}.scv-route-loading small{color:#6f7f77;font-size:10px}.scv-route-loading.error{color:#a52d3d;background:#fff8f9}.scv-route-spinner{width:30px;height:30px;border:3px solid #dcebe3;border-top-color:#078848;border-radius:50%;animation:scvRouteSpin .75s linear infinite}@keyframes scvRouteSpin{to{transform:rotate(360deg)}}
`;
(document.head||document.documentElement).appendChild(style);
installRouterPatch();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeContent,{once:true});else observeContent();
window.SalamatStaffCaregiverRouteOwner={version:VERSION,open:openServerDirectory,repair:repairStaleView,get canonical(){return canonicalVisible()}};
})();