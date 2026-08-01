(()=>{
'use strict';
if(window.__salamatCaregiverBulkImportV1)return;
window.__salamatCaregiverBulkImportV1=true;
const $=(s,r=document)=>r.querySelector(s);
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function role(){return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||'').toUpperCase()}
function api(path,options={}){
 if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
 const headers=new Headers(options.headers||{});if(typeof options.body==='string')headers.set('content-type','application/json');
 return fetch(path,{credentials:'same-origin',...options,headers}).then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);return payload})
}
function addStyles(){if($('#caregiverBulkImportStyles'))return;const style=document.createElement('style');style.id='caregiverBulkImportStyles';style.textContent=`
.caregiver-import-launch{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:10px 14px;background:#087847;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 8px 20px rgba(8,120,71,.18)}
.caregiver-import-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(12,35,25,.48);display:grid;place-items:center;padding:20px;direction:rtl}.caregiver-import-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 26px 70px rgba(0,0,0,.22)}.caregiver-import-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;padding:22px;border-bottom:1px solid #e7efeb}.caregiver-import-head h3{margin:0;font-size:18px}.caregiver-import-head p{margin:7px 0 0;color:#66786e;font-size:10px;line-height:1.9}.caregiver-import-close{border:0;background:#f1f4f2;border-radius:9px;width:34px;height:34px;cursor:pointer}.caregiver-import-body{padding:22px}.caregiver-import-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.caregiver-import-field{display:grid;gap:7px;font-size:10px;font-weight:800;color:#2f4439}.caregiver-import-field.wide{grid-column:1/-1}.caregiver-import-field input{width:100%;box-sizing:border-box;border:1px solid #d7e4dd;border-radius:12px;padding:11px;font:inherit;background:#fff}.caregiver-import-note{grid-column:1/-1;padding:12px 14px;border-radius:13px;background:#f3f8f5;color:#4b6256;font-size:10px;line-height:1.9}.caregiver-import-progress{margin-top:16px;padding:14px;border:1px solid #e0eae5;border-radius:14px;background:#fbfdfc}.caregiver-import-progress-track{height:9px;border-radius:999px;background:#e8efeb;overflow:hidden}.caregiver-import-progress-bar{height:100%;width:0;background:#078848;transition:.2s}.caregiver-import-progress-copy{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:10px;color:#52665b}.caregiver-import-result{margin-top:13px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.caregiver-import-result div{padding:10px;border-radius:12px;background:#f5f9f7}.caregiver-import-result small{display:block;color:#74837b;font-size:8px}.caregiver-import-result strong{display:block;margin-top:5px;color:#087847;font-size:14px}.caregiver-import-actions{display:flex;justify-content:flex-end;gap:9px;padding:17px 22px;border-top:1px solid #e7efeb}.caregiver-import-actions button{border:0;border-radius:11px;padding:11px 16px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.caregiver-import-start{background:#087847;color:#fff;min-width:170px}.caregiver-import-start:disabled{opacity:.55;cursor:wait}.caregiver-import-cancel{background:#eef2f0;color:#4e6257}@media(max-width:650px){.caregiver-import-grid{grid-template-columns:1fr}.caregiver-import-field.wide{grid-column:auto}.caregiver-import-result{grid-template-columns:repeat(2,1fr)}}
`;document.head.appendChild(style)}
function mountButton(){
 if(role()!=='ADMIN')return;
 const title=String($('#pageTitle')?.textContent||'');
 if(!title.includes('پرونده مراقبین')&&!title.includes('کاربران و دسترسی'))return;
 if($('#caregiverBulkImportLaunch'))return;
 const host=$('.surface-head')||$('#content')?.firstElementChild||$('#content');if(!host)return;
 const button=document.createElement('button');button.type='button';button.id='caregiverBulkImportLaunch';button.className='caregiver-import-launch';button.textContent='واردسازی پرونده‌های CRM';button.addEventListener('click',openModal);host.appendChild(button)
}
function closeModal(){document.querySelector('.caregiver-import-backdrop')?.remove()}
async function status(){try{return (await api('/api/admin/caregiver-import/status')).data||{}}catch{return {}}}
async function openModal(){
 closeModal();const current=await status();const wrap=document.createElement('div');wrap.className='caregiver-import-backdrop';wrap.innerHTML=`<section class="caregiver-import-modal"><header class="caregiver-import-head"><div><h3>واردسازی پرونده‌های مراقبین</h3><p>فایل آماده‌شده را انتخاب کنید. شماره پرونده به‌عنوان نام کاربری ثبت می‌شود و پروفایل‌ها بدون حذف سوابق موجود به‌روزرسانی می‌شوند.</p></div><button class="caregiver-import-close" type="button">×</button></header><div class="caregiver-import-body"><div class="caregiver-import-grid"><label class="caregiver-import-field wide">فایل پرونده‌ها<input id="caregiverImportFile" type="file" accept=".jsonl,.ndjson,.json"></label><label class="caregiver-import-field">رمز اولیه حساب‌ها<input id="caregiverImportPassword" type="password" minlength="8" autocomplete="new-password"></label><label class="caregiver-import-field">وضعیت فعلی دیتابیس<input value="${fa(current.caregiverProfiles||0)} پروفایل / ${fa(current.caregiverAccounts||0)} حساب" disabled></label><div class="caregiver-import-note">فایل اصلی اکسل یا داده‌های خام داخل GitHub قرار نمی‌گیرند. پردازش در مرورگر انجام می‌شود و اطلاعات در گروه‌های کوچک به دیتابیس ارسال می‌شوند.</div></div><div class="caregiver-import-progress" hidden><div class="caregiver-import-progress-track"><div class="caregiver-import-progress-bar"></div></div><div class="caregiver-import-progress-copy"><span>در انتظار شروع</span><strong>۰٪</strong></div><div class="caregiver-import-result"></div></div></div><footer class="caregiver-import-actions"><button type="button" class="caregiver-import-cancel">بستن</button><button type="button" class="caregiver-import-start">شروع تشکیل پروفایل‌ها</button></footer></section>`;document.body.appendChild(wrap);
 $('.caregiver-import-close',wrap).onclick=closeModal;$('.caregiver-import-cancel',wrap).onclick=closeModal;$('.caregiver-import-start',wrap).onclick=()=>runImport(wrap)
}
async function* lines(file){
 const reader=file.stream().pipeThrough(new TextDecoderStream()).getReader();let buffer='';
 while(true){const {value,done}=await reader.read();if(done)break;buffer+=value;let pos;while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos).trim();buffer=buffer.slice(pos+1);if(line)yield line}}
 const rest=buffer.trim();if(rest)yield rest
}
function resultMarkup(stats){return `<div><small>پردازش‌شده</small><strong>${fa(stats.processed)}</strong></div><div><small>پروفایل جدید</small><strong>${fa(stats.createdProfiles)}</strong></div><div><small>حساب جدید</small><strong>${fa(stats.createdAccounts)}</strong></div><div><small>خطا</small><strong>${fa(stats.failed)}</strong></div>`}
async function runImport(root){
 const file=$('#caregiverImportFile',root)?.files?.[0],password=$('#caregiverImportPassword',root)?.value||'',button=$('.caregiver-import-start',root),progress=$('.caregiver-import-progress',root),bar=$('.caregiver-import-progress-bar',root),copy=$('.caregiver-import-progress-copy',root),result=$('.caregiver-import-result',root);
 if(!file)return alert('فایل آماده واردسازی را انتخاب کنید.');if(password.length<8)return alert('رمز اولیه را کامل وارد کنید.');
 button.disabled=true;progress.hidden=false;const importId=crypto.randomUUID();const stats={processed:0,createdProfiles:0,updatedProfiles:0,createdAccounts:0,updatedAccounts:0,failed:0};let batch=[];let bytesRead=0;const send=async()=>{if(!batch.length)return;const payload=await api('/api/admin/caregiver-import/batch',{method:'POST',body:JSON.stringify({importId,filename:file.name,initialPassword:password,caregivers:batch})});const data=payload.data||{};stats.processed+=Number(data.received||0);stats.createdProfiles+=Number(data.createdProfiles||0);stats.updatedProfiles+=Number(data.updatedProfiles||0);stats.createdAccounts+=Number(data.createdAccounts||0);stats.updatedAccounts+=Number(data.updatedAccounts||0);stats.failed+=Number(data.failed||0);batch=[];const percent=Math.min(99,Math.round(bytesRead/file.size*100));bar.style.width=`${percent}%`;copy.innerHTML=`<span>${fa(stats.processed)} پرونده ثبت شده</span><strong>${fa(percent)}٪</strong>`;result.innerHTML=resultMarkup(stats);await sleep(30)};
 try{
  for await(const line of lines(file)){bytesRead+=new Blob([line,'\n']).size;let item;try{item=JSON.parse(line)}catch{stats.failed+=1;continue}batch.push(item);if(batch.length>=100)await send()}
  await send();bar.style.width='100%';copy.innerHTML=`<span>تشکیل پروفایل‌ها کامل شد</span><strong>۱۰۰٪</strong>`;result.innerHTML=resultMarkup(stats);button.textContent='انجام شد';
  try{window.toast?.('واردسازی کامل شد',`${fa(stats.processed)} پرونده پردازش شد.`)}catch{}
 }catch(error){copy.innerHTML=`<span>${String(error?.message||'واردسازی متوقف شد')}</span><strong>خطا</strong>`;button.disabled=false;button.textContent='ادامه واردسازی';try{window.toast?.('واردسازی کامل نشد',String(error?.message||error))}catch{}}
}
function boot(){addStyles();mountButton();new MutationObserver(()=>setTimeout(mountButton,60)).observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
