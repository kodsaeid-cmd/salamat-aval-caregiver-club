(()=>{
'use strict';
if(window.__salamatStaffRoleBridgeV1)return;
window.__salamatStaffRoleBridgeV1=true;
let attempts=0;
function expose(){
  attempts+=1;
  try{
    if(!window.roles&&typeof roles!=='undefined')window.roles=roles;
    if(!window.renderNav&&typeof renderNav==='function')window.renderNav=renderNav;
    if(!window.renderModule&&typeof renderModule==='function')window.renderModule=renderModule;
    if(!window.renderDashboard&&typeof renderDashboard==='function')window.renderDashboard=renderDashboard;
    if(!window.hydrateIcons&&typeof hydrateIcons==='function')window.hydrateIcons=hydrateIcons;
  }catch{}
  if((!window.roles?.admin||!window.renderNav)&&attempts<120)requestAnimationFrame(expose);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',expose,{once:true});else expose();
})();
