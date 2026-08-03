(()=>{
'use strict';
if(window.__salamatStaffCaregiverRouteOwnerV1)return;
window.__salamatStaffCaregiverRouteOwnerV1=true;

const VERSION='2.0.0';
const MODULE_KEY='staff.caregivers';
const NAV_SELECTOR=`#sidebarNav [data-staff-module-key="${MODULE_KEY}"]`;
const CARD_SELECTOR=`[data-spx-open="${MODULE_KEY}"]`;
const ANY_NAV_SELECTOR='#sidebarNav [data-staff-module-key],[data-spx-open]';
const DIRECTORY_SELECTOR='.cdp-root[data-view="staff-caregiver-list"]';
const DIRECTORY_READY_SELECTOR='.cdp-root[data-view="staff-caregiver-list"] .cdp-panel';
const SCORECARD_SELECTOR='.p3-report,[data-professional-caregiver]';
const OLD_REPLACEMENT_SELECTOR='.scv2-root,[data-view="staff-caregiver-detail"],[data-view="staff-caregiver-server-loading"]';
const RETRY_DELAYS=[0,25,60,120,220,380,650,1050,1700,2700];
let routeToken=0;
let routeActive=false;
let repairing=false;
let observer=null;
let patchedAccess=null;
let patchedRenderer=null;
let lastClaim={target:null,at:0};

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const labelOf=value=>String(Array.isArray(value)?value[1]:value?.label||value||'').trim();
const isCaregiverLabel=label=>['پرونده مراقبین','پرونده حرفه‌ای مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین','فعال سازی پرونده حرفه ای مراقبین'].includes(String(label||'').trim());
const directoryVisible=()=>Boolean($(DIRECTORY_SELECTOR,$('#content')||document));
const directoryReady=()=>Boolean($(DIRECTORY_READY_SELECTOR,$('#content')||document));
const scorecardVisible=()=>Boolean($(SCORECARD_SELECTOR,$('#content')||document));
const professionalTransition=()=>Boolean(window.__salamatOpeningProfessionalDetail||document.documentElement.dataset.caregiverScorecardOpening||scorecardVisible());
const navButton=()=>$(NAV_SELECTOR);
const accessAllowed=()=>{try{return window.SalamatAccessControl?.can?.(MODULE_KEY,'view')!==false}catch{return true}};

function markSelected(){
 const target=navButton();if(!target)return;
 $$('#sidebarNav [data-staff-module-key]').forEach(button=>{
  const active=button===target;
  button.classList.toggle('active',active);
  button.setAttribute('aria-current',active?'page':'false');
 });
}
function caregiverSelected(){
 const nav=navButton();
 return Boolean(nav&&(nav.classList.contains('active')||nav.getAttribute('aria-current')==='page'));
}
function releaseRoute(reason='other-module'){
 if(!routeActive&&document.documentElement.dataset.caregiverRouteOwned!=='true')return;
 routeActive=false;routeToken+=1;repairing=false;
 delete document.documentElement.dataset.caregiverRouteOwned;
 window.dispatchEvent(new CustomEvent('salamat-caregiver-route-released',{detail:{reason,version:VERSION}}));
}
function activateRoute(reason='route'){
 routeActive=true;
 document.documentElement.dataset.caregiverRouteOwned='true';
 markSelected();
 window.dispatchEvent(new CustomEvent('salamat-caregiver-route-claimed',{detail:{reason,version:VERSION}}));
}
function showOriginalLoading(){
 if(directoryVisible()||professionalTransition())return;
 const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
 if(title)title.textContent='پرونده مراقبین';
 if(subtitle)subtitle.textContent='نمایش صفحه‌بندی‌شده پرونده‌های حرفه‌ای';
 if(content)content.innerHTML=`<section class="module-page cdp-root" data-view="staff-caregiver-list" data-module-key="${MODULE_KEY}"><div class="cdp-loading">در حال دریافت ۵۰ پرونده از سرور...</div></section>`;
}
async function openOriginalDirectory(reason='route'){
 const token=++routeToken;
 if(!accessAllowed()){releaseRoute('forbidden');return false}
 activateRoute(reason);showOriginalLoading();
 for(const delay of RETRY_DELAYS){
  if(token!==routeToken||!routeActive)return false;
  if(delay)await sleep(delay);
  if(token!==routeToken||!routeActive)return false;
  if(directoryReady()&&!$(OLD_REPLACEMENT_SELECTOR,$('#content')||document))return true;
  const directory=window.SalamatCaregiverDirectoryPagination;
  if(typeof directory?.open==='function'){
   try{
    const opened=await directory.open({reset:true,reason:`route-owner:${reason}`,coalesce:false});
    if(token!==routeToken||!routeActive)return false;
    if(opened!==false&&directoryReady()){
     window.dispatchEvent(new CustomEvent('salamat-caregiver-original-route-opened',{detail:{reason,version:VERSION,server:true,design:'previous'}}));
     return true;
    }
   }catch(error){console.error('Original caregiver directory route failed',error)}
  }
 }
 if(token===routeToken&&routeActive&&!professionalTransition()){
  const content=$('#content');
  if(content)content.innerHTML=`<section class="module-page cdp-root" data-view="staff-caregiver-list" data-module-key="${MODULE_KEY}"><div class="cdp-empty">دریافت پرونده‌های مراقبین از سرور انجام نشد.</div></section>`;
 }
 return false;
}
function caregiverTarget(event){return event.target?.closest?.(`${NAV_SELECTOR},${CARD_SELECTOR}`)}
function otherModuleTarget(event){
 const target=event.target?.closest?.(ANY_NAV_SELECTOR);if(!target)return null;
 const key=target.dataset.staffModuleKey||target.dataset.spxOpen||'';
 return key&&key!==MODULE_KEY?target:null;
}
function claim(event,reason){
 const target=caregiverTarget(event);if(!target)return false;
 if('button'in event&&event.button!==0)return false;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const now=performance.now();
 if(lastClaim.target===target&&now-lastClaim.at<260)return true;
 lastClaim={target,at:now};
 void openOriginalDirectory(reason);
 $('#sidebar')?.classList.remove('open');
 window.SalamatMobileShell?.close?.({restoreFocus:false});
 return true;
}
function onPointerDown(event){
 if(otherModuleTarget(event)){releaseRoute('pointer-other-module');return}
 const target=caregiverTarget(event);if(!target||('button'in event&&event.button!==0))return;
 activateRoute('pointerdown');showOriginalLoading();
}
function onClick(event){
 if(otherModuleTarget(event)){releaseRoute('click-other-module');return}
 claim(event,'click');
}
function onKeyDown(event){
 if(!['Enter',' '].includes(event.key))return;
 if(otherModuleTarget(event)){releaseRoute('keyboard-other-module');return}
 claim(event,'keyboard');
}
function patchAccessRouter(){
 const access=window.SalamatAccessControl;if(!access)return false;
 const current=access.openModule;if(typeof current!=='function')return false;
 if(current.__salamatCaregiverOriginalRouteV2){patchedAccess=access;return true}
 const wrapped=function(key){
  if(String(key)===MODULE_KEY){void openOriginalDirectory('access-router');return true}
  releaseRoute(`access-router:${String(key||'unknown')}`);
  return current.apply(this,arguments);
 };
 wrapped.__salamatCaregiverOriginalRouteV2=true;wrapped.__base=current;
 access.openModule=wrapped;patchedAccess=access;return true;
}
function patchRenderModule(){
 const current=window.renderModule;if(typeof current!=='function')return false;
 if(current.__salamatCaregiverOriginalRenderV2){patchedRenderer=current;return true}
 const wrapped=function(model,module){
  const label=labelOf(module);
  if(!professionalTransition()&&isCaregiverLabel(label)){void openOriginalDirectory('render-module');return}
  if(!isCaregiverLabel(label))releaseRoute(`render-module:${label||'other'}`);
  return current.apply(this,arguments);
 };
 wrapped.__salamatCaregiverOriginalRenderV2=true;wrapped.__base=current;
 window.renderModule=wrapped;try{renderModule=wrapped}catch{}
 patchedRenderer=wrapped;return true;
}
function installPatches(){
 let attempts=0;
 const run=()=>{
  attempts+=1;patchAccessRouter();patchRenderModule();
  if((!patchedAccess||!patchedRenderer)&&attempts<300)requestAnimationFrame(run);
 };
 run();
}
function canonicalVisible(){return directoryVisible()||professionalTransition()}
function staleCaregiverView(){
 if(!routeActive||canonicalVisible())return false;
 const content=$('#content');if(!content)return false;
 return Boolean($(OLD_REPLACEMENT_SELECTOR,content)||content.children.length);
}
function repairStaleView(reason){
 if(!routeActive)return;
 if(!caregiverSelected()&&!directoryVisible()&&!professionalTransition()){releaseRoute('active-module-changed');return}
 if(repairing||professionalTransition()||!staleCaregiverView())return;
 repairing=true;
 requestAnimationFrame(()=>{
  repairing=false;
  if(routeActive&&!professionalTransition()&&staleCaregiverView())void openOriginalDirectory(reason);
 });
}
function observeContent(){
 observer?.disconnect();const content=$('#content');
 if(!content){requestAnimationFrame(observeContent);return}
 observer=new MutationObserver(()=>repairStaleView('late-render-replaced'));
 observer.observe(content,{childList:true,subtree:true});
}
function reconcileFromUi(reason){
 requestAnimationFrame(()=>{
  if(caregiverSelected()||directoryVisible()||scorecardVisible()){
   routeActive=true;document.documentElement.dataset.caregiverRouteOwned='true';repairStaleView(reason);
  }else releaseRoute(reason);
 });
}

document.addEventListener('pointerdown',onPointerDown,true);
document.addEventListener('click',onClick,true);
document.addEventListener('keydown',onKeyDown,true);
window.addEventListener('salamat-shell-ready',()=>{installPatches();reconcileFromUi('shell-ready')});
window.addEventListener('salamat-authenticated',()=>{installPatches();reconcileFromUi('authenticated')});
window.addEventListener('salamat-history-restored',()=>{installPatches();reconcileFromUi('history')});
window.addEventListener('pageshow',()=>{installPatches();reconcileFromUi('pageshow')});
window.addEventListener('salamat-caregiver-directory-ready',installPatches);
window.addEventListener('salamat-caregiver-directory-rendered',()=>{routeActive=true;document.documentElement.dataset.caregiverRouteOwned='true'});
window.addEventListener('salamat-caregiver-scorecard-opened',()=>{routeActive=true;document.documentElement.dataset.caregiverRouteOwned='true'});

installPatches();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeContent,{once:true});else observeContent();
window.SalamatStaffCaregiverRouteOwner={version:VERSION,open:openOriginalDirectory,release:releaseRoute,repair:repairStaleView,get active(){return routeActive},get directory(){return directoryReady()},get scorecard(){return scorecardVisible()}};
})();