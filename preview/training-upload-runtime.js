(()=>{
'use strict';

const ADMIN_KEY='salamatAvalAdminWorkspaceV15';
const SESSION_KEY='salamatAvalSessionV1';
const MAX_UPLOAD=100*1024*1024;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const nowFa=()=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date());
const bytes=value=>{const size=Number(value||0);if(size<1024)return `${size} بایت`;if(size<1024**2)return `${(size/1024).toFixed(1)} کیلوبایت`;return `${(size/1024**2).toFixed(1)} مگابایت`};
const acceptedTypes=new Set([
 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/rtf',
 'text/plain','text/markdown','text/vtt','image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4'
]);

function notify(title,text){
 try{window.toast?.(title,text)}catch{}
 if(!window.toast)alert(`${title}\n${text}`);
}
function allowed(file){
 if(!file)return true;
 const name=String(file.name||'').toLowerCase();
 return acceptedTypes.has(String(file.type||'').toLowerCase())||/\.(pdf|doc|docx|xls|xlsx|txt|rtf|md|srt|vtt|jpg|jpeg|png|webp|mp4|webm|mp3|m4a)$/i.test(name);
}
function workspace(){
 const state=parse(ADMIN_KEY,{version:'1.5.0',trainingLibrary:[],assignments:[],audit:[],ui:{}});
 state.trainingLibrary=Array.isArray(state.trainingLibrary)?state.trainingLibrary:[];
 state.assignments=Array.isArray(state.assignments)?state.assignments:[];
 state.audit=Array.isArray(state.audit)?state.audit:[];
 state.ui=state.ui&&typeof state.ui==='object'?state.ui:{};
 return state;
}
function saveWorkspace(state){localStorage.setItem(ADMIN_KEY,JSON.stringify(state))}
function appendAudit(state,action,detail){
 const actor=parse(SESSION_KEY,{}).name||'مدیر سامانه';
 state.audit.unshift({id:`AUD-${Date.now().toString(36).toUpperCase()}`,at:nowFa(),actor,action,detail});
 state.audit=state.audit.slice(0,300);
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
function setBusy(form,busy){
 const button=form?.querySelector('[type="submit"],button:not([type])');
 if(!button)return;
 if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ثبت در بانک آموزش';
 button.disabled=busy;
 button.textContent=busy?'در حال ارسال فایل...':button.dataset.originalText;
}
function ensureForm(){
 const form=$('#admTrainingForm');
 if(!form)return null;
 form.noValidate=true;
 const urlInput=form.elements.url;
 if(urlInput){urlInput.required=false;urlInput.placeholder='اختیاری؛ در صورت نداشتن فایل، لینک را وارد کنید';}
 let input=form.elements.trainingFile;
 if(!input){
  const label=document.createElement('label');
  label.className='wide training-cloud-upload';
  label.innerHTML='<span>فایل آموزشی</span><input name="trainingFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.md,.srt,.vtt,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a,video/mp4,video/webm,audio/mpeg,audio/mp4,image/jpeg,image/png,image/webp"><small class="training-cloud-help">فایل به‌صورت خصوصی در پارس‌پک ذخیره می‌شود؛ حداکثر حجم ۱۰۰ مگابایت.</small><small class="training-cloud-meta">فایلی انتخاب نشده است.</small>';
  const description=form.querySelector('textarea[name="description"]')?.closest('label');
  if(description)form.insertBefore(label,description);else form.insertBefore(label,form.querySelector('button'));
  input=form.elements.trainingFile;
 }
 if(input&&!input.dataset.runtimeBound){
  input.dataset.runtimeBound='true';
  input.addEventListener('change',()=>{
   const file=input.files?.[0];
   const meta=form.querySelector('.training-cloud-meta');
   if(!meta)return;
   if(!file){meta.textContent='فایلی انتخاب نشده است.';meta.style.color='';return}
   meta.textContent=`${file.name} • ${bytes(file.size)} • ${file.size<=MAX_UPLOAD&&allowed(file)?'آماده ارسال':'نامعتبر'}`;
   meta.style.color=file.size<=MAX_UPLOAD&&allowed(file)?'':'#a52323';
  });
 }
 return form;
}
function rerender(){
 const button=$$('.nav-item').find(item=>String(item.textContent||'').includes('بانک آموزش'));
 if(button)button.click();
}
async function uploadFile(file){
 const body=new FormData();
 body.append('file',file,file.name);
 body.append('category','training');
 return api('/api/files',{method:'POST',body});
}
async function submit(event){
 if(event.target?.id!=='admTrainingForm')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const form=ensureForm()||event.target;
 const data=new FormData(form);
 const file=form.elements.trainingFile?.files?.[0];
 const title=String(data.get('title')||'').trim();
 const url=String(data.get('url')||'').trim();
 if(!title){notify('عنوان لازم است','برای محتوای آموزشی عنوان وارد کنید.');return}
 if(!file&&!url){notify('فایل یا لینک لازم است','یک فایل آموزشی انتخاب کنید یا آدرس لینک را وارد کنید.');return}
 if(file&&file.size>MAX_UPLOAD){notify('حجم فایل بیش از حد مجاز است','حداکثر حجم هر فایل ۱۰۰ مگابایت است.');return}
 if(file&&!allowed(file)){notify('فرمت فایل مجاز نیست','فرمت انتخاب‌شده برای بانک آموزش پشتیبانی نمی‌شود.');return}
 setBusy(form,true);
 try{
  const cloud=file?(await uploadFile(file)).data:null;
  const state=workspace();
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
  state.trainingLibrary.push(item);
  appendAudit(state,'بارگذاری محتوای آموزشی',`${title} • ${item.fileName||item.url} • ${item.duration||'بدون حجم'} • ${item.storage}`);
  saveWorkspace(state);
  form.reset();
  notify('محتوا ثبت شد',cloud?`${file.name} در فضای ابری خصوصی پارس‌پک ذخیره شد.`:'لینک آموزشی در بانک آموزش ثبت شد.');
  rerender();
 }catch(error){
  console.error('Training upload runtime failed',error);
  notify('بارگذاری انجام نشد',`${error?.message||'خطای ناشناخته'}${error?.detail?` — ${error.detail}`:''}`);
 }finally{setBusy(form,false)}
}

window.addEventListener('submit',submit,true);
window.addEventListener('click',event=>{
 const form=event.target?.closest?.('#admTrainingForm');
 if(form)ensureForm();
},true);
const observer=new MutationObserver(()=>ensureForm());
function boot(){
 ensureForm();
 const content=$('#content');
 if(content)observer.observe(content,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
