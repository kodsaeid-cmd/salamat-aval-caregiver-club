(()=>{
'use strict';

const $=(selector,root=document)=>root.querySelector(selector);

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload.message||`خطای ${response.status}`);
    error.status=response.status;
    error.code=payload.error;
    error.detail=payload.detail;
    throw error;
  }
  return payload;
}

function showError(message){
  let box=$('#backendLoginMessage');
  const form=$('#loginForm');
  if(!form)return;
  if(!box){
    box=document.createElement('div');
    box.id='backendLoginMessage';
    box.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff1f1;color:#a52323;font-size:12px;font-weight:700;line-height:1.8';
    form.querySelector('.primary-action')?.before(box);
  }
  box.textContent=message;
  box.hidden=false;
}

function clearError(){const box=$('#backendLoginMessage');if(box)box.hidden=true}
function method(){return $('#methodTabs button.active')?.dataset.method||'email'}
function role(){try{return selectedRole||'caregiver'}catch{return $('#roleOptions .role-option.active')?.dataset.role||'caregiver'}}
function normalizeMobile(value){return String(value||'').replace(/\D/g,'').replace(/^0098/,'0').replace(/^98(?=9)/,'0').replace(/^(9\d{9})$/,'0$1')}

async function authenticate(){
  if(method()==='mobile'){
    return api('/api/auth/verify-otp',{
      method:'POST',
      body:JSON.stringify({
        mobile:normalizeMobile($('#mobileInput')?.value),
        code:String($('#otpInput')?.value||'').replace(/\D/g,'')
      })
    });
  }

  const emailFields=$('#emailFields');
  const setupInput=$('#setupKeyInput');
  const identifierInput=[...(emailFields?.querySelectorAll('input')||[])].find(input=>input!==setupInput&&input.type!=='password');
  const passwordInput=[...(emailFields?.querySelectorAll('input[type="password"]')||[])].find(input=>input!==setupInput);
  const identifier=String(identifierInput?.value||'').trim().toLowerCase();
  const password=String(passwordInput?.value||'');

  if(!identifier)throw new Error('ایمیل یا نام کاربری را وارد کنید.');
  if(password.length<8)throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');

  const status=await api('/api/setup/status');
  if(!status.adminExists){
    if(role()!=='admin')throw new Error('برای ساخت اولین حساب، پنل «مدیر سامانه» را انتخاب کنید.');
    const setupKey=String(setupInput?.value||'');
    if(!setupKey)throw new Error('کد راه‌اندازی مدیر را وارد کنید.');
    await api('/api/setup/admin',{
      method:'POST',
      headers:{'x-setup-key':setupKey},
      body:JSON.stringify({fullName:'مدیر سامانه',username:identifier,email:identifier,password})
    });
  }

  return api('/api/auth/login',{
    method:'POST',
    body:JSON.stringify({identifier,password})
  });
}

window.addEventListener('submit',async event=>{
  if(event.target?.id!=='loginForm')return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  clearError();
  const submit=$('#loginForm .primary-action');
  if(submit)submit.disabled=true;
  try{
    await authenticate();
    location.reload();
  }catch(error){
    console.error('Backend authentication failed',error);
    showError(error?.detail?`${error.message} — ${error.detail}`:error.message||'ورود انجام نشد.');
  }finally{
    if(submit)submit.disabled=false;
  }
},true);

})();
