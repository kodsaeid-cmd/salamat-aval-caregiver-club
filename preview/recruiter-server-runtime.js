(()=>{
'use strict';

if(window.__salamatRecruiterServerRuntimeV3)return;
window.__salamatRecruiterServerRuntimeV3=true;
window.__salamatRecruiterServerRuntimeV2=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
let rawGetCurrentUser=null;
let routingTarget='';
let navConfigured=false;
let dashboardCache=null;
let dashboardRequestId=0;
let dashboardLoading=false;
let directoryRetryToken=0;

function actualCurrentUser(){
  const user=rawGetCurrentUser?.()||window.SalamatBackend?.getCurrentUser?.()||null;
  return user?.actualRole?{...user,role:user.actualRole}:user;
}
function isRecruiter(){return String(actualCurrentUser()?.role||'').toUpperCase()==='RECRUITER'}
function labelOf(value){return String(Array.isArray(value)?value[1]:value||'').replace(/\s+/g,' ').trim()}
function currentTitle(){return labelOf($('#pageTitle')?.textContent)}
function scopedPageVisible(){
  const title=currentTitle();
  return Boolean(routingTarget)
    || title.includes('کاربران و دسترسی')
    || title.includes('پرونده مراقبین')
    || title.includes('ارزیابی و پروانه')
    || title.includes('میزکار ارزیابی')
    || Boolean($('.adp-root,.cdp-root,.sev-root,.cpe-backdrop'));
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.detail=payload.detail;throw error}
  return payload;
}
function setPage(title,subtitle,html){
  if($('#pageTitle'))$('#pageTitle').textContent=title;
  if($('#pageSubtitle'))$('#pageSubtitle').textContent=subtitle;
  if($('#content'))$('#content').innerHTML=html;
  try{window.hydrateIcons?.($('#content'))}catch{}
}

function installCapabilityBridge(){
  const backend=window.SalamatBackend;
  if(!backend||typeof backend.getCurrentUser!=='function')return;
  if(backend.getCurrentUser.__salamatRecruiterCapabilityV3){
    rawGetCurrentUser=backend.getCurrentUser.__rawGetCurrentUser;
    return;
  }
  if(backend.getCurrentUser.__salamatRecruiterCapabilityV1){
    rawGetCurrentUser=backend.getCurrentUser.__rawGetCurrentUser;
    return;
  }
  const original=backend.getCurrentUser.bind(backend);
  rawGetCurrentUser=original;
  const wrapped=function(){
    const user=original();
    if(String(user?.role||'').toUpperCase()==='RECRUITER'&&scopedPageVisible()){
      return {...user,role:'ADMIN',actualRole:'RECRUITER',recruiterScoped:true};
    }
    return user;
  };
  wrapped.__salamatRecruiterCapabilityV3=true;
  wrapped.__salamatRecruiterCapabilityV1=true;
  wrapped.__rawGetCurrentUser=original;
  backend.getCurrentUser=wrapped;
}

function ensureRecruiterStyles(){
  if($('#recruiterRuntimeStylesV3'))return;
  const style=document.createElement('style');
  style.id='recruiterRuntimeStylesV3';
  style.textContent=`
  body.sal-recruiter-panel #sidebarNav{display:grid!important;grid-auto-flow:row!important;grid-auto-rows:44px!important;align-content:start!important;justify-content:stretch!important;flex:0 0 auto!important;min-height:0!important;height:auto!important;gap:6px!important}
  body.sal-recruiter-panel #sidebarNav .nav-item,body.sal-recruiter-panel #sidebarNav>button{height:44px!important;min-height:44px!important;max-height:44px!important;margin:0!important;align-self:stretch!important}
  body.sal-recruiter-panel .sidebar-help{margin-top:auto!important}
  .recruiter-route-loading{min-height:280px;display:grid;place-items:center;border:1px dashed #cfe0d7;border-radius:22px;background:#fbfdfc;color:#64766c;font-size:12px;font-weight:800}
  .rld-root{direction:rtl;display:grid;gap:16px}.rld-hero{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:18px;padding:24px;border:1px solid #dce9e2;border-radius:24px;background:linear-gradient(135deg,#f5fbf8,#fff)}
  .rld-hero h2{margin:8px 0;font-size:24px}.rld-hero p{margin:0;color:#697b71;line-height:1.9}.rld-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}.rld-btn{border:0;border-radius:12px;padding:11px 14px;background:#edf8f2;color:#087747;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.rld-btn.primary{background:#078848;color:#fff}.rld-score{display:grid;place-items:center;text-align:center;border-radius:20px;background:#0b8c4c;color:#fff;padding:20px}.rld-score strong{font-size:34px}.rld-score span,.rld-score small{display:block;margin-top:5px}.rld-score small{opacity:.78;font-size:9px}.rld-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.rld-metric{padding:17px;border:1px solid #dce8e2;border-radius:18px;background:#fff}.rld-metric small{display:block;color:#728079;font-size:9px}.rld-metric strong{display:block;margin-top:8px;color:#087747;font-size:22px}.rld-metric em{display:block;margin-top:5px;color:#819088;font-size:9px;font-style:normal}.rld-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:14px}.rld-panel{border:1px solid #dce8e2;border-radius:22px;background:#fff;overflow:hidden}.rld-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 18px;border-bottom:1px solid #e8efeb}.rld-head h3{margin:0;font-size:15px}.rld-head p{margin:6px 0 0;color:#7a8881;font-size:9px}.rld-list{display:grid;gap:8px;padding:14px}.rld-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid #e3ebe7;border-radius:15px;background:#fff}.rld-avatar{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:#dff3e8;color:#087747;font-weight:900}.rld-avatar img{width:100%;height:100%;object-fit:cover}.rld-row strong{display:block;font-size:11px}.rld-row small{display:block;margin-top:5px;color:#7a8881;font-size:9px}.rld-badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.rld-badge{padding:6px 9px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900}.rld-badge.warn{background:#fff1d8;color:#946000}.rld-badge.danger{background:#ffe8eb;color:#ae2638}.rld-quick{display:grid;gap:9px;padding:14px}.rld-quick button{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:center;text-align:right;border:1px solid #e2ebe6;border-radius:15px;background:#fff;padding:12px;cursor:pointer}.rld-quick button:hover{border-color:#11965a;background:#f6fbf8}.rld-quick span{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:#e6f6ed;color:#078848}.rld-quick strong{display:block;font-size:11px}.rld-quick small{display:block;margin-top:4px;color:#78867f;font-size:8px}.rld-footnote{padding:10px 14px;border-top:1px solid #edf2ef;color:#829087;font-size:8px;background:#fbfdfc}
  @media(max-width:980px){.rld-hero{grid-template-columns:1fr}.rld-score{grid-template-columns:auto 1fr;justify-content:start;text-align:right}.rld-metrics{grid-template-columns:repeat(2,1fr)}.rld-grid{grid-template-columns:1fr}}
  @media(max-width:600px){.rld-metrics{grid-template-columns:1fr}.rld-head{align-items:flex-start;flex-direction:column}.rld-row{grid-template-columns:42px minmax(0,1fr)}.rld-badges{grid-column:1/-1;justify-content:flex-start}}
  `;
  document.head.appendChild(style);
}
function applyRecruiterLayout(){ensureRecruiterStyles();document.body?.classList.toggle('sal-recruiter-panel',isRecruiter())}

function ensureProfessionalEvaluationBridge(){
  if(!isRecruiter()||window.__salamatProfessionalEvaluationBridgeV3||window.__salamatProfessionalEvaluationBridgeV2)return;
  if(document.querySelector('script[data-recruiter-professional-evaluation-bridge]'))return;
  const script=document.createElement('script');
  script.src='./professional-evaluation-bridge.js?v=3.0.0';
  script.async=false;
  script.dataset.recruiterProfessionalEvaluationBridge='true';
  document.body.appendChild(script);
}
function ensureEvaluationFinalizationRecovery(){
  if(window.__salamatEvaluationFinalizationRecoveryV1)return;
  if(document.querySelector('script[data-evaluation-finalization-recovery]'))return;
  const script=document.createElement('script');
  script.src='./evaluation-finalization-recovery.js?v=1.0.0';
  script.async=false;
  script.dataset.evaluationFinalizationRecovery='true';
  document.body.appendChild(script);
}

function recruiterRole(){try{return typeof roles!=='undefined'?roles.recruiter:window.roles?.recruiter||null}catch{return window.roles?.recruiter||null}}
function configureRecruiterRole(){
  const role=recruiterRole();
  if(!role)return;
  role.title='پنل کارشناس جذب';
  role.subtitle='داده زنده حساب‌ها، پرونده‌ها و ارزیابی مراقبین';
  role.heroTitle='میزکار جذب و ارزیابی مراقبین';
  role.heroText='این داشبورد مستقیماً از اطلاعات پرونده‌ها و حساب‌های ثبت‌شده در دیتابیس ساخته می‌شود.';
  role.scoreLabel='نرخ حساب فعال';
  role.nav=[['home','داشبورد'],['users','کاربران و دسترسی‌ها'],['caregiver','پرونده مراقبین'],['chart','ارزیابی و پروانه']];
  role.modules=[['userplus','green','ایجاد حساب مراقب','ساخت حساب ورود و پرونده حرفه‌ای متصل'],['caregiver','blue','مدیریت پرونده مراقبین','ویرایش اطلاعات، وضعیت و تصویر پروفایل'],['chart','purple','ارزیابی و امتیازدهی','اجرای نظام هشت شاخص و ثبت در کارنامه']];
}
function configureVisibleNavigation(){
  if(!isRecruiter()){navConfigured=false;return}
  const role=recruiterRole(),nav=$('#sidebarNav');
  if(!role||!nav||navConfigured)return;
  const text=labelOf(nav.textContent);
  if(text.includes('ارزیابی و پروانه')&&text.includes('کاربران و دسترسی')){navConfigured=true;return}
  if(typeof window.renderNav==='function'){window.renderNav(role);navConfigured=true}
}

function mappedLabel(raw){
  const label=labelOf(raw);
  if(!label)return '';
  if(label==='داشبورد'||label.includes('داشبورد'))return 'داشبورد';
  if(['کاربران و دسترسی‌ها','کاربران و دسترسی ها','مدیریت کاربران','مدیریت حساب','ایجاد حساب','ایجاد حساب مراقب','ایجاد مراقب','ایجاد پروفایل مراقب'].some(value=>label===value||label.includes(value)))return 'کاربران و دسترسی‌ها';
  if(['پرونده مراقبین','پرونده حرفه‌ای مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین','مدیریت پرونده مراقبین'].some(value=>label===value||label.includes(value)))return 'پرونده مراقبین';
  if(['ارزیابی و پروانه','میزکار ارزیابی','پایش و امتیازات','ارزیابی و امتیازدهی','مشاهده کارنامه مراقب','کارنامه و امتیازات'].some(value=>label===value||label.includes(value)))return 'ارزیابی و پروانه';
  return '';
}
function withRecruiterCapability(target,callback){const previous=routingTarget;routingTarget=target||previous||'recruiter-module';try{return callback()}finally{routingTarget=previous}}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function accountStatus(item){const status=String(item.status||'').toUpperCase();return status==='PENDING'?'در انتظار تأیید':status==='SUSPENDED'?'تعلیق‌شده':status==='INACTIVE'?'غیرفعال':'فعال'}
function statusTone(item){const status=String(item.status||'').toUpperCase();return status==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(status)?'danger':''}
function dashboardVisible(){const active=labelOf($('#sidebarNav .nav-item.active,#sidebarNav button.active')?.textContent);return isRecruiter()&&(active==='داشبورد'||currentTitle()==='پنل کارشناس جذب'||Boolean($('.rld-root')))}
function setActiveNav(target,button=null){$$('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',button?item===button:mappedLabel(item.textContent)===target))}

async function loadDashboardData(force=false){
  if(!force&&dashboardCache&&dashboardCache.expiresAt>Date.now())return dashboardCache.data;
  const payload=await api('/api/admin/directory?page=1&includeCounts=1');
  const data=payload?.data||{};
  dashboardCache={data,expiresAt:Date.now()+30000};
  return data;
}
function dashboardRows(accounts){
  const items=[...accounts].sort((a,b)=>{
    const priority=item=>String(item.status||'').toUpperCase()==='PENDING'?0:!item.caregiverId?1:item.professionalScore==null?2:3;
    return priority(a)-priority(b);
  }).slice(0,7);
  if(!items.length)return '<div class="recruiter-route-loading">هنوز حساب مراقبی در دیتابیس ثبت نشده است.</div>';
  return items.map(item=>`<div class="rld-row">${item.avatarUrl?`<span class="rld-avatar"><img src="${esc(item.avatarUrl)}?v=${encodeURIComponent(item.avatarId||item.createdAt||'1')}" alt="${esc(item.fullName)}"></span>`:`<span class="rld-avatar">${esc(initials(item.caregiverFullName||item.fullName))}</span>`}<div><strong>${esc(item.caregiverFullName||item.fullName||'بدون نام')}</strong><small>${esc(item.membershipCode||'بدون شماره پرونده')} • ${esc(item.caregiverMobile||item.mobile||'شماره ثبت نشده')}</small></div><div class="rld-badges"><span class="rld-badge ${statusTone(item)}">${esc(accountStatus(item))}</span><span class="rld-badge">${item.professionalScore==null?'فاقد ارزیابی نهایی':`${fa(item.professionalScore)} امتیاز`}</span></div></div>`).join('');
}
async function renderRecruiterDashboard(force=false){
  if(!isRecruiter()||dashboardLoading)return;
  const requestId=++dashboardRequestId;
  dashboardLoading=true;
  setActiveNav('داشبورد');
  setPage('پنل کارشناس جذب','نمای زنده حساب‌ها، پرونده‌ها و ارزیابی مراقبین','<section class="recruiter-route-loading">در حال دریافت آمار واقعی از دیتابیس...</section>');
  try{
    const data=await loadDashboardData(force);
    if(requestId!==dashboardRequestId||!dashboardVisible())return;
    const counts=data.counts||{};
    const accounts=Array.isArray(data.accounts)?data.accounts:[];
    const caregiverAccounts=Number(counts.caregiverAccounts||0);
    const activeAccounts=Number(counts.activeAccounts||0);
    const activeRate=caregiverAccounts?Math.round(activeAccounts/caregiverAccounts*100):0;
    const scoredOnPage=accounts.filter(item=>item.professionalScore!==null&&item.professionalScore!==undefined).length;
    const pendingOnPage=accounts.filter(item=>String(item.status||'').toUpperCase()==='PENDING').length;
    setPage('پنل کارشناس جذب','نمای زنده حساب‌ها، پرونده‌ها و ارزیابی مراقبین',`<section class="rld-root"><article class="rld-hero"><div><span style="color:#078848;font-size:9px;font-weight:900">داده زنده باشگاه مراقبین سلامت اول</span><h2>${fa(counts.caregiverProfiles)} پرونده حرفه‌ای در دیتابیس</h2><p>اطلاعات این صفحه از همان API فهرست حساب‌ها و پرونده‌های مراقبین خوانده می‌شود و با ایجاد حساب، ویرایش پرونده یا تغییر وضعیت به‌روزرسانی خواهد شد.</p><div class="rld-actions"><button class="rld-btn primary" data-recruiter-open="کاربران و دسترسی‌ها">مدیریت حساب‌های مراقبین</button><button class="rld-btn" data-recruiter-open="ارزیابی و پروانه">شروع ارزیابی</button><button class="rld-btn" id="rldRefresh">به‌روزرسانی آمار</button></div></div><div class="rld-score"><strong>${fa(activeRate)}٪</strong><span>نرخ حساب فعال مراقبین</span><small>${fa(activeAccounts)} حساب فعال از ${fa(caregiverAccounts)} حساب</small></div></article><section class="rld-metrics"><article class="rld-metric"><small>پرونده‌های حرفه‌ای</small><strong>${fa(counts.caregiverProfiles)}</strong><em>ثبت‌شده در جدول مراقبین</em></article><article class="rld-metric"><small>حساب‌های فعال مراقبین</small><strong>${fa(activeAccounts)}</strong><em>آماده ورود به سامانه</em></article><article class="rld-metric"><small>پرونده بدون حساب ورود</small><strong>${fa(counts.profilesWithoutAccounts)}</strong><em>نیازمند ایجاد حساب</em></article><article class="rld-metric"><small>حساب بدون پرونده متصل</small><strong>${fa(counts.accountsWithoutProfiles)}</strong><em>نیازمند اتصال یا اصلاح</em></article></section><section class="rld-grid"><article class="rld-panel"><header class="rld-head"><div><h3>پرونده‌های نیازمند اقدام</h3><p>رکوردهای واقعی دریافت‌شده از دیتابیس؛ موارد در انتظار و فاقد ارزیابی در اولویت‌اند.</p></div><button class="rld-btn" data-recruiter-open="کاربران و دسترسی‌ها">مشاهده فهرست کامل</button></header><div class="rld-list">${dashboardRows(accounts)}</div><div class="rld-footnote">در صفحه نخست فهرست: ${fa(pendingOnPage)} حساب در انتظار تأیید و ${fa(scoredOnPage)} مراقب دارای امتیاز حرفه‌ای ثبت‌شده است.</div></article><article class="rld-panel"><header class="rld-head"><div><h3>عملیات اصلی</h3><p>دسترسی مستقیم به ماژول‌های متصل</p></div></header><div class="rld-quick"><button data-recruiter-open="کاربران و دسترسی‌ها"><span data-icon="userplus"></span><div><strong>ایجاد و مدیریت حساب مراقب</strong><small>ثبت حساب و پرونده در دیتابیس</small></div></button><button data-recruiter-open="پرونده مراقبین"><span data-icon="caregiver"></span><div><strong>ویرایش پرونده مراقبین</strong><small>اطلاعات، وضعیت و تصویر پروفایل</small></div></button><button data-recruiter-open="ارزیابی و پروانه"><span data-icon="chart"></span><div><strong>ارزیابی و امتیازدهی</strong><small>ثبت هشت شاخص و نتیجه در کارنامه</small></div></button></div></article></section></section>`);
    $('#rldRefresh')?.addEventListener('click',()=>{dashboardCache=null;void renderRecruiterDashboard(true)});
    $$('[data-recruiter-open]').forEach(button=>button.addEventListener('click',()=>openServerModule(button.dataset.recruiterOpen,null)));
  }catch(error){
    if(requestId===dashboardRequestId)setPage('پنل کارشناس جذب','خطا در دریافت اطلاعات',`<section class="recruiter-route-loading">دریافت آمار دیتابیس انجام نشد: ${esc(error.message||'خطای نامشخص')}</section>`);
  }finally{dashboardLoading=false}
}

function installRouter(){
  const current=window.renderModule;
  if(typeof current!=='function'||current.__salamatRecruiterServerV3)return;
  const wrapped=function(...args){
    if(!isRecruiter())return current.apply(this,args);
    const target=mappedLabel(args[1]);
    if(!target)return current.apply(this,args);
    if(target==='داشبورد'){void renderRecruiterDashboard();return}
    const next=[...args];
    const icon=Array.isArray(args[1])?args[1][0]:'activity';
    next[1]=[icon,target];
    return withRecruiterCapability(target,()=>current.apply(this,next));
  };
  wrapped.__salamatRecruiterServerV3=true;
  wrapped.__salamatRecruiterServerV2=true;
  wrapped.__originalRecruiterRender=current;
  window.renderModule=wrapped;
  try{renderModule=wrapped}catch{}
}
function showDirectoryLoading(){setPage('کاربران و دسترسی‌ها','مدیریت حساب‌ها و پرونده‌های مراقبین','<section class="recruiter-route-loading">در حال بارگذاری نسخه متصل کاربران و دسترسی‌ها...</section>')}
function invokeModule(target){
  const role=recruiterRole()||{};
  const icon=target==='پرونده مراقبین'?'caregiver':target==='ارزیابی و پروانه'?'chart':'users';
  withRecruiterCapability(target,()=>window.renderModule?.(role,[icon,target]));
}
function openDirectoryReliably(){
  const token=++directoryRetryToken;
  showDirectoryLoading();
  const delays=[0,40,120,280,600];
  delays.forEach((delay,index)=>setTimeout(()=>{
    if(token!==directoryRetryToken||!isRecruiter())return;
    if($('.adp-root'))return;
    installRouter();
    invokeModule('کاربران و دسترسی‌ها');
    if(!$('.adp-root')&&index<delays.length-1)showDirectoryLoading();
    if(index===delays.length-1&&!$('.adp-root'))notify('بارگذاری مجدد لازم است','نسخه متصل ماژول کاربران آماده نشد؛ صفحه را یک‌بار بازخوانی کنید.');
  },delay));
}
function openServerModule(target,button){
  if(!target)return;
  setActiveNav(target,button);
  if(target==='داشبورد'){void renderRecruiterDashboard();$('#sidebar')?.classList.remove('open');return}
  if(target==='کاربران و دسترسی‌ها')openDirectoryReliably();else invokeModule(target);
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
  const moduleButton=event.target?.closest?.('.module-open[data-title],[data-recruiter-open]');
  if(moduleButton){
    const target=mappedLabel(moduleButton.dataset.recruiterOpen||moduleButton.dataset.title);
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
    if(label){const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);if(textNode)textNode.textContent='نقش حساب '}
  }
  const permissions=$('.adp-permissions');
  if(permissions&&!permissions.dataset.recruiterHidden){permissions.dataset.recruiterHidden='1';permissions.hidden=true;const title=permissions.previousElementSibling;if(title?.classList.contains('adp-section-title'))title.hidden=true}
  const modalTitle=$('.adp-modal-head h3'),modalSubtitle=$('.adp-modal-head p');
  if(modalTitle&&String(modalTitle.textContent||'').includes('ایجاد حساب'))modalTitle.textContent='ایجاد حساب مراقب جدید';
  if(modalSubtitle&&$('#adpCreateForm'))modalSubtitle.textContent='حساب ورود و پرونده حرفه‌ای مراقب هم‌زمان و مستقیماً در دیتابیس ساخته می‌شوند.';
}
function shouldReplaceLegacyDashboard(){
  if(!isRecruiter()||dashboardLoading||$('.rld-root'))return false;
  const active=labelOf($('#sidebarNav .nav-item.active,#sidebarNav button.active')?.textContent);
  return active==='داشبورد'&&(currentTitle()==='پنل کارشناس جذب'||Boolean($('#content .role-hero')));
}
function inspect(){
  installCapabilityBridge();
  configureRecruiterRole();
  configureVisibleNavigation();
  applyRecruiterLayout();
  scopeCreateAccountModal();
  ensureProfessionalEvaluationBridge();
  ensureEvaluationFinalizationRecovery();
  installRouter();
  if(shouldReplaceLegacyDashboard())void renderRecruiterDashboard();
}
function invalidateDashboard(){dashboardCache=null;if(dashboardVisible())void renderRecruiterDashboard(true)}
function boot(){
  inspect();
  window.addEventListener('click',captureNavigation,true);
  new MutationObserver(()=>setTimeout(inspect,10)).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('salamat-server-directory-refresh',invalidateDashboard);
  window.addEventListener('salamat-evaluation-changed',invalidateDashboard);
  setInterval(inspect,1200);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
