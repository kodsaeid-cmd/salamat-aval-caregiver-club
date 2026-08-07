(()=>{
'use strict';
if(window.__salamatEvaluationSearchSubmitOwnerV1)return;
window.__salamatEvaluationSearchSubmitOwnerV1=true;

const VERSION='1.0.0';
const INPUT_ID='sev4CareSearch';
const FORM_ID='sev4SearchForm';
let draft='';
let observer=null;
let restoreQueued=false;

function input(){return document.getElementById(INPUT_ID)}
function isEvaluationInput(target){return target instanceof HTMLInputElement&&target.id===INPUT_ID}
function syncDraftFromDom(){const target=input();if(target)draft=String(target.value||'')}
function restoreDraft(){
  restoreQueued=false;
  const target=input();
  if(!target)return;
  if(document.activeElement===target&&String(target.value||'')!==draft)target.value=draft;
}
function queueRestore(){if(restoreQueued)return;restoreQueued=true;queueMicrotask(restoreDraft)}

/*
 * The canonical evaluation runtime listens for `input` on document capture and
 * historically starts a 380ms server search after every keystroke. Owning the
 * event one level earlier (window capture) keeps the real input value intact
 * while preventing that live-search listener from ever receiving typing events.
 * The runtime's existing form submit handler still reads the complete input
 * value and performs the search only after Search/Enter.
 */
window.addEventListener('input',event=>{
  if(!isEvaluationInput(event.target))return;
  draft=String(event.target.value||'');
  event.stopImmediatePropagation();
  event.stopPropagation();
},true);

window.addEventListener('focusin',event=>{
  if(!isEvaluationInput(event.target))return;
  draft=String(event.target.value||'');
},true);

window.addEventListener('submit',event=>{
  if(event.target?.id!==FORM_ID)return;
  syncDraftFromDom();
  /* Intentionally do not stop submit: V4 owns the explicit server search. */
},true);

window.addEventListener('click',event=>{
  if(event.target?.closest?.('#sev4ClearSearch'))draft='';
},true);

function observe(){
  observer?.disconnect();
  observer=new MutationObserver(queueRestore);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  syncDraftFromDom();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();

window.SalamatEvaluationSearchSubmitOwner={
  version:VERSION,
  get draft(){return draft},
  sync:syncDraftFromDom,
};
})();
