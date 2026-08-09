(()=>{
'use strict';
if(window.__salamatMobileLoginIsolationV1)return;
window.__salamatMobileLoginIsolationV1=true;

const VERSION='2.0.0';
const media=window.matchMedia('(max-width:760px)');
const VIDEO_SRC='/media/caregiver-club-intro.mp4?v=2.1.0-edge-cache';
const SPLASH_ID='salamatMobileExactSplashV2';
const STAGE_ID='salamatMobileExactLoginV2';
let observer=null;
let frame=0;
let splashStarted=false;
let emailModeForced=false;

const $=(s,r=document)=>r?.querySelector?.(s)||null;
const login=()=>$('#loginView');
const app=()=>$('#appView');
const visible=element=>Boolean(element&&!element.classList.contains('hidden')&&element.getAttribute('aria-hidden')!=='true'&&!element.hidden);
const loginActive=()=>media.matches&&visible(login());

function addStyles(){
  if($('#salamatMobileLoginIsolationV1Styles'))return;
  const style=document.createElement('style');
  style.id='salamatMobileLoginIsolationV1Styles';
  style.textContent=`
@media(max-width:760px){
  html.salamat-mobile-login-exact,html.salamat-mobile-login-exact body{width:100%!important;min-height:100%!important;margin:0!important;overflow-x:hidden!important;background:linear-gradient(180deg,#f7fbf8 0%,#fff 44%,#f2f7f4 100%)!important}
  body.salamat-mobile-login-exact{overflow-y:auto!important;touch-action:auto!important}
  body.salamat-mobile-login-exact #appView,body.salamat-mobile-login-exact .main-area,body.salamat-mobile-login-exact #sidebar,body.salamat-mobile-login-exact #mobileSidebarBackdrop,body.salamat-mobile-login-exact #salamatMobileAppHeader,body.salamat-mobile-login-exact #salamatMobileBottomNav,body.salamat-mobile-login-exact #salamatMobileRoleHeaderV71,body.salamat-mobile-login-exact #salamatMobileRoleLauncherV71,body.salamat-mobile-login-exact #salamatMobileRoleBottomNavV71,body.salamat-mobile-login-exact #salamatCaregiverHeaderV5,body.salamat-mobile-login-exact #salamatCaregiverBottomNavV5,body.salamat-mobile-login-exact #salamatCaregiverDashboardV5,body.salamat-mobile-login-exact #salamatMobileLoginStageV5,body.salamat-mobile-login-exact #salamatMobileSplashV5{display:none!important;visibility:hidden!important;pointer-events:none!important}
  body.salamat-mobile-login-exact #loginView.login-page{display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;min-height:100svh!important;margin:0!important;padding:0!important;background:transparent!important;overflow:visible!important}
  body.salamat-mobile-login-exact #loginView> *:not(.login-shell){display:none!important}
  body.salamat-mobile-login-exact #loginView .login-shell{display:block!important;width:100%!important;max-width:none!important;min-height:100svh!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important}
  body.salamat-mobile-login-exact #loginView .login-visual{display:none!important}
  body.salamat-mobile-login-exact #loginView .login-content{display:block!important;width:100%!important;max-width:520px!important;min-height:100svh!important;margin:0 auto!important;padding:calc(14px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))!important;background:transparent!important;overflow:visible!important}
  body.salamat-mobile-login-exact #loginView .login-brand,body.salamat-mobile-login-exact #loginView .login-heading,body.salamat-mobile-login-exact #loginView #methodTabs,body.salamat-mobile-login-exact #loginView #mobileFields,body.salamat-mobile-login-exact #loginView .role-section,body.salamat-mobile-login-exact #loginView .login-meta,body.salamat-mobile-login-exact #loginView .security-note{display:none!important}
  body.salamat-mobile-login-exact #loginView #emailFields{display:grid!important;gap:9px!important;margin:0!important}
  body.salamat-mobile-login-exact #loginView .login-form{display:grid!important;gap:12px!important;width:100%!important;margin:16px 0 0!important;padding:0!important}
  body.salamat-mobile-login-exact #loginView .field-stack label{margin:0 3px!important;color:#294238!important;font-size:12px!important;font-weight:850!important}
  body.salamat-mobile-login-exact #loginView .input-box{min-height:56px!important;border:1px solid #dce8e1!important;border-radius:17px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 7px 24px rgba(20,71,45,.055)!important}
  body.salamat-mobile-login-exact #loginView .input-box:focus-within{border-color:#11905a!important;box-shadow:0 0 0 4px rgba(17,144,90,.08)!important}
  body.salamat-mobile-login-exact #loginView .input-box input{min-height:54px!important;font-size:16px!important;background:transparent!important}
  body.salamat-mobile-login-exact #loginView .primary-action{min-height:56px!important;margin:2px 0 0!important;border-radius:17px!important;background:linear-gradient(135deg,#08743f,#0b9253)!important;box-shadow:0 14px 28px rgba(8,116,63,.20)!important;font-size:14px!important;font-weight:900!important}
  body.salamat-mobile-login-exact #loginView .join-network-block{display:block!important;margin:4px 0 0!important;padding:0!important}
  body.salamat-mobile-login-exact #loginView .join-network-action{width:100%!important;min-height:54px!important;padding:13px 16px!important;border:1px solid rgba(8,116,63,.18)!important;border-radius:17px!important;background:#fff!important;color:#08743f!important;box-shadow:0 8px 22px rgba(17,73,43,.06)!important;display:flex!important;align-items:center!important;justify-content:center!important}
  body.salamat-mobile-login-exact #loginView .join-network-action>[data-icon],body.salamat-mobile-login-exact #loginView .join-network-action small{display:none!important}
  body.salamat-mobile-login-exact #loginView .join-network-action>span{display:block!important;width:100%!important}
  body.salamat-mobile-login-exact #loginView .join-network-action strong{display:block!important;text-align:center!important;color:#08743f!important;font-size:13px!important;font-weight:950!important;line-height:1.7!important}
  #${STAGE_ID}{display:block!important;width:100%!important;direction:rtl!important}
  #${STAGE_ID} .mle-video{position:relative;width:100%;aspect-ratio:16/9;border-radius:24px;overflow:hidden;background:#0d1813;box-shadow:0 16px 42px rgba(16,59,37,.16)}
  #${STAGE_ID} .mle-video video{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;background:#0d1813!important}
  #${STAGE_ID} .mle-copy{padding:18px 4px 0;text-align:right}
  #${STAGE_ID} .mle-copy strong{display:block;color:#143b29;font-size:20px;font-weight:950;line-height:1.6}
  #${STAGE_ID} .mle-copy small{display:block;margin-top:5px;color:#7a8981;font-size:10.5px;line-height:1.9}
  #${SPLASH_ID}{position:fixed;z-index:999999;inset:0;display:grid;place-items:center;padding:28px;background:radial-gradient(circle at 50% 42%,#fff 0,#f7fbf8 55%,#eef7f1 100%);direction:rtl;opacity:1;visibility:visible;transition:opacity .48s ease,visibility .48s ease}
  #${SPLASH_ID}.is-leaving{opacity:0;visibility:hidden;pointer-events:none}
  #${SPLASH_ID} .mle-splash-inner{display:grid;justify-items:center;gap:21px;text-align:center;animation:mleSplashIn .62s cubic-bezier(.2,.8,.2,1) both}
  #${SPLASH_ID} img{width:min(45vw,170px);height:auto;display:block;filter:drop-shadow(0 15px 32px rgba(8,116,63,.11))}
  #${SPLASH_ID} strong{max-width:300px;color:#173b29;font-size:19px;line-height:1.9;font-weight:950}
  #${SPLASH_ID} i{width:46px;height:3px;border-radius:99px;background:linear-gradient(90deg,#e52b31 0 38%,#08743f 38% 100%)}
  @keyframes mleSplashIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
}
@media(max-width:390px){
  body.salamat-mobile-login-exact #loginView .login-content{padding-right:13px!important;padding-left:13px!important}
  #${STAGE_ID} .mle-video{border-radius:20px}
  #${STAGE_ID} .mle-copy strong{font-size:18px}
}
`;
  (document.head||document.documentElement).appendChild(style);
}

function clearApplicationShell(){
  document.documentElement.classList.remove('salamat-mobile-app','salamat-mobile-menu-visible','salamat-mobile-panel-v71','salamat-mobile-icon-home-v71');
  document.body?.classList.remove('salamat-mobile-app','salamat-mobile-nav-open','salamat-mobile-panel-v71','salamat-mobile-icon-home-v71');
  $('#sidebar')?.classList.remove('open');
  $('#mobileSidebarBackdrop')?.classList.remove('open');
}

function ensureStage(){
  const content=$('#loginView .login-content');
  const form=$('#loginForm');
  if(!content||!form)return;
  let stage=$('#'+STAGE_ID);
  if(!stage){
    stage=document.createElement('section');
    stage.id=STAGE_ID;
    stage.innerHTML=`<div class="mle-video"><video src="${VIDEO_SRC}" playsinline webkit-playsinline controls preload="metadata" muted autoplay></video></div><div class="mle-copy"><strong>ورود به باشگاه مراقبین سلامت اول</strong><small>نام کاربری و رمز عبور خود را وارد کنید.</small></div>`;
    content.insertBefore(stage,form);
  }
  if(!emailModeForced){
    const emailTab=$('#methodTabs [data-method="email"]');
    if(emailTab){try{HTMLElement.prototype.click.call(emailTab)}catch{};emailModeForced=true}
  }
  const email=$('#emailFields');
  email?.classList.remove('hidden');
  const labels=email?.querySelectorAll('label');
  if(labels?.[0])labels[0].textContent='نام کاربری';
  const userInput=email?.querySelector('input[type="email"],input[type="text"]');
  if(userInput){userInput.setAttribute('autocomplete','username');userInput.setAttribute('placeholder','نام کاربری')}
  const password=email?.querySelector('input[type="password"]');
  if(password)password.setAttribute('autocomplete','current-password');
  const join=$('#openCaregiverRegistration');
  const strong=join?.querySelector('strong');
  if(strong)strong.textContent='به شبکه مراقبین سلامت اول بپیوندید';
}

function ensureSplash(){
  if(splashStarted||!loginActive())return;
  splashStarted=true;
  $('#salamatMobileSplashV5')?.remove();
  let splash=$('#'+SPLASH_ID);
  if(!splash){
    splash=document.createElement('div');
    splash.id=SPLASH_ID;
    splash.innerHTML='<div class="mle-splash-inner"><img src="./logo-salamat-aval.svg" alt="سلامت اول"><strong>به باشگاه مراقبین سلامت اول خوش آمدید</strong><i></i></div>';
    document.body.appendChild(splash);
  }
  setTimeout(()=>{splash.classList.add('is-leaving');setTimeout(()=>splash.remove(),520)},1450);
}

function sync(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    const active=loginActive();
    document.documentElement.classList.toggle('salamat-mobile-login-exact',active);
    document.body?.classList.toggle('salamat-mobile-login-exact',active);
    document.documentElement.classList.toggle('salamat-login-visible',active);
    document.body?.classList.toggle('salamat-login-visible',active);
    if(active){
      clearApplicationShell();
      ensureStage();
      ensureSplash();
      window.scrollTo({top:0,left:0,behavior:'auto'});
    }else{
      $('#'+SPLASH_ID)?.remove();
    }
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

window.addEventListener('pageshow',sync,{passive:true});
window.addEventListener('salamat-authenticated',sync,{passive:true});
window.addEventListener('salamat-logged-out',()=>{splashStarted=false;emailModeForced=false;sync()},{passive:true});
window.addEventListener('salamat-shell-ready',sync,{passive:true});
window.addEventListener('resize',sync,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(sync,80),{passive:true});
media.addEventListener?.('change',sync);

addStyles();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeSurfaces,{once:true});else observeSurfaces();

window.SalamatMobileLoginIsolation={version:VERSION,sync,get active(){return loginActive()}};
})();
