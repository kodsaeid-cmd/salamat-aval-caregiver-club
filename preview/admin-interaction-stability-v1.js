(()=>{
'use strict';
if(window.__salamatAdminInteractionStabilityV1)return;
window.__salamatAdminInteractionStabilityV1=true;

const VERSION='1.0.0';
const PANEL_PATH='/panel';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
let evalDraft='';
let observer=null;
let repairTimer=0;
let repairAttempts=0;

function onPanel(){return location.pathname===PANEL_PATH||location.pathname===`${PANEL_PATH}/`}
function addStyles(){
  if($('#salamatAdminInteractionStabilityStylesV1'))return;
  const style=document.createElement('style');
  style.id='salamatAdminInteractionStabilityStylesV1';
  style.textContent=`
  .evc-search-row #sevCareSearch,.evc-search-row #evcSearchButton,.evc-search-row #evcClearButton,.evp-search-row #sevCareSearch,.evp-search-row #evpSearchButton,.evp-search-row #evpClearSearch{display:none!important}
  .salamat-submit-search-input{width:100%;box-sizing:border-box;border:1px solid #d9e5df;border-radius:12px;padding:11px 12px;font:inherit;font-size:10px;outline:none;background:#fff}
  .salamat-submit-search-input:focus{border-color:#14935a;box-shadow:0 0 0 3px #e4f5eb}
  .salamat-submit-search-btn{border:0;border-radius:11px;padding:10px 14px;background:#078848;color:#fff;font:inherit;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}
  .salamat-submit-search-btn.secondary{background:#edf8f2;color:#08743f}
  .salamat-eval-submit-search{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;grid-column:1/-1;width:100%}
  .sct-search.salamat-contract-submit-search{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important}
  html.salamat-admin-entry-guard #appView{visibility:hidden!important}
  #salamatAdminEntryGuard{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;background:linear-gradient(135deg,#f5faf7,#fff);font-family:Vazirmatn,Tahoma,Arial,sans-serif;color:#08743f}
  #salamatAdminEntryGuard>div{display:grid;justify-items:center;gap:13px;text-align:center;padding:24px}
  #salamatAdminEntryGuard span{width:38px;height:38px;border:4px solid #dceee4;border-top-color:#08743f;border-radius:50%;animation:salamatAdminEntrySpin .8s linear infinite}
  #salamatAdminEntryGuard strong{font-size:12px}
  #salamatAdminEntryGuard small{color:#6e8177;font-size:9px}
  @keyframes salamatAdminEntrySpin{to{transform:rotate(360deg)}}
  @media(max-width:700px){.salamat-eval-submit-search{grid-template-columns:1fr 1fr}.salamat-eval-submit-search .salamat-submit-search-input{grid-column:1/-1}.sct-search.salamat-contract-submit-search{grid-template-columns:1fr auto!important}}
  `;
  (document.head||document.documentElement).appendChild(style);
}

function evaluationVisible(){
  const title=normalize($('#pageTitle')?.textContent);
  return title.includes('ارزیابی و پروانه')||title.includes('میزکار ارزیابی')||Boolean($('.sev-root,.sev4-root'));
}
function installEvaluationSubmitSearch(){
  if(!evaluationVisible())return;
  const original=$('#sevCareSearch');
  if(!original)return;
  const row=original.closest('.evc-search-row,.evp-search-row')||original.parentElement;
  if(!row||row.querySelector('#salamatEvalSearchDraft'))return;
  const committed=String(window.SalamatEvaluationSearch?.state?.query??original.value??'');
  if(!evalDraft)evalDraft=committed;
  const box=document.createElement('div');
  box.className='salamat-eval-submit-search';
  box.innerHTML=`<input id="salamatEvalSearchDraft" class="salamat-submit-search-input" autocomplete="off" placeholder="نام، کد ملی، موبایل یا کد عضویت را کامل وارد کنید"><button id="salamatEvalSearchSubmit" type="button" class="salamat-submit-search-btn">جست‌وجو</button><button id="salamatEvalSearchClear" type="button" class="salamat-submit-search-btn secondary">پاک‌کردن</button>`;
  row.prepend(box);
  const draft=$('#salamatEvalSearchDraft',box);
  if(draft)draft.value=evalDraft||committed;
  draft?.addEventListener('input',()=>{evalDraft=draft.value});
  const submit=()=>{
    evalDraft=String(draft?.value||'');
    original.value=evalDraft;
    const api=window.SalamatEvaluationSearch;
    if(typeof api?.search==='function')void api.search(evalDraft);
    else{
      const fallback=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});
      original.dispatchEvent(fallback);
    }
  };
  draft?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submit()}});
  $('#salamatEvalSearchSubmit',box)?.addEventListener('click',submit);
  $('#salamatEvalSearchClear',box)?.addEventListener('click',()=>{
    evalDraft='';if(draft)draft.value='';original.value='';
    const api=window.SalamatEvaluationSearch;
    if(typeof api?.search==='function')void api.search('');
  });
}

function allowSubmittedContractEvent(event){return Boolean(event&&event.__salamatSubmitSearch===true)}
function guardContractLiveInput(event){
  const target=event.target;
  if(!(target instanceof HTMLInputElement)||target.id!=='sctCaregiverSearch'||allowSubmittedContractEvent(event))return;
  event.stopImmediatePropagation();
  event.stopPropagation();
}
function submitContractSearch(input=$('#sctCaregiverSearch')){
  if(!input)return;
  const event=new Event('input',{bubbles:true,cancelable:false});
  try{Object.defineProperty(event,'__salamatSubmitSearch',{value:true})}catch{event.__salamatSubmitSearch=true}
  input.dispatchEvent(event);
}
function installContractSubmitSearch(){
  const input=$('#sctCaregiverSearch');
  if(!input)return;
  const row=input.closest('.sct-search');
  if(!row)return;
  row.classList.add('salamat-contract-submit-search');
  if(!$('#sctSubmitSearch',row)){
    const button=document.createElement('button');
    button.id='sctSubmitSearch';button.type='button';button.className='salamat-submit-search-btn';button.textContent='جست‌وجو';
    button.addEventListener('click',()=>submitContractSearch(input));
    row.appendChild(button);
  }
}
function captureContractEnter(event){
  if(event.target?.id!=='sctCaregiverSearch'||event.key!=='Enter')return;
  event.preventDefault();
  event.stopPropagation();
  submitContractSearch(event.target);
}

function appVisible(){const app=$('#appView');return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden)}
function legacyAdminDashboard(){
  if(!appVisible())return false;
  const content=$('#content');if(!content||!$('.role-hero',content))return false;
  const title=normalize($('#pageTitle')?.textContent);
  const heading=normalize($('#content h2')?.textContent);
  const role=normalize($('#sidebarRole')?.textContent);
  return title.includes('داشبورد مدیر سامانه')||heading.includes('مرکز فرمان باشگاه')||heading.includes('مدیریت یکپارچه باشگاه مراقبین')||role==='مدیر سامانه';
}
function canonicalAdminDashboard(){return Boolean($('#content .spx-dashboard')||$('#content .spx-root[data-module-key="staff.dashboard"]'))}
function ensureEntryGuard(){
  document.documentElement.classList.add('salamat-admin-entry-guard');
  if($('#salamatAdminEntryGuard'))return;
  const guard=document.createElement('div');guard.id='salamatAdminEntryGuard';guard.setAttribute('role','status');guard.setAttribute('aria-live','polite');
  guard.innerHTML='<div><span></span><strong>در حال آماده‌سازی داشبورد مدیریتی…</strong><small>دسترسی‌ها و ماژول‌های حساب شما در حال بارگذاری است.</small></div>';
  document.body.appendChild(guard);
}
function releaseEntryGuard(){
  document.documentElement.classList.remove('salamat-admin-entry-guard');
  $('#salamatAdminEntryGuard')?.remove();
  clearTimeout(repairTimer);repairTimer=0;repairAttempts=0;
}
function requestCanonicalDashboard(){
  clearTimeout(repairTimer);repairTimer=0;
  repairAttempts+=1;
  try{
    const access=window.SalamatAccessControl;
    if(typeof access?.openModule==='function'&&access.can?.('staff.dashboard','view')!==false){
      access.openModule('staff.dashboard');
    }else if(typeof window.SalamatStaffDashboardEntry?.repair==='function'){
      window.SalamatStaffDashboardEntry.repair('first-login-legacy-guard');
    }
  }catch{}
  if(!canonicalAdminDashboard()&&repairAttempts<80)repairTimer=setTimeout(requestCanonicalDashboard,100);
  else if(!canonicalAdminDashboard())repairAttempts=0;
}
function inspectEntry(){
  if(canonicalAdminDashboard()){releaseEntryGuard();return}
  if(legacyAdminDashboard()){
    ensureEntryGuard();
    if(!repairTimer)requestCanonicalDashboard();
  }
}
function inspect(){installEvaluationSubmitSearch();installContractSubmitSearch();inspectEntry()}
function boot(){
  if(!onPanel())return;
  addStyles();
  window.addEventListener('input',guardContractLiveInput,true);
  window.addEventListener('keydown',captureContractEnter,true);
  observer=new MutationObserver(()=>queueMicrotask(inspect));
  observer.observe(document.body,{childList:true,subtree:true});
  for(const name of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-staff-dashboard-entry-fixed'])window.addEventListener(name,()=>queueMicrotask(inspect));
  inspect();
  window.SalamatAdminInteractionStability={version:VERSION,inspect,submitContractSearch,get evaluationDraft(){return evalDraft}};
}

if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
