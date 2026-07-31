(()=>{
'use strict';

const ADMIN_KEY='salamatAvalAdminWorkspaceV15';
const SESSION_KEY='salamatAvalSessionV1';
const LEGACY_DB_NAME='salamatAvalTrainingFilesV19';
const LEGACY_STORE_NAME='files';
const MAX_UPLOAD=25*1024*1024;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const store=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const nowFa=()=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date());
const bytes=value=>{const size=Number(value||0);if(size<1024)return `${size} بایت`;if(size<1024**2)return `${(size/1024).toFixed(1)} کیلوبایت`;return `${(size/1024**2).toFixed(1)} مگابایت`};
const acceptedTypes=new Set([
 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/rtf',
 'text/plain','text/markdown','text/vtt','image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4'
]);

function workspace(){
 const state=parse(ADMIN_KEY,{version:'1.5.0',trainingLibrary:[],assignments:[],audit:[],ui:{}});
 state.trainingLibrary||=[];state.assignments||=[];state.audit||=[];state.ui||={};
 return state;
}
function toastMessage(title,text){try{window.toast?.(title,text)}catch{alert(`${title}\n${text}`)}}
function rerender(){const button=$$('.nav-item').find(item=>item.textContent.includes('بانک آموزش'));if(button)button.click()}
function allowed(file){
 if(!file)return true;
 const name=file.name.toLowerCase();
 return acceptedTypes.has((file.type||'').toLowerCase())||/\.(pdf|doc|docx|xls|xlsx|txt|rtf|md|srt|vtt|jpg|jpeg|png|webp|mp4|webm|mp3|m4a)$/.test(name);
}
async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 const response=await fetch(path,{credentials:'same-origin',...options,headers});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
  const error=new Error(payload.message||`خطای ${response.status}`);
  error.status=response.status;error.code=payload.error;error.detail=payload.detail;
  throw error;
 }
 return payload;
}
function legacyDb(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}
  const request=indexedDB.open(LEGACY_DB_NAME,1);
  request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(LEGACY_STORE_NAME))database.createObjectStore(LEGACY_STORE_NAME,{keyPath:'id'})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Database open failed'));
 });
}
async function readLegacyFile(id){
 const database=await legacyDb();
 return new Promise((resolve,reject)=>{
  const tx=database.transaction(LEGACY_STORE_NAME,'readonly');
  const request=tx.objectStore(LEGACY_STORE_NAME).get(id);
  request.onsuccess=()=>{database.close();resolve(request.result||null)};
  request.onerror=()=>{const error=request.error;database.close();reject(error)};
 });
}
async function deleteLegacyFile(id){
 try{
  const database=await legacyDb();
  await new Promise((resolve,reject)=>{const tx=database.transaction(LEGACY_STORE_NAME,'readwrite');tx.objectStore(LEGACY_STORE_NAME).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  database.close();
 }catch{}
}
function setBusy(form,busy,label='در حال بارگذاری فایل...'){
 const button=form?.querySelector('[type="submit"]');
 if(!button)return;
 if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ثبت در بانک آموزش';
 button.disabled=busy;
 button.textContent=busy?label:button.dataset.originalText;
}
function adjustForm(){
 const form=$('#admTrainingForm');
 if(!form)return;
 const input=form.elements.trainingFile;
 if(!input)return;
 input.accept='.pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.md,.srt,.vtt,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a,video/mp4,video/webm,audio/mpeg,audio/mp4,image/jpeg,image/png,image/webp';
 const field=input.closest('.admin-upload-field');
 const help=field?.querySelector('small');
 if(help)help.textContent='فایل به‌صورت خصوصی در فضای ابری پارس‌پک ذخیره می‌شود؛ حداکثر حجم در این مرحله ۲۵ مگابایت است.';
 const meta=field?.querySelector('.admin-upload-meta');
 if(meta&&!input.files?.[0])meta.textContent='فایلی انتخاب نشده است.';
 if(!input.dataset.cloudBound){
  input.dataset.cloudBound='true';
  input.addEventListener('change',()=>{
   const file=input.files?.[0];
   if(!meta)return;
   if(!file){meta.textContent='فایلی انتخاب نشده است.';meta.classList.remove('bad');return}
   meta.textContent=`${file.name} • ${bytes(file.size)} • آماده ارسال به فضای ابری`;
   meta.classList.toggle('bad',file.size>MAX_UPLOAD||!allowed(file));
  });
 }
}
async function uploadTrainingFile(file){
 const body=new FormData();
 body.append('file',file,file.name);
 body.append('category','training');
 return api('/api/files',{method:'POST',body});
}
function appendAudit(work,action,detail){
 const actor=parse(SESSION_KEY,{}).name||'مدیر سامانه';
 work.audit.unshift({id:`AUD-${Date.now().toString(36).toUpperCase()}`,at:nowFa(),actor,action,detail});
 work.audit=work.audit.slice(0,300);
}
async function submit(event){
 if(event.target?.id!=='admTrainingForm')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const form=event.target,data=new FormData(form),file=form.elements.trainingFile?.files?.[0];
 const url=String(data.get('url')||'').trim(),title=String(data.get('title')||'').trim();
 if(!title){toastMessage('عنوان لازم است','برای محتوای آموزشی عنوان وارد کنید.');return}
 if(!file&&!url){toastMessage('فایل یا لینک لازم است','یک فایل آموزشی انتخاب کنید یا آدرس لینک را وارد کنید.');return}
 if(file&&file.size>MAX_UPLOAD){toastMessage('حجم فایل بیش از حد مجاز است','حداکثر حجم هر فایل در این مرحله ۲۵ مگابایت است.');return}
 if(file&&!allowed(file)){toastMessage('فرمت فایل مجاز نیست','فرمت انتخاب‌شده برای بانک آموزش پشتیبانی نمی‌شود.');return}
 setBusy(form,true);
 try{
  let cloud=null;
  if(file)cloud=(await uploadTrainingFile(file)).data;
  const work=workspace();
  const id=`TRN-${Date.now().toString(36).toUpperCase()}`;
  const item={
   id,title,type:String(data.get('type')||''),
   url:cloud?`/api/files/${encodeURIComponent(cloud.id)}/download`:url,
   duration:String(data.get('duration')||'')||(file?bytes(file.size):''),
   category:String(data.get('category')||''),status:String(data.get('status')||'فعال'),
   description:String(data.get('description')||''),fileName:file?.name||'',fileSize:file?.size||0,
   mimeType:file?.type||'',storage:cloud?'parspack-s3':'external-link',fileId:cloud?.id||'',
   checksumSha256:cloud?.checksumSha256||'',createdAt:cloud?.createdAt||new Date().toISOString()
  };
  work.trainingLibrary.push(item);
  appendAudit(work,'بارگذاری محتوای آموزشی',`${title} • ${item.fileName||item.url} • ${item.duration||'بدون حجم'} • ${item.storage}`);
  store(ADMIN_KEY,work);
  form.reset();
  toastMessage('محتوا ثبت شد',cloud?`${file.name} در فضای ابری خصوصی پارس‌پک ذخیره شد.`:'لینک آموزشی در بانک آموزش ثبت شد.');
  rerender();
 }catch(error){
  console.error('Training cloud upload failed',error);
  const detail=error?.detail?` — ${error.detail}`:'';
  toastMessage('بارگذاری انجام نشد',`${error?.message||'خطای ناشناخته'}${detail}`);
 }finally{setBusy(form,false)}
}
function findTrainingItem(id){return workspace().trainingLibrary.find(item=>item.id===id||item.fileId===id)}
async function openFile(item){
 if(item?.fileId){
  const link=document.createElement('a');
  link.href=`/api/files/${encodeURIComponent(item.fileId)}/download`;
  link.target='_blank';link.rel='noopener';
  document.body.appendChild(link);link.click();link.remove();
  return;
 }
 if(item?.storage==='indexeddb'||String(item?.url||'').startsWith('indexeddb:')){
  try{
   const record=await readLegacyFile(item.id);
   if(!record?.file){toastMessage('فایل پیدا نشد','نسخه قدیمی فایل فقط در مرورگری که فایل در آن ذخیره شده قابل دسترسی است.');return}
   const url=URL.createObjectURL(record.file);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){console.error(error);toastMessage('بازکردن فایل انجام نشد','دسترسی به فایل قدیمی مرورگر ممکن نیست.')}
  return;
 }
 if(item?.url)window.open(item.url,'_blank','noopener');
}
async function deleteCloudFile(item){
 if(!item?.fileId)return;
 await api(`/api/files/${encodeURIComponent(item.fileId)}`,{method:'DELETE'});
}
function enhanceRows(){
 if($('#pageTitle')?.textContent.trim()!=='بانک آموزش')return;
 adjustForm();
 const work=workspace();
 $$('#content table tbody tr').forEach(row=>{
  const note=$('.ev-cell-note',row),needle=note?.textContent||'';
  const item=work.trainingLibrary.find(entry=>entry.url===needle||entry.fileName===needle||entry.id===row.dataset.trainingId||needle.includes(entry.fileName||'__never__'));
  if(!item)return;
  if(note&&item.fileName){
   const location=item.fileId?'فضای ابری خصوصی پارس‌پک':item.storage==='indexeddb'?'نسخه قدیمی در مرورگر':'لینک خارجی';
   note.textContent=`${item.fileName} • ${bytes(item.fileSize)} • ${location}`;
  }
  const actions=row.lastElementChild;
  if(actions&&!actions.querySelector('[data-training-file]')&&(item.fileId||item.storage==='indexeddb'||item.url)){
   const button=document.createElement('button');button.type='button';button.dataset.trainingFile=item.id;
   button.textContent=item.fileId?'دانلود فایل':item.storage==='indexeddb'?'بازکردن فایل قدیمی':'بازکردن لینک';
   actions.prepend(button);
  }
 });
}
async function handleClick(event){
 const open=event.target.closest('[data-training-file]');
 if(open){event.preventDefault();event.stopImmediatePropagation();const item=findTrainingItem(open.dataset.trainingFile);if(item)await openFile(item);return}
 const remove=event.target.closest('[data-training-delete]');
 if(!remove)return;
 const item=findTrainingItem(remove.dataset.trainingDelete);
 if(!item?.fileId){if(item?.storage==='indexeddb')setTimeout(()=>deleteLegacyFile(item.id),0);return}
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 if(!confirm(`محتوای «${item.title}» و فایل آن از فضای ابری حذف شود؟`))return;
 remove.disabled=true;
 try{
  await deleteCloudFile(item);
  const work=workspace();
  work.trainingLibrary=work.trainingLibrary.filter(entry=>entry.id!==item.id);
  work.assignments=work.assignments.filter(assignment=>assignment.trainingId!==item.id);
  appendAudit(work,'حذف آموزش و فایل ابری',`${item.title} • ${item.fileName||item.fileId}`);
  store(ADMIN_KEY,work);
  toastMessage('حذف انجام شد','محتوا و فایل ابری آن حذف شدند.');
  rerender();
 }catch(error){console.error('Training cloud delete failed',error);toastMessage('حذف انجام نشد',error?.message||'خطای حذف فایل');remove.disabled=false}
}
function boot(){
 document.addEventListener('submit',submit,true);
 document.addEventListener('click',handleClick,true);
 const content=$('#content');
 if(content){let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhanceRows()})}).observe(content,{childList:true,subtree:true})}
 enhanceRows();
 window.SalamatTrainingFiles={openFile,deleteCloudFile,readLegacyFile};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
