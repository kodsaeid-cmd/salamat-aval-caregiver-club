(()=>{
'use strict';
if(window.__salamatStaffRoleBridgeV2)return;
window.__salamatStaffRoleBridgeV2=true;

const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
const ROLE_LABELS={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
let backendValue;
let attempts=0;

function roleOf(user){return String(user?.actualRole||user?.role||'').trim().toUpperCase()}
function staffUiUser(user){
  if(!user||typeof user!=='object')return user;
  const actualRole=roleOf(user);
  if(!STAFF_ROLES.has(actualRole)||actualRole==='ADMIN')return user;
  return {
    ...user,
    role:'ADMIN',
    actualRole,
    actualRoleLabel:user.roleLabel||ROLE_LABELS[actualRole]||actualRole,
    roleLabel:user.roleLabel||ROLE_LABELS[actualRole]||actualRole,
    staffShell:true,
  };
}
function notifyAuthenticated(user){
  const actualRole=roleOf(user);
  if(!STAFF_ROLES.has(actualRole))return;
  queueMicrotask(()=>{
    window.dispatchEvent(new CustomEvent('salamat-authenticated',{detail:{...user,role:actualRole,actualRole}}));
    Promise.resolve(window.SalamatAccessControl?.reload?.()).catch(()=>{});
  });
}
function wrapBackend(backend){
  if(!backend||typeof backend!=='object')return backend;
  const enter=backend.enterApp;
  if(typeof enter==='function'&&!enter.__salamatUnifiedStaffShellV2){
    const original=enter.bind(backend);
    const wrapped=async function(user,...args){
      const actualRole=roleOf(user);
      if(STAFF_ROLES.has(actualRole))window.__salamatAuthenticatedStaffUser={...user,actualRole};
      const result=await original(staffUiUser(user),...args);
      notifyAuthenticated(user);
      return result;
    };
    wrapped.__salamatUnifiedStaffShellV2=true;
    wrapped.__originalEnterApp=original;
    backend.enterApp=wrapped;
  }
  return backend;
}
function installBackendTrap(){
  try{
    const descriptor=Object.getOwnPropertyDescriptor(window,'SalamatBackend');
    if(descriptor&&!descriptor.configurable){wrapBackend(window.SalamatBackend);return}
    backendValue=wrapBackend(window.SalamatBackend);
    Object.defineProperty(window,'SalamatBackend',{
      configurable:true,
      enumerable:true,
      get(){return backendValue},
      set(value){backendValue=wrapBackend(value)},
    });
  }catch{wrapBackend(window.SalamatBackend)}
}
function exposeLegacyAdminRenderer(){
  attempts+=1;
  try{
    if(!window.roles&&typeof roles!=='undefined')window.roles=roles;
    if(!window.renderNav&&typeof renderNav==='function')window.renderNav=renderNav;
    if(!window.renderModule&&typeof renderModule==='function')window.renderModule=renderModule;
    if(!window.renderDashboard&&typeof renderDashboard==='function')window.renderDashboard=renderDashboard;
    if(!window.hydrateIcons&&typeof hydrateIcons==='function')window.hydrateIcons=hydrateIcons;
    wrapBackend(window.SalamatBackend);
  }catch{}
  if((!window.roles?.admin||!window.renderNav||!window.SalamatBackend?.enterApp)&&attempts<180)requestAnimationFrame(exposeLegacyAdminRenderer);
}

installBackendTrap();
requestAnimationFrame(exposeLegacyAdminRenderer);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',exposeLegacyAdminRenderer,{once:true});
else exposeLegacyAdminRenderer();
})();
