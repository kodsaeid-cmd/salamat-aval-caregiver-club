(()=>{
'use strict';

if(window.__salamatTrainingAdminReliabilityV2)return;
window.__salamatTrainingAdminReliabilityV2=true;

const MAX_UPLOAD=100*1024*1024;
const ALLOWED_EXT=/\.(pdf|doc|docx|xls|xlsx|txt|rtf|md|jpg|jpeg|png|webp|mp4|webm|mp3|m4a)$/i;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let caregiversCache=null;
let caregiversFetchedAt=0;
let patchTimer=null;

function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
function friendlyError(error){return [error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:''].filter(Boolean).join(' — ')}
function setStatus(text,tone='info'){
 const box=$('#trainingClassicStatus');
 if(!box)return;
 box.hidden=false;box.textContent=text;box.dataset.tone=tone;
}
function setBusy(form,busy,text='در حال ثبت...'){
 const button=form?.querySelector('button[type="submit"]');
 if(!button)return;
 if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ثبت';
 button.disabled=busy;button.textContent=busy?text:button.dataset.originalText;
}
async function parseResponse(response){
 const text=await response.text();
 let payload={};
 try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){
  const error=new Error(payload.message||`خطای ${response.status}`);
  error.code=payload.error||payload.code;
  error.stage=payload.stage;
  error.detail=payload.detail;
  throw error;
 }
 return payload;
}
async function requestJson(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 return parseResponse(await fetch(path,{credentials:'same-origin',...options,headers}));
}
async function uploadFile(file){
 const headers=new Headers({
  'content-type':file.type||'application/octet-stream',
  'x-file-name':encodeURIComponent(file.name),
  'x-file-category':'training',
  'x-file-size':String(file.size),
 });
 const payload=await parseResponse(await fetch('/api/files/raw',{
  method:'POST',
  credentials:'same-origin',
  headers,
  body:file,
 }));
 const fileId=String(payload?.data?.id||'');
 if(!fileId){
  const error=new Error('ثبت فایل آموزشی کامل نشد.');
  error.code='uploaded_file_id_missing';
  throw error;
 }
 return {
  fileId,
  contentUrl:`/api/files/${encodeURIComponent(fileId)}/download?inline=1`,
 };
}
async function cleanupFile(fileId){
 if(!fileId)return;
 try{await requestJson(`/api/files/${encodeURIComponent(fileId)}`,{method:'DELETE'})}catch{}
}
function refreshTraining(){
 setTimeout(()=>{
  const nav=$$('#sidebarNav .nav-item,#sidebarNav button').find(item=>String(item.textContent||'').includes('بانک آموزش'));
  if(nav){nav.click();return}
  try{window.renderModule?.(window.roles?.admin,['book-open','بانک آموزش'])}catch{}
 },300);
}
async function submitCourse(event){
 const form=event.target;
 if(!(form instanceof HTMLFormElement)||form.id!=='trainingClassicCourseForm')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 if(form.dataset.uploading==='1')return;

 const fd=new FormData(form);
 const title=String(fd.get('title')||'').trim();
 const file=form.elements.file?.files?.[0]||null;
 const externalUrl=String(fd.get('contentUrl')||'').trim();
 if(!title){setStatus('عنوان آموزش را وارد کنید.','error');return}
 if(!file&&!externalUrl){setStatus('یک فایل آموزشی انتخاب کنید یا نشانی محتوا را وارد نمایید.','error');return}
 if(file&&file.size>MAX_UPLOAD){setStatus('حجم فایل باید کمتر از ۱۰۰ مگابایت باشد.','error');return}
 if(file&&!ALLOWED_EXT.test(file.name||'')){setStatus('فرمت این فایل برای بانک آموزش پشتیبانی نمی‌شود.','error');return}

 form.dataset.uploading='1';
 setBusy(form,true,file?'در حال بارگذاری فایل...':'در حال ثبت آموزش...');
 let uploaded=null;
 try{
  let contentUrl=externalUrl;
  if(file){
   setStatus(`در حال بارگذاری «${file.name}»...`,'info');
   uploaded=await uploadFile(file);
   contentUrl=uploaded.contentUrl;
   setStatus('فایل دریافت شد؛ در حال ثبت مشخصات آموزش...','info');
  }
  await requestJson('/api/training/courses',{
   method:'POST',
   body:JSON.stringify({
    title,
    category:String(fd.get('category')||'').trim(),
    description:String(fd.get('description')||'').trim(),
    durationMinutes:Number(fd.get('durationMinutes')||0),
    credit:Number(fd.get('credit')||0),
    mandatory:fd.get('mandatory')==='on',
    contentUrl,
   }),
  });
  setStatus(file?'فایل و مشخصات آموزش با موفقیت ثبت شدند.':'لینک آموزشی با موفقیت ثبت شد.','success');
  notify('آموزش ثبت شد','محتوای جدید به بانک آموزش اضافه شد.');
  form.reset();
  const meta=$('#trainingClassicFileMeta');if(meta)meta.textContent='فایلی انتخاب نشده است.';
  refreshTraining();
 }catch(error){
  if(uploaded?.fileId)await cleanupFile(uploaded.fileId);
  setStatus(friendlyError(error),'error');
  notify('ثبت آموزش انجام نشد',friendlyError(error));
  setBusy(form,false);
  delete form.dataset.uploading;
 }
}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
async function loadCaregivers(force=false){
 if(!force&&caregiversCache&&Date.now()-caregiversFetchedAt<30000)return caregiversCache;
 const payload=await requestJson('/api/training/caregivers');
 caregiversCache=Array.isArray(payload.data)?payload.data:[];
 caregiversFetchedAt=Date.now();
 return caregiversCache;
}
async function hydrateAvatars(){
 const cards=$$('.recipient-card input[name="caregiverIds"]');
 if(!cards.length)return;
 try{
  const caregivers=await loadCaregivers();
  const byId=new Map(caregivers.map(item=>[String(item.id),item]));
  cards.forEach(input=>{
   const item=byId.get(String(input.value));
   const avatar=input.closest('.recipient-card')?.querySelector('.recipient-avatar');
   if(!avatar||avatar.dataset.avatarHydrated==='1')return;
   avatar.dataset.avatarHydrated='1';
   const fallback=initials(item?.fullName||'مراقب');
   if(!item?.avatarUrl){avatar.textContent=fallback;return}
   avatar.textContent='';
   const image=document.createElement('img');
   image.src=`${item.avatarUrl}?v=${encodeURIComponent(item.avatarId||Date.now())}`;
   image.alt=`تصویر ${item.fullName||'مراقب'}`;
   image.loading='lazy';
   image.addEventListener('error',()=>{avatar.textContent=fallback});
   avatar.appendChild(image);
  });
 }catch(error){console.error('Training caregiver avatars failed',error)}
}
function sanitizeStorageWording(root=document){
 const replacements=[
  ['سرور پارس‌پک','فضای فایل سازمان'],
  ['روی سرور پارس‌پک','در فضای فایل سازمان'],
  ['به سرور پارس‌پک','در فضای فایل سازمان'],
  ['پارس‌پک','فضای فایل سازمان'],
  ['پاسخ فضای فایل:','وضعیت بارگذاری:'],
 ];
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  const value=node.nodeValue||'';
  let next=value;
  replacements.forEach(([from,to])=>{next=next.split(from).join(to)});
  if(next!==value)node.nodeValue=next;
 }
}
function patch(){
 sanitizeStorageWording($('#content')||document);
 void hydrateAvatars();
}
function schedulePatch(){clearTimeout(patchTimer);patchTimer=setTimeout(patch,80)}
function addStyles(){
 if($('#trainingAdminReliabilityStylesV2'))return;
 const style=document.createElement('style');style.id='trainingAdminReliabilityStylesV2';style.textContent=`
 .training-classic-root .recipient-avatar{overflow:hidden}.training-classic-root .recipient-avatar img{display:block;width:100%;height:100%;object-fit:cover}
 `;document.head.appendChild(style);
}
function boot(){
 addStyles();
 document.addEventListener('submit',submitCourse,true);
 const content=$('#content');if(content)new MutationObserver(schedulePatch).observe(content,{childList:true,subtree:true,characterData:true});
 patch();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
