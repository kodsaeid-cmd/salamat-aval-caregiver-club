(()=>{
'use strict';

const $=(selector,root=document)=>root.querySelector(selector);

function showLoginError(message){
  let box=$('#backendLoginMessage');
  if(!box){
    box=document.createElement('div');
    box.id='backendLoginMessage';
    box.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff1f1;color:#a52323;font-size:12px;font-weight:700;line-height:1.8';
    $('#loginForm .primary-action')?.before(box);
  }
  box.textContent=message;
  box.hidden=false;
}

function clearLoginError(){
  const box=$('#backendLoginMessage');
  if(box)box.hidden=true;
}

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload.message||'عملیات انجام نشد.');
    error.status=response.status;
    error.code=payload.error;
    throw error;
  }
  return payload;
}

async function handleEmailLogin(event){
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='loginForm')return;
  const method=$('#methodTabs button.active')?.dataset.method||'mobile';
  if(method!=='email')return;

  // Run before all legacy form-level demo authentication listeners.
  event.preventDefault();
  event.stopImmediatePropagation();
  clearLoginError();

  const submit=$('#loginForm .primary-action');
  if(submit)submit.disabled=true;

  try{
    const emailFields=$('#emailFields');
    const identifierInput=[...(emailFields?.querySelectorAll('input')||[])].find(input=>input.id!=='setupKeyInput'&&input.type!=='password');
    const passwordInput=[...(emailFields?.querySelectorAll('input[type="password"]')||[])].find(input=>input.id!=='setupKeyInput');
    const identifier=String(identifierInput?.value||'').trim().toLowerCase();
    const password=String(passwordInput?.value||'');

    if(!identifier)throw new Error('نام کاربری یا ایمیل را وارد کنید.');
    if(password.length<8)throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');

    const setup=await api('/api/setup/status');
    if(!setup.adminExists){
      const role=$('#roleOptions .role-option.active')?.dataset.role;
      if(role!=='admin')throw new Error('برای راه‌اندازی اولیه، «مدیر سامانه» را انتخاب کنید.');
      const setupKey=String($('#setupKeyInput')?.value||'');
      if(!setupKey)throw new Error('کد راه‌اندازی مدیر را وارد کنید.');
      await api('/api/setup/admin',{
        method:'POST',
        headers:{'x-setup-key':setupKey},
        body:JSON.stringify({fullName:'مدیر سامانه',username:identifier,email:identifier,password}),
      });
    }

    await api('/api/auth/login',{
      method:'POST',
      body:JSON.stringify({identifier,password}),
    });

    // Reload lets the main backend bridge restore the authenticated session and D1 state cleanly.
    location.reload();
  }catch(error){
    showLoginError(error instanceof Error?error.message:'ورود انجام نشد.');
  }finally{
    if(submit)submit.disabled=false;
  }
}

window.addEventListener('submit',handleEmailLogin,true);
})();
