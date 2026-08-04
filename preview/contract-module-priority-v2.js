(()=>{
'use strict';
if(window.__salamatContractModulePriorityV2)return;
window.__salamatContractModulePriorityV2=true;

const VERSION='2.0.0';
const ASSET_VERSION='2.4.0';
let loadPromise=null;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const clean=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();

function buttonKey(button){
  return button?.dataset?.panelModuleKey
    ||button?.dataset?.accessModule
    ||(clean(button?.textContent)==='قراردادها'?'staff.contracts':'');
}
function setActive(button){
  $$('#sidebarNav .nav-item,#sidebarNav>button').forEach(item=>item.classList.toggle('active',item===button));
  $('#sidebar')?.classList.remove('open');
}
function setLoading(){
  if($('#pageTitle'))$('#pageTitle').textContent='قراردادها';
  if($('#pageSubtitle'))$('#pageSubtitle').textContent='مدیریت قرارداد و تقویم مراقب';
  if($('#content'))$('#content').innerHTML='<section class="module-page"><div style="padding:44px;text-align:center;border:1px dashed #ceded6;border-radius:18px;background:#fbfdfc;color:#6f7f77">در حال دریافت ماژول قراردادها...</div></section>';
}
function showError(error){
  const message=error?.message||'ماژول قراردادها بارگذاری نشد.';
  if($('#pageTitle'))$('#pageTitle').textContent='قراردادها';
  if($('#pageSubtitle'))$('#pageSubtitle').textContent='خطا در بارگذاری';
  if($('#content'))$('#content').innerHTML=`<section class="module-page"><div style="padding:24px;border:1px solid #f0c8ce;border-radius:16px;background:#fff4f6;color:#a7273b"><strong>ماژول قراردادها باز نشد</strong><p style="margin:8px 0 0">${String(message).replace(/[&<>]/g,'')}</p></div></section>`;
}
function loadRuntime(){
  if(window.SalamatStaffContracts?.open)return Promise.resolve(window.SalamatStaffContracts);
  if(loadPromise)return loadPromise;
  loadPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>String(script.src||'').includes('/staff-contracts-runtime-v1.js'));
    if(existing){
      const deadline=Date.now()+10000;
      const wait=()=>{
        if(window.SalamatStaffContracts?.open)return resolve(window.SalamatStaffContracts);
        if(Date.now()>deadline)return reject(new Error('Runtime قراردادها فعال نشد.'));
        setTimeout(wait,50);
      };
      wait();
      return;
    }
    const script=document.createElement('script');
    script.src=`./staff-contracts-runtime-v1.js?v=${ASSET_VERSION}`;
    script.async=true;
    script.onload=()=>window.SalamatStaffContracts?.open
      ?resolve(window.SalamatStaffContracts)
      :reject(new Error('Runtime قراردادها پس از دریافت فعال نشد.'));
    script.onerror=()=>reject(new Error('فایل ماژول قراردادها دریافت نشد.'));
    (document.head||document.documentElement).appendChild(script);
  }).catch(error=>{loadPromise=null;throw error});
  return loadPromise;
}
async function open(button=null){
  if(button)setActive(button);
  setLoading();
  try{
    const runtime=await loadRuntime();
    await Promise.resolve(runtime.open());
    window.dispatchEvent(new CustomEvent('salamat-module-opened',{detail:{key:'staff.contracts',title:'قراردادها',ownerVersion:VERSION}}));
  }catch(error){
    showError(error);
    try{window.toast?.('بارگذاری قراردادها انجام نشد',error.message)}catch{}
  }
}
function contractCalendarAction(event){
  const action=event.target?.closest?.('[data-scc-edit],[data-scc-delete]');
  if(!action)return false;
  const id=action.dataset.sccEdit||action.dataset.sccDelete||'';
  if(!String(id).startsWith('contract:'))return false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  try{window.toast?.('برنامه قراردادی فقط‌خواندنی است','ویرایش یا حذف این برنامه از ماژول قراردادها در پنل ادمین انجام می‌شود.')}catch{}
  return true;
}
function capture(event){
  if(contractCalendarAction(event))return;
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button');
  if(!button||buttonKey(button)!=='staff.contracts')return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void open(button);
}

// Window capture runs before document/target listeners, so no legacy contract
// renderer can process the same click after this owner accepts it.
window.addEventListener('click',capture,true);
window.SalamatContractModulePriority={version:VERSION,open:()=>open(null),owner:'window-capture'};
window.dispatchEvent(new CustomEvent('salamat-contract-route-owner-ready',{detail:{version:VERSION,owner:'window-capture'}}));
})();
