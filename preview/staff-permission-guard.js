(()=>{
'use strict';
if(window.__salamatStaffPermissionGuardV1)return;
window.__salamatStaffPermissionGuardV1=true;

const MODULE_KEY='staff';
const state={access:null,loading:null,renderWrapped:false,sidebarObserver:null};
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();

function clearOldSnapshots(){
  try{
    for(let index=sessionStorage.length-1;index>=0;index-=1){
      const key=sessionStorage.key(index);
      if(key&&key.startsWith('salamatAccessSnapshotV2:'))sessionStorage.removeItem(key);
    }
  }catch{}
}
clearOldSnapshots();

function staffModules(){
  return (state.access?.allModules||[]).filter(module=>module.panel==='STAFF');
}
function visibleModules(){
  return staffModules().filter(module=>Boolean(module.actions?.view));
}
function moduleForLabel(value){
  const label=normalize(value);
  return staffModules().find(module=>{
    const expected=normalize(module.label);
    return label===expected||label.includes(expected);
  })||null;
}
function canViewModule(module){return Boolean(module?.actions?.view)}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}

async function fetchAccess(force=false){
  if(state.loading&&!force)return state.loading;
  state.loading=fetch('/api/access/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})
    .then(async response=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||'دریافت دسترسی انجام نشد.');
      state.access=payload.data||null;
      enforceAll();
      return state.access;
    })
    .catch(error=>{if(!String(error?.message||'').includes('وارد حساب'))console.error('Strict access load failed',error);return null})
    .finally(()=>{state.loading=null});
  return state.loading;
}

function filterNavigationModel(model){
  if(!state.access||state.access.panel!=='STAFF'||!Array.isArray(model?.nav))return model;
  const allowed=new Set(visibleModules().map(module=>normalize(module.label)));
  return {...model,nav:model.nav.filter(item=>allowed.has(normalize(Array.isArray(item)?item[1]:item)))};
}

function installRenderGuard(){
  if(state.renderWrapped)return true;
  const current=window.renderNav;
  if(typeof current!=='function')return false;
  if(current.__salamatStrictModuleGuard){state.renderWrapped=true;return true}
  const wrapped=function(model){
    const result=current.call(this,filterNavigationModel(model));
    queueMicrotask(enforceNavigation);
    return result;
  };
  wrapped.__salamatStrictModuleGuard=true;
  wrapped.__base=current;
  window.renderNav=wrapped;
  state.renderWrapped=true;
  return true;
}

function enforceNavigation(){
  if(!state.access||state.access.panel!=='STAFF')return;
  const nav=document.querySelector('#sidebarNav');
  if(!nav)return;
  nav.querySelectorAll('.nav-item,button').forEach(button=>{
    const module=moduleForLabel(button.textContent);
    if(!module||!canViewModule(module)){
      button.remove();
      return;
    }
    button.dataset.staffModuleKey=module.key;
  });
}

function enforceDashboard(){
  if(!state.access||state.access.panel!=='STAFF')return;
  document.querySelectorAll('[data-spx-open]').forEach(button=>{
    const module=staffModules().find(item=>item.key===button.dataset.spxOpen);
    if(!module||!canViewModule(module))button.remove();
  });
}

function unlockAccountIdentifier(target=document){
  target.querySelectorAll?.('#spxAccountForm input[name="username"],#spxAccountForm input[name="email"]').forEach(input=>{
    input.readOnly=false;
    input.removeAttribute('readonly');
    input.autocomplete='username';
  });
}

function enforceAll(){
  installRenderGuard();
  enforceNavigation();
  enforceDashboard();
  unlockAccountIdentifier();
}

function observeSidebar(){
  const nav=document.querySelector('#sidebarNav');
  if(!nav||state.sidebarObserver)return Boolean(nav);
  state.sidebarObserver=new MutationObserver(()=>enforceNavigation());
  state.sidebarObserver.observe(nav,{childList:true,subtree:false});
  enforceNavigation();
  return true;
}

let attempts=0;
function waitForShell(){
  attempts+=1;
  installRenderGuard();
  const ready=observeSidebar();
  if(ready||attempts>=240)return;
  requestAnimationFrame(waitForShell);
}
requestAnimationFrame(waitForShell);

window.addEventListener('click',event=>{
  if(!state.access||state.access.panel!=='STAFF')return;
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button,[data-spx-open]');
  if(!button)return;
  const key=button.dataset?.spxOpen||button.dataset?.staffModuleKey||'';
  const module=key
    ? staffModules().find(item=>item.key===key)
    : moduleForLabel(button.textContent);
  if(module&&canViewModule(module))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.remove();
  notify('دسترسی محدود است','این ماژول برای حساب شما فعال نشده است.');
},true);

for(const eventName of ['pointerdown','focusin']){
  document.addEventListener(eventName,event=>{
    const input=event.target?.closest?.('#spxAccountForm input[name="username"],#spxAccountForm input[name="email"]');
    if(input){input.readOnly=false;input.removeAttribute('readonly')}
  },true);
}

document.addEventListener('submit',event=>{
  if(event.target?.id==='spxAccountForm')unlockAccountIdentifier(event.target);
},true);
window.addEventListener('salamat-authenticated',()=>void fetchAccess(true));
window.addEventListener('pageshow',()=>void fetchAccess(true));
window.addEventListener('salamat-access-changed',()=>void fetchAccess(true));

window.SalamatStrictModuleGuard={
  refresh:()=>fetchAccess(true),
  enforce:enforceAll,
  can:(moduleKey,action='view')=>Boolean(staffModules().find(module=>module.key===moduleKey)?.actions?.[action]),
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void fetchAccess(true),{once:true});
else void fetchAccess(true);
})();
