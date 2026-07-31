(()=>{
'use strict';

const KEYS={
 auth:'salamatAvalAccessControlV1',
 evaluation:'salamatAvalEvaluationSystemV13',
 admin:'salamatAvalAdminWorkspaceV15',
 caregiverPanel:'salamatAvalCaregiverPanelV1',
 evaluationV1:'salamatAvalEvaluationV1',
 session:'salamatAvalSessionV1',
};
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
 const state=parse(KEYS.admin,{version:'1.5.0',trainingLibrary:[],assignments:[],audit:[],ui:{}});
 state.trainingLibrary=Array.isArray(state.trainingLibrary)?state.trainingLibrary:[];
 state.assignments=Array.isArray(state.assignments)?state.assignments:[];
 state.audit=Array.isArray(state.audit)?state.audit:[];
 state.ui=state.ui&&typeof state.ui==='object'?state.ui:{};
 return state;
}
function appendAudit(state,action,detail){
 const actor=parse(KEYS.session,{}).name||'مدیر سامانه';
 state.audit.unshift({id:`AUD-${Date.now().toString(36).toUpperCase()}`,at:nowFa(),actor,action,detail});
 state.audit=state.audit.slice(0,300);
}
async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',...options,headers});
 const text=await response.text();
 let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){
  const error=new Error(payload.message||`خطای ${response.status}`);
  error.status=response.status;error.code=payload.error;error.detail=payload.detail;error.providerStatus=payload.providerStatus;error.payload=payload;
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
function statusBox(form){
 let box=form.querySelector('.training-upload-status');
 if(!box){
  box=document.createElement('div');
  box.className='training-upload-status';
  box.style.cssText='grid-column:1/-1;padding:10px 12px;border-radius:10px;background:#f3f7f5;color:#315846;font-size:12px;font-weight:700;line-height:1.8;display:none';
  const button=form.querySelector('[type="submit"],button:not([type])');
  if(button)form.insertBefore(box,button);else form.appendChild(box);
 }
 return box;
}
function setStatus(form,text,tone='info'){
 const box=statusBox(form);box.style.display='block';box.textContent=text;
 box.style.background=tone==='error'?'#fff1f1':tone==='success'?'#edf9f1':'#f3f7f5';
 box.style.color=tone==='error'?'#a52323':tone==='success'?'#176b3a':'#315846';
}
function ensureForm(){
 const form=$('#admTrainingForm');
 if(!form)return null;
 form.noValidate=true;
 const urlInput=form.elements.url;
 if(urlInput){urlInput.required=false;urlInput.placeholder='اختیاری؛ در صورت نداشتن فایل، لینک را وارد کنید'}
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
   const file=input.files?.[0],meta=form.querySelector('.training-cloud-meta');
   if(!meta)return;
   if(!file){meta.textContent='فایلی انتخاب نشده است.';meta.style.color='';return}
   const valid=file.size<=MAX_UPLOAD&&allowed(file);
   meta.textContent=`${file.name} • ${bytes(file.size)} • ${valid?'آماده ارسال':'نامعتبر'}`;
   meta.style.color=valid?'':'#a52323';
  });
 }
 statusBox(form);
 return form;
}
function rerender(){
 const button=$$('.nav-item,#sidebarNav button').find(item=>String(item.textContent||'').includes('بانک آموزش'));
 if(button)button.click();
}
async function uploadFile(file){
 return api('/api/files/raw',{
  method:'POST',
  headers:{
   'content-type':file.type||'application/octet-stream',
   'x-file-name':encodeURIComponent(file.name),
   'x-file-size':String(file.size),
   'x-file-category':'training',
  },
  body:file,
 });
}
function collectState(adminState){
 return {
  auth:parse(KEYS.auth,{users:[],audit:[]}),
  evaluation:parse(KEYS.evaluation,{}),
  admin:adminState,
  caregiverPanel:parse(KEYS.caregiverPanel,{}),
  evaluationV1:parse(KEYS.evaluationV1,{}),
 };
}
async function persistState(adminState){
 await api('/api/state',{method:'PUT',body:JSON.stringify({state:collectState(adminState)})});
}
function errorText(error){
 const parts=[error?.message||'خطای ناشناخته'];
 if(error?.code)parts.push(`کد: ${error.code}`);
 if(error?.providerStatus)parts.push(`پاسخ فضای ابری: ${error.providerStatus}`);
 if(error?.detail)parts.push(String(error.detail).slice(0,500));
 return parts.join(' — ');
}
async function submit(event){
 if(event.target?.id!=='admTrainingForm')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const form=ensureForm()||event.target,data=new FormData(form),file=form.elements.trainingFile?.files?.[0];
 const title=String(data.get('title')||'').trim(),url=String(data.get('url')||'').trim();
 if(!title){setStatus(form,'برای محتوای آموزشی عنوان وارد کنید.','error');return}
 if(!file&&!url){setStatus(form,'یک فایل آموزشی انتخاب کنید یا آدرس لینک را وارد کنید.','error');return}
 if(file&&file.size>MAX_UPLOAD){setStatus(form,'حداکثر حجم هر فایل ۱۰۰ مگابایت است.','error');return}
 if(file&&!allowed(file)){setStatus(form,'فرمت انتخاب‌شده برای بانک آموزش پشتیبانی نمی‌شود.','error');return}
 setBusy(form,true);setStatus(form,file?'در حال ارسال فایل به فضای ابری پارس‌پک...':'در حال ثبت لینک آموزشی...');
 try{
  const cloud=file?(await uploadFile(file)).data:null;
  setStatus(form,cloud?'فایل ارسال شد؛ در حال ثبت مشخصات در دیتابیس...':'در حال ثبت اطلاعات در دیتابیس...');
  const state=workspace(),id=`TRN-${Date.now().toString(36).toUpperCase()}`;
  const item={
   id,title,type:String(data.get('type')||''),url:cloud?`/api/files/${encodeURIComponent(cloud.id)}/download`:url,
   duration:String(data.get('duration')||'')||(file?bytes(file.size):''),category:String(data.get('category')||''),
   status:String(data.get('status')||'فعال'),description:String(data.get('description')||''),fileName:file?.name||'',
   fileSize:file?.size||0,mimeType:file?.type||'',storage:cloud?'parspack-s3':'external-link',fileId:cloud?.id||'',
   checksumSha256:cloud?.checksumSha256||'',createdAt:cloud?.createdAt||new Date().toISOString()
  };
  state.trainingLibrary.push(item);
  appendAudit(state,'بارگذاری محتوای آموزشی',`${title} • ${item.fileName||item.url} • ${item.duration||'بدون حجم'} • ${item.storage}`);
  localStorage.setItem(KEYS.admin,JSON.stringify(state));
  await persistState(state);
  form.reset();setStatus(form,cloud?`${file.name} با موفقیت در پارس‌پک و دیتابیس ثبت شد.`:'لینک آموزشی با موفقیت در دیتابیس ثبت شد.','success');
  notify('محتوا ثبت شد',cloud?'فایل و مشخصات آن روی سرور ذخیره شدند.':'لینک آموزشی روی سرور ذخیره شد.');
  setTimeout(rerender,250);
 }catch(error){
  console.error('Training upload runtime failed',error);
  const message=errorText(error);setStatus(form,message,'error');notify('بارگذاری انجام نشد',message);
 }finally{setBusy(form,false)}
}

window.addEventListener('submit',submit,true);
const observer=new MutationObserver(()=>ensureForm());
function boot(){const form=ensureForm();const content=$('#content');if(content)observer.observe(content,{childList:true,subtree:true});if(form)setStatus(form,'فایل انتخاب‌شده مستقیماً در فضای ابری خصوصی ذخیره می‌شود.')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
