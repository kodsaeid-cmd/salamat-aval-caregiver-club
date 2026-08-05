(()=>{
'use strict';
if(window.__salamatMobileShellRecoveryV2)return;
window.__salamatMobileShellRecoveryV2=true;

const VERSION='2.0.0';
const media=window.matchMedia('(max-width:760px)');
const $=selector=>document.querySelector(selector);
let queued=false;
let observer=null;

function visible(node){return Boolean(node&&!node.classList.contains('hidden')&&!node.hidden&&node.getAttribute('aria-hidden')!=='true')}
function appVisible(){return visible($('#appView'))}
function loginVisible(){return visible($('#loginView'))&&!appVisible()}
function setInert(node,value){if(!node)return;node.toggleAttribute('inert',Boolean(value));try{node.inert=Boolean(value)}catch{}}
function fallbackClose(){
 const sidebar=$('#sidebar'),backdrop=$('#mobileSidebarBackdrop'),main=$('.main-area'),button=$('#mobileMenu');
 sidebar?.classList.remove('open');sidebar?.removeAttribute('aria-modal');sidebar?.removeAttribute('role');
 backdrop?.classList.remove('open');backdrop?.setAttribute('aria-hidden','true');
 document.body?.classList.remove('salamat-mobile-nav-open');
 main?.removeAttribute('aria-hidden');setInert(main,false);button?.setAttribute('aria-expanded','false');
}
function fallbackToggle(){
 const sidebar=$('#sidebar');if(!sidebar)return;
 if(sidebar.classList.contains('open')){fallbackClose();return}
 const backdrop=$('#mobileSidebarBackdrop'),main=$('.main-area'),button=$('#mobileMenu');
 sidebar.classList.add('open');sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');
 backdrop?.classList.add('open');backdrop?.setAttribute('aria-hidden','false');
 document.body?.classList.add('salamat-mobile-nav-open');main?.setAttribute('aria-hidden','true');setInert(main,true);button?.setAttribute('aria-expanded','true');
}
function repairAuthenticatedShell(){
 const html=document.documentElement,body=document.body,app=$('#appView'),login=$('#loginView'),main=$('.main-area');
 html.classList.remove('salamat-login-visible');body?.classList.remove('salamat-login-visible');
 html.classList.add('salamat-mobile-session-active','salamat-mobile-app');body?.classList.add('salamat-mobile-session-active','salamat-mobile-app');
 if(login?.getAttribute('aria-hidden')!=='true')login?.setAttribute('aria-hidden','true');
 app?.removeAttribute('aria-hidden');
 if(app){app.style.removeProperty('display');app.style.removeProperty('width');app.style.removeProperty('height');app.style.removeProperty('visibility');app.style.removeProperty('pointer-events')}
 if(main){main.style.removeProperty('display');main.style.removeProperty('visibility');main.style.removeProperty('pointer-events');main.removeAttribute('aria-hidden');setInert(main,false)}
 if(!$('#sidebar')?.classList.contains('open'))fallbackClose();
 requestAnimationFrame(()=>{window.SalamatMobileShell?.sync?.();window.SalamatMobileApp?.sync?.();window.SalamatMobileApp?.rebuildNavigation?.()});
}
function repairLoginShell(){
 const html=document.documentElement,body=document.body;
 html.classList.remove('salamat-mobile-session-active','salamat-mobile-app');body?.classList.remove('salamat-mobile-session-active','salamat-mobile-app');
 fallbackClose();
}
function sync(){
 queued=false;if(!media.matches){document.documentElement.classList.remove('salamat-mobile-session-active');document.body?.classList.remove('salamat-mobile-session-active');fallbackClose();return}
 if(appVisible())repairAuthenticatedShell();else if(loginVisible())repairLoginShell();
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(sync)}
function capture(event){
 if(!media.matches||!appVisible())return;
 const menu=event.target?.closest?.('#mobileMenu');
 if(menu){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const shell=window.SalamatMobileShell;if(shell?.toggle)shell.toggle();else fallbackToggle();return}
 const nav=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav>button,#logoutButton');
 if(nav)setTimeout(()=>{window.SalamatMobileShell?.close?.({restoreFocus:false});fallbackClose();schedule()},0);
}
function install(){
 if(!$('#salamatMobileShellRecoveryV2Styles')){
  const style=document.createElement('style');style.id='salamatMobileShellRecoveryV2Styles';style.textContent=`
@media(max-width:760px){
 html.salamat-mobile-session-active,html.salamat-mobile-session-active body{width:100%!important;max-width:100%!important;min-height:100dvh!important;overflow-x:hidden!important}
 html.salamat-mobile-session-active #loginView{display:none!important;visibility:hidden!important;pointer-events:none!important}
 html.salamat-mobile-session-active #appView.app:not(.hidden){display:block!important;width:100%!important;max-width:100%!important;min-height:100dvh!important;height:auto!important;visibility:visible!important;pointer-events:auto!important;overflow:visible!important;contain:none!important}
 html.salamat-mobile-session-active .main-area{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:100dvh!important;visibility:visible!important;pointer-events:auto!important;overflow:visible!important}
 html.salamat-mobile-session-active #content,html.salamat-mobile-session-active .content{box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important}
 html.salamat-mobile-session-active #sidebar.sidebar{display:flex!important}
 html.salamat-mobile-session-active #mobileMenu{display:grid!important;visibility:visible!important;pointer-events:auto!important}
 html.salamat-mobile-session-active .module-page{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
}
`;document.head.appendChild(style)
 }
 window.addEventListener('click',capture,true);
 for(const eventName of ['salamat-authenticated','salamat-logged-out','salamat-shell-ready','salamat-access-ready','salamat-module-opened','pageshow','resize'])window.addEventListener(eventName,schedule);
 media.addEventListener?.('change',schedule);
 observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
 schedule();
 window.SalamatMobileShellRecovery={version:VERSION,sync:schedule,close:fallbackClose};
 window.dispatchEvent(new CustomEvent('salamat-mobile-shell-recovery-ready',{detail:{version:VERSION}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
