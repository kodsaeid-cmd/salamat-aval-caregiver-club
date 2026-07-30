(()=>{
'use strict';

const AUTH_KEY='salamatAvalAccessControlV1';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const EVAL_UI_KEY='salamatAvalEvaluationUIV13';
const SESSION_KEY='salamatAvalSessionV1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value||'').trim().toLowerCase();
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const nowFa=()=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date());

const INDICATORS=[
 {code:'Q-01',title:'کیفیت ارائه خدمات'},
 {code:'Q-02',title:'رضایت خدمت‌گیرنده و خانواده'},
 {code:'Q-03',title:'رعایت کرامت و حقوق خدمت‌گیرنده'},
 {code:'Q-04',title:'اخلاق و رفتار حرفه‌ای'},
 {code:'Q-05',title:'انضباط شغلی'},
 {code:'Q-06',title:'رعایت استانداردهای سلامت اول'},
 {code:'Q-07',title:'همکاری سازمانی'},
 {code:'Q-08',title:'توسعه حرفه‌ای و آموزشی'}
];
const RANKS=[
 {min:90,code:'R-1',title:'ممتاز',stars:5},
 {min:80,code:'R-2',title:'ارشد',stars:4},
 {min:70,code:'R-3',title:'حرفه‌ای',stars:3},
 {min:60,code:'R-4',title:'پایه',stars:2},
 {min:0,code:'R-5',title:'مشروط',stars:1}
];
const roleLabels={admin:'مدیر سامانه',caregiver:'مراقب',recruiter:'کارشناس جذب',hr:'منابع انسانی'};
const statusLabels={approved:'تأییدشده',pending:'در انتظار تأیید',suspended:'تعلیق‌شده'};

function evaluationState(){
 const state=read(EVAL_KEY,{caregivers:[],periods:[],training:[],complaints:[],correctiveActions:[],audit:[]});
 for(const key of ['caregivers','periods','training','complaints','correctiveActions','audit'])state[key]||=[];
 return state;
}
function workspaceState(){
 const state=read(WORK_KEY,{contracts:[],assignments:[],ui:{}});
 state.contracts||=[];state.assignments||=[];state.ui||={};
 return state;
}
function authState(){const state=read(AUTH_KEY,{users:[],audit:[]});state.users||=[];state.audit||=[];return state}
function currentRole(){try{return selectedRole||read(SESSION_KEY,{}).role||'caregiver'}catch{return read(SESSION_KEY,{}).role||'caregiver'}}
function selectedCaregiverId(){const state=evaluationState(),work=workspaceState(),ui=read(EVAL_UI_KEY,{});return work.ui.caregiverId||ui.caregiverId||state.caregivers[0]?.id||''}
function chooseCaregiver(caregiverId){const work=workspaceState(),ui=read(EVAL_UI_KEY,{});work.ui.caregiverId=caregiverId;ui.caregiverId=caregiverId;write(WORK_KEY,work);write(EVAL_UI_KEY,ui)}
function selectedPeriod(state,caregiverId){const ui=read(EVAL_UI_KEY,{});return state.periods.find(item=>item.id===ui.periodId&&item.caregiverId===caregiverId)||state.periods.filter(item=>item.caregiverId===caregiverId).slice(-1)[0]||null}
function choosePeriod(periodId){const ui=read(EVAL_UI_KEY,{});ui.periodId=periodId;write(EVAL_UI_KEY,ui)}
function rawScore(period,indicator){const value=period?.criteria?.[indicator.code]?.score;return value===null||value===undefined||value===''?null:Number(value)}
function completedIndicators(period){return INDICATORS.filter(indicator=>rawScore(period,indicator)!==null).length}
function performanceScore(period){const values=INDICATORS.map(indicator=>rawScore(period,indicator)).filter(value=>value!==null&&Number.isFinite(value));return values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10:null}
function derivedRank(score,completed){return score==null||completed<INDICATORS.length?{code:'',title:'در انتظار تکمیل ارزیابی',stars:0}:RANKS.find(item=>score>=item.min)}
function licenseNumber(caregiver,index){const match=String(caregiver.id||'').match(/(\d{4})-(\d+)$/);return match?`SA-LIC-${match[1]}-${String(match[2]).padStart(4,'0')}`:`SA-LIC-1405-${String(index+1).padStart(4,'0')}`}
function syncDerivedState(state=evaluationState()){
 let changed=false;
 state.caregivers.forEach((caregiver,index)=>{
  caregiver.license||={};
  const number=licenseNumber(caregiver,index);
  if(caregiver.license.number!==number){caregiver.license.number=number;changed=true}
  const period=selectedPeriod(state,caregiver.id)||state.periods.filter(item=>item.caregiverId===caregiver.id).slice(-1)[0]||null;
  const score=performanceScore(period),completed=completedIndicators(period),rank=derivedRank(score,completed);
  const nextRank={...(caregiver.rank||{}),code:rank.code,title:rank.title,stars:rank.stars,performanceScore:score,calculatedFrom:'Q'};
  if(JSON.stringify([caregiver.rank?.code,caregiver.rank?.title,caregiver.rank?.stars,caregiver.rank?.performanceScore])!==JSON.stringify([nextRank.code,nextRank.title,nextRank.stars,nextRank.performanceScore])){caregiver.rank=nextRank;changed=true}
  if(period&&completed===INDICATORS.length&&period.finalScore!==score){period.finalScore=score;changed=true}
 });
 if(changed)write(EVAL_KEY,state);
 return state;
}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function photo(caregiver,className='p3-photo'){return caregiver?.profile?.photo?`<img class="${className}" src="${caregiver.profile.photo}" alt="${escapeHtml(caregiver.name)}">`:`<span class="${className} p3-ph">${escapeHtml(initials(caregiver?.name))}</span>`}
function stars(count){return `<span class="p3-stars">${[1,2,3,4,5].map(index=>`<i class="${index<=count?'on':''}">★</i>`).join('')}</span>`}
function setPage(title,subtitle,html){$('#pageTitle').textContent=title;$('#pageSubtitle').textContent=subtitle;$('#content').innerHTML=`<section class="module-page p3">${html}</section>`;try{window.hydrateIcons?.($('#content'))}catch{}}
function accountFor(caregiverId){return authState().users.find(user=>user.caregiverId===caregiverId)||null}
function scoreStatus(score){if(score==null)return 'ارزیابی ناقص';if(score>=90)return 'ممتاز';if(score>=80)return 'بسیار خوب';if(score>=60)return 'قابل قبول';return 'نیازمند بهبود'}

function professionalRows(state){
 return state.caregivers.map((caregiver,index)=>{
  const period=selectedPeriod(state,caregiver.id)||state.periods.filter(item=>item.caregiverId===caregiver.id).slice(-1)[0]||null;
  const score=performanceScore(period),completed=completedIndicators(period),rank=derivedRank(score,completed),account=accountFor(caregiver.id);
  const search=normalize(`${caregiver.name} ${caregiver.id} ${caregiver.phone||''} ${caregiver.nationalId||''} ${account?.email||''} ${caregiver.fileStatus||''}`);
  return `<tr class="p3-record-row" tabindex="0" data-professional-caregiver="${escapeHtml(caregiver.id)}" data-search="${escapeHtml(search)}">
   <td><span class="p3-table-person">${photo(caregiver,'p3-table-avatar')}<span><strong>${escapeHtml(caregiver.name)}</strong><small>${escapeHtml(caregiver.id)}</small></span></span></td>
   <td dir="ltr">${escapeHtml(caregiver.phone||'—')}</td>
   <td>${escapeHtml(caregiver.serviceGroup||'—')}</td>
   <td><span class="status">${escapeHtml(caregiver.fileStatus||'—')}</span></td>
   <td><strong>${score==null?'—':fa(score)}</strong><small class="ev-cell-note">${fa(completed)} از ۸ شاخص</small></td>
   <td>${rank.code?`<strong>${rank.code}</strong><small class="ev-cell-note">${escapeHtml(rank.title)}</small>`:'—'}</td>
   <td><strong dir="ltr">${escapeHtml(caregiver.license?.number||licenseNumber(caregiver,index))}</strong><small class="ev-cell-note">${escapeHtml(caregiver.license?.status||'ثبت نشده')}</small></td>
  </tr>`;
 }).join('');
}
function renderProfessionalList(){
 const state=syncDerivedState();
 setPage('پرونده حرفه‌ای مراقبین','جست‌وجو و انتخاب مراقب برای مشاهده کارنامه حرفه‌ای',`
 <article class="surface p3-record-list">
  <div class="surface-head p3-record-toolbar"><div><h3>فهرست پرونده‌های حرفه‌ای</h3><p>${fa(state.caregivers.length)} مراقب؛ روی هر ردیف کلیک کنید تا کارنامه باز شود.</p></div><input id="p3RecordSearch" placeholder="جست‌وجوی نام، CP-ID، موبایل، کد ملی یا ایمیل"></div>
  <div class="table-wrap"><table class="data-table p3-record-table"><thead><tr><th>مراقب</th><th>موبایل</th><th>گروه خدمت</th><th>وضعیت پرونده</th><th>امتیاز</th><th>رتبه</th><th>پروانه</th></tr></thead><tbody>${professionalRows(state)}</tbody></table></div>
  ${state.caregivers.length?'':'<div class="p3-empty">پرونده مراقبی وجود ندارد.</div>'}
 </article>`);
 $('#p3RecordSearch')?.addEventListener('input',event=>{const query=normalize(event.currentTarget.value);$$('[data-professional-caregiver]').forEach(row=>row.hidden=Boolean(query&&!row.dataset.search.includes(query)))});
 $$('[data-professional-caregiver]').forEach(row=>{const open=()=>renderProfessionalDetail(row.dataset.professionalCaregiver,false);row.addEventListener('click',open);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}})});
}

function reportMarkup(caregiver,period,state,admin){
 const work=workspaceState(),score=performanceScore(period),completed=completedIndicators(period),rank=derivedRank(score,completed),license=caregiver.license||{};
 const indicatorScores=INDICATORS.map(indicator=>({indicator,value:rawScore(period,indicator)}));
 const contracts=work.contracts.filter(item=>item.caregiverId===caregiver.id),complaints=state.complaints.filter(item=>item.caregiverId===caregiver.id),trainings=state.training.filter(item=>item.caregiverId===caregiver.id),assignments=work.assignments.filter(item=>item.caregiverId===caregiver.id);
 const credits=trainings.filter(item=>item.status==='تأییدشده').reduce((sum,item)=>sum+Number(item.credit||0),0);
 const strengths=[...indicatorScores].filter(item=>item.value!=null).sort((a,b)=>b.value-a.value).slice(0,3),gaps=[...indicatorScores].filter(item=>item.value!=null).sort((a,b)=>a.value-b.value).slice(0,3);
 return `<article class="p3-report"><header><img src="./logo-salamat-aval.svg" alt="سلامت اول"><div><h2>کارنامه حرفه‌ای مراقب</h2><p>ارزیابی عملکرد و شایستگی حرفه‌ای در سلامت اول</p></div><aside><span>کد مراقب</span><b>${escapeHtml(caregiver.id)}</b></aside></header><section class="p3-top"><div class="p3-ring" style="--a:${(score||0)*3.6}deg"><b>${score==null?'—':fa(score)}</b><span>از ۱۰۰</span><em>${scoreStatus(score)}</em></div><div class="p3-profile">${photo(caregiver,'p3-big')}<dl><div><dt>نام</dt><dd>${escapeHtml(caregiver.name)}</dd></div><div><dt>کد ملی</dt><dd>${escapeHtml(caregiver.nationalId||'—')}</dd></div><div><dt>گروه خدمت</dt><dd>${escapeHtml(caregiver.serviceGroup||'—')}</dd></div><div><dt>موبایل</dt><dd>${escapeHtml(caregiver.phone||'—')}</dd></div><div><dt>وضعیت پرونده</dt><dd>${escapeHtml(caregiver.fileStatus||'—')}</dd></div></dl></div><div class="p3-permit"><h3>پروانه صلاحیت</h3><i>✓</i><b>${escapeHtml(license.status||'ثبت نشده')}</b><small dir="ltr">${escapeHtml(license.number||'—')}</small><span>اعتبار تا ${escapeHtml(license.expiresAt||'—')}</span></div></section><section class="p3-reportgrid"><article><h3>هشت شاخص حرفه‌ای</h3><table>${indicatorScores.map(item=>`<tr><td>${item.indicator.code} • ${escapeHtml(item.indicator.title)}</td><td><i><u style="width:${item.value||0}%"></u></i><b>${item.value==null?'—':fa(item.value)}</b></td></tr>`).join('')}<tfoot><tr><td>امتیاز کل</td><td><strong>${score==null?'—':fa(score)}</strong></td></tr></tfoot></table></article><article><h3>رتبه حرفه‌ای خودکار</h3>${stars(rank.stars)}<b class="p3-rank">${rank.code?`${rank.code} • ${rank.title}`:'در انتظار تکمیل ۸ شاخص'}</b><p>رتبه از میانگین امتیاز شاخص‌های حرفه‌ای محاسبه می‌شود.</p></article><article><h3>سوابق حرفه‌ای</h3><ul><li>قراردادهای ثبت‌شده <b>${fa(contracts.length)}</b></li><li>شکایات ثبت‌شده <b>${fa(complaints.length)}</b></li><li>آموزش تخصیص‌یافته <b>${fa(assignments.length)}</b></li><li>اعتبار بازآموزی <b>${fa(credits)}</b></li></ul></article><article><h3>نقاط قوت</h3>${strengths.length?strengths.map(item=>`<p>✓ ${escapeHtml(item.indicator.title)} <b>${fa(item.value)}</b></p>`).join(''):'<p>پس از ارزیابی نمایش داده می‌شود.</p>'}</article><article><h3>زمینه‌های بهبود</h3>${gaps.length?gaps.map(item=>`<p>! ${escapeHtml(item.indicator.title)} <b>${fa(item.value)}</b></p>`).join(''):'<p>هنوز امتیازی ثبت نشده است.</p>'}</article><article><h3>نظر ارزیابی</h3><p>${completed<8?'کارنامه در حال تکمیل است و پس از امتیازدهی هر هشت شاخص رتبه نهایی می‌شود.':score>=80?'عملکرد حرفه‌ای مطلوب و باثبات است.':score>=60?'برنامه بهبود برای شاخص‌های کم‌امتیاز توصیه می‌شود.':'اقدام اصلاحی و بازآموزی فوری توصیه می‌شود.'}</p></article></section>${admin?'<footer><button class="btn outline" id="p3BackToList">بازگشت به فهرست</button><button class="btn outline" id="p3Print">چاپ کارنامه</button><button class="btn primary" id="p3OpenEvaluation">ورود به ارزیابی</button></footer>':''}</article>`;
}
function renderProfessionalDetail(caregiverId,caregiverOnly=false){
 const state=syncDerivedState();let caregiver;
 if(caregiverOnly){const session=read(SESSION_KEY,{}),user=authState().users.find(item=>item.id===session.userId);caregiver=state.caregivers.find(item=>item.id===(user?.caregiverId||session.caregiverId||selectedCaregiverId()))||state.caregivers[0]}
 else caregiver=state.caregivers.find(item=>item.id===caregiverId)||state.caregivers[0];
 if(caregiver)chooseCaregiver(caregiver.id);const period=caregiver?selectedPeriod(state,caregiver.id):null;
 setPage(caregiverOnly?'کارنامه حرفه‌ای':'کارنامه حرفه‌ای مراقب',caregiverOnly?'داشبورد رسمی عملکرد و صلاحیت حرفه‌ای شما':'نمایش نتیجه ارزیابی‌های ثبت‌شده برای مراقب انتخابی',`${caregiver&&!caregiverOnly?`<div class="p3-detail-tools"><button class="btn outline" id="p3BackTop">بازگشت به فهرست مراقبین</button><label>دوره ارزیابی<select id="p3ReportPeriod">${state.periods.filter(item=>item.caregiverId===caregiver.id).map(item=>`<option value="${item.id}" ${item.id===period?.id?'selected':''}>${escapeHtml(item.title)} • ${escapeHtml(item.status)}</option>`).join('')}</select></label></div>`:''}${caregiver?reportMarkup(caregiver,period,state,!caregiverOnly):'<div class="surface p3-empty">پرونده‌ای وجود ندارد.</div>'}`);
 $('#p3ReportPeriod')?.addEventListener('change',event=>{choosePeriod(event.currentTarget.value);renderProfessionalDetail(caregiver.id,caregiverOnly)});$('#p3BackTop')?.addEventListener('click',renderProfessionalList);$('#p3BackToList')?.addEventListener('click',renderProfessionalList);$('#p3Print')?.addEventListener('click',()=>window.print());$('#p3OpenEvaluation')?.addEventListener('click',()=>navigateTo('ارزیابی و پروانه'));
}
function navigateTo(label){const button=$$('.nav-item').find(item=>item.textContent.includes(label));if(button){button.click();return}try{window.renderModule?.(window.roles?.admin,['activity',label])}catch{}}
function derivedSummaryMarkup(caregiver,period){const score=performanceScore(period),completed=completedIndicators(period),rank=derivedRank(score,completed),license=caregiver.license||{};return `<article class="surface unified-pad p3-auto-rank"><div class="surface-head"><div><h3>رتبه حرفه‌ای خودکار</h3><p>خروجی مستقیم امتیاز هشت شاخص حرفه‌ای</p></div></div><div class="p3-auto-score"><small>میانگین شاخص‌ها</small><strong>${score==null?'—':fa(score)}</strong><span>${fa(completed)} از ۸ شاخص تکمیل‌شده</span></div>${stars(rank.stars)}<strong class="p3-rank">${rank.code?`${rank.code} • ${rank.title}`:'پس از تکمیل تمام شاخص‌ها محاسبه می‌شود'}</strong><p class="p3-explain">رتبه قابل انتخاب نیست و با تغییر امتیاز معیارها به‌صورت خودکار به‌روزرسانی می‌شود.</p></article><article class="surface unified-pad p3-auto-license"><div class="surface-head"><div><h3>پروانه صلاحیت</h3><p>شماره پروانه به‌صورت خودکار به پرونده تخصیص داده شده است.</p></div></div><div class="p3-license"><span>شماره خودکار پروانه</span><b dir="ltr">${escapeHtml(license.number||'—')}</b></div><form class="ev-form" id="p3UnifiedLicenseForm"><label>وضعیت<select name="status">${['ثبت نشده','فعال','در حال تمدید','تعلیق‌شده','منقضی','ابطال‌شده'].map(item=>`<option ${license.status===item?'selected':''}>${item}</option>`).join('')}</select></label><label>تاریخ صدور<input name="issuedAt" value="${escapeHtml(license.issuedAt||'')}"></label><label>تاریخ انقضا<input name="expiresAt" value="${escapeHtml(license.expiresAt||'')}"></label><button class="btn primary wide">ذخیره وضعیت پروانه</button></form></article>`}
function polishUnifiedEvaluation(){
 if($('#pageTitle')?.textContent.trim()!=='ارزیابی و پروانه')return;
 const state=syncDerivedState(),caregiver=state.caregivers.find(item=>item.id===selectedCaregiverId());if(!caregiver)return;const period=selectedPeriod(state,caregiver.id),rankForm=$('#unifiedRankForm'),licenseForm=$('#unifiedLicenseForm'),grid=rankForm?.closest('.unified-profile-grid')||licenseForm?.closest('.unified-profile-grid');
 if(grid&&!grid.dataset.derivedPolished){grid.dataset.derivedPolished='true';grid.innerHTML=derivedSummaryMarkup(caregiver,period);$('#p3UnifiedLicenseForm')?.addEventListener('submit',event=>{event.preventDefault();const fresh=evaluationState(),target=fresh.caregivers.find(item=>item.id===caregiver.id),data=new FormData(event.currentTarget);if(!target)return;target.license={...(target.license||{}),number:licenseNumber(target,fresh.caregivers.indexOf(target)),status:String(data.get('status')),issuedAt:String(data.get('issuedAt')),expiresAt:String(data.get('expiresAt'))};write(EVAL_KEY,fresh);window.dispatchEvent(new CustomEvent('salamat-evaluation-changed',{detail:{caregiverId:target.id}}));try{window.toast?.('پروانه ذخیره شد','وضعیت پروانه صلاحیت به‌روزرسانی شد.')}catch{};setTimeout(polishUnifiedEvaluation,40)})}
 const drawer=$('#drawer');if($('#unifiedScoringForm',drawer)){drawer.classList.add('evaluation-score-drawer');const body=$('#drawerBody',drawer);if(body&&!body.dataset.scrollReady){body.dataset.scrollReady='true';body.scrollTop=0}}
}
function userRoleOptions(selected){return Object.entries(roleLabels).map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('')}
function userStatusOptions(selected){return Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('')}
function openUserEditor(userId){
 const access=authState(),state=evaluationState(),user=access.users.find(item=>item.id===userId);if(!user)return;const caregiver=user.caregiverId?state.caregivers.find(item=>item.id===user.caregiverId):null,drawer=$('#drawer'),body=$('#drawerBody');if(!drawer||!body)return;$('#drawerTitle').textContent=`ویرایش پروفایل ${user.name}`;const currentPhoto=caregiver?.profile?.photo||user.photo||'';
 body.innerHTML=`<form id="p3UserProfileForm" class="p3-user-form"><section class="p3-user-photo"><div id="p3UserPhotoPreview">${currentPhoto?`<img src="${currentPhoto}" alt="${escapeHtml(user.name)}">`:`<span>${escapeHtml(initials(user.name))}</span>`}</div><div><strong>تصویر پروفایل</strong><small>تصویر انتخابی برای نمایش در تمام پنل‌ها بهینه می‌شود.</small><label class="btn outline">انتخاب تصویر<input id="p3UserPhotoInput" type="file" accept="image/*" hidden></label><button type="button" class="p3-remove-photo" id="p3RemoveUserPhoto">حذف تصویر</button></div></section><div class="p3-user-grid"><label>نام و نام خانوادگی<input name="name" required value="${escapeHtml(user.name||'')}"></label><label>ایمیل سازمانی / نام کاربری<input name="email" type="email" required dir="ltr" value="${escapeHtml(user.email||user.username||'')}"></label><label>شماره همراه<input name="mobile" required dir="ltr" value="${escapeHtml(user.mobile||'')}"></label><label>نقش<select name="role">${userRoleOptions(user.role)}</select></label><label>وضعیت حساب<select name="status">${userStatusOptions(user.status)}</select></label><label>رمز عبور جدید<input name="password" type="password" minlength="6" placeholder="برای عدم تغییر خالی بماند"></label>${caregiver?`<div class="p3-caregiver-profile-fields"><h4>اطلاعات پرونده حرفه‌ای</h4><label>کد حرفه‌ای<input value="${escapeHtml(caregiver.id)}" disabled dir="ltr"></label><label>کد ملی<input name="nationalId" maxlength="10" dir="ltr" value="${escapeHtml(caregiver.nationalId||'')}"></label><label>گروه خدمتی<select name="serviceGroup">${['مراقبت سالمند','مراقبت بیمار','مراقبت کودک','خدمات تخصصی'].map(item=>`<option ${caregiver.serviceGroup===item?'selected':''}>${item}</option>`).join('')}</select></label><label>وضعیت پرونده<select name="fileStatus">${['در انتظار تأیید مدیر','CP-01 فعال','CP-02 مشروط','CP-03 نیازمند تکمیل مدارک','CP-04 غیرفعال','CP-05 رد صلاحیت اولیه','بلک‌لیست'].map(item=>`<option ${caregiver.fileStatus===item?'selected':''}>${item}</option>`).join('')}</select></label><label>شهر<input name="city" value="${escapeHtml(caregiver.profile?.city||'')}"></label><label>تاریخ تولد<input name="birthDate" value="${escapeHtml(caregiver.profile?.birthDate||'')}"></label><label class="wide">مهارت‌ها<input name="skills" value="${escapeHtml(caregiver.profile?.skills||'')}"></label><label class="wide">نشانی<textarea name="address" rows="2">${escapeHtml(caregiver.profile?.address||'')}</textarea></label><label class="wide">سوابق و معرفی حرفه‌ای<textarea name="bio" rows="3">${escapeHtml(caregiver.profile?.bio||'')}</textarea></label><label class="wide">یادداشت مدیریتی<textarea name="adminNote" rows="3">${escapeHtml(caregiver.profile?.adminNote||'')}</textarea></label></div>`:''}</div><div class="p3-user-form-error" id="p3UserFormError"></div><button class="btn primary p3-user-save">ذخیره تمام تغییرات پروفایل</button></form>`;
 drawer.classList.add('open','profile-editor-drawer');$('#drawerBackdrop')?.classList.remove('hidden');body.scrollTop=0;let pendingPhoto=currentPhoto;
 $('#p3UserPhotoInput')?.addEventListener('change',async event=>{const file=event.currentTarget.files?.[0];if(!file)return;const error=$('#p3UserFormError');try{pendingPhoto=await optimizeImage(file);$('#p3UserPhotoPreview').innerHTML=`<img src="${pendingPhoto}" alt="پیش‌نمایش تصویر">`;error.textContent=''}catch(err){error.textContent=err.message||'بارگذاری تصویر انجام نشد.'}});$('#p3RemoveUserPhoto')?.addEventListener('click',()=>{pendingPhoto='';$('#p3UserPhotoPreview').innerHTML=`<span>${escapeHtml(initials(user.name))}</span>`});
 $('#p3UserProfileForm')?.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),email=normalize(data.get('email')),freshAccess=authState(),freshState=evaluationState(),target=freshAccess.users.find(item=>item.id===user.id),error=$('#p3UserFormError');if(!target)return;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){error.textContent='ایمیل سازمانی صحیح وارد کنید.';return}if(freshAccess.users.some(item=>item.id!==target.id&&normalize(item.email||item.username)===email)){error.textContent='این ایمیل برای کاربر دیگری ثبت شده است.';return}target.name=String(data.get('name')).trim();target.email=email;target.username=email;target.mobile=String(data.get('mobile')).trim();target.role=String(data.get('role'));target.status=String(data.get('status'));target.photo=pendingPhoto;if(String(data.get('password')||''))target.password=String(data.get('password'));if(target.status==='approved'&&!target.approvedAt)target.approvedAt=new Date().toISOString();const targetCare=target.caregiverId?freshState.caregivers.find(item=>item.id===target.caregiverId):null;if(targetCare){targetCare.name=target.name;targetCare.phone=target.mobile;targetCare.nationalId=String(data.get('nationalId')||'');targetCare.serviceGroup=String(data.get('serviceGroup')||targetCare.serviceGroup||'مراقبت سالمند');targetCare.fileStatus=String(data.get('fileStatus')||targetCare.fileStatus||'در انتظار تأیید مدیر');targetCare.profile={...(targetCare.profile||{}),photo:pendingPhoto,city:String(data.get('city')||''),birthDate:String(data.get('birthDate')||''),skills:String(data.get('skills')||''),address:String(data.get('address')||''),bio:String(data.get('bio')||''),adminNote:String(data.get('adminNote')||'')};if(target.status==='approved'&&targetCare.fileStatus==='در انتظار تأیید مدیر')targetCare.fileStatus='CP-03 نیازمند تکمیل مدارک'}write(AUTH_KEY,freshAccess);write(EVAL_KEY,freshState);window.dispatchEvent(new CustomEvent('salamat-access-changed',{detail:{userId:target.id}}));window.dispatchEvent(new CustomEvent('salamat-evaluation-changed',{detail:{caregiverId:target.caregiverId||''}}));drawer.classList.remove('open','profile-editor-drawer');$('#drawerBackdrop')?.classList.add('hidden');try{window.toast?.('پروفایل ذخیره شد','اطلاعات و تصویر کاربر در تمام پنل‌ها به‌روزرسانی شد.')}catch{};setTimeout(()=>navigateTo('کاربران و دسترسی‌ها'),30)});
}
function optimizeImage(file){return new Promise((resolve,reject)=>{if(!file.type.startsWith('image/')){reject(new Error('فقط فایل تصویری قابل بارگذاری است.'));return}if(file.size>10*1024*1024){reject(new Error('حجم تصویر باید کمتر از ۱۰ مگابایت باشد.'));return}const reader=new FileReader();reader.onerror=()=>reject(new Error('خواندن تصویر انجام نشد.'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('فایل تصویر معتبر نیست.'));image.onload=()=>{const max=720,scale=Math.min(1,max/Math.max(image.width,image.height)),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.drawImage(image,0,0,width,height);resolve(canvas.toDataURL('image/jpeg',.84))};image.src=String(reader.result)};reader.readAsDataURL(file)})}
function enhanceUserRows(){if($('#pageTitle')?.textContent.trim()!=='کاربران و دسترسی‌ها')return;$$('#unifiedUsersTable tbody tr').forEach(row=>{if(row.dataset.profileEditable)return;const userId=$('.ev-cell-note',row)?.textContent.trim();if(!userId)return;row.dataset.profileEditable='true';row.dataset.userId=userId;row.tabIndex=0;row.title='برای مشاهده و ویرایش پروفایل کلیک کنید';row.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button,a,input,select,textarea')){event.preventDefault();openUserEditor(userId)}})})}
function closeDrawerClasses(){const drawer=$('#drawer');if(!drawer?.classList.contains('open'))drawer?.classList.remove('evaluation-score-drawer','profile-editor-drawer')}
function install(){
 if(window.__professionalWorkflowV31)return true;let ready=false;try{ready=typeof renderModule==='function'&&typeof roles==='object'}catch{}if(!ready)return false;window.__professionalWorkflowV31=true;syncDerivedState();const previousRenderModule=renderModule;
 renderModule=function(roleModel,module){const label=module?.[1]||'';let admin=false,caregiver=false;try{admin=roleModel===roles.admin||currentRole()==='admin';caregiver=roleModel===roles.caregiver||currentRole()==='caregiver'}catch{}if(admin&&label==='ارزیابی و پروانه'){const result=previousRenderModule(roleModel,module);setTimeout(polishUnifiedEvaluation,0);return result}if(admin&&['پرونده حرفه‌ای مراقبین','پرونده مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین','فعال سازی پرونده حرفه ای مراقبین'].includes(label))return renderProfessionalList();if(caregiver&&['کارنامه حرفه‌ای','کارنامه کاری','رتبه و پروانه'].includes(label))return renderProfessionalDetail('',true);const result=previousRenderModule(roleModel,module);setTimeout(enhanceUserRows,0);return result};
 document.addEventListener('click',event=>{const row=event.target.closest?.('#unifiedUsersTable tbody tr[data-user-id]');if(row&&!event.target.closest('button,a,input,select,textarea,label')){event.preventDefault();openUserEditor(row.dataset.userId);return}const link=event.target.closest?.('[data-open-professional]');if(link&&currentRole()==='admin'){event.preventDefault();event.stopImmediatePropagation();renderProfessionalDetail(link.dataset.openProfessional,false)}},true);
 const content=$('#content');if(content){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polishUnifiedEvaluation();enhanceUserRows();closeDrawerClasses()})}).observe(content,{childList:true})}const drawerBody=$('#drawerBody');if(drawerBody)new MutationObserver(()=>polishUnifiedEvaluation()).observe(drawerBody,{childList:true});window.addEventListener('salamat-evaluation-changed',()=>setTimeout(()=>{syncDerivedState();polishUnifiedEvaluation()},40));window.addEventListener('salamat-access-changed',()=>setTimeout(enhanceUserRows,40));setTimeout(()=>{polishUnifiedEvaluation();enhanceUserRows()},0);return true;
}
function boot(){let attempts=0;const timer=setInterval(()=>{attempts+=1;if(install()||attempts>200)clearInterval(timer)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
