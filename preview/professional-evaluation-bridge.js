(()=>{
'use strict';
if(window.__salamatProfessionalEvaluationBridgeV2)return;
window.__salamatProfessionalEvaluationBridgeV2=true;

const bypass=new WeakSet();
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const UI_KEY='salamatAvalEvaluationUIV13';
const parse=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};
const text=value=>String(value??'').trim();

async function api(path){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path);
  const response=await fetch(path,{credentials:'same-origin'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.message||'دریافت اطلاعات ارزیابی انجام نشد.');
  return payload;
}

function projectedPeriod(period,detailed,backendId,membership){
  const indicators=Array.isArray(detailed?.indicators)?detailed.indicators:[];
  return {
    id:text(period.id),
    caregiverId:membership||backendId,
    backendCaregiverId:backendId,
    policyVersion:text(period.policyVersion),
    title:text(period.title)||'دوره ارزیابی',
    start:text(period.startDate),
    end:text(period.endDate),
    status:text(period.status)==='FINAL'?'نهایی':'پیش‌نویس',
    assessor:'کارشناس جذب و ارزیابی',
    reviewer:'مسئول ارزیابی',
    criteria:Object.fromEntries(indicators.map(indicator=>[text(indicator.code),{
      code:text(indicator.code),
      title:text(indicator.title),
      score:indicator.complete?indicator.score:null,
      liveScore:indicator.liveScore??null,
      status:indicator.complete?'تکمیل':Number(indicator.scoredCount||0)>0?'در حال تکمیل':'نیازمند بررسی تکمیلی',
      notes:`${Number(indicator.scoredCount||0)} از ${Number(indicator.criteriaCount||0)} معیار امتیازدهی شده`,
      evidence:[],
      updatedAt:text(period.updatedAt),
    }])),
    createdAt:text(period.createdAt),
    updatedAt:text(period.updatedAt),
    finalizedAt:text(period.finalizedAt),
    finalScore:text(period.status)==='FINAL'?(period.finalScore??null):(detailed?.calculatedFinalScore??detailed?.liveOverallScore??null),
  };
}

function applyEvaluationPayload(payload,backendId,membership){
  const data=payload?.data||{};
  const periods=Array.isArray(data.periods)?data.periods:[];
  const detailed=data.evaluation||null;
  const detailedId=text(detailed?.id);
  const projected=periods.map(period=>projectedPeriod(
    period,
    text(period.id)===detailedId?detailed:null,
    backendId,
    membership,
  ));
  const state=parse(localStorage.getItem(EVAL_KEY));
  const oldPeriods=Array.isArray(state.periods)?state.periods:[];
  const ids=new Set(projected.map(period=>text(period.id)));
  state.periods=[...projected,...oldPeriods.filter(period=>!ids.has(text(period?.id)))];
  state.serverBacked=true;
  localStorage.setItem(EVAL_KEY,JSON.stringify(state));
  return projected[0]||null;
}

async function prepare(row){
  const caregiverId=text(row.dataset.caregiverId);
  const membership=text(row.dataset.membership)||caregiverId;
  if(!caregiverId)throw new Error('شناسه پرونده مراقب پیدا نشد.');
  const query=new URLSearchParams({caregiverId});
  const payload=await api(`/api/evaluations?${query}`);
  const period=applyEvaluationPayload(payload,caregiverId,membership);
  const work=parse(localStorage.getItem(WORK_KEY));
  work.ui||={};
  work.ui.caregiverId=membership;
  if(period?.id)work.ui.periodId=period.id;
  localStorage.setItem(WORK_KEY,JSON.stringify(work));
  const ui=parse(localStorage.getItem(UI_KEY));
  ui.caregiverId=membership;
  if(period?.id)ui.periodId=period.id;
  localStorage.setItem(UI_KEY,JSON.stringify(ui));
  window.dispatchEvent(new CustomEvent('salamat-evaluation-changed',{detail:{caregiverId,evaluationId:period?.id||''}}));
}

document.addEventListener('click',event=>{
  const row=event.target?.closest?.('[data-caregiver-id][data-membership]');
  if(!row||bypass.has(row))return;
  if(!String(document.querySelector('#pageTitle')?.textContent||'').includes('پرونده مراقبین'))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void prepare(row).then(()=>{
    bypass.add(row);
    row.click();
    setTimeout(()=>bypass.delete(row),0);
  }).catch(error=>{
    try{window.toast?.('بازکردن کارنامه انجام نشد',error.message)}catch{alert(error.message)}
  });
},true);
})();
