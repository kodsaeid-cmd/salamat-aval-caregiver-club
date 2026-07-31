(()=>{
'use strict';

if(window.__salamatSessionNavigationGuardV1)return;
window.__salamatSessionNavigationGuardV1=true;

let enteringApp=0;
let allowDashboardUntil=0;
let timer=null;

const appVisible=()=>{
  const app=document.getElementById('appView');
  const login=document.getElementById('loginView');
  return Boolean(app&&!app.classList.contains('hidden')&&(!login||login.classList.contains('hidden')));
};
const currentPageIsDashboard=()=>/داشبورد/.test(String(document.getElementById('pageTitle')?.textContent||''));
const mark=(fn,name)=>{try{Object.defineProperty(fn,name,{value:true})}catch{fn[name]=true}return fn};

function installOpenAppGuard(){
  const current=window.openApp;
  if(typeof current!=='function'||current.__salamatOpenAppGuard)return;
  const guarded=mark(function(...args){
    if(appVisible()){
      try{if(args[0])selectedRole=args[0]}catch{}
      return;
    }
    enteringApp+=1;
    try{return current.apply(this,args)}finally{enteringApp=Math.max(0,enteringApp-1)}
  },'__salamatOpenAppGuard');
  window.openApp=guarded;
}

function installRenderNavGuard(){
  const current=window.renderNav;
  if(typeof current!=='function'||current.__salamatRenderNavGuard)return;
  const guarded=mark(function(...args){
    if(appVisible()&&enteringApp===0)return;
    return current.apply(this,args);
  },'__salamatRenderNavGuard');
  window.renderNav=guarded;
}

function installDashboardGuard(){
  const current=window.renderDashboard;
  if(typeof current!=='function'||current.__salamatDashboardGuard)return;
  const guarded=mark(function(...args){
    const explicitDashboard=Date.now()<=allowDashboardUntil;
    if(appVisible()&&enteringApp===0&&!explicitDashboard&&!currentPageIsDashboard())return;
    return current.apply(this,args);
  },'__salamatDashboardGuard');
  window.renderDashboard=guarded;
}

function install(){
  installOpenAppGuard();
  installRenderNavGuard();
  installDashboardGuard();
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(button&&/داشبورد/.test(String(button.textContent||'')))allowDashboardUntil=Date.now()+1200;
},true);

install();
timer=setInterval(install,100);
setTimeout(()=>{clearInterval(timer);timer=setInterval(install,1000)},20000);
})();
