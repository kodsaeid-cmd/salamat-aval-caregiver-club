(()=>{
'use strict';
if(window.__salamatTrainingAdminRowActionsV1)return;
window.__salamatTrainingAdminRowActionsV1=true;

const VERSION='1.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
let courses=[];
let fetchedAt=0;
let fetchPromise=null;
let activeCourse=null;

function currentRole(){
 const backend=window.SalamatBackend?.getCurrentUser?.()?.role;
 if(backend)return String(backend).toUpperCase();
 try{return String(window.selectedRole||'').toUpperCase()}catch{return ''}
}
function isAdmin(){return currentRole()==='ADMIN'}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
async function api(path,options={}){
 if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
 const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;throw error}
 return payload;
}
function contentType(item){const value=String(item?.contentUrl||'').toLowerCase();if(/\.pdf(?:\?|$)/.test(value))return'PDF';if(/\.(mp4|webm|mov)(?:\?|$)/.test(value))return'ویدئو';if(/\.(mp3|m4a|wav|ogg)(?:\?|$)/.test(value))return'صوت';if(/\.(jpg|jpeg|png|webp)(?:\?|$)/.test(value))return'تصویر';if(/\.(doc|docx)(?:\?|$)/.test(value))return'Word';if(/\.(xls|xlsx)(?:\?|$)/.test(value))return'Excel';return /^https?:/i.test(value)?'لینک':'فایل'}
function statusLabel(value){return({ACTIVE:'فعال',ARCHIVED:'آرشیو'})[String(value||'').toUpperCase()]||String(value||'—')}
function safeUrl(value){try{const url=new URL(String(value||''),window.location.origin);return['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}}
function viewer(item){
 const url=safeUrl(item?.contentUrl);if(!url)return'<div class="tra-state"><strong>محتوای این آموزش هنوز بارگذاری نشده است.</strong></div>';
 const safe=esc(url),path=new URL(url).pathname.toLowerCase();
 if(/\.(mp4|webm|mov)$/.test(path))return`<video controls preload="metadata" src="${safe}"></video>`;
 if(/\.(mp3|m4a|wav|ogg)$/.test(path))return`<audio controls preload="metadata" src="${safe}"></audio>`;
 return`<iframe src="${safe}" title="${esc(item?.title||'محتوای آموزش')}" loading="eager" referrerpolicy="same-origin"></iframe>`;
}
function addStyles(){
 if($('#trainingAdminRowActionsV1Styles'))return;
 const style=document.createElement('style');style.id='trainingAdminRowActionsV1Styles';style.textContent=`
.training-classic-root tr.training-row-clickable{cursor:pointer;transition:background .15s ease,box-shadow .15s ease}.training-classic-root tr.training-row-clickable:hover{background:#f4fbf7}.training-classic-root tr.training-row-clickable:focus{outline:2px solid #16975a;outline-offset:-2px}.training-classic-root tr.training-row-clickable td:first-child strong:after{content:'  ›';color:#0a8750;font-weight:900}.training-classic-root [data-training-preview][hidden]{display:none!important}.tra-modal[hidden]{display:none!important}.tra-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:22px;direction:rtl}.tra-backdrop{position:absolute;inset:0;background:rgba(5,24,16,.58);backdrop-filter:blur(4px)}.tra-dialog{position:relative;width:min(920px,calc(100vw - 32px));max-height:min(88vh,900px);overflow:auto;border-radius:25px;background:#fff;box-shadow:0 28px 90px rgba(0,0,0,.28)}.tra-head{position:sticky;top:0;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #e7eee9;background:rgba(255,255,255,.96);backdrop-filter:blur(10px)}.tra-head strong{display:block;font-size:16px;color:#17382a}.tra-head small{display:block;margin-top:4px;font-size:9px;color:#718178}.tra-close{width:38px;height:38px;border:0;border-radius:12px;background:#f0f4f2;color:#315846;font:900 18px inherit;cursor:pointer}.tra-body{padding:20px}.tra-course-hero{padding:20px;border-radius:20px;background:linear-gradient(135deg,#087a45,#075b38);color:#fff}.tra-course-hero h2{margin:8px 0 7px;color:#fff;font-size:22px}.tra-course-hero p{margin:0;color:rgba(255,255,255,.82);font-size:10px;line-height:1.9}.tra-pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.tra-pills span{padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:8px;font-weight:900}.tra-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:13px 0}.tra-meta div{padding:12px;border:1px solid #e1ebe6;border-radius:14px;background:#fbfdfc}.tra-meta small{display:block;color:#75837c;font-size:8px}.tra-meta strong{display:block;margin-top:5px;color:#213c2e;font-size:11px}.tra-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.tra-btn{border:0;border-radius:12px;padding:10px 14px;font:900 10px inherit;cursor:pointer}.tra-btn.primary{background:#078848;color:#fff}.tra-btn.outline{background:#eef8f3;color:#087847}.tra-btn.danger{background:#fff0f1;color:#a62536}.tra-btn.muted{background:#f1f3f2;color:#5f7067}.tra-note{margin-top:12px;padding:11px 13px;border-radius:13px;background:#f4f8f6;color:#5e7267;font-size:9px;line-height:1.9}.tra-form{display:grid;grid-template-columns:1fr 1fr;gap:11px}.tra-form label{display:grid;gap:6px;font-size:9px;font-weight:900;color:#415c4f}.tra-form label.wide{grid-column:1/-1}.tra-form input,.tra-form textarea{width:100%;box-sizing:border-box;border:1px solid #d7e4dd;border-radius:12px;padding:11px 12px;background:#fff;font:inherit;outline:none}.tra-form textarea{min-height:105px;resize:vertical}.tra-form input:focus,.tra-form textarea:focus{border-color:#15945a;box-shadow:0 0 0 3px #e2f5ea}.tra-check{display:flex!important;align-items:center;gap:8px!important}.tra-check input{width:auto!important}.tra-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:16px;border:1px solid #dce8e2;border-radius:18px;background:#fff}.tra-preview-head h2{margin:7px 0 5px;font-size:20px}.tra-preview-head p{margin:0;color:#718078;font-size:9px;line-height:1.9}.tra-preview-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#eaf7f0;color:#087847;font-size:8px;font-weight:900}.tra-viewer{min-height:510px;margin-top:12px;border:1px solid #dce8e2;border-radius:18px;background:#fff;overflow:hidden}.tra-viewer iframe,.tra-viewer video{display:block;width:100%;height:510px;border:0;background:#f7faf8}.tra-viewer audio{display:block;width:calc(100% - 42px);margin:50px auto}.tra-state{min-height:260px;display:grid;place-items:center;text-align:center;color:#6c7e74}.tra-danger-box{padding:16px;border:1px solid #f0cfd4;border-radius:16px;background:#fff7f8;color:#772b38}.tra-danger-box strong{display:block;font-size:13px}.tra-danger-box p{margin:7px 0 0;font-size:9px;line-height:1.9}.tra-busy{opacity:.6;pointer-events:none}@media(max-width:720px){.tra-dialog{width:min(100%,calc(100vw - 18px));max-height:92vh}.tra-body{padding:14px}.tra-meta{grid-template-columns:1fr 1fr}.tra-form{grid-template-columns:1fr}.tra-form label.wide{grid-column:auto}.tra-preview-head{flex-direction:column}.tra-viewer,.tra-viewer iframe,.tra-viewer video{min-height:420px;height:420px}}
`;document.head.appendChild(style)
}
function ensureModal(){
 let modal=$('#trainingAdminRowActionsModal');if(modal)return modal;
 modal=document.createElement('div');modal.id='trainingAdminRowActionsModal';modal.className='tra-modal';modal.hidden=true;modal.innerHTML=`<div class="tra-backdrop" data-tra-close></div><section class="tra-dialog" role="dialog" aria-modal="true" aria-labelledby="traDialogTitle"><header class="tra-head"><div><strong id="traDialogTitle">مدیریت آموزش</strong><small id="traDialogSubtitle">جزئیات محتوای ثبت‌شده</small></div><button class="tra-close" type="button" data-tra-close aria-label="بستن">×</button></header><div class="tra-body" id="traDialogBody"></div></section>`;
 document.body.appendChild(modal);
 $$('[data-tra-close]',modal).forEach(node=>node.addEventListener('click',closeModal));
 return modal;
}
function closeModal(){const modal=$('#trainingAdminRowActionsModal');if(modal)modal.hidden=true;activeCourse=null}
function setModalTitle(title,subtitle){const modal=ensureModal();$('#traDialogTitle',modal).textContent=title;$('#traDialogSubtitle',modal).textContent=subtitle}
function setBody(html){const modal=ensureModal();$('#traDialogBody',modal).innerHTML=html;modal.hidden=false}
function courseById(id){return courses.find(item=>String(item.id)===String(id))||null}
async function loadCourses(force=false){
 if(!force&&courses.length&&Date.now()-fetchedAt<5000)return courses;
 if(fetchPromise)return fetchPromise;
 fetchPromise=api('/api/training/admin').then(payload=>{courses=Array.isArray(payload?.data?.courses)?payload.data.courses:[];fetchedAt=Date.now();return courses}).finally(()=>{fetchPromise=null});
 return fetchPromise;
}
function detailMarkup(course){return`<section class="tra-course-hero"><span class="tra-preview-badge">محتوای بانک آموزش</span><h2>${esc(course.title||'آموزش بدون عنوان')}</h2><p>${esc(course.description||'برای این آموزش توضیحی ثبت نشده است.')}</p><div class="tra-pills"><span>${esc(contentType(course))}</span><span>${esc(course.category||'عمومی')}</span><span>${esc(statusLabel(course.status))}</span>${course.mandatory?'<span>الزامی</span>':''}</div></section><section class="tra-meta"><div><small>مدت اسمی</small><strong>${fa(course.durationMinutes||0)} دقیقه</strong></div><div><small>تخصیص به مراقبین</small><strong>${fa(course.assignedCount||0)} نفر</strong></div><div><small>دفعات بازشدن</small><strong>${fa(course.totalOpenCount||0)} بار</strong></div><div><small>حد نصاب</small><strong>${fa(course.passingScore||0)}٪</strong></div></section><div class="tra-actions"><button type="button" class="tra-btn primary" data-tra-view>مشاهده آموزش</button><button type="button" class="tra-btn outline" data-tra-edit>ویرایش</button><button type="button" class="tra-btn danger" data-tra-delete>حذف</button></div><div class="tra-note">«مشاهده آموزش» پیش‌نمایش نمای مراقب است و هیچ بازدید، زمان مشاهده یا پیشرفتی برای مراقب ثبت نمی‌کند.</div>`}
function openDetail(course){
 activeCourse=course;setModalTitle('مدیریت آموزش','ویرایش، حذف و مشاهده همان نمایی که مراقب می‌بیند');setBody(detailMarkup(course));
 const modal=ensureModal();$('[data-tra-view]',modal)?.addEventListener('click',()=>openCaregiverPreview(course));$('[data-tra-edit]',modal)?.addEventListener('click',()=>openEdit(course));$('[data-tra-delete]',modal)?.addEventListener('click',()=>openDelete(course));
}
function openCaregiverPreview(course){
 activeCourse=course;setModalTitle('پیش‌نمایش مراقب','این نمایش بدون ایجاد نشست مشاهده یا تغییر پیشرفت است');
 const url=safeUrl(course.contentUrl);setBody(`<section class="tra-preview-head"><div><span class="tra-preview-badge">نمای مراقب</span><h2>${esc(course.title||'آموزش')}</h2><p>${esc(course.description||'')}</p><p>${fa(course.durationMinutes||0)} دقیقه ${course.mandatory?'• آموزش الزامی':''}</p></div><button type="button" class="tra-btn muted" data-tra-back>بازگشت</button></section><section class="tra-viewer">${viewer(course)}</section><div class="tra-actions">${url?`<button type="button" class="tra-btn outline" data-tra-external>بازکردن محتوا در تب جدا</button>`:''}</div><div class="tra-note">این پیش‌نمایش از همان الگوی نمایش محتوای پنل مراقب استفاده می‌کند، اما API ثبت زمان و پیشرفت فراخوانی نمی‌شود.</div>`);
 const modal=ensureModal();$('[data-tra-back]',modal)?.addEventListener('click',()=>openDetail(course));if(url)$('[data-tra-external]',modal)?.addEventListener('click',()=>window.open(url,'_blank','noopener'));
}
function openEdit(course){
 activeCourse=course;setModalTitle('ویرایش آموزش','مشخصات اصلی محتوای ثبت‌شده را اصلاح کنید');setBody(`<form class="tra-form" id="traEditForm"><label>عنوان آموزش<input name="title" required value="${esc(course.title||'')}"></label><label>مدت اسمی به دقیقه<input name="durationMinutes" type="number" min="0" value="${Number(course.durationMinutes||0)}"></label><label class="wide">توضیحات<textarea name="description">${esc(course.description||'')}</textarea></label><label>حد نصاب قبولی<input name="passingScore" type="number" min="0" max="100" value="${Number(course.passingScore||0)}"></label><label class="tra-check"><input name="mandatory" type="checkbox" ${course.mandatory?'checked':''}> آموزش الزامی است</label><label class="wide">نشانی محتوا<input name="contentUrl" dir="ltr" value="${esc(course.contentUrl||'')}"></label><div class="tra-actions wide"><button type="submit" class="tra-btn primary">ذخیره تغییرات</button><button type="button" class="tra-btn muted" data-tra-back>انصراف</button></div></form>`);
 const modal=ensureModal(),form=$('#traEditForm',modal);$('[data-tra-back]',modal)?.addEventListener('click',()=>openDetail(course));form?.addEventListener('submit',async event=>{event.preventDefault();const fd=new FormData(form),title=String(fd.get('title')||'').trim();if(!title)return notify('عنوان آموزش الزامی است','عنوان را وارد کنید.');form.classList.add('tra-busy');try{const body={title,description:String(fd.get('description')||'').trim(),durationMinutes:Number(fd.get('durationMinutes')||0),passingScore:Number(fd.get('passingScore')||0),mandatory:fd.get('mandatory')==='on',contentUrl:String(fd.get('contentUrl')||'').trim()};const payload=await api(`/api/training/courses/${encodeURIComponent(course.id)}`,{method:'PATCH',body:JSON.stringify(body)});const next={...course,...body,...(payload?.data||{})};courses=courses.map(item=>String(item.id)===String(course.id)?next:item);fetchedAt=Date.now();notify('آموزش ویرایش شد','تغییرات با موفقیت ذخیره شد.');openDetail(next);refreshTrainingPage()}catch(error){form.classList.remove('tra-busy');notify('ویرایش انجام نشد',error?.message||String(error))}})
}
function openDelete(course){
 activeCourse=course;setModalTitle('حذف آموزش','این عملیات آموزش را از بانک فعال خارج می‌کند');setBody(`<section class="tra-danger-box"><strong>حذف «${esc(course.title||'این آموزش')}»؟</strong><p>${Number(course.assignedCount||0)>0?`این آموزش برای ${fa(course.assignedCount)} مراقب تخصیص ثبت‌شده دارد. حذف به‌صورت نرم انجام می‌شود تا سابقه پایگاه داده محفوظ بماند، اما دیگر در بانک و پنل مراقبین نمایش داده نخواهد شد.`:'آموزش از بانک حذف می‌شود. سابقه حذف برای ممیزی سیستم محفوظ می‌ماند.'}</p></section><div class="tra-actions"><button type="button" class="tra-btn danger" data-tra-confirm-delete>تأیید حذف</button><button type="button" class="tra-btn muted" data-tra-back>انصراف</button></div>`);
 const modal=ensureModal();$('[data-tra-back]',modal)?.addEventListener('click',()=>openDetail(course));$('[data-tra-confirm-delete]',modal)?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await api(`/api/training/courses/${encodeURIComponent(course.id)}`,{method:'DELETE'});courses=courses.filter(item=>String(item.id)!==String(course.id));fetchedAt=Date.now();document.querySelector(`[data-training-course-row="${CSS.escape(String(course.id))}"]`)?.remove();notify('آموزش حذف شد','آموزش از بانک فعال حذف شد.');closeModal();refreshTrainingPage()}catch(error){button.disabled=false;notify('حذف انجام نشد',error?.message||String(error))}})
}
function refreshTrainingPage(){setTimeout(()=>{const active=$$('#sidebarNav button.active, .sidebar-nav button.active').find(button=>String(button.textContent||'').includes('آموزش'));if(active){active.click();return}void enhanceRows(true)},220)}
async function enhanceRows(force=false){
 if(!isAdmin())return;
 const root=$('.training-classic-root');if(!root)return;
 const toggles=$$('[data-training-toggle]',root);if(!toggles.length)return;
 try{await loadCourses(force)}catch{return}
 toggles.forEach(toggle=>{const [id]=String(toggle.dataset.trainingToggle||'').split('|');if(!id)return;const row=toggle.closest('tr');if(!row||row.dataset.trainingRowActions==='1')return;const course=courseById(id);if(!course)return;row.dataset.trainingRowActions='1';row.dataset.trainingCourseRow=id;row.classList.add('training-row-clickable');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',`مدیریت آموزش ${course.title||''}`);const legacyPreview=row.querySelector('[data-training-preview]');if(legacyPreview)legacyPreview.hidden=true;const open=event=>{if(event.target.closest('button,a,input,select,textarea,label'))return;openDetail(courseById(id)||course)};row.addEventListener('click',open);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail(courseById(id)||course)}})});
}
function boot(){
 addStyles();ensureModal();document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!ensureModal().hidden)closeModal()});let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;void enhanceRows()},80)};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setInterval(()=>void enhanceRows(),1600);schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
