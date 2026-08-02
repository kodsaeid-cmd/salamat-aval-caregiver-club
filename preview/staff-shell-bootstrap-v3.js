(()=>{
'use strict';
if(window.__salamatStaffShellBootstrapV3)return;
window.__salamatStaffShellBootstrapV3=true;

const root=document.documentElement;
root.classList.add('salamat-shell-preparing');

const style=document.createElement('style');
style.id='salamatStaffShellBootstrapStylesV3';
style.textContent=`
html.salamat-shell-preparing #appView:not(.hidden){visibility:visible!important;opacity:1!important;pointer-events:none!important;position:relative!important;min-height:100vh!important}
html.salamat-shell-preparing #appView:not(.hidden)>*{visibility:hidden!important}
html.salamat-shell-preparing #appView:not(.hidden)::before{content:'در حال آماده‌سازی پنل شما…';position:fixed;inset:0;z-index:9998;display:grid;place-items:center;padding-top:74px;color:#08743f;background:linear-gradient(135deg,#f7fbf9,#fff);font:800 13px/1.8 'Vazirmatn',Tahoma,Arial,sans-serif}
html.salamat-shell-preparing #appView:not(.hidden)::after{content:'';position:fixed;z-index:9999;top:calc(50% - 25px);right:calc(50% - 18px);width:34px;height:34px;border:3px solid #dceee4;border-top-color:#08743f;border-radius:50%;animation:salamatShellSpin .8s linear infinite}
html.salamat-shell-ready #appView{transition:opacity .12s ease}
@keyframes salamatShellSpin{to{transform:rotate(360deg)}}
#sidebarNav.sidebar-nav{display:flex!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow-y:auto!important;overflow-x:hidden!important;flex-direction:column!important;justify-content:flex-start!important;align-content:flex-start!important;align-items:stretch!important;gap:6px!important;padding:2px 0!important;grid-template-columns:none!important;grid-template-rows:none!important;grid-auto-rows:auto!important}
#sidebarNav.sidebar-nav>.nav-item,#sidebarNav.sidebar-nav>button{display:grid!important;flex:0 0 43px!important;width:100%!important;height:43px!important;min-height:43px!important;max-height:43px!important;margin:0!important;align-self:stretch!important}
.sidebar{overflow-y:auto!important}.sidebar-help{margin-top:auto!important;flex:0 0 auto!important}.logout{flex:0 0 41px!important}
`;
(document.head||document.documentElement).appendChild(style);

let sequence=0;
let access=null;
let revealTimer=0;
let checkTimer=0;
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
  clearTimeout(checkTimer);
  compactNavigation();
  root.classList.remove('salamat-shell-preparing');
  root.classList.add('salamat-shell-ready');
  window.dispatchEvent(new CustomEvent('salamat-shell-ready',{detail:access}));
}
function waitForStaffShell(snapshot,token){
  const started=performance.now();
  const check=()=>{
    if(token!==sequence)return;
    const ready=appVisible()&&navigationReady(snapshot)&&identityReady(snapshot)&&contentReady()&&Boolean(window.SalamatAccessControl?.can||window.SalamatStrictModuleGuard?.can);
    if(ready||performance.now()-started>=4500){reveal();return}
    checkTimer=setTimeout(check,72);
  };
  checkTimer=setTimeout(check,0);
}
async function loadAccess(){
  if(window.SalamatPerformance?.access){
    const result=await window.SalamatPerformance.access(false);
    return {status:result.response.status,ok:result.response.ok,data:result.data,message:result.payload?.message};
  }
  const response=await fetch('/api/access/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const payload=await response.json().catch(()=>({}));
  return {status:response.status,ok:response.ok,data:payload?.data||null,message:payload?.message};
}
async function resolveShell(){
  const token=++sequence;
  clearTimeout(checkTimer);
  root.classList.add('salamat-shell-preparing');
  root.classList.remove('salamat-shell-ready');
  try{
    const result=await loadAccess();
    if(token!==sequence)return;
    if(result.status===401){reveal();return}
    if(!result.ok)throw new Error(result.message||'access_failed');
    access=result.data||null;
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

revealTimer=setTimeout(reveal,6000);
void resolveShell();

window.SalamatStaffShellBootstrap={refresh:resolveShell,reveal,compactNavigation,get access(){return access}};
})();
