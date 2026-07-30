(()=>{
'use strict';
const HIDDEN_LABEL='تأیید دسترسی کاربران';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
function stripFromModel(){
 try{
  if(window.roles?.admin?.nav)window.roles.admin.nav=window.roles.admin.nav.filter(item=>String(item?.[1]||'').trim()!==HIDDEN_LABEL);
 }catch{}
}
function stripFromSidebar(){
 $$('#sidebarNav .nav-item').forEach(button=>{if(String(button.textContent||'').includes(HIDDEN_LABEL))button.remove()});
}
function redirectHiddenRoute(){
 if(String($('#pageTitle')?.textContent||'').trim()!==HIDDEN_LABEL)return;
 try{window.renderDashboard?.(window.roles?.admin)}catch{}
}
function install(){
 if(window.__userApprovalModuleHidden)return true;
 if(typeof window.renderNav!=='function'||typeof window.renderModule!=='function'||!window.roles?.admin)return false;
 window.__userApprovalModuleHidden=true;
 stripFromModel();
 const previousRenderNav=window.renderNav;
 window.renderNav=function(roleModel){stripFromModel();const result=previousRenderNav.apply(this,arguments);stripFromSidebar();return result};
 const previousRenderModule=window.renderModule;
 window.renderModule=function(roleModel,module){
  const label=String(module?.[1]||'').trim();
  if(label===HIDDEN_LABEL){stripFromModel();return window.renderDashboard?.(window.roles.admin)}
  return previousRenderModule.apply(this,arguments);
 };
 const nav=$('#sidebarNav');
 if(nav)new MutationObserver(stripFromSidebar).observe(nav,{childList:true,subtree:true});
 const content=$('#content');
 if(content)new MutationObserver(redirectHiddenRoute).observe(content,{childList:true,subtree:true});
 stripFromSidebar();redirectHiddenRoute();
 return true;
}
let attempts=0;const timer=setInterval(()=>{attempts+=1;if(install()||attempts>120)clearInterval(timer)},50);
})();
