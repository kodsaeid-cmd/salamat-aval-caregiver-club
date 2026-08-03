(()=>{
'use strict';
if(window.__salamatMobileMenuScrollFixV1)return;
window.__salamatMobileMenuScrollFixV1=true;

const VERSION='1.0.0';
const media=window.matchMedia('(max-width:760px)');
let frame=0;
let observer=null;

const sidebar=()=>document.querySelector('#sidebar');
const logout=()=>document.querySelector('#logoutButton');
const bottomNav=()=>document.querySelector('#salamatMobileBottomNav');
const isOpen=()=>Boolean(sidebar()?.classList.contains('open'));

const style=document.createElement('style');
style.id='salamatMobileMenuScrollFixV1Styles';
style.textContent=`
@media(max-width:760px){
  #mobileSidebarBackdrop{z-index:218!important}
  #sidebar.sidebar,html.salamat-mobile-app #sidebar.sidebar{
    z-index:220!important;
    overflow-y:auto!important;
    overflow-x:hidden!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
    touch-action:pan-y!important;
    scrollbar-gutter:stable!important;
    padding-bottom:calc(24px + env(safe-area-inset-bottom))!important;
  }
  #sidebarNav.sidebar-nav,html.salamat-mobile-app #sidebarNav.sidebar-nav{
    flex:0 0 auto!important;
    min-height:auto!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
    overscroll-behavior:auto!important;
    -webkit-overflow-scrolling:auto!important;
    touch-action:auto!important;
  }
  #sidebar .sidebar-brand,#sidebar .sidebar-user,#sidebar .sidebar-help,#sidebar .logout{
    flex:0 0 auto!important;
  }
  #sidebar .sidebar-help{position:relative!important;z-index:2!important}
  #sidebar .logout,#logoutButton{
    position:relative!important;
    z-index:3!important;
    display:flex!important;
    width:100%!important;
    min-height:48px!important;
    margin-top:10px!important;
    margin-bottom:calc(8px + env(safe-area-inset-bottom))!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  body.salamat-mobile-nav-open #salamatMobileBottomNav{
    opacity:0!important;
    visibility:hidden!important;
    pointer-events:none!important;
    transform:translate3d(0,calc(100% + 28px),0)!important;
  }
  body.salamat-mobile-nav-open #sidebar.sidebar.open{
    visibility:visible!important;
    pointer-events:auto!important;
  }
}
`;
(document.head||document.documentElement).appendChild(style);

function prepare(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    const panel=sidebar();
    if(!panel||!media.matches)return;
    panel.dataset.independentScroll='true';
    panel.setAttribute('tabindex','-1');
    const exit=logout();
    if(exit){
      exit.removeAttribute('aria-hidden');
      exit.removeAttribute('tabindex');
      exit.disabled=false;
      exit.style.pointerEvents='auto';
    }
    const nav=bottomNav();
    if(nav)nav.setAttribute('aria-hidden',isOpen()?'true':'false');
  });
}

function onOpen(){
  prepare();
  const panel=sidebar();
  if(panel){
    panel.scrollTop=0;
    requestAnimationFrame(()=>{panel.scrollTop=0});
  }
}

function onClose(){
  const nav=bottomNav();
  if(nav)nav.setAttribute('aria-hidden','false');
  prepare();
}

document.addEventListener('focusin',event=>{
  const exit=event.target?.closest?.('#logoutButton');
  if(exit&&media.matches&&isOpen()){
    exit.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
  }
},true);

document.addEventListener('click',event=>{
  if(event.target?.closest?.('[data-v4-more]'))setTimeout(onOpen,0);
},true);

window.addEventListener('salamat-mobile-menu-opened',onOpen);
window.addEventListener('salamat-mobile-menu-closed',onClose);
window.addEventListener('orientationchange',()=>setTimeout(prepare,80));
window.addEventListener('resize',prepare,{passive:true});
window.addEventListener('pageshow',prepare);
media.addEventListener?.('change',prepare);

function observe(){
  const panel=sidebar();
  if(!panel){requestAnimationFrame(observe);return}
  observer?.disconnect();
  observer=new MutationObserver(prepare);
  observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','disabled']});
  prepare();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();

window.SalamatMobileMenuScrollFix={version:VERSION,prepare,onOpen,onClose};
})();