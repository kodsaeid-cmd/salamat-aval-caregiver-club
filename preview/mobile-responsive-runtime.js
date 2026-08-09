(()=>{
'use strict';
if(window.__salamatMobileResponsiveRuntime)return;
window.__salamatMobileResponsiveRuntime=true;

const VERSION='1.1.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const BACKDROP_ID='mobileSidebarBackdrop';
const $=(s,r=document)=>r?.querySelector?.(s)||null;
let lastFocused=null;

function addStyles(){
 if($('#salamatMobileResponsiveStyles'))return;
 const style=document.createElement('style');
 style.id='salamatMobileResponsiveStyles';
 style.textContent=`
#${BACKDROP_ID}{display:none;position:fixed;inset:0;z-index:119;background:rgba(8,30,18,.42);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,visibility .16s ease}
#${BACKDROP_ID}.open{display:block;opacity:1;visibility:visible;pointer-events:auto}
@media(max-width:760px){
 html,body{max-width:100%;overflow-x:hidden!important}
 body.salamat-mobile-nav-open{overflow:hidden!important;overscroll-behavior:none!important}
 #appView,.app,.main-area,#content,.content{width:100%;max-width:100%;min-width:0!important}
 #appView.app{display:block!important}
 #sidebar.sidebar{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;width:min(86vw,320px)!important;max-width:calc(100vw - 44px)!important;height:100dvh!important;padding:calc(12px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom))!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:#fff!important;box-shadow:-18px 0 48px rgba(7,45,26,.18)!important;z-index:120!important;transform:translate3d(105%,0,0)!important;visibility:hidden!important;pointer-events:none!important;transition:transform .18s ease,visibility .18s ease!important}
 #sidebar.sidebar.open{transform:translate3d(0,0,0)!important;visibility:visible!important;pointer-events:auto!important}
 #sidebarNav.sidebar-nav{display:flex!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;flex-direction:column!important;gap:5px!important;padding:2px 1px 10px!important}
 #sidebarNav.sidebar-nav>.nav-item,#sidebarNav.sidebar-nav>button{flex:0 0 44px!important;width:100%!important;height:44px!important;min-height:44px!important}
 #mobileMenu{display:grid!important;place-items:center!important;min-width:44px!important;width:44px!important;height:44px!important;touch-action:manipulation}
 .topbar{width:100%!important;min-height:68px!important;padding:8px 12px!important;gap:8px!important}
 .page-heading{min-width:0!important;flex:1 1 auto!important}
 .page-heading>div{min-width:0!important}.page-heading h1{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px!important}.page-heading p{display:none!important}
 .topbar-actions{flex:0 0 auto!important}.top-user>div{display:none!important}.top-user{margin-right:0!important;padding-right:0!important;border-right:0!important}
 .content{padding:12px 10px calc(28px + env(safe-area-inset-bottom))!important}
 .surface,.module-page,.adm-module,.ev-module,.spx-root,.sev4-root,.cp-two-column,.dashboard-grid,.adm-grid,.ev-grid{max-width:100%!important;min-width:0!important}
 .table-wrap,.surface.table-wrap,.adm-module .table-wrap,.spx-table-wrap,.sev4-table-wrap{width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
 .data-table{width:max-content!important;min-width:680px!important}.data-table th,.data-table td{white-space:nowrap!important}
 input,select,textarea{max-width:100%!important;font-size:16px!important}
 button,a,input,select,textarea{touch-action:manipulation}
 img,svg,video,canvas{max-width:100%}
}
@media(max-width:520px){
 .metrics,.caregiver-metrics,.adm-kpis,.ev-kpis,.module-grid,.cp-action-grid,.cp-course-grid,.cp-stat-grid,.ev-summary-numbers,.dashboard-grid,.cp-two-column,.cp-support-layout,.adm-grid.two,.ev-grid.two,.ev-grid.three{grid-template-columns:1fr!important}
 .surface-head{align-items:stretch!important;flex-direction:column!important}.surface-head>button,.surface-head>.btn{width:100%!important}
}
@media(prefers-reduced-motion:reduce){#sidebar.sidebar,#${BACKDROP_ID}{transition:none!important}}
`;
 (document.head||document.documentElement).appendChild(style);
}
function sidebar(){return $('#sidebar')}
function button(){return $('#mobileMenu')}
function isMobile(){return MEDIA.matches}
function isOpen(){return Boolean(sidebar()?.classList.contains('open'))}
function ensureBackdrop(){let node=$('#'+BACKDROP_ID);if(node)return node;node=document.createElement('div');node.id=BACKDROP_ID;node.setAttribute('aria-hidden','true');($('#appView')||document.body).appendChild(node);return node}
function lock(){document.body?.classList.add('salamat-mobile-nav-open')}
function unlock(){document.body?.classList.remove('salamat-mobile-nav-open')}
function open(){if(!isMobile())return;const panel=sidebar();if(!panel)return;lastFocused=document.activeElement;panel.classList.add('open');ensureBackdrop().classList.add('open');button()?.setAttribute('aria-expanded','true');lock()}
function close(){const panel=sidebar();panel?.classList.remove('open');ensureBackdrop().classList.remove('open');button()?.setAttribute('aria-expanded','false');unlock();const target=lastFocused&&document.contains(lastFocused)?lastFocused:button();lastFocused=null;target?.focus?.({preventScroll:true})}
function toggle(){isOpen()?close():open()}
function sync(){addStyles();ensureBackdrop();button()?.setAttribute('aria-controls','sidebar');button()?.setAttribute('aria-expanded',isOpen()?'true':'false');if(!isMobile()&&isOpen())close()}

document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element))return;if(target.closest('#mobileMenu')){if(!isMobile())return;event.preventDefault();toggle();return}if(target.closest('#'+BACKDROP_ID)){event.preventDefault();close();return}if(isOpen()&&target.closest('#sidebarNav .nav-item,#sidebarNav button,#logoutButton'))setTimeout(close,0)},true);
document.addEventListener('keydown',event=>{if(isMobile()&&isOpen()&&event.key==='Escape'){event.preventDefault();close()}});
MEDIA.addEventListener?.('change',sync);
window.addEventListener('orientationchange',()=>setTimeout(sync,80),{passive:true});
window.addEventListener('pageshow',()=>{close();sync()},{passive:true});
window.addEventListener('salamat-authenticated',sync,{passive:true});
window.addEventListener('salamat-shell-ready',sync,{passive:true});
window.addEventListener('salamat-access-ready',sync,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
window.SalamatMobileShell={version:VERSION,open,close,toggle,sync,get isOpen(){return isOpen()},get isMobile(){return isMobile()}};
})();
