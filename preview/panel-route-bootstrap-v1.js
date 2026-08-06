(()=>{
'use strict';
if(window.__salamatPanelRouteBootstrapV1)return;
window.__salamatPanelRouteBootstrapV1=true;

const VERSION='1.0.0';
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
function removeLoginSurface(){
  $('#loginView')?.remove();
  $('#caregiverSignupLayer')?.remove();
  const video=$('#loginIntroVideo');
  try{video?.pause()}catch{}
}
function finish(){
  if(!appReady())return false;
  clearTimeout(timeout);
  $('#salamatPanelRouteLoading')?.remove();
  document.documentElement.classList.add('salamat-panel-document-ready');
  document.body?.classList.add('salamat-panel-document-ready');
  observer?.disconnect();
  return true;
}
function watch(){
  removeLoginSurface();
  const app=$('#appView');
  if(!app){location.replace(LOGIN_PATH);return}
  if(finish())return;
  observer=new MutationObserver(finish);
  observer.observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden','style']});
  for(const eventName of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-mobile-shell-recovery-ready']){
    window.addEventListener(eventName,finish);
  }
  timeout=setTimeout(()=>{
    const loader=$('#salamatPanelRouteLoading strong');
    if(loader)loader.textContent='آماده‌سازی پنل کمی طول کشیده است…';
  },8000);
}

if(!onPanelRoute())return;
document.documentElement.classList.add('salamat-panel-document');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
window.SalamatPanelRoute={version:VERSION,finish,get ready(){return appReady()}};
})();
