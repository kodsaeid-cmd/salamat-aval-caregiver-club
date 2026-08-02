(()=>{
'use strict';
if(window.__salamatDirectLoginHandlerV2)return;
window.__salamatDirectLoginHandlerV2=true;

const $=(selector,root=document)=>root.querySelector(selector);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

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
  for(let attempt=0;attempt<50;attempt+=1){
    if(typeof window.SalamatBackend?.enterApp==='function')return window.SalamatBackend;
    await delay(40);
  }
  throw new Error('سامانه ورود آماده نشد؛ صفحه را بازخوانی کنید.');
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
    const backend=await waitForBackend();
    await backend.enterApp(payload.data);
    try{await window.SalamatAccessControl?.reload?.()}catch{}
  }catch(error){
    const detail=error?.detail?` — ${error.detail}`:'';
    showError(`${error?.message||'ورود انجام نشد.'}${detail}`,error?.code||'login_failed');
  }finally{
    if(submit)submit.disabled=false;
  }
}

/* Registered in <head>, before the legacy backend submit handler. */
document.addEventListener('submit',directLogin,true);

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
