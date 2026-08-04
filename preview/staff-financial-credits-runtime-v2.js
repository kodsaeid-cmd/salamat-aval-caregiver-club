(()=>{
'use strict';
if(window.__salamatStaffFinancialCreditsRuntimeV2)return;
window.__salamatStaffFinancialCreditsRuntimeV2=true;

// VERSION is kept for the existing production asset contract. HUB_VERSION is
// the functional release of the rebuilt financial operations workspace.
const VERSION='2.0.0';
const HUB_VERSION='3.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const money=value=>`${fa(value)} تومان`;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const pdate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return String(value)}};
const statusText=value=>({REQUESTED:'در انتظار بررسی',UNDER_REVIEW:'در حال بررسی',APPROVED:'تأییدشده',REJECTED:'ردشده',PAID:'پرداخت‌شده',CANCELLED:'لغوشده',ELIGIBLE:'واجد شرایط',IN_PROGRESS:'در حال تکمیل سابقه',PAUSED:'سابقه متوقف',NO_CONTRACTS:'فاقد سابقه قرارداد'}[String(value||'').toUpperCase()]||String(value||'—'));
const txText=value=>({ADMIN_TOPUP:'شارژ مدیریتی',ADMIN_DEBIT:'برداشت مدیریتی',REFERRAL_REWARD:'پاداش معرفی پرونده',SETTLEMENT:'تسویه کیف پول'}[String(value||'').toUpperCase()]||String(value||'—'));
const state={
  access:null,dashboard:null,tab:'overview',loading:false,error:'',
  directory:{items:[],query:'',page:1,pageSize:25,total:0,pages:1,loading:false},
  detail:null,detailLoading:false,
  walletCandidates:[],walletQuery:'',selectedCaregiver:null,
  settlementFilter:'',creditFilter:'',requestQuery:'',decision:null,
};

async function api(path,options={}){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  try{
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers,signal:controller.signal});
    const text=await response.text();let payload={};
    try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
    if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.payload=payload;throw error}
    return payload;
  }catch(error){if(error?.name==='AbortError')throw new Error('پاسخ سامانه بیش از حد طول کشید. دوباره تلاش کنید.');throw error}
  finally{clearTimeout(timeout)}
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function actions(){return state.access?.allModules?.find(module=>module.key==='staff.financial_credits')?.actions||{}}
function can(action){return Boolean(actions()[action])}
function setPage(html){
  const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
  if(title)title.textContent='اعتبارات مالی';
  if(subtitle)subtitle.textContent='مرکز مبادلات مالی، کیف پول، تسویه و اعتبار ۵۰۰ میلیونی مراقبین';
  if(content)content.innerHTML=`<section class="module-page fch-root" data-finance-hub-version="${HUB_VERSION}">${html}</section>`;
}
function addStyles(){
  if($('#financialCreditsHubStylesV3'))return;
  const style=document.createElement('style');style.id='financialCreditsHubStylesV3';style.textContent=`
.fch-root{direction:rtl;display:grid;gap:14px;color:#17392a}.fch-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.fch-head h2{margin:0;font-size:22px}.fch-head p{margin:6px 0 0;color:#718078;font-size:10px;line-height:1.9}.fch-tabs,.fch-actions,.fch-filters,.fch-pagination{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.fch-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.fch-btn.primary,.fch-btn.active{background:#078848;color:#fff}.fch-btn.danger{background:#ffe9ec;color:#ad2940}.fch-btn.warn{background:#fff1da;color:#8d6108}.fch-btn.neutral{background:#eef2f0;color:#4f6259}.fch-btn:disabled{opacity:.45;pointer-events:none}.fch-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.fch-kpi,.fch-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 10px 28px rgba(22,70,46,.04)}.fch-kpi{padding:15px}.fch-kpi small{display:block;color:#77867e;font-size:8px}.fch-kpi strong{display:block;margin-top:8px;color:#087a45;font-size:18px;line-height:1.4}.fch-card{overflow:hidden}.fch-card-head{padding:14px 16px;border-bottom:1px solid #eaf0ed;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.fch-card-head h3{margin:0;font-size:14px}.fch-card-head p{margin:5px 0 0;color:#7a8981;font-size:8px;line-height:1.8}.fch-card-body{padding:14px}.fch-grid{display:grid;grid-template-columns:minmax(320px,.8fr) minmax(0,1.2fr);gap:12px;align-items:start}.fch-list{display:grid;gap:8px}.fch-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid #e0eae5;border-radius:14px;background:#fff}.fch-row.clickable{cursor:pointer}.fch-row.clickable:hover{border-color:#6fc59c;background:#f8fcfa}.fch-row strong{display:block;font-size:10px}.fch-row small{display:block;margin-top:5px;color:#718078;font-size:8px;line-height:1.9}.fch-table{width:100%;border-collapse:separate;border-spacing:0 7px}.fch-table th{padding:0 10px 5px;color:#78877f;font-size:8px;text-align:right}.fch-table td{padding:11px 10px;background:#fff;border-top:1px solid #e1ebe6;border-bottom:1px solid #e1ebe6;font-size:8px;vertical-align:middle}.fch-table td:first-child{border-right:1px solid #e1ebe6;border-radius:0 13px 13px 0}.fch-table td:last-child{border-left:1px solid #e1ebe6;border-radius:13px 0 0 13px}.fch-badge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:7px;font-weight:900;white-space:nowrap}.fch-badge.red{background:#ffe9ec;color:#ad2940}.fch-badge.orange{background:#fff1da;color:#8d6108}.fch-badge.gray{background:#eef2f0;color:#596b62}.fch-empty{padding:34px;text-align:center;border:1px dashed #cfddd6;border-radius:16px;color:#6d7b74;background:#fbfdfc;line-height:2}.fch-input,.fch-select,.fch-textarea{width:100%;box-sizing:border-box;border:1px solid #d7e3dd;border-radius:11px;padding:10px;font:inherit;font-size:9px;outline:none;background:#fff;color:#223d31}.fch-textarea{min-height:84px;resize:vertical}.fch-input:focus,.fch-select:focus,.fch-textarea:focus{border-color:#55b286;box-shadow:0 0 0 3px rgba(31,151,91,.08)}.fch-field{display:grid;gap:5px}.fch-field>span{font-size:8px;font-weight:900;color:#40564a}.fch-form{display:grid;gap:9px}.fch-form.two{grid-template-columns:repeat(2,minmax(0,1fr))}.fch-form .full{grid-column:1/-1}.fch-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.fch-note{padding:11px 12px;border-radius:12px;background:#f3f9f6;color:#607269;font-size:8px;line-height:1.9}.fch-note.warn{background:#fff7e8;color:#72510d}.fch-progress{height:7px;border-radius:999px;background:#e8efeb;overflow:hidden;margin-top:7px}.fch-progress>i{display:block;height:100%;background:#0b9254;border-radius:inherit}.fch-person{display:flex;align-items:center;gap:9px}.fch-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#e7f5ee;color:#087747;font-size:10px;font-weight:900;flex:0 0 auto}.fch-finance-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.fch-mini{padding:9px;border:1px solid #e2ebe7;border-radius:12px;background:#fbfdfc}.fch-mini small{display:block;color:#78877f;font-size:7px}.fch-mini strong{display:block;margin-top:5px;font-size:9px}.fch-detail{display:grid;gap:11px}.fch-overlay{position:fixed;inset:0;z-index:9998;background:rgba(12,32,23,.42);display:grid;place-items:center;padding:16px}.fch-modal{width:min(520px,100%);background:#fff;border-radius:20px;box-shadow:0 25px 70px rgba(0,0,0,.2);overflow:hidden}.fch-modal-head{padding:16px;border-bottom:1px solid #e5ede9;display:flex;justify-content:space-between;gap:10px}.fch-modal-head h3{margin:0;font-size:15px}.fch-modal-body{padding:16px;display:grid;gap:10px}.fch-modal-foot{padding:12px 16px;border-top:1px solid #e5ede9;display:flex;justify-content:flex-end;gap:7px}.fch-loading{padding:45px;text-align:center;color:#718078}.fch-money-credit{color:#078848;font-weight:900}.fch-money-debit{color:#b4374c;font-weight:900}@media(max-width:1050px){.fch-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.fch-grid{grid-template-columns:1fr}.fch-table{min-width:850px}.fch-table-wrap{overflow:auto}}@media(max-width:650px){.fch-kpis,.fch-form.two,.fch-finance-values{grid-template-columns:1fr}.fch-head{display:grid}.fch-tabs{overflow:auto;flex-wrap:nowrap;padding-bottom:4px}.fch-tabs .fch-btn{white-space:nowrap}.fch-row{grid-template-columns:1fr}.fch-actions{justify-content:flex-start}}
`;document.head.appendChild(style);
}
function initials(name){const parts=String(name||'مراقب').trim().split(/\s+/);return (parts[0]?.[0]||'م')+(parts[1]?.[0]||'')}
function badgeClass(status){const value=String(status||'').toUpperCase();if(['REJECTED','CANCELLED'].includes(value))return 'red';if(['REQUESTED','UNDER_REVIEW','APPROVED','IN_PROGRESS','PAUSED'].includes(value))return 'orange';if(['NO_CONTRACTS'].includes(value))return 'gray';return ''}
function badge(status){return `<span class="fch-badge ${badgeClass(status)}">${esc(statusText(status))}</span>`}
function eligibilityText(item){
  if(!item)return 'اطلاعات سابقه موجود نیست';
  if(item.eligible)return `واجد شرایط وام ${money(item.amountToman||500000000)}`;
  const duration=item.remainingDuration||{};
  return `${fa(duration.months||0)} ماه و ${fa(duration.days||0)} روز تا احراز شرایط`;
}
function tabs(){
  const entries=[['overview','نمای کلی'],['caregivers','پرونده‌های مالی'],['settlements','درخواست‌های تسویه'],['credits','اعتبار و وام'],['wallet','شارژ و اصلاح کیف پول']];
  return `<nav class="fch-tabs">${entries.map(([key,label])=>`<button class="fch-btn ${state.tab===key?'active':''}" data-fch-tab="${key}">${label}</button>`).join('')}</nav>`;
}
function header(){return `<header class="fch-head"><div><h2>مرکز مبادلات مالی باشگاه مراقبین</h2><p>منبع واحد کیف پول، پاداش معرفی پرونده، تسویه و اعتبار ۵۰۰ میلیونی؛ تمام تصمیم‌ها با دلیل و ثبت حسابرسی.</p></div>${tabs()}</header>`}
function overview(){
  const data=state.dashboard||{},s=data.summary||{};
  const requests=[...(data.settlements||[]).slice(0,4).map(item=>({...item,kind:'تسویه',amount:item.amountToman})),...(data.creditRequests||[]).slice(0,4).map(item=>({...item,kind:'اعتبار',amount:item.requestedAmountToman}))].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,7);
  const transactions=(data.recentTransactions||[]).slice(0,8);
  return `<section class="fch-kpis">
    <article class="fch-kpi"><small>مانده کل کیف پول مراقبین</small><strong>${money(s.totalWalletBalance||0)}</strong></article>
    <article class="fch-kpi"><small>تسویه‌های در انتظار</small><strong>${fa(s.settlementRequested||0)} درخواست</strong><small>${money(s.settlementRequestedToman||0)}</small></article>
    <article class="fch-kpi"><small>درخواست اعتبار باز</small><strong>${fa(s.creditRequested||0)}</strong><small>وام ثابت ۵۰۰ میلیون تومان</small></article>
    <article class="fch-kpi"><small>حجم تسویه پرداخت‌شده</small><strong>${money(s.paidSettlementToman||0)}</strong></article>
  </section>
  <section class="fch-grid">
    <article class="fch-card"><header class="fch-card-head"><div><h3>آخرین درخواست‌های مالی</h3><p>درخواست‌های مراقبین از همان رکوردهای پنل مراقب خوانده می‌شود.</p></div></header><div class="fch-card-body"><div class="fch-list">${requests.length?requests.map(item=>`<div class="fch-row"><div><strong>${esc(item.caregiverName)} • ${esc(item.kind)}</strong><small>${money(item.amount)} • ${pdate(item.createdAt)}${item.decisionNote?`<br>دلیل: ${esc(item.decisionNote)}`:''}</small></div>${badge(item.status)}</div>`).join(''):'<div class="fch-empty">درخواست مالی ثبت نشده است.</div>'}</div></div></article>
    <article class="fch-card"><header class="fch-card-head"><div><h3>آخرین گردش‌های کیف پول</h3><p>دفتر کیف پول تغییرناپذیر است و هر شارژ یا برداشت منشأ مشخص دارد.</p></div></header><div class="fch-card-body"><div class="fch-list">${transactions.length?transactions.map(item=>`<div class="fch-row"><div><strong>${esc(item.caregiverName)} • ${esc(txText(item.transactionType))}</strong><small>${esc(item.title||'')} • ${pdate(item.createdAt)}<br>${esc(item.createdByName||'ثبت سیستمی')}</small></div><span class="${item.direction==='DEBIT'?'fch-money-debit':'fch-money-credit'}">${item.direction==='DEBIT'?'−':'+'}${money(item.amountToman)}</span></div>`).join(''):'<div class="fch-empty">گردش کیف پول ثبت نشده است.</div>'}</div></div></article>
  </section>`;
}
function directoryFilters(){return `<form class="fch-filters" id="fchDirectorySearch"><input class="fch-input" style="min-width:260px" name="query" value="${esc(state.directory.query)}" placeholder="نام، کد عضویت، موبایل یا کد ملی"><button class="fch-btn primary" type="submit">جست‌وجو</button><button class="fch-btn neutral" type="button" data-fch-directory-clear>پاک‌کردن</button></form>`}
function caregivers(){
  const d=state.directory;
  const rows=d.items||[];
  return `<article class="fch-card"><header class="fch-card-head"><div><h3>پرونده مالی مراقبین</h3><p>مانده، مبلغ قابل تسویه، درخواست‌های باز و فاصله تا وام ۵۰۰ میلیونی.</p></div>${directoryFilters()}</header><div class="fch-card-body">${d.loading?'<div class="fch-loading">در حال دریافت پرونده‌های مالی...</div>':rows.length?`<div class="fch-table-wrap"><table class="fch-table"><thead><tr><th>مراقب</th><th>مانده کیف پول</th><th>قابل تسویه</th><th>درخواست باز</th><th>وضعیت وام</th><th>پیشرفت</th><th></th></tr></thead><tbody>${rows.map(item=>{const wallet=item.wallet||{},credit=item.creditEligibility||{};return `<tr><td><div class="fch-person"><span class="fch-avatar">${esc(initials(item.fullName))}</span><span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||'بدون کد')} • ${esc(item.mobile||'')}</small></span></div></td><td><strong>${money(wallet.balanceToman||0)}</strong></td><td>${money(wallet.availableToman||0)}</td><td>${wallet.openSettlementCount?`<span class="fch-badge orange">${fa(wallet.openSettlementCount)} تسویه</span>`:'—'}</td><td>${badge(credit.status)}<small>${esc(eligibilityText(credit))}</small></td><td><strong>${fa(credit.progressPercent||0)}٪</strong><div class="fch-progress"><i style="width:${clamp(Number(credit.progressPercent||0),0,100)}%"></i></div></td><td><button class="fch-btn" data-fch-caregiver-detail="${esc(item.id)}">مشاهده</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="fch-empty">مراقبی با این مشخصات پیدا نشد.</div>'}
  <div class="fch-pagination" style="margin-top:12px"><button class="fch-btn" data-fch-page="${d.page-1}" ${d.page<=1?'disabled':''}>صفحه قبل</button><span class="fch-note">صفحه ${fa(d.page)} از ${fa(d.pages)} • ${fa(d.total)} مراقب</span><button class="fch-btn" data-fch-page="${d.page+1}" ${d.page>=d.pages?'disabled':''}>صفحه بعد</button></div></div></article>${detailCard()}`;
}
function detailCard(){
  if(state.detailLoading)return '<article class="fch-card"><div class="fch-loading">در حال دریافت پرونده مالی مراقب...</div></article>';
  const data=state.detail;if(!data)return '';
  const c=data.caregiver||{},w=data.wallet||{},e=data.creditEligibility||{},tx=data.transactions||[],settlements=data.settlements||[],credits=data.creditRequests||[];
  return `<article class="fch-card"><header class="fch-card-head"><div><h3>پرونده مالی ${esc(c.fullName)}</h3><p>${esc(c.membershipCode||'')} • ${esc(c.mobile||'')} • ${esc(c.fileStatus||'')}</p></div><div class="fch-actions"><button class="fch-btn primary" data-fch-select-wallet="${esc(c.id)}">شارژ یا اصلاح کیف پول</button><button class="fch-btn neutral" data-fch-close-detail>بستن</button></div></header><div class="fch-card-body fch-detail">
    <section class="fch-finance-values"><div class="fch-mini"><small>مانده کیف پول</small><strong>${money(w.balanceToman||0)}</strong></div><div class="fch-mini"><small>قابل تسویه</small><strong>${money(w.availableToman||0)}</strong></div><div class="fch-mini"><small>تسویه در جریان</small><strong>${money(w.pendingSettlementToman||0)}</strong></div></section>
    <div class="fch-note ${e.eligible?'':'warn'}"><strong>${esc(eligibilityText(e))}</strong><br>سابقه پیوسته: ${fa(e.continuous?.longestDays||0)} از ${fa(e.continuous?.targetDays||730)} روز • سابقه تجمیعی: ${fa(e.cumulative?.days||0)} از ${fa(e.cumulative?.targetDays||1200)} روز${e.projectedEligibilityDate?` • تاریخ برآوردی: ${pdate(e.projectedEligibilityDate)}`:''}</div>
    <section class="fch-grid"><div><h3 style="font-size:12px">گردش کیف پول</h3><div class="fch-list">${tx.length?tx.slice(0,30).map(item=>`<div class="fch-row"><div><strong>${esc(txText(item.transactionType))}</strong><small>${esc(item.title||'')} • ${pdate(item.createdAt)}${item.description?`<br>${esc(item.description)}`:''}</small></div><span class="${item.direction==='DEBIT'?'fch-money-debit':'fch-money-credit'}">${item.direction==='DEBIT'?'−':'+'}${money(item.amountToman)}</span></div>`).join(''):'<div class="fch-empty">گردشی ثبت نشده است.</div>'}</div></div><div><h3 style="font-size:12px">سوابق درخواست</h3><div class="fch-list">${[...settlements.map(item=>({...item,label:'تسویه',amount:item.amountToman})),...credits.map(item=>({...item,label:'اعتبار',amount:item.requestedAmountToman}))].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,20).map(item=>`<div class="fch-row"><div><strong>${esc(item.label)} • ${money(item.amount)}</strong><small>${pdate(item.createdAt)}${item.decisionNote?`<br>دلیل تصمیم: ${esc(item.decisionNote)}`:''}</small></div>${badge(item.status)}</div>`).join('')||'<div class="fch-empty">درخواستی ثبت نشده است.</div>'}</div></div></section>
  </div></article>`;
}
function requestToolbar(kind){const isSettlement=kind==='settlement',value=isSettlement?state.settlementFilter:state.creditFilter;return `<form class="fch-filters" data-fch-request-filter="${kind}"><input class="fch-input" style="min-width:220px" name="query" value="${esc(state.requestQuery)}" placeholder="جست‌وجوی نام، کد یا موبایل"><select class="fch-select" name="status"><option value="">همه وضعیت‌ها</option>${(isSettlement?['REQUESTED','APPROVED','REJECTED','PAID','CANCELLED']:['REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED']).map(status=>`<option value="${status}" ${value===status?'selected':''}>${statusText(status)}</option>`).join('')}</select><button class="fch-btn primary" type="submit">اعمال فیلتر</button></form>`}
function settlements(){
  const rows=state.dashboard?.settlements||[];
  return `<article class="fch-card"><header class="fch-card-head"><div><h3>درخواست‌های تسویه کیف پول</h3><p>تأیید، رد و ثبت پرداخت فقط با دلیل و شماره پیگیری انجام می‌شود.</p></div>${requestToolbar('settlement')}</header><div class="fch-card-body"><div class="fch-list">${rows.length?rows.map(item=>`<div class="fch-row"><div><strong>${esc(item.caregiverName)} • ${money(item.amountToman)}</strong><small>${esc(item.membershipCode||'')} • ${esc(item.mobile||'')}<br>${esc(item.accountHolderName||'')} • ${esc(item.iban||item.accountNumber||'')} • ${pdate(item.createdAt)}${item.decisionNote?`<br>دلیل تصمیم: ${esc(item.decisionNote)}`:''}</small></div><div class="fch-actions">${badge(item.status)}${can('update')&&item.status==='REQUESTED'?`<button class="fch-btn primary" data-fch-decision-kind="settlement" data-fch-decision-id="${esc(item.id)}" data-fch-decision="APPROVED">تأیید</button><button class="fch-btn danger" data-fch-decision-kind="settlement" data-fch-decision-id="${esc(item.id)}" data-fch-decision="REJECTED">رد</button>`:''}${can('update')&&item.status==='APPROVED'?`<button class="fch-btn primary" data-fch-decision-kind="settlement" data-fch-decision-id="${esc(item.id)}" data-fch-decision="PAID">ثبت پرداخت</button><button class="fch-btn danger" data-fch-decision-kind="settlement" data-fch-decision-id="${esc(item.id)}" data-fch-decision="REJECTED">رد</button>`:''}<button class="fch-btn neutral" data-fch-caregiver-detail="${esc(item.caregiverId)}">پرونده مالی</button></div></div>`).join(''):'<div class="fch-empty">درخواستی با این فیلتر وجود ندارد.</div>'}</div></div></article>`;
}
function credits(){
  const rows=state.dashboard?.creditRequests||[];
  return `<article class="fch-card"><header class="fch-card-head"><div><h3>درخواست‌های اعتبار و وام</h3><p>شرط واحد سامانه: ۲۴ ماه پیوسته یا ۴۰ ماه تجمیعی برای اعتبار ۵۰۰ میلیون تومان.</p></div>${requestToolbar('credit')}</header><div class="fch-card-body"><div class="fch-list">${rows.length?rows.map(item=>`<div class="fch-row"><div><strong>${esc(item.caregiverName)} • ${money(item.requestedAmountToman)}</strong><small>${esc(item.membershipCode||'')} • ${esc(item.mobile||'')}<br>پیوسته: ${fa(item.continuousDays||0)} روز • تجمیعی: ${fa(item.cumulativeDays||0)} روز • ${pdate(item.createdAt)}${item.decisionNote?`<br>دلیل تصمیم: ${esc(item.decisionNote)}`:''}</small></div><div class="fch-actions">${badge(item.status)}${can('update')&&item.status==='REQUESTED'?`<button class="fch-btn warn" data-fch-decision-kind="credit" data-fch-decision-id="${esc(item.id)}" data-fch-decision="UNDER_REVIEW">شروع بررسی</button>`:''}${can('update')&&['REQUESTED','UNDER_REVIEW'].includes(item.status)?`<button class="fch-btn primary" data-fch-decision-kind="credit" data-fch-decision-id="${esc(item.id)}" data-fch-decision="APPROVED">تأیید</button><button class="fch-btn danger" data-fch-decision-kind="credit" data-fch-decision-id="${esc(item.id)}" data-fch-decision="REJECTED">رد</button>`:''}${can('update')&&item.status==='APPROVED'?`<button class="fch-btn danger" data-fch-decision-kind="credit" data-fch-decision-id="${esc(item.id)}" data-fch-decision="CANCELLED">لغو اعتبار</button>`:''}<button class="fch-btn neutral" data-fch-caregiver-detail="${esc(item.caregiverId)}">پرونده مالی</button></div></div>`).join(''):'<div class="fch-empty">درخواستی با این فیلتر وجود ندارد.</div>'}</div></div></article>`;
}
function walletCandidateList(){return state.walletCandidates.length?state.walletCandidates.map(item=>`<button type="button" class="fch-row clickable" data-fch-wallet-caregiver="${esc(item.id)}"><div class="fch-person"><span class="fch-avatar">${esc(initials(item.fullName))}</span><span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||'')} • ${esc(item.mobile||'')}</small></span></div><span>${money(item.wallet?.balanceToman||0)}</span></button>`).join(''):'<div class="fch-empty">برای انتخاب مراقب جست‌وجو کنید.</div>'}
function wallet(){
  const selected=state.selectedCaregiver;
  return `<section class="fch-grid"><article class="fch-card"><header class="fch-card-head"><div><h3>انتخاب مراقب</h3><p>جست‌وجو در پرونده‌های واقعی مراقبین و مشاهده مانده فعلی.</p></div></header><div class="fch-card-body"><form class="fch-search" id="fchWalletSearch"><input class="fch-input" name="query" value="${esc(state.walletQuery)}" placeholder="نام، موبایل، کد عضویت یا کد ملی"><button class="fch-btn primary" type="submit">جست‌وجو</button></form><div class="fch-list" style="margin-top:10px">${walletCandidateList()}</div></div></article>
  <article class="fch-card"><header class="fch-card-head"><div><h3>ثبت گردش کیف پول</h3><p>شارژ مدیریتی، پاداش معرفی پرونده یا اصلاح بدهکار با دلیل اجباری.</p></div></header><div class="fch-card-body"><form class="fch-form two" id="fchWalletAdjustmentForm"><div class="fch-note full">مراقب انتخاب‌شده: <strong>${esc(selected?.fullName||'انتخاب نشده')}</strong>${selected?` • مانده فعلی: ${money(selected.wallet?.balanceToman||0)}`:''}</div><label class="fch-field"><span>نوع تراکنش</span><select class="fch-select" name="kind"><option value="TOPUP">شارژ مدیریتی کیف پول</option><option value="REFERRAL_REWARD">پاداش معرفی پرونده مشترک جدید</option><option value="DEBIT">اصلاح بدهکار کیف پول</option></select></label><label class="fch-field"><span>مبلغ به تومان</span><input class="fch-input" name="amountToman" inputmode="numeric" required></label><label class="fch-field"><span>شناسه پرونده معرفی‌شده / مرجع</span><input class="fch-input" name="referenceId" placeholder="برای پاداش معرفی پرونده الزامی است"></label><label class="fch-field"><span>عنوان تراکنش</span><input class="fch-input" name="title" placeholder="مثلاً پاداش معرفی پرونده یا شارژ اصلاحی"></label><label class="fch-field full"><span>دلیل و توضیح ثبت تراکنش</span><textarea class="fch-textarea" name="reason" required placeholder="دلیل ثبت این شارژ یا برداشت را دقیق بنویسید"></textarea></label><button class="fch-btn primary full" type="submit" ${!can('create')||!selected?'disabled':''}>ثبت در دفتر کیف پول</button></form></div></article></section>`;
}
function decisionModal(){
  const d=state.decision;if(!d)return '';
  const labels={APPROVED:'تأیید',REJECTED:'رد',PAID:'ثبت پرداخت',UNDER_REVIEW:'شروع بررسی',CANCELLED:'لغو'};
  return `<div class="fch-overlay" role="dialog" aria-modal="true"><form class="fch-modal" id="fchDecisionForm"><header class="fch-modal-head"><div><h3>${esc(labels[d.decision]||'ثبت تصمیم')}</h3><small>${d.kind==='settlement'?'درخواست تسویه کیف پول':'درخواست اعتبار و وام'}</small></div><button class="fch-btn neutral" type="button" data-fch-close-decision>بستن</button></header><div class="fch-modal-body"><label class="fch-field"><span>دلیل تصمیم</span><textarea class="fch-textarea" name="reason" required placeholder="دلیل تصمیم باید در پرونده مالی ثبت شود"></textarea></label>${d.decision==='PAID'?'<label class="fch-field"><span>شماره پیگیری پرداخت</span><input class="fch-input" name="paymentTrackingNumber" required></label>':''}<div class="fch-note">این تصمیم در سوابق حسابرسی و پرونده مالی مراقب ثبت می‌شود.</div></div><footer class="fch-modal-foot"><button class="fch-btn neutral" type="button" data-fch-close-decision>انصراف</button><button class="fch-btn ${d.decision==='REJECTED'||d.decision==='CANCELLED'?'danger':'primary'}" type="submit">ثبت تصمیم</button></footer></form></div>`;
}
function body(){if(state.tab==='caregivers')return caregivers();if(state.tab==='settlements')return settlements();if(state.tab==='credits')return credits();if(state.tab==='wallet')return wallet();return overview()}
function render(){setPage(`${header()}${state.error?`<div class="fch-note warn">${esc(state.error)}</div>`:''}${body()}${decisionModal()}`)}
function loading(message='در حال دریافت اطلاعات اعتبارات مالی...'){setPage(`<div class="fch-loading">${esc(message)}</div>`)}
async function loadDashboard(){
  const params=new URLSearchParams();if(state.requestQuery)params.set('q',state.requestQuery);if(state.settlementFilter)params.set('settlementStatus',state.settlementFilter);if(state.creditFilter)params.set('creditStatus',state.creditFilter);
  const payload=await api(`/api/staff/financial-credits${params.toString()?`?${params}`:''}`);state.dashboard=payload.data||{};
}
async function loadDirectory(page=state.directory.page){
  state.directory.loading=true;render();
  try{const params=new URLSearchParams({q:state.directory.query,page:String(page),pageSize:String(state.directory.pageSize)});const payload=await api(`/api/staff/financial-credits/caregivers?${params}`);const data=payload.data||{};state.directory.items=data.caregivers||[];state.directory.page=data.pagination?.page||page;state.directory.total=data.pagination?.total||0;state.directory.pages=data.pagination?.pages||1}
  catch(error){state.error=error.message}
  finally{state.directory.loading=false;render()}
}
async function loadDetail(id){
  state.detailLoading=true;state.detail=null;render();
  try{const payload=await api(`/api/staff/financial-credits/caregivers/${encodeURIComponent(id)}`);state.detail=payload.data||null}
  catch(error){state.error=error.message}
  finally{state.detailLoading=false;render()}
}
async function searchWallet(){
  const params=new URLSearchParams({q:state.walletQuery,page:'1',pageSize:'15'});const payload=await api(`/api/staff/financial-credits/caregivers?${params}`);state.walletCandidates=payload.data?.caregivers||[];render();
}
async function open(){
  if(state.loading)return;state.loading=true;state.error='';loading();
  try{const [accessPayload]=await Promise.all([api('/api/access/me'),loadDashboard()]);state.access=accessPayload.data||null;render()}
  catch(error){state.error=error.message;setPage(`<div class="fch-empty"><strong>ماژول اعتبارات مالی بارگذاری نشد</strong><br>${esc(error.message)}<br><button class="fch-btn primary" style="margin-top:12px" data-fch-retry>تلاش دوباره</button></div>`)}
  finally{state.loading=false}
}
async function switchTab(tab){state.tab=tab;state.error='';if(tab==='caregivers'&&!state.directory.items.length)await loadDirectory(1);else render()}
async function submitDecision(form){
  const d=state.decision;if(!d)return;const values=Object.fromEntries(new FormData(form));const path=d.kind==='settlement'?`/api/staff/financial-credits/settlements/${encodeURIComponent(d.id)}`:`/api/staff/financial-credits/credit-requests/${encodeURIComponent(d.id)}`;
  await api(path,{method:'PATCH',body:JSON.stringify({status:d.decision,reason:values.reason,paymentTrackingNumber:values.paymentTrackingNumber||''})});state.decision=null;notify('تصمیم ثبت شد','پرونده مالی مراقب و صف درخواست‌ها به‌روزرسانی شد.');await loadDashboard();if(state.detail?.caregiver?.id)await loadDetail(state.detail.caregiver.id);else render();
}
async function submitWallet(form){
  if(!state.selectedCaregiver)throw new Error('ابتدا مراقب را انتخاب کنید.');const values=Object.fromEntries(new FormData(form));const payload={...values,caregiverId:state.selectedCaregiver.id};await api('/api/staff/financial-credits/wallet-adjustments',{method:'POST',body:JSON.stringify(payload)});notify('گردش کیف پول ثبت شد','تراکنش در دفتر تغییرناپذیر کیف پول ثبت شد.');form.reset();await Promise.all([loadDashboard(),searchWallet()]);const selected=state.walletCandidates.find(item=>item.id===state.selectedCaregiver.id);if(selected)state.selectedCaregiver=selected;render();
}
async function click(event){
  const tab=event.target?.closest?.('[data-fch-tab]');if(tab){event.preventDefault();await switchTab(tab.dataset.fchTab);return}
  if(event.target?.closest?.('[data-fch-retry]')){event.preventDefault();await open();return}
  const page=event.target?.closest?.('[data-fch-page]');if(page){event.preventDefault();await loadDirectory(Number(page.dataset.fchPage||1));return}
  if(event.target?.closest?.('[data-fch-directory-clear]')){event.preventDefault();state.directory.query='';await loadDirectory(1);return}
  const detail=event.target?.closest?.('[data-fch-caregiver-detail]');if(detail){event.preventDefault();await loadDetail(detail.dataset.fchCaregiverDetail);return}
  if(event.target?.closest?.('[data-fch-close-detail]')){event.preventDefault();state.detail=null;render();return}
  const selectWallet=event.target?.closest?.('[data-fch-select-wallet]');if(selectWallet){event.preventDefault();const id=selectWallet.dataset.fchSelectWallet;state.tab='wallet';state.walletQuery=state.detail?.caregiver?.fullName||'';await searchWallet();state.selectedCaregiver=state.walletCandidates.find(item=>item.id===id)||{id,fullName:state.detail?.caregiver?.fullName,wallet:state.detail?.wallet};render();return}
  const walletCaregiver=event.target?.closest?.('[data-fch-wallet-caregiver]');if(walletCaregiver){event.preventDefault();state.selectedCaregiver=state.walletCandidates.find(item=>item.id===walletCaregiver.dataset.fchWalletCaregiver)||null;render();return}
  const decision=event.target?.closest?.('[data-fch-decision-kind]');if(decision){event.preventDefault();state.decision={kind:decision.dataset.fchDecisionKind,id:decision.dataset.fchDecisionId,decision:decision.dataset.fchDecision};render();return}
  if(event.target?.closest?.('[data-fch-close-decision]')){event.preventDefault();state.decision=null;render()}
}
async function submit(event){
  const form=event.target;if(!(form instanceof HTMLFormElement))return;
  try{
    if(form.id==='fchDirectorySearch'){event.preventDefault();state.directory.query=String(new FormData(form).get('query')||'').trim();await loadDirectory(1);return}
    if(form.id==='fchWalletSearch'){event.preventDefault();state.walletQuery=String(new FormData(form).get('query')||'').trim();await searchWallet();return}
    if(form.id==='fchWalletAdjustmentForm'){event.preventDefault();await submitWallet(form);return}
    if(form.id==='fchDecisionForm'){event.preventDefault();await submitDecision(form);return}
    const filter=form.dataset.fchRequestFilter;if(filter){event.preventDefault();const values=Object.fromEntries(new FormData(form));state.requestQuery=String(values.query||'').trim();if(filter==='settlement')state.settlementFilter=String(values.status||'');else state.creditFilter=String(values.status||'');await loadDashboard();render()}
  }catch(error){notify('عملیات مالی انجام نشد',error.message);state.error=error.message;render()}
}
function boot(){addStyles();document.addEventListener('click',event=>void click(event),true);document.addEventListener('submit',event=>void submit(event),true);window.SalamatFinancialCredits={version:HUB_VERSION,assetContract:VERSION,open,reload:open,loadDirectory,loadCaregiver:loadDetail,get state(){return state}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();