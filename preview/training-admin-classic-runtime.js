(()=>{
'use strict';

if(window.__salamatTrainingAdminClassicV2)return;
window.__salamatTrainingAdminClassicV2=true;

const MAX_UPLOAD=100*1024*1024;
const ALLOWED_EXT=/\.(pdf|doc|docx|xls|xlsx|txt|rtf|md|jpg|jpeg|png|webp|mp4|webm|mp3|m4a)$/i;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
let currentRenderModule=null;
let rendering=false;

function currentRole(){
 const backend=window.SalamatBackend?.getCurrentUser?.()?.role;
 if(backend)return String(backend).toUpperCase();
 try{return String(window.selectedRole||'').toUpperCase()}catch{return ''}
}
function isTrainingStaff(){return ['ADMIN','RECRUITER','HR'].includes(currentRole())}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
function errorText(error){return [error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:'',error?.providerStatus?`پاسخ فضای فایل: ${error.providerStatus}`:'',error?.detail?String(error.detail).slice(0,500):''].filter(Boolean).join(' — ')}
async function api(path,options={}){
 if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',...options,headers});
 const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;error.providerStatus=payload.providerStatus;throw error}
 return payload;
}
function bytes(value){const size=Number(value||0);if(size<1024)return `${fa(size)} بایت`;if(size<1024**2)return `${fa((size/1024).toFixed(1))} کیلوبایت`;return `${fa((size/1024**2).toFixed(1))} مگابایت`}
function fmtSeconds(value){const seconds=Math.max(0,Number(value||0)),hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),rest=Math.floor(seconds%60);if(hours)return `${fa(hours)} ساعت و ${fa(minutes)} دقیقه`;if(minutes)return `${fa(minutes)} دقیقه و ${fa(rest)} ثانیه`;return `${fa(rest)} ثانیه`}
function fmtDate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return String(value)}}
function statusLabel(value){return ({ACTIVE:'فعال',ARCHIVED:'آرشیو',ASSIGNED:'ارسال‌شده',IN_PROGRESS:'در حال مشاهده',COMPLETED:'تکمیل‌شده',CANCELLED:'لغوشده'})[String(value||'').toUpperCase()]||String(value||'—')}
function statusTone(value){const key=String(value||'').toUpperCase();return ['ACTIVE','COMPLETED'].includes(key)?'good':['ARCHIVED','CANCELLED'].includes(key)?'neutral':'warn'}
function badge(text,tone='neutral'){return `<span class="adm-badge ${tone}">${esc(text)}</span>`}
function empty(title,text){return `<div class="adm-empty"><span data-icon="book-open"></span><strong>${esc(title)}</strong><small>${esc(text)}</small></div>`}
function contentType(item){const value=String(item?.contentUrl||'').toLowerCase();if(/\.pdf(?:\?|$)/.test(value))return 'PDF';if(/\.(mp4|webm)(?:\?|$)/.test(value))return 'ویدئو';if(/\.(mp3|m4a)(?:\?|$)/.test(value))return 'صوت';if(/\.(jpg|jpeg|png|webp)(?:\?|$)/.test(value))return 'تصویر';if(/\.(doc|docx)(?:\?|$)/.test(value))return 'Word';if(/\.(xls|xlsx)(?:\?|$)/.test(value))return 'Excel';return /^https?:/i.test(value)?'لینک':'فایل'}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function setPage(title,subtitle,html){
 const titleEl=$('#pageTitle'),subtitleEl=$('#pageSubtitle'),content=$('#content');
 if(titleEl)titleEl.textContent=title;if(subtitleEl)subtitleEl.textContent=subtitle;
 if(content)content.innerHTML=`<section class="module-page adm-module training-classic-root">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
}
function setCourseStatus(text,tone='info'){
 const box=$('#trainingClassicStatus');if(!box)return;box.hidden=false;box.textContent=text;box.dataset.tone=tone;
}
function setAssignmentStatus(text,tone='info'){
 const box=$('#trainingAssignmentStatus');if(!box)return;box.hidden=false;box.textContent=text;box.dataset.tone=tone;
}
function setBusy(form,busy,text='در حال ثبت...'){
 const button=form?.querySelector('button[type="submit"]');if(!button)return;
 if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ثبت';
 button.disabled=busy;button.textContent=busy?text:button.dataset.originalText;
}
function addStyles(){
 if($('#trainingAdminClassicStylesV2'))return;
 const style=document.createElement('style');style.id='trainingAdminClassicStylesV2';style.textContent=`
.training-classic-root{direction:rtl}.training-classic-root .training-upload-box{grid-column:1/-1;border:1px dashed #9bc9af;border-radius:14px;padding:13px;background:#f6fbf8}.training-classic-root .training-upload-box input{padding:8px;background:#fff}.training-classic-root .training-upload-box small{display:block;margin-top:7px;color:#65776d;font-size:10px;line-height:1.8}.training-classic-root .training-file-meta{font-weight:800;color:#087847!important}.training-classic-root .training-status{grid-column:1/-1;padding:11px 13px;border-radius:12px;font-size:11px;font-weight:800;line-height:1.8}.training-classic-root .training-status[data-tone="info"]{background:#f1f7f4;color:#315846}.training-classic-root .training-status[data-tone="success"]{background:#eaf8ef;color:#176b3a}.training-classic-root .training-status[data-tone="error"]{background:#fff0f1;color:#a52335}.training-classic-root .training-table-note{display:block;margin-top:4px;color:#7b8982;font-size:9px;max-width:280px;overflow:hidden;text-overflow:ellipsis}.training-classic-root .training-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.training-classic-root .training-summary>div{padding:13px;border:1px solid #dfe9e4;border-radius:15px;background:#fff}.training-classic-root .training-summary small{display:block;color:#74837b;font-size:9px}.training-classic-root .training-summary strong{display:block;margin-top:6px;color:#087847;font-size:18px}.training-classic-root .training-actions{display:flex;gap:6px;align-items:center}.training-classic-root .training-actions button{border:0;border-radius:9px;padding:7px 9px;background:#edf8f2;color:#087847;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.training-classic-root .training-actions button.archive{background:#fff3df;color:#956000}.training-classic-root .training-actions button:disabled{opacity:.55;cursor:wait}
.training-classic-root .assignment-studio{margin-top:15px;border:1px solid #d9e8e0;border-radius:22px;background:#fff;overflow:hidden;box-shadow:0 14px 36px rgba(22,78,50,.055)}.training-classic-root .assignment-studio-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:19px 22px;border-bottom:1px solid #edf3ef;background:linear-gradient(135deg,#f6fbf8,#fff)}.training-classic-root .assignment-studio-head h3{margin:0;font-size:17px}.training-classic-root .assignment-studio-head p{margin:6px 0 0;color:#728178;font-size:10px}.training-classic-root .assignment-step-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:#e7f6ed;color:#087845;font-size:9px;font-weight:900}.training-classic-root .assignment-layout{display:grid;grid-template-columns:minmax(330px,.85fr) minmax(0,1.25fr);min-height:480px}.training-classic-root .assignment-config{padding:20px;border-left:1px solid #edf3ef;background:#fbfdfc}.training-classic-root .assignment-people{padding:20px}.training-classic-root .assignment-block{padding:15px;border:1px solid #e1ebe6;border-radius:16px;background:#fff;margin-bottom:12px}.training-classic-root .assignment-block:last-child{margin-bottom:0}.training-classic-root .assignment-block-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.training-classic-root .assignment-block-title strong{font-size:12px}.training-classic-root .assignment-block-title small{font-size:9px;color:#74837b}.training-classic-root .assignment-block select,.training-classic-root .assignment-block input,.training-classic-root .assignment-block textarea,.training-classic-root .recipient-toolbar input{width:100%;box-sizing:border-box;border:1px solid #d8e5de;border-radius:11px;background:#fff;padding:10px 11px;font:inherit;outline:none}.training-classic-root .assignment-block select:focus,.training-classic-root .assignment-block input:focus,.training-classic-root .assignment-block textarea:focus,.training-classic-root .recipient-toolbar input:focus{border-color:#15945a;box-shadow:0 0 0 3px #e2f5ea}.training-classic-root .assignment-block textarea{min-height:92px;resize:vertical}.training-classic-root .course-preview{display:none;margin-top:10px;padding:12px;border-radius:13px;background:#f3f9f6}.training-classic-root .course-preview.show{display:block}.training-classic-root .course-preview strong{display:block;font-size:12px;color:#17392a}.training-classic-root .course-preview p{margin:6px 0 0;color:#6e7e75;font-size:9px;line-height:1.8}.training-classic-root .course-preview-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.training-classic-root .course-preview-meta span{padding:5px 8px;border-radius:999px;background:#fff;color:#087845;border:1px solid #dcebe3;font-size:8px;font-weight:900}.training-classic-root .recipient-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-bottom:10px}.training-classic-root .recipient-toolbar button{border:0;border-radius:10px;padding:9px 11px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.training-classic-root .recipient-toolbar .select-all{background:#e8f6ee;color:#087845}.training-classic-root .recipient-toolbar .clear-all{background:#f1f3f2;color:#65736b}.training-classic-root .recipient-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:10px 12px;border-radius:12px;background:#f5f9f7;color:#466052;font-size:10px}.training-classic-root .recipient-summary strong{font-size:13px;color:#087845}.training-classic-root .recipient-list-v2{max-height:354px;overflow:auto;display:grid;gap:7px;padding:2px}.training-classic-root .recipient-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #e1ebe6;border-radius:13px;background:#fff;cursor:pointer;transition:.15s}.training-classic-root .recipient-card:hover{border-color:#acd8c1;transform:translateY(-1px)}.training-classic-root .recipient-card.selected{border-color:#0b9856;background:#f0faf5;box-shadow:0 0 0 2px #e4f6ec}.training-classic-root .recipient-card input{position:absolute;opacity:0;pointer-events:none}.training-classic-root .recipient-avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#e1f4e9;color:#087845;font-size:12px;font-weight:900}.training-classic-root .recipient-info strong{display:block;font-size:11px;color:#233a2f}.training-classic-root .recipient-info small{display:block;margin-top:4px;color:#74837b;font-size:9px}.training-classic-root .recipient-check{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;border:1px solid #cadbd2;color:transparent;background:#fff;font-size:13px}.training-classic-root .recipient-card.selected .recipient-check{background:#078848;border-color:#078848;color:#fff}.training-classic-root .assignment-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;border-top:1px solid #edf3ef;background:#f8fbf9}.training-classic-root .assignment-footer-copy strong{display:block;font-size:12px;color:#20392d}.training-classic-root .assignment-footer-copy small{display:block;margin-top:4px;color:#75837b;font-size:9px}.training-classic-root .assignment-submit{min-width:190px;border:0;border-radius:12px;padding:12px 17px;background:#078848;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 9px 22px rgba(7,136,72,.2)}.training-classic-root .assignment-submit:disabled{opacity:.55;cursor:wait;box-shadow:none}
@media(max-width:1050px){.training-classic-root .training-summary{grid-template-columns:repeat(2,1fr)}.training-classic-root .assignment-layout{grid-template-columns:1fr}.training-classic-root .assignment-config{border-left:0;border-bottom:1px solid #edf3ef}.training-classic-root .recipient-list-v2{max-height:300px}}@media(max-width:650px){.training-classic-root .training-summary{grid-template-columns:1fr}.training-classic-root .assignment-studio-head,.training-classic-root .assignment-footer{align-items:stretch;flex-direction:column}.training-classic-root .recipient-toolbar{grid-template-columns:1fr 1fr}.training-classic-root .recipient-toolbar input{grid-column:1/-1}.training-classic-root .assignment-submit{width:100%}.training-classic-root .assignment-layout{min-height:0}}
`;document.head.appendChild(style)
}
function caregiverOption(row){
 const search=`${row.fullName||''} ${row.membershipCode||''} ${row.mobile||''} ${row.primaryType||''} ${row.city||''}`.toLowerCase();
 return `<label class="recipient-card" data-training-recipient-search="${esc(search)}"><input type="checkbox" name="caregiverIds" value="${esc(row.id)}"><span class="recipient-avatar">${esc(initials(row.fullName))}</span><span class="recipient-info"><strong>${esc(row.fullName||'بدون نام')}</strong><small>${esc(row.membershipCode||row.id)} • ${esc(row.mobile||'شماره ثبت نشده')} ${row.primaryType?`• ${esc(row.primaryType)}`:''}</small></span><span class="recipient-check">✓</span></label>`
}
function coursePreviewMarkup(course){
 if(!course)return '<strong>هنوز محتوایی انتخاب نشده است.</strong><p>از فهرست بالا یک آموزش فعال را انتخاب کنید.</p>';
 return `<strong>${esc(course.title||'بدون عنوان')}</strong><p>${esc(course.description||'برای این محتوا توضیحی ثبت نشده است.')}</p><div class="course-preview-meta"><span>${esc(contentType(course))}</span><span>${esc(course.category||'عمومی')}</span><span>${fa(course.durationMinutes||0)} دقیقه</span>${course.mandatory?'<span>الزامی</span>':''}</div>`;
}
async function uploadTrainingFile(file){
 if(!file||!file.size)throw new Error('فایل انتخاب نشده است.');
 if(file.size>MAX_UPLOAD)throw new Error('حجم فایل باید کمتر از ۱۰۰ مگابایت باشد.');
 if(!ALLOWED_EXT.test(file.name||''))throw new Error('فرمت این فایل برای بانک آموزش پشتیبانی نمی‌شود.');
 const response=await fetch('/api/files/raw',{method:'POST',credentials:'same-origin',headers:{'content-type':file.type||'application/octet-stream','x-file-name':encodeURIComponent(file.name),'x-file-category':'training','x-file-size':String(file.size)},body:file});
 const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||'بارگذاری فایل روی سرور انجام نشد.');error.code=payload.error;error.detail=payload.detail;error.providerStatus=payload.providerStatus;throw error}
 if(!payload?.data?.id)throw new Error('شناسه فایل ذخیره‌شده دریافت نشد.');
 return {fileId:payload.data.id,contentUrl:`/api/files/${encodeURIComponent(payload.data.id)}/download?inline=1`};
}
async function cleanupUploadedFile(fileId){if(!fileId)return;try{await api(`/api/files/${encodeURIComponent(fileId)}`,{method:'DELETE'})}catch{}}

async function renderTrainingAdminClassic(){
 if(rendering)return;rendering=true;
 setPage('بانک آموزش','مدیریت فایل‌ها، تخصیص آموزش و پایش مشاهده','<div class="adm-empty">در حال دریافت اطلاعات بانک آموزش...</div>');
 try{
  const [adminPayload,caregiverPayload]=await Promise.all([api('/api/training/admin'),api('/api/caregivers')]);
  const data=adminPayload.data||{},courses=Array.isArray(data.courses)?data.courses:[],assignments=Array.isArray(data.assignments)?data.assignments:[],caregivers=Array.isArray(caregiverPayload.data)?caregiverPayload.data:[];
  const activeCourses=courses.filter(item=>String(item.status).toUpperCase()==='ACTIVE');
  const totalViews=courses.reduce((sum,item)=>sum+Number(item.totalOpenCount||0),0),totalSeconds=courses.reduce((sum,item)=>sum+Number(item.totalViewSeconds||0),0);
  setPage('بانک آموزش','مدیریت فایل‌ها، تخصیص آموزش و پایش مشاهده',`
   <section class="training-summary"><div><small>محتوای ثبت‌شده</small><strong>${fa(courses.length)}</strong></div><div><small>تخصیص به مراقبین</small><strong>${fa(assignments.length)}</strong></div><div><small>دفعات بازشدن</small><strong>${fa(totalViews)}</strong></div><div><small>زمان مشاهده فعال</small><strong>${esc(fmtSeconds(totalSeconds))}</strong></div></section>
   <section class="surface"><div class="surface-head"><div><h3>افزودن محتوای آموزشی</h3><p>فایل را مستقیم روی سرور پارس‌پک بارگذاری کنید یا یک لینک آموزشی ثبت نمایید.</p></div></div><form class="ev-form" id="trainingClassicCourseForm" novalidate><label>عنوان آموزش<input name="title" required></label><label>دسته‌بندی<input name="category" placeholder="پیش از اعزام"></label><label>مدت اسمی به دقیقه<input name="durationMinutes" type="number" min="0" value="0"></label><label>اعتبار آموزشی<input name="credit" type="number" min="0" value="0"></label><label class="wide">توضیحات<textarea name="description" rows="3"></textarea></label><label class="training-upload-box"><span>فایل آموزشی</span><input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.md,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a"><small>حداکثر حجم ۱۰۰ مگابایت؛ فایل به‌صورت خصوصی در فضای فایل سازمان ذخیره می‌شود.</small><small class="training-file-meta" id="trainingClassicFileMeta">فایلی انتخاب نشده است.</small></label><label class="wide">یا نشانی محتوا<input name="contentUrl" placeholder="https://..."></label><label class="wide"><span><input name="mandatory" type="checkbox"> این آموزش الزامی است</span></label><div class="training-status" id="trainingClassicStatus" data-tone="info">یک فایل انتخاب کنید یا نشانی محتوای آموزشی را وارد نمایید.</div><button type="submit" class="btn primary wide">ثبت در بانک آموزش</button></form></section>
   <form class="assignment-studio" id="trainingClassicAssignForm">
    <div class="assignment-studio-head"><div><span class="assignment-step-badge">تخصیص هدفمند آموزش</span><h3>انتخاب محتوا و مراقبین</h3><p>ابتدا محتوا را انتخاب کن، سپس مراقبین را جست‌وجو و مشخص کن و در پایان مهلت و پیام همراه را ثبت کن.</p></div><div class="assignment-step-badge"><span id="assignmentSelectedCount">۰</span> مراقب انتخاب‌شده</div></div>
    <div class="assignment-layout">
     <section class="assignment-config">
      <div class="assignment-block"><div class="assignment-block-title"><strong>۱. محتوای آموزشی</strong><small>${fa(activeCourses.length)} محتوای فعال</small></div><select name="courseId" id="trainingAssignmentCourse" required><option value="">یک آموزش را انتخاب کنید</option>${activeCourses.map(item=>`<option value="${esc(item.id)}">${esc(item.title)} • ${esc(contentType(item))}</option>`).join('')}</select><div class="course-preview" id="trainingCoursePreview">${coursePreviewMarkup(null)}</div></div>
      <div class="assignment-block"><div class="assignment-block-title"><strong>۲. زمان‌بندی</strong><small>اختیاری</small></div><input name="dueAt" type="date"></div>
      <div class="assignment-block"><div class="assignment-block-title"><strong>۳. پیام همراه</strong><small>در پنل مراقب نمایش داده می‌شود</small></div><textarea name="assignmentNote" placeholder="هدف این آموزش یا توضیح موردنیاز را بنویسید..."></textarea></div>
      <div class="training-status" id="trainingAssignmentStatus" data-tone="info">برای شروع، یک محتوا و حداقل یک مراقب انتخاب کنید.</div>
     </section>
     <section class="assignment-people">
      <div class="assignment-block-title"><strong>انتخاب مراقبین</strong><small>${fa(caregivers.length)} پرونده قابل انتخاب</small></div>
      <div class="recipient-toolbar"><input id="trainingClassicRecipientSearch" placeholder="جست‌وجوی نام، کد پرونده، موبایل یا گروه خدمتی"><button type="button" class="select-all" id="trainingSelectAllVisible">انتخاب نتایج</button><button type="button" class="clear-all" id="trainingClearSelection">پاک‌کردن</button></div>
      <div class="recipient-summary"><span>فقط مراقبین موردنظر را انتخاب کن.</span><strong><span id="assignmentSelectedCountInline">۰</span> نفر</strong></div>
      <div class="recipient-list-v2">${caregivers.length?caregivers.map(caregiverOption).join(''):'<div class="adm-empty">پرونده مراقبی وجود ندارد.</div>'}</div>
     </section>
    </div>
    <div class="assignment-footer"><div class="assignment-footer-copy"><strong id="assignmentFooterTitle">آموزشی انتخاب نشده است</strong><small id="assignmentFooterText">پس از انتخاب محتوا و مراقبین، تخصیص ثبت می‌شود.</small></div><button type="submit" class="assignment-submit">ثبت تخصیص آموزش</button></div>
   </form>
   <section class="adm-grid two"><article class="surface table-wrap"><div class="surface-head"><div><h3>محتواهای بانک</h3><p>${fa(courses.length)} مورد ثبت‌شده</p></div></div><table class="data-table"><thead><tr><th>عنوان</th><th>نوع</th><th>دسته</th><th>تخصیص</th><th>بازدید</th><th>زمان مشاهده</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${courses.map(item=>`<tr><td><strong>${esc(item.title)}</strong><small class="training-table-note">${esc(item.code||'')} • ${esc(item.contentUrl||'بدون فایل')}</small></td><td>${esc(contentType(item))}</td><td>${esc(item.category||'—')}</td><td>${fa(item.assignedCount||0)}</td><td>${fa(item.totalOpenCount||0)}</td><td>${esc(fmtSeconds(item.totalViewSeconds||0))}</td><td>${badge(statusLabel(item.status),statusTone(item.status))}</td><td><div class="training-actions">${item.contentUrl?`<button type="button" data-training-preview="${esc(item.contentUrl)}">مشاهده</button>`:''}<button type="button" class="${String(item.status).toUpperCase()==='ACTIVE'?'archive':''}" data-training-toggle="${esc(item.id)}|${String(item.status).toUpperCase()==='ACTIVE'?'ARCHIVED':'ACTIVE'}">${String(item.status).toUpperCase()==='ACTIVE'?'آرشیو':'فعال‌سازی'}</button></div></td></tr>`).join('')}</tbody></table>${courses.length?'':empty('بانک آموزش خالی است','اولین فایل یا لینک آموزشی را از فرم بالا اضافه کنید.')}</article>
   <article class="surface table-wrap"><div class="surface-head"><div><h3>تخصیص‌های مراقبین</h3><p>${fa(assignments.length)} تخصیص ثبت‌شده</p></div></div><table class="data-table"><thead><tr><th>مراقب</th><th>محتوا</th><th>ارسال‌کننده</th><th>مهلت</th><th>بازدید</th><th>زمان مشاهده</th><th>وضعیت</th></tr></thead><tbody>${assignments.map(item=>`<tr><td><strong>${esc(item.caregiverName||'—')}</strong><small class="training-table-note">${esc(item.membershipCode||item.caregiverId||'')}</small></td><td>${esc(item.title||'—')}</td><td>${esc(item.assignedByName||'—')}<small class="training-table-note">${esc(item.assignedByRoleLabel||'')}</small></td><td>${esc(item.dueAt?fmtDate(item.dueAt):'—')}</td><td>${fa(item.openCount||0)}</td><td>${esc(fmtSeconds(item.totalViewSeconds||0))}</td><td>${badge(statusLabel(item.status),statusTone(item.status))}</td></tr>`).join('')}</tbody></table>${assignments.length?'':empty('تخصیصی وجود ندارد','از فرم بالا آموزش را به یک یا چند مراقب اختصاص دهید.')}</article></section>`);
  bindPage(courses);
 }catch(error){setPage('بانک آموزش','خطا در دریافت اطلاعات',`<div class="training-status" data-tone="error">${esc(errorText(error))}</div>`)}finally{rendering=false}
}
function bindPage(courses){
 const courseForm=$('#trainingClassicCourseForm'),fileInput=courseForm?.elements.file;
 fileInput?.addEventListener('change',()=>{const file=fileInput.files?.[0],meta=$('#trainingClassicFileMeta');if(!meta)return;if(!file){meta.textContent='فایلی انتخاب نشده است.';return}const valid=file.size<=MAX_UPLOAD&&ALLOWED_EXT.test(file.name||'');meta.textContent=`${file.name} • ${bytes(file.size)} • ${valid?'آماده ارسال':'نامعتبر'}`;meta.style.color=valid?'#087847':'#a52335'});
 courseForm?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,fd=new FormData(form),title=String(fd.get('title')||'').trim(),file=fileInput?.files?.[0],externalUrl=String(fd.get('contentUrl')||'').trim();if(!title){setCourseStatus('عنوان آموزش را وارد کنید.','error');return}if(!file&&!externalUrl){setCourseStatus('یک فایل آموزشی انتخاب کنید یا نشانی محتوا را وارد نمایید.','error');return}setBusy(form,true,file?'در حال بارگذاری فایل...':'در حال ثبت آموزش...');let uploaded=null;try{let contentUrl=externalUrl;if(file){setCourseStatus(`در حال ارسال ${file.name} به سرور پارس‌پک...`,'info');uploaded=await uploadTrainingFile(file);contentUrl=uploaded.contentUrl;setCourseStatus('فایل ذخیره شد؛ در حال ثبت مشخصات آموزش...','info')}await api('/api/training/courses',{method:'POST',body:JSON.stringify({title,category:String(fd.get('category')||'').trim(),description:String(fd.get('description')||'').trim(),durationMinutes:Number(fd.get('durationMinutes')||0),credit:Number(fd.get('credit')||0),mandatory:fd.get('mandatory')==='on',contentUrl})});setCourseStatus(file?'فایل و مشخصات آموزش با موفقیت ثبت شدند.':'لینک آموزشی با موفقیت ثبت شد.','success');notify('آموزش ثبت شد',file?'فایل روی سرور پارس‌پک ذخیره و به بانک آموزش اضافه شد.':'لینک به بانک آموزش اضافه شد.');setTimeout(renderTrainingAdminClassic,350)}catch(error){if(uploaded?.fileId)await cleanupUploadedFile(uploaded.fileId);setCourseStatus(errorText(error),'error');notify('ثبت آموزش انجام نشد',errorText(error));setBusy(form,false)} });
 const assignForm=$('#trainingClassicAssignForm'),courseSelect=$('#trainingAssignmentCourse');
 const updateAssignmentSummary=()=>{
  const selectedCards=$$('.recipient-card input:checked').map(input=>input.closest('.recipient-card')).filter(Boolean),count=selectedCards.length;
  $$('.recipient-card').forEach(card=>card.classList.toggle('selected',Boolean($('input',card)?.checked)));
  if($('#assignmentSelectedCount'))$('#assignmentSelectedCount').textContent=fa(count);
  if($('#assignmentSelectedCountInline'))$('#assignmentSelectedCountInline').textContent=fa(count);
  const course=courses.find(item=>String(item.id)===String(courseSelect?.value||''));
  const preview=$('#trainingCoursePreview');if(preview){preview.innerHTML=coursePreviewMarkup(course);preview.classList.toggle('show',Boolean(course))}
  if($('#assignmentFooterTitle'))$('#assignmentFooterTitle').textContent=course?course.title:'آموزشی انتخاب نشده است';
  if($('#assignmentFooterText'))$('#assignmentFooterText').textContent=course?`${fa(count)} مراقب برای دریافت این آموزش انتخاب شده‌اند.`:'پس از انتخاب محتوا و مراقبین، تخصیص ثبت می‌شود.';
 };
 courseSelect?.addEventListener('change',updateAssignmentSummary);
 $('#trainingClassicRecipientSearch')?.addEventListener('input',event=>{const query=String(event.target.value||'').trim().toLowerCase();$$('[data-training-recipient-search]').forEach(row=>row.hidden=Boolean(query&&!String(row.dataset.trainingRecipientSearch||'').includes(query)))});
 $$('.recipient-card input').forEach(input=>input.addEventListener('change',updateAssignmentSummary));
 $('#trainingSelectAllVisible')?.addEventListener('click',()=>{$$('.recipient-card:not([hidden]) input').forEach(input=>{input.checked=true});updateAssignmentSummary()});
 $('#trainingClearSelection')?.addEventListener('click',()=>{$$('.recipient-card input').forEach(input=>{input.checked=false});updateAssignmentSummary()});
 updateAssignmentSummary();
 assignForm?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,fd=new FormData(form),caregiverIds=fd.getAll('caregiverIds').map(String),courseId=String(fd.get('courseId')||'');if(!courseId){setAssignmentStatus('یک محتوای آموزشی را انتخاب کنید.','error');return}if(!caregiverIds.length){setAssignmentStatus('حداقل یک مراقب را انتخاب کنید.','error');return}setBusy(form,true,'در حال تخصیص...');setAssignmentStatus(`در حال ثبت آموزش برای ${fa(caregiverIds.length)} مراقب...`,'info');try{await api('/api/training/assignments',{method:'POST',body:JSON.stringify({courseId,caregiverIds,dueAt:String(fd.get('dueAt')||''),assignmentNote:String(fd.get('assignmentNote')||'')})});setAssignmentStatus('تخصیص با موفقیت ثبت شد.','success');notify('آموزش تخصیص داده شد',`آموزش برای ${fa(caregiverIds.length)} مراقب ثبت شد.`);setTimeout(renderTrainingAdminClassic,250)}catch(error){setAssignmentStatus(errorText(error),'error');notify('تخصیص انجام نشد',errorText(error));setBusy(form,false)}});
 $$('[data-training-preview]').forEach(button=>button.addEventListener('click',()=>window.open(button.dataset.trainingPreview,'_blank','noopener')));
 $$('[data-training-toggle]').forEach(button=>button.addEventListener('click',async()=>{const [id,status]=String(button.dataset.trainingToggle||'').split('|');if(!id)return;button.disabled=true;try{await api(`/api/training/courses/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});notify('وضعیت آموزش تغییر کرد',status==='ACTIVE'?'آموزش فعال شد.':'آموزش به آرشیو منتقل شد.');renderTrainingAdminClassic()}catch(error){button.disabled=false;notify('تغییر وضعیت انجام نشد',errorText(error))}}));
}
function moduleLabel(module){return String(Array.isArray(module)?module[1]:module||'').trim()}
function install(){
 const current=window.renderModule;
 if(typeof current!=='function')return false;
 if(current.__trainingAdminClassicV2)return true;
 currentRenderModule=current;
 const wrapped=function(...args){const label=moduleLabel(args[1]);if(isTrainingStaff()&&label.includes('آموزش')){void renderTrainingAdminClassic();return}return current.apply(this,args)};
 wrapped.__trainingAdminClassicV2=true;wrapped.__trainingAdminClassicBase=current;window.renderModule=wrapped;try{renderModule=wrapped}catch{}return true;
}
function boot(){addStyles();let attempts=0;const timer=setInterval(()=>{install();if(++attempts>160)clearInterval(timer)},100);setTimeout(()=>setInterval(install,1500),17000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
