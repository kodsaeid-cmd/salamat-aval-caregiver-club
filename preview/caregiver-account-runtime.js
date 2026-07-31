(()=>{
'use strict';

if(window.__salamatCaregiverAccountRuntimeV1)return;
window.__salamatCaregiverAccountRuntimeV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const notify=(title,text)=>{try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)};
const errorText=error=>[error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:'',error?.detail?String(error.detail).slice(0,300):''].filter(Boolean).join(' — ');

async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}

async function refresh(label='کاربران و دسترسی‌ها'){
  if(window.SalamatBackend?.refresh)return window.SalamatBackend.refresh(label);
  return null;
}

function setBusy(form,busy,label='در حال ثبت در دیتابیس...'){
  const button=form?.querySelector('[type="submit"],button:not([type])');
  if(!button)return;
  if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ثبت';
  button.disabled=busy;button.textContent=busy?label:button.dataset.originalText;
}

function normalizeUnifiedForm(){
  const form=$('#unifiedAccountProfileForm');if(!form)return;
  const password=form.elements.password;if(password)password.minLength=8;
  const status=form.elements.status;
  if(status&&!status.dataset.serverDefault){status.value='approved';status.dataset.serverDefault='true'}
  const email=form.elements.email;
  if(email){email.type='text';email.autocomplete='username';email.placeholder='ایمیل یا نام کاربری ورود'}
}

async function submitUnified(event){
  const form=event.target;if(form?.id!=='unifiedAccountProfileForm')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const data=new FormData(form),role=String(data.get('role')||'caregiver').toLowerCase(),password=String(data.get('password')||'');
  if(password.length<8){notify('رمز کوتاه است','رمز عبور باید حداقل ۸ کاراکتر باشد.');return}
  const body={
    fullName:String(data.get('name')||'').trim(),
    role,
    username:String(data.get('email')||'').trim(),
    email:String(data.get('email')||'').trim(),
    password,
    mobile:String(data.get('mobile')||'').trim(),
    status:String(data.get('status')||'approved'),
    nationalId:String(data.get('nationalId')||'').trim(),
    serviceGroup:String(data.get('serviceGroup')||'').trim(),
    fileStatus:String(data.get('fileStatus')||'').trim(),
    city:String(data.get('city')||'').trim(),
    address:String(data.get('address')||'').trim(),
    bio:String(data.get('bio')||'').trim(),
  };
  setBusy(form,true,role==='caregiver'?'در حال ساخت حساب و پرونده متصل...':'در حال ساخت حساب...');
  try{
    const result=await api(role==='caregiver'?'/api/caregiver-accounts':'/api/users',{method:'POST',body:JSON.stringify(body)});
    await api('/api/admin/reconcile-caregiver-accounts',{method:'POST'}).catch(()=>null);
    await refresh('کاربران و دسترسی‌ها');
    const caregiverId=result?.data?.caregiver?.membershipCode||result?.data?.caregiver?.id||result?.data?.caregiverId||'';
    notify('ثبت روی سرور انجام شد',role==='caregiver'?`حساب ورود و پرونده حرفه‌ای ${caregiverId} به‌صورت متصل در D1 ساخته شدند.`:'حساب سازمانی در D1 ساخته شد.');
  }catch(error){console.error('Unified account creation failed',error);notify('ایجاد حساب انجام نشد',errorText(error))}
  finally{setBusy(form,false)}
}

async function handleServerAction(event){
  const statusButton=event.target?.closest?.('[data-unified-user-status]');
  const deleteButton=event.target?.closest?.('[data-unified-user-delete]');
  if(!statusButton&&!deleteButton)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  try{
    if(statusButton){
      const [id,status]=String(statusButton.dataset.unifiedUserStatus||'').split('|');
      await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});
      await api('/api/admin/reconcile-caregiver-accounts',{method:'POST'}).catch(()=>null);
      await refresh('کاربران و دسترسی‌ها');
      notify('وضعیت حساب ثبت شد',status==='approved'?'کاربر اکنون می‌تواند با رمز خود وارد شود.':'دسترسی حساب در سرور تغییر کرد.');
      return;
    }
    if(deleteButton){
      if(!confirm('حساب کاربری از سرور حذف شود؟ پرونده حرفه‌ای برای حفظ سوابق باقی می‌ماند.'))return;
      await api(`/api/users/${encodeURIComponent(deleteButton.dataset.unifiedUserDelete)}`,{method:'DELETE'});
      await refresh('کاربران و دسترسی‌ها');
      notify('حساب حذف شد','حساب ورود از D1 حذف شد.');
    }
  }catch(error){notify('عملیات انجام نشد',errorText(error))}
}

let reconciled=false;
async function reconcileOnce(){
  if(reconciled)return;
  const user=window.SalamatBackend?.getCurrentUser?.();
  if(!user||String(user.role||'').toUpperCase()!=='ADMIN')return;
  reconciled=true;
  try{
    const result=await api('/api/admin/reconcile-caregiver-accounts',{method:'POST'});
    if(result?.data?.repaired)await refresh('');
  }catch(error){console.error('Caregiver account reconciliation failed',error)}
}

window.addEventListener('submit',submitUnified,true);
window.addEventListener('click',handleServerAction,true);
const observer=new MutationObserver(()=>{normalizeUnifiedForm();void reconcileOnce()});
const root=$('#content')||document.body;observer.observe(root,{childList:true,subtree:true});
normalizeUnifiedForm();
const timer=setInterval(()=>{normalizeUnifiedForm();void reconcileOnce();if(reconciled)clearInterval(timer)},500);
setTimeout(()=>clearInterval(timer),20000);
})();
