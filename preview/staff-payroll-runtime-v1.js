(()=>{
'use strict';
if(window.__salamatStaffPayrollRuntimeV1)return;
window.__salamatStaffPayrollRuntimeV1=true;

const VERSION='1.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:2});
const money=value=>`${Number(value||0).toLocaleString('fa-IR')} تومان`;
const pdate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return String(value)}};
const statusText=value=>({ISSUED:'صادرشده',PAID:'پرداخت‌شده',DRAFT:'پیش‌نویس',VOID:'باطل‌شده'}[String(value||'').toUpperCase()]||String(value||'—'));
const state={access:null,data:null,page:1,query:'',status:'',showForm:false,caregivers:[],selectedCaregiver:null,context:null,loading:false};

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
function moduleAccess(){return state.access?.allModules?.find(module=>module.key==='staff.payroll')?.actions||{}}
function can(action){return Boolean(moduleAccess()[action])}
function setPage(html){
  const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
  if(title)title.textContent='حقوق و پرداخت';
  if(subtitle)subtitle.textContent='محاسبه حقوق از قرارداد، صدور فیش و ثبت شماره پیگیری پرداخت';
  if(content)content.innerHTML=`<section class="module-page spr-root">${html}</section>`;
}
function addStyles(){
  if($('#staffPayrollStylesV1'))return;
  const style=document.createElement('style');style.id='staffPayrollStylesV1';style.textContent=`
.spr-root{direction:rtl;display:grid;gap:14px}.spr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.spr-head h2{margin:0;font-size:21px}.spr-head p{margin:6px 0 0;color:#728078;font-size:10px}.spr-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.spr-btn.primary{background:#078848;color:#fff}.spr-btn.danger{background:#ffe9ec;color:#ad2940}.spr-btn:disabled{opacity:.45;pointer-events:none}.spr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.spr-kpi,.spr-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 10px 28px rgba(22,70,46,.04)}.spr-kpi{padding:15px}.spr-kpi small{display:block;color:#77867e;font-size:8px}.spr-kpi strong{display:block;margin-top:8px;color:#087a45;font-size:18px}.spr-card{overflow:hidden}.spr-card-head{padding:14px 16px;border-bottom:1px solid #eaf0ed;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.spr-card-head h3{margin:0;font-size:14px}.spr-card-head p{margin:5px 0 0;color:#7a8981;font-size:8px}.spr-card-body{padding:14px}.spr-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 160px auto;gap:8px}.spr-input,.spr-select,.spr-textarea{width:100%;box-sizing:border-box;border:1px solid #d7e3dd;border-radius:11px;padding:10px;font:inherit;font-size:9px;outline:none;background:#fff}.spr-textarea{min-height:78px;resize:vertical}.spr-list{display:grid;gap:8px}.spr-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #e0eae5;border-radius:14px}.spr-row strong{display:block;font-size:10px}.spr-row small{display:block;margin-top:5px;color:#7a8981;font-size:8px;line-height:1.8}.spr-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.spr-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:7px;font-weight:900}.spr-empty{padding:36px;text-align:center;border:1px dashed #cfddd6;border-radius:16px;color:#6d7b74;background:#fbfdfc}.spr-grid{display:grid;grid-template-columns:minmax(280px,.7fr) minmax(0,1.3fr);gap:12px;align-items:start}.spr-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.spr-caregiver{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border:1px solid #e0eae5;border-radius:13px;background:#fff;padding:10px;text-align:right;cursor:pointer}.spr-caregiver.active{border-color:#0b9254;background:#f0faf5}.spr-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.spr-field{display:grid;gap:5px}.spr-field.wide{grid-column:1/-1}.spr-field span{font-size:8px;font-weight:900;color:#40564a}.spr-note{grid-column:1/-1;padding:11px 12px;border-radius:12px;background:#f3f9f6;color:#607269;font-size:8px;line-height:1.9}.spr-pagination{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;color:#6d7b74;font-size:8px}@media(max-width:980px){.spr-kpis{grid-template-columns:repeat(2,1fr)}.spr-grid{grid-template-columns:1fr}.spr-toolbar{grid-template-columns:1fr 1fr}.spr-toolbar button{grid-column:1/-1}}@media(max-width:650px){.spr-kpis,.spr-form{grid-template-columns:1fr}.spr-field.wide{grid-column:auto}}
`;document.head.appendChild(style);
}
function summary(){const s=state.data?.summary||{};return `<section class="spr-kpis"><article class="spr-kpi"><small>کل فیش‌ها</small><strong>${fa(s.total||0)}</strong></article><article class="spr-kpi"><small>منتظر پرداخت</small><strong>${fa(s.issued||0)}</strong></article><article class="spr-kpi"><small>مبلغ پرداخت‌نشده</small><strong style="font-size:14px">${money(s.pendingToman||0)}</strong></article><article class="spr-kpi"><small>مبلغ پرداخت‌شده</small><strong style="font-size:14px">${money(s.paidToman||0)}</strong></article></section>`}
function list(){
  const rows=state.data?.slips||[],p=state.data?.pagination||{page:1,pages:1,total:0};
  return `<article class="spr-card"><header class="spr-card-head"><div><h3>فیش‌های حقوقی</h3><p>اطلاعات واقعی ثبت‌شده در دیتابیس.</p></div></header><div class="spr-card-body"><form class="spr-toolbar" id="sprFilterForm"><input class="spr-input" name="q" value="${esc(state.query)}" placeholder="نام، کد عضویت، قرارداد یا دوره"><select class="spr-select" name="status"><option value="">همه وضعیت‌ها</option><option value="ISSUED" ${state.status==='ISSUED'?'selected':''}>صادرشده</option><option value="PAID" ${state.status==='PAID'?'selected':''}>پرداخت‌شده</option></select><button class="spr-btn" type="submit">اعمال فیلتر</button></form><div class="spr-list" style="margin-top:12px">${rows.length?rows.map(item=>`<div class="spr-row"><div><strong>${esc(item.caregiverName)} • ${esc(item.periodTitle||item.periodKey)}</strong><small>${esc(item.membershipCode||'')} • قرارداد ${esc(item.contractNumber||'—')} • خانواده ${esc(item.familyName||'—')}<br>ساعات ثبت‌شده ${fa(item.loggedHours||0)} + اضافه‌کار ${fa(item.overtimeHours||0)} - غیبت ${fa(item.absentHours||0)} • خالص ${money(item.netToman)}<br>${pdate(item.issuedAt)} ${item.paymentTrackingNumber?`• پیگیری ${esc(item.paymentTrackingNumber)}`:''}</small></div><div class="spr-actions"><span class="spr-badge">${statusText(item.status)}</span>${can('update')&&item.status==='ISSUED'?`<button class="spr-btn primary" data-spr-pay="${item.id}">ثبت پرداخت</button>`:''}</div></div>`).join(''):'<div class="spr-empty">فیش حقوقی مطابق فیلتر ثبت نشده است.</div>'}</div><div class="spr-pagination"><span>${fa(p.total||0)} رکورد • صفحه ${fa(p.page||1)} از ${fa(p.pages||1)}</span><div class="spr-actions"><button class="spr-btn" data-spr-page="${Math.max(1,(p.page||1)-1)}" ${(p.page||1)<=1?'disabled':''}>قبلی</button><button class="spr-btn" data-spr-page="${Math.min(p.pages||1,(p.page||1)+1)}" ${(p.page||1)>=(p.pages||1)?'disabled':''}>بعدی</button></div></div></div></article>`;
}
function issueForm(){
  if(!state.showForm)return '';
  const contracts=state.context?.contracts||[];
  return `<section class="spr-grid"><article class="spr-card"><header class="spr-card-head"><div><h3>انتخاب مراقب</h3><p>برای صدور فیش، مراقب و قرارداد را انتخاب کنید.</p></div></header><div class="spr-card-body"><div class="spr-search"><input class="spr-input" id="sprCaregiverQuery" placeholder="جست‌وجوی مراقب"><button class="spr-btn" data-spr-search>جست‌وجو</button></div><div class="spr-list" style="margin-top:9px">${state.caregivers.length?state.caregivers.map(item=>`<button class="spr-caregiver ${state.selectedCaregiver?.id===item.id?'active':''}" data-spr-caregiver="${item.id}"><span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||'')} • ${esc(item.mobile||'')}</small></span><span>انتخاب</span></button>`).join(''):'<div class="spr-empty">برای انتخاب مراقب جست‌وجو کنید.</div>'}</div></div></article><article class="spr-card"><header class="spr-card-head"><div><h3>صدور فیش حقوقی</h3><p>مقادیر اولیه از قرارداد انتخاب‌شده خوانده می‌شوند.</p></div></header><div class="spr-card-body"><form class="spr-form" id="sprIssueForm"><div class="spr-note">مراقب انتخاب‌شده: <strong>${esc(state.selectedCaregiver?.fullName||'انتخاب نشده')}</strong></div><label class="spr-field wide"><span>قرارداد</span><select class="spr-select" name="contractId" id="sprContract" required><option value="">انتخاب قرارداد</option>${contracts.map(item=>`<option value="${item.id}" data-hours="${Number(item.scheduledHours||0)}|${Number(item.loggedHours||0)}|${Number(item.overtimeHours||0)}|${Number(item.absentHours||0)}|${Number(item.hourlyRateToman||0)}">${esc(item.contractNumber)} • ${esc(item.familyName||'')} • ${esc(item.status||'')}</option>`).join('')}</select></label><label class="spr-field"><span>دوره حقوق (YYYY-MM)</span><input class="spr-input" name="periodKey" required placeholder="1405-05"></label><label class="spr-field"><span>عنوان دوره</span><input class="spr-input" name="periodTitle" placeholder="حقوق مرداد ۱۴۰۵"></label><label class="spr-field"><span>ساعت موظفی</span><input class="spr-input" name="scheduledHours" id="sprScheduled" inputmode="decimal"></label><label class="spr-field"><span>ساعت ثبت‌شده</span><input class="spr-input" name="loggedHours" id="sprLogged" inputmode="decimal"></label><label class="spr-field"><span>اضافه‌کار</span><input class="spr-input" name="overtimeHours" id="sprOvertime" inputmode="decimal"></label><label class="spr-field"><span>غیبت</span><input class="spr-input" name="absentHours" id="sprAbsent" inputmode="decimal"></label><label class="spr-field"><span>نرخ ساعتی تومان</span><input class="spr-input" name="hourlyRateToman" id="sprRate" inputmode="numeric"></label><label class="spr-field"><span>مزایا تومان</span><input class="spr-input" name="benefitsToman" value="0" inputmode="numeric"></label><label class="spr-field"><span>کسورات تومان</span><input class="spr-input" name="deductionsToman" value="0" inputmode="numeric"></label><label class="spr-field wide"><span>یادداشت</span><textarea class="spr-textarea" name="note"></textarea></label><button class="spr-btn primary" type="submit" ${!can('create')||!state.selectedCaregiver?'disabled':''}>محاسبه و صدور فیش</button></form></div></article></section>`;
}
function render(){setPage(`<header class="spr-head"><div><h2>حقوق و پرداخت مراقبین</h2><p>این ماژول از اعتبارات مالی جداست و فقط فیش و پرداخت حقوق را مدیریت می‌کند.</p></div><button class="spr-btn primary" data-spr-new ${!can('create')?'disabled':''}>${state.showForm?'بستن فرم':'صدور فیش جدید'}</button></header>${summary()}${issueForm()}${list()}`)}
async function load(){
  if(state.loading)return;state.loading=true;setPage('<div class="spr-empty">در حال دریافت اطلاعات حقوق و پرداخت...</div>');
  try{
    const [accessPayload,dataPayload]=await Promise.all([api('/api/access/me'),api(`/api/staff/payroll?page=${state.page}&q=${encodeURIComponent(state.query)}&status=${encodeURIComponent(state.status)}`)]);
    state.access=accessPayload.data||null;state.data=dataPayload.data||{};render();
  }catch(error){setPage(`<div class="spr-empty">${esc(error.message)}</div>`)}finally{state.loading=false}
}
async function searchCaregivers(){
  const query=$('#sprCaregiverQuery')?.value||'';
  try{const payload=await api(`/api/staff/payroll/caregivers?q=${encodeURIComponent(query)}`);state.caregivers=payload.data?.caregivers||[];render()}catch(error){notify('جست‌وجو انجام نشد',error.message)}
}
async function selectCaregiver(id){
  state.selectedCaregiver=state.caregivers.find(item=>item.id===id)||null;
  if(!state.selectedCaregiver)return;
  try{const payload=await api(`/api/staff/payroll/caregivers/${encodeURIComponent(id)}`);state.context=payload.data||null;render()}catch(error){notify('قراردادهای مراقب دریافت نشد',error.message)}
}
function fillContract(){
  const option=$('#sprContract')?.selectedOptions?.[0];if(!option?.dataset.hours)return;
  const [scheduled,logged,overtime,absent,rate]=option.dataset.hours.split('|');
  const map=[['#sprScheduled',scheduled],['#sprLogged',logged],['#sprOvertime',overtime],['#sprAbsent',absent],['#sprRate',rate]];
  map.forEach(([selector,value])=>{const input=$(selector);if(input)input.value=value||'0'});
}
async function click(event){
  if(event.target?.closest?.('[data-spr-new]')){event.preventDefault();state.showForm=!state.showForm;render();return}
  if(event.target?.closest?.('[data-spr-search]')){event.preventDefault();await searchCaregivers();return}
  const caregiver=event.target?.closest?.('[data-spr-caregiver]');if(caregiver){event.preventDefault();await selectCaregiver(caregiver.dataset.sprCaregiver);return}
  const page=event.target?.closest?.('[data-spr-page]');if(page){event.preventDefault();state.page=Number(page.dataset.sprPage||1);await load();return}
  const pay=event.target?.closest?.('[data-spr-pay]');if(pay){event.preventDefault();const tracking=window.prompt('شماره پیگیری پرداخت را وارد کنید:','')||'';if(!tracking)return;try{await api(`/api/staff/payroll/${encodeURIComponent(pay.dataset.sprPay)}/pay`,{method:'PATCH',body:JSON.stringify({paymentTrackingNumber:tracking})});notify('پرداخت ثبت شد','فیش به وضعیت پرداخت‌شده منتقل شد.');await load()}catch(error){notify('ثبت پرداخت انجام نشد',error.message)}}
}
async function submit(event){
  if(event.target?.id==='sprFilterForm'){event.preventDefault();const data=Object.fromEntries(new FormData(event.target));state.query=String(data.q||'');state.status=String(data.status||'');state.page=1;await load();return}
  if(event.target?.id!=='sprIssueForm')return;
  event.preventDefault();if(!state.selectedCaregiver)return notify('مراقب انتخاب نشده','ابتدا مراقب را انتخاب کنید.');
  const payload=Object.fromEntries(new FormData(event.target));
  try{await api('/api/staff/payroll',{method:'POST',body:JSON.stringify({...payload,caregiverId:state.selectedCaregiver.id})});notify('فیش صادر شد','فیش حقوقی در پرونده مراقب ثبت شد.');state.showForm=false;state.selectedCaregiver=null;state.context=null;await load()}catch(error){notify('صدور فیش انجام نشد',error.message)}
}
function change(event){if(event.target?.id==='sprContract')fillContract()}
function boot(){addStyles();document.addEventListener('click',event=>void click(event),true);document.addEventListener('submit',event=>void submit(event),true);document.addEventListener('change',change,true);window.SalamatStaffPayroll={version:VERSION,open:load,reload:load}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
