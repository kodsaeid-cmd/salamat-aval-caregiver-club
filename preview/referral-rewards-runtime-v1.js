(()=>{
'use strict';
if(window.__salamatReferralRewardsRuntimeV1)return;
window.__salamatReferralRewardsRuntimeV1=true;

const VERSION='1.1.0';
const STAFF_ENDPOINT='/api/staff/financial-credits/referrals';
const REGISTER_ENDPOINT='/api/public/caregivers/register';
const LEGACY_CAREGIVER_MARKER='caregiverReferralRewardsV1';
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const money=value=>`${fa(value)} تومان`;
const dateTimeFa=value=>{
  if(!value)return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return esc(value);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
};
const statusLabels={
  PENDING_REGISTRATION_REVIEW:'در انتظار تأیید ۲۰۰ هزار تومان',
  WAITING_CONTRACT:'در انتظار بررسی ورود به قرارداد',
  COMPLETED:'تکمیل پاداش ۵۰۰ هزار تومانی',
  REGISTRATION_REJECTED:'پاداش ثبت‌نام رد شده',
  CONTRACT_REJECTED:'پاداش قرارداد رد شده',
};
const state={user:null,userPromise:null,staffLoading:false,renderTimer:0,observers:[]};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const contentType=response.headers.get('content-type')||'';
  const payload=contentType.includes('application/json')?await response.json().catch(()=>({})):await response.text();
  if(!response.ok){
    const message=typeof payload==='object'&&payload?payload.message:payload;
    const error=new Error(message||`خطای ${response.status}`);error.status=response.status;error.code=typeof payload==='object'&&payload?payload.error:'';throw error;
  }
  return payload;
}
function toast(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
async function currentUser(){
  try{
    const direct=window.SalamatBackend?.getCurrentUser?.()||window.__salamatPanelAccessV2?.user||null;
    if(direct){state.user=direct;return direct}
  }catch{}
  if(state.user)return state.user;
  if(!state.userPromise)state.userPromise=api('/api/auth/me').then(payload=>payload.data||null).catch(()=>null).finally(()=>{state.userPromise=null});
  state.user=await state.userPromise;return state.user;
}
function isCaregiver(user){return String(user?.role||'').toUpperCase()==='CAREGIVER'}
function appVisible(){const app=$('#appView');return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden)}
function pageTitle(){return String($('#pageTitle')?.textContent||'').trim()}
function activeStaffModule(){return $('#sidebarNav [data-staff-module-key].active')?.dataset?.staffModuleKey||$('#sidebarNav [data-panel-module-key].active')?.dataset?.panelModuleKey||''}
function isStaffFinancialSurface(){const key=activeStaffModule();return key==='staff.financial_credits'||(!key&&/(اعتبارات مالی|اعتبار مالی)/.test(pageTitle()))}

function addStyles(){
  if($('#referralRewardsStylesV1'))return;
  const style=document.createElement('style');style.id='referralRewardsStylesV1';style.textContent=`
.ref-signup-hint{display:block;margin-top:5px;color:#789086;font-size:8px;line-height:1.7}.ref-code-input{letter-spacing:1px}.ref-root{direction:rtl;display:grid;gap:14px;margin-top:14px}.ref-card{background:#fff;border:1px solid #dce8e2;border-radius:20px;box-shadow:0 10px 30px rgba(20,70,45,.05);overflow:hidden}.ref-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid #edf2ef}.ref-card-head h3{margin:0;color:#173e2d;font-size:14px}.ref-card-head p{margin:5px 0 0;color:#74857c;font-size:8px;line-height:1.8}.ref-card-body{padding:16px}.ref-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ref-kpi{padding:14px;border:1px solid #e2ebe6;border-radius:16px;background:#fbfdfc}.ref-kpi small{display:block;color:#75867d;font-size:8px}.ref-kpi strong{display:block;margin-top:8px;color:#087a45;font-size:17px}.ref-toolbar{display:grid;grid-template-columns:minmax(160px,1fr) 190px 220px auto;gap:9px;align-items:end}.ref-field{display:grid;gap:6px}.ref-field span{font-size:8px;font-weight:900;color:#40564a}.ref-input,.ref-select{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:11px;padding:10px;background:#fff;font:inherit;font-size:9px;outline:none}.ref-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:8px;font-weight:900;cursor:pointer}.ref-btn.primary{background:#087a45;color:#fff}.ref-btn.danger{background:#ffedf0;color:#a8273e}.ref-btn.neutral{background:#f0f3f1;color:#53655b}.ref-btn:disabled{opacity:.5;pointer-events:none}.ref-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}.ref-table-wrap{overflow:auto}.ref-table{width:100%;border-collapse:collapse;min-width:1120px;font-size:8px}.ref-table th,.ref-table td{padding:11px 9px;border-bottom:1px solid #edf2ef;text-align:right;vertical-align:top}.ref-table th{position:sticky;top:0;background:#f5f9f7;color:#52665b;z-index:1}.ref-table strong{display:block;font-size:9px}.ref-table small{display:block;margin-top:4px;color:#7a8981;line-height:1.7}.ref-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900}.ref-badge.pending{background:#fff5dd;color:#946400}.ref-badge.rejected{background:#ffedf0;color:#aa2941}.ref-loading,.ref-empty{padding:30px 18px;text-align:center;color:#708077;font-size:9px;line-height:2;border:1px dashed #cfdfd7;border-radius:16px}.ref-policy{display:flex;gap:8px;flex-wrap:wrap}.ref-policy span{padding:6px 9px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900}@media(max-width:1050px){.ref-toolbar{grid-template-columns:1fr 1fr}.ref-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.ref-kpis,.ref-toolbar{grid-template-columns:1fr}.ref-actions{justify-content:flex-start}}
`;document.head.appendChild(style);
}

function enhanceSignup(){
  const form=$('#caregiverSignupForm');if(!form)return;
  let input=form.querySelector('[name="referralCode"]');
  if(!input){
    const label=document.createElement('label');label.className='caregiver-signup-field';label.dataset.referralField='1';
    label.innerHTML='<span>کد معرف مراقب <small style="font-weight:400;color:#7b8b82">(اختیاری)</small></span><input class="ref-code-input" name="referralCode" autocomplete="off" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" placeholder="مثلاً 482731" dir="ltr"><small class="ref-signup-hint">کد معرف ۶ رقمی است و استفاده از آن ابتدا باید توسط مراقب معرف تأیید شود.</small>';
    const anchor=form.querySelector('[name="skills"]')?.closest('label');if(anchor?.nextSibling)form.insertBefore(label,anchor.nextSibling);else form.appendChild(label);input=label.querySelector('input');
  }
  input.maxLength=6;input.setAttribute('inputmode','numeric');input.setAttribute('pattern','[0-9]{6}');
  if(!input.dataset.refLightBound){input.dataset.refLightBound='1';input.addEventListener('input',()=>{input.value=String(input.value||'').replace(/\D/g,'').slice(0,6)})}
}

function installRegistrationBridge(){
  if(window.__salamatReferralFetchBridgeV1)return;window.__salamatReferralFetchBridgeV1=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    try{
      const rawUrl=typeof input==='string'?input:input instanceof URL?input.toString():input?.url||'';
      const url=new URL(rawUrl,location.href);const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
      if(url.pathname===REGISTER_ENDPOINT&&method==='POST'&&typeof init.body==='string'){
        const payload=JSON.parse(init.body);const referralCode=String($('#caregiverSignupForm [name="referralCode"]')?.value||'').replace(/\D/g,'').slice(0,6);
        if(referralCode)payload.referralCode=referralCode;
        init={...init,body:JSON.stringify(payload)};
      }
    }catch(error){console.warn('Referral registration bridge skipped',error)}
    return nativeFetch(input,init);
  };
}

function caseStatusClass(status){if(status==='PENDING_REGISTRATION_REVIEW'||status==='WAITING_CONTRACT')return 'pending';if(status==='REGISTRATION_REJECTED'||status==='CONTRACT_REJECTED')return 'rejected';return ''}
function confirmedAmount(item){return (item.registrationRewardTransactionId?200000:0)+(item.contractRewardTransactionId?300000:0)}
function actionButtons(item){
  const id=esc(item.id);
  if(item.status==='PENDING_REGISTRATION_REVIEW')return `<div class="ref-actions"><button class="ref-btn primary" data-ref-action="APPROVE_REGISTRATION" data-ref-id="${id}">تأیید و واریز ۲۰۰ هزار تومان</button><button class="ref-btn danger" data-ref-action="REJECT_REGISTRATION" data-ref-id="${id}">رد مرحله ثبت‌نام</button></div>`;
  if(item.status==='WAITING_CONTRACT')return `<div class="ref-actions"><button class="ref-btn neutral" data-ref-action="HOLD_CONTRACT" data-ref-id="${id}">هنوز قرارداد نرفته</button><button class="ref-btn primary" data-ref-action="APPROVE_CONTRACT" data-ref-id="${id}">تأیید قرارداد و واریز ۳۰۰ هزار تومان</button><button class="ref-btn danger" data-ref-action="REJECT_CONTRACT" data-ref-id="${id}">رد مرحله قرارداد</button></div>`;
  if(item.status==='CONTRACT_REJECTED')return `<div class="ref-actions"><button class="ref-btn neutral" data-ref-action="REOPEN_CONTRACT" data-ref-id="${id}">بازگشایی بررسی قرارداد</button></div>`;
  return '<span class="ref-badge">بدون اقدام باز</span>';
}
function filters(root){return {q:String($('[data-ref-q]',root)?.value||'').trim(),status:String($('[data-ref-status]',root)?.value||''),month:String($('[data-ref-month]',root)?.value||'')}}
function qs(values){const params=new URLSearchParams();Object.entries(values).forEach(([key,value])=>{if(value)params.set(key,value)});return params.toString()?`?${params}`:''}
function reportHref(month){const params=new URLSearchParams();if(month)params.set('month',month);return `${STAFF_ENDPOINT}/report.csv${params.toString()?`?${params}`:''}`}

async function decide(root,id,action){
  const requiresReason=['REJECT_REGISTRATION','REJECT_CONTRACT'].includes(action);let note='';
  if(requiresReason){note=window.prompt('علت تصمیم را وارد کنید:','')||'';if(!note.trim())return}
  else if(action==='HOLD_CONTRACT')note=window.prompt('یادداشت بررسی قرارداد:','هنوز وارد قرارداد نشده است.')||'هنوز وارد قرارداد نشده است.';
  else if(action==='REOPEN_CONTRACT')note=window.prompt('علت بازگشایی:','بررسی مجدد ورود به قرارداد')||'بررسی مجدد ورود به قرارداد';
  else if(!window.confirm('این تصمیم مالی ثبت شود؟'))return;
  const buttons=[...root.querySelectorAll('[data-ref-id]')].filter(button=>button.dataset.refId===id);buttons.forEach(button=>button.disabled=true);
  try{await api(`${STAFF_ENDPOINT}/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({action,note})});toast('تصمیم مالی ثبت شد','پرونده معرفی به‌روزرسانی شد.');await loadStaff(root)}
  catch(error){toast('ثبت تصمیم انجام نشد',error.message);buttons.forEach(button=>button.disabled=false)}
}

async function loadStaff(root){
  if(state.staffLoading)return;state.staffLoading=true;
  const body=$('[data-ref-staff-body]',root);if(body)body.innerHTML='<div class="ref-loading">در حال دریافت پرونده‌های معرفی…</div>';
  try{
    const current=filters(root),payload=await api(`${STAFF_ENDPOINT}${qs(current)}`),data=payload.data||{},summary=data.summary||{},policy=data.policy||{},cases=data.cases||[];
    const kpis=$('[data-ref-staff-kpis]',root);if(kpis)kpis.innerHTML=`<article class="ref-kpi"><small>ثبت‌نام با کد معرف</small><strong>${fa(summary.registrationsCreated)}</strong></article><article class="ref-kpi"><small>معرفان یکتا</small><strong>${fa(summary.uniqueReferrers)}</strong></article><article class="ref-kpi"><small>تأیید مرحله اول</small><strong>${fa(summary.stage1Approved)}</strong></article><article class="ref-kpi"><small>معرفی کامل</small><strong>${fa(summary.completedReferrals)}</strong></article>`;
    const policyNode=$('[data-ref-policy]',root);if(policyNode)policyNode.innerHTML=`<span>ثبت‌نام: ${money(policy.registrationRewardToman||200000)}</span><span>ورود به قرارداد: ${money(policy.contractRewardToman||300000)}</span><span>سقف هر معرفی: ${money(policy.maximumRewardToman||500000)}</span>`;
    const exportLink=$('[data-ref-export]',root);if(exportLink)exportLink.href=reportHref(current.month||data.reportMonth);
    if(body)body.innerHTML=cases.length?`<div class="ref-table-wrap"><table class="ref-table"><thead><tr><th>معرف</th><th>مراقب معرفی‌شده</th><th>تاریخ ثبت</th><th>وضعیت</th><th>مرحله اول</th><th>مرحله دوم</th><th>مجموع قطعی</th><th>آخرین یادداشت</th><th>اقدام مدیر</th></tr></thead><tbody>${cases.map(item=>`<tr><td><strong>${esc(item.referrerName)}</strong><small>${esc(item.referrerMembershipCode)} • ${esc(item.referrerMobile||'—')}</small></td><td><strong>${esc(item.referredName)}</strong><small>${esc(item.referredMembershipCode)}</small></td><td>${dateTimeFa(item.createdAt)}</td><td><span class="ref-badge ${caseStatusClass(item.status)}">${esc(statusLabels[item.status]||item.status)}</span></td><td>${item.registrationRewardTransactionId?money(item.registrationRewardToman):'—'}</td><td>${item.contractRewardTransactionId?money(item.contractRewardToman):'—'}</td><td><strong>${money(confirmedAmount(item))}</strong></td><td><small>${esc(item.contractCheckNote||item.contractDecisionNote||item.registrationDecisionNote||'—')}</small></td><td>${actionButtons(item)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ref-empty">پرونده‌ای با فیلترهای انتخاب‌شده پیدا نشد.</div>';
    root.querySelectorAll('[data-ref-action]').forEach(button=>button.addEventListener('click',()=>decide(root,button.dataset.refId,button.dataset.refAction)));
  }catch(error){if(body)body.innerHTML=`<div class="ref-empty">دریافت پرونده‌های معرفی انجام نشد: ${esc(error.message)}</div>`}
  finally{state.staffLoading=false}
}

async function renderStaff(){
  const content=$('#content');if(!content)return;
  let root=$('#staffReferralRewardsV1');if(root)return;
  root=document.createElement('section');root.id='staffReferralRewardsV1';root.className='ref-root';
  root.innerHTML=`<section class="ref-card"><header class="ref-card-head"><div><h3>پاداش معرفی مراقبین</h3><p>کنترل مرحله ثبت‌نام، ورود به قرارداد و گزارش مالی.</p></div><div class="ref-policy" data-ref-policy></div></header><div class="ref-card-body"><div class="ref-toolbar"><label class="ref-field"><span>جست‌وجوی نام، کد یا موبایل</span><input class="ref-input" data-ref-q placeholder="جست‌وجو..."></label><label class="ref-field"><span>وضعیت پرونده</span><select class="ref-select" data-ref-status><option value="">همه وضعیت‌ها</option><option value="PENDING_REGISTRATION_REVIEW">در انتظار تأیید ثبت‌نام</option><option value="WAITING_CONTRACT">در انتظار قرارداد</option><option value="COMPLETED">تکمیل‌شده</option><option value="REGISTRATION_REJECTED">رد ثبت‌نام</option><option value="CONTRACT_REJECTED">رد قرارداد</option></select></label><label class="ref-field"><span>ماه گزارش</span><input class="ref-input" data-ref-month type="month"></label><button class="ref-btn primary" type="button" data-ref-search>اعمال فیلتر</button></div></div></section><section class="ref-kpis" data-ref-staff-kpis></section><section class="ref-card"><header class="ref-card-head"><div><h3>صف تصمیم‌های مدیر سامانه</h3><p>پرونده‌هایی که مراقب معرف تأیید کرده است در این صف قرار می‌گیرند.</p></div><a class="ref-btn" data-ref-export href="#">خروجی CSV ماهانه</a></header><div class="ref-card-body" data-ref-staff-body></div></section>`;
  content.appendChild(root);$('[data-ref-search]',root)?.addEventListener('click',()=>loadStaff(root));$('[data-ref-q]',root)?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadStaff(root)}});await loadStaff(root);
}

async function reconcile(){
  enhanceSignup();
  if(!appVisible())return;
  const user=await currentUser();if(!user)return;
  $('#'+LEGACY_CAREGIVER_MARKER)?.remove();
  if(isCaregiver(user)){ $('#staffReferralRewardsV1')?.remove();return }
  if(isStaffFinancialSurface())await renderStaff();else $('#staffReferralRewardsV1')?.remove();
}
function schedule(){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(()=>reconcile().catch(error=>console.warn('Referral reconcile failed',error)),160)}
function observeTarget(target,options){if(!target)return;const observer=new MutationObserver(schedule);observer.observe(target,options);state.observers.push(observer)}
function boot(){
  addStyles();installRegistrationBridge();enhanceSignup();schedule();
  observeTarget($('#content'),{childList:true});
  observeTarget($('#sidebarNav'),{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  observeTarget($('#caregiverSignupLayer'),{childList:true,subtree:true});
  window.addEventListener('salamat-access-changed',()=>{state.user=null;schedule()});
  window.addEventListener('salamat-panel-route-ready',schedule);
  window.addEventListener('popstate',schedule);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.SalamatReferralRewardsV1={version:VERSION,refresh:()=>{state.user=null;schedule()},legacyCaregiverMarker:LEGACY_CAREGIVER_MARKER};
})();