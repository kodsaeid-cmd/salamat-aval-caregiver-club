(()=>{
'use strict';
if(window.__salamatStaffFinancialCreditsRouteOwnerV3)return;
window.__salamatStaffFinancialCreditsRouteOwnerV3=true;

// A stale v1 asset used to wrap renderModule and claim the same global.
// Set its guard before body scripts are parsed so it can never install again.
window.__salamatStaffFinancialCreditsRuntimeV1=true;

const VERSION='3.1.0';
const RUNTIME_VERSION='3.0.0';
const ASSET_VERSION='3.1.0';
const FILE='staff-financial-credits-runtime-v2.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const clean=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();
const state={opening:null,active:false,repairTimer:0,observer:null};

function buttonKey(button){
 return button?.dataset?.panelModuleKey
  ||button?.dataset?.accessModule
  ||(clean(button?.textContent)==='اعتبارات مالی'?'staff.financial_credits':'');
}
function canonical(){return window.SalamatFinancialCredits?.version===RUNTIME_VERSION&&typeof window.SalamatFinancialCredits?.open==='function'}
function setActive(button){
 state.active=true;
 $$('#sidebarNav .nav-item,#sidebarNav>button').forEach(item=>item.classList.toggle('active',item===button||buttonKey(item)==='staff.financial_credits'));
 $('#sidebar')?.classList.remove('open');
}
function setLoading(){
 if($('#pageTitle'))$('#pageTitle').textContent='اعتبارات مالی';
 if($('#pageSubtitle'))$('#pageSubtitle').textContent='مرکز مبادلات مالی، کیف پول، تسویه و اعتبار مراقبین';
 if($('#content'))$('#content').innerHTML='<section class="module-page"><div data-finance-owner-loading style="padding:44px;text-align:center;border:1px dashed #ceded6;border-radius:18px;background:#fbfdfc;color:#6f7f77">در حال دریافت مرکز مبادلات مالی...</div></section>';
}
function showError(error){
 const message=String(error?.message||'ماژول اعتبارات مالی بارگذاری نشد.').replace(/[&<>]/g,'');
 if($('#pageTitle'))$('#pageTitle').textContent='اعتبارات مالی';
 if($('#pageSubtitle'))$('#pageSubtitle').textContent='خطا در بارگذاری ماژول';
 if($('#content'))$('#content').innerHTML=`<section class="module-page"><div style="padding:24px;border:1px solid #f0c8ce;border-radius:16px;background:#fff4f6;color:#a7273b"><strong>مرکز مبادلات مالی باز نشد</strong><p style="margin:8px 0 0">${message}</p><button type="button" data-finance-owner-retry style="margin-top:12px;border:0;border-radius:10px;padding:10px 14px;background:#078848;color:#fff;cursor:pointer">تلاش دوباره</button></div></section>`;
}
function removeStaleRuntime(){
 if(canonical())return;
 if(window.SalamatFinancialCredits&&window.SalamatFinancialCredits.version!==RUNTIME_VERSION){
  try{delete window.SalamatFinancialCredits}catch{window.SalamatFinancialCredits=undefined}
 }
 for(const script of [...document.scripts]){
  if(String(script.src||'').includes(`/${FILE}`)&&!script.dataset.financeCanonicalV31)script.remove();
 }
 try{delete window.__salamatStaffFinancialCreditsRuntimeV2}catch{window.__salamatStaffFinancialCreditsRuntimeV2=false}
}
function loadRuntime(){
 if(canonical())return Promise.resolve(window.SalamatFinancialCredits);
 removeStaleRuntime();
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=`./${FILE}?v=${ASSET_VERSION}&owner=${VERSION}&ts=${Date.now()}`;
  script.async=true;script.dataset.financeCanonicalV31='true';
  script.onload=()=>{
   const deadline=Date.now()+5000;
   const wait=()=>{
    if(canonical())return resolve(window.SalamatFinancialCredits);
    if(Date.now()>=deadline)return reject(new Error('Runtime نسخه جدید اعتبارات مالی فعال نشد.'));
    setTimeout(wait,50);
   };wait();
  };
  script.onerror=()=>reject(new Error('فایل نسخه جدید اعتبارات مالی دریافت نشد.'));
  (document.head||document.documentElement).appendChild(script);
 });
}
async function open(button=null){
 if(button)setActive(button);else state.active=true;
 if(state.opening)return state.opening;
 setLoading();
 state.opening=(async()=>{
  const runtime=canonical()?window.SalamatFinancialCredits:await loadRuntime();
  await Promise.resolve(runtime.open());
  const root=$('#content .fch-root[data-finance-hub-version="3.0.0"]');
  if(!root)throw new Error('نمای جدید مرکز مبادلات مالی ساخته نشد.');
  window.dispatchEvent(new CustomEvent('salamat-module-opened',{detail:{key:'staff.financial_credits',title:'اعتبارات مالی',ownerVersion:VERSION,runtimeVersion:RUNTIME_VERSION}}));
  return true;
 })().catch(error=>{showError(error);try{window.toast?.('بارگذاری اعتبارات مالی انجام نشد',error.message)}catch{};return false}).finally(()=>{state.opening=null});
 return state.opening;
}
function routeActive(){
 const active=$$('#sidebarNav .nav-item.active,#sidebarNav>button.active').some(button=>buttonKey(button)==='staff.financial_credits');
 return state.active&&(active||clean($('#pageTitle')?.textContent)==='اعتبارات مالی');
}
function scheduleRepair(){
 clearTimeout(state.repairTimer);
 state.repairTimer=setTimeout(()=>{
  if(!routeActive()||state.opening)return;
  if($('#content .fch-root[data-finance-hub-version="3.0.0"],#content [data-finance-owner-loading]'))return;
  void open();
 },80);
}
function observe(){
 const content=$('#content');if(!content||state.observer)return;
 state.observer=new MutationObserver(scheduleRepair);
 state.observer.observe(content,{childList:true,subtree:true});
}
function capture(event){
 const retry=event.target?.closest?.('[data-finance-owner-retry]');
 if(retry){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void open();return}
 const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');
 if(!button||buttonKey(button)!=='staff.financial_credits')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 void open(button);
}
function release(event){
 const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');
 if(button&&buttonKey(button)!=='staff.financial_credits')state.active=false;
}

window.addEventListener('click',capture,true);
document.addEventListener('click',release,false);
window.addEventListener('salamat-shell-ready',observe);
window.addEventListener('pageshow',observe);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.SalamatFinancialCreditsRouteOwner={version:VERSION,runtimeVersion:RUNTIME_VERSION,open:()=>open(),repair:scheduleRepair,owner:'window-capture'};
window.dispatchEvent(new CustomEvent('salamat-financial-route-owner-ready',{detail:{version:VERSION,runtimeVersion:RUNTIME_VERSION,owner:'window-capture'}}));
})();
