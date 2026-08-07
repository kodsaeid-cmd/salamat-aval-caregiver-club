(()=>{
'use strict';
if(window.__salamatReferralRewardsExperienceV2)return;
window.__salamatReferralRewardsExperienceV2=true;

const VERSION='2.0.1';
const ENDPOINT='/api/caregiver/platform/referrals';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const money=value=>`${fa(value)} تومان`;
const dateTimeFa=value=>{
  if(!value)return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return esc(value);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
};
const state={data:null,promise:null,lastLoadedAt:0,scheduled:false,decisionBusy:false};
const statusLabels={
  WAITING_REFERRER_CONFIRMATION:'منتظر تأیید شما',
  REFERRER_REJECTED:'توسط شما رد شده',
  PENDING_REGISTRATION_REVIEW:'منتظر تأیید مدیر سامانه',
  WAITING_CONTRACT:'منتظر تأیید ورود به قرارداد',
  COMPLETED:'معرفی موفق و قراردادی',
  REGISTRATION_REJECTED:'مرحله ثبت‌نام رد شده',
  CONTRACT_REJECTED:'مرحله قرارداد رد شده',
};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;throw error}
  return payload;
}
function toast(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function role(){try{return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.__salamatPanelAccessV2?.user?.role||'').toUpperCase()}catch{return ''}}
function caregiverActive(){return role()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب')}
function activeModule(){return $('#sidebarNav [data-caregiver-module-key].active')?.dataset?.caregiverModuleKey||''}
function pageTitle(){return String($('#pageTitle')?.textContent||'').trim()}
function isDashboard(){const key=activeModule();return caregiverActive()&&(key==='caregiver.dashboard'||(!key&&pageTitle().includes('داشبورد')))}
function isWallet(){const key=activeModule();return caregiverActive()&&(key==='caregiver.wallet'||pageTitle()==='کیف پول و اعتبارات')}

function addStyles(){
  if($('#referralRewardsExperienceV2Styles'))return;
  const style=document.createElement('style');
  style.id='referralRewardsExperienceV2Styles';
  style.textContent=`
.refv2-root{direction:rtl;display:grid;gap:14px;margin-top:14px}.refv2-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 10px 28px rgba(20,70,45,.04);overflow:hidden}.refv2-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:15px 17px;border-bottom:1px solid #ebf1ee}.refv2-head h3{margin:0;font-size:14px;color:#173e2d}.refv2-head p{margin:5px 0 0;color:#7a8981;font-size:8px;line-height:1.9}.refv2-body{padding:15px}.refv2-code{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:17px;border-radius:17px;background:linear-gradient(135deg,#087a45,#075b38);color:#fff}.refv2-code small{display:block;color:rgba(255,255,255,.78);font-size:8px}.refv2-code strong{display:block;margin-top:6px;font-size:23px;letter-spacing:3px;direction:ltr;text-align:right}.refv2-copy,.refv2-btn{border:0;border-radius:11px;padding:9px 12px;font:inherit;font-size:8px;font-weight:900;cursor:pointer}.refv2-copy{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#fff}.refv2-btn{background:#edf8f2;color:#087747}.refv2-btn.primary{background:#078848;color:#fff}.refv2-btn.danger{background:#ffedf0;color:#a8273e}.refv2-btn:disabled{opacity:.5;pointer-events:none}.refv2-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.refv2-kpi{padding:14px;border:1px solid #e2ebe6;border-radius:16px;background:#fbfdfc}.refv2-kpi small{display:block;color:#75867d;font-size:8px}.refv2-kpi strong{display:block;margin-top:7px;color:#087a45;font-size:17px}.refv2-grid{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.28fr);gap:12px}.refv2-gauge-wrap{display:grid;place-items:center;gap:12px;padding:20px}.refv2-gauge{--pct:0;width:156px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#078848 calc(var(--pct)*1%),#e7f0eb 0);position:relative}.refv2-gauge:before{content:'';position:absolute;inset:14px;border-radius:50%;background:#fff}.refv2-gauge-center{position:relative;z-index:1;text-align:center}.refv2-gauge-center strong{display:block;color:#087a45;font-size:25px;direction:ltr}.refv2-gauge-center small{display:block;margin-top:4px;color:#73837b;font-size:8px}.refv2-gauge-copy{text-align:center}.refv2-gauge-copy strong{display:block;font-size:11px;color:#173e2d}.refv2-gauge-copy small{display:block;margin-top:6px;font-size:8px;color:#718179;line-height:1.9}.refv2-policy{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}.refv2-policy span{padding:6px 9px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900}.refv2-list{display:grid;gap:8px}.refv2-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px;border:1px solid #e1ebe6;border-radius:14px;background:#fff}.refv2-item strong{display:block;font-size:10px}.refv2-item small{display:block;margin-top:5px;color:#7a8981;font-size:8px;line-height:1.8}.refv2-side{text-align:left}.refv2-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900}.refv2-badge.pending{background:#fff5dd;color:#946400}.refv2-badge.rejected{background:#ffedf0;color:#aa2941}.refv2-amount{display:block;margin-top:6px;color:#087a45;font-size:9px;font-weight:900}.refv2-confirm{border-color:#f0dbad;background:#fffcf5}.refv2-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.refv2-empty{padding:28px 16px;text-align:center;color:#708077;font-size:9px;line-height:2;border:1px dashed #cfdfd7;border-radius:15px}.refv2-dashboard-code{position:relative}.refv2-dashboard-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}.refv2-dashboard-row strong{margin:0!important;letter-spacing:2px;direction:ltr}.refv2-dashboard-copy{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);color:#fff;border-radius:8px;padding:5px 8px;font:inherit;font-size:7px;font-weight:900;cursor:pointer}.refv2-dashboard-pending{display:block!important;margin-top:5px!important;color:#fff4cb!important;font-size:7px!important}.refv2-loading{padding:28px;text-align:center;color:#708077;font-size:9px}.refv2-old-hidden{display:none!important}.refv2-error{padding:13px;border-radius:13px;background:#fff7f8;color:#a52d42;font-size:8px;line-height:1.9}@media(max-width:960px){.refv2-grid{grid-template-columns:1fr}.refv2-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.refv2-kpis{grid-template-columns:1fr}.refv2-code,.refv2-item{grid-template-columns:1fr}.refv2-side{text-align:right}.refv2-actions{justify-content:flex-start}}
`;
  (document.head||document.documentElement).appendChild(style);
}

async function loadData(force=false){
  const fresh=Date.now()-state.lastLoadedAt<12000;
  if(state.data&&fresh&&!force)return state.data;
  if(state.promise)return state.promise;
  state.promise=api(ENDPOINT).then(payload=>{state.data=payload.data||{};state.lastLoadedAt=Date.now();return state.data}).finally(()=>{state.promise=null});
  return state.promise;
}

async function copyCode(code){
  if(!code||code==='—')return;
  try{await navigator.clipboard.writeText(code);toast('کد معرف کپی شد',code)}catch{window.prompt('کد معرف شما',code)}
}

function enhanceSignup(){
  const input=$('#caregiverSignupForm [name="referralCode"]');
  if(!input)return;
  input.maxLength=6;input.setAttribute('inputmode','numeric');input.setAttribute('pattern','[0-9]{6}');input.setAttribute('autocomplete','off');input.setAttribute('placeholder','مثلاً 482731');
  if(!input.dataset.refv2Bound){input.dataset.refv2Bound='1';input.addEventListener('input',()=>{input.value=String(input.value||'').replace(/\D/g,'').slice(0,6)})}
  const hint=input.closest('label')?.querySelector('.ref-signup-hint');
  if(hint)hint.textContent='کد معرف ۶ رقمی است. پس از ثبت‌نام، ابتدا معرف و سپس مدیر سامانه باید معرفی را تأیید کنند.';
}

function statusClass(status){if(['WAITING_REFERRER_CONFIRMATION','PENDING_REGISTRATION_REVIEW','WAITING_CONTRACT'].includes(status))return 'pending';if(['REFERRER_REJECTED','REGISTRATION_REJECTED','CONTRACT_REJECTED'].includes(status))return 'rejected';return ''}
function confirmedAmount(item){return (item.registrationRewardTransactionId?200000:0)+(item.contractRewardTransactionId?300000:0)}
function caseDetail(item){
  const status=item.effectiveStatus||item.status;
  if(status==='WAITING_REFERRER_CONFIRMATION')return 'این مراقب کد شما را وارد کرده است؛ برای ارسال پرونده به مدیر، معرفی را تأیید کنید.';
  if(status==='PENDING_REGISTRATION_REVIEW')return 'معرفی توسط شما تأیید شده و اکنون منتظر تصمیم مدیر سامانه است.';
  if(status==='WAITING_CONTRACT')return 'پاداش ثبت‌نام ثبت شده؛ ۳۰۰ هزار تومان پس از تأیید ورود به قرارداد اضافه می‌شود.';
  if(status==='COMPLETED')return 'ثبت‌نام و ورود به قرارداد توسط مدیر تأیید شده است.';
  if(status==='REFERRER_REJECTED')return item.referrerDecisionNote||'شما این معرفی را تأیید نکرده‌اید.';
  return item.registrationDecisionNote||item.contractDecisionNote||'وضعیت این معرفی در سامانه ثبت شده است.';
}

function confirmationMarkup(cases){
  const pending=cases.filter(item=>(item.effectiveStatus||item.status)==='WAITING_REFERRER_CONFIRMATION');
  if(!pending.length)return '';
  return `<section class="refv2-card"><header class="refv2-head"><div><h3>معرفی‌های منتظر تأیید من</h3><p>فقط معرفی‌هایی که واقعاً کد را در اختیارشان گذاشته‌اید تأیید کنید. پس از تأیید شما، پرونده برای مدیر سامانه ارسال می‌شود.</p></div><span class="refv2-badge pending">${fa(pending.length)} مورد</span></header><div class="refv2-body"><div class="refv2-list">${pending.map(item=>`<article class="refv2-item refv2-confirm"><div><strong>${esc(item.referredName||'مراقب جدید')}</strong><small>ثبت در ${dateTimeFa(item.createdAt)}<br>این فرد هنگام ثبت‌نام از کد معرف شما استفاده کرده است.</small></div><div class="refv2-actions"><button type="button" class="refv2-btn danger" data-refv2-reject="${esc(item.id)}">رد</button><button type="button" class="refv2-btn primary" data-refv2-confirm="${esc(item.id)}">تأیید معرفی</button></div></article>`).join('')}</div></div></section>`;
}

function walletSignature(data){
  const s=data.summary||{},cases=Array.isArray(data.cases)?data.cases:[],milestones=Array.isArray(data.milestones)?data.milestones:[];
  return JSON.stringify([data.caregiver?.referralCode,s.totalReferrals,s.completedReferrals,s.confirmedRewardToman,s.pendingRewardToman,s.awaitingMyConfirmation,s.progressInCycle,s.remainingToMilestone,cases.map(x=>[x.id,x.effectiveStatus||x.status,x.registrationRewardTransactionId,x.contractRewardTransactionId,x.updatedAt]),milestones.map(x=>[x.milestoneNumber,x.rewardToman,x.awardedAt])]);
}
function walletMarkup(data){
  const caregiver=data.caregiver||{},summary=data.summary||{},cases=Array.isArray(data.cases)?data.cases:[],milestones=Array.isArray(data.milestones)?data.milestones:[];
  const progress=Math.max(0,Math.min(10,Number(summary.progressInCycle||0))),pct=progress*10,remaining=Number(summary.remainingToMilestone||10),code=caregiver.referralCode||'—';
  return `${confirmationMarkup(cases)}
    <section class="refv2-card"><header class="refv2-head"><div><h3>معرفی و اعتبارات مراقب</h3><p>این بخش داخل کیف پول و اعتبارات شماست؛ همه پاداش‌های قطعی مستقیماً در تراکنش‌های کیف پول ثبت می‌شوند.</p></div></header><div class="refv2-body"><div class="refv2-code"><div><small>کد معرف ۶ رقمی و یکتای من</small><strong>${esc(code)}</strong></div><button class="refv2-copy" type="button" data-refv2-copy="${esc(code)}">کپی کد</button></div></div></section>
    <section class="refv2-kpis"><article class="refv2-kpi"><small>کل معرفی‌ها</small><strong>${fa(summary.totalReferrals||0)}</strong></article><article class="refv2-kpi"><small>معرفی منجر به قرارداد</small><strong>${fa(summary.completedReferrals||0)}</strong></article><article class="refv2-kpi"><small>اعتبار قطعی معرفی</small><strong>${money(summary.confirmedRewardToman||0)}</strong></article><article class="refv2-kpi"><small>اعتبار در انتظار</small><strong>${money(summary.pendingRewardToman||0)}</strong></article></section>
    <section class="refv2-grid"><article class="refv2-card"><header class="refv2-head"><div><h3>تا پاداش ۵ میلیون تومانی بعدی</h3><p>هر ۱۰ معرفی موفق که قراردادشان توسط مدیر تأیید شود.</p></div></header><div class="refv2-gauge-wrap"><div class="refv2-gauge" style="--pct:${pct}"><div class="refv2-gauge-center"><strong>${fa(progress)} / ۱۰</strong><small>معرفی موفق این دوره</small></div></div><div class="refv2-gauge-copy"><strong>${fa(remaining)} معرفی دیگر تا اعتبار ${money(summary.nextMilestoneRewardToman||5000000)}</strong><small>هدف بعدی: ${fa(summary.nextMilestoneTarget||10)} معرفی موفق قراردادی</small></div><div class="refv2-policy"><span>ثبت‌نام تأییدشده +۲۰۰ هزار</span><span>قرارداد تأییدشده +۳۰۰ هزار</span><span>هر ۱۰ قرارداد +۵ میلیون</span></div></div></article><article class="refv2-card"><header class="refv2-head"><div><h3>سابقه پاداش‌های ۵ میلیونی</h3><p>هر پاداش پس از تکمیل یک دوره ۱۰تایی به‌صورت تراکنش کیف پول ثبت می‌شود.</p></div></header><div class="refv2-body">${milestones.length?`<div class="refv2-list">${milestones.map(item=>`<div class="refv2-item"><div><strong>تکمیل ${fa(item.milestoneNumber)} معرفی موفق</strong><small>${dateTimeFa(item.awardedAt)}</small></div><span class="refv2-amount">+ ${money(item.rewardToman||5000000)}</span></div>`).join('')}</div>`:'<div class="refv2-empty">هنوز دوره ۱۰ معرفی موفق کامل نشده است.</div>'}</div></article></section>
    <section class="refv2-card"><header class="refv2-head"><div><h3>وضعیت معرفی‌های من</h3><p>از استفاده از کد تا تأیید شما، تأیید مدیر و ورود به قرارداد را یکجا پیگیری کنید.</p></div></header><div class="refv2-body">${cases.length?`<div class="refv2-list">${cases.map(item=>{const status=item.effectiveStatus||item.status;return `<article class="refv2-item"><div><strong>${esc(item.referredName||'مراقب معرفی‌شده')}</strong><small>${dateTimeFa(item.createdAt)}<br>${esc(caseDetail(item))}</small></div><div class="refv2-side"><span class="refv2-badge ${statusClass(status)}">${esc(statusLabels[status]||status)}</span><span class="refv2-amount">قطعی: ${money(confirmedAmount(item))}</span></div></article>`}).join('')}</div>`:'<div class="refv2-empty">هنوز مراقبی با کد معرف شما ثبت‌نام نکرده است.</div>'}</div></section>`;
}

async function renderWallet(){
  if(!isWallet())return;
  const content=$('#content');if(!content)return;
  let root=$('#caregiverReferralRewardsV2');
  if(!root){root=document.createElement('section');root.id='caregiverReferralRewardsV2';root.className='refv2-root';root.innerHTML='<div class="refv2-card"><div class="refv2-loading">در حال دریافت وضعیت معرفی و اعتبارات…</div></div>';content.appendChild(root)}
  $$('#caregiverReferralRewardsV1').forEach(node=>{if(!node.classList.contains('refv2-old-hidden'))node.classList.add('refv2-old-hidden')});
  try{
    const data=await loadData();if(!isWallet()||!root.isConnected)return;
    const signature=walletSignature(data);
    if(root.dataset.refv2Signature!==signature){root.dataset.refv2Signature=signature;root.innerHTML=walletMarkup(data)}
  }catch(error){const signature=`error:${error.message}`;if(root.isConnected&&root.dataset.refv2Signature!==signature){root.dataset.refv2Signature=signature;root.innerHTML=`<div class="refv2-error">${esc(error.message||'اطلاعات معرفی دریافت نشد.')}</div>`}}
}

async function renderDashboardCode(){
  if(!isDashboard())return;
  const side=$('.cgr3-dashboard-side')||$('.cgp-hero-side');if(!side)return;
  try{
    const data=await loadData();if(!isDashboard()||!side.isConnected)return;
    const code=data?.caregiver?.referralCode||'—',pending=Number(data?.summary?.awaitingMyConfirmation||0),signature=`${code}:${pending}`;
    let card=$('#referralDashboardCodeV2');
    if(!card){card=document.createElement('div');card.id='referralDashboardCodeV2';card.className='refv2-dashboard-code';side.prepend(card)}
    if(card.dataset.refv2Signature!==signature){card.dataset.refv2Signature=signature;card.innerHTML=`<small>کد معرف من</small><span class="refv2-dashboard-row"><strong>${esc(code)}</strong><button type="button" class="refv2-dashboard-copy" data-refv2-copy="${esc(code)}">کپی</button></span>${pending?`<small class="refv2-dashboard-pending">${fa(pending)} معرفی منتظر تأیید شما</small>`:''}`}
  }catch{}
}

async function decide(id,action){
  if(state.decisionBusy)return;
  state.decisionBusy=true;
  try{
    let note='';if(action==='REJECT')note=window.prompt('در صورت تمایل علت رد معرفی را بنویسید:','')||'';
    await api(`${ENDPOINT}/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({action,note})});
    toast(action==='CONFIRM'?'معرفی تأیید شد':'معرفی رد شد',action==='CONFIRM'?'پرونده برای بررسی مدیر سامانه ارسال شد.':'این معرفی برای مدیر ارسال نمی‌شود.');
    state.data=null;state.lastLoadedAt=0;await renderWallet();await renderDashboardCode();
  }catch(error){toast('ثبت تصمیم انجام نشد',error.message||'دوباره تلاش کنید.')}finally{state.decisionBusy=false}
}

function bindEvents(){
  if(document.documentElement.dataset.refv2Events)return;
  document.documentElement.dataset.refv2Events='1';
  document.addEventListener('click',event=>{
    const copy=event.target.closest?.('[data-refv2-copy]');if(copy){event.preventDefault();copyCode(copy.dataset.refv2Copy);return}
    const confirm=event.target.closest?.('[data-refv2-confirm]');if(confirm){event.preventDefault();decide(confirm.dataset.refv2Confirm,'CONFIRM');return}
    const reject=event.target.closest?.('[data-refv2-reject]');if(reject){event.preventDefault();decide(reject.dataset.refv2Reject,'REJECT')}
  });
}

function enforce(){state.scheduled=false;addStyles();enhanceSignup();if(!caregiverActive())return;renderDashboardCode();renderWallet();if(!isWallet())$('#caregiverReferralRewardsV2')?.remove()}
function schedule(){if(state.scheduled)return;state.scheduled=true;requestAnimationFrame(enforce)}
function observe(){
  bindEvents();schedule();
  const targets=['#content','#sidebarNav','#caregiverSignupLayer'].map(selector=>$(selector)).filter(Boolean);
  for(const target of targets)new MutationObserver(schedule).observe(target,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('focus',schedule,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.SalamatReferralRewardsExperienceV2={version:VERSION,refresh:async()=>{state.data=null;state.lastLoadedAt=0;schedule()}};
})();