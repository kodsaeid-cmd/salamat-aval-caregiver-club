(()=>{
'use strict';

if(window.__salamatFinancialBenefitsV1)return;
window.__salamatFinancialBenefitsV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const money=value=>`${Number(value||0).toLocaleString('fa-IR')} تومان`;
const statusLabels={ELIGIBLE:'شرایط اولیه احراز شده',IN_PROGRESS:'در حال تکمیل سابقه',PAUSED:'شمارش متوقف است',NO_CONTRACTS:'قرارداد تاریخ‌دار ثبت نشده'};
const insuranceLabels={CONFIRMED:'تأیید منابع انسانی',ESTIMATED:'برآورد از قرارداد',EXCLUDED:'غیرمشمول'};
let cache=null;

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||null}
function isCaregiver(){return String(currentUser()?.role||'').toUpperCase()==='CAREGIVER'}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const response=await fetch(path,{credentials:'same-origin',...options});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.detail=payload.detail;throw error}
  return payload;
}
function pdate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${value}T12:00:00`))}catch{return value}}
function duration(value){const months=Number(value?.months||0),days=Number(value?.days||0);return `${fa(months)} ماه${days?` و ${fa(days)} روز`:''}`}
function addStyles(){
  if($('#financialBenefitsStyles'))return;
  const style=document.createElement('style');style.id='financialBenefitsStyles';style.textContent=`
  .fb-root{direction:rtl;margin-bottom:16px}.fb-surface{border:1px solid #dce8e2;border-radius:22px;background:#fff;box-shadow:0 12px 36px rgba(22,73,48,.05);overflow:hidden}.fb-credit-hero{display:grid;grid-template-columns:minmax(0,1.25fr) auto;gap:18px;padding:22px;background:linear-gradient(135deg,#f7fcf9,#eef8f3)}.fb-credit-hero small{color:#087a45;font-size:10px;font-weight:900}.fb-credit-hero h2{margin:6px 0 8px;font-size:22px}.fb-credit-hero p{margin:0;color:#65766d;font-size:10px;line-height:1.9}.fb-amount{display:flex;flex-direction:column;align-items:flex-end;justify-content:center}.fb-amount span{font-size:9px;color:#6f8077}.fb-amount strong{margin-top:6px;color:#078848;font-size:24px}.fb-credit-main{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;padding:20px}.fb-ring{--progress:0;position:relative;width:156px;height:156px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#078848 calc(var(--progress)*1%),#e6efea 0);margin:auto}.fb-ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.fb-ring>div{position:relative;z-index:1;text-align:center}.fb-ring strong{display:block;color:#087a45;font-size:28px}.fb-ring span{display:block;color:#718078;font-size:9px;margin-top:3px}.fb-countdown{text-align:center;margin-top:10px}.fb-countdown b{display:block;font-size:19px;color:#253b30}.fb-countdown span{display:block;margin-top:4px;color:#73827a;font-size:9px;line-height:1.7}.fb-paths{display:grid;gap:10px}.fb-path{border:1px solid #e0e9e4;border-radius:16px;padding:14px}.fb-path header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.fb-path h3{margin:0;font-size:12px}.fb-path p{margin:5px 0 0;color:#76857d;font-size:9px}.fb-path header strong{color:#078848;font-size:16px}.fb-progress{height:9px;border-radius:99px;background:#e8efeb;overflow:hidden;margin:12px 0 8px}.fb-progress i{display:block;height:100%;border-radius:inherit;background:#078848}.fb-path footer{display:flex;justify-content:space-between;gap:8px;color:#687970;font-size:9px}.fb-status{display:inline-flex;margin-top:10px;padding:6px 10px;border-radius:999px;background:#e5f6ed;color:#08743f;font-size:9px;font-weight:900}.fb-status.paused{background:#fff1d9;color:#956000}.fb-note{margin:0 20px 20px;padding:12px 14px;border-radius:13px;background:#fff8e9;color:#785d24;font-size:9px;line-height:1.9}
  .fb-insurance{padding:20px}.fb-insurance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:15px}.fb-insurance-head h2{margin:0;font-size:18px}.fb-insurance-head p{margin:5px 0 0;color:#74837b;font-size:10px}.fb-insurance-total{text-align:left}.fb-insurance-total strong{display:block;color:#078848;font-size:22px}.fb-insurance-total span{font-size:9px;color:#75857c}.fb-insurance-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:14px}.fb-kpi{border:1px solid #e0e9e4;border-radius:14px;padding:12px;background:#fbfdfc}.fb-kpi small{display:block;color:#7a8881;font-size:8px}.fb-kpi strong{display:block;margin-top:6px;font-size:13px;color:#294036}.fb-table-wrap{overflow:auto;border:1px solid #e2eae6;border-radius:15px}.fb-table{width:100%;border-collapse:collapse;min-width:760px}.fb-table th,.fb-table td{padding:11px 12px;text-align:right;border-bottom:1px solid #edf2ef;font-size:9px}.fb-table th{background:#f7faf8;color:#66766d}.fb-table td strong{display:block;font-size:10px}.fb-table td small{display:block;margin-top:4px;color:#7a8881}.fb-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:8px;font-weight:900}.fb-badge.estimated{background:#fff3dc;color:#8c610f}.fb-empty,.fb-error{padding:24px;text-align:center;border:1px dashed #cfdfd7;border-radius:18px;color:#687870;background:#fbfdfc}.fb-error{background:#fff5f6;color:#a72b3c}.fb-loading{padding:18px;text-align:center;color:#718078;font-size:10px}
  @media(max-width:850px){.fb-credit-hero{grid-template-columns:1fr}.fb-amount{align-items:flex-start}.fb-credit-main{grid-template-columns:1fr}.fb-insurance-kpis{grid-template-columns:1fr}.fb-insurance-head{flex-direction:column}.fb-insurance-total{text-align:right}}
  `;document.head.appendChild(style);
}
function loadingPanel(kind){return `<section class="fb-root"><div class="fb-loading">در حال محاسبه ${kind==='wallet'?'اعتبار':'سابقه بیمه'} از قراردادهای ثبت‌شده...</div></section>`}
function creditMarkup(data){
  const credit=data.credit,rules=data.rules,status=statusLabels[credit.status]||credit.status;
  const countdown=credit.eligible?'شرایط سابقه تکمیل شده':`${fa(credit.remainingActiveDays)} روز قرارداد فعال`;
  const countdownCaption=credit.eligible?'امکان ورود به مرحله بررسی و اعتبارسنجی نهایی':credit.status==='PAUSED'?'تا ثبت قرارداد فعال جدید، روزشمار پیش نمی‌رود':'تا نزدیک‌ترین مسیر احراز اعتبار';
  return `<section class="fb-root fb-surface"><header class="fb-credit-hero"><div><small>اعتبارات و اعتبارسنجی مراقب</small><h2>مسیر اعتبار رفاهی باشگاه مراقبین</h2><p>احراز سابقه با یکی از دو مسیر انجام می‌شود: ${fa(rules.continuousTargetMonths)} ماه قرارداد فعال پیوسته یا ${fa(rules.cumulativeTargetMonths)} ماه قرارداد فعال ناپیوسته.</p><span class="fb-status ${['PAUSED','NO_CONTRACTS'].includes(credit.status)?'paused':''}">${esc(status)}</span></div><div class="fb-amount"><span>سقف اعتبار پس از احراز شرایط</span><strong>${money(rules.creditAmountToman)}</strong></div></header><div class="fb-credit-main"><div><div class="fb-ring" style="--progress:${Number(credit.progressPercent||0)}"><div><strong>${fa(credit.progressPercent)}٪</strong><span>پیشرفت اعتبار</span></div></div><div class="fb-countdown"><b>${countdown}</b><span>${countdownCaption}${credit.projectedEligibilityDate?`<br>برآورد احراز: ${pdate(credit.projectedEligibilityDate)}`:''}</span></div></div><div class="fb-paths"><article class="fb-path"><header><div><h3>مسیر اول: سابقه پیوسته</h3><p>${fa(rules.continuousTargetMonths)} ماه قرارداد فعال بدون وقفه</p></div><strong>${fa(credit.continuous.progressPercent)}٪</strong></header><div class="fb-progress"><i style="width:${credit.continuous.progressPercent}%"></i></div><footer><span>بیشترین سابقه پیوسته: ${duration(credit.continuous.duration)}</span><span>${fa(credit.continuous.remainingDays)} روز باقی‌مانده</span></footer></article><article class="fb-path"><header><div><h3>مسیر دوم: سابقه تجمیعی</h3><p>${fa(rules.cumulativeTargetMonths)} ماه قرارداد فعال، حتی با وقفه</p></div><strong>${fa(credit.cumulative.progressPercent)}٪</strong></header><div class="fb-progress"><i style="width:${credit.cumulative.progressPercent}%"></i></div><footer><span>مجموع سابقه فعال: ${duration(credit.cumulative.duration)}</span><span>${fa(credit.cumulative.remainingDays)} روز فعال باقی‌مانده</span></footer></article></div></div><p class="fb-note">این بخش احراز سابقه قراردادی را نمایش می‌دهد. تکمیل سابقه به‌تنهایی به معنی تصویب قطعی وام نیست و پرداخت اعتبار منوط به اعتبارسنجی نهایی، مقررات سازمان و تأیید تأمین‌کننده مالی خواهد بود.</p></section>`;
}
function insuranceMarkup(data){
  const insurance=data.insurance,contracts=data.contracts||[];
  const rows=contracts.map(contract=>{const item=contract.insurance,status=item.status||'ESTIMATED';return `<tr><td><strong>${esc(contract.contractNumber)}</strong><small>${esc(contract.familyName||'—')}</small></td><td>${pdate(item.startsAt)}</td><td>${pdate(item.endsAt)}</td><td>${duration(item.duration)}</td><td><span class="fb-badge ${status==='ESTIMATED'?'estimated':''}">${esc(insuranceLabels[status]||status)}</span></td></tr>`}).join('');
  return `<section class="fb-root fb-surface fb-insurance"><header class="fb-insurance-head"><div><h2>سوابق بیمه و ماه‌های فعال</h2><p>محاسبه براساس بازه قراردادهای ثبت‌شده و وضعیت بیمه هر قرارداد انجام می‌شود.</p></div><div class="fb-insurance-total"><strong>${duration(insurance.duration)}</strong><span>کل سابقه بیمه ثبت‌شده</span></div></header><div class="fb-insurance-kpis"><article class="fb-kpi"><small>وضعیت جاری بیمه</small><strong>${insurance.active?'فعال':'غیرفعال'}</strong></article><article class="fb-kpi"><small>سابقه تأییدشده منابع انسانی</small><strong>${duration(insurance.confirmedDuration)}</strong></article><article class="fb-kpi"><small>سابقه برآوردی از قرارداد</small><strong>${duration({months:Math.floor(Number(insurance.estimatedDays||0)/30),days:Number(insurance.estimatedDays||0)%30})}</strong></article></div>${rows?`<div class="fb-table-wrap"><table class="fb-table"><thead><tr><th>قرارداد</th><th>شروع پوشش</th><th>پایان پوشش</th><th>سابقه محاسبه‌شده</th><th>وضعیت ثبت</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="fb-empty">برای این مراقب هنوز قرارداد دارای بازه زمانی ثبت نشده است.</div>'}<p class="fb-note" style="margin:14px 0 0">این سابقه، رکورد داخلی باشگاه مراقبین است. سابقه رسمی سازمان تأمین اجتماعی پس از ارسال لیست و تأیید مرجع بیمه قطعی محسوب می‌شود.</p></section>`;
}
async function summary(force=false){if(cache&&!force)return cache;const result=await api('/api/benefits/summary');cache=result.data;return cache}
function targetRoot(){return $('#content .module-page')||$('#content')}
async function inject(kind){
  const root=targetRoot();if(!root)return;
  root.querySelector('.fb-root')?.remove();
  root.insertAdjacentHTML('afterbegin',loadingPanel(kind));
  try{const data=await summary(true);const loading=root.querySelector('.fb-root');if(!loading)return;loading.outerHTML=kind==='wallet'?creditMarkup(data):insuranceMarkup(data)}catch(error){const loading=root.querySelector('.fb-root');if(loading)loading.outerHTML=`<section class="fb-root fb-error">${esc(error.message||'اطلاعات مالی دریافت نشد.')}</section>`}
}
function label(nav){return String(Array.isArray(nav)?nav[1]:nav||'').trim()}
function install(){
  const current=window.renderModule;
  if(typeof current!=='function'||current.__salamatFinancialBenefitsV1)return;
  const wrapped=function(...args){const result=current.apply(this,args);let caregiver=false;try{caregiver=args[0]===window.roles?.caregiver||isCaregiver()}catch{}if(caregiver){const name=label(args[1]);if(name==='کیف پول')setTimeout(()=>inject('wallet'),0);else if(name==='حقوق و فیش حقوقی')setTimeout(()=>inject('insurance'),0)}return result};
  Object.assign(wrapped,current);wrapped.__salamatFinancialBenefitsV1=true;window.renderModule=wrapped;
}
function boot(){addStyles();install();let attempts=0;const timer=setInterval(()=>{install();if(++attempts>120)clearInterval(timer)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
