(()=>{
'use strict';
if(window.__salamatStaffFinancialCreditsRuntimeV2)return;
window.__salamatStaffFinancialCreditsRuntimeV2=true;

const VERSION='2.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const money=value=>`${fa(value)} تومان`;
const pdate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return String(value)}};
const statusText=value=>({REQUESTED:'در انتظار بررسی',UNDER_REVIEW:'در حال بررسی',APPROVED:'تأییدشده',REJECTED:'ردشده',PAID:'پرداخت‌شده',CANCELLED:'لغوشده'}[String(value||'').toUpperCase()]||String(value||'—'));
const state={access:null,data:null,tab:'overview',selectedCaregiver:null,caregivers:[],loading:false};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;throw error}
  return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function access(){return state.access?.allModules?.find(module=>module.key==='staff.financial_credits')?.actions||{}}
function can(action){return Boolean(access()[action])}
function setPage(html){
  const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
  if(title)title.textContent='اعتبارات مالی';
  if(subtitle)subtitle.textContent='پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار';
  if(content)content.innerHTML=`<section class="module-page sfc2-root">${html}</section>`;
}
function addStyles(){
  if($('#staffFinancialCreditsStylesV2'))return;
  const style=document.createElement('style');style.id='staffFinancialCreditsStylesV2';style.textContent=`
.sfc2-root{direction:rtl;display:grid;gap:14px}.sfc2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.sfc2-head h2{margin:0;font-size:21px}.sfc2-head p{margin:6px 0 0;color:#728078;font-size:10px}.sfc2-tabs,.sfc2-actions{display:flex;gap:7px;flex-wrap:wrap}.sfc2-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.sfc2-btn.primary,.sfc2-btn.active{background:#078848;color:#fff}.sfc2-btn.danger{background:#ffe9ec;color:#ad2940}.sfc2-btn.warn{background:#fff1da;color:#8d6108}.sfc2-btn:disabled{opacity:.45;pointer-events:none}.sfc2-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sfc2-kpi,.sfc2-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 10px 28px rgba(22,70,46,.04)}.sfc2-kpi{padding:15px}.sfc2-kpi small{display:block;color:#77867e;font-size:8px}.sfc2-kpi strong{display:block;margin-top:8px;color:#087a45;font-size:20px}.sfc2-card{overflow:hidden}.sfc2-card-head{padding:14px 16px;border-bottom:1px solid #eaf0ed;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.sfc2-card-head h3{margin:0;font-size:14px}.sfc2-card-head p{margin:5px 0 0;color:#7a8981;font-size:8px}.sfc2-card-body{padding:14px}.sfc2-list{display:grid;gap:8px}.sfc2-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #e0eae5;border-radius:14px}.sfc2-row strong{display:block;font-size:10px}.sfc2-row small{display:block;margin-top:5px;color:#7a8981;font-size:8px;line-height:1.8}.sfc2-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:7px;font-weight:900}.sfc2-empty{padding:36px;text-align:center;border:1px dashed #cfddd6;border-radius:16px;color:#6d7b74;background:#fbfdfc}.sfc2-grid{display:grid;grid-template-columns:minmax(280px,.7fr) minmax(0,1.3fr);gap:12px;align-items:start}.sfc2-input,.sfc2-textarea{width:100%;box-sizing:border-box;border:1px solid #d7e3dd;border-radius:11px;padding:10px;font:inherit;font-size:9px;outline:none}.sfc2-textarea{min-height:82px;resize:vertical}.sfc2-field{display:grid;gap:5px}.sfc2-field span{font-size:8px;font-weight:900;color:#40564a}.sfc2-form{display:grid;gap:9px}.sfc2-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.sfc2-caregiver{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border:1px solid #e0eae5;border-radius:13px;background:#fff;padding:10px;text-align:right;cursor:pointer}.sfc2-caregiver.active{border-color:#0b9254;background:#f0faf5}.sfc2-note{padding:11px 12px;border-radius:12px;background:#f3f9f6;color:#607269;font-size:8px;line-height:1.9}@media(max-width:900px){.sfc2-kpis,.sfc2-grid{grid-template-columns:1fr}}
`;document.head.appendChild(style);
}
function tabs(){return `<div class="sfc2-tabs">${[['overview','نمای کلی'],['settlements','تسویه کیف پول'],['credits','درخواست اعتبار'],['rewards','تخصیص پاداش']].map(([key,label])=>`<button class="sfc2-btn ${state.tab===key?'active':''}" data-sfc2-tab="${key}">${label}</button>`).join('')}</div>`}
function overview(){
  const s=state.data?.summary||{};
  const recent=[...(state.data?.settlements||[]).slice(0,4).map(item=>({...item,kind:'تسویه',amount:item.amountToman})),...(state.data?.creditRequests||[]).slice(0,4).map(item=>({...item,kind:'اعتبار',amount:item.requestedAmountToman}))].slice(0,6);
  return `<section class="sfc2-kpis"><article class="sfc2-kpi"><small>درخواست تسویه جدید</small><strong>${fa(s.settlementRequested||0)}</strong></article><article class="sfc2-kpi"><small>درخواست اعتبار باز</small><strong>${fa(s.creditRequested||0)}</strong></article><article class="sfc2-kpi"><small>کل اعتبار تخصیص‌یافته</small><strong style="font-size:15px">${money(s.totalCredits||0)}</strong></article></section><article class="sfc2-card"><header class="sfc2-card-head"><div><h3>آخرین درخواست‌ها</h3><p>حقوق و فیش حقوقی در ماژول مستقل «حقوق و پرداخت» مدیریت می‌شود.</p></div></header><div class="sfc2-card-body"><div class="sfc2-list">${recent.length?recent.map(item=>`<div class="sfc2-row"><div><strong>${esc(item.caregiverName)} • ${item.kind}</strong><small>${money(item.amount)} • ${pdate(item.createdAt)}</small></div><span class="sfc2-badge">${statusText(item.status)}</span></div>`).join(''):'<div class="sfc2-empty">درخواست مالی بازی ثبت نشده است.</div>'}</div></div></article>`;
}
function settlements(){
  const rows=state.data?.settlements||[];
  return `<article class="sfc2-card"><header class="sfc2-card-head"><div><h3>درخواست‌های تسویه کیف پول</h3><p>تأیید، رد و ثبت شماره پیگیری واریز.</p></div></header><div class="sfc2-card-body"><div class="sfc2-list">${rows.length?rows.map(item=>`<div class="sfc2-row"><div><strong>${esc(item.caregiverName)} • ${money(item.amountToman)}</strong><small>${esc(item.membershipCode||'')} • ${esc(item.accountHolderName||'')} • ${esc(item.iban||item.accountNumber||'')}<br>${pdate(item.createdAt)}</small></div><div class="sfc2-actions"><span class="sfc2-badge">${statusText(item.status)}</span>${can('update')&&item.status==='REQUESTED'?`<button class="sfc2-btn primary" data-sfc2-settlement="${item.id}" data-decision="APPROVED">تأیید</button><button class="sfc2-btn danger" data-sfc2-settlement="${item.id}" data-decision="REJECTED">رد</button>`:''}${can('update')&&item.status==='APPROVED'?`<button class="sfc2-btn primary" data-sfc2-settlement="${item.id}" data-decision="PAID">ثبت واریز</button>`:''}</div></div>`).join(''):'<div class="sfc2-empty">تقاضای تسویه‌ای ثبت نشده است.</div>'}</div></div></article>`;
}
function credits(){
  const rows=state.data?.creditRequests||[];
  return `<article class="sfc2-card"><header class="sfc2-card-head"><div><h3>درخواست‌های اعتبار</h3><p>بررسی شرط ۲۴ ماه پیوسته یا ۴۰ ماه تجمیعی و ثبت تصمیم مدیر.</p></div></header><div class="sfc2-card-body"><div class="sfc2-list">${rows.length?rows.map(item=>`<div class="sfc2-row"><div><strong>${esc(item.caregiverName)} • ${money(item.requestedAmountToman)}</strong><small>پیوسته: ${fa(item.continuousDays||0)} روز • تجمیعی: ${fa(item.cumulativeDays||0)} روز<br>${pdate(item.createdAt)}</small></div><div class="sfc2-actions"><span class="sfc2-badge">${statusText(item.status)}</span>${can('update')&&['REQUESTED','UNDER_REVIEW'].includes(item.status)?`<button class="sfc2-btn warn" data-sfc2-credit="${item.id}" data-decision="UNDER_REVIEW">در حال بررسی</button><button class="sfc2-btn primary" data-sfc2-credit="${item.id}" data-decision="APPROVED">تأیید</button><button class="sfc2-btn danger" data-sfc2-credit="${item.id}" data-decision="REJECTED">رد</button>`:''}</div></div>`).join(''):'<div class="sfc2-empty">درخواست اعتباری ثبت نشده است.</div>'}</div></div></article>`;
}
function rewards(){
  return `<section class="sfc2-grid"><article class="sfc2-card"><header class="sfc2-card-head"><div><h3>انتخاب مراقب</h3><p>جست‌وجو با نام، کد عضویت، موبایل یا کد ملی.</p></div></header><div class="sfc2-card-body"><div class="sfc2-search"><input class="sfc2-input" id="sfc2CaregiverQuery" placeholder="جست‌وجوی مراقب"><button class="sfc2-btn" data-sfc2-search>جست‌وجو</button></div><div class="sfc2-list" id="sfc2CaregiverResults" style="margin-top:9px">${state.caregivers.length?state.caregivers.map(item=>`<button class="sfc2-caregiver ${state.selectedCaregiver?.id===item.id?'active':''}" data-sfc2-caregiver="${item.id}"><span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||'')} • ${esc(item.mobile||'')}</small></span><span>انتخاب</span></button>`).join(''):'<div class="sfc2-empty">برای انتخاب مراقب جست‌وجو کنید.</div>'}</div></div></article><article class="sfc2-card"><header class="sfc2-card-head"><div><h3>ثبت پاداش معرفی پرونده</h3><p>هر شناسه پرونده فقط یک‌بار قابلیت تخصیص پاداش دارد.</p></div></header><div class="sfc2-card-body"><form class="sfc2-form" id="sfc2RewardForm"><div class="sfc2-note">مراقب انتخاب‌شده: <strong>${esc(state.selectedCaregiver?.fullName||'انتخاب نشده')}</strong></div><label class="sfc2-field"><span>مبلغ پاداش به تومان</span><input class="sfc2-input" name="amountToman" inputmode="numeric" required></label><label class="sfc2-field"><span>شناسه پرونده معرفی‌شده</span><input class="sfc2-input" name="referralCaseId" required></label><label class="sfc2-field"><span>عنوان</span><input class="sfc2-input" name="title" value="پاداش معرفی پرونده مراقبت"></label><label class="sfc2-field"><span>توضیحات</span><textarea class="sfc2-textarea" name="description"></textarea></label><button class="sfc2-btn primary" type="submit" ${!can('create')||!state.selectedCaregiver?'disabled':''}>ثبت اعتبار در کیف پول</button></form></div></article></section>`;
}
function body(){if(state.tab==='settlements')return settlements();if(state.tab==='credits')return credits();if(state.tab==='rewards')return rewards();return overview()}
function render(){setPage(`<header class="sfc2-head"><div><h2>اعتبارات مالی مراقبین</h2><p>پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار؛ مستقل از حقوق و دستمزد.</p></div>${tabs()}</header>${body()}`)}
async function load(){
  if(state.loading)return;state.loading=true;setPage('<div class="sfc2-empty">در حال دریافت اطلاعات اعتبارات مالی...</div>');
  try{
    const [accessPayload,dataPayload]=await Promise.all([api('/api/access/me'),api('/api/staff/financial-credits')]);
    state.access=accessPayload.data||null;state.data=dataPayload.data||{};render();
  }catch(error){setPage(`<div class="sfc2-empty">${esc(error.message)}</div>`)}finally{state.loading=false}
}
async function searchCaregivers(){
  const query=$('#sfc2CaregiverQuery')?.value||'';
  try{const payload=await api(`/api/staff/financial-credits/caregivers?q=${encodeURIComponent(query)}`);state.caregivers=payload.data?.caregivers||[];render()}catch(error){notify('جست‌وجو انجام نشد',error.message)}
}
async function decide(kind,id,decision){
  let paymentTrackingNumber='';
  if(kind==='settlement'&&decision==='PAID'){
    paymentTrackingNumber=window.prompt('شماره پیگیری واریز را وارد کنید:','')||'';
    if(!paymentTrackingNumber)return;
  }
  const decisionNote=window.prompt('یادداشت تصمیم مدیر (اختیاری):','')||'';
  const path=kind==='settlement'?`/api/staff/financial-credits/settlements/${encodeURIComponent(id)}`:`/api/staff/financial-credits/credit-requests/${encodeURIComponent(id)}`;
  try{await api(path,{method:'PATCH',body:JSON.stringify({status:decision,decisionNote,paymentTrackingNumber})});notify('تصمیم ثبت شد','وضعیت درخواست به‌روزرسانی شد.');await load()}catch(error){notify('ثبت تصمیم انجام نشد',error.message)}
}
async function click(event){
  const tab=event.target?.closest?.('[data-sfc2-tab]');if(tab){event.preventDefault();state.tab=tab.dataset.sfc2Tab;render();return}
  if(event.target?.closest?.('[data-sfc2-search]')){event.preventDefault();await searchCaregivers();return}
  const caregiver=event.target?.closest?.('[data-sfc2-caregiver]');if(caregiver){event.preventDefault();state.selectedCaregiver=state.caregivers.find(item=>item.id===caregiver.dataset.sfc2Caregiver)||null;render();return}
  const settlement=event.target?.closest?.('[data-sfc2-settlement]');if(settlement){event.preventDefault();await decide('settlement',settlement.dataset.sfc2Settlement,settlement.dataset.decision);return}
  const credit=event.target?.closest?.('[data-sfc2-credit]');if(credit){event.preventDefault();await decide('credit',credit.dataset.sfc2Credit,credit.dataset.decision)}
}
async function submit(event){
  if(event.target?.id!=='sfc2RewardForm')return;
  event.preventDefault();
  if(!state.selectedCaregiver)return notify('مراقب انتخاب نشده','ابتدا مراقب را انتخاب کنید.');
  const form=event.target,payload=Object.fromEntries(new FormData(form));
  try{await api('/api/staff/financial-credits/rewards',{method:'POST',body:JSON.stringify({...payload,caregiverId:state.selectedCaregiver.id})});notify('پاداش ثبت شد','اعتبار در کیف پول مراقب ثبت شد.');form.reset();await load();state.tab='rewards';render()}catch(error){notify('ثبت پاداش انجام نشد',error.message)}
}
function boot(){addStyles();document.addEventListener('click',event=>void click(event),true);document.addEventListener('submit',event=>void submit(event),true);window.SalamatFinancialCredits={version:VERSION,open:load,reload:load}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
