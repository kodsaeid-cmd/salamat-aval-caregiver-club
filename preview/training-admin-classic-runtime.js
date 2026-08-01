(()=>{
'use strict';

if(window.__salamatTrainingAdminClassicV1)return;
window.__salamatTrainingAdminClassicV1=true;

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
function setPage(title,subtitle,html){
 const titleEl=$('#pageTitle'),subtitleEl=$('#pageSubtitle'),content=$('#content');
 if(titleEl)titleEl.textContent=title;if(subtitleEl)subtitleEl.textContent=subtitle;
 if(content)content.innerHTML=`<section class="module-page adm-module training-classic-root">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
}
function setCourseStatus(text,tone='info'){
 const box=$('#trainingClassicStatus');if(!box)return;box.hidden=false;box.textContent=text;box.dataset.tone=tone;
}
function setBusy(form,busy,text='در حال ثبت...'){
 const button=form?.querySelector('button[type="submit"]');if(!button)return;
 if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ثبت';
 button.disabled=busy;button.textContent=busy?text:button.dataset.originalText;
}
function addStyles(){
 if($('#trainingAdminClassicStyles'))return;
 const style=document.createElement('style');style.id='trainingAdminClassicStyles';style.textContent=`
.training-classic-root{direction:rtl}.training-classic-root .training-upload-box{grid-column:1/-1;border:1px dashed #9bc9af;border-radius:14px;padding:13px;background:#f6fbf8}.training-classic-root .training-upload-box input{padding:8px;background:#fff}.training-classic-root .training-upload-box small{display:block;margin-top:7px;color:#65776d;font-size:10px;line-height:1.8}.training-classic-root .training-file-meta{font-weight:800;color:#087847!important}.training-classic-root .training-status{grid-column:1/-1;padding:11px 13px;border-radius:12px;font-size:11px;font-weight:800;line-height:1.8}.training-classic-root .training-status[data-tone="info"]{background:#f1f7f4;color:#315846}.training-classic-root .training-status[data-tone="success"]{background:#eaf8ef;color:#176b3a}.training-classic-root .training-status[data-tone="error"]{background:#fff0f1;color:#a52335}.training-classic-root .training-recipient-search{grid-column:1/-1}.training-classic-root .training-recipient-list{grid-column:1/-1;max-height:245px;overflow:auto;border:1px solid #dfe9e4;border-radius:13px;padding:6px;background:#fbfdfc}.training-classic-root .training-recipient{display:flex;flex-direction:row;align-items:center;gap:9px;padding:9px;border-bottom:1px solid #edf2ef;font-size:11px;font-weight:700}.training-classic-root .training-recipient:last-child{border-bottom:0}.training-classic-root .training-recipient input{width:auto}.training-classic-root .training-recipient small{color:#74837b;font-weight:500}.training-classic-root .training-table-note{display:block;margin-top:4px;color:#7b8982;font-size:9px;max-width:280px;overflow:hidden;text-overflow:ellipsis}.training-classic-root .training-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.training-classic-root .training-summary>div{padding:13px;border:1px solid #dfe9e4;border-radius:15px;background:#fff}.training-classic-root .training-summary small{display:block;color:#74837b;font-size:9px}.training-classic-root .training-summary strong{display:block;margin-top:6px;color:#087847;font-size:18px}.training-classic-root .training-actions{display:flex;gap:6px;align-items:center}.training-classic-root .training-actions button{border:0;border-radius:9px;padding:7px 9px;background:#edf8f2;color:#087847;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.training-classic-root .training-actions button.archive{background:#fff3df;color:#956000}.training-classic-root .training-actions button:disabled{opacity:.55;cursor:wait}@media(max-width:950px){.training-classic-root .training-summary{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.training-classic-root .training-summary{grid-template-columns:1fr}}
`;document.head.appendChild(style)
}
function caregiverOption(row){const search=`${row.fullName||''} ${row.membershipCode||''} ${row.mobile||''}`.toLowerCase();return `<label class="training-recipient" data-training-recipient-search="${esc(search)}"><input type="checkbox" name="caregiverIds" value="${esc(row.id)}"><span><strong>${esc(row.fullName||'بدون نام')}</strong><br><small>${esc(row.membershipCode||row.id)} • ${esc(row.mobile||'شماره ثبت نشده')}</small></span></label>`}
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
  const totalViews=courses.reduce((sum,item)=>sum+Number(item.totalOpenCount||0),0),totalSeconds=courses.reduce((sum,item)=>sum+Number(item.totalViewSeconds||0),0);
  setPage('بانک آموزش','مدیریت فایل‌ها، تخصیص آموزش و پایش مشاهده',`
   <section class="training-summary"><div><small>محتوای ثبت‌شده</small><strong>${fa(courses.length)}</strong></div><div><small>تخصیص به مراقبین</small><strong>${fa(assignments.length)}</strong></div><div><small>دفعات بازشدن</small><strong>${fa(totalViews)}</strong></div><div><small>زمان مشاهده فعال</small><strong>${esc(fmtSeconds(totalSeconds))}</strong></div></section>
   <section class="adm-grid two"><article class="surface"><div class="surface-head"><div><h3>افزودن محتوای آموزشی</h3><p>فایل را مستقیم روی سرور پارس‌پک بارگذاری کنید یا یک لینک آموزشی ثبت نمایید.</p></div></div><form class="ev-form" id="trainingClassicCourseForm" novalidate><label>عنوان آموزش<input name="title" required></label><label>دسته‌بندی<input name="category" placeholder="پیش از اعزام"></label><label>مدت اسمی به دقیقه<input name="durationMinutes" type="number" min="0" value="0"></label><label>اعتبار آموزشی<input name="credit" type="number" min="0" value="0"></label><label class="wide">توضیحات<textarea name="description" rows="3"></textarea></label><label class="training-upload-box"><span>فایل آموزشی</span><input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.md,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a"><small>حداکثر حجم ۱۰۰ مگابایت؛ فایل به‌صورت خصوصی در فضای فایل سازمان ذخیره می‌شود.</small><small class="training-file-meta" id="trainingClassicFileMeta">فایلی انتخاب نشده است.</small></label><label class="wide">یا نشانی محتوا<input name="contentUrl" placeholder="https://..."></label><label class="wide"><span><input name="mandatory" type="checkbox"> این آموزش الزامی است</span></label><div class="training-status" id="trainingClassicStatus" data-tone="info">یک فایل انتخاب کنید یا نشانی محتوای آموزشی را وارد نمایید.</div><button type="submit" class="btn primary wide">ثبت در بانک آموزش</button></form></article>
   <article class="surface"><div class="surface-head"><div><h3>تخصیص محتوا</h3><p>آموزش انتخابی مستقیماً برای پرونده مراقبین ثبت می‌شود.</p></div></div><form class="ev-form" id="trainingClassicAssignForm"><label class="wide">محتوا<select name="courseId" required><option value="">انتخاب کنید</option>${courses.filter(item=>String(item.status).toUpperCase()==='ACTIVE').map(item=>`<option value="${esc(item.id)}">${esc(item.title)} • ${esc(contentType(item))}</option>`).join('')}</select></label><label>مهلت مشاهده<input name="dueAt" type="date"></label><label>جست‌وجوی مراقب<input id="trainingClassicRecipientSearch" placeholder="نام، کد پرونده یا موبایل"></label><label class="wide">پیام همراه<textarea name="assignmentNote" rows="2"></textarea></label><div class="training-recipient-list">${caregivers.length?caregivers.map(caregiverOption).join(''):'<div class="adm-empty">پرونده مراقبی وجود ندارد.</div>'}</div><button type="submit" class="btn primary wide">تخصیص آموزش</button></form></article></section>
   <section class="adm-grid two"><article class="surface table-wrap"><div class="surface-head"><div><h3>محتواهای بانک</h3><p>${fa(courses.length)} مورد ثبت‌شده</p></div></div><table class="data-table"><thead><tr><th>عنوان</th><th>نوع</th><th>دسته</th><th>تخصیص</th><th>بازدید</th><th>زمان مشاهده</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${courses.map(item=>`<tr><td><strong>${esc(item.title)}</strong><small class="training-table-note">${esc(item.code||'')} • ${esc(item.contentUrl||'بدون فایل')}</small></td><td>${esc(contentType(item))}</td><td>${esc(item.category||'—')}</td><td>${fa(item.assignedCount||0)}</td><td>${fa(item.totalOpenCount||0)}</td><td>${esc(fmtSeconds(item.totalViewSeconds||0))}</td><td>${badge(statusLabel(item.status),statusTone(item.status))}</td><td><div class="training-actions">${item.contentUrl?`<button type="button" data-training-preview="${esc(item.contentUrl)}">مشاهده</button>`:''}<button type="button" class="${String(item.status).toUpperCase()==='ACTIVE'?'archive':''}" data-training-toggle="${esc(item.id)}|${String(item.status).toUpperCase()==='ACTIVE'?'ARCHIVED':'ACTIVE'}">${String(item.status).toUpperCase()==='ACTIVE'?'آرشیو':'فعال‌سازی'}</button></div></td></tr>`).join('')}</tbody></table>${courses.length?'':empty('بانک آموزش خالی است','اولین فایل یا لینک آموزشی را از فرم بالا اضافه کنید.')}</article>
   <article class="surface table-wrap"><div class="surface-head"><div><h3>تخصیص‌های مراقبین</h3><p>${fa(assignments.length)} تخصیص ثبت‌شده</p></div></div><table class="data-table"><thead><tr><th>مراقب</th><th>محتوا</th><th>ارسال‌کننده</th><th>مهلت</th><th>بازدید</th><th>زمان مشاهده</th><th>وضعیت</th></tr></thead><tbody>${assignments.map(item=>`<tr><td><strong>${esc(item.caregiverName||'—')}</strong><small class="training-table-note">${esc(item.membershipCode||item.caregiverId||'')}</small></td><td>${esc(item.title||'—')}</td><td>${esc(item.assignedByName||'—')}<small class="training-table-note">${esc(item.assignedByRoleLabel||'')}</small></td><td>${esc(item.dueAt?fmtDate(item.dueAt):'—')}</td><td>${fa(item.openCount||0)}</td><td>${esc(fmtSeconds(item.totalViewSeconds||0))}</td><td>${badge(statusLabel(item.status),statusTone(item.status))}</td></tr>`).join('')}</tbody></table>${assignments.length?'':empty('تخصیصی وجود ندارد','از فرم بالا آموزش را به یک یا چند مراقب اختصاص دهید.')}</article></section>`);
  bindPage(courses);
 }catch(error){setPage('بانک آموزش','خطا در دریافت اطلاعات',`<div class="training-status" data-tone="error">${esc(errorText(error))}</div>`)}finally{rendering=false}
}
function bindPage(courses){
 const courseForm=$('#trainingClassicCourseForm'),fileInput=courseForm?.elements.file;
 fileInput?.addEventListener('change',()=>{const file=fileInput.files?.[0],meta=$('#trainingClassicFileMeta');if(!meta)return;if(!file){meta.textContent='فایلی انتخاب نشده است.';return}const valid=file.size<=MAX_UPLOAD&&ALLOWED_EXT.test(file.name||'');meta.textContent=`${file.name} • ${bytes(file.size)} • ${valid?'آماده ارسال':'نامعتبر'}`;meta.style.color=valid?'#087847':'#a52335'});
 courseForm?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,fd=new FormData(form),title=String(fd.get('title')||'').trim(),file=fileInput?.files?.[0],externalUrl=String(fd.get('contentUrl')||'').trim();if(!title){setCourseStatus('عنوان آموزش را وارد کنید.','error');return}if(!file&&!externalUrl){setCourseStatus('یک فایل آموزشی انتخاب کنید یا نشانی محتوا را وارد نمایید.','error');return}setBusy(form,true,file?'در حال بارگذاری فایل...':'در حال ثبت آموزش...');let uploaded=null;try{let contentUrl=externalUrl;if(file){setCourseStatus(`در حال ارسال ${file.name} به سرور پارس‌پک...`,'info');uploaded=await uploadTrainingFile(file);contentUrl=uploaded.contentUrl;setCourseStatus('فایل ذخیره شد؛ در حال ثبت مشخصات آموزش...','info')}await api('/api/training/courses',{method:'POST',body:JSON.stringify({title,category:String(fd.get('category')||'').trim(),description:String(fd.get('description')||'').trim(),durationMinutes:Number(fd.get('durationMinutes')||0),credit:Number(fd.get('credit')||0),mandatory:fd.get('mandatory')==='on',contentUrl})});setCourseStatus(file?'فایل و مشخصات آموزش با موفقیت ثبت شدند.':'لینک آموزشی با موفقیت ثبت شد.','success');notify('آموزش ثبت شد',file?'فایل روی سرور پارس‌پک ذخیره و به بانک آموزش اضافه شد.':'لینک به بانک آموزش اضافه شد.');setTimeout(renderTrainingAdminClassic,350)}catch(error){if(uploaded?.fileId)await cleanupUploadedFile(uploaded.fileId);setCourseStatus(errorText(error),'error');notify('ثبت آموزش انجام نشد',errorText(error));setBusy(form,false)} });
 const assignForm=$('#trainingClassicAssignForm');
 $('#trainingClassicRecipientSearch')?.addEventListener('input',event=>{const query=String(event.target.value||'').trim().toLowerCase();$$('[data-training-recipient-search]').forEach(row=>row.hidden=Boolean(query&&!String(row.dataset.trainingRecipientSearch||'').includes(query)))});
 assignForm?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,fd=new FormData(form),caregiverIds=fd.getAll('caregiverIds').map(String),courseId=String(fd.get('courseId')||'');if(!courseId)return notify('محتوا انتخاب نشده','یک آموزش را انتخاب کنید.');if(!caregiverIds.length)return notify('مراقب انتخاب نشده','حداقل یک مراقب را انتخاب کنید.');setBusy(form,true,'در حال تخصیص...');try{await api('/api/training/assignments',{method:'POST',body:JSON.stringify({courseId,caregiverIds,dueAt:String(fd.get('dueAt')||''),assignmentNote:String(fd.get('assignmentNote')||'')})});notify('آموزش تخصیص داده شد',`آموزش برای ${fa(caregiverIds.length)} مراقب ثبت شد.`);setTimeout(renderTrainingAdminClassic,250)}catch(error){notify('تخصیص انجام نشد',errorText(error));setBusy(form,false)}});
 $$('[data-training-preview]').forEach(button=>button.addEventListener('click',()=>window.open(button.dataset.trainingPreview,'_blank','noopener')));
 $$('[data-training-toggle]').forEach(button=>button.addEventListener('click',async()=>{const [id,status]=String(button.dataset.trainingToggle||'').split('|');if(!id)return;button.disabled=true;try{await api(`/api/training/courses/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});notify('وضعیت آموزش تغییر کرد',status==='ACTIVE'?'آموزش فعال شد.':'آموزش به آرشیو منتقل شد.');renderTrainingAdminClassic()}catch(error){button.disabled=false;notify('تغییر وضعیت انجام نشد',errorText(error))}}));
 void courses;
}
function moduleLabel(module){return String(Array.isArray(module)?module[1]:module||'').trim()}
function install(){
 const current=window.renderModule;
 if(typeof current!=='function')return false;
 if(current.__trainingAdminClassic)return true;
 currentRenderModule=current;
 const wrapped=function(...args){const label=moduleLabel(args[1]);if(isTrainingStaff()&&label.includes('آموزش')){void renderTrainingAdminClassic();return}return current.apply(this,args)};
 wrapped.__trainingAdminClassic=true;wrapped.__trainingAdminClassicBase=current;window.renderModule=wrapped;try{renderModule=wrapped}catch{}return true;
}
function boot(){addStyles();let attempts=0;const timer=setInterval(()=>{install();if(++attempts>160)clearInterval(timer)},100);setTimeout(()=>setInterval(install,1500),17000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
