(()=>{
'use strict';
if(window.__salamatEvaluationFinalizationRecoveryV1)return;
window.__salamatEvaluationFinalizationRecoveryV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
let finalizing=false;

function evaluationVisible(){
  const title=String($('#pageTitle')?.textContent||'').trim();
  return title.includes('ارزیابی و پروانه')||title.includes('میزکار ارزیابی');
}
function notify(title,text){
  try{window.toast?.(title,text)}catch{}
  if(!window.toast)alert(`${title}\n${text}`);
}
function errorText(error){
  return [error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:'',error?.detail?String(error.detail).slice(0,500):'']
    .filter(Boolean).join(' — ');
}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();
  let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){
    const error=new Error(payload.message||`خطای ${response.status}`);
    error.status=response.status;error.code=payload.error;error.detail=payload.detail;
    throw error;
  }
  return payload;
}
function evaluationId(){return String($('#sevPeriodSelect')?.value||'').trim()}
function caregiverId(){
  return String($('.sev-care.active')?.dataset.sevCaregiver||$('[data-sev-caregiver]')?.dataset.sevCaregiver||'').trim();
}
function criterionPayload(row){
  const code=String(row.dataset.sevCriterion||'').trim();
  const checked=$('input[type="radio"]:checked',row);
  if(!code||!checked)return null;
  return {
    criterionCode:code,
    score:Number(checked.value),
    note:String($('[data-note-for]',row)?.value||'').trim(),
  };
}
function collectIndicators(){
  return $$('[data-sev-indicator]').map(card=>{
    const code=String(card.dataset.sevIndicator||'').trim();
    const rows=$$('[data-sev-criterion]',card);
    const scores=rows.map(criterionPayload).filter(Boolean);
    return {card,code,rows,scores,complete:Boolean(code&&rows.length&&scores.length===rows.length)};
  }).filter(item=>item.code);
}
function revealIncomplete(item){
  $$('.sev-indicator').forEach(card=>card.classList.toggle('open',card===item.card));
  item.card.scrollIntoView({behavior:'smooth',block:'center'});
  let box=$('.sev-error',item.card);
  if(box){
    box.textContent=`${fa(item.rows.length-item.scores.length)} معیار این شاخص هنوز امتیاز ندارد.`;
    box.classList.add('show');
  }
}
function enhanceButton(){
  const button=$('#sevFinalize');
  if(!button||button.dataset.finalizationRecovery==='1')return;
  button.dataset.finalizationRecovery='1';
  button.disabled=false;
  button.textContent='ذخیره همه و ثبت نهایی ارزیابی';
  button.title='همه امتیازهای روی فرم ذخیره می‌شوند و سپس دوره نهایی خواهد شد.';
}
function setBusy(button,busy){
  if(!button)return;
  button.dataset.finalizing=busy?'1':'0';
  button.disabled=busy;
  button.textContent=busy?'در حال ذخیره و نهایی‌سازی...':'ذخیره همه و ثبت نهایی ارزیابی';
}
function evaluationNavButton(){
  return $$('#sidebarNav .nav-item,#sidebarNav button').find(button=>{
    const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
    return text.includes('ارزیابی و پروانه')||text.includes('میزکار ارزیابی');
  })||null;
}
async function refreshAfterFinalize(id,finalized){
  window.dispatchEvent(new CustomEvent('salamat-server-directory-refresh',{detail:{caregiverId:id}}));
  window.dispatchEvent(new CustomEvent('salamat-evaluation-changed',{detail:{caregiverId:id,evaluationId:evaluationId(),finalized:true}}));
  window.dispatchEvent(new CustomEvent('salamat-caregiver-profile-updated',{detail:{caregiverId:id,source:'evaluation-finalized'}}));
  try{
    const state=await api('/api/state');
    window.SalamatBackend?.applyState?.(state);
  }catch{}
  setTimeout(()=>evaluationNavButton()?.click(),80);
  const finalScore=finalized?.data?.evaluation?.finalScore;
  notify('ارزیابی نهایی شد',finalScore==null?'امتیاز نهایی در پرونده مراقب ثبت شد.':`امتیاز نهایی ${fa(finalScore)} در پرونده مراقب ثبت شد.`);
}
async function finalize(event,button){
  if(finalizing)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const periodId=evaluationId();
  const ownerId=caregiverId();
  if(!periodId||!ownerId){notify('اطلاعات دوره ناقص است','دوره یا مراقب انتخاب‌شده مشخص نیست.');return}
  const indicators=collectIndicators();
  const incomplete=indicators.find(item=>!item.complete);
  if(incomplete){
    revealIncomplete(incomplete);
    notify('ارزیابی هنوز کامل نیست','برای نهایی‌سازی باید تمام معیارهای هر هشت شاخص امتیاز داشته باشند.');
    return;
  }
  if(indicators.length!==8){notify('ساختار ارزیابی ناقص است','هر هشت شاخص ارزیابی باید روی فرم موجود باشند.');return}
  if(!confirm('همه امتیازهای فعلی ذخیره و دوره نهایی شود؟ پس از نهایی‌سازی امکان ویرایش امتیازها وجود ندارد.'))return;

  finalizing=true;setBusy(button,true);
  try{
    for(const indicator of indicators){
      await api(`/api/evaluations/${encodeURIComponent(periodId)}/indicators/${encodeURIComponent(indicator.code)}`,{
        method:'PUT',
        body:JSON.stringify({scores:indicator.scores}),
      });
    }
    const finalized=await api(`/api/evaluations/${encodeURIComponent(periodId)}/finalize`,{method:'POST'});
    const record=await api(`/api/admin/caregiver-record?id=${encodeURIComponent(ownerId)}`).catch(()=>null);
    const expected=Number(finalized?.data?.evaluation?.finalScore);
    const persisted=Number(record?.data?.professionalScore);
    if(Number.isFinite(expected)&&record&&(!Number.isFinite(persisted)||Math.abs(expected-persisted)>.01)){
      throw new Error('دوره نهایی شد اما کنترل ثبت امتیاز روی پرونده مراقب تأیید نشد.');
    }
    await refreshAfterFinalize(ownerId,finalized);
  }catch(error){
    notify('نهایی‌سازی انجام نشد',errorText(error));
    setBusy(button,false);
  }finally{
    finalizing=false;
  }
}
function capture(event){
  const button=event.target?.closest?.('#sevFinalize');
  if(!button||!evaluationVisible())return;
  void finalize(event,button);
}
function inspect(){
  if(!evaluationVisible())return;
  enhanceButton();
}
function boot(){
  document.addEventListener('click',capture,true);
  new MutationObserver(()=>setTimeout(inspect,10)).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('salamat-evaluation-changed',()=>setTimeout(inspect,20));
  inspect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
