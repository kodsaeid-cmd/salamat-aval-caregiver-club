(()=>{
'use strict';
if(window.__salamatDesktopReactEntryBridgeV1)return;
window.__salamatDesktopReactEntryBridgeV1=true;
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS','SALES_CONSULTANT','SALES_SUPERVISOR']);
let redirecting=false;
function classicRequested(){return new URL(location.href).searchParams.get('classic')==='1'}
function patchStaffCredentialLogin(){
 const form=document.querySelector('#loginForm');
 const fields=document.querySelector('#emailFields');
 const identifier=fields?.querySelector('input[type="email"],input[name="identifier"],#staffLoginIdentifier');
 if(!form||!fields||!identifier)return;
 form.noValidate=true;
 identifier.id='staffLoginIdentifier';
 identifier.setAttribute('autocomplete','username');
 identifier.setAttribute('placeholder','نام کاربری یا ایمیل سازمانی');
 const label=fields.querySelector('label');
 if(label)label.textContent='نام کاربری یا ایمیل سازمانی';
}
function routeForCurrentModule(){
 const title=String(document.querySelector('#pageTitle')?.textContent||'');
 if(title.includes('آگهی'))return '/app/job_ads';
 if(title.includes('قرارداد'))return '/app/contracts';
 if(title.includes('اعتبار'))return '/app/financial_credits';
 if(title.includes('ارزیابی')||title.includes('پروانه')||title.includes('امتیاز'))return '/app/evaluations';
 return '/app/';
}
async function resolve(){
 if(redirecting||classicRequested()||location.pathname.startsWith('/app/')||location.pathname.startsWith('/mobile/'))return;
 try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache'}});
  if(!response.ok)return;
  const payload=await response.json().catch(()=>null),user=payload?.data||payload?.user||payload||{},role=String(user?.role||'').toUpperCase();
  if(role==='CAREGIVER'){redirecting=true;location.replace('/mobile/');return}
  if(STAFF_ROLES.has(role)){redirecting=true;location.replace(routeForCurrentModule())}
 }catch{}
}
function boot(){patchStaffCredentialLogin();void resolve()}
window.addEventListener('salamat-authenticated',()=>setTimeout(resolve,0));
window.addEventListener('pageshow',()=>{patchStaffCredentialLogin();void resolve()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
[750,2000,5000,10000].forEach(delay=>setTimeout(()=>{patchStaffCredentialLogin();void resolve()},delay));
})();
