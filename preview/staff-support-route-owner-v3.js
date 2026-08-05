(()=>{
'use strict';
if(window.__salamatStaffSupportRouteOwnerV3)return;
window.__salamatStaffSupportRouteOwnerV3=true;
window.__salamatStaffSupportRuntimeV1=true;
window.__salamatStaffSupportDirectRuntimeV2=true;

const VERSION='3.0.0';
const FILE='staff-support-direct-runtime-v3.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const clean=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();
const state={active:false,opening:null,repairTimer:0,observer:null};

function buttonKey(button){
 return button?.dataset?.panelModuleKey||button?.dataset?.accessModule||(['پشتیبانی','پشتیبانی و امنیت'].includes(clean(button?.textContent))?'staff.support':'');
}
function canonical(){return window.SalamatStaffSupport?.version===VERSION&&typeof window.SalamatStaffSupport?.open==='function'}
function setLoading(){
 if($('#pageTitle'))$('#pageTitle').textContent='پشتیبانی و امنیت';
 if($('#pageSubtitle'))$('#pageSubtitle').textContent='پشتیبانی پرونده و پشتیبانی فوری و امنیتی مراقبین';
 if($('#content'))$('#content').innerHTML='<section class="module-page"><div data-support-owner-loading style="min-height:240px;display:grid;place-items:center;border:1px dashed #cfdfd7;border-radius:20px;background:#fbfdfc;color:#66786e">در حال بازکردن مرکز گفت‌وگوی پشتیبانی...</div></section>';
}
function showError(error){
 const message=String(error?.message||'مرکز پشتیبانی باز نشد.').replace(/[&<>]/g,'');
 if($('#content'))$('#content').innerHTML=`<section class="module-page"><div style="padding:24px;border:1px solid #efcbd2;border-radius:17px;background:#fff4f6;color:#a52b40"><strong>ماژول پشتیبانی بارگذاری نشد</strong><p style="margin:8px 0 0">${message}</p><button type="button" data-support-owner-retry style="margin-top:12px;border:0;border-radius:10px;padding:10px 14px;background:#078848;color:#fff;cursor:pointer">تلاش دوباره</button></div></section>`;
}
function setActive(button){
 state.active=true;
 $$('#sidebarNav .nav-item,#sidebarNav>button').forEach(item=>item.classList.toggle('active',item===button||buttonKey(item)==='staff.support'));
 $('#sidebar')?.classList.remove('open');
}
function removeStale(){
 if(canonical())return;
 if(window.SalamatStaffSupport&&window.SalamatStaffSupport.version!==VERSION){try{window.SalamatStaffSupport.deactivate?.()}catch{};try{delete window.SalamatStaffSupport}catch{window.SalamatStaffSupport=undefined}}
 for(const script of [...document.scripts]){
  const src=String(script.src||'');
  if((src.includes('/staff-support-runtime-v1.js')||src.includes('/staff-support-direct-runtime-v2.js'))&&!script.dataset.supportCanonicalV3)script.remove();
 }
}
function loadRuntime(){
 if(canonical())return Promise.resolve(window.SalamatStaffSupport);
 removeStale();
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=`./${FILE}?v=${VERSION}&owner=${VERSION}&ts=${Date.now()}`;script.async=true;script.dataset.supportCanonicalV3='true';
  script.onload=()=>{const deadline=Date.now()+5000;const wait=()=>{if(canonical())return resolve(window.SalamatStaffSupport);if(Date.now()>=deadline)return reject(new Error('Runtime نسخه جدید پشتیبانی فعال نشد.'));setTimeout(wait,50)};wait()};
  script.onerror=()=>reject(new Error('فایل نسخه جدید پشتیبانی دریافت نشد.'));
  (document.head||document.documentElement).appendChild(script);
 });
}
function requestedThread(){
 const pending=window.__salamatPendingSupportThread;delete window.__salamatPendingSupportThread;return String(pending||'');
}
async function open(button=null,threadId=''){
 if(button)setActive(button);else state.active=true;
 if(state.opening)return state.opening;
 setLoading();
 state.opening=(async()=>{const runtime=canonical()?window.SalamatStaffSupport:await loadRuntime();await Promise.resolve(runtime.open(threadId||requestedThread()));const root=$('#content .sts3-root[data-support-unity-version="3.0.0"]');if(!root)throw new Error('نمای یکپارچه پشتیبانی ساخته نشد.');window.dispatchEvent(new CustomEvent('salamat-module-opened',{detail:{key:'staff.support',title:'پشتیبانی و امنیت',ownerVersion:VERSION,runtimeVersion:VERSION}}));return true})().catch(error=>{showError(error);try{window.toast?.('پشتیبانی باز نشد',error.message)}catch{};return false}).finally(()=>{state.opening=null});
 return state.opening;
}
function routeActive(){
 const active=$$('#sidebarNav .nav-item.active,#sidebarNav>button.active').some(button=>buttonKey(button)==='staff.support');
 return state.active&&(active||clean($('#pageTitle')?.textContent).includes('پشتیبانی'));
}
function scheduleRepair(){
 clearTimeout(state.repairTimer);state.repairTimer=setTimeout(()=>{if(!routeActive()||state.opening)return;if($('#content .sts3-root[data-support-unity-version="3.0.0"],#content [data-support-owner-loading]'))return;void open()},80);
}
function observe(){const content=$('#content');if(!content||state.observer)return;state.observer=new MutationObserver(scheduleRepair);state.observer.observe(content,{childList:true,subtree:true})}
function capture(event){
 const retry=event.target?.closest?.('[data-support-owner-retry]');if(retry){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void open();return}
 const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');if(!button||buttonKey(button)!=='staff.support')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void open(button);
}
function release(event){const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');if(button&&buttonKey(button)!=='staff.support'){state.active=false;try{window.SalamatStaffSupport?.deactivate?.()}catch{}}}
function notificationOpen(event){const threadId=String(event?.detail?.threadId||'');window.__salamatPendingSupportThread=threadId;const button=$$('#sidebarNav .nav-item,#sidebarNav>button').find(item=>buttonKey(item)==='staff.support');void open(button||null,threadId)}

window.addEventListener('click',capture,true);document.addEventListener('click',release,false);window.addEventListener('salamat-open-support-thread',notificationOpen);window.addEventListener('salamat-shell-ready',observe);window.addEventListener('pageshow',observe);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.SalamatStaffSupportRouteOwner={version:VERSION,open:(threadId='')=>open(null,threadId),repair:scheduleRepair,owner:'window-capture'};
window.dispatchEvent(new CustomEvent('salamat-support-route-owner-ready',{detail:{version:VERSION,owner:'window-capture'}}));
})();
