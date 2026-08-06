(()=>{
'use strict';
if(window.__salamatAuthSurfaceGateV1)return;
window.__salamatAuthSurfaceGateV1=true;

const VERSION='1.0.0';
const ROOT_CLASS='salamat-authenticated-surface';
const STYLE_ID='salamatAuthSurfaceGateStylesV1';
const $=selector=>document.querySelector(selector);
let authenticated=false;
let resolved=false;
let observer=null;
let frame=0;
let requestSequence=0;

function setInert(node,value){
  if(!node)return;
  node.toggleAttribute('inert',Boolean(value));
  try{node.inert=Boolean(value)}catch{}
}

function installStyles(){
  if($('#'+STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html.${ROOT_CLASS} body #loginView.login-page,
html.${ROOT_CLASS} #loginView,
body.${ROOT_CLASS} #loginView,
body.salamat-login-visible #loginView.login-page.hidden,
html.salamat-login-visible #loginView.login-page.hidden{
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
  width:0!important;
  min-width:0!important;
  height:0!important;
  min-height:0!important;
  max-height:0!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  pointer-events:none!important;
  contain:strict!important;
}
html.${ROOT_CLASS} #appView.app:not(.hidden),
body.${ROOT_CLASS} #appView.app:not(.hidden){
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
}
`;
  (document.head||document.documentElement).appendChild(style);
}

function stopLoginVideo(){
  const video=$('#loginIntroVideo');
  const player=$('#loginIntroPlayer');
  if(video){
    try{video.pause()}catch{}
    video.muted=true;
    video.defaultMuted=true;
    video.setAttribute('aria-hidden','true');
  }
  player?.classList.remove('is-playing','needs-user-play');
  $('#mobileLoginVideoPlay')?.setAttribute('aria-hidden','true');
}

function restoreLoginVideo(){
  const video=$('#loginIntroVideo');
  if(video)video.removeAttribute('aria-hidden');
  $('#mobileLoginVideoPlay')?.removeAttribute('aria-hidden');
}

function applyAuthenticatedSurface(){
  const html=document.documentElement;
  const body=document.body;
  const login=$('#loginView');
  const app=$('#appView');

  html.classList.add(ROOT_CLASS,'salamat-mobile-session-active');
  html.classList.remove('salamat-login-visible');
  body?.classList.add(ROOT_CLASS,'salamat-mobile-session-active');
  body?.classList.remove('salamat-login-visible','signup-open');

  if(login){
    login.classList.add('hidden');
    login.hidden=true;
    login.setAttribute('aria-hidden','true');
    login.style.setProperty('display','none','important');
    login.style.setProperty('visibility','hidden','important');
    login.style.setProperty('pointer-events','none','important');
    setInert(login,true);
  }

  if(app){
    app.classList.remove('hidden');
    app.hidden=false;
    app.setAttribute('aria-hidden','false');
    app.style.removeProperty('display');
    app.style.removeProperty('visibility');
    app.style.removeProperty('pointer-events');
    setInert(app,false);
  }

  $('#caregiverSignupLayer')?.classList.add('hidden');
  stopLoginVideo();
}

function applyLoggedOutSurface(){
  const html=document.documentElement;
  const body=document.body;
  const login=$('#loginView');
  const app=$('#appView');

  html.classList.remove(ROOT_CLASS,'salamat-mobile-session-active');
  body?.classList.remove(ROOT_CLASS,'salamat-mobile-session-active','salamat-mobile-app','salamat-mobile-nav-open');

  if(app){
    app.classList.add('hidden');
    app.hidden=true;
    app.setAttribute('aria-hidden','true');
    setInert(app,true);
  }

  if(login){
    login.classList.remove('hidden');
    login.hidden=false;
    login.setAttribute('aria-hidden','false');
    login.style.removeProperty('display');
    login.style.removeProperty('visibility');
    login.style.removeProperty('pointer-events');
    setInert(login,false);
  }

  restoreLoginVideo();
}

function enforce(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    if(!resolved)return;
    if(authenticated)applyAuthenticatedSurface();
    else applyLoggedOutSurface();
  });
}

function setAuthenticated(value,source='unknown'){
  authenticated=Boolean(value);
  resolved=true;
  enforce();
  window.dispatchEvent(new CustomEvent('salamat-auth-surface-changed',{detail:{authenticated,source,version:VERSION}}));
}

async function resolveSession(source='session-check'){
  const token=++requestSequence;
  try{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
    if(token!==requestSequence)return;
    if(response.ok){
      const payload=await response.json().catch(()=>({}));
      setAuthenticated(Boolean(payload?.data?.id||payload?.data?.user?.id||payload?.user?.id),source);
      return;
    }
    if(response.status===401)setAuthenticated(false,source);
  }catch{
    const app=$('#appView');
    const login=$('#loginView');
    const appOpen=Boolean(app&&!app.classList.contains('hidden')&&!app.hidden);
    const loginClosed=Boolean(login&&(login.classList.contains('hidden')||login.hidden));
    if(appOpen&&loginClosed)setAuthenticated(true,'dom-fallback');
  }
}

function eventHasUser(event){
  const detail=event?.detail;
  return Boolean(detail?.user?.id||detail?.id||detail?.data?.user?.id||detail?.data?.id);
}

function scheduleFromDom(){
  if(!resolved)return;
  enforce();
}

function installObserver(){
  observer?.disconnect();
  const targets=[$('#loginView'),$('#appView'),document.documentElement,document.body].filter(Boolean);
  observer=new MutationObserver(scheduleFromDom);
  targets.forEach(target=>observer.observe(target,{attributes:true,attributeFilter:['class','hidden','aria-hidden','style']}));
}

function boot(){
  installStyles();
  installObserver();
  void resolveSession('boot');

  window.addEventListener('salamat-authenticated',event=>setAuthenticated(eventHasUser(event)||true,'authenticated-event'));
  window.addEventListener('salamat-access-ready',event=>{
    if(eventHasUser(event))setAuthenticated(true,'access-ready');
  });
  window.addEventListener('salamat-logged-out',()=>setAuthenticated(false,'logged-out-event'));
  window.addEventListener('pageshow',()=>void resolveSession('pageshow'));
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#logoutButton'))setAuthenticated(false,'logout-click');
  },true);

  window.SalamatAuthSurfaceGate={
    version:VERSION,
    sync:enforce,
    refresh:resolveSession,
    setAuthenticated,
    get authenticated(){return authenticated},
  };
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
