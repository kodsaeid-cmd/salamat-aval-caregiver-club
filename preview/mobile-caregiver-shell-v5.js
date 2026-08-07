(()=>{
'use strict';
if(window.__salamatMobileCaregiverShellV5)return;
window.__salamatMobileCaregiverShellV5=true;

const VERSION='5.0.1';
const media=window.matchMedia('(max-width:760px)');
const VIDEO_SRC='/media/caregiver-club-intro.mp4?v=2.1.0-edge-cache';
const SPLASH_KEY='salamat_mobile_splash_v5_seen';
const SPLASH_ID='salamatMobileSplashV5';
const LOGIN_STAGE_ID='salamatMobileLoginStageV5';
const HEADER_ID='salamatCaregiverHeaderV5';
const NAV_ID='salamatCaregiverBottomNavV5';
const DASHBOARD_ID='salamatCaregiverDashboardV5';
let frame=0;
let observers=[];

const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const visible=element=>Boolean(element&&!element.classList.contains('hidden')&&element.getAttribute('aria-hidden')!=='true'&&!element.hidden);
const loginActive=()=>media.matches&&visible($('#loginView'));
const appActive=()=>media.matches&&visible($('#appView'));
const sourceNav=()=>$$('#sidebarNav .nav-item,#sidebarNav>button');
const sourceLabel=source=>{
  if(!source)return'';
  const clone=source.cloneNode(true);
  clone.querySelectorAll('b,[data-icon],svg').forEach(node=>node.remove());
  return normalize(clone.textContent);
};
const roleText=()=>normalize(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||$('#sidebarRole')?.textContent).toUpperCase();
const caregiverActive=()=>{
  if(!appActive())return false;
  const role=roleText();
  if(role==='CAREGIVER'||role.includes('مراقب'))return true;
  const labels=sourceNav().map(sourceLabel);
  return labels.some(label=>label.includes('آموزش‌های من'))&&labels.some(label=>label.includes('تقویم کاری'));
};

const SVG_NS='http://www.w3.org/2000/svg';
const fallbackPaths={
  profile:['<circle cx="12" cy="8" r="4"/>','<path d="M4 22a8 8 0 0 1 16 0"/>'],
  calendar:['<rect width="18" height="18" x="3" y="4" rx="2"/>','<path d="M16 2v4M8 2v4M3 10h18"/>'],
  home:['<path d="m3 11 9-8 9 8"/>','<path d="M5 10v10h14V10M9 20v-6h6v6"/>'],
  support:['<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>'],
  training:['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/>','<path d="M8 7h8M8 11h6"/>'],
};
function fallbackIcon(key){
  const wrapper=document.createElement('span');
  wrapper.className='mc5-fallback-icon';
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  const template=document.createElement('template');
  template.innerHTML=(fallbackPaths[key]||fallbackPaths.home).join('');
  svg.append(...template.content.cloneNode(true).childNodes);
  wrapper.appendChild(svg);
  return wrapper;
}
function cloneSourceIcon(source,key){
  const icon=source?.querySelector('[data-icon],svg');
  return icon?icon.cloneNode(true):fallbackIcon(key);
}
function matchSource(aliases){
  const normalizedAliases=aliases.map(normalize);
  return sourceNav().find(source=>{
    const label=sourceLabel(source);
    return normalizedAliases.some(alias=>label===alias||label.includes(alias));
  })||null;
}
function navSources(){
  return {
    calendar:matchSource(['تقویم کاری','تقویم']),
    home:matchSource(['داشبورد']),
    support:matchSource(['پشتیبانی قراردادها','پشتیبانی پرونده','پشتیبانی']),
    training:matchSource(['آموزش‌های من','آموزش']),
  };
}

function addStyles(){
  if($('#salamatMobileCaregiverShellV5Styles'))return;
  const style=document.createElement('style');
  style.id='salamatMobileCaregiverShellV5Styles';
  style.textContent=`
#${SPLASH_ID},#${LOGIN_STAGE_ID},#${HEADER_ID},#${NAV_ID},#${DASHBOARD_ID}{display:none}
@media(max-width:760px){
  body.salamat-mobile-login-v5{background:#fff!important}
  body.salamat-mobile-login-v5 #loginView.login-page{padding:0!important;background:#fff!important;min-height:100svh!important}
  body.salamat-mobile-login-v5 #loginView .login-shell{display:block!important;width:100%!important;max-width:none!important;min-height:100svh!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;overflow:visible!important}
  body.salamat-mobile-login-v5 #loginView .login-visual{display:none!important}
  body.salamat-mobile-login-v5 #loginView .login-content{width:min(100%,520px)!important;min-height:100svh!important;margin:0 auto!important;padding:18px 18px calc(34px + env(safe-area-inset-bottom))!important;display:block!important;background:#fff!important;overflow:visible!important}
  body.salamat-mobile-login-v5 #loginView .login-brand,
  body.salamat-mobile-login-v5 #loginView .login-heading,
  body.salamat-mobile-login-v5 #loginView #methodTabs,
  body.salamat-mobile-login-v5 #loginView #mobileFields,
  body.salamat-mobile-login-v5 #loginView .role-section,
  body.salamat-mobile-login-v5 #loginView .login-meta,
  body.salamat-mobile-login-v5 #loginView .security-note,
  body.salamat-mobile-login-v5 #loginView .join-network-block{display:none!important}
  body.salamat-mobile-login-v5 #loginView #emailFields{display:grid!important;gap:8px!important;margin:0!important}
  body.salamat-mobile-login-v5 #loginView .login-form{width:100%!important;margin:18px 0 0!important;padding:0!important;display:grid!important;gap:12px!important}
  body.salamat-mobile-login-v5 #loginView .field-stack label{margin:2px 2px 0!important;color:#34463c!important;font-size:11px!important;font-weight:800!important}
  body.salamat-mobile-login-v5 #loginView .input-box{min-height:54px!important;border:1px solid #dce7e1!important;border-radius:16px!important;background:#f8fbf9!important;box-shadow:none!important}
  body.salamat-mobile-login-v5 #loginView .input-box:focus-within{border-color:#15935a!important;box-shadow:0 0 0 4px rgba(8,116,63,.08)!important;background:#fff!important}
  body.salamat-mobile-login-v5 #loginView .input-box input{min-height:52px!important;font-size:16px!important;background:transparent!important}
  body.salamat-mobile-login-v5 #loginView .primary-action{min-height:54px!important;margin-top:5px!important;border-radius:16px!important;background:#08743f!important;box-shadow:0 12px 28px rgba(8,116,63,.22)!important;font-size:13px!important}
  #${LOGIN_STAGE_ID}{display:block;width:100%;padding-top:calc(2px + env(safe-area-inset-top));direction:rtl}
  #${LOGIN_STAGE_ID} .mc5-video-wrap{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:24px;background:#0c1812;box-shadow:0 18px 46px rgba(18,51,34,.16)}
  #${LOGIN_STAGE_ID} .login-intro-player{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;border:0!important;border-radius:0!important;background:#0c1812!important;overflow:hidden!important}
  #${LOGIN_STAGE_ID} video{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;background:#0c1812!important}
  #${LOGIN_STAGE_ID} .mc5-sound{position:absolute;z-index:8;left:12px;bottom:12px;width:42px;height:42px;border:1px solid rgba(255,255,255,.3);border-radius:14px;display:grid;place-items:center;background:rgba(10,26,18,.58);color:#fff;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font:900 15px/1 sans-serif}
  #${LOGIN_STAGE_ID} .mc5-login-title{margin:24px 2px 5px;text-align:right}
  #${LOGIN_STAGE_ID} .mc5-login-title strong{display:block;color:#16251d;font-size:22px;font-weight:950;letter-spacing:-.4px}
  #${LOGIN_STAGE_ID} .mc5-login-title small{display:block;margin-top:7px;color:#7b8981;font-size:10px;line-height:1.8}
  #${SPLASH_ID}{position:fixed;z-index:50000;inset:0;display:grid;place-items:center;padding:28px;background:radial-gradient(circle at 50% 42%,#fff 0,#f7fbf8 55%,#eef7f1 100%);direction:rtl;opacity:1;visibility:visible;transition:opacity .55s ease,visibility .55s ease}
  #${SPLASH_ID}.is-leaving{opacity:0;visibility:hidden;pointer-events:none}
  #${SPLASH_ID} .mc5-splash-inner{display:grid;justify-items:center;gap:22px;text-align:center;animation:mc5SplashIn .72s cubic-bezier(.2,.8,.2,1) both}
  #${SPLASH_ID} img{width:min(46vw,178px);height:auto;display:block;filter:drop-shadow(0 16px 34px rgba(8,116,63,.12))}
  #${SPLASH_ID} strong{max-width:280px;color:#173b29;font-size:18px;line-height:1.9;font-weight:950}
  #${SPLASH_ID} i{width:44px;height:3px;border-radius:99px;background:linear-gradient(90deg,#e52b31 0 38%,#08743f 38% 100%);animation:mc5SplashLine 1.2s ease both}
  @keyframes mc5SplashIn{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:none}}
  @keyframes mc5SplashLine{from{width:0;opacity:.25}to{width:44px;opacity:1}}

  html.salamat-caregiver-mobile-v5,html.salamat-caregiver-mobile-v5 body{background:#f5f8f6!important;color:#17251d!important}
  html.salamat-caregiver-mobile-v5 #salamatMobileAppHeader,
  html.salamat-caregiver-mobile-v5 #salamatMobileBottomNav{display:none!important;visibility:hidden!important;pointer-events:none!important}
  html.salamat-caregiver-mobile-v5 .main-area{padding-top:calc(72px + env(safe-area-inset-top))!important;padding-bottom:calc(94px + env(safe-area-inset-bottom))!important;background:#f5f8f6!important}
  html.salamat-caregiver-mobile-v5 #content.content{padding:14px 14px 28px!important;background:#f5f8f6!important}
  #${HEADER_ID}{position:fixed;z-index:120;top:0;right:0;left:0;height:calc(64px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(17,69,42,.06);background:rgba(255,255,255,.93);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
  #${HEADER_ID} .mc5-head-copy{min-width:0;text-align:right}
  #${HEADER_ID} .mc5-head-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#14281d;font-size:14px;font-weight:950}
  #${HEADER_ID} .mc5-head-copy small{display:block;margin-top:3px;color:#839088;font-size:8.5px}
  #${HEADER_ID} .mc5-head-profile{width:42px;height:42px;flex:0 0 42px;padding:0;border:0;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:#e8f5ed;color:#08743f;font-weight:950;box-shadow:inset 0 0 0 1px rgba(8,116,63,.08)}
  #${HEADER_ID} .mc5-head-profile img{width:100%;height:100%;object-fit:cover}
  #${HEADER_ID} .mc5-head-profile svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}

  #${NAV_ID}{position:fixed;z-index:130;right:10px;left:10px;bottom:calc(8px + env(safe-area-inset-bottom));height:72px;padding:7px 8px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:2px;direction:rtl;border:1px solid rgba(8,116,63,.08);border-radius:26px;background:rgba(255,255,255,.96);box-shadow:0 18px 50px rgba(10,62,35,.18);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
  #${NAV_ID} button{position:relative;height:58px;min-width:0;padding:5px 2px;border:0;border-radius:17px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:transparent;color:#8a958f;font-size:8px;font-weight:800;line-height:1.2;transition:transform .16s ease,color .16s ease,background .16s ease;-webkit-tap-highlight-color:transparent}
  #${NAV_ID} button:active{transform:scale(.92)}
  #${NAV_ID} button.active:not(.home){color:#08743f;background:#eef8f2}
  #${NAV_ID} button .mc5-nav-icon,#${NAV_ID} button [data-icon],#${NAV_ID} button svg{width:22px;height:22px;display:grid;place-items:center;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  #${NAV_ID} button [data-icon] svg{width:22px;height:22px}
  #${NAV_ID} button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #${NAV_ID} button.home{transform:translateY(-14px);color:#08743f;background:transparent}
  #${NAV_ID} button.home:active{transform:translateY(-14px) scale(.92)}
  #${NAV_ID} button.home .mc5-home-circle{width:58px;height:58px;display:grid;place-items:center;border:5px solid #f5f8f6;border-radius:50%;background:#08743f;color:#fff;box-shadow:0 12px 28px rgba(8,116,63,.30)}
  #${NAV_ID} button.home .mc5-home-circle svg,#${NAV_ID} button.home .mc5-home-circle [data-icon]{width:24px;height:24px;stroke:currentColor}
  #${NAV_ID} button.home>span:last-child{position:absolute;top:62px;color:#08743f;font-size:8px;font-weight:950}

  html.salamat-caregiver-mobile-v5.salamat-caregiver-dashboard-v5 #content>*:not(#${DASHBOARD_ID}){display:none!important}
  #${DASHBOARD_ID}{display:block!important;animation:mc5PageIn .28s ease both}
  #${DASHBOARD_ID} .mc5-welcome{padding:9px 2px 17px;text-align:right}
  #${DASHBOARD_ID} .mc5-welcome small{display:block;color:#7f8d85;font-size:9px}
  #${DASHBOARD_ID} .mc5-welcome h1{margin:4px 0 0;color:#173728;font-size:22px;line-height:1.6;font-weight:950;letter-spacing:-.5px}
  #${DASHBOARD_ID} .mc5-grid-wrap{padding:18px 12px 20px;border:1px solid rgba(8,116,63,.06);border-radius:25px;background:#fff;box-shadow:0 12px 34px rgba(20,67,42,.07)}
  #${DASHBOARD_ID} .mc5-grid-title{display:flex;align-items:center;justify-content:space-between;margin:0 4px 16px}
  #${DASHBOARD_ID} .mc5-grid-title strong{color:#20372b;font-size:12px;font-weight:950}
  #${DASHBOARD_ID} .mc5-grid-title small{color:#94a098;font-size:8px}
  #${DASHBOARD_ID} .mc5-module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 8px;direction:rtl}
  #${DASHBOARD_ID} .mc5-module{min-width:0;padding:0 2px;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;gap:8px;color:#273c31;text-align:center;-webkit-tap-highlight-color:transparent}
  #${DASHBOARD_ID} .mc5-module:active{transform:scale(.95)}
  #${DASHBOARD_ID} .mc5-module-icon{width:62px;height:62px;display:grid;place-items:center;border:1px solid #deebe4;border-radius:20px;background:linear-gradient(145deg,#fbfdfc,#eff7f3);color:#08743f;box-shadow:0 7px 18px rgba(22,70,44,.08)}
  #${DASHBOARD_ID} .mc5-module-icon [data-icon],#${DASHBOARD_ID} .mc5-module-icon svg{width:28px;height:28px;display:grid;place-items:center;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #${DASHBOARD_ID} .mc5-module-icon [data-icon] svg{width:28px;height:28px}
  #${DASHBOARD_ID} .mc5-module-label{max-width:100%;min-height:30px;display:grid;place-items:start center;color:#304238;font-size:9.5px;font-weight:850;line-height:1.55;overflow-wrap:anywhere}
  @keyframes mc5PageIn{from{opacity:.25;transform:translateY(7px)}to{opacity:1;transform:none}}
}
@media(max-width:380px){
  #${DASHBOARD_ID} .mc5-module-grid{gap:16px 4px}
  #${DASHBOARD_ID} .mc5-module-icon{width:58px;height:58px;border-radius:18px}
  #${NAV_ID}{right:6px;left:6px}
}
@media(prefers-reduced-motion:reduce){
  #${SPLASH_ID},#${SPLASH_ID} .mc5-splash-inner,#${DASHBOARD_ID}{animation:none!important;transition:none!important}
  #${NAV_ID} button{transition:none!important}
}
`;
  (document.head||document.documentElement).appendChild(style);
}

function el(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
function sessionSeen(){try{return sessionStorage.getItem(SPLASH_KEY)==='1'}catch{return false}}
function markSessionSeen(){try{sessionStorage.setItem(SPLASH_KEY,'1')}catch{}}
function maybeSplash(){
  if(!loginActive()||sessionSeen()||$('#'+SPLASH_ID))return;
  markSessionSeen();
  const splash=el('div');splash.id=SPLASH_ID;splash.setAttribute('role','status');splash.setAttribute('aria-live','polite');
  const inner=el('div','mc5-splash-inner');
  const logo=document.createElement('img');logo.src='./logo-salamat-aval.svg';logo.alt='سلامت اول';
  inner.append(logo,el('strong','', 'به باشگاه مراقبین سلامت اول خوش آمدید'),el('i'));
  splash.appendChild(inner);document.body.appendChild(splash);
  const reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  setTimeout(()=>splash.classList.add('is-leaving'),reduced?450:1450);
  setTimeout(()=>splash.remove(),reduced?650:2150);
}

function forcePasswordLogin(){
  const emailTab=$('#methodTabs [data-method="email"]');
  if(emailTab&&!emailTab.classList.contains('active'))emailTab.click();
  $('#mobileFields')?.classList.add('hidden');
  $('#emailFields')?.classList.remove('hidden');
  const identifier=$('#emailFields input:not([type="password"])');
  const password=$('#emailFields input[type="password"]');
  if(identifier){identifier.id=identifier.id||'backendIdentifierInput';identifier.type='text';identifier.autocomplete='username';identifier.placeholder='نام کاربری';identifier.setAttribute('aria-label','نام کاربری')}
  if(password){password.autocomplete='current-password';password.placeholder='رمز عبور'}
  const labels=$$('#emailFields label');
  if(labels[0])labels[0].textContent='نام کاربری';
  if(labels[1])labels[1].textContent='رمز عبور';
  const form=$('#loginForm');if(form){form.noValidate=true;form.setAttribute('novalidate','novalidate')}
}

function ensureLoginVideo(){
  const content=$('#loginView .login-content');if(!content)return;
  let stage=$('#'+LOGIN_STAGE_ID);
  if(!stage){
    stage=el('section');stage.id=LOGIN_STAGE_ID;
    const wrap=el('div','mc5-video-wrap');
    const title=el('div','mc5-login-title');title.append(el('strong','', 'ورود به باشگاه'),el('small','', 'نام کاربری و رمز عبور خود را وارد کنید.'));
    stage.append(wrap,title);content.prepend(stage);
  }
  const wrap=$('.mc5-video-wrap',stage);
  let player=$('#loginIntroPlayer');
  if(!player){
    player=el('div','login-intro-player');player.id='loginIntroPlayer';
    const video=document.createElement('video');video.id='loginIntroVideo';video.src=VIDEO_SRC;video.muted=true;video.defaultMuted=true;video.autoplay=true;video.preload='metadata';video.setAttribute('playsinline','');video.setAttribute('aria-label','ویدئوی معرفی باشگاه مراقبین سلامت اول');player.appendChild(video);
  }
  if(wrap&&player.parentElement!==wrap)wrap.appendChild(player);
  let video=$('#loginIntroVideo',player);
  if(video){
    if(!(video.getAttribute('src')||'').includes('caregiver-club-intro.mp4')){video.src=VIDEO_SRC;video.load()}
    video.muted=true;video.defaultMuted=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.setAttribute('autoplay','');video.play().catch(()=>{});
  }
  if(wrap&&!$('.mc5-sound',wrap)){
    const sound=el('button','mc5-sound','🔇');sound.type='button';sound.setAttribute('aria-label','روشن کردن صدای ویدئو');
    sound.addEventListener('click',()=>{
      video=$('#loginIntroVideo',player);if(!video)return;
      video.muted=!video.muted;sound.textContent=video.muted?'🔇':'🔊';sound.setAttribute('aria-label',video.muted?'روشن کردن صدای ویدئو':'بی‌صدا کردن ویدئو');if(video.paused)video.play().catch(()=>{});
    });
    wrap.appendChild(sound);
  }
}
function syncLogin(){
  const active=loginActive();
  document.documentElement.classList.toggle('salamat-mobile-login-v5',active);document.body?.classList.toggle('salamat-mobile-login-v5',active);
  if(!active)return;maybeSplash();forcePasswordLogin();ensureLoginVideo();
}

function openProfile(){
  if(typeof window.SalamatCaregiverSelfProfile?.open==='function'){window.SalamatCaregiverSelfProfile.open();return}
  ($('.csp1-profile-trigger')||$('#topAvatar')||$('#sidebarAvatar'))?.click();
}
function clickSource(source){if(!source)return;source.click();window.SalamatMobileShell?.close?.({restoreFocus:false});window.scrollTo({top:0,left:0,behavior:'auto'})}
function isDashboard(){const source=navSources().home;if(source?.classList.contains('active'))return true;return normalize($('#pageTitle')?.textContent).includes('داشبورد')}
function userFirstName(){const name=normalize($('#sidebarName')?.textContent||$('#topName')?.textContent||'مراقب');return name.split(' ')[0]||'مراقب'}
function appendAvatar(target){
  target.replaceChildren();
  const source=$('#topAvatar')||$('#sidebarAvatar');const image=source?.querySelector('img');
  if(image){target.appendChild(image.cloneNode(true));return}
  const text=normalize(source?.textContent);
  if(text){target.appendChild(el('span','',text.slice(0,2)));return}
  target.appendChild(fallbackIcon('profile'));
}

function ensureHeader(){
  let header=$('#'+HEADER_ID);
  if(!header){
    header=el('header');header.id=HEADER_ID;
    const copy=el('div','mc5-head-copy');copy.append(el('strong'),el('small','', 'باشگاه مراقبین سلامت اول'));
    const profile=el('button','mc5-head-profile');profile.type='button';profile.setAttribute('aria-label','پروفایل من');profile.addEventListener('click',openProfile);
    header.append(copy,profile);($('#appView')||document.body).appendChild(header);
  }
  $('.mc5-head-copy strong',header).textContent=`سلام ${userFirstName()} 👋`;
  appendAvatar($('.mc5-head-profile',header));
  return header;
}

function createNavButton(key,label,source){
  const button=el('button');button.type='button';button.dataset.mc5Action=key;button.setAttribute('aria-label',label);
  const active=key==='profile'?Boolean($('.csp1-backdrop')):Boolean(source?.classList.contains('active'));if(active)button.classList.add('active');
  if(key==='home'){
    button.classList.add('home');const circle=el('span','mc5-home-circle');circle.appendChild(cloneSourceIcon(source,key));button.append(circle,el('span','',label));return button;
  }
  const icon=el('span','mc5-nav-icon');icon.appendChild(cloneSourceIcon(source,key));button.append(icon,el('span','',label));return button;
}
function ensureBottomNav(){
  let nav=$('#'+NAV_ID);
  if(!nav){
    nav=el('nav');nav.id=NAV_ID;nav.setAttribute('aria-label','ناوبری اصلی پنل مراقب');($('#appView')||document.body).appendChild(nav);
    nav.addEventListener('click',event=>{
      const button=event.target.closest('button[data-mc5-action]');if(!button)return;const action=button.dataset.mc5Action;
      if(action==='profile'){openProfile();schedule();return}clickSource(navSources()[action]);
    });
  }
  const sources=navSources();
  nav.replaceChildren(
    createNavButton('profile','پروفایل',null),
    createNavButton('calendar','تقویم',sources.calendar),
    createNavButton('home','خانه',sources.home),
    createNavButton('support','پشتیبانی',sources.support),
    createNavButton('training','آموزش',sources.training),
  );
  return nav;
}

function gridSources(){
  return sourceNav().filter(source=>{
    const label=sourceLabel(source);if(!label||label.includes('داشبورد'))return false;
    if(source.hidden||source.classList.contains('hidden')||source.getAttribute('aria-hidden')==='true')return false;
    try{if(getComputedStyle(source).display==='none')return false}catch{}
    return true;
  });
}
function ensureDashboard(){
  const content=$('#content');if(!content)return;
  const active=isDashboard();document.documentElement.classList.toggle('salamat-caregiver-dashboard-v5',active);document.body?.classList.toggle('salamat-caregiver-dashboard-v5',active);
  let dashboard=$('#'+DASHBOARD_ID);if(!active){dashboard?.remove();return}
  if(!dashboard){dashboard=el('section');dashboard.id=DASHBOARD_ID;content.appendChild(dashboard)}
  const modules=gridSources();const signature=modules.map(source=>`${sourceLabel(source)}:${source.querySelector('[data-icon]')?.dataset.icon||''}`).join('|');if(dashboard.dataset.signature===signature)return;dashboard.dataset.signature=signature;
  const welcome=el('div','mc5-welcome');welcome.append(el('small','', 'باشگاه مراقبین سلامت اول'),el('h1','',`${userFirstName()} عزیز، خوش آمدید`));
  const wrap=el('div','mc5-grid-wrap');const title=el('div','mc5-grid-title');title.append(el('strong','', 'ماژول‌های من'),el('small','',`${modules.length.toLocaleString('fa-IR')} دسترسی`));
  const grid=el('div','mc5-module-grid');
  modules.forEach(source=>{
    const button=el('button','mc5-module');button.type='button';button.setAttribute('aria-label',sourceLabel(source));
    const icon=el('span','mc5-module-icon');icon.appendChild(cloneSourceIcon(source,'home'));
    button.append(icon,el('span','mc5-module-label',sourceLabel(source)));button.addEventListener('click',()=>clickSource(source));grid.appendChild(button);
  });
  wrap.append(title,grid);dashboard.replaceChildren(welcome,wrap);
}

function syncApp(){
  const active=caregiverActive();document.documentElement.classList.toggle('salamat-caregiver-mobile-v5',active);document.body?.classList.toggle('salamat-caregiver-mobile-v5',active);
  if(!active){document.documentElement.classList.remove('salamat-caregiver-dashboard-v5');document.body?.classList.remove('salamat-caregiver-dashboard-v5');$('#'+HEADER_ID)?.remove();$('#'+NAV_ID)?.remove();$('#'+DASHBOARD_ID)?.remove();return}
  ensureHeader();ensureBottomNav();ensureDashboard();
}
function sync(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{syncLogin();syncApp()})}
function schedule(){sync()}
function resetObservers(){
  observers.forEach(observer=>observer.disconnect());observers=[];
  const watch=(target,options)=>{if(!target)return;const observer=new MutationObserver(sync);observer.observe(target,options);observers.push(observer)};
  watch($('#loginView'),{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
  watch($('#appView'),{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
  watch($('#sidebarNav'),{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
  watch($('#content'),{childList:true});
}
function boot(){addStyles();resetObservers();sync()}

window.addEventListener('pageshow',sync);
window.addEventListener('resize',sync,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(sync,90));
window.addEventListener('salamat-authenticated',()=>setTimeout(()=>{resetObservers();sync()},0));
window.addEventListener('salamat-logged-out',()=>setTimeout(()=>{resetObservers();sync()},0));
window.addEventListener('salamat-shell-ready',()=>setTimeout(()=>{resetObservers();sync()},0));
window.addEventListener('salamat-access-ready',()=>setTimeout(()=>{resetObservers();sync()},0));
window.addEventListener('salamat-caregiver-profile-updated',sync);
window.addEventListener('salamat-mobile-login-surface',sync);
media.addEventListener?.('change',sync);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.SalamatMobileCaregiverShellV5={version:VERSION,sync,rebuild:()=>{resetObservers();sync()},openProfile};
})();