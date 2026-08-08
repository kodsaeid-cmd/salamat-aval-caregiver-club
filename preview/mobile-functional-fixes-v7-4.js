(()=>{
'use strict';
if(window.__salamatMobileFunctionalFixesV74)return;
window.__salamatMobileFunctionalFixesV74=true;

const VERSION='7.4.0';
const MOBILE=window.matchMedia?.('(max-width:760px)')||{matches:false};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let trainingPatched=false;
let evaluationRepairTimer=0;
let prebootFrames=0;

function simplifyJoinCta(){
  const button=$('#openCaregiverRegistration');
  if(!button)return;
  const strong=$('strong',button);
  if(strong)strong.textContent='همین حالا به شبکه مراقبین سلامت اول بپیوندید';
  $$('small',button).forEach(node=>node.remove());
  const block=button.closest('.join-network-block');
  if(block){
    [...block.children].forEach(node=>{if(node!==button)node.remove()});
    block.dataset.salamatCtaSimplified=VERSION;
  }
  button.setAttribute('aria-label','همین حالا به شبکه مراقبین سلامت اول بپیوندید');
}

function removeSoundControl(){
  $$('#mc5SoundButton,.mc5-sound').forEach(node=>node.remove());
}

function mobileShellReady(){
  if(!MOBILE.matches)return true;
  const html=document.documentElement;
  if(!html.classList.contains('salamat-mobile-panel-v71'))return false;
  return Boolean($('#salamatMobileRoleNavV71')||$('#salamatMobileRoleLauncherV71'));
}

function releasePrebootWhenReady(){
  if(!MOBILE.matches){document.documentElement.classList.remove('salamat-mobile-preboot-v74');return}
  prebootFrames+=1;
  if(mobileShellReady()){
    document.documentElement.classList.remove('salamat-mobile-preboot-v74');
    document.documentElement.dataset.salamatMobileReady=VERSION;
    window.dispatchEvent(new CustomEvent('salamat-mobile-v74-ready',{detail:{version:VERSION}}));
    return;
  }
  if(prebootFrames<900)requestAnimationFrame(releasePrebootWhenReady);
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
  if(current.__salamatTrainingV74){trainingPatched=true;return true}
  const wrapped=function(key){
    if(String(key)==='caregiver.training')return openCanonicalTraining().catch(error=>{
      console.error('Caregiver training V7.4 route failed',error);
      return current.apply(this,arguments);
    });
    return current.apply(this,arguments);
  };
  wrapped.__salamatTrainingV74=true;
  wrapped.__base=current;
  owner.openModule=wrapped;
  trainingPatched=true;
  return true;
}

function evaluationRoot(){return $('.sev4-root')}
function evaluationInput(){return $('[data-sev4-search]',evaluationRoot()||document)}
function repairEvaluationInteractions(){
  const root=evaluationRoot();
  if(!root)return;
  root.dataset.salamatMobileEvaluationFix=VERSION;
  const input=evaluationInput();
  if(input){
    input.disabled=false;
    input.setAttribute('autocomplete','off');
    input.setAttribute('enterkeyhint','search');
  }
  $$('[data-sev4-caregiver]',root).forEach(card=>{
    card.style.pointerEvents='auto';
    card.style.touchAction='manipulation';
  });
}

function scheduleEvaluationRepair(){
  clearTimeout(evaluationRepairTimer);
  evaluationRepairTimer=setTimeout(repairEvaluationInteractions,24);
}

function evaluationPointerFallback(event){
  if(!MOBILE.matches)return;
  const card=event.target?.closest?.('.sev4-root [data-sev4-caregiver]');
  if(!card)return;
  const id=String(card.dataset.sev4Caregiver||'');
  if(!id)return;
  setTimeout(()=>{
    const selected=String(window.SalamatEvaluationModuleV4?.state?.selectedCaregiverId||'');
    if(selected===id||!card.isConnected)return;
    HTMLElement.prototype.click.call(card);
  },180);
}

function evaluationSearchFallback(event){
  if(!MOBILE.matches)return;
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||!input.matches('.sev4-root [data-sev4-search]'))return;
  const value=String(input.value||'').trim();
  clearTimeout(input.__salamatV74Timer);
  input.__salamatV74Timer=setTimeout(()=>{
    const state=window.SalamatEvaluationModuleV4?.state;
    if(!state||String(state.query||'').trim()===value)return;
    const form=input.closest('[data-sev4-search-form]');
    try{form?.requestSubmit?.()}catch{}
  },650);
}

function evaluationKeyFallback(event){
  if(!MOBILE.matches||event.key!=='Enter')return;
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||!input.matches('.sev4-root [data-sev4-search]'))return;
  if(event.defaultPrevented)return;
  event.preventDefault();
  try{input.closest('[data-sev4-search-form]')?.requestSubmit?.()}catch{}
}

function boot(){
  simplifyJoinCta();
  removeSoundControl();
  patchTrainingRoute();
  releasePrebootWhenReady();
  scheduleEvaluationRepair();

  document.addEventListener('pointerup',evaluationPointerFallback,true);
  document.addEventListener('input',evaluationSearchFallback,false);
  document.addEventListener('keydown',evaluationKeyFallback,false);
  window.addEventListener('salamat-authenticated',()=>{trainingPatched=false;patchTrainingRoute();releasePrebootWhenReady()});
  window.addEventListener('salamat-module-opened',scheduleEvaluationRepair);
  window.addEventListener('salamat-caregiver-training-route-owner-ready',()=>{trainingPatched=false;patchTrainingRoute()});

  const observer=new MutationObserver(()=>{
    simplifyJoinCta();
    removeSoundControl();
    patchTrainingRoute();
    scheduleEvaluationRepair();
    if(document.documentElement.classList.contains('salamat-mobile-preboot-v74')&&mobileShellReady())releasePrebootWhenReady();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  window.SalamatMobileFunctionalFixesV74={
    version:VERSION,
    sync:()=>{simplifyJoinCta();removeSoundControl();patchTrainingRoute();repairEvaluationInteractions();releasePrebootWhenReady()},
    openTraining:openCanonicalTraining,
  };
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
