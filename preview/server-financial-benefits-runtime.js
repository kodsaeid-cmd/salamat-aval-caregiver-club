(()=>{
'use strict';
if(window.__salamatFinancialBenefitsV1)return;
window.__salamatFinancialBenefitsV1=true;

const VERSION='2.0.0';
const ENDPOINT='/api/benefits/summary';
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const money=value=>`${Number(value||0).toLocaleString('fa-IR')} تومان`;
const statusLabels={ELIGIBLE:'واجد شرایط بررسی تسهیلات',IN_PROGRESS:'در حال تکمیل سابقه قرارداد',PAUSED:'سابقه فعلاً متوقف است',NO_CONTRACTS:'قرارداد معتبر ثبت نشده',WAITING_EVALUATION:'منتظر ارزیابی نهایی',SCORE_BELOW_THRESHOLD:'امتیاز ارزیابی کمتر از حد لازم'};
const insuranceLabels={CONFIRMED:'تأیید منابع انسانی',ESTIMATED:'برآورد از قرارداد',EXCLUDED:'غیرمشمول'};
const state={data:null,promise:null,lastLoadedAt:0,timer:0,observers:[]};

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||window.__salamatPanelAccessV2?.user||null}
function role(){return String(currentUser()?.role||'').toUpperCase()}
function isCaregiver(){return role()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب')}
function activeModule(){return $('#sidebarNav [data-caregiver-module-key].active')?.dataset?.caregiverModuleKey||$('#sidebarNav [data-staff-module-key].active')?.dataset?.staffModuleKey||$('#sidebarNav [data-panel-module-key].active')?.dataset?.panelModuleKey||''}
function pageTitle(){return String($('#pageTitle')?.textContent||'').trim()}
function isWallet(){const key=activeModule();return isCaregiver()&&(key==='caregiver.wallet'||/کیف پول|اعتبار/.test(pageTitle()))}
function isInsuranceSurface(){return !isCaregiver()&&/بیمه/.test(pageTitle())}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.detail=payload.detail;throw error}return payload;
}
function pdate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${value}T12:00:00`))}catch{return value}}
function duration(value){const months=Number(value?.months||0),days=Number(value?.days||0);return `${fa(months)} ماه${days?` و ${fa(days)} روز`:''}`}
function comparisonText(item){return `${item?.comparison==='GT'?'بیشتر از':'حداقل'} ${fa(item?.scoreThreshold||item?.evaluation?.threshold||0)}`}
function scoreText(value){return value===null||value===undefined?'—':fa(value)}
function statusClass(status){if(status==='ELIGIBLE')return 'eligible';if(status==='SCORE_BELOW_THRESHOLD')return 'danger';if(status==='WAITING_EVALUATION')return 'waiting';if(status==='PAUSED'||status==='NO_CONTRACTS')return 'paused';return ''}

function addStyles(){
  if($('#financialBenefitsStylesV2'))return;
  const style=document.createElement('style');style.id='financialBenefitsStylesV2';style.textContent=`
.fb2-root{direction:rtl;display:grid;gap:14px;margin:0 0 16px}.fb2-surface{border:1px solid #dce8e2;border-radius:20px;background:#fff;box-shadow:0 10px 30px rgba(22,73,48,.045);overflow:hidden}.fb2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:17px 19px;border-bottom:1px solid #ebf1ee;background:linear-gradient(135deg,#f8fcfa,#f0f8f4)}.fb2-head h2,.fb2-head h3{margin:0;color:#173e2d}.fb2-head h2{font-size:17px}.fb2-head h3{font-size:13px}.fb2-head p{margin:6px 0 0;color:#718179;font-size:9px;line-height:1.9}.fb2-body{padding:17px}.fb2-eval{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.fb2-kpi{border:1px solid #e1ebe6;border-radius:14px;padding:12px;background:#fbfdfc}.fb2-kpi small{display:block;color:#77877f;font-size:8px}.fb2-kpi strong{display:block;margin-top:6px;color:#087a45;font-size:15px}.fb2-allowance{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:17px}.fb2-allowance h3{margin:0;font-size:13px}.fb2-allowance p{margin:6px 0 0;color:#708078;font-size:9px;line-height:1.9}.fb2-amount{text-align:left}.fb2-amount small{display:block;color:#77877f;font-size:8px}.fb2-amount strong{display:block;margin-top:5px;color:#087a45;font-size:21px}.fb2-status{display:inline-flex;margin-top:9px;padding:5px 9px;border-radius:999px;background:#eef5f1;color:#62736a;font-size:8px;font-weight:900}.fb2-status.eligible{background:#e6f7ee;color:#087a45}.fb2-status.waiting{background:#fff4dd;color:#946400}.fb2-status.danger{background:#ffedf0;color:#a82a41}.fb2-status.paused{background:#f1f2f1;color:#6d756f}.fb2-progress{height:8px;background:#e8efeb;border-radius:99px;overflow:hidden;margin-top:11px}.fb2-progress i{display:block;height:100%;background:#078848;border-radius:inherit}.fb2-meta{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;margin-top:7px;color:#74837b;font-size:8px}.fb2-loans{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fb2-loan{border:1px solid #e0e9e4;border-radius:16px;padding:14px;background:#fff}.fb2-loan.eligible{border-color:#a8d9bf;background:#fbfffd}.fb2-loan-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.fb2-loan h4{margin:0;font-size:11px;color:#263d32}.fb2-loan-amount{color:#087a45;font-size:15px;font-weight:900;white-space:nowrap}.fb2-rule{margin:7px 0 0;color:#73827a;font-size:8px;line-height:1.8}.fb2-scoreline{display:flex;justify-content:space-between;gap:8px;margin-top:9px;padding:8px 9px;border-radius:10px;background:#f5f9f7;font-size:8px;color:#5f7167}.fb2-note{padding:12px 14px;border-radius:13px;background:#fff8e9;color:#785d24;font-size:8px;line-height:1.9}.fb2-insurance{padding:17px}.fb2-table-wrap{overflow:auto;border:1px solid #e2eae6;border-radius:14px}.fb2-table{width:100%;border-collapse:collapse;min-width:720px}.fb2-table th,.fb2-table td{padding:10px 11px;text-align:right;border-bottom:1px solid #edf2ef;font-size:8px}.fb2-table th{background:#f7faf8;color:#66766d}.fb2-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:8px;font-weight:900}.fb2-badge.estimated{background:#fff3dc;color:#8c610f}.fb2-empty,.fb2-error,.fb2-loading{padding:25px;text-align:center;border:1px dashed #cfdfd7;border-radius:16px;color:#687870;background:#fbfdfc;font-size:9px;line-height:1.9}.fb2-error{background:#fff5f6;color:#a72b3c}@media(max-width:900px){.fb2-eval{grid-template-columns:repeat(2,1fr)}.fb2-loans{grid-template-columns:1fr}}@media(max-width:620px){.fb2-eval{grid-template-columns:1fr}.fb2-allowance{grid-template-columns:1fr}.fb2-amount{text-align:right}}
`;document.head.appendChild(style);
}

async function summary(force=false){
  if(state.data&&!force&&Date.now()-state.lastLoadedAt<30000)return state.data;
  if(state.promise)return state.promise;
  state.promise=api(ENDPOINT).then(result=>{state.data=result.data||{};state.lastLoadedAt=Date.now();return state.data}).finally(()=>{state.promise=null});return state.promise;
}
function loanRuleText(item){const service=item.serviceMode==='CUMULATIVE'?`${fa(item.targetMonths)} ماه سابقه تجمیعی`:`${fa(item.targetMonths)} ماه قرارداد ممتد`;return `${service} + میانگین امتیاز ${comparisonText(item)}`}
function benefitMeta(item){
  if(item.status==='WAITING_EVALUATION')return 'سابقه لازم تکمیل شده؛ ارزیابی نهایی لازم است.';
  if(item.status==='SCORE_BELOW_THRESHOLD')return `سابقه تکمیل است اما امتیاز فعلی ${scoreText(item.evaluation?.metric)} است.`;
  if(item.eligible)return 'شرایط اولیه سابقه و ارزیابی احراز شده است.';
  if(item.status==='PAUSED')return 'برای ادامه شمارش، قرارداد فعال جدید لازم است.';
  return `${fa(item.remainingDays||0)} روز سابقه تا رسیدن به شرط زمانی باقی مانده است.`;
}
function loanCard(item){
  return `<article class="fb2-loan ${item.eligible?'eligible':''}"><div class="fb2-loan-top"><div><h4>${esc(item.title)}</h4><span class="fb2-status ${statusClass(item.status)}">${esc(statusLabels[item.status]||item.status)}</span></div><div class="fb2-loan-amount">${money(item.amountToman)}</div></div><p class="fb2-rule">${esc(loanRuleText(item))}</p><div class="fb2-progress"><i style="width:${Number(item.progressPercent||0)}%"></i></div><div class="fb2-meta"><span>سابقه محاسبه‌شده: ${duration(item.serviceDuration)}</span><span>${fa(item.progressPercent||0)}٪ زمان</span></div><div class="fb2-scoreline"><span>امتیاز دوره: <b>${scoreText(item.evaluation?.metric)}</b></span><span>تعداد ارزیابی نهایی: ${fa(item.evaluation?.count||0)}</span></div><p class="fb2-rule">${esc(benefitMeta(item))}${item.projectedEligibilityDate?` برآورد زمانی: ${pdate(item.projectedEligibilityDate)}`:''}</p></article>`;
}
function walletMarkup(data){
  const evaluation=data.evaluation||{},allowance=data.allowance||{},loans=Array.isArray(data.loans)?data.loans:[];
  return `<section class="fb2-root" id="caregiverFinancialBenefitsV2"><section class="fb2-surface"><header class="fb2-head"><div><h2>تسهیلات و اعتبارات مبتنی بر ارزیابی</h2><p>شرایط این بخش از سابقه واقعی قرارداد و فقط ارزیابی‌های نهایی‌شده مراقب محاسبه می‌شود.</p></div></header><div class="fb2-body"><div class="fb2-eval"><article class="fb2-kpi"><small>میانگین امتیاز نهایی در سابقه خدمت</small><strong>${scoreText(evaluation.averageScore)}</strong></article><article class="fb2-kpi"><small>کمترین امتیاز نهایی</small><strong>${scoreText(evaluation.minimumScore)}</strong></article><article class="fb2-kpi"><small>آخرین امتیاز نهایی</small><strong>${scoreText(evaluation.latestScore)}</strong></article><article class="fb2-kpi"><small>دوره‌های ارزیابی نهایی</small><strong>${fa(evaluation.finalizedPeriods||0)}</strong></article></div></div></section><section class="fb2-surface"><div class="fb2-allowance"><div><h3>کمک‌هزینه ماندگاری دوماهه</h3><p>پس از دو ماه قرارداد ممتد، به شرط اینکه کمترین امتیاز ارزیابی در دوره مربوطه زیر ۵۰ نیاید.</p><span class="fb2-status ${statusClass(allowance.status)}">${esc(statusLabels[allowance.status]||allowance.status||'—')}</span><div class="fb2-progress"><i style="width:${Number(allowance.progressPercent||0)}%"></i></div><div class="fb2-meta"><span>سابقه: ${duration(allowance.serviceDuration)}</span><span>کمترین امتیاز دوره: ${scoreText(allowance.evaluation?.metric)}</span></div></div><div class="fb2-amount"><small>مبلغ کمک‌هزینه</small><strong>${money(allowance.amountToman||7000000)}</strong></div></div></section><section class="fb2-surface"><header class="fb2-head"><div><h3>پلکان وام مراقبین</h3><p>هر سطح، سابقه قراردادی و حد امتیاز ارزیابی مستقل خودش را دارد.</p></div></header><div class="fb2-body"><div class="fb2-loans">${loans.map(loanCard).join('')}</div></div></section><div class="fb2-note">«واجد شرایط» به معنی احراز خودکار سابقه و امتیاز در باشگاه است؛ پرداخت وام به‌صورت خودکار انجام نمی‌شود و ورود به مرحله تأیید مالی، اعتبارسنجی و پرداخت طبق فرآیند اعتبارات سلامت اول خواهد بود.</div></section>`;
}
function insuranceMarkup(data){
  const insurance=data.insurance||{},contracts=data.contracts||[];const rows=contracts.map(contract=>{const item=contract.insurance||{},status=item.status||'ESTIMATED';return `<tr><td><strong>${esc(contract.contractNumber)}</strong><br><small>${esc(contract.familyName||'—')}</small></td><td>${pdate(item.startsAt)}</td><td>${pdate(item.endsAt)}</td><td>${duration(item.duration)}</td><td><span class="fb2-badge ${status==='ESTIMATED'?'estimated':''}">${esc(insuranceLabels[status]||status)}</span></td></tr>`}).join('');
  return `<section class="fb2-root" id="staffFinancialInsuranceV2"><section class="fb2-surface fb2-insurance"><header class="fb2-head"><div><h3>سوابق بیمه و ماه‌های فعال</h3><p>محاسبه براساس قراردادهای ثبت‌شده و وضعیت بیمه هر قرارداد.</p></div><strong>${duration(insurance.duration)}</strong></header><div class="fb2-body">${rows?`<div class="fb2-table-wrap"><table class="fb2-table"><thead><tr><th>قرارداد</th><th>شروع پوشش</th><th>پایان پوشش</th><th>سابقه</th><th>وضعیت</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="fb2-empty">قرارداد دارای بازه زمانی ثبت نشده است.</div>'}</div></section></section>`;
}
function dataSignature(data,kind){
  if(kind==='wallet')return JSON.stringify([data.benefitsVersion,data.evaluation,data.allowance,(data.loans||[]).map(item=>[item.key,item.status,item.progressPercent,item.evaluation?.metric,item.eligible])]);
  return JSON.stringify([data.insurance,(data.contracts||[]).map(item=>[item.id,item.insurance])]);
}
async function render(kind){
  const content=$('#content');if(!content)return;const id=kind==='wallet'?'caregiverFinancialBenefitsV2':'staffFinancialInsuranceV2';let root=$(`#${id}`);
  if(!root){root=document.createElement('section');root.id=id;root.className='fb2-root';root.innerHTML='<div class="fb2-loading">در حال محاسبه سابقه قرارداد و امتیاز ارزیابی…</div>';content.prepend(root)}
  try{const data=await summary();if((kind==='wallet'&&!isWallet())||(kind==='insurance'&&!isInsuranceSurface())||!root.isConnected)return;const signature=dataSignature(data,kind);if(root.dataset.fb2Signature===signature)return;const html=kind==='wallet'?walletMarkup(data):insuranceMarkup(data);const wrapper=document.createElement('div');wrapper.innerHTML=html;const next=wrapper.firstElementChild;if(next){next.dataset.fb2Signature=signature;root.replaceWith(next)}}catch(error){if(root.isConnected)root.innerHTML=`<div class="fb2-error">${esc(error.message||'اطلاعات تسهیلات دریافت نشد.')}</div>`}
}
function enforce(){
  addStyles();if(isWallet()){$('#staffFinancialInsuranceV2')?.remove();render('wallet');return}if(isInsuranceSurface()){$('#caregiverFinancialBenefitsV2')?.remove();render('insurance');return}$('#caregiverFinancialBenefitsV2')?.remove();$('#staffFinancialInsuranceV2')?.remove();
}
function schedule(delay=140){clearTimeout(state.timer);state.timer=setTimeout(enforce,delay)}
function observeTarget(target,options){if(!target)return;const observer=new MutationObserver(()=>schedule());observer.observe(target,options);state.observers.push(observer)}
function boot(){
  addStyles();schedule(0);observeTarget($('#content'),{childList:true});observeTarget($('#sidebarNav'),{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  window.addEventListener('salamat-access-changed',()=>schedule(0));window.addEventListener('salamat-panel-route-ready',()=>schedule(0));window.addEventListener('popstate',()=>schedule());document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(isWallet()||isInsuranceSurface())&&Date.now()-state.lastLoadedAt>30000)schedule()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.SalamatFinancialBenefits={version:VERSION,refresh:()=>{state.data=null;state.lastLoadedAt=0;schedule(0)}};
})();