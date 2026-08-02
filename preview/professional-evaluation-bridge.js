(()=>{
'use strict';
if(window.__salamatProfessionalEvaluationBridgeV3)return;
window.__salamatProfessionalEvaluationBridgeV3=true;
window.__salamatProfessionalEvaluationBridgeV2=true;
window.__salamatProfessionalEvaluationBridgeV1=true;

const bypass=new WeakSet();
const bypassNav=new WeakSet();
const pending=new Map();
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const UI_KEY='salamatAvalEvaluationUIV13';
const SESSION_KEY='salamatAvalSessionV1';
const RANKS=[
  {min:90,code:'R-1',title:'ممتاز',stars:5},
  {min:80,code:'R-2',title:'ارشد',stars:4},
  {min:70,code:'R-3',title:'حرفه‌ای',stars:3},
  {min:60,code:'R-4',title:'پایه',stars:2},
  {min:0,code:'R-5',title:'مشروط',stars:1},
];
const parse=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};
const text=value=>String(value??'').trim();
const upper=value=>text(value).toUpperCase();
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

function actualUser(){
  const backend=window.SalamatBackend?.getCurrentUser?.()||null;
  if(backend)return backend.actualRole?{...backend,role:backend.actualRole}:backend;
  const session=parse(localStorage.getItem(SESSION_KEY));
  return {
    role:upper(session.role),
    caregiverId:text(session.caregiverId),
  };
}
function isCaregiverUser(){return upper(actualUser()?.role)==='CAREGIVER'}
function notify(title,message){
  try{window.toast?.(title,message)}catch{}
  if(!window.toast)console.info(title,message);
}
function escapeSelector(value){return window.CSS?.escape?CSS.escape(String(value)):String(value).replace(/["\\]/g,'\\$&')}
function periodTimestamp(period){return text(period?.finalizedAt||period?.updatedAt||period?.createdAt)}
function newest(periods){return [...periods].sort((a,b)=>periodTimestamp(b).localeCompare(periodTimestamp(a)))[0]||null}
function canonicalSummary(periods){
  const rows=Array.isArray(periods)?periods:[];
  return newest(rows.filter(period=>upper(period?.status)==='FINAL'))||newest(rows);
}
function rankForScore(value){
  const score=Number(value);
  if(!Number.isFinite(score))return {code:'',title:'در انتظار تکمیل ارزیابی',stars:0};
  return RANKS.find(rank=>score>=rank.min)||RANKS[RANKS.length-1];
}

async function api(path){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path);
  const response=await fetch(path,{credentials:'same-origin'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.message||'دریافت اطلاعات ارزیابی انجام نشد.');
  return payload;
}

function projectedPeriod(period,detailed,backendId,membership){
  const indicators=Array.isArray(detailed?.indicators)?detailed.indicators:[];
  const isFinal=upper(period?.status)==='FINAL';
  return {
    id:text(period.id),
    caregiverId:membership||backendId,
    backendCaregiverId:backendId,
    policyVersion:text(period.policyVersion),
    title:text(period.title)||'دوره ارزیابی',
    start:text(period.startDate),
    end:text(period.endDate),
    status:isFinal?'نهایی':'پیش‌نویس',
    serverStatus:isFinal?'FINAL':'DRAFT',
    assessor:'کارشناس جذب و ارزیابی',
    reviewer:'مسئول ارزیابی',
    criteria:Object.fromEntries(indicators.map(indicator=>[text(indicator.code),{
      code:text(indicator.code),
      title:text(indicator.title),
      score:indicator.complete?(indicator.score??indicator.liveScore??null):null,
      liveScore:indicator.liveScore??null,
      status:indicator.complete?'تکمیل':Number(indicator.scoredCount||0)>0?'در حال تکمیل':'نیازمند بررسی تکمیلی',
      notes:`${Number(indicator.scoredCount||0)} از ${Number(indicator.criteriaCount||0)} معیار امتیازدهی شده`,
      evidence:[],
      updatedAt:text(period.updatedAt),
    }])),
    createdAt:text(period.createdAt),
    updatedAt:text(period.updatedAt),
    finalizedAt:text(period.finalizedAt),
    finalScore:isFinal?(period.finalScore??detailed?.finalScore??null):(detailed?.calculatedFinalScore??detailed?.liveOverallScore??null),
    serverBacked:true,
  };
}

async function canonicalPayload(caregiverId){
  const baseQuery=new URLSearchParams({caregiverId});
  let payload=await api(`/api/evaluations?${baseQuery}`);
  let data=payload?.data||{};
  const summary=canonicalSummary(data.periods);
  if(!summary)return {payload,data,summary:null};
  if(text(data.evaluation?.id)!==text(summary.id)){
    const detailedQuery=new URLSearchParams({caregiverId,evaluationId:text(summary.id)});
    payload=await api(`/api/evaluations?${detailedQuery}`);
    data=payload?.data||{};
  }
  return {payload,data,summary};
}

function periodBelongsTo(period,backendId,membership){
  const owner=text(period?.caregiverId);
  const backend=text(period?.backendCaregiverId);
  return Boolean(
    (backendId&&(owner===backendId||backend===backendId))||
    (membership&&(owner===membership||backend===membership))
  );
}
function findCaregiver(state,backendId,membership){
  const caregivers=Array.isArray(state.caregivers)?state.caregivers:[];
  return caregivers.find(item=>
    text(item?.backendId)===backendId||
    text(item?.id)===membership||
    text(item?.id)===backendId
  )||null;
}
function setSelections(membership,periodId){
  const work=parse(localStorage.getItem(WORK_KEY));
  work.ui||={};
  work.ui.caregiverId=membership;
  if(periodId)work.ui.periodId=periodId;
  localStorage.setItem(WORK_KEY,JSON.stringify(work));

  const ui=parse(localStorage.getItem(UI_KEY));
  ui.caregiverId=membership;
  if(periodId)ui.periodId=periodId;
  localStorage.setItem(UI_KEY,JSON.stringify(ui));
}
function applyEvaluationPayload(payload,backendId,membership,summary){
  const data=payload?.data||{};
  const periods=Array.isArray(data.periods)?data.periods:[];
  const detailed=data.evaluation||null;
  const canonicalId=text(summary?.id||detailed?.id);
  const detailedId=text(detailed?.id);
  const projected=periods.map(period=>projectedPeriod(
    period,
    text(period.id)===detailedId?detailed:null,
    backendId,
    membership,
  ));
  const canonical=projected.find(period=>period.id===canonicalId)||projected[0]||null;
  const ordered=[...projected.filter(period=>period.id!==canonical?.id),...(canonical?[canonical]:[])];

  const state=parse(localStorage.getItem(EVAL_KEY));
  state.caregivers=Array.isArray(state.caregivers)?state.caregivers:[];
  state.periods=Array.isArray(state.periods)?state.periods:[];
  state.periods=[
    ...state.periods.filter(period=>!periodBelongsTo(period,backendId,membership)),
    ...ordered,
  ];
  state.currentPeriodId=canonical?.id||'';
  state.currentFinalPeriodId=canonical?.serverStatus==='FINAL'?canonical.id:'';
  state.serverBacked=true;

  const caregiver=findCaregiver(state,backendId,membership);
  if(caregiver&&canonical?.serverStatus==='FINAL'){
    const score=Number(canonical.finalScore);
    const criteria=Object.values(canonical.criteria||{});
    const complete=criteria.length===8&&criteria.every(item=>Number.isFinite(Number(item?.score)));
    if(Number.isFinite(score)&&complete){
      const rank=rankForScore(score);
      caregiver.professionalScore=score;
      caregiver.professionalLevel=rank.title;
      caregiver.rank={
        ...(caregiver.rank||{}),
        code:rank.code,
        title:rank.title,
        stars:rank.stars,
        pri:score,
        performanceScore:score,
        calculatedFrom:'SERVER_FINAL',
      };
    }
  }
  localStorage.setItem(EVAL_KEY,JSON.stringify(state));
  setSelections(membership,canonical?.id||'');
  return canonical;
}

function contextFromState(preferredMembership=''){
  const state=parse(localStorage.getItem(EVAL_KEY));
  const caregivers=Array.isArray(state.caregivers)?state.caregivers:[];
  const work=parse(localStorage.getItem(WORK_KEY));
  const ui=parse(localStorage.getItem(UI_KEY));
  const user=actualUser();
  const selected=text(preferredMembership||work.ui?.caregiverId||ui.caregiverId);
  let caregiver=caregivers.find(item=>text(item?.id)===selected||text(item?.backendId)===selected)||null;
  if(!caregiver&&text(user?.caregiverId))caregiver=caregivers.find(item=>text(item?.backendId)===text(user.caregiverId)||text(item?.id)===text(user.caregiverId))||null;
  const backendId=text(caregiver?.backendId||user?.caregiverId||selected);
  const membership=text(caregiver?.id||selected||backendId);
  return backendId?{backendId,membership,caregiver}:null;
}

async function synchronize(backendId,membership){
  const key=`${backendId}|${membership}`;
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{
    const {payload,data,summary}=await canonicalPayload(backendId);
    if(!summary)return null;
    const canonical=applyEvaluationPayload({data},backendId,membership,summary);
    window.dispatchEvent(new CustomEvent('salamat-scorecard-synchronized',{detail:{caregiverId:backendId,membership,evaluationId:canonical?.id||'',source:'professional-evaluation-bridge'}}));
    return canonical;
  })().finally(()=>pending.delete(key));
  pending.set(key,task);
  return task;
}

async function prepareIdentifiers(backendId,membership){
  if(!backendId)throw new Error('شناسه پرونده مراقب پیدا نشد.');
  return synchronize(backendId,membership||backendId);
}
async function prepareRow(row){
  const backendId=text(row.dataset.caregiverId);
  const membership=text(row.dataset.membership)||backendId;
  return prepareIdentifiers(backendId,membership);
}
function isScorecardNavigation(button){
  const label=text(button?.textContent).replace(/\s+/g,' ');
  return label.includes('کارنامه')||label.includes('پرونده حرفه‌ای')||label.includes('پروفایل حرفه‌ای');
}
function currentScorecardVisible(){
  const title=text($('#pageTitle')?.textContent);
  return Boolean($('.p3-report'))||title.includes('کارنامه حرفه‌ای مراقب');
}
function activeScorecardButton(){
  const buttons=$$('#sidebarNav .nav-item,#sidebarNav button');
  return buttons.find(button=>button.classList.contains('active')&&isScorecardNavigation(button))||buttons.find(isScorecardNavigation)||null;
}
function replayNavigation(button,membership=''){
  if(!button)return;
  bypassNav.add(button);
  button.click();
  setTimeout(()=>{
    bypassNav.delete(button);
    if(!membership||isCaregiverUser())return;
    const row=$(`[data-professional-caregiver="${escapeSelector(membership)}"]`);
    row?.click();
  },140);
}

function capture(event){
  const directoryRow=event.target?.closest?.('[data-caregiver-id][data-membership]');
  if(directoryRow&&!bypass.has(directoryRow)&&text($('#pageTitle')?.textContent).includes('پرونده مراقبین')){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    void prepareRow(directoryRow).then(()=>{
      bypass.add(directoryRow);
      directoryRow.click();
      setTimeout(()=>bypass.delete(directoryRow),0);
    }).catch(error=>notify('بازکردن کارنامه انجام نشد',error.message));
    return;
  }

  const professionalRow=event.target?.closest?.('[data-professional-caregiver]');
  if(professionalRow&&!bypass.has(professionalRow)){
    const membership=text(professionalRow.dataset.professionalCaregiver);
    const context=contextFromState(membership);
    if(!context)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    void prepareIdentifiers(context.backendId,context.membership).then(()=>{
      bypass.add(professionalRow);
      professionalRow.click();
      setTimeout(()=>bypass.delete(professionalRow),0);
    }).catch(error=>notify('بازکردن کارنامه انجام نشد',error.message));
    return;
  }

  const nav=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(!nav||bypassNav.has(nav)||!isCaregiverUser()||!isScorecardNavigation(nav))return;
  const context=contextFromState();
  if(!context)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void prepareIdentifiers(context.backendId,context.membership).then(()=>replayNavigation(nav,context.membership)).catch(error=>notify('دریافت کارنامه انجام نشد',error.message));
}

async function refreshOpenScorecard(){
  if(!currentScorecardVisible())return;
  const context=contextFromState();
  if(!context)return;
  try{
    await prepareIdentifiers(context.backendId,context.membership);
    replayNavigation(activeScorecardButton(),context.membership);
  }catch(error){notify('به‌روزرسانی کارنامه انجام نشد',error.message)}
}
function handleEvaluationChange(event){
  if(event?.detail?.source==='professional-evaluation-bridge')return;
  const context=contextFromState();
  const backendId=text(event?.detail?.caregiverId||context?.backendId);
  if(!backendId)return;
  const membership=text(context?.membership||backendId);
  void prepareIdentifiers(backendId,membership).then(()=>{
    if(currentScorecardVisible())replayNavigation(activeScorecardButton(),membership);
  }).catch(()=>{});
}
function inspect(){
  if(!currentScorecardVisible())return;
  const report=$('.p3-report');
  if(!report||report.dataset.serverScorecardSync==='1')return;
  report.dataset.serverScorecardSync='1';
  void refreshOpenScorecard();
}
function boot(){
  document.addEventListener('click',capture,true);
  window.addEventListener('salamat-evaluation-changed',handleEvaluationChange);
  window.addEventListener('salamat-caregiver-profile-updated',handleEvaluationChange);
  new MutationObserver(()=>setTimeout(inspect,20)).observe(document.body,{childList:true,subtree:true});
  window.SalamatProfessionalEvaluationSync=async options=>{
    const context=contextFromState(text(options?.membership));
    const backendId=text(options?.caregiverId||context?.backendId);
    const membership=text(options?.membership||context?.membership||backendId);
    if(!backendId)throw new Error('شناسه مراقب برای همگام‌سازی کارنامه مشخص نیست.');
    const result=await prepareIdentifiers(backendId,membership);
    if(options?.refresh&&currentScorecardVisible())replayNavigation(activeScorecardButton(),membership);
    return result;
  };
  inspect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();