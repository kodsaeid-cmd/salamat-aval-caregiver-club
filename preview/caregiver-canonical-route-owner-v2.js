(()=>{
'use strict';
if(window.__salamatCaregiverCanonicalRouteOwnerV2)return;
window.__salamatCaregiverCanonicalRouteOwnerV2=true;

const VERSION='2.0.0';
const BLOCKED_LABELS=['ساعات قرارداد','گزارش امنیت','درجه و رتبه','رتبه و پروانه'];
const SCORECARD_LABELS=['کارنامه کاری','کارنامه حرفه‌ای'];
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const money=value=>`${fa(value)} تومان`;
let dashboardBusy=false;
let scorecardBusy=false;
let observerQueued=false;

async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);
 return payload;
}
function currentRole(){
 try{return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||'').toUpperCase()}catch{return String(window.selectedRole||'').toUpperCase()}
}
function caregiverPanelActive(){
 const app=$('#appView');
 if(!app||app.classList.contains('hidden'))return false;
 const role=currentRole();
 if(role==='CAREGIVER')return true;
 return String($('#sidebarRole')?.textContent||'').includes('مراقب');
}
function labelOf(node){return String(node?.textContent||'').replace(/\s+/g,' ').trim()}
function hasLabel(text,labels){return labels.some(label=>text.includes(label))}
function markActive(button){
 $$('#sidebarNav .nav-item').forEach(item=>item.classList.toggle('active',item===button));
}
function hideBlockedModules(){
 $$('#sidebarNav .nav-item').forEach(button=>{
  const blocked=hasLabel(labelOf(button),BLOCKED_LABELS);
  button.hidden=blocked;
  button.style.display=blocked?'none':'';
  if(blocked){button.setAttribute('aria-hidden','true');button.tabIndex=-1}else{button.removeAttribute('aria-hidden')}
 });
 $$('#content .module-card,#content [data-module-card],#content .cp-action-card').forEach(card=>{
  if(hasLabel(labelOf(card),BLOCKED_LABELS))card.style.display='none';
 });
}
function setPage(title,subtitle,html){
 const pageTitle=$('#pageTitle'),pageSubtitle=$('#pageSubtitle'),content=$('#content');
 if(pageTitle)pageTitle.textContent=title;
 if(pageSubtitle)pageSubtitle.textContent=subtitle;
 if(content)content.innerHTML=`<section class="module-page cgp-root">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
}
function loading(text){return `<div class="cgp-loading"><span></span><strong>${esc(text)}</strong></div>`}
function empty(title,text){return `<div class="cgp-empty"><strong>${esc(title)}</strong><small>${esc(text)}</small></div>`}
function dateFa(value){
 if(!value)return '—';
 try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value))}catch{return String(value)}
}
function statusLabel(value){return ({FINAL:'نهایی',DRAFT:'پیش‌نویس',ACTIVE:'فعال',APPROVED:'تأییدشده',ISSUED:'صادرشده',PAID:'پرداخت‌شده'}[String(value||'').toUpperCase()]||value||'—')}
async function waitFor(test,timeout=1800){
 const started=Date.now();
 while(Date.now()-started<timeout){const value=test();if(value)return value;await new Promise(resolve=>setTimeout(resolve,40))}
 return null;
}
function dashboardMarkup(data){
 const c=data.caregiver||{},contract=data.activeContract||{},evaluation=data.latestEvaluation||{},payroll=data.latestPayroll||{},training=data.training||{},support=data.support||{};
 return `<section class="cgp-hero"><div class="cgp-hero-copy"><span class="cgp-eyebrow">باشگاه مراقبین سلامت اول</span><h2>سلام ${esc(String(c.fullName||'مراقب').split(/\s+/)[0])}، وضعیت حرفه‌ای شما آماده مشاهده است</h2><p>اطلاعات این داشبورد مستقیماً از پرونده، قرارداد، ارزیابی، آموزش، حقوق و کیف پول شما خوانده شده است.</p></div><div class="cgp-hero-side"><div><small>شناسه حرفه‌ای</small><strong>${esc(c.membershipCode||c.id||'—')}</strong></div><div><small>آخرین به‌روزرسانی</small><strong>${dateFa(data.updatedAt)}</strong></div></div></section><section class="cgp-kpis"><article class="cgp-kpi"><small>قرارداد فعال</small><strong>${esc(contract.contractNumber||'—')}</strong><span>${esc(contract.familyName||'قرارداد فعالی ثبت نشده')}</span></article><article class="cgp-kpi"><small>آخرین امتیاز ارزیابی</small><strong>${evaluation.finalScore==null?'—':fa(evaluation.finalScore)}</strong><span>${evaluation.id?statusLabel(evaluation.status):'دوره‌ای ثبت نشده'}</span></article><article class="cgp-kpi"><small>مانده قابل تسویه</small><strong>${money(data.wallet?.availableToman||0)}</strong><span>${money(data.wallet?.pendingSettlementToman||0)} در انتظار</span></article><article class="cgp-kpi"><small>آخرین فیش حقوقی</small><strong>${payroll.netToman==null?'—':money(payroll.netToman)}</strong><span>${esc(payroll.periodTitle||'فیشی صادر نشده')}</span></article></section><section class="cgp-grid"><article class="cgp-card"><header class="cgp-card-head"><div><h3>وضعیت آموزش</h3><p>آموزش‌های تخصیص‌یافته و تکمیل‌شده</p></div></header><div class="cgp-card-body"><div class="cgp-kpis" style="grid-template-columns:repeat(2,1fr)"><div class="cgp-kpi"><small>تخصیص‌یافته</small><strong>${fa(training.assigned||0)}</strong></div><div class="cgp-kpi"><small>تکمیل‌شده</small><strong>${fa(training.completed||0)}</strong></div></div></div></article><article class="cgp-card"><header class="cgp-card-head"><div><h3>پشتیبانی</h3><p>پیام‌ها و درخواست‌های ثبت‌شده</p></div></header><div class="cgp-card-body"><div class="cgp-kpis" style="grid-template-columns:repeat(2,1fr)"><div class="cgp-kpi"><small>گفت‌وگوی باز</small><strong>${fa(support.openCount||0)}</strong></div><div class="cgp-kpi"><small>درخواست فوری</small><strong>${fa(support.urgentCount||0)}</strong></div></div></div></article></section>`;
}
async function renderServerDashboard(){
 if(dashboardBusy||!caregiverPanelActive())return;
 dashboardBusy=true;
 setPage('داشبورد مراقب','اطلاعات واقعی پرونده و عملکرد شما',loading('در حال دریافت داشبورد واقعی از سرور...'));
 try{
  const platform=await waitFor(()=>window.SalamatCaregiverPlatform,700);
  if(platform?.reload){
   await platform.reload();
   const rendered=await waitFor(()=>$('#content .cgp-hero'),1200);
   if(rendered)return;
  }
  const payload=await api('/api/caregiver/platform/dashboard');
  setPage('داشبورد مراقب','آخرین وضعیت ثبت‌شده در سامانه',dashboardMarkup(payload.data||{}));
 }catch(error){
  setPage('داشبورد مراقب','خطا در دریافت اطلاعات',empty('داشبورد بارگذاری نشد',error.message||String(error)));
 }finally{dashboardBusy=false;hideBlockedModules()}
}
async function renderServerScorecard(){
 if(scorecardBusy||!caregiverPanelActive())return;
 scorecardBusy=true;
 setPage('کارنامه کاری','همان کارنامه حرفه‌ای ثبت‌شده در پرونده مراقب',loading('در حال آماده‌سازی کارنامه حرفه‌ای...'));
 try{
  const payload=await api('/api/caregiver/platform/scorecard-record');
  const record=payload.data||{};
  const caregiverId=String(record.id||record.backendId||'').trim();
  if(!caregiverId)throw new Error('پرونده حرفه‌ای متصل به حساب پیدا نشد.');
  const bridge=await waitFor(()=>window.SalamatCaregiverProfessionalBridge?.open?window.SalamatCaregiverProfessionalBridge:null,2500);
  if(!bridge)throw new Error('نمای کارنامه حرفه‌ای آماده نشد.');
  const originalFetch=window.fetch;
  window.fetch=(input,options)=>{
   const url=typeof input==='string'?input:input?.url||'';
   if(String(url).includes('/api/admin/caregiver-record'))return originalFetch('/api/caregiver/platform/scorecard-record',{...options,credentials:'same-origin',cache:'no-store'});
   return originalFetch(input,options);
  };
  try{await bridge.open(caregiverId)}finally{window.fetch=originalFetch}
  if($('#pageTitle'))$('#pageTitle').textContent='کارنامه کاری';
  if($('#pageSubtitle'))$('#pageSubtitle').textContent='همان کارنامه حرفه‌ای قابل مشاهده در پرونده مراقب پنل مدیر';
  if(!$('#content .p3-report'))throw new Error('کارنامه حرفه‌ای نمایش داده نشد.');
 }catch(error){
  setPage('کارنامه کاری','خطا در دریافت کارنامه',empty('کارنامه آماده نشد',error.message||String(error)));
 }finally{scorecardBusy=false;hideBlockedModules()}
}
function isLegacyDashboard(){
 if(!caregiverPanelActive())return false;
 const title=String($('#pageTitle')?.textContent||'');
 const content=$('#content');
 if(!title.includes('داشبورد')||!content||content.querySelector('.cgp-loading'))return false;
 return !content.querySelector('.cgp-hero')&&(content.querySelector('.role-hero,.caregiver-hero-panel')||content.textContent.includes('نسخه نمایشی'));
}
function capture(event){
 if(!caregiverPanelActive())return;
 const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
 if(!button)return;
 const label=labelOf(button);
 if(hasLabel(label,BLOCKED_LABELS)){
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();hideBlockedModules();return;
 }
 if(label.includes('داشبورد')){
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();markActive(button);void renderServerDashboard();return;
 }
 if(hasLabel(label,SCORECARD_LABELS)){
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();markActive(button);void renderServerScorecard();
 }
}
function enforce(){
 hideBlockedModules();
 if(isLegacyDashboard())void renderServerDashboard();
}
function queueEnforce(){
 if(observerQueued)return;
 observerQueued=true;
 queueMicrotask(()=>{observerQueued=false;enforce()});
}
function installObservers(){
 const nav=$('#sidebarNav'),content=$('#content');
 if(nav&&!nav.dataset.caregiverCanonicalObserved){nav.dataset.caregiverCanonicalObserved='true';new MutationObserver(queueEnforce).observe(nav,{childList:true,subtree:true})}
 if(content&&!content.dataset.caregiverCanonicalObserved){content.dataset.caregiverCanonicalObserved='true';new MutationObserver(queueEnforce).observe(content,{childList:true,subtree:true})}
}
function boot(){
 window.addEventListener('click',capture,true);
 window.addEventListener('salamat-authenticated',()=>setTimeout(()=>{installObservers();enforce();void renderServerDashboard()},0));
 window.addEventListener('salamat-access-ready',()=>setTimeout(()=>{installObservers();enforce()},0));
 window.addEventListener('pageshow',()=>setTimeout(()=>{installObservers();enforce()},0));
 let attempts=0;
 const timer=setInterval(()=>{
  attempts+=1;installObservers();enforce();
  if(caregiverPanelActive()&&window.SalamatCaregiverPlatform){clearInterval(timer);if(isLegacyDashboard())void renderServerDashboard()}
  else if(attempts>=120)clearInterval(timer);
 },100);
 window.SalamatCaregiverCanonicalRouteOwner={version:VERSION,openDashboard:renderServerDashboard,openScorecard:renderServerScorecard,cleanNavigation:hideBlockedModules};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
