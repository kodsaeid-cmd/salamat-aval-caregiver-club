(()=>{
'use strict';
if(window.__salamatCaregiverTrainingRouteOwnerV3)return;
window.__salamatCaregiverTrainingRouteOwnerV3=true;

const VERSION='3.0.0';
const RUNTIME_VERSION='3.0.0';
const FILE='caregiver-training-direct-v3.js';
let opening=null;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
function caregiverActive(){
 const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;
 const role=String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatAccessControl?.access?.user?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase();
 return role==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب');
}
function buttonKey(button){return button?.dataset?.caregiverModuleKey||button?.dataset?.accessModule||((button?.textContent||'').includes('آموزش')?'caregiver.training':'')}
function setActive(button){
 $$('#sidebarNav .nav-item,#sidebarNav>button').forEach(item=>item.classList.toggle('active',item===button||buttonKey(item)==='caregiver.training'));
 $('#sidebar')?.classList.remove('open');window.SalamatMobileShell?.close?.({restoreFocus:false});
}
function ready(){return window.SalamatCaregiverTrainingV3?.version===RUNTIME_VERSION&&typeof window.SalamatCaregiverTrainingV3?.open==='function'}
function load(){
 if(ready())return Promise.resolve(window.SalamatCaregiverTrainingV3);
 return new Promise((resolve,reject)=>{
  const existing=[...document.scripts].find(script=>String(script.src||'').includes(`/${FILE}`));
  if(existing){
   const deadline=Date.now()+5000;const wait=()=>{if(ready())resolve(window.SalamatCaregiverTrainingV3);else if(Date.now()>deadline)reject(new Error('ماژول مشاهده آموزش آماده نشد.'));else setTimeout(wait,60)};wait();return;
  }
  const script=document.createElement('script');script.src=`./${FILE}?v=${RUNTIME_VERSION}&ts=${Date.now()}`;script.async=true;
  script.onload=()=>ready()?resolve(window.SalamatCaregiverTrainingV3):reject(new Error('نسخه جدید آموزش فعال نشد.'));
  script.onerror=()=>reject(new Error('فایل مشاهده آموزش دریافت نشد.'));
  document.head.appendChild(script);
 });
}
async function open(button=null){
 if(button)setActive(button);if(opening)return opening;
 opening=load().then(runtime=>runtime.open()).then(()=>{window.dispatchEvent(new CustomEvent('salamat-module-opened',{detail:{key:'caregiver.training',title:'بانک آموزش',ownerVersion:VERSION}}));window.SalamatMobileApp?.sync?.();return true}).catch(error=>{const content=$('#content');if($('#pageTitle'))$('#pageTitle').textContent='بانک آموزش';if($('#pageSubtitle'))$('#pageSubtitle').textContent='خطا در بازکردن آموزش';if(content)content.innerHTML=`<section class="module-page"><div style="padding:24px;border:1px solid #efcfd5;border-radius:18px;background:#fff8f8;color:#9b3244;text-align:center"><strong>مشاهده آموزش باز نشد</strong><p>${String(error.message||error).replace(/[&<>]/g,'')}</p><button type="button" data-training-owner-retry style="border:0;border-radius:10px;padding:10px 14px;background:#078848;color:#fff">تلاش دوباره</button></div></section>`;return false}).finally(()=>{opening=null});
 return opening;
}
function capture(event){
 const retry=event.target?.closest?.('[data-training-owner-retry]');if(retry){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void open();return}
 if(!caregiverActive())return;
 const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');if(!button||buttonKey(button)!=='caregiver.training')return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void open(button);
}
window.addEventListener('click',capture,true);
window.SalamatCaregiverTrainingRouteOwner={version:VERSION,runtimeVersion:RUNTIME_VERSION,open:()=>open(),owner:'window-capture'};
window.dispatchEvent(new CustomEvent('salamat-caregiver-training-route-owner-ready',{detail:{version:VERSION,runtimeVersion:RUNTIME_VERSION}}));
})();
