(()=>{
'use strict';
if(window.__salamatCaregiverBulkImportV2)return;
window.__salamatCaregiverBulkImportV2=true;

const $=(s,r=document)=>r.querySelector(s);
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const BATCH_SIZE=25;
const CHECKPOINT_PREFIX='salamatCaregiverImportCheckpointV2:';

function role(){return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||'').toUpperCase()}
function errorText(error){return [error?.message||'عملیات انجام نشد.',error?.detail?String(error.detail):''].filter(Boolean).join(' — ')}
function api(path,options={}){
 if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
 const headers=new Headers(options.headers||{});if(typeof options.body==='string')headers.set('content-type','application/json');
 return fetch(path,{credentials:'same-origin',...options,headers}).then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}return payload})
}
function signature(file){return `${file.name}:${file.size}`}
function checkpointKey(file){return CHECKPOINT_PREFIX+signature(file)}
function readCheckpoint(file){try{return JSON.parse(localStorage.getItem(checkpointKey(file))||'null')}catch{return null}}
function writeCheckpoint(file,value){localStorage.setItem(checkpointKey(file),JSON.stringify(value))}
function clearCheckpoint(file){localStorage.removeItem(checkpointKey(file))}
function blankStats(){return {processed:0,createdProfiles:0,updatedProfiles:0,createdAccounts:0,updatedAccounts:0,skippedUnchanged:0,failed:0}}
function mergeStats(base,data){
 base.processed+=Number(data.received||0);base.createdProfiles+=Number(data.createdProfiles||0);base.updatedProfiles+=Number(data.updatedProfiles||0);base.createdAccounts+=Number(data.createdAccounts||0);base.updatedAccounts+=Number(data.updatedAccounts||0);base.skippedUnchanged+=Number(data.skippedUnchanged||0);base.failed+=Number(data.failed||0);return base
}
function isQuotaError(error){return /(quota|daily.*limit|limit.*exceed|exceed.*limit|too many queries)/i.test(errorText(error))}

function addStyles(){if($('#caregiverBulkImportStylesV2'))return;const style=document.createElement('style');style.id='caregiverBulkImportStylesV2';style.textContent=`
.caregiver-import-launch{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:10px 14px;background:#087847;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 8px 20px rgba(8,120,71,.18)}
.caregiver-import-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(12,35,25,.48);display:grid;place-items:center;padding:20px;direction:rtl}.caregiver-import-modal{width:min(790px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 26px 70px rgba(0,0,0,.22)}.caregiver-import-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;padding:22px;border-bottom:1px solid #e7efeb}.caregiver-import-head h3{margin:0;font-size:18px}.caregiver-import-head p{margin:7px 0 0;color:#66786e;font-size:10px;line-height:1.9}.caregiver-import-close{border:0;background:#f1f4f2;border-radius:9px;width:34px;height:34px;cursor:pointer}.caregiver-import-body{padding:22px}.caregiver-import-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.caregiver-import-field{display:grid;gap:7px;font-size:10px;font-weight:800;color:#2f4439}.caregiver-import-field.wide{grid-column:1/-1}.caregiver-import-field input{width:100%;box-sizing:border-box;border:1px solid #d7e4dd;border-radius:12px;padding:11px;font:inherit;background:#fff}.caregiver-import-note{grid-column:1/-1;padding:12px 14px;border-radius:13px;background:#f3f8f5;color:#4b6256;font-size:10px;line-height:1.9}.caregiver-import-note.warn{background:#fff7e7;color:#815e14}.caregiver-import-progress{margin-top:16px;padding:14px;border:1px solid #e0eae5;border-radius:14px;background:#fbfdfc}.caregiver-import-progress-track{height:9px;border-radius:999px;background:#e8efeb;overflow:hidden}.caregiver-import-progress-bar{height:100%;width:0;background:#078848;transition:.2s}.caregiver-import-progress-copy{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:10px;color:#52665b}.caregiver-import-result{margin-top:13px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.caregiver-import-result div{padding:10px;border-radius:12px;background:#f5f9f7}.caregiver-import-result small{display:block;color:#74837b;font-size:8px}.caregiver-import-result strong{display:block;margin-top:5px;color:#087847;font-size:14px}.caregiver-import-errors{margin-top:12px;padding:11px;border-radius:12px;background:#fff1f1;color:#9b2737;font-size:9px;line-height:1.8;white-space:pre-wrap}.caregiver-import-actions{display:flex;justify-content:flex-end;gap:9px;padding:17px 22px;border-top:1px solid #e7efeb}.caregiver-import-actions button{border:0;border-radius:11px;padding:11px 16px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.caregiver-import-start{background:#087847;color:#fff;min-width:190px}.caregiver-import-start:disabled{opacity:.55;cursor:wait}.caregiver-import-cancel{background:#eef2f0;color:#4e6257}@media(max-width:650px){.caregiver-import-grid{grid-template-columns:1fr}.caregiver-import-field.wide{grid-column:auto}.caregiver-import-result{grid-template-columns:repeat(2,1fr)}}
`;document.head.appendChild(style)}
function mountButton(){
 if(role()!=='ADMIN')return;const title=String($('#pageTitle')?.textContent||'');if(!title.includes('پرونده مراقبین')&&!title.includes('کاربران و دسترسی'))return;if($('#caregiverBulkImportLaunch'))return;
 const host=$('.cdp-actions')||$('.surface-head')||$('#content')?.firstElementChild||$('#content');if(!host)return;
 const button=document.createElement('button');button.type='button';button.id='caregiverBulkImportLaunch';button.className='caregiver-import-launch';button.textContent='واردسازی پرونده‌های CRM';button.addEventListener('click',openModal);host.appendChild(button)
}
function closeModal(){document.querySelector('.caregiver-import-backdrop')?.remove()}
async function status(){try{return (await api('/api/admin/caregiver-import/status')).data||{}}catch{return {}}}
function resultMarkup(stats){return `<div><small>پردازش‌شده</small><strong>${fa(stats.processed)}</strong></div><div><small>بدون تغییر</small><strong>${fa(stats.skippedUnchanged)}</strong></div><div><small>پروفایل جدید</small><strong>${fa(stats.createdProfiles)}</strong></div><div><small>پروفایل به‌روز</small><strong>${fa(stats.updatedProfiles)}</strong></div><div><small>حساب جدید</small><strong>${fa(stats.createdAccounts)}</strong></div><div><small>خطا</small><strong>${fa(stats.failed)}</strong></div>`}
function updateResumeNote(root,file){
 const note=$('#caregiverImportResumeNote',root);if(!note||!file)return;const checkpoint=readCheckpoint(file);
 if(checkpoint?.line){note.classList.add('warn');note.textContent=`این فایل قبلاً تا ردیف ${fa(checkpoint.line)} پیش رفته است. اجرای بعدی دقیقاً از ردیف ${fa(checkpoint.line+1)} ادامه می‌یابد و از ابتدا شروع نمی‌شود.`}else{note.classList.remove('warn');note.textContent='پرونده‌هایی که Checksum آن‌ها تغییر نکرده باشد هیچ Write جدیدی روی D1 ایجاد نمی‌کنند. هر درخواست فقط ۲۵ ردیف دارد و نقطه ادامه بعد از هر گروه ذخیره می‌شود.'}
}
async function openModal(){
 closeModal();const current=await status();const wrap=document.createElement('div');wrap.className='caregiver-import-backdrop';wrap.innerHTML=`<section class="caregiver-import-modal"><header class="caregiver-import-head"><div><h3>واردسازی پرونده‌های مراقبین</h3><p>فایل کامل را انتخاب کنید. موارد قبلی با شناسه CRM و شماره پرونده Merge می‌شوند؛ داده بدون تغییر دوباره در دیتابیس نوشته نمی‌شود.</p></div><button class="caregiver-import-close" type="button">×</button></header><div class="caregiver-import-body"><div class="caregiver-import-grid"><label class="caregiver-import-field wide">فایل پرونده‌ها<input id="caregiverImportFile" type="file" accept=".jsonl,.ndjson,.json"></label><label class="caregiver-import-field">رمز اولیه حساب‌ها<input id="caregiverImportPassword" type="password" minlength="8" autocomplete="new-password"></label><label class="caregiver-import-field">وضعیت فعلی دیتابیس<input value="${fa(current.caregiverProfiles||0)} پروفایل / ${fa(current.caregiverAccounts||0)} حساب" disabled></label><div class="caregiver-import-note" id="caregiverImportResumeNote">پس از انتخاب فایل، وضعیت ادامه واردسازی نمایش داده می‌شود.</div></div><div class="caregiver-import-progress" hidden><div class="caregiver-import-progress-track"><div class="caregiver-import-progress-bar"></div></div><div class="caregiver-import-progress-copy"><span>در انتظار شروع</span><strong>۰٪</strong></div><div class="caregiver-import-result"></div><div class="caregiver-import-errors" hidden></div></div></div><footer class="caregiver-import-actions"><button type="button" class="caregiver-import-cancel">بستن</button><button type="button" class="caregiver-import-start">شروع یا ادامه واردسازی</button></footer></section>`;document.body.appendChild(wrap);
 $('.caregiver-import-close',wrap).onclick=closeModal;$('.caregiver-import-cancel',wrap).onclick=closeModal;$('.caregiver-import-start',wrap).onclick=()=>runImport(wrap);$('#caregiverImportFile',wrap).addEventListener('change',event=>updateResumeNote(wrap,event.currentTarget.files?.[0]))
}
async function* lines(file){
 const reader=file.stream().pipeThrough(new TextDecoderStream()).getReader();let buffer='';let lineNumber=0;let bytes=0;
 while(true){const {value,done}=await reader.read();if(done)break;buffer+=value;let pos;while((pos=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,pos);buffer=buffer.slice(pos+1);lineNumber+=1;bytes+=new Blob([raw,'\n']).size;const line=raw.trim();if(line)yield {line,lineNumber,bytes}}}
 const rest=buffer.trim();if(rest){lineNumber+=1;bytes+=new Blob([buffer]).size;yield {line:rest,lineNumber,bytes}}
}
async function sendWithRetry(payload){
 let lastError;for(let attempt=1;attempt<=5;attempt+=1){try{return await api('/api/admin/caregiver-import/batch',{method:'POST',body:JSON.stringify(payload)})}catch(error){lastError=error;if(isQuotaError(error))throw error;if(attempt<5)await sleep(Math.min(7000,attempt*1200))}}throw lastError
}
async function runImport(root){
 const file=$('#caregiverImportFile',root)?.files?.[0],password=$('#caregiverImportPassword',root)?.value||'',button=$('.caregiver-import-start',root),progress=$('.caregiver-import-progress',root),bar=$('.caregiver-import-progress-bar',root),copy=$('.caregiver-import-progress-copy',root),result=$('.caregiver-import-result',root),errors=$('.caregiver-import-errors',root);
 if(!file)return alert('فایل آماده واردسازی را انتخاب کنید.');if(password.length<8)return alert('رمز اولیه را کامل وارد کنید.');
 button.disabled=true;progress.hidden=false;errors.hidden=true;const checkpoint=readCheckpoint(file)||{};const startLine=Number(checkpoint.line||0);const stats={...blankStats(),...(checkpoint.stats||{})};const importId=checkpoint.importId||crypto.randomUUID();let batch=[];let bytesRead=Number(checkpoint.bytes||0);let lastLine=startLine;let failureSamples=[];
 result.innerHTML=resultMarkup(stats);copy.innerHTML=`<span>${startLine?`ادامه از ردیف ${fa(startLine+1)}`:'شروع واردسازی'}</span><strong>${fa(Math.min(99,Math.round(bytesRead/file.size*100)))}٪</strong>`;
 const send=async()=>{if(!batch.length)return;const current=batch;const payload=await sendWithRetry({importId,filename:file.name,initialPassword:password,caregivers:current.map(x=>x.item)});const data=payload.data||{};mergeStats(stats,data);failureSamples.push(...(Array.isArray(data.failures)?data.failures:[]));lastLine=current[current.length-1].lineNumber;bytesRead=current[current.length-1].bytes;writeCheckpoint(file,{line:lastLine,bytes:bytesRead,stats,importId,updatedAt:new Date().toISOString()});batch=[];const percent=Math.min(99,Math.round(bytesRead/file.size*100));bar.style.width=`${percent}%`;copy.innerHTML=`<span>تا ردیف ${fa(lastLine)} پردازش شد</span><strong>${fa(percent)}٪</strong>`;result.innerHTML=resultMarkup(stats);await sleep(40)};
 try{
  for await(const record of lines(file)){if(record.lineNumber<=startLine)continue;let item;try{item=JSON.parse(record.line)}catch{stats.failed+=1;lastLine=record.lineNumber;bytesRead=record.bytes;writeCheckpoint(file,{line:lastLine,bytes:bytesRead,stats,importId,updatedAt:new Date().toISOString()});continue}batch.push({...record,item});if(batch.length>=BATCH_SIZE)await send()}
  await send();clearCheckpoint(file);bar.style.width='100%';copy.innerHTML=`<span>واردسازی کامل شد</span><strong>۱۰۰٪</strong>`;result.innerHTML=resultMarkup(stats);button.textContent='انجام شد';if(failureSamples.length){errors.hidden=false;errors.textContent='نمونه ردیف‌های ناموفق:\n'+failureSamples.slice(0,12).map(x=>`پرونده ${x.membershipCode||'نامشخص'}: ${x.message||''}${x.detail?` — ${x.detail}`:''}`).join('\n')}window.dispatchEvent(new CustomEvent('salamat-server-directory-refresh'));try{window.toast?.('واردسازی کامل شد',`${fa(stats.processed)} ردیف پردازش شد.`)}catch{}
 }catch(error){const message=errorText(error);copy.innerHTML=`<span>${message}</span><strong>توقف موقت</strong>`;button.disabled=false;button.textContent=`ادامه از ردیف ${fa(lastLine+1)}`;errors.hidden=false;errors.textContent=isQuotaError(error)?'سقف مصرف روزانه D1 پر شده است. نقطه ادامه ذخیره شده و پس از آزادشدن ظرفیت یا ارتقای پلن، از همین ردیف ادامه می‌یابد.':`ارتباط پس از چند تلاش برقرار نشد. نقطه ادامه روی ردیف ${fa(lastLine)} ذخیره شده است.`;updateResumeNote(root,file);try{window.toast?.('واردسازی موقتاً متوقف شد',message)}catch{}}
 finally{if(button.textContent==='انجام شد')button.disabled=true}
}
function boot(){addStyles();mountButton();new MutationObserver(()=>setTimeout(mountButton,60)).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
