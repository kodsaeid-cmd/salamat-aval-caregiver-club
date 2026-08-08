(()=>{
'use strict';
if(window.__salamatMobileFunctionalFixesV74)return;
window.__salamatMobileFunctionalFixesV74=true;

const VERSION='7.5.0';
const CTA_TEXT='همین حالا به شبکه مراقبین سلامت اول بپیوندید';
const MOBILE=window.matchMedia?.('(max-width:760px)')||{matches:false};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let trainingPatched=false;
let evaluationRepairFrame=0;
let prebootFrames=0;
let prebootReleaseFrame=0;
let ctaObserver=null;
let shellObserver=null;
let shellObserverRetireTimer=0;
let routeReleaseTimer=0;
let evaluationCommittedQuery='';
let evaluationRootNode=null;

const LEGACY_MOBILE_IDS=[
  'salamatCaregiverHeaderV5','salamatCaregiverBottomNavV5','salamatCaregiverDashboardV5',
  'salamatMobileAppHeader','salamatMobileBottomNav',
  'salamatUnifiedMobileHeaderV6','salamatUnifiedMobileNavV6','salamatUnifiedMobileDashboardV6',
  'salamatMobileRoleHeaderV7','salamatMobileRoleLauncherV7','salamatMobileRoleBottomNavV7'
];

function addStyles(){
  if($('#salamatMobileFunctionalFixesV75Styles'))return;
  const style=document.createElement('style');
  style.id='salamatMobileFunctionalFixesV75Styles';
  style.textContent=`
html body #loginView .join-network-block{margin:14px 0 0!important;padding:0!important}
html body #loginView .join-network-block>.join-network-action{width:100%!important;min-height:62px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;border:0!important;border-radius:17px!important;padding:13px 16px!important;background:linear-gradient(135deg,#087a45,#0b9658)!important;color:#fff!important;box-shadow:0 13px 28px rgba(8,122,69,.24)!important;text-align:center!important}
html body #loginView .join-network-block>.join-network-action strong{display:block!important;color:#fff!important;font-size:12.5px!important;font-weight:950!important;line-height:1.8!important;text-align:center!important}
html body #loginView .join-network-block>.join-network-action small,
html body.salamat-mobile-login-v5 #loginView .join-network-block>.join-network-action small,
html body #loginView .join-network-block>small{display:none!important}
@media(max-width:760px){
  #salamatCaregiverHeaderV5,#salamatCaregiverBottomNavV5,#salamatCaregiverDashboardV5,
  #salamatMobileAppHeader,#salamatMobileBottomNav,
  #salamatUnifiedMobileHeaderV6,#salamatUnifiedMobileNavV6,#salamatUnifiedMobileDashboardV6,
  #salamatMobileRoleHeaderV7,#salamatMobileRoleLauncherV7,#salamatMobileRoleBottomNavV7{
    display:none!important;visibility:hidden!important;pointer-events:none!important
  }
  html.salamat-mobile-route-pending-v75 #content{visibility:hidden!important;pointer-events:none!important}
  .sev4-root #sev4SearchForm,.sev4-root #sev4CareSearch,.sev4-root #sev4SearchForm button{pointer-events:auto!important;touch-action:manipulation!important}
  .sev4-root #sev4SearchForm{position:relative!important;z-index:5!important}
}`;
  (document.head||document.documentElement).appendChild(style);
}

function simplifyJoinCta(){
  const button=$('#openCaregiverRegistration');
  if(!button)return;
  let strong=$('strong',button);
  if(!strong){
    const textWrap=$('span:last-child',button)||document.createElement('span');
    if(!textWrap.isConnected)button.appendChild(textWrap);
    strong=document.createElement('strong');
    textWrap.prepend(strong);
  }
  if(strong.textContent!==CTA_TEXT)strong.textContent=CTA_TEXT;
  $$('small',button).forEach(node=>node.remove());
  const block=button.closest('.join-network-block');
  if(block){
    [...block.children].forEach(node=>{if(node!==button)node.remove()});
    block.dataset.salamatCtaSimplified=VERSION;
  }
  button.setAttribute('aria-label',CTA_TEXT);
}

function installCtaObserver(){
  const login=$('#loginView');
  if(!login||ctaObserver)return;
  ctaObserver=new MutationObserver(()=>queueMicrotask(simplifyJoinCta));
  ctaObserver.observe(login,{childList:true,subtree:true});
}
function retireCtaObserver(){ctaObserver?.disconnect();ctaObserver=null}

function removeSoundControl(){
  $$('#mc5SoundButton,.mc5-sound').forEach(node=>node.remove());
}

function cleanupLegacyMobileShells(){
  if(!MOBILE.matches)return;
  for(const id of LEGACY_MOBILE_IDS)$('#'+id)?.remove();
  document.documentElement.classList.remove('salamat-caregiver-dashboard-v5');
  document.body?.classList.remove('salamat-caregiver-dashboard-v5');
}

function installShellObserver(){
  const app=$('#appView');
  if(!app||shellObserver)return;
  shellObserver=new MutationObserver(records=>{
    if(!MOBILE.matches)return;
    let found=false;
    for(const record of records){
      for(const node of record.addedNodes||[]){
        if(!(node instanceof Element))continue;
        if(LEGACY_MOBILE_IDS.includes(node.id)||LEGACY_MOBILE_IDS.some(id=>node.querySelector?.('#'+id))){found=true;break}
      }
      if(found)break;
    }
    if(found)queueMicrotask(cleanupLegacyMobileShells);
  });
  shellObserver.observe(app,{childList:true,subtree:true});
}
function retireShellObserverWhenStable(){
  clearTimeout(shellObserverRetireTimer);
  shellObserverRetireTimer=setTimeout(()=>{
    if(!MOBILE.matches||!panelShellReady())return;
    cleanupLegacyMobileShells();
    shellObserver?.disconnect();
    shellObserver=null;
  },650);
}

function appVisible(){
  const app=$('#appView');
  return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden&&app.getAttribute('aria-hidden')!=='true');
}
function loginVisible(){
  const login=$('#loginView');
  return Boolean(login&&!login.classList.contains('hidden')&&!login.hidden&&login.getAttribute('aria-hidden')!=='true');
}
function loginShellReady(){
  if(!loginVisible())return true;
  return Boolean($('#salamatMobileLoginStageV5')&&document.body?.classList.contains('salamat-mobile-login-v5'));
}
function panelShellReady(){
  if(!appVisible())return true;
  const html=document.documentElement;
  if(!html.classList.contains('salamat-mobile-panel-v71'))return false;
  return Boolean($('#salamatMobileRoleLauncherV71')&&$('#salamatMobileRoleBottomNavV71'));
}
function mobileSurfaceReady(){
  if(!MOBILE.matches)return true;
  if(appVisible())return panelShellReady();
  if(loginVisible())return loginShellReady();
  return true;
}

function releasePrebootWhenReady(reset=false){
  if(prebootReleaseFrame)cancelAnimationFrame(prebootReleaseFrame);
  if(reset)prebootFrames=0;
  if(!MOBILE.matches){
    document.documentElement.classList.remove('salamat-mobile-preboot-v74');
    return;
  }
  prebootFrames+=1;
  if(mobileSurfaceReady()){
    cleanupLegacyMobileShells();
    document.documentElement.classList.remove('salamat-mobile-preboot-v74');
    document.documentElement.dataset.salamatMobileReady=VERSION;
    retireShellObserverWhenStable();
    window.dispatchEvent(new CustomEvent('salamat-mobile-v75-ready',{detail:{version:VERSION}}));
    return;
  }
  if(prebootFrames>=120){
    document.documentElement.classList.remove('salamat-mobile-preboot-v74');
    document.documentElement.dataset.salamatMobileFailOpen=VERSION;
    return;
  }
  prebootReleaseFrame=requestAnimationFrame(()=>releasePrebootWhenReady(false));
}

function beginRouteTransaction(){
  if(!MOBILE.matches||!appVisible())return;
  clearTimeout(routeReleaseTimer);
  document.documentElement.classList.add('salamat-mobile-route-pending-v75');
  routeReleaseTimer=setTimeout(endRouteTransaction,1100);
}
function endRouteTransaction(){
  clearTimeout(routeReleaseTimer);
  requestAnimationFrame(()=>{
    cleanupLegacyMobileShells();
    document.documentElement.classList.remove('salamat-mobile-route-pending-v75');
  });
}
function routePointerCapture(event){
  if(!MOBILE.matches)return;
  if(event.target?.closest?.('#salamatMobileRoleLauncherV71 .m71-module'))beginRouteTransaction();
  else{
    const navButton=event.target?.closest?.('#salamatMobileRoleBottomNavV71 button');
    if(navButton&&!navButton.classList.contains('m71-home')&&navButton.dataset.navKind!=='profile')beginRouteTransaction();
  }
}

function loadScript(file,version){
  return new Promise((resolve,reject)=>{
    const ready=()=>window.SalamatCaregiverTrainingRouteOwner?.open||window.SalamatCaregiverTrainingV3?.open;
    if(ready()){resolve(ready());return}
    const existing=[...document.scripts].find(script=>String(script.src||'').includes(`/${file}`));
    if(existing){
      const deadline=Date.now()+5000;
      const wait=()=>{const handler=ready();if(handler)resolve(handler);else if(Date.now()>deadline)reject(new Error('ماژول آموزش آماده نشد.'));else setTimeout(wait,70)};
      wait();return;
    }
    const script=document.createElement('script');
    script.src=`./${file}?v=${encodeURIComponent(version)}`;
    script.async=true;
    script.onload=()=>{const handler=ready();handler?resolve(handler):reject(new Error('ماژول آموزش پس از بارگذاری آماده نشد.'))};
    script.onerror=()=>reject(new Error('فایل ماژول آموزش دریافت نشد.'));
    document.head.appendChild(script);
  });
}

async function openCanonicalTraining(){
  const owner=window.SalamatCaregiverTrainingRouteOwner;
  if(typeof owner?.open==='function')return owner.open();
  const runtime=window.SalamatCaregiverTrainingV3;
  if(typeof runtime?.open==='function')return runtime.open();
  await loadScript('caregiver-training-route-owner-v3.js','3.0.0');
  if(typeof window.SalamatCaregiverTrainingRouteOwner?.open==='function')return window.SalamatCaregiverTrainingRouteOwner.open();
  if(typeof window.SalamatCaregiverTrainingV3?.open==='function')return window.SalamatCaregiverTrainingV3.open();
  throw new Error('ماژول مشاهده آموزش آماده نشد.');
}

function patchTrainingRoute(){
  if(trainingPatched)return true;
  const owner=window.SalamatCaregiverCanonicalRouteOwner;
  const current=owner?.openModule;
  if(typeof current!=='function')return false;
  if(current.__salamatTrainingV75){trainingPatched=true;return true}
  const wrapped=function(key){
    if(String(key)==='caregiver.training')return openCanonicalTraining().catch(error=>{
      console.error('Caregiver training V7.5 route failed',error);
      return current.apply(this,arguments);
    });
    return current.apply(this,arguments);
  };
  wrapped.__salamatTrainingV75=true;
  wrapped.__base=current;
  owner.openModule=wrapped;
  trainingPatched=true;
  return true;
}

function evaluationRoot(){return $('.sev4-root')}
function evaluationInput(){return $('#sev4CareSearch',evaluationRoot()||document)||$('[data-sev4-search]',evaluationRoot()||document)}
function evaluationForm(){return $('#sev4SearchForm',evaluationRoot()||document)||$('[data-sev4-search-form]',evaluationRoot()||document)}
function evaluationState(){return window.SalamatEvaluationModuleV4?.state||null}
function repairEvaluationInteractions(){
  const root=evaluationRoot();
  if(!root){evaluationRootNode=null;return}
  if(evaluationRootNode!==root){
    evaluationRootNode=root;
    evaluationCommittedQuery=String(evaluationState()?.query||'');
  }
  root.dataset.salamatMobileEvaluationFix=VERSION;
  const form=evaluationForm();
  const input=evaluationInput();
  if(form)form.dataset.sev4SearchForm='1';
  if(input){
    input.dataset.sev4Search='1';
    input.disabled=false;
    input.setAttribute('autocomplete','off');
    input.setAttribute('enterkeyhint','search');
    input.style.pointerEvents='auto';
    input.style.touchAction='manipulation';
  }
  const submit=form?.querySelector('button[type="submit"]');
  if(submit){submit.disabled=Boolean(evaluationState()?.directoryLoading);submit.style.pointerEvents='auto';submit.style.touchAction='manipulation'}
  $$('[data-sev4-caregiver]',root).forEach(card=>{
    card.style.pointerEvents='auto';
    card.style.touchAction='manipulation';
  });
}
function scheduleEvaluationRepair(){
  cancelAnimationFrame(evaluationRepairFrame);
  evaluationRepairFrame=requestAnimationFrame(repairEvaluationInteractions);
}
function evaluationSubmitOnlyGuard(event){
  if(!MOBILE.matches)return;
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='sev4CareSearch')return;
  const state=evaluationState();
  if(!state)return;
  clearTimeout(state.searchTimer);
  state.searchTimer=null;
  state.query=evaluationCommittedQuery;
}
function evaluationSubmitCapture(event){
  if(!MOBILE.matches)return;
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='sev4SearchForm')return;
  const input=form.querySelector('#sev4CareSearch');
  evaluationCommittedQuery=String(input?.value||'').trim();
  const state=evaluationState();
  if(state){clearTimeout(state.searchTimer);state.searchTimer=null}
}
function evaluationPointerFallback(event){
  if(!MOBILE.matches)return;
  const submit=event.target?.closest?.('#sev4SearchForm button[type="submit"]');
  if(submit){
    const form=submit.closest('form');
    const state=evaluationState();
    const sequence=Number(state?.requestSequence||0);
    setTimeout(()=>{
      const current=evaluationState();
      if(!form?.isConnected||Number(current?.requestSequence||0)!==sequence||current?.directoryLoading)return;
      try{form.requestSubmit?.(submit)}catch{}
    },120);
    return;
  }
  if(event.target?.closest?.('#sev4ClearSearch'))evaluationCommittedQuery='';
  const card=event.target?.closest?.('.sev4-root [data-sev4-caregiver]');
  if(!card)return;
  const id=String(card.dataset.sev4Caregiver||'');
  if(!id)return;
  setTimeout(()=>{
    const selected=String(window.SalamatEvaluationModuleV4?.state?.selectedCaregiverId||'');
    if(selected===id||!card.isConnected)return;
    HTMLElement.prototype.click.call(card);
  },150);
}
function evaluationSearchFallback(event){
  if(!MOBILE.matches)return;
  if(event.type!=='submit')return;
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='sev4SearchForm')return;
  evaluationCommittedQuery=String(form.querySelector('#sev4CareSearch')?.value||'').trim();
}
function evaluationKeyFallback(event){
  if(!MOBILE.matches||event.key!=='Enter')return;
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='sev4CareSearch')return;
  if(event.defaultPrevented)return;
  event.preventDefault();
  try{input.closest('#sev4SearchForm')?.requestSubmit?.()}catch{}
}

function syncStableUi(){
  addStyles();
  simplifyJoinCta();
  removeSoundControl();
  cleanupLegacyMobileShells();
  patchTrainingRoute();
  scheduleEvaluationRepair();
}

function onAuthenticated(){
  retireCtaObserver();
  if(MOBILE.matches){
    document.documentElement.classList.add('salamat-mobile-preboot-v74');
    beginRouteTransaction();
  }
  trainingPatched=false;
  evaluationRootNode=null;
  syncStableUi();
  releasePrebootWhenReady(true);
}

function boot(){
  syncStableUi();
  installCtaObserver();
  installShellObserver();
  releasePrebootWhenReady(true);

  document.addEventListener('pointerdown',routePointerCapture,true);
  document.addEventListener('pointerup',evaluationPointerFallback,true);
  document.addEventListener('input',evaluationSubmitOnlyGuard,false);
  document.addEventListener('submit',evaluationSubmitCapture,true);
  document.addEventListener('submit',evaluationSearchFallback,false);
  document.addEventListener('keydown',evaluationKeyFallback,false);
  window.addEventListener('salamat-authenticated',onAuthenticated);
  window.addEventListener('salamat-mobile-v71-route',()=>{scheduleEvaluationRepair();endRouteTransaction()});
  window.addEventListener('salamat-mobile-v71-home',endRouteTransaction);
  window.addEventListener('salamat-module-opened',scheduleEvaluationRepair);
  window.addEventListener('salamat-caregiver-training-route-owner-ready',()=>{trainingPatched=false;patchTrainingRoute()});
  window.addEventListener('pageshow',()=>{syncStableUi();if(appVisible())retireCtaObserver();releasePrebootWhenReady(true)});
  window.addEventListener('popstate',()=>{if(MOBILE.matches&&appVisible())beginRouteTransaction()});

  window.SalamatMobileFunctionalFixesV74={
    version:VERSION,
    sync:()=>{syncStableUi();repairEvaluationInteractions();releasePrebootWhenReady(true)},
    openTraining:openCanonicalTraining,
    cleanupLegacyShells:cleanupLegacyMobileShells,
  };
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();