(()=>{
'use strict';

if(window.__salamatLoginIdentifierRuntimeV1)return;
window.__salamatLoginIdentifierRuntimeV1=true;

function selectPasswordLogin(){
  const emailTab=document.querySelector('#methodTabs [data-method="email"]');
  if(emailTab&&!emailTab.classList.contains('active'))emailTab.click();
}

function patchLoginForm(){
  const form=document.getElementById('loginForm');
  const emailFields=document.getElementById('emailFields');
  if(!form||!emailFields)return;

  // The original field is type=email, while the backend also accepts a plain username.
  // Disabling native email validation prevents the browser from silently blocking submit.
  form.noValidate=true;
  form.setAttribute('novalidate','novalidate');

  const identifier=emailFields.querySelector('input[type="email"],input[autocomplete="username"],input');
  if(identifier){
    identifier.id='backendIdentifierInput';
    identifier.setAttribute('autocomplete','username');
    identifier.setAttribute('aria-label','نام کاربری یا ایمیل سازمانی');
    identifier.placeholder='نام کاربری یا ایمیل سازمانی';
  }
  const label=emailFields.querySelector('label');
  if(label)label.textContent='نام کاربری یا ایمیل سازمانی';

  const adminButton=document.querySelector('#roleOptions [data-role="admin"]');
  if(adminButton&&!adminButton.dataset.passwordLoginBound){
    adminButton.dataset.passwordLoginBound='true';
    adminButton.addEventListener('click',()=>{
      selectPasswordLogin();
      setTimeout(()=>identifier?.focus(),0);
    });
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchLoginForm);
else patchLoginForm();
})();
