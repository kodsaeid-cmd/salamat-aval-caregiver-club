(()=>{
'use strict';

const HIDDEN_ADMIN_MODULE='تأیید دسترسی کاربران';

function removeLegacyHints(){
 document.querySelectorAll('.ap-policy-list div').forEach(item=>{
  if(/admin\s*[\/:،-]\s*admin/i.test(item.textContent||''))item.remove();
 });
 document.querySelector('#adminCredentialNote')?.remove();
}

function stripHiddenAdminModule(){
 try{
  if(window.roles?.admin?.nav)window.roles.admin.nav=window.roles.admin.nav.filter(item=>String(item?.[1]||'').trim()!==HIDDEN_ADMIN_MODULE);
 }catch{}
 document.querySelectorAll('#sidebarNav .nav-item').forEach(button=>{
  if(String(button.textContent||'').includes(HIDDEN_ADMIN_MODULE))button.remove();
 });
}

function installHiddenAdminModuleGuard(){
 if(window.__hiddenUserApprovalModuleInstalled)return true;
 if(!window.__accessProfilePatched||typeof window.renderNav!=='function'||typeof window.renderModule!=='function'||!window.roles?.admin)return false;
 window.__hiddenUserApprovalModuleInstalled=true;
 stripHiddenAdminModule();
 const previousRenderNav=window.renderNav;
 window.renderNav=function(roleModel){
  stripHiddenAdminModule();
  const result=previousRenderNav.apply(this,arguments);
  stripHiddenAdminModule();
  return result;
 };
 const previousRenderModule=window.renderModule;
 window.renderModule=function(roleModel,module){
  if(String(module?.[1]||'').trim()===HIDDEN_ADMIN_MODULE){
   stripHiddenAdminModule();
   return window.renderDashboard?.(window.roles.admin);
  }
  return previousRenderModule.apply(this,arguments);
 };
 const nav=document.querySelector('#sidebarNav');
 if(nav)new MutationObserver(stripHiddenAdminModule).observe(nav,{childList:true,subtree:true});
 return true;
}

function boot(){
 removeLegacyHints();
 stripHiddenAdminModule();
 const content=document.querySelector('#content');
 if(content)new MutationObserver(()=>{removeLegacyHints();stripHiddenAdminModule()}).observe(content,{childList:true,subtree:true});
 let attempts=0;
 const timer=setInterval(()=>{
  attempts+=1;
  if(installHiddenAdminModuleGuard()||attempts>200)clearInterval(timer);
 },50);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
