(()=>{
'use strict';
if(window.__salamatProfessionalEvaluationBridgeV1)return;
window.__salamatProfessionalEvaluationBridgeV1=true;

const bypass=new WeakSet();
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const UI_KEY='salamatAvalEvaluationUIV13';
const parse=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};

async function api(path){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path);
  const response=await fetch(path,{credentials:'same-origin'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.message||'دریافت اطلاعات ارزیابی انجام نشد.');
  return payload;
}

function latestPeriod(state,backendId,membershipCode){
  const root=state?.data?.state||state?.state||{};
  const periods=Array.isArray(root?.evaluation?.periods)?root.evaluation.periods:[];
  return periods
    .filter(period=>String(period.backendCaregiverId||'')===String(backendId)||String(period.caregiverId||'')===String(membershipCode)||String(period.caregiverId||'')===String(backendId))
    .sort((a,b)=>String(b.createdAt||b.updatedAt||'').localeCompare(String(a.createdAt||a.updatedAt||'')))[0]||null;
}

async function prepare(row){
  const caregiverId=String(row.dataset.caregiverId||'');
  const membership=String(row.dataset.membership||caregiverId);
  const state=await api('/api/state');
  window.SalamatBackend?.applyState?.(state);
  const period=latestPeriod(state,caregiverId,membership);
  const work=parse(localStorage.getItem(WORK_KEY));work.ui||={};work.ui.caregiverId=membership;if(period?.id)work.ui.periodId=period.id;localStorage.setItem(WORK_KEY,JSON.stringify(work));
  const ui=parse(localStorage.getItem(UI_KEY));ui.caregiverId=membership;if(period?.id)ui.periodId=period.id;localStorage.setItem(UI_KEY,JSON.stringify(ui));
}

document.addEventListener('click',event=>{
  const row=event.target?.closest?.('[data-caregiver-id][data-membership]');
  if(!row||bypass.has(row))return;
  if(!String(document.querySelector('#pageTitle')?.textContent||'').includes('پرونده مراقبین'))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void prepare(row).then(()=>{bypass.add(row);row.click();setTimeout(()=>bypass.delete(row),0)}).catch(error=>{try{window.toast?.('بازکردن کارنامه انجام نشد',error.message)}catch{alert(error.message)}});
},true);
})();
