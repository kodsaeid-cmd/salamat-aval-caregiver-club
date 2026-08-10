(()=>{
'use strict';
if(window.__salamatDirectLoginHandlerV35)return;
window.__salamatDirectLoginHandlerV35=true;

const $=(selector,root=document)=>root.querySelector(selector);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS','SALES_CONSULTANT']);
const ROLE_LABELS={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات',SALES_CONSULTANT:'مشاور فروش'};
let handoffInFlight=false;

function emailModeActive(){
  const emailFields=$('#emailFields');
  const mobileFields=$('#mobileFields');
  if(!emailFields||emailFields.classList.contains('hidden'))return false;
  return !mobileFields||mobileFields.classList.contains('hidden');
}
function setupModeActive(){
  const wrap=$('#setupKeyWrap');
  return Boolean(wrap&&!wrap.hidden);
}
function identifierInput(){
  const fields=$('#emailFields');
  if(!fields)return null;
  const inputs=[...fields.querySelectorAll('input')];
  return inputs.find(input=>{
    const type=String(input.type||'text').toLowerCase();
    return type!=='password'&&type!=='hidden'&&input.id!=='backendIdentifierEmailBridge'&&!input.hidden;
  })||null;
}
function passwordInput(){return $('#emailFields input[type="password"]')}
function messageBox(){
  let box=$('#backendLoginMessage');
  if(!box){
    box=document.createElement('div');
    box.id='backendLoginMessage';
    box.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff1f1;color:#a52323;font-size:12px;font-weight:700;line-height:1.8';
    $('#loginForm .primary-action')?.before(box);
  }
  return box;
}
function showError(message,code=''){
  const box=messageBox();
  box.textContent=message;
  box.hidden=false;
  if(code)box.dataset.errorCode=code;else delete box.dataset.errorCode;
}
function clearError(){const box=$('#backendLoginMessage');if(box)box.hidden=true}
async function parseResponse(response){
  const text=await response.text();
  try{return text?JSON.parse(text):{}}
  catch{return {detail:text}}
}
async function waitForBackend(){
  for(let attempt=0;attempt<75;attempt+=1){
    if(typeof window.SalamatBackend?.enterApp==='function')return window.SalamatBackend;
    await delay(40);
  }
  throw new Error('سامانه ورود آماده نشد؛ صفحه را بازخوانی کنید.');
}
function roleOf(user){return String(user?.actualRole||user?.role||'').trim().toUpperCase()}
function uiUser(user){
  const actualRole=roleOf(user);
  if(!STAFF_ROLES.has(actualRole)||actualRole==='ADMIN')return user;
  return {...user,role:'ADMIN',actualRole,actualRoleLabel:user.roleLabel||ROLE_LABELS[actualRole]||actualRole,roleLabel:user.roleLabel||ROLE_LABELS[actualRole]||actualRole,staffShell:true};
}
function classicRequested(){return new URLSearchParams(location.search).get('classic')==='1'}
function mobileStaffViewport(){
  return Boolean(window.matchMedia?.('(max-width: 899px)').matches||/\/mobile(?:\/|$)/.test(location.pathname));
}
function reactDesktopTarget(user){
  if(classicRequested())return '';
  const role=roleOf(user);
  if(STAFF_ROLES.has(role))return mobileStaffViewport()?'/mobile/admin/':'/app/';
  if(role==='CAREGIVER')return '/mobile/';
  return '';
}
function handoffAuthenticatedUser(user){
  const target=reactDesktopTarget(user);
  if(!target)return false;
  handoffInFlight=true;
  location.replace(target);
  return true;
}
async function pollAuthenticatedSession(){
  if(handoffInFlight||classicRequested()||setupModeActive())return;
  handoffInFlight=true;
  try{
    for(let attempt=0;attempt<24;attempt+=1){
      if(attempt)await delay(250);
      const response=await fetch('/api/auth/me',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}).catch(()=>null);
      if(!response?.ok)continue;
      const payload=await parseResponse(response);
      const user=payload?.data||payload?.user||payload;
      const target=reactDesktopTarget(user);
      if(target){location.replace(target);return}
    }
  }finally{
    handoffInFlight=false;
  }
}
function legacyMobileSubmit(event){
  if(event.target?.id!=='loginForm'||emailModeActive()||setupModeActive()||classicRequested())return;
  void pollAuthenticatedSession();
}
function authenticatedEvent(event){
  if(handoffInFlight)return;
  handoffAuthenticatedUser(event?.detail);
}
async function directLogin(event){
  if(event.target?.id!=='loginForm'||!emailModeActive()||setupModeActive())return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  clearError();

  const identifier=String(identifierInput()?.value||'').trim().toLowerCase();
  const password=String(passwordInput()?.value||'');
  if(!identifier){showError('نام کاربری یا ایمیل را وارد کنید.','missing_identifier');return}
  if(!password){showError('رمز عبور را وارد کنید.','missing_password');return}

  const submit=$('#loginForm .primary-action');
  if(submit)submit.disabled=true;
  try{
    const response=await fetch('/api/auth/login',{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({identifier,password}),
    });
    const payload=await parseResponse(response);
    if(!response.ok){
      const error=new Error(payload.message||'ورود انجام نشد.');
      error.code=payload.error||`http_${response.status}`;
      error.detail=payload.detail;
      throw error;
    }
    if(!payload?.data?.id)throw new Error('پاسخ ورود معتبر نیست.');
    const actualUser=payload.data;
    const reactTarget=reactDesktopTarget(actualUser);
    if(reactTarget){
      handoffInFlight=true;
      window.dispatchEvent(new CustomEvent('salamat-authenticated',{detail:actualUser}));
      location.replace(reactTarget);
      return;
    }
    window.dispatchEvent(new CustomEvent('salamat-authenticated',{detail:actualUser}));
    const backend=await waitForBackend();
    await backend.enterApp(uiUser(actualUser));
    try{await window.SalamatAccessControl?.reload?.()}catch{}
  }catch(error){
    const detail=error?.detail?` — ${error.detail}`:'';
    showError(`${error?.message||'ورود انجام نشد.'}${detail}`,error?.code||'login_failed');
  }finally{
    if(submit)submit.disabled=false;
  }
}

document.addEventListener('submit',legacyMobileSubmit,true);
document.addEventListener('submit',directLogin,true);
window.addEventListener('salamat-authenticated',authenticatedEvent);

function prepareFields(){
  const form=$('#loginForm');
  const identifier=identifierInput();
  if(form){form.noValidate=true;form.setAttribute('novalidate','novalidate')}
  if(identifier){
    identifier.id='backendIdentifierInput';
    identifier.type='text';
    identifier.setAttribute('autocomplete','username');
    identifier.setAttribute('data-login-identifier','true');
  }
  const password=passwordInput();
  if(password)password.setAttribute('autocomplete','current-password');
  $('#backendIdentifierEmailBridge')?.remove();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepareFields,{once:true});
else prepareFields();
})();
