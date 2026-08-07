(()=>{
'use strict';
if(window.__salamatPanelRouteBootstrapV1)return;
window.__salamatPanelRouteBootstrapV1=true;

const VERSION='1.0.1';
const PANEL_PATH='/panel';
const LOGIN_PATH='/';
const $=selector=>document.querySelector(selector);
let observer=null;
let timeout=0;

function onPanelRoute(){return location.pathname===PANEL_PATH||location.pathname===`${PANEL_PATH}/`}
function appReady(){
  const app=$('#appView');
  return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden&&app.getAttribute('aria-hidden')!=='true');
}
function stabilizeCompatibilitySurface(){
  const login=$('#loginView');
  if(login){
    login.classList.add('hidden');
    login.hidden=true;
    login.setAttribute('aria-hidden','true');
    login.setAttribute('inert','');
    login.style.setProperty('display','none','important');
    login.style.setProperty('visibility','hidden','important');
    login.style.setProperty('pointer-events','none','important');
  }
  $('#caregiverSignupLayer')?.remove();
  const video=$('#loginIntroVideo');
  try{video?.pause()}catch{}
}
function finish(){
  if(!appReady())return false;
  clearTimeout(timeout);
  stabilizeCompatibilitySurface();
  $('#salamatPanelRouteLoading')?.remove();
  document.documentElement.classList.add('salamat-panel-document-ready');
  document.body?.classList.add('salamat-panel-document-ready');
  observer?.disconnect();
  return true;
}
function showRecoveryMessage(){
  if(finish())return;
  const loader=$('#salamatPanelRouteLoading');
  const strong=loader?.querySelector('strong');
  if(strong)strong.textContent='راه‌اندازی پنل کامل نشد؛ در حال تلاش دوباره…';
  setTimeout(()=>{
    if(finish())return;
    if(strong)strong.textContent='پنل هنوز آماده نشده است. صفحه را یک‌بار تازه‌سازی کنید.';
  },4000);
}
function watch(){
  stabilizeCompatibilitySurface();
  const app=$('#appView');
  if(!app){location.replace(LOGIN_PATH);return}
  if(finish())return;
  observer=new MutationObserver(finish);
  observer.observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden','style']});
  for(const eventName of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-mobile-shell-recovery-ready']){
    window.addEventListener(eventName,finish);
  }
  timeout=setTimeout(showRecoveryMessage,8000);
}

if(!onPanelRoute())return;
document.documentElement.classList.add('salamat-panel-document');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
window.SalamatPanelRoute={version:VERSION,finish,get ready(){return appReady()}};
})();
