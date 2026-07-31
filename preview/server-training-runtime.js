(()=>{
'use strict';
if(window.__salamatServerTrainingV1)return;
window.__salamatServerTrainingV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const roleLabels={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'کارشناس منابع انسانی'};
let activeSession=null;
let nativeRenderModule=null;

function currentRole(){
  const backend=window.SalamatBackend?.getCurrentUser?.()?.role;
  if(backend)return String(backend).toUpperCase();
  try{return String(selectedRole||'').toUpperCase()}catch{return ''}
}
function isCaregiver(){return currentRole()==='CAREGIVER'||currentRole()==='CAREGIVER'.toLowerCase()}
function isTrainingStaff(){return ['ADMIN','RECRUITER','HR'].includes(currentRole())}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}
function setPage(title,subtitle,html){
  const titleEl=$('#pageTitle'),subtitleEl=$('#pageSubtitle'),content=$('#content');
  if(titleEl)titleEl.textContent=title;if(subtitleEl)subtitleEl.textContent=subtitle;
  if(content)content.innerHTML=`<section class="module-page str-root">${html}</section>`;
  try{window.hydrateIcons?.(content)}catch{}
}
function loading(title='آموزش‌های من'){setPage(title,'داده‌های واقعی آموزش و میزان مشاهده','<div class="str-loading">در حال دریافت آموزش‌های تخصیص‌یافته...</div>')}
function fmtSeconds(value){
  const seconds=Math.max(0,Number(value||0)),hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),rest=Math.floor(seconds%60);
  if(hours)return `${fa(hours)} ساعت و ${fa(minutes)} دقیقه`;
  if(minutes)return `${fa(minutes)} دقیقه و ${fa(rest)} ثانیه`;
  return `${fa(rest)} ثانیه`;
}
function fmtDate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return String(value)}}
function statusLabel(value){return ({ASSIGNED:'ارسال‌شده',IN_PROGRESS:'در حال مشاهده',COMPLETED:'تکمیل‌شده',CANCELLED:'لغوشده'})[String(value||'').toUpperCase()]||String(value||'—')}
function addStyles(){
  if($('#serverTrainingStyles'))return;
  const style=document.createElement('style');style.id='serverTrainingStyles';style.textContent=`
.str-root{direction:rtl}.str-loading,.str-empty{padding:52px 20px;text-align:center;border:1px dashed #cfe0d7;border-radius:22px;background:#fbfdfc;color:#687970}.str-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:15px}.str-head h2{margin:5px 0;font-size:22px}.str-head p{margin:0;color:#74827b;font-size:10px;line-height:1.8}.str-eyebrow{display:inline-flex;padding:5px 10px;border-radius:999px;background:#e9f7ef;color:#087847;font-size:8px;font-weight:900}.str-btn{border:0;border-radius:12px;padding:10px 14px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.str-btn.primary{background:#078848;color:#fff}.str-btn.soft{background:#eaf7f0;color:#087847}.str-btn.outline{background:#fff;color:#087847;border:1px solid #cfe3d8}.str-btn:disabled{opacity:.55;cursor:wait}.str-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:15px}.str-kpi{padding:14px;border:1px solid #dfe9e4;border-radius:17px;background:#fff}.str-kpi small{display:block;color:#77867e;font-size:8px}.str-kpi strong{display:block;margin-top:7px;font-size:18px;color:#087847}.str-kpi span{display:block;margin-top:5px;color:#7e8b84;font-size:8px}.str-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.str-card{border:1px solid #dce8e2;border-radius:20px;background:#fff;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(21,72,47,.045)}.str-card header{display:flex;justify-content:space-between;gap:10px}.str-card h3{margin:0;font-size:14px;line-height:1.8}.str-badge{height:max-content;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087847;font-size:7px;font-weight:900;white-space:nowrap}.str-card p{margin:0;color:#738179;font-size:9px;line-height:1.8;min-height:34px}.str-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px}.str-meta div{padding:9px;border-radius:11px;background:#f6f9f7}.str-meta small{display:block;color:#7c8982;font-size:7px}.str-meta b{display:block;margin-top:4px;font-size:9px}.str-progress{height:7px;border-radius:999px;background:#edf2ef;overflow:hidden}.str-progress i{display:block;height:100%;background:#078848;border-radius:inherit}.str-card footer{display:flex;gap:7px;align-items:center;margin-top:auto}.str-card footer .str-btn{flex:1}.str-trust-note{margin-bottom:14px;padding:12px 14px;border-radius:14px;background:#eef8f2;color:#386b51;font-size:9px;line-height:1.9}.str-course-view{display:grid;gap:13px}.str-course-top{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:17px;border:1px solid #dce8e2;border-radius:20px;background:#fff}.str-course-top h2{margin:4px 0;font-size:20px}.str-course-top p{margin:0;color:#74827b;font-size:9px;line-height:1.9}.str-live{min-width:180px;padding:13px;border-radius:15px;background:#edf8f2;text-align:center}.str-live small{display:block;font-size:8px;color:#5f7569}.str-live strong{display:block;margin-top:6px;color:#087847;font-size:17px}.str-viewer{min-height:560px;border:1px solid #dce8e2;border-radius:20px;background:#fff;overflow:hidden}.str-viewer iframe,.str-viewer video{display:block;width:100%;height:560px;border:0;background:#f7faf8}.str-viewer audio{display:block;width:calc(100% - 40px);margin:40px auto}.str-no-content{padding:70px 20px;text-align:center;color:#728078}.str-admin-layout{display:grid;grid-template-columns:minmax(300px,.7fr) minmax(0,1.3fr);gap:14px;align-items:start}.str-surface{border:1px solid #dce8e2;border-radius:20px;background:#fff;padding:16px}.str-surface h3{margin:0 0 4px;font-size:14px}.str-surface>p{margin:0 0 13px;color:#7a8881;font-size:8px;line-height:1.8}.str-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.str-form label{display:flex;flex-direction:column;gap:5px;font-size:8px;font-weight:900;color:#3e5147}.str-form input,.str-form select,.str-form textarea{width:100%;box-sizing:border-box;border:1px solid #d9e5df;border-radius:10px;padding:10px;font:inherit;outline:none}.str-form textarea{min-height:75px;resize:vertical}.str-wide{grid-column:1/-1}.str-form .str-btn{grid-column:1/-1}.str-recipient-list{max-height:250px;overflow:auto;border:1px solid #e0e9e5;border-radius:12px;padding:7px}.str-recipient{display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #edf2ef;font-size:8px}.str-recipient:last-child{border-bottom:0}.str-table-wrap{overflow:auto}.str-table{width:100%;border-collapse:collapse;min-width:760px}.str-table th,.str-table td{padding:10px 8px;border-bottom:1px solid #edf2ef;text-align:right;font-size:8px;white-space:nowrap}.str-table th{color:#6d7d74;background:#f7faf8}.str-table td b{font-size:9px}.str-stack{display:grid;gap:13px}.str-error{padding:10px;border-radius:11px;background:#fff0f1;color:#ab2b3d;font-size:8px;line-height:1.7}.str-file-note{padding:9px;border-radius:10px;background:#f5f8f6;color:#68776f;font-size:7px;line-height:1.8}
@media(max-width:1100px){.str-grid{grid-template-columns:repeat(2,1fr)}.str-admin-layout{grid-template-columns:1fr}.str-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.str-grid,.str-kpis{grid-template-columns:1fr}.str-head,.str-course-top{flex-direction:column}.str-live{width:100%;box-sizing:border-box}.str-form{grid-template-columns:1fr}.str-wide,.str-form .str-btn{grid-column:auto}.str-viewer,.str-viewer iframe,.str-viewer video{height:430px;min-height:430px}}
`;document.head.appendChild(style)
}

async function cleanupSession(){
  const session=activeSession;activeSession=null;
  if(!session)return;
  clearInterval(session.timer);
  try{await api(`/api/training/sessions/${encodeURIComponent(session.id)}/close`,{method:'POST',body:'{}'})}catch{}
}
function beaconClose(){
  if(!activeSession)return;
  try{navigator.sendBeacon(`/api/training/sessions/${encodeURIComponent(activeSession.id)}/close`,new Blob(['{}'],{type:'application/json'}))}catch{}
}
window.addEventListener('pagehide',beaconClose);

function assignmentCard(item){
  return `<article class="str-card"><header><div><span class="str-eyebrow">${esc(item.category||'آموزش سازمانی')}</span><h3>${esc(item.title)}</h3></div><span class="str-badge">${esc(statusLabel(item.status))}</span></header><p>${esc(item.description||'توضیحی برای این آموزش ثبت نشده است.')}</p><div class="str-meta"><div><small>ارسال‌کننده</small><b>${esc(item.assignedByName||'—')} • ${esc(item.assignedByRoleLabel||roleLabels[item.assignedByRole]||'—')}</b></div><div><small>زمان اسمی آموزش</small><b>${fa(item.durationMinutes||0)} دقیقه</b></div><div><small>تعداد دفعات بازشدن</small><b>${fa(item.openCount||0)} بار</b></div><div><small>زمان مشاهده فعال</small><b>${esc(fmtSeconds(item.totalViewSeconds||0))}</b></div></div><div class="str-progress"><i style="width:${Math.max(0,Math.min(100,Number(item.progress||0)))}%"></i></div><footer><button class="str-btn primary" data-training-open="${esc(item.enrollmentId)}">مشاهده آموزش</button>${item.mandatory?'<span class="str-badge">الزامی</span>':''}</footer></article>`
}

async function renderCaregiverTraining(){
  await cleanupSession();loading();
  try{
    const payload=await api('/api/training/my');const data=payload.data||{},items=data.assignments||[],summary=data.summary||{};
    setPage('آموزش‌های من','فقط آموزش‌های ارسال‌شده توسط مدیر، جذب یا منابع انسانی',`<section class="str-head"><div><span class="str-eyebrow">آموزش سازمانی قابل ردیابی</span><h2>آموزش‌های تخصیص‌یافته به شما</h2><p>در این بخش هیچ محتوای نمونه‌ای نمایش داده نمی‌شود؛ فقط آموزش‌هایی دیده می‌شوند که از پنل‌های مجاز برای پرونده شما ارسال شده‌اند.</p></div></section><div class="str-trust-note">تعداد دفعات بازشدن و زمان مشاهده فعال هر آموزش ثبت می‌شود. زمان فقط هنگامی افزایش پیدا می‌کند که صفحه آموزش باز، قابل مشاهده و در حال استفاده باشد.</div><section class="str-kpis"><article class="str-kpi"><small>کل آموزش‌های ارسالی</small><strong>${fa(summary.assigned||0)}</strong><span>تخصیص رسمی</span></article><article class="str-kpi"><small>آموزش‌های بازشده</small><strong>${fa(summary.opened||0)}</strong><span>حداقل یک مشاهده</span></article><article class="str-kpi"><small>تکمیل‌شده</small><strong>${fa(summary.completed||0)}</strong><span>تأییدشده توسط شما</span></article><article class="str-kpi"><small>کل زمان مشاهده</small><strong>${esc(fmtSeconds(summary.totalViewSeconds||0))}</strong><span>زمان فعال ثبت‌شده</span></article></section>${items.length?`<section class="str-grid">${items.map(assignmentCard).join('')}</section>`:'<div class="str-empty"><strong>هنوز آموزشی برای شما ارسال نشده است.</strong><br><small>پس از تخصیص توسط مدیر سامانه، کارشناس جذب یا منابع انسانی، آموزش در همین صفحه نمایش داده می‌شود.</small></div>'}`);
    $$('[data-training-open]').forEach(button=>button.addEventListener('click',()=>openCourse(items.find(item=>item.enrollmentId===button.dataset.trainingOpen))));
  }catch(error){setPage('آموزش‌های من','خطا در دریافت آموزش‌ها',`<div class="str-error">${esc(error.message)}</div>`)}
}

function viewerMarkup(item){
  let url=String(item.contentUrl||'').trim();
  if(!url)return '<div class="str-no-content">محتوای این آموزش هنوز بارگذاری نشده است.</div>';
  const safe=esc(url),lower=url.toLowerCase();
  if(/\.(mp4|webm)(\?|$)/.test(lower))return `<video controls preload="metadata" src="${safe}"></video>`;
  if(/\.(mp3|m4a)(\?|$)/.test(lower))return `<audio controls preload="metadata" src="${safe}"></audio>`;
  if(url.startsWith('/')||url.startsWith(location.origin))return `<iframe src="${safe}" title="${esc(item.title)}"></iframe>`;
  return `<div class="str-no-content"><p>این آموزش در یک نشانی بیرونی قرار دارد.</p><a class="str-btn primary" href="${safe}" target="_blank" rel="noopener">باز کردن محتوای آموزش</a><p>برای ثبت دقیق زمان، صفحه آموزش باشگاه را باز نگه دارید.</p></div>`;
}

async function openCourse(item){
  if(!item)return;
  await cleanupSession();loading(item.title);
  try{
    const clientSessionKey=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload=await api(`/api/training/enrollments/${encodeURIComponent(item.enrollmentId)}/open`,{method:'POST',body:JSON.stringify({clientSessionKey})});
    const sessionId=payload.data.sessionId;let viewed=Number(item.totalViewSeconds||0);
    setPage(item.title,'مشاهده آموزش و ثبت زمان فعال',`<section class="str-course-view"><div class="str-course-top"><div><button class="str-btn outline" id="strBack">بازگشت به آموزش‌ها</button><span class="str-eyebrow">${esc(item.assignedByRoleLabel||'آموزش سازمانی')}</span><h2>${esc(item.title)}</h2><p>${esc(item.description||'')}</p><p>ارسال‌شده توسط <b>${esc(item.assignedByName||'—')}</b> در ${esc(fmtDate(item.assignedAt))}</p></div><div class="str-live"><small>زمان مشاهده فعال ثبت‌شده</small><strong id="strLiveTime">${esc(fmtSeconds(viewed))}</strong><small>تعداد بازشدن: ${fa(Number(item.openCount||0)+1)} بار</small></div></div><div class="str-viewer">${viewerMarkup(item)}</div><div><button class="str-btn primary" id="strComplete">تأیید تکمیل آموزش</button></div></section>`);
    const heartbeat=async()=>{
      if(document.visibilityState!=='visible'||!document.hasFocus())return;
      try{const result=await api(`/api/training/sessions/${encodeURIComponent(sessionId)}/heartbeat`,{method:'POST',body:'{}'});viewed=Number(item.totalViewSeconds||0)+Number(result.data?.durationSeconds||0);const target=$('#strLiveTime');if(target)target.textContent=fmtSeconds(viewed)}catch{}
    };
    activeSession={id:sessionId,timer:setInterval(heartbeat,15000)};
    $('#strBack')?.addEventListener('click',renderCaregiverTraining);
    $('#strComplete')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await api(`/api/training/enrollments/${encodeURIComponent(item.enrollmentId)}/complete`,{method:'POST',body:'{}'});notify('آموزش تکمیل شد','وضعیت این آموزش در پرونده شما ثبت شد.');renderCaregiverTraining()}catch(error){button.disabled=false;notify('ثبت انجام نشد',error.message)}});
  }catch(error){setPage(item.title,'خطا در بازکردن آموزش',`<div class="str-error">${esc(error.message)}</div>`)}
}

function caregiverOption(row){return `<label class="str-recipient" data-recipient-search="${esc(`${row.fullName||''} ${row.membershipCode||''} ${row.mobile||''}`.toLowerCase())}"><input type="checkbox" name="caregiverIds" value="${esc(row.id)}"><span><b>${esc(row.fullName||'بدون نام')}</b><br><small>${esc(row.membershipCode||row.id)} • ${esc(row.mobile||'—')}</small></span></label>`}

async function uploadTrainingFile(file){
  const response=await fetch(`/api/files/raw?category=training&filename=${encodeURIComponent(file.name)}`,{method:'POST',credentials:'same-origin',headers:{'content-type':file.type||'application/octet-stream','x-file-name':encodeURIComponent(file.name),'x-file-category':'training','x-file-size':String(file.size)},body:file});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||'بارگذاری فایل آموزش انجام نشد.');
  return `/api/files/${encodeURIComponent(payload.data.id)}/download?inline=1`;
}

async function renderTrainingAdmin(){
  await cleanupSession();loading('مدیریت آموزش');
  try{
    const [adminPayload,caregiverPayload]=await Promise.all([api('/api/training/admin'),api('/api/caregivers')]);
    const data=adminPayload.data||{},courses=data.courses||[],assignments=data.assignments||[],caregivers=caregiverPayload.data||[];
    setPage('مدیریت آموزش','ارسال آموزش واقعی و مشاهده میزان استفاده مراقبین',`<section class="str-head"><div><span class="str-eyebrow">سامانه آموزش قابل حسابرسی</span><h2>ایجاد، ارسال و پایش آموزش مراقبین</h2><p>فقط آموزش‌هایی که از این بخش به پرونده مراقب تخصیص داده شوند در پنل «آموزش‌های من» ظاهر خواهند شد.</p></div><button class="str-btn soft" id="strRefresh">به‌روزرسانی آمار</button></section><section class="str-admin-layout"><div class="str-stack"><article class="str-surface"><h3>ثبت محتوای آموزشی</h3><p>فایل را در فضای امن سازمان بارگذاری کنید یا نشانی محتوا را وارد نمایید.</p><form class="str-form" id="strCourseForm"><label>عنوان آموزش<input name="title" required></label><label>دسته‌بندی<input name="category" placeholder="مراقبت سالمند"></label><label>مدت اسمی به دقیقه<input name="durationMinutes" type="number" min="0"></label><label>اعتبار آموزشی<input name="credit" type="number" min="0"></label><label class="str-wide">توضیحات<textarea name="description"></textarea></label><label class="str-wide">فایل آموزش<input name="file" type="file" accept=".pdf,.doc,.docx,.mp4,.webm,.mp3,.m4a,.jpg,.jpeg,.png,.webp"></label><label class="str-wide">یا نشانی محتوا<input name="contentUrl" placeholder="https://... یا /api/files/..."></label><label class="str-wide"><span><input name="mandatory" type="checkbox"> آموزش الزامی است</span></label><div class="str-file-note str-wide">تعداد بازدید و زمان مشاهده فعال از لحظه بازکردن آموزش توسط مراقب ثبت می‌شود.</div><button class="str-btn primary">ثبت آموزش در بانک سازمان</button></form></article><article class="str-surface"><h3>ارسال آموزش به مراقب</h3><p>یک آموزش و یک یا چند پرونده مراقب را انتخاب کنید.</p><form class="str-form" id="strAssignForm"><label class="str-wide">آموزش<select name="courseId" required><option value="">انتخاب آموزش</option>${courses.filter(x=>x.status==='ACTIVE').map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label><label>مهلت مشاهده<input name="dueAt" type="date"></label><label>جست‌وجوی مراقب<input id="strRecipientSearch" placeholder="نام، کد یا موبایل"></label><label class="str-wide">پیام همراه<textarea name="assignmentNote"></textarea></label><div class="str-recipient-list str-wide" id="strRecipientList">${caregivers.map(caregiverOption).join('')}</div><button class="str-btn primary">ارسال آموزش انتخاب‌شده</button></form></article></div><div class="str-stack"><article class="str-surface"><h3>بانک آموزش و آمار کل</h3><p>آمار هر آموزش از رکوردهای واقعی بازشدن و زمان مشاهده محاسبه می‌شود.</p><div class="str-table-wrap"><table class="str-table"><thead><tr><th>آموزش</th><th>تخصیص</th><th>مراقب بازکننده</th><th>کل دفعات بازشدن</th><th>کل زمان مشاهده</th></tr></thead><tbody>${courses.length?courses.map(row=>`<tr><td><b>${esc(row.title)}</b><br><small>${esc(row.code)}</small></td><td>${fa(row.assignedCount)}</td><td>${fa(row.openedCaregiverCount)}</td><td>${fa(row.totalOpenCount)}</td><td>${esc(fmtSeconds(row.totalViewSeconds))}</td></tr>`).join(''):'<tr><td colspan="5">هنوز آموزشی ثبت نشده است.</td></tr>'}</tbody></table></div></article><article class="str-surface"><h3>ریز مشاهده مراقبین</h3><p>ارسال‌کننده، تعداد بازشدن و طول مشاهده هر مراقب مشخص است.</p><div class="str-table-wrap"><table class="str-table"><thead><tr><th>مراقب</th><th>آموزش</th><th>ارسال‌کننده</th><th>بازدید</th><th>زمان مشاهده</th><th>آخرین مشاهده</th><th>وضعیت</th></tr></thead><tbody>${assignments.length?assignments.map(row=>`<tr><td><b>${esc(row.caregiverName)}</b><br><small>${esc(row.membershipCode||row.caregiverId)}</small></td><td>${esc(row.title)}</td><td>${esc(row.assignedByName)}<br><small>${esc(row.assignedByRoleLabel)}</small></td><td>${fa(row.openCount)} بار</td><td>${esc(fmtSeconds(row.totalViewSeconds))}</td><td>${esc(fmtDate(row.lastViewedAt||row.lastOpenedAt))}</td><td>${esc(statusLabel(row.status))}</td></tr>`).join(''):'<tr><td colspan="7">هنوز آموزشی به مراقبی ارسال نشده است.</td></tr>'}</tbody></table></div></article></div></section>`);
    $('#strRefresh')?.addEventListener('click',renderTrainingAdmin);
    $('#strRecipientSearch')?.addEventListener('input',event=>{const query=String(event.target.value||'').trim().toLowerCase();$$('[data-recipient-search]').forEach(row=>row.hidden=Boolean(query&&!row.dataset.recipientSearch.includes(query)))});
    $('#strCourseForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),fd=new FormData(form);button.disabled=true;try{const file=fd.get('file');let contentUrl=String(fd.get('contentUrl')||'').trim();if(file instanceof File&&file.size)contentUrl=await uploadTrainingFile(file);await api('/api/training/courses',{method:'POST',body:JSON.stringify({title:fd.get('title'),category:fd.get('category'),description:fd.get('description'),durationMinutes:Number(fd.get('durationMinutes')||0),credit:Number(fd.get('credit')||0),mandatory:fd.get('mandatory')==='on',contentUrl})});notify('آموزش ثبت شد','اکنون می‌توانید آن را به مراقبین ارسال کنید.');renderTrainingAdmin()}catch(error){button.disabled=false;notify('ثبت انجام نشد',error.message)}});
    $('#strAssignForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"]',form),fd=new FormData(form),caregiverIds=fd.getAll('caregiverIds').map(String);if(!caregiverIds.length)return notify('مراقب انتخاب نشده','حداقل یک مراقب را انتخاب کنید.');button.disabled=true;try{await api('/api/training/assignments',{method:'POST',body:JSON.stringify({courseId:fd.get('courseId'),caregiverIds,dueAt:fd.get('dueAt'),assignmentNote:fd.get('assignmentNote')})});notify('آموزش ارسال شد',`آموزش برای ${fa(caregiverIds.length)} مراقب ثبت شد.`);renderTrainingAdmin()}catch(error){button.disabled=false;notify('ارسال انجام نشد',error.message)}});
  }catch(error){setPage('مدیریت آموزش','خطا در دریافت اطلاعات',`<div class="str-error">${esc(error.message)}</div>`)}
}

function ensureNavigation(){
  try{
    const configs=[['caregiver','آموزش‌های من'],['admin','مدیریت آموزش'],['recruiter','ارسال آموزش'],['hr','ارسال آموزش']];
    for(const [key,label] of configs){const nav=roles?.[key]?.nav;if(Array.isArray(nav)&&!nav.some(item=>String(item?.[1]||'').includes('آموزش')))nav.push(['book-open',label])}
  }catch{}
}
function install(){
  addStyles();ensureNavigation();
  try{
    if(typeof renderModule!=='function')return false;
    if(renderModule.__serverTraining)return true;
    nativeRenderModule=renderModule;
    const patched=function(roleConfig,module){
      const label=String(module?.[1]||'');
      if(label.includes('آموزش')){
        if(isTrainingStaff())return renderTrainingAdmin();
        return renderCaregiverTraining();
      }
      cleanupSession();
      return nativeRenderModule(roleConfig,module);
    };
    patched.__serverTraining=true;
    renderModule=patched;window.renderModule=patched;
    return true;
  }catch{return false}
}
function boot(){let attempts=0;const timer=setInterval(()=>{if(install()||++attempts>120)clearInterval(timer)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
