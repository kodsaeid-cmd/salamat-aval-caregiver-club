(()=>{
'use strict';
if(window.__salamatMobileResponsiveRuntime)return;
window.__salamatMobileResponsiveRuntime=true;

const MOBILE_QUERY='(max-width: 760px)';
const mobileMedia=window.matchMedia(MOBILE_QUERY);
const BACKDROP_ID='mobileSidebarBackdrop';
let lastFocused=null;
let observerFrame=0;

const style=document.createElement('style');
style.id='salamatMobileResponsiveStyles';
style.textContent=`
#${BACKDROP_ID}{display:none;position:fixed;inset:0;z-index:119;border:0;margin:0;padding:0;background:rgba(8,30,18,.48);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,visibility .22s ease}
#${BACKDROP_ID}.open{display:block;opacity:1;visibility:visible;pointer-events:auto}
@media(max-width:760px){
  html,body{max-width:100%;overflow-x:hidden!important}
  body.salamat-mobile-nav-open{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}
  body.salamat-mobile-nav-open #sidebar{touch-action:pan-y!important}
  #appView,.app,.main-area,#content,.content{width:100%;max-width:100%;min-width:0!important}
  #appView.app{display:block!important}
  #sidebar.sidebar{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;width:min(86vw,320px)!important;max-width:calc(100vw - 44px)!important;height:100vh!important;height:100dvh!important;max-height:100dvh!important;padding:calc(12px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom))!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;overscroll-behavior:contain!important;background:#fff!important;box-shadow:-24px 0 64px rgba(7,45,26,.24)!important;z-index:120!important;transform:translate3d(105%,0,0)!important;visibility:hidden!important;pointer-events:none!important;will-change:transform;transition:transform .24s ease,visibility .24s ease!important}
  #sidebar.sidebar.open{transform:translate3d(0,0,0)!important;visibility:visible!important;pointer-events:auto!important}
  #sidebar .sidebar-brand,#sidebar .sidebar-user,#sidebar .sidebar-help,#sidebar .logout{flex:0 0 auto!important}
  #sidebar .sidebar-brand{height:auto!important;min-height:68px!important}
  #sidebar .sidebar-user{margin:10px 2px!important}
  #sidebarNav.sidebar-nav{display:flex!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;scrollbar-gutter:stable;flex-direction:column!important;justify-content:flex-start!important;align-items:stretch!important;gap:5px!important;padding:2px 1px 10px!important}
  #sidebarNav.sidebar-nav>.nav-item,#sidebarNav.sidebar-nav>button{flex:0 0 44px!important;width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important}
  #sidebar .sidebar-help{margin-top:8px!important}
  #sidebar .logout{min-height:44px!important;margin-top:8px!important}
  #mobileMenu{display:grid!important;place-items:center!important;min-width:44px!important;width:44px!important;height:44px!important;flex:0 0 44px!important;touch-action:manipulation}
  .topbar{width:100%!important;min-width:0!important;height:auto!important;min-height:68px!important;padding:8px 12px!important;gap:8px!important}
  .page-heading{min-width:0!important;flex:1 1 auto!important;gap:8px!important}
  .page-heading>div{min-width:0!important}
  .page-heading h1{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px!important}
  .page-heading p{display:none!important}
  .topbar-actions{flex:0 0 auto!important;gap:5px!important}
  .top-user{margin-right:0!important;padding-right:7px!important}
  .content{padding:12px 10px calc(36px + env(safe-area-inset-bottom))!important}
  .surface,.module-page,.adm-module,.ev-module,.spx-root,.sev4-root,.cp-two-column,.dashboard-grid,.adm-grid,.ev-grid{max-width:100%!important;min-width:0!important}
  .surface-head{padding:13px 12px!important;gap:10px!important;align-items:flex-start!important;flex-wrap:wrap!important}
  .surface-head>div{min-width:0!important;flex:1 1 170px!important}
  .surface-head button,.surface-head .btn{min-height:40px!important}
  .role-hero,.caregiver-hero-panel,.adm-hero,.adm-eval-head,.cp-page-head,.cp-wallet-hero,.cp-security-hero,.ev-page-head,.ev-submit-box,.ev-hr-hero{max-width:100%!important;min-width:0!important;padding:18px 15px!important;gap:13px!important}
  .role-hero h2,.cp-page-head h2,.cp-security-hero h2,.adm-hero h2,.adm-eval-head h2,.ev-page-head h2{font-size:19px!important;line-height:1.55!important}
  .metrics,.caregiver-metrics,.adm-kpis,.ev-kpis,.module-grid,.cp-action-grid,.cp-course-grid,.cp-stat-grid,.ev-q-grid,.ev-summary-numbers{min-width:0!important;gap:8px!important}
  .metric,.module-card,.cp-action-card,.adm-kpis>button,.adm-kpis>div,.ev-kpi{min-width:0!important;padding:12px!important}
  .adm-toolbar,.ev-toolbar,.adm-hero-actions,.adm-report-actions,.ev-head-actions{width:100%!important;max-width:100%!important}
  .adm-toolbar label,.ev-toolbar label,.adm-toolbar select,.ev-toolbar select,.ev-toolbar input,.ev-head-actions select,.ev-head-actions input,.adm-search{min-width:0!important;width:100%!important;max-width:100%!important}
  .table-wrap,.surface.table-wrap,.adm-module .table-wrap,.spx-table-wrap,.sev4-table-wrap{width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:visible!important;overscroll-behavior-inline:contain!important;-webkit-overflow-scrolling:touch!important}
  .data-table{width:max-content!important;min-width:680px!important}
  .data-table th,.data-table td{white-space:nowrap!important}
  .drawer{width:min(94vw,440px)!important;max-width:94vw!important;height:100vh!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;padding-bottom:env(safe-area-inset-bottom)!important}
  .drawer-head{height:auto!important;min-height:72px!important;padding:10px 14px!important;padding-top:calc(10px + env(safe-area-inset-top))!important}
  .drawer-body{height:calc(100dvh - 72px)!important;max-height:calc(100dvh - 72px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;padding:14px!important}
  .caregiver-signup-dialog{width:min(96vw,720px)!important;max-width:96vw!important;max-height:94dvh!important;margin:auto!important;overflow:hidden!important}
  .caregiver-signup-body{max-height:calc(94dvh - 100px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important}
  input,select,textarea{max-width:100%!important;font-size:16px!important}
  button,a,input,select,textarea{touch-action:manipulation}
  button,.btn,.primary-action,.secondary-action,.module-open,.cp-link-btn{min-height:42px}
  img,svg,video,canvas{max-width:100%}
}
@media(max-width:520px){
  .metrics,.caregiver-metrics,.adm-kpis,.ev-kpis,.module-grid,.cp-action-grid,.cp-course-grid,.cp-stat-grid,.ev-summary-numbers{grid-template-columns:1fr!important}
  .dashboard-grid,.cp-two-column,.cp-support-layout,.adm-grid.two,.ev-grid.two,.ev-grid.three{grid-template-columns:1fr!important}
  .role-hero,.caregiver-hero-panel,.adm-hero,.adm-eval-head,.cp-page-head,.cp-wallet-hero,.cp-security-hero,.ev-page-head,.ev-submit-box,.ev-hr-hero{align-items:stretch!important;flex-direction:column!important;grid-template-columns:1fr!important}
  .hero-actions,.adm-hero-actions,.adm-report-actions,.drawer-actions{display:grid!important;grid-template-columns:1fr!important;width:100%!important}
  .hero-actions .btn,.adm-hero-actions .btn,.adm-report-actions .btn,.drawer-actions .btn{width:100%!important}
  .topbar-actions .notification{display:none!important}
  .top-user>div{display:none!important}
  .top-user{border-right:0!important;padding-right:0!important}
  .surface-head>button,.surface-head>.btn{width:100%!important}
  .cp-form,.adm-module .ev-form,.ev-editor-grid,.ev-form{grid-template-columns:1fr!important}
  .cp-full,.adm-module .ev-form .wide,.ev-editor-grid .wide,.ev-form .wide{grid-column:auto!important}
  .toast{left:10px!important;right:10px!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;min-width:0!important;max-width:none!important}
}
@media(prefers-reduced-motion:reduce){#sidebar.sidebar,#${BACKDROP_ID}{transition:none!important}}
`;
(document.head||document.documentElement).appendChild(style);

function sidebar(){return document.querySelector('#sidebar')}
function toggleButton(){return document.querySelector('#mobileMenu')}
function mainArea(){return document.querySelector('.main-area')}
function isMobile(){return mobileMedia.matches}
function isOpen(){return Boolean(sidebar()?.classList.contains('open'))}

function ensureBackdrop(){
  let backdrop=document.getElementById(BACKDROP_ID);
  if(backdrop)return backdrop;
  backdrop=document.createElement('div');
  backdrop.id=BACKDROP_ID;
  backdrop.setAttribute('aria-hidden','true');
  const app=document.querySelector('#appView');
  if(app)app.appendChild(backdrop);else document.body.appendChild(backdrop);
  return backdrop;
}

function focusables(){
  const root=sidebar();
  if(!root)return[];
  return [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(element=>element.getClientRects().length>0);
}

function lockBackground(){
  document.body.classList.add('salamat-mobile-nav-open');
  const area=mainArea();
  if(area){
    area.setAttribute('aria-hidden','true');
    if('inert' in area)area.inert=true;
  }
}

function unlockBackground(){
  document.body.classList.remove('salamat-mobile-nav-open');
  const area=mainArea();
  if(area){
    area.removeAttribute('aria-hidden');
    if('inert' in area)area.inert=false;
  }
}

function openMenu(options={}){
  if(!isMobile())return;
  const panel=sidebar(),button=toggleButton(),backdrop=ensureBackdrop();
  if(!panel)return;
  if(!isOpen())lastFocused=document.activeElement;
  panel.classList.add('open');
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','منوی اصلی پنل');
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden','false');
  button?.setAttribute('aria-expanded','true');
  button?.setAttribute('aria-controls','sidebar');
  lockBackground();
  if(options.focus!==false){
    requestAnimationFrame(()=>{(focusables()[0]||panel).focus?.({preventScroll:true})});
  }
  window.dispatchEvent(new CustomEvent('salamat-mobile-menu-opened'));
}

function closeMenu(options={}){
  const panel=sidebar(),button=toggleButton(),backdrop=ensureBackdrop();
  panel?.classList.remove('open');
  panel?.removeAttribute('aria-modal');
  panel?.removeAttribute('role');
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden','true');
  button?.setAttribute('aria-expanded','false');
  unlockBackground();
  if(options.restoreFocus!==false&&isMobile()){
    const target=lastFocused&&document.contains(lastFocused)?lastFocused:button;
    requestAnimationFrame(()=>target?.focus?.({preventScroll:true}));
  }
  lastFocused=null;
  window.dispatchEvent(new CustomEvent('salamat-mobile-menu-closed'));
}

function toggleMenu(){if(isOpen())closeMenu();else openMenu()}

function sync(){
  const button=toggleButton();
  button?.setAttribute('aria-expanded',isOpen()?'true':'false');
  button?.setAttribute('aria-controls','sidebar');
  ensureBackdrop();
  if(!isMobile()&&isOpen())closeMenu({restoreFocus:false});
}

document.addEventListener('click',event=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  if(target.closest('#mobileMenu')){
    if(!isMobile())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMenu();
    return;
  }
  if(target.closest(`#${BACKDROP_ID}`)){
    event.preventDefault();
    closeMenu();
    return;
  }
  if(isOpen()&&target.closest('#sidebarNav .nav-item,#sidebarNav button,#logoutButton')){
    setTimeout(()=>closeMenu({restoreFocus:false}),0);
  }
},true);

document.addEventListener('keydown',event=>{
  if(!isOpen()||!isMobile())return;
  if(event.key==='Escape'){
    event.preventDefault();
    closeMenu();
    return;
  }
  if(event.key!=='Tab')return;
  const items=focusables();
  if(!items.length){event.preventDefault();return}
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

mobileMedia.addEventListener?.('change',sync);
window.addEventListener('orientationchange',()=>setTimeout(sync,80));
window.addEventListener('pageshow',()=>{closeMenu({restoreFocus:false});sync()});
window.addEventListener('salamat-authenticated',()=>closeMenu({restoreFocus:false}));
window.addEventListener('salamat-shell-ready',sync);

const observer=new MutationObserver(()=>{
  cancelAnimationFrame(observerFrame);
  observerFrame=requestAnimationFrame(sync);
});
observer.observe(document.documentElement,{childList:true,subtree:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();

window.SalamatMobileShell={open:openMenu,close:closeMenu,toggle:toggleMenu,sync,get isOpen(){return isOpen()},get isMobile(){return isMobile()}};
})();
