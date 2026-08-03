(()=>{
'use strict';
if(window.__salamatMobileLoginIsolationV1)return;
window.__salamatMobileLoginIsolationV1=true;

const VERSION='1.0.0';
const media=window.matchMedia('(max-width:760px)');
let wasActive=false;
let observer=null;
let frame=0;

const login=()=>document.querySelector('#loginView');
const app=()=>document.querySelector('#appView');
const visible=element=>Boolean(element&&!element.classList.contains('hidden')&&element.getAttribute('aria-hidden')!=='true'&&!element.hidden);
const loginActive=()=>media.matches&&visible(login());

const style=document.createElement('style');
style.id='salamatMobileLoginIsolationV1Styles';
style.textContent=`
@media(max-width:760px){
  #appView.app.hidden,
  html.salamat-mobile-app #appView.app.hidden,
  body.salamat-login-visible #appView.app{
    display:none!important;
    width:0!important;
    min-width:0!important;
    height:0!important;
    min-height:0!important;
    max-height:0!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
    visibility:hidden!important;
    pointer-events:none!important;
    contain:strict!important;
  }
  #loginView.login-page.hidden{display:none!important}
  html.salamat-login-visible,
  html.salamat-login-visible body{
    width:100%!important;
    min-height:100%!important;
    max-width:100%!important;
    overflow-x:hidden!important;
    background:#f8faf9!important;
  }
  body.salamat-login-visible{
    overflow-y:auto!important;
    overscroll-behavior-y:auto!important;
    touch-action:auto!important;
  }
  body.salamat-login-visible #loginView.login-page{
    position:relative!important;
    z-index:1!important;
    display:block!important;
    width:100%!important;
    min-height:100svh!important;
    margin:0!important;
    padding:10px!important;
    overflow:visible!important;
  }
  body.salamat-login-visible #loginView .login-shell{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:calc(100svh - 20px)!important;
    height:auto!important;
    margin:0!important;
    border-radius:22px!important;
    overflow:hidden!important;
  }
  body.salamat-login-visible #loginView .login-content{
    width:100%!important;
    min-width:0!important;
    min-height:calc(100svh - 20px)!important;
    height:auto!important;
    padding:22px 17px calc(24px + env(safe-area-inset-bottom))!important;
    overflow:visible!important;
  }
  body.salamat-login-visible #loginView .login-form,
  body.salamat-login-visible #loginView .field-stack,
  body.salamat-login-visible #loginView .otp-grid,
  body.salamat-login-visible #loginView .role-section,
  body.salamat-login-visible #loginView .role-options{
    min-width:0!important;
    max-width:100%!important;
  }
  body.salamat-login-visible #salamatMobileAppHeader,
  body.salamat-login-visible #salamatMobileBottomNav,
  body.salamat-login-visible #mobileSidebarBackdrop{
    display:none!important;
    visibility:hidden!important;
    pointer-events:none!important;
  }
  body.salamat-login-visible #sidebar.sidebar{
    visibility:hidden!important;
    pointer-events:none!important;
    transform:translate3d(105%,0,0)!important;
  }
  body.salamat-login-visible .main-area{
    display:none!important;
    visibility:hidden!important;
    pointer-events:none!important;
  }
}
@media(max-width:420px){
  body.salamat-login-visible #loginView.login-page{padding:0!important}
  body.salamat-login-visible #loginView .login-shell{
    min-height:100svh!important;
    border:0!important;
    border-radius:0!important;
    box-shadow:none!important;
  }
  body.salamat-login-visible #loginView .login-content{
    min-height:100svh!important;
    padding-right:15px!important;
    padding-left:15px!important;
  }
}
`;
(document.head||document.documentElement).appendChild(style);

function clearApplicationShell(){
  document.documentElement.classList.remove('salamat-mobile-app','salamat-mobile-menu-visible');
  document.body?.classList.remove('salamat-mobile-app','salamat-mobile-nav-open');
  const sidebar=document.querySelector('#sidebar');
  sidebar?.classList.remove('open');
  sidebar?.removeAttribute('aria-modal');
  sidebar?.removeAttribute('role');
  const backdrop=document.querySelector('#mobileSidebarBackdrop');
  backdrop?.classList.remove('open');
  backdrop?.setAttribute('aria-hidden','true');
  const main=document.querySelector('.main-area');
  if(main){
    main.removeAttribute('aria-hidden');
    if('inert'in main)main.inert=false;
  }
  document.querySelector('#salamatMobileAppHeader')?.setAttribute('aria-hidden','true');
  document.querySelector('#salamatMobileBottomNav')?.setAttribute('aria-hidden','true');
}

function sync(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    const active=loginActive();
    document.documentElement.classList.toggle('salamat-login-visible',active);
    document.body?.classList.toggle('salamat-login-visible',active);
    if(active){
      clearApplicationShell();
      if(!wasActive)window.scrollTo({top:0,left:0,behavior:'auto'});
    }
    wasActive=active;
    window.dispatchEvent(new CustomEvent('salamat-mobile-login-surface',{detail:{active}}));
  });
}

function observeSurfaces(){
  observer?.disconnect();
  const targets=[login(),app()].filter(Boolean);
  if(!targets.length){requestAnimationFrame(observeSurfaces);return}
  observer=new MutationObserver(sync);
  targets.forEach(target=>observer.observe(target,{attributes:true,attributeFilter:['class','hidden','aria-hidden']}));
  sync();
}

window.addEventListener('pageshow',sync);
window.addEventListener('salamat-authenticated',sync);
window.addEventListener('salamat-logged-out',sync);
window.addEventListener('salamat-shell-ready',sync);
window.addEventListener('resize',sync,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(sync,80));
media.addEventListener?.('change',sync);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeSurfaces,{once:true});else observeSurfaces();

window.SalamatMobileLoginIsolation={version:VERSION,sync,get active(){return loginActive()}};
})();