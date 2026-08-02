(()=>{
'use strict';
if(window.__salamatRecruiterLiveRuntimeLoaderV4)return;
window.__salamatRecruiterLiveRuntimeLoaderV4=true;

/* Block any cached V2 runtime that may still be injected with the old query string. */
window.__salamatRecruiterServerRuntimeV2=true;

const SESSION_KEY='salamatAvalSessionV1';
const targetLabel='کاربران و دسترسی‌ها';
let openToken=0;

function text(value){return String(value||'').replace(/\s+/g,' ').trim()}
function sessionRole(){
  try{return String(JSON.parse(localStorage.getItem(SESSION_KEY)||'{}')?.role||'').toUpperCase()}
  catch{return ''}
}
function backendUser(){
  try{return window.SalamatBackend?.getCurrentUser?.()||null}
  catch{return null}
}
function isRecruiter(){
  const user=backendUser();
  const role=String(user?.actualRole||user?.role||'').toUpperCase();
  return role==='RECRUITER'||sessionRole()==='RECRUITER';
}
function isUsersButton(button){
  const label=text(button?.textContent);
  return label.includes('کاربران و دسترسی')||label==='مدیریت کاربران';
}
function markActive(button){
  document.querySelectorAll('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',item===button));
}
function showLoading(){
  const title=document.querySelector('#pageTitle');
  const subtitle=document.querySelector('#pageSubtitle');
  const content=document.querySelector('#content');
  if(title)title.textContent=targetLabel;
  if(subtitle)subtitle.textContent='مدیریت حساب‌ها و پرونده‌های مراقبین متصل به دیتابیس';
  if(content&&!content.querySelector('.adp-root'))content.innerHTML='<section class="module-page"><div class="recruiter-route-loading" style="min-height:280px;display:grid;place-items:center;border:1px dashed #cfe0d7;border-radius:22px;background:#fbfdfc;color:#64766c;font-size:12px;font-weight:800">در حال بارگذاری نسخه متصل کاربران و دسترسی‌ها...</div></section>';
}
function ensureAccountDirectoryRuntime(){
  if(window.__salamatAccountDirectoryPaginationV4)return;
  if(document.querySelector('script[data-recruiter-account-directory-direct]'))return;
  const script=document.createElement('script');
  script.src='./account-directory-pagination.js?v=4.2.0';
  script.async=false;
  script.dataset.recruiterAccountDirectoryDirect='true';
  document.body.appendChild(script);
}
function recruiterModel(){
  try{return window.roles?.recruiter||(typeof roles!=='undefined'?roles.recruiter:null)||{role:'کارشناس جذب'}}
  catch{return {role:'کارشناس جذب'}}
}
function invokeWithTemporaryAdmin(){
  const backend=window.SalamatBackend;
  const original=backend?.getCurrentUser;
  let spoof=null;
  if(backend&&typeof original==='function'){
    spoof=function(){
      const user=original.call(backend)||{};
      return {...user,role:'ADMIN',actualRole:'RECRUITER',recruiterScoped:true};
    };
    backend.getCurrentUser=spoof;
  }
  try{
    if(typeof window.renderModule==='function')window.renderModule(recruiterModel(),['users',targetLabel]);
  }finally{
    if(backend&&spoof&&backend.getCurrentUser===spoof)backend.getCurrentUser=original;
  }
}
function openConnectedDirectory(button){
  const token=++openToken;
  markActive(button);
  showLoading();
  ensureAccountDirectoryRuntime();
  let attempt=0;
  const run=()=>{
    if(token!==openToken||!isRecruiter())return;
    attempt+=1;
    invokeWithTemporaryAdmin();
    setTimeout(()=>{
      if(token!==openToken)return;
      if(document.querySelector('.adp-root'))return;
      showLoading();
      ensureAccountDirectoryRuntime();
      if(attempt<40)setTimeout(run,75);
      else{
        const content=document.querySelector('#content');
        if(content)content.innerHTML='<section class="module-page"><div class="recruiter-route-loading" style="min-height:280px;display:grid;place-items:center;border:1px dashed #e2b9b9;border-radius:22px;background:#fffafa;color:#9b3434;font-size:12px;font-weight:800">نسخه متصل ماژول آماده نشد. لطفاً صفحه را بازخوانی کنید.</div></section>';
      }
    },20);
  };
  run();
  document.querySelector('#sidebar')?.classList.remove('open');
}

/* This listener is registered before the old directory runtimes appended by the Worker. */
window.addEventListener('click',event=>{
  if(!isRecruiter())return;
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(!button||!isUsersButton(button))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openConnectedDirectory(button);
},true);

const script=document.createElement('script');
script.src='./recruiter-server-runtime.js?v=4.0.0';
script.async=false;
script.dataset.recruiterLiveRuntime='true';
document.body.appendChild(script);
})();
