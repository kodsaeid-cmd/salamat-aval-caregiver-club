(()=>{
'use strict';

if(window.__salamatRecruiterServerRuntimeV1)return;
window.__salamatRecruiterServerRuntimeV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||null}
function isRecruiter(){return String(currentUser()?.role||'').toUpperCase()==='RECRUITER'}
function labelOf(value){return String(Array.isArray(value)?value[1]:value||'').replace(/\s+/g,' ').trim()}

function recruiterRole(){
  try{return typeof roles!=='undefined'?roles.recruiter:window.roles?.recruiter||null}catch{return window.roles?.recruiter||null}
}

function configureRecruiterRole(){
  const role=recruiterRole();
  if(!role)return;
  role.title='پنل کارشناس جذب';
  role.subtitle='ایجاد حساب مراقب، مدیریت پرونده و ارزیابی حرفه‌ای متصل به دیتابیس';
  role.heroTitle='میزکار جذب و ارزیابی مراقبین';
  role.heroText='حساب‌ها، پرونده‌ها و امتیازهای حرفه‌ای را مستقیماً روی پرونده اصلی هر مراقب مدیریت کنید.';
  role.scoreLabel='پرونده‌های جذب و ارزیابی';
  role.nav=[
    ['home','داشبورد'],
    ['users','کاربران و دسترسی‌ها'],
    ['caregiver','پرونده مراقبین'],
    ['chart','ارزیابی و پروانه'],
  ];
  role.modules=[
    ['userplus','green','ایجاد حساب مراقب','ساخت حساب ورود و پرونده حرفه‌ای متصل'],
    ['caregiver','blue','مدیریت پرونده مراقبین','ویرایش اطلاعات، وضعیت و تصویر پروفایل'],
    ['chart','purple','ارزیابی و امتیازدهی','اجرای کامل نظام هشت شاخص و ثبت در کارنامه'],
  ];
}

function mappedLabel(raw){
  const label=labelOf(raw);
  if(!label)return '';
  if([
    'کاربران و دسترسی‌ها','کاربران و دسترسی ها','مدیریت کاربران','مدیریت حساب',
    'ایجاد حساب','ایجاد حساب مراقب','ایجاد مراقب','ایجاد پروفایل مراقب',
  ].some(value=>label===value||label.includes(value)))return 'کاربران و دسترسی‌ها';
  if([
    'پرونده مراقبین','پرونده حرفه‌ای مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین',
    'مدیریت پرونده مراقبین',
  ].some(value=>label===value||label.includes(value)))return 'پرونده مراقبین';
  if([
    'ارزیابی و پروانه','میزکار ارزیابی','پایش و امتیازات','ارزیابی و امتیازدهی',
    'مشاهده کارنامه مراقب','کارنامه و امتیازات',
  ].some(value=>label===value||label.includes(value)))return 'ارزیابی و پروانه';
  return '';
}

function withAdminFrontend(callback){
  const backend=window.SalamatBackend;
  const original=backend?.getCurrentUser;
  const actual=typeof original==='function'?original.call(backend):null;
  if(!backend||typeof original!=='function'||String(actual?.role||'').toUpperCase()!=='RECRUITER')return callback();
  backend.getCurrentUser=function(){
    const user=original.call(backend)||actual;
    return user?{...user,role:'ADMIN',actualRole:'RECRUITER',recruiterScoped:true}:user;
  };
  try{return callback()}finally{backend.getCurrentUser=original}
}

function installRouter(){
  const current=window.renderModule;
  if(typeof current!=='function'||current.__salamatRecruiterServerV1)return;
  const wrapped=function(...args){
    if(!isRecruiter())return current.apply(this,args);
    const target=mappedLabel(args[1]);
    if(!target)return current.apply(this,args);
    const next=[...args];
    const icon=Array.isArray(args[1])?args[1][0]:'activity';
    next[1]=[icon,target];
    return withAdminFrontend(()=>current.apply(this,next));
  };
  wrapped.__salamatRecruiterServerV1=true;
  window.renderModule=wrapped;
  try{renderModule=wrapped}catch{}
}

function openServerModule(target,button){
  if(!target)return;
  $$('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',item===button));
  const role=recruiterRole()||{};
  withAdminFrontend(()=>window.renderModule?.(role,['activity',target]));
  $('#sidebar')?.classList.remove('open');
}

function captureNavigation(event){
  if(!isRecruiter())return;
  const navButton=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(navButton){
    const target=mappedLabel(navButton.textContent);
    if(!target)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    openServerModule(target,navButton);
    return;
  }
  const moduleButton=event.target?.closest?.('.module-open[data-title]');
  if(moduleButton){
    const target=mappedLabel(moduleButton.dataset.title);
    if(!target)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    openServerModule(target,null);
  }
}

function scopeCreateAccountModal(){
  if(!isRecruiter())return;
  const select=$('#adpCreateRole');
  if(select&&!select.dataset.recruiterScoped){
    select.dataset.recruiterScoped='1';
    [...select.options].forEach(option=>{if(String(option.value).toUpperCase()!=='CAREGIVER')option.remove()});
    select.value='CAREGIVER';
    const label=select.closest('label');
    if(label){
      const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
      if(textNode)textNode.textContent='نقش حساب ';
    }
  }
  const permissions=$('.adp-permissions');
  if(permissions&&!permissions.dataset.recruiterHidden){
    permissions.dataset.recruiterHidden='1';
    permissions.hidden=true;
    const title=permissions.previousElementSibling;
    if(title?.classList.contains('adp-section-title'))title.hidden=true;
  }
  const modalTitle=$('.adp-modal-head h3');
  const modalSubtitle=$('.adp-modal-head p');
  if(modalTitle&&String(modalTitle.textContent||'').includes('ایجاد حساب'))modalTitle.textContent='ایجاد حساب مراقب جدید';
  if(modalSubtitle&&$('#adpCreateForm'))modalSubtitle.textContent='حساب ورود و پرونده حرفه‌ای مراقب هم‌زمان و مستقیماً در دیتابیس ساخته می‌شوند.';
}

function inspect(){
  configureRecruiterRole();
  scopeCreateAccountModal();
}

function boot(){
  configureRecruiterRole();
  installRouter();
  document.addEventListener('click',captureNavigation,true);
  new MutationObserver(()=>setTimeout(inspect,10)).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('salamat-server-directory-refresh',inspect);
  inspect();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
