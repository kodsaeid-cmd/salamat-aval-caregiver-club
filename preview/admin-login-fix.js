(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const ADMIN_ID='SYS-ADMIN';
const ADMIN_USERNAME='GodKod';
const ADMIN_PASSWORD='Sa642044';
const DEFAULT_USERS=[
 {id:ADMIN_ID,name:'مدیر سامانه',username:ADMIN_USERNAME,password:ADMIN_PASSWORD,email:'admin@salamataval.ir',mobile:'',role:'admin',status:'approved',createdAt:'حساب اولیه سامانه'},
 {id:'USR-CARE-001',name:'مریم حسینی',username:'maryam',password:'123456',email:'maryam@salamataval.ir',mobile:'09128668837',role:'caregiver',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-REC-001',name:'مهدی رضایی',username:'recruiter',password:'123456',email:'recruitment@salamataval.ir',mobile:'09120000001',role:'recruiter',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-HR-001',name:'سارا محمدی',username:'hr',password:'123456',email:'hr@salamataval.ir',mobile:'09120000002',role:'hr',status:'pending',createdAt:'نمونه اولیه'}
];
function migrate(){
 let state;
 try{state=JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{state=null}
 if(!state||!Array.isArray(state.users))state={users:[...DEFAULT_USERS],audit:[]};
 state.audit=Array.isArray(state.audit)?state.audit:[];
 let admin=state.users.find(user=>user.id===ADMIN_ID)||state.users.find(user=>user.role==='admin'&&['admin','godkod'].includes(String(user.username||'').toLowerCase()));
 if(!admin){admin={...DEFAULT_USERS[0]};state.users.unshift(admin)}
 Object.assign(admin,{id:ADMIN_ID,username:ADMIN_USERNAME,password:ADMIN_PASSWORD,passwordEncoding:'plain',role:'admin',status:'approved'});
 admin.name=admin.name||'مدیر سامانه';admin.email=admin.email||'admin@salamataval.ir';
 state.credentialVersion='god-admin-stable-v2';
 localStorage.setItem(AUTH_KEY,JSON.stringify(state));
}
function isAdminSelected(){
 try{return selectedRole==='admin'}catch{return document.querySelector('#roleOptions [data-role="admin"]')?.classList.contains('active')}
}
function applyLoginUi(){
 const box=document.querySelector('#emailFields');
 if(!box)return;
 document.querySelector('#adminCredentialNote')?.remove();
 const login=box.querySelector('input:not([type="password"])');
 const password=box.querySelector('input[type="password"]');
 const label=box.querySelector('label');
 if(isAdminSelected()){
  document.querySelector('#methodTabs [data-method="email"]')?.click();
  if(login){login.type='text';login.value='';login.placeholder='نام کاربری مدیر کل';login.autocomplete='username'}
  if(password){password.value='';password.autocomplete='current-password'}
  if(label)label.textContent='نام کاربری';
 }else{
  if(login){login.type='email';login.value='';login.placeholder='name@salamataval.ir'}
  if(password)password.value='';
  if(label)label.textContent='ایمیل سازمانی';
 }
}
function removeLegacyHints(){
 document.querySelectorAll('.ap-policy-list div').forEach(item=>{
  if(/admin\s*[\/:،-]\s*admin/i.test(item.textContent||''))item.textContent='✓ حساب مدیر کل با شناسه اختصاصی فعال است.';
 });
 document.querySelector('#adminCredentialNote')?.remove();
}
function boot(){
 migrate();
 document.querySelectorAll('#roleOptions [data-role]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>{applyLoginUi();removeLegacyHints()},0)));
 applyLoginUi();removeLegacyHints();
 const content=document.querySelector('#content');
 if(content)new MutationObserver(removeLegacyHints).observe(content,{childList:true,subtree:true});
 window.addEventListener('storage',event=>{if(event.key===AUTH_KEY)migrate()});
 window.addEventListener('salamat-access-changed',migrate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
