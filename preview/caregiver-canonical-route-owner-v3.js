(()=>{
'use strict';
if(window.__salamatCaregiverCanonicalRouteOwnerV3)return;
window.__salamatCaregiverCanonicalRouteOwnerV3=true;

const VERSION='3.0.0';
const BLOCKED_KEYS=new Set(['caregiver.rank','caregiver.contracts','caregiver.security']);
const BLOCKED_LABELS=['ساعات قرارداد','گزارش امنیت','درجه و رتبه','رتبه و پروانه'];
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const money=value=>`${fa(value)} تومان`;
const state={access:null,modules:[],model:null,activeKey:'caregiver.dashboard',loadingAccess:null,navSignature:'',observerQueued:false};

async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
 const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}return payload;
}
function currentRole(){
 try{return String(window.SalamatBackend?.getCurrentUser?.()?.role||state.access?.user?.role||window.selectedRole||'').toUpperCase()}catch{return String(window.selectedRole||'').toUpperCase()}
}
function caregiverPanelActive(){
 const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;
 return state.access?.panel==='CAREGIVER'||currentRole()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب');
}
function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim()}
function blockedLabel(value){const text=cleanText(value);return BLOCKED_LABELS.some(label=>text.includes(label))}
function setPage(title,subtitle,html){
 const pageTitle=$('#pageTitle'),pageSubtitle=$('#pageSubtitle'),content=$('#content');
 if(pageTitle)pageTitle.textContent=title;if(pageSubtitle)pageSubtitle.textContent=subtitle;
 if(content)content.innerHTML=`<section class="module-page cgr3-root">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
}
function loading(text){return `<div class="cgr3-loading"><span></span><strong>${esc(text)}</strong></div>`}
function errorBox(title,text,retryKey=''){return `<div class="cgr3-error"><strong>${esc(title)}</strong><small>${esc(text)}</small>${retryKey?`<button class="cgr3-btn primary" data-cgr3-retry="${esc(retryKey)}">تلاش مجدد</button>`:''}</div>`}
function dateFa(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value))}catch{return String(value)}}
function statusLabel(value){return ({FINAL:'نهایی',DRAFT:'پیش‌نویس',ACTIVE:'فعال',APPROVED:'تأییدشده',ISSUED:'صادرشده',PAID:'پرداخت‌شده',COMPLETED:'تکمیل‌شده'}[String(value||'').toUpperCase()]||value||'—')}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function stars(count){return `<span class="p3-stars">${[1,2,3,4,5].map(index=>`<i class="${index<=Number(count||0)?'on':''}">★</i>`).join('')}</span>`}
function scoreStatus(score,official){if(score==null)return 'بدون امتیاز';if(!official)return 'در حال تکمیل';if(score>=90)return 'ممتاز';if(score>=80)return 'بسیار خوب';if(score>=60)return 'قابل قبول';return 'نیازمند بهبود'}
function addStyles(){
 if($('#caregiverCanonicalRouteOwnerV3Styles'))return;
 const style=document.createElement('style');style.id='caregiverCanonicalRouteOwnerV3Styles';style.textContent=`
.cgr3-root{direction:rtl;display:grid;gap:14px}.cgr3-loading,.cgr3-error{min-height:230px;display:grid;place-items:center;align-content:center;gap:10px;text-align:center;border:1px dashed #cfe0d7;border-radius:20px;background:#fbfdfc;color:#64776c;padding:24px}.cgr3-loading span{width:30px;height:30px;border:3px solid #dcece4;border-top-color:#078848;border-radius:50%;animation:cgr3spin .8s linear infinite}.cgr3-loading strong,.cgr3-error strong{font-size:12px}.cgr3-error{background:#fff8f8;border-color:#efcfd5;color:#9b3244}.cgr3-error small{font-size:9px;line-height:1.9}@keyframes cgr3spin{to{transform:rotate(360deg)}}.cgr3-btn{border:0;border-radius:11px;padding:10px 14px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.cgr3-btn.primary{background:#078848;color:#fff}.cgr3-btn.outline{background:#fff;color:#087847;border:1px solid #cfe0d7}.cgr3-dashboard-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(240px,.75fr);overflow:hidden;border-radius:27px;background:linear-gradient(135deg,#087a45,#075b38);color:#fff;box-shadow:0 18px 45px rgba(8,99,58,.14)}.cgr3-dashboard-copy{padding:32px}.cgr3-dashboard-copy h2{margin:14px 0 8px;color:#fff;font-size:25px;line-height:1.55}.cgr3-dashboard-copy p{margin:0;color:rgba(255,255,255,.82);font-size:10px;line-height:2}.cgr3-eyebrow{display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.13);font-size:8px;font-weight:900}.cgr3-dashboard-side{padding:24px;display:grid;align-content:center;gap:9px;background:rgba(0,0,0,.08)}.cgr3-dashboard-side div{padding:12px;border:1px solid rgba(255,255,255,.16);border-radius:15px}.cgr3-dashboard-side small{display:block;font-size:8px;opacity:.82}.cgr3-dashboard-side strong{display:block;margin-top:6px;font-size:13px}.cgr3-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.cgr3-kpi,.cgr3-card{background:#fff;border:1px solid #dce8e2;border-radius:18px;box-shadow:0 9px 26px rgba(20,70,45,.04)}.cgr3-kpi{padding:15px}.cgr3-kpi small{display:block;color:#74847c;font-size:8px}.cgr3-kpi strong{display:block;margin-top:7px;color:#087a45;font-size:18px}.cgr3-kpi span{display:block;margin-top:5px;color:#7c8982;font-size:8px}.cgr3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.cgr3-card{padding:16px}.cgr3-card h3{margin:0;font-size:13px}.cgr3-card p{margin:6px 0 0;color:#74837b;font-size:8px;line-height:1.9}.cgr3-card-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:13px}.cgr3-card-stats div{padding:12px;border-radius:13px;background:#f4f8f6}.cgr3-card-stats small{display:block;color:#74837b;font-size:8px}.cgr3-card-stats strong{display:block;margin-top:6px;color:#087a45;font-size:17px}.cgr3-score-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.cgr3-score-toolbar label{display:flex;align-items:center;gap:8px;font-size:9px;font-weight:900}.cgr3-score-toolbar select{min-width:260px;border:1px solid #d6e3dc;border-radius:11px;padding:10px;background:#fff;font:inherit;font-size:9px}.cgr3-notice{padding:12px 14px;border-radius:14px;background:#fff7e8;color:#8a5a00;border:1px solid #f0deb6;font-size:9px;line-height:1.9}.cgr3-notice.official{background:#edf8f2;color:#276846;border-color:#cfe7d9}.cgr3-history{margin-top:14px;background:#fff;border:1px solid #dce8e2;border-radius:18px;overflow:hidden}.cgr3-history header{padding:14px 16px;border-bottom:1px solid #e8efeb}.cgr3-history h3{margin:0;font-size:13px}.cgr3-history table{width:100%;border-collapse:collapse;font-size:8px}.cgr3-history th,.cgr3-history td{padding:10px 12px;border-bottom:1px solid #edf2ef;text-align:right}.cgr3-history th{background:#f7faf8;color:#607067}.cgr3-history tr:last-child td{border-bottom:0}.cgr3-report .p3-report{margin:0}.cgr3-report .p3-report footer{display:none!important}.cgr3-report .p3-reportgrid article p b{float:left}.cgr3-print-row{display:flex;justify-content:flex-end}@media(max-width:980px){.cgr3-dashboard-hero{grid-template-columns:1fr}.cgr3-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.cgr3-kpis,.cgr3-grid{grid-template-columns:1fr}.cgr3-dashboard-copy{padding:24px}.cgr3-dashboard-copy h2{font-size:21px}.cgr3-score-toolbar{align-items:stretch}.cgr3-score-toolbar label{display:grid}.cgr3-score-toolbar select{min-width:0;width:100%}.cgr3-history{overflow:auto}.cgr3-history table{min-width:620px}}
`;(document.head||document.documentElement).appendChild(style)
}
function allowedModules(access){
 const list=Array.isArray(access?.modules)?access.modules:[];
 return list.filter(module=>module.panel==='CAREGIVER'&&module.actions?.view&&!BLOCKED_KEYS.has(module.key)&&!blockedLabel(module.label));
}
function moduleSignature(modules){return modules.map(module=>`${module.key}:${module.label}`).join('|')}
function buildModel(){
 const base=window.roles?.caregiver||{},user=state.access?.user||{};
 return {...base,name:user.fullName||base.name,role:'مراقب',title:'پنل مراقب',subtitle:'پرونده، ارزیابی، آموزش و ارتباطات شما',nav:state.modules.map(module=>[module.icon,module.label])};
}
function renderCanonicalNavigation(force=false){
 const nav=$('#sidebarNav');if(!nav||!caregiverPanelActive())return false;
 const signature=moduleSignature(state.modules);if(!force&&nav.dataset.cgr3Signature===signature&&nav.querySelector('[data-caregiver-module-key]'))return true;
 nav.dataset.cgr3Signature=signature;
 nav.innerHTML=state.modules.map(module=>`<button class="nav-item ${module.key===state.activeKey?'active':''}" data-caregiver-module-key="${esc(module.key)}" data-access-module="${esc(module.key)}"><span data-icon="${esc(module.icon||'home')}"></span><span>${esc(module.label)}</span></button>`).join('');
 try{window.hydrateIcons?.(nav)}catch{}
 state.navSignature=signature;return true;
}
function updateIdentity(){
 const user=state.access?.user||{},name=user.fullName||'مراقب';
 [['#sidebarName',name],['#topName',name],['#sidebarRole','مراقب'],['#topRole','مراقب']].forEach(([selector,value])=>{const node=$(selector);if(node)node.textContent=value});
 const avatar=initials(name);[['#sidebarAvatar',avatar],['#topAvatar',avatar]].forEach(([selector,value])=>{const node=$(selector);if(node&&!node.querySelector('img'))node.textContent=value})
}
function markActive(key){state.activeKey=key;$$('#sidebarNav [data-caregiver-module-key]').forEach(button=>button.classList.toggle('active',button.dataset.caregiverModuleKey===key))}
function dashboardMarkup(data){
 const c=data.caregiver||{},contract=data.activeContract||{},evaluation=data.latestEvaluation||{},payroll=data.latestPayroll||{},training=data.training||{},support=data.support||{};
 return `<section class="cgr3-dashboard-hero"><div class="cgr3-dashboard-copy"><span class="cgr3-eyebrow">باشگاه مراقبین سلامت اول</span><h2>سلام ${esc(String(c.fullName||'مراقب').split(/\s+/)[0])}، وضعیت حرفه‌ای شما آماده مشاهده است</h2><p>اطلاعات این صفحه مستقیماً از پرونده، ارزیابی، آموزش، قرارداد، حقوق و کیف پول شما خوانده شده است.</p></div><aside class="cgr3-dashboard-side"><div><small>شناسه حرفه‌ای</small><strong>${esc(c.membershipCode||c.id||'—')}</strong></div><div><small>آخرین به‌روزرسانی</small><strong>${dateFa(data.updatedAt)}</strong></div></aside></section><section class="cgr3-kpis"><article class="cgr3-kpi"><small>قرارداد فعال</small><strong>${esc(contract.contractNumber||'—')}</strong><span>${esc(contract.familyName||'قرارداد فعالی ثبت نشده')}</span></article><article class="cgr3-kpi"><small>آخرین امتیاز ارزیابی</small><strong>${evaluation.finalScore==null?'—':fa(evaluation.finalScore)}</strong><span>${evaluation.id?statusLabel(evaluation.status):'دوره‌ای ثبت نشده'}</span></article><article class="cgr3-kpi"><small>مانده قابل تسویه</small><strong>${money(data.wallet?.availableToman||0)}</strong><span>${money(data.wallet?.pendingSettlementToman||0)} در انتظار</span></article><article class="cgr3-kpi"><small>آخرین فیش حقوقی</small><strong>${payroll.netToman==null?'—':money(payroll.netToman)}</strong><span>${esc(payroll.periodTitle||'فیشی صادر نشده')}</span></article></section><section class="cgr3-grid"><article class="cgr3-card"><h3>وضعیت آموزش‌های من</h3><p>آموزش‌های تخصیص‌یافته از بانک آموزش سازمان</p><div class="cgr3-card-stats"><div><small>تخصیص‌یافته</small><strong>${fa(training.assigned||0)}</strong></div><div><small>تکمیل‌شده</small><strong>${fa(training.completed||0)}</strong></div></div></article><article class="cgr3-card"><h3>پشتیبانی پرونده</h3><p>گفت‌وگوها و درخواست‌های در حال پیگیری</p><div class="cgr3-card-stats"><div><small>گفت‌وگوی باز</small><strong>${fa(support.openCount||0)}</strong></div><div><small>آخرین وضعیت</small><strong>${Number(support.openCount||0)>0?'در حال پیگیری':'بدون درخواست باز'}</strong></div></div></article></section>`;
}
async function openDashboard(){
 markActive('caregiver.dashboard');setPage('داشبورد مراقب','اطلاعات واقعی پرونده و عملکرد شما',loading('در حال دریافت داشبورد واقعی از سرور...'));
 try{const payload=await api('/api/caregiver/platform/dashboard');setPage('داشبورد مراقب','آخرین وضعیت ثبت‌شده در سامانه',dashboardMarkup(payload.data||{}))}
 catch(error){setPage('داشبورد مراقب','خطا در دریافت اطلاعات',errorBox('داشبورد بارگذاری نشد',error.message||String(error),'caregiver.dashboard'))}
}
function indicatorRows(indicators){
 return indicators.map(item=>`<tr><td>${esc(item.code)} • ${esc(item.title)}</td><td><i><u style="width:${Math.max(0,Math.min(100,Number(item.liveScore||0)))}%"></u></i><b>${item.liveScore==null?'—':fa(item.liveScore)}</b><small>${fa(item.scoredCount||0)} از ${fa(item.criteriaCount||0)} معیار</small></td></tr>`).join('');
}
function scorecardMarkup(data){
 const caregiver=data.caregiver||{},summary=data.summary||{},rank=data.rank||{},license=data.license||{},period=data.selectedPeriod||{},indicators=Array.isArray(data.indicators)?data.indicators:[],records=data.records||{},history=Array.isArray(data.history)?data.history:[];
 const scored=indicators.filter(item=>item.liveScore!=null),strengths=[...scored].sort((a,b)=>Number(b.liveScore)-Number(a.liveScore)).slice(0,3),gaps=[...scored].sort((a,b)=>Number(a.liveScore)-Number(b.liveScore)).slice(0,3),score=summary.score;
 const photo=caregiver.avatarUrl?`<img class="p3-big" src="${esc(caregiver.avatarUrl)}" alt="${esc(caregiver.fullName||'مراقب')}">`:`<span class="p3-big p3-ph">${esc(initials(caregiver.fullName))}</span>`;
 const periods=(data.periods||[]).map(item=>`<option value="${esc(item.id)}" ${item.id===period.id?'selected':''}>${esc(item.title)} • ${esc(statusLabel(item.status))}</option>`).join('');
 const opinion=!summary.official?'کارنامه در حال تکمیل است و پس از نهایی‌شدن دوره، نتیجه رسمی خواهد شد.':score>=80?'عملکرد حرفه‌ای مطلوب و باثبات است.':score>=60?'برنامه بهبود برای شاخص‌های کم‌امتیاز توصیه می‌شود.':'اقدام اصلاحی و بازآموزی فوری توصیه می‌شود.';
 return `<div class="cgr3-score-toolbar"><label>دوره ارزیابی<select data-cgr3-period>${periods||'<option>دوره‌ای ثبت نشده</option>'}</select></label><button class="cgr3-btn outline" data-cgr3-print>چاپ کارنامه</button></div><div class="cgr3-notice ${summary.official?'official':''}">${esc(summary.notice||'')}</div><section class="cgr3-report"><article class="p3-report"><header><img src="./logo-salamat-aval.svg" alt="سلامت اول"><div><h2>کارنامه حرفه‌ای مراقب</h2><p>ارزیابی عملکرد و شایستگی حرفه‌ای در سلامت اول</p></div><aside><span>کد مراقب</span><b>${esc(caregiver.membershipCode||caregiver.id||'—')}</b></aside></header><section class="p3-top"><div class="p3-ring" style="--a:${Math.max(0,Math.min(360,Number(score||0)*3.6))}deg"><b>${score==null?'—':fa(score)}</b><span>از ۱۰۰</span><em>${esc(scoreStatus(score,summary.official))}</em></div><div class="p3-profile">${photo}<dl><div><dt>نام</dt><dd>${esc(caregiver.fullName||'—')}</dd></div><div><dt>کد ملی</dt><dd>${esc(caregiver.nationalId||'—')}</dd></div><div><dt>گروه خدمت</dt><dd>${esc(caregiver.serviceGroup||'—')}</dd></div><div><dt>موبایل</dt><dd>${esc(caregiver.mobile||'—')}</dd></div><div><dt>وضعیت پرونده</dt><dd>${esc(caregiver.fileStatus||'—')}</dd></div></dl></div><div class="p3-permit"><h3>پروانه صلاحیت</h3><i>✓</i><b>${esc(license.status||'ثبت نشده')}</b><small dir="ltr">${esc(license.number||'—')}</small><span>${summary.official?'بر پایه ارزیابی نهایی':'در انتظار نتیجه نهایی'}</span></div></section><section class="p3-reportgrid"><article><h3>هشت شاخص حرفه‌ای</h3><table>${indicatorRows(indicators)}<tfoot><tr><td>امتیاز کل</td><td><strong>${score==null?'—':fa(score)}</strong></td></tr></tfoot></table></article><article><h3>رتبه حرفه‌ای خودکار</h3>${stars(rank.stars)}<b class="p3-rank">${rank.code?`${esc(rank.code)} • ${esc(rank.title)}`:'در انتظار تکمیل و نهایی‌سازی ارزیابی'}</b><p>رتبه از نتیجه همان دوره ارزیابی ثبت‌شده در پرونده حرفه‌ای محاسبه می‌شود.</p></article><article><h3>سوابق حرفه‌ای</h3><ul><li>قراردادهای ثبت‌شده <b>${fa(records.contractsCount||0)}</b></li><li>آموزش تخصیص‌یافته <b>${fa(records.trainingCount||0)}</b></li><li>آموزش تکمیل‌شده <b>${fa(records.completedTrainingCount||0)}</b></li><li>معیارهای امتیازدهی‌شده <b>${fa(summary.scoredCriteria||0)} از ${fa(summary.totalCriteria||0)}</b></li></ul></article><article><h3>نقاط قوت</h3>${strengths.length?strengths.map(item=>`<p>✓ ${esc(item.title)} <b>${fa(item.liveScore)}</b></p>`).join(''):'<p>پس از ثبت ارزیابی نمایش داده می‌شود.</p>'}</article><article><h3>زمینه‌های بهبود</h3>${gaps.length?gaps.map(item=>`<p>! ${esc(item.title)} <b>${fa(item.liveScore)}</b></p>`).join(''):'<p>هنوز امتیازی ثبت نشده است.</p>'}</article><article><h3>نظر ارزیابی</h3><p>${esc(opinion)}</p></article></section></article></section>${history.length?`<section class="cgr3-history"><header><h3>سوابق دوره‌های ارزیابی</h3></header><table><thead><tr><th>دوره</th><th>وضعیت</th><th>امتیاز نهایی</th><th>تاریخ نهایی‌سازی</th></tr></thead><tbody>${history.map(item=>`<tr><td>${esc(item.title)}</td><td>${esc(statusLabel(item.status))}</td><td>${item.finalScore==null?'—':fa(item.finalScore)}</td><td>${dateFa(item.finalizedAt||item.updatedAt)}</td></tr>`).join('')}</tbody></table></section>`:''}`;
}
async function openScorecard(evaluationId=''){
 markActive('caregiver.scorecard');setPage('کارنامه کاری','همان کارنامه ثبت‌شده در پرونده حرفه‌ای شما',loading('در حال دریافت کارنامه حرفه‌ای از سرور...'));
 try{
  const query=evaluationId?`?evaluationId=${encodeURIComponent(evaluationId)}`:'';
  const payload=await api(`/api/caregiver/platform/scorecard-v2${query}`);setPage('کارنامه کاری','همان داده‌های ارزیابی ثبت‌شده در پنل مدیر',scorecardMarkup(payload.data||{}))
 }catch(error){setPage('کارنامه کاری','خطا در دریافت کارنامه',errorBox('کارنامه آماده نشد',error.message||String(error),'caregiver.scorecard'))}
}
function delegateModule(module){
 const item=[module.icon||'activity',module.label];
 try{return window.renderModule?.(state.model||window.roles?.caregiver,item)}catch(error){setPage(module.label,'خطا در بازکردن ماژول',errorBox('ماژول باز نشد',error.message||String(error),module.key))}
}
async function openModule(key){
 const module=state.modules.find(item=>item.key===key);if(!module||BLOCKED_KEYS.has(key))return;
 markActive(key);
 if(key==='caregiver.dashboard')return openDashboard();
 if(key==='caregiver.scorecard')return openScorecard();
 if(key==='caregiver.training'){
  const training=window.SalamatCaregiverTrainingV2;if(training?.open)return training.open();
  setPage('آموزش‌های من','در حال آماده‌سازی ماژول آموزش',loading('در حال بارگذاری ماژول آموزش...'));
  let attempts=0;const timer=setInterval(()=>{attempts+=1;const ready=window.SalamatCaregiverTrainingV2;if(ready?.open){clearInterval(timer);ready.open()}else if(attempts>=50){clearInterval(timer);setPage('آموزش‌های من','خطا در بارگذاری آموزش',errorBox('ماژول آموزش آماده نشد','فایل اجرایی آموزش در مرورگر بارگذاری نشده است.','caregiver.training'))}},80);return;
 }
 if(key==='caregiver.wallet'&&window.SalamatCaregiverPlatform?.openWallet)return window.SalamatCaregiverPlatform.openWallet();
 if(key==='caregiver.support'&&window.SalamatCaregiverPlatform?.openSupport)return window.SalamatCaregiverPlatform.openSupport();
 return delegateModule(module);
}
async function loadAccess(force=false){
 if(state.loadingAccess&&!force)return state.loadingAccess;
 state.loadingAccess=api('/api/access/me').then(payload=>{
  if(payload.data?.panel!=='CAREGIVER')return false;
  state.access=payload.data;state.modules=allowedModules(payload.data);state.model=buildModel();updateIdentity();renderCanonicalNavigation(true);return true;
 }).catch(error=>{if(error.status!==401)console.error('Caregiver access load failed',error);return false}).finally(()=>{state.loadingAccess=null});
 return state.loadingAccess;
}
function cleanLegacyContent(){
 $$('#content .module-card,#content [data-module-card],#content .cp-action-card').forEach(card=>{if(blockedLabel(card.textContent))card.remove()});
}
function looksLegacyDashboard(){
 if(!caregiverPanelActive()||state.activeKey!=='caregiver.dashboard')return false;
 const content=$('#content');if(!content||content.querySelector('.cgr3-dashboard-hero,.cgr3-loading'))return false;
 return Boolean(content.querySelector('.role-hero,.caregiver-hero-panel')||cleanText(content.textContent).includes('نسخه نمایشی'));
}
function enforce(){
 if(!caregiverPanelActive())return;cleanLegacyContent();
 const nav=$('#sidebarNav');if(nav){const containsBlocked=$$('#sidebarNav .nav-item').some(button=>blockedLabel(button.textContent));const canonical=Boolean(nav.querySelector('[data-caregiver-module-key]'));if(containsBlocked||!canonical)renderCanonicalNavigation(true)}
 if(looksLegacyDashboard())void openDashboard();
}
function queueEnforce(){if(state.observerQueued)return;state.observerQueued=true;queueMicrotask(()=>{state.observerQueued=false;enforce()})}
function installObservers(){
 const nav=$('#sidebarNav'),content=$('#content');
 if(nav&&!nav.dataset.cgr3Observed){nav.dataset.cgr3Observed='true';new MutationObserver(queueEnforce).observe(nav,{childList:true,subtree:true})}
 if(content&&!content.dataset.cgr3Observed){content.dataset.cgr3Observed='true';new MutationObserver(queueEnforce).observe(content,{childList:true,subtree:true})}
}
function capture(event){
 if(!caregiverPanelActive())return;
 const button=event.target?.closest?.('#sidebarNav [data-caregiver-module-key]');
 if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 void openModule(button.dataset.caregiverModuleKey);
 const sidebar=$('#sidebar');sidebar?.classList.remove('open');
}
function onChange(event){const select=event.target?.closest?.('[data-cgr3-period]');if(select)void openScorecard(select.value)}
function onClick(event){
 const retry=event.target?.closest?.('[data-cgr3-retry]');if(retry){event.preventDefault();void openModule(retry.dataset.cgr3Retry);return}
 if(event.target?.closest?.('[data-cgr3-print]')){event.preventDefault();window.print()}
}
async function activate(openInitial=false){
 addStyles();const ready=await loadAccess(true);if(!ready)return;installObservers();enforce();
 if(openInitial||looksLegacyDashboard()||!$('#content')?.children.length)void openDashboard();
}
function boot(){
 addStyles();window.addEventListener('click',capture,true);document.addEventListener('click',onClick,true);document.addEventListener('change',onChange,true);
 window.addEventListener('salamat-authenticated',()=>setTimeout(()=>void activate(true),0));
 window.addEventListener('salamat-access-ready',()=>setTimeout(()=>void activate(false),0));
 window.addEventListener('pageshow',()=>setTimeout(()=>void activate(false),0));
 let attempts=0;const timer=setInterval(()=>{attempts+=1;installObservers();if(caregiverPanelActive()){void activate(false);clearInterval(timer)}else if(attempts>=120)clearInterval(timer)},100);
 window.SalamatCaregiverCanonicalRouteOwner={version:VERSION,openDashboard,openScorecard,openModule,reload:()=>activate(false),cleanNavigation:()=>renderCanonicalNavigation(true)};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
