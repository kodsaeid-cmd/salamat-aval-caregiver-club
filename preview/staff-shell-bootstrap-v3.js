(()=>{
'use strict';
if(window.__salamatStaffShellBootstrapV3)return;
window.__salamatStaffShellBootstrapV3=true;
const VERSION='1.2.0';
const root=document.documentElement;
const style=document.createElement('style');
style.id='salamatStaffShellBootstrapStylesV3';
style.textContent=`#sidebarNav.sidebar-nav{display:flex!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow-y:auto!important;overflow-x:hidden!important;flex-direction:column!important;justify-content:flex-start!important;align-content:flex-start!important;align-items:stretch!important;gap:6px!important;padding:2px 0!important;grid-template-columns:none!important;grid-template-rows:none!important;grid-auto-rows:auto!important}#sidebarNav.sidebar-nav>.nav-item,#sidebarNav.sidebar-nav>button{display:grid!important;flex:0 0 43px!important;width:100%!important;height:43px!important;min-height:43px!important;max-height:43px!important;margin:0!important;align-self:stretch!important}.sidebar{overflow-y:auto!important}.sidebar-help{margin-top:auto!important;flex:0 0 auto!important}.logout{flex:0 0 41px!important}`;
(document.head||document.documentElement).appendChild(style);
let sequence=0,access=null,revealed=false;
function compactNavigation(){const nav=document.querySelector('#sidebarNav');if(!nav)return;nav.style.setProperty('display','flex','important');nav.style.setProperty('flex-direction','column','important');nav.style.setProperty('justify-content','flex-start','important');nav.style.setProperty('align-content','flex-start','important');nav.style.setProperty('gap','6px','important')}
function reveal(reason='access-resolved'){
 compactNavigation();root.classList.remove('salamat-shell-preparing');root.classList.add('salamat-shell-ready');
 if(!revealed){revealed=true;window.dispatchEvent(new CustomEvent('salamat-shell-ready',{detail:access}))}
 window.dispatchEvent(new CustomEvent('salamat-shell-visible',{detail:{reason,version:VERSION,access}}));
}
async function loadAccess(){
 if(window.SalamatPerformance?.access){const result=await window.SalamatPerformance.access(false);return {status:result.response.status,ok:result.response.ok,data:result.data,message:result.payload?.message}}
 const response=await fetch('/api/access/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const payload=await response.json().catch(()=>({}));return {status:response.status,ok:response.ok,data:payload?.data||null,message:payload?.message}
}
async function resolveShell(){
 const token=++sequence;
 try{const result=await loadAccess();if(token!==sequence)return;if(result.status===401){access=null;reveal('anonymous');return}if(!result.ok)throw new Error(result.message||'access_failed');access=result.data||null;window.__salamatEarlyAccessSnapshot=access;reveal('access-resolved')}
 catch{if(token===sequence)reveal('access-fallback')}
}
window.addEventListener('salamat-authenticated',()=>void resolveShell());
window.addEventListener('salamat-access-changed',()=>void resolveShell());
window.addEventListener('salamat-access-ready',event=>{if(event.detail){access=event.detail;window.__salamatEarlyAccessSnapshot=access}reveal('access-ready')});
window.addEventListener('pageshow',()=>void resolveShell());
document.addEventListener('click',event=>{if(event.target?.closest?.('#logoutButton')){access=null;revealed=false;root.classList.remove('salamat-shell-ready')}},true);
compactNavigation();void resolveShell();
window.SalamatStaffShellBootstrap={version:VERSION,refresh:resolveShell,reveal,compactNavigation,get access(){return access}};
})();
