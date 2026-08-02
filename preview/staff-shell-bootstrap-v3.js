(()=>{
'use strict';
if(window.__salamatStaffShellBootstrapV3)return;
window.__salamatStaffShellBootstrapV3=true;

const root=document.documentElement;
root.classList.add('salamat-shell-preparing');

const style=document.createElement('style');
style.id='salamatStaffShellBootstrapStylesV3';
style.textContent=`
html.salamat-shell-preparing #appView{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
html.salamat-shell-ready #appView{transition:opacity .14s ease}
#sidebarNav.sidebar-nav{display:flex!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow-y:auto!important;overflow-x:hidden!important;flex-direction:column!important;justify-content:flex-start!important;align-content:flex-start!important;align-items:stretch!important;gap:6px!important;padding:2px 0!important;grid-template-columns:none!important;grid-template-rows:none!important;grid-auto-rows:auto!important}
#sidebarNav.sidebar-nav>.nav-item,#sidebarNav.sidebar-nav>button{display:grid!important;flex:0 0 43px!important;width:100%!important;height:43px!important;min-height:43px!important;max-height:43px!important;margin:0!important;align-self:stretch!important}
.sidebar{overflow-y:auto!important}.sidebar-help{margin-top:auto!important;flex:0 0 auto!important}.logout{flex:0 0 41px!important}
`;
(document.head||document.documentElement).appendChild(style);

let sequence=0;
let access=null;
let revealTimer=0;
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();

function appVisible(){const app=document.querySelector('#appView');return Boolean(app&&!app.classList.contains('hidden'))}
function visibleLabels(snapshot){return (snapshot?.modules||[]).filter(module=>module.panel==='STAFF'&&module.actions?.view).map(module=>normalize(module.label))}
function currentLabels(){return [...document.querySelectorAll('#sidebarNav .nav-item,#sidebarNav>button')].map(button=>normalize(button.textContent)).filter(Boolean)}
function navigationReady(snapshot){
  const expected=visibleLabels(snapshot),actual=currentLabels();
  if(!expected.length)return actual.length===0;
  return actual.length===expected.length&&expected.every(label=>actual.some(current=>current===label||current.includes(label)));
}
function identityReady(snapshot){
  const role=normalize(document.querySelector('#sidebarRole')?.textContent);
  const expected=normalize(snapshot?.user?.roleLabel);
  return !expected||role===expected||role.includes(expected);
}
function contentReady(){
  const content=document.querySelector('#content');
  if(!content)return false;
  return Boolean(content.querySelector('.spx-root,.sev4-root,.module-page'))&&normalize(content.textContent).length>0;
}
function compactNavigation(){
  const nav=document.querySelector('#sidebarNav');
  if(!nav)return;
  nav.style.setProperty('display','flex','important');
  nav.style.setProperty('flex-direction','column','important');
  nav.style.setProperty('justify-content','flex-start','important');
  nav.style.setProperty('align-content','flex-start','important');
  nav.style.setProperty('gap','6px','important');
}
function reveal(){
  clearTimeout(revealTimer);
  compactNavigation();
  root.classList.remove('salamat-shell-preparing');
  root.classList.add('salamat-shell-ready');
}
function waitForStaffShell(snapshot,token){
  const started=performance.now();
  const check=()=>{
    if(token!==sequence)return;
    compactNavigation();
    const ready=appVisible()&&navigationReady(snapshot)&&identityReady(snapshot)&&contentReady()&&Boolean(window.SalamatAccessControl?.can||window.SalamatStrictModuleGuard?.can);
    if(ready){reveal();return}
    if(performance.now()-started>=10000){reveal();return}
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
async function resolveShell(){
  const token=++sequence;
  root.classList.add('salamat-shell-preparing');
  root.classList.remove('salamat-shell-ready');
  try{
    const response=await fetch('/api/access/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
    if(token!==sequence)return;
    if(response.status===401){reveal();return}
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.message||'access_failed');
    access=payload.data||null;
    window.__salamatEarlyAccessSnapshot=access;
    if(access?.panel!=='STAFF'){reveal();return}
    waitForStaffShell(access,token);
  }catch{
    if(token===sequence)reveal();
  }
}

window.addEventListener('salamat-authenticated',()=>void resolveShell());
window.addEventListener('salamat-access-changed',()=>void resolveShell());
window.addEventListener('pageshow',()=>void resolveShell());
document.addEventListener('click',event=>{
  if(event.target?.closest?.('#logoutButton'))setTimeout(reveal,0);
},true);

revealTimer=setTimeout(reveal,12000);
void resolveShell();

window.SalamatStaffShellBootstrap={refresh:resolveShell,reveal,compactNavigation,get access(){return access}};
})();
