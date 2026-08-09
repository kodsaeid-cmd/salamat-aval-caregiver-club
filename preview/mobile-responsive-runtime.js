(()=>{
'use strict';
if(window.__salamatMobileResponsiveRuntime)return;
window.__salamatMobileResponsiveRuntime=true;

const VERSION='2.0.0';
const BACKDROP_ID='mobileSidebarBackdrop';
const HOME_ID='salamatMobileHomeV2';
const BOTTOM_NAV_ID='salamatMobileUnifiedBottomNavV2';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
let lastFocused=null;
let titleObserver=null;
let navObserver=null;
let appObserver=null;

const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=value=>normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase();
const isMobile=()=>MEDIA.matches;
const app=()=>$('#appView');
const appActive=()=>Boolean(app()&&!app().classList.contains('hidden')&&app().getAttribute('aria-hidden')!=='true');

const ICONS={
 home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 caregivers:'<circle cx="9" cy="7" r="3.5"/><path d="M3.5 20v-1.4c0-3.2 2.3-5.2 5.5-5.2 1.5 0 2.8.4 3.8 1.2"/><circle cx="17.2" cy="9" r="2.5"/><path d="M13 20v-1.1c0-2.8 1.8-4.5 4.2-4.5 2.5 0 4.3 1.7 4.3 4.5V20"/>',
 report:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h4"/><path d="m15.5 17.5 1.6 1.6 3-3"/>',
 contract:'<path d="M6 3.5h9l3 3V21H6z"/><path d="M15 3.5V7h3M9 11h6M9 14.5h6"/><path d="m9.2 18 1.2 1.2 2.7-2.7"/>',
 training:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22z"/>',
 wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/>',
 payroll:'<rect x="3" y="6" width="18" height="12" rx="2.7"/><path d="M3 10h18M7 14h3"/>',
 support:'<path d="M5 13v-2a7 7 0 0 1 14 0v2"/><path d="M5 12H3.8A1.8 1.8 0 0 0 2 13.8v3.4A1.8 1.8 0 0 0 3.8 19H6v-7zM19 12h1.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H18v-7z"/><path d="M18 19c-1.3 1.5-3 2.2-5 2.2"/>',
 evaluation:'<path d="M12 2.8 20 6v5.7c0 4.9-3.1 8.2-8 9.5-4.9-1.3-8-4.6-8-9.5V6z"/><path d="m8.3 11.8 2.2 2.2 5-5"/>',
 settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.2 13.4c.1-.5.1-1 0-1.4l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.3-.8L15.2 4h-4.1l-.4 3.2c-.5.2-.9.5-1.3.8L7 7 5 10.5 7 12c-.1.5-.1 1 0 1.4l-2 1.5L7 18.4l2.4-1c.4.3.8.6 1.3.8l.4 3.2h4.1l.4-3.2c.5-.2.9-.5 1.3-.8l2.4 1 2-3.5z"/>',
 profile:'<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
 phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92Z"/>'
};
function svg(name,cls=''){return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.home}</svg>`}
function iconFor(label){const v=compact(label);if(v.includes('گزارش'))return'report';if(v.includes('قرارداد'))return'contract';if(v.includes('آموزش')||v.includes('دوره'))return'training';if(v.includes('اعتبار')||v.includes('کیفپول')||v.includes('تسهیلات'))return'wallet';if(v.includes('حقوق')||v.includes('پرداخت')||v.includes('فیش'))return'payroll';if(v.includes('پشتیبان')||v.includes('تیکت'))return'support';if(v.includes('ارزیابی')||v.includes('پروانه')||v.includes('کارنامه')||v.includes('رتبه'))return'evaluation';if(v.includes('تنظیم')||v.includes('لاگ'))return'settings';if(v.includes('کاربران')||v.includes('دسترسی'))return'users';if(v.includes('مراقب')||v.includes('پرونده'))return'caregivers';if(v.includes('پروفایل')||v.includes('حساب'))return'profile';if(v.includes('تقویم')||v.includes('شیفت'))return'calendar';return'report'}

function addStyles(){
 if($('#salamatMobileResponsiveStyles'))return;
 const style=document.createElement('style');
 style.id='salamatMobileResponsiveStyles';
 style.textContent=`
#${BACKDROP_ID}{display:none;position:fixed;inset:0;z-index:219;background:rgba(8,30,18,.32);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,visibility .16s ease}
#${BACKDROP_ID}.open{display:block;opacity:1;visibility:visible;pointer-events:auto}
@media(max-width:760px){
 :root{--sa-green:#08743f;--sa-green-2:#0b9253;--sa-dark:#173b29;--sa-ink:#202b26;--sa-muted:#7a8981;--sa-red:#ef2934;--sa-bg:#f7faf8;--sa-card:#fff;--sa-line:#e7eee9;--sa-shadow:0 14px 34px rgba(22,61,43,.08)}
 html,body{max-width:100%;overflow-x:hidden!important;background:linear-gradient(180deg,#fff 0%,#f8fbf9 44%,#f4f8f6 100%)!important;color:var(--sa-ink);font-family:inherit}
 body.salamat-mobile-nav-open{overflow:hidden!important;overscroll-behavior:none!important}
 #appView,.app,.main-area,#content,.content{width:100%;max-width:100%;min-width:0!important}
 #appView.app{display:block!important;background:transparent!important}
 #appView.app.hidden{display:none!important}
 .main-area{margin:0!important;padding:0!important;background:transparent!important}
 #sidebar.sidebar{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;width:min(86vw,320px)!important;max-width:calc(100vw - 44px)!important;height:100dvh!important;padding:calc(12px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom))!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:#fff!important;box-shadow:-18px 0 48px rgba(7,45,26,.18)!important;z-index:220!important;transform:translate3d(105%,0,0)!important;visibility:hidden!important;pointer-events:none!important;transition:transform .18s ease,visibility .18s ease!important}
 #sidebar.sidebar.open{transform:translate3d(0,0,0)!important;visibility:visible!important;pointer-events:auto!important}
 #sidebarNav.sidebar-nav{display:flex!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;flex-direction:column!important;gap:5px!important;padding:2px 1px 10px!important}
 #sidebarNav.sidebar-nav>.nav-item,#sidebarNav.sidebar-nav>button{flex:0 0 46px!important;width:100%!important;height:46px!important;min-height:46px!important;border-radius:14px!important}
 #mobileMenu{display:none!important;place-items:center!important;min-width:44px!important;width:44px!important;height:44px!important;touch-action:manipulation}
 .topbar.sa-mobile-brand-header{position:sticky!important;top:0!important;z-index:90!important;width:100%!important;height:104px!important;min-height:104px!important;padding:calc(10px + env(safe-area-inset-top)) 18px 8px!important;display:grid!important;grid-template-columns:92px minmax(0,1fr) 72px!important;grid-template-areas:'logo title avatar'!important;align-items:center!important;gap:8px!important;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;border:0!important;border-bottom:1px solid rgba(232,239,235,.78)!important;box-shadow:0 8px 30px rgba(22,61,43,.035)!important}
 .topbar.sa-mobile-brand-header .sa-mobile-brand-logo{grid-area:logo;display:flex;align-items:center;justify-content:flex-start;height:72px}
 .topbar.sa-mobile-brand-header .sa-mobile-brand-logo img{display:block;width:88px!important;height:auto!important;max-height:68px!important;object-fit:contain!important}
 .topbar.sa-mobile-brand-header .page-heading{grid-area:title;display:block!important;min-width:0!important;text-align:center!important}
 .topbar.sa-mobile-brand-header .page-heading>div{min-width:0!important}.topbar.sa-mobile-brand-header .page-heading h1{margin:0!important;color:#151d19!important;font-size:17px!important;line-height:1.5!important;font-weight:950!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.topbar.sa-mobile-brand-header .page-heading p{display:block!important;margin:5px 0 0!important;color:#7d8782!important;font-size:10.5px!important;line-height:1.4!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
 .topbar.sa-mobile-brand-header .topbar-actions{display:none!important}
 .sa-mobile-header-avatar{grid-area:avatar;position:relative;width:60px;height:60px;justify-self:end;border:0;border-radius:20px;background:linear-gradient(145deg,#06733d,#0b8a4e);color:#fff;display:grid;place-items:center;font:900 16px/1 inherit;box-shadow:0 12px 28px rgba(8,116,63,.18);touch-action:manipulation}
 .sa-mobile-header-avatar:after{content:'';position:absolute;right:4px;left:4px;bottom:-14px;height:4px;border-radius:99px;background:var(--sa-red)}
 .content{padding:18px 15px calc(116px + env(safe-area-inset-bottom))!important;background:transparent!important;min-height:calc(100svh - 104px)!important}
 #content.sa-mobile-home-active>:not(#${HOME_ID}){display:none!important}
 #${HOME_ID}{display:block;direction:rtl}
 #${HOME_ID} .sa-home-hero{position:relative;min-height:172px;padding:26px 24px;border:1px solid rgba(255,255,255,.98);border-radius:29px;background:linear-gradient(135deg,#f9fdfb 0%,#eef8f2 100%);box-shadow:var(--sa-shadow);display:grid;grid-template-columns:minmax(0,1fr) 128px;align-items:center;gap:10px;overflow:hidden}
 #${HOME_ID} .sa-home-hero:after{content:'';position:absolute;right:0;top:52px;width:5px;height:82px;border-radius:8px 0 0 8px;background:var(--sa-red)}
 #${HOME_ID} .sa-home-copy{padding-right:2px;z-index:1}#${HOME_ID} .sa-home-copy strong{display:block;color:var(--sa-green);font-size:20px;font-weight:950;line-height:1.65}#${HOME_ID} .sa-home-copy p{margin:9px 0 0;color:#6f7c76;font-size:11.5px;line-height:2}#${HOME_ID} .sa-home-art{height:120px;color:var(--sa-green);display:grid;place-items:center;opacity:.96}#${HOME_ID} .sa-home-art svg{width:112px;height:112px;filter:drop-shadow(0 8px 16px rgba(8,116,63,.08))}
 #${HOME_ID} .sa-home-section{margin-top:26px}#${HOME_ID} .sa-home-section-head{display:flex;align-items:end;justify-content:space-between;margin:0 2px 14px}#${HOME_ID} .sa-home-section-head strong{color:#1b2621;font-size:18px;font-weight:950}#${HOME_ID} .sa-home-section-head small{color:#87918c;font-size:9.5px}
 #${HOME_ID} .sa-home-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 12px}
 #${HOME_ID} .sa-home-module{appearance:none;border:1px solid rgba(255,255,255,.98);min-width:0;min-height:116px;padding:16px 7px 12px;border-radius:25px;background:linear-gradient(145deg,#fff,#fbfdfc);box-shadow:0 12px 26px rgba(25,62,45,.07);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--sa-green);touch-action:manipulation;transition:transform .14s ease,box-shadow .14s ease}
 #${HOME_ID} .sa-home-module:active{transform:scale(.97);box-shadow:0 6px 16px rgba(25,62,45,.06)}#${HOME_ID} .sa-home-module svg{width:40px;height:40px;flex:0 0 40px}#${HOME_ID} .sa-home-module span{display:block;width:100%;color:#1f2d26;font-size:10.7px;line-height:1.55;font-weight:900;text-align:center;white-space:normal}
 #${BOTTOM_NAV_ID}{position:fixed;z-index:180;right:15px;left:15px;bottom:calc(10px + env(safe-area-inset-bottom));height:82px;padding:8px 7px;border:1px solid rgba(255,255,255,.94);border-radius:24px;background:rgba(255,255,255,.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 18px 45px rgba(22,61,43,.13);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));direction:rtl;align-items:center}
 #${BOTTOM_NAV_ID} button{appearance:none;position:relative;height:66px;min-width:0;padding:6px 2px;border:0;background:transparent;color:#606a65;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font:800 8.7px/1.35 inherit;touch-action:manipulation}
 #${BOTTOM_NAV_ID} button svg{width:25px;height:25px;stroke-width:1.8}#${BOTTOM_NAV_ID} button.sa-home{width:64px;height:64px;justify-self:center;margin-top:-30px;border-radius:50%;background:linear-gradient(145deg,#08743f,#0b9253);color:#fff;box-shadow:0 13px 30px rgba(8,116,63,.26)}#${BOTTOM_NAV_ID} button.sa-home svg{width:29px;height:29px;stroke-width:2}#${BOTTOM_NAV_ID} button.sa-home span{position:absolute;top:70px;color:var(--sa-green);font-size:9px;font-weight:950;white-space:nowrap}#${BOTTOM_NAV_ID} button[aria-current='page']:not(.sa-home){color:var(--sa-green)}
 .surface,.module-page,.adm-module,.ev-module,.spx-root,.sev4-root,.cp-two-column,.dashboard-grid,.adm-grid,.ev-grid{max-width:100%!important;min-width:0!important}
 #content:not(.sa-mobile-home-active)>.surface,#content:not(.sa-mobile-home-active)>.module-page,#content:not(.sa-mobile-home-active)>.adm-module,#content:not(.sa-mobile-home-active)>.ev-module,#content:not(.sa-mobile-home-active)>.spx-root,#content:not(.sa-mobile-home-active)>.sev4-root,#content:not(.sa-mobile-home-active)>section,#content:not(.sa-mobile-home-active)>div:not(.toast):not(.modal):not(.overlay){border-radius:24px!important}
 #content:not(.sa-mobile-home-active) .surface,#content:not(.sa-mobile-home-active) .module-page,#content:not(.sa-mobile-home-active) .adm-module,#content:not(.sa-mobile-home-active) .ev-module,#content:not(.sa-mobile-home-active) .spx-root,#content:not(.sa-mobile-home-active) .sev4-root{border:1px solid var(--sa-line)!important;background:rgba(255,255,255,.96)!important;box-shadow:0 10px 28px rgba(25,62,45,.055)!important;padding:14px!important}
 .surface-head,.module-head,.adm-head,.ev-head{gap:10px!important;margin-bottom:12px!important}.surface-head h2,.module-head h2,.adm-head h2,.ev-head h2,.surface h2,.module-page h2{color:var(--sa-dark)!important;font-size:17px!important;font-weight:950!important;line-height:1.6!important}
 .surface p,.module-page p,.adm-module p,.ev-module p{color:#738078!important;line-height:1.85!important}
 .metrics,.caregiver-metrics,.adm-kpis,.ev-kpis,.module-grid,.cp-action-grid,.cp-course-grid,.cp-stat-grid,.ev-summary-numbers,.dashboard-grid,.cp-two-column,.cp-support-layout,.adm-grid.two,.ev-grid.two,.ev-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
 .metric,.caregiver-metric,.adm-kpi,.ev-kpi,.stat-card,.summary-card,.cp-stat,.cp-action,.module-card{min-width:0!important;border:1px solid #edf2ef!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 18px rgba(25,62,45,.045)!important;padding:13px!important}
 .metric strong,.caregiver-metric strong,.adm-kpi strong,.ev-kpi strong,.stat-card strong{color:var(--sa-green)!important;font-weight:950!important}
 .table-wrap,.surface.table-wrap,.adm-module .table-wrap,.spx-table-wrap,.sev4-table-wrap{width:100%!important;max-width:100%!important;overflow:visible!important}
 table.sa-mobile-card-table{display:block!important;width:100%!important;min-width:0!important;border:0!important;background:transparent!important}table.sa-mobile-card-table thead{display:none!important}table.sa-mobile-card-table tbody{display:grid!important;gap:9px!important;width:100%!important}table.sa-mobile-card-table tr{display:block!important;width:100%!important;padding:11px 13px!important;border:1px solid #edf2ef!important;border-radius:17px!important;background:#fff!important;box-shadow:0 7px 17px rgba(25,62,45,.04)!important}table.sa-mobile-card-table td{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;width:100%!important;padding:6px 0!important;border:0!important;white-space:normal!important;text-align:left!important;font-size:11px!important;line-height:1.6!important}table.sa-mobile-card-table td:before{content:attr(data-sa-label);flex:0 0 38%;color:#7b8780;font-size:9.5px;font-weight:800;text-align:right}table.sa-mobile-card-table td:empty{display:none!important}
 input,select,textarea{max-width:100%!important;min-height:48px!important;font-size:16px!important;border-radius:15px!important;border-color:#dfe9e3!important;background:#fff!important}textarea{min-height:96px!important}button,a,input,select,textarea{touch-action:manipulation}.btn,.button,.primary-action,.secondary-action,button[type='submit']{border-radius:15px!important}
 img,svg,video,canvas{max-width:100%}
 .modal,.dialog,[role='dialog']{max-width:calc(100vw - 24px)!important;border-radius:24px!important}
}
@media(max-width:430px){
 .topbar.sa-mobile-brand-header{grid-template-columns:82px minmax(0,1fr) 64px!important;padding-left:12px!important;padding-right:12px!important}.topbar.sa-mobile-brand-header .sa-mobile-brand-logo img{width:78px!important}.sa-mobile-header-avatar{width:56px;height:56px;border-radius:18px}
 .content{padding-left:11px!important;padding-right:11px!important}
 #${HOME_ID} .sa-home-hero{grid-template-columns:minmax(0,1fr) 102px;min-height:158px;padding:22px 18px;border-radius:26px}#${HOME_ID} .sa-home-copy strong{font-size:18px}#${HOME_ID} .sa-home-art{height:104px}#${HOME_ID} .sa-home-art svg{width:94px;height:94px}
 #${HOME_ID} .sa-home-grid{gap:12px 9px}#${HOME_ID} .sa-home-module{min-height:108px;border-radius:22px;padding:14px 5px 11px;gap:8px}#${HOME_ID} .sa-home-module svg{width:36px;height:36px}#${HOME_ID} .sa-home-module span{font-size:9.8px}
 #${BOTTOM_NAV_ID}{right:10px;left:10px;height:78px;border-radius:22px}#${BOTTOM_NAV_ID} button{font-size:8px}#${BOTTOM_NAV_ID} button svg{width:23px;height:23px}#${BOTTOM_NAV_ID} button.sa-home{width:60px;height:60px}
}
@media(max-width:360px){#${HOME_ID} .sa-home-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 7px}#${HOME_ID} .sa-home-module{min-height:101px}#${HOME_ID} .sa-home-module span{font-size:9px}.metrics,.caregiver-metrics,.adm-kpis,.ev-kpis,.module-grid,.cp-action-grid,.cp-course-grid,.cp-stat-grid,.ev-summary-numbers,.dashboard-grid,.cp-two-column,.cp-support-layout,.adm-grid.two,.ev-grid.two,.ev-grid.three{grid-template-columns:1fr!important}}
@media(prefers-reduced-motion:reduce){#sidebar.sidebar,#${BACKDROP_ID},#${HOME_ID} .sa-home-module{transition:none!important}}
`;
 (document.head||document.documentElement).appendChild(style);
}

function sidebar(){return $('#sidebar')}
function button(){return $('#mobileMenu')}
function isOpen(){return Boolean(sidebar()?.classList.contains('open'))}
function ensureBackdrop(){let node=$('#'+BACKDROP_ID);if(node)return node;node=document.createElement('div');node.id=BACKDROP_ID;node.setAttribute('aria-hidden','true');(app()||document.body).appendChild(node);return node}
function lock(){document.body?.classList.add('salamat-mobile-nav-open')}
function unlock(){document.body?.classList.remove('salamat-mobile-nav-open')}
function open(){if(!isMobile())return;const panel=sidebar();if(!panel)return;lastFocused=document.activeElement;panel.classList.add('open');ensureBackdrop().classList.add('open');button()?.setAttribute('aria-expanded','true');lock();window.dispatchEvent(new CustomEvent('salamat-mobile-menu-opened'))}
function close(){const panel=sidebar();panel?.classList.remove('open');ensureBackdrop().classList.remove('open');button()?.setAttribute('aria-expanded','false');unlock();const target=lastFocused&&document.contains(lastFocused)?lastFocused:button();lastFocused=null;target?.focus?.({preventScroll:true})}
function toggle(){isOpen()?close():open()}

function navSources(){return $$('#sidebarNav .nav-item,#sidebarNav>button,#sidebarNav [data-module-key],#sidebarNav [data-access-module]').filter((node,index,array)=>node instanceof HTMLElement&&array.indexOf(node)===index)}
function findNav(terms){const wanted=terms.map(compact);return navSources().find(node=>{const value=compact(node.textContent);return wanted.some(term=>value.includes(term))})||null}
function activateNav(terms){const source=findNav(terms);if(!source)return false;try{HTMLElement.prototype.click.call(source);close();return true}catch{return false}}
function goHome(){return activateNav(['داشبورد','خانه'])}
function roleCode(){return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||'').toUpperCase()}
function roleLabel(){return normalize($('#sidebarRole')?.textContent)||'کاربر سامانه'}
function roleHeading(){const label=roleLabel();if(label.includes('مدیر'))return'مدیر سامانه';if(label.includes('مراقب'))return label;if(label.includes('جذب'))return'کارشناس جذب';if(label.includes('منابع انسانی'))return'منابع انسانی';return label}
function initials(){const raw=normalize($('#sidebarAvatar')?.textContent)||normalize($('#sidebarName')?.textContent);if(!raw)return'س';if(raw.length<=3)return raw;const parts=raw.split(' ').filter(Boolean);return (parts[0]?.[0]||'س')+(parts[1]?.[0]||'')}
function currentTitle(){const raw=normalize($('#pageTitle')?.textContent);if(!raw)return roleHeading();if(raw.includes('داشبورد')||raw.includes('پنل'))return roleHeading();return raw}
function isDashboard(){const title=compact($('#pageTitle')?.textContent);if(title.includes('داشبورد')||title==='خانه')return true;const active=navSources().find(n=>n.classList.contains('active')||n.getAttribute('aria-current')==='page');return Boolean(active&&compact(active.textContent).includes('داشبورد'))}

function ensureHeader(){
 const top=$('.topbar');if(!top||!appActive())return;
 top.classList.add('sa-mobile-brand-header');
 let logo=$('.sa-mobile-brand-logo',top);if(!logo){logo=document.createElement('div');logo.className='sa-mobile-brand-logo';logo.innerHTML='<img src="./logo-salamat-aval.svg" alt="سلامت اول">';top.prepend(logo)}
 const heading=$('.page-heading',top);const h1=$('#pageTitle',top)||$('#pageTitle');const p=$('#pageSubtitle',top)||$('#pageSubtitle');if(h1)h1.textContent=currentTitle();if(p)p.textContent='باشگاه مراقبین سلامت اول';
 let avatar=$('.sa-mobile-header-avatar',top);if(!avatar){avatar=document.createElement('button');avatar.type='button';avatar.className='sa-mobile-header-avatar';avatar.setAttribute('aria-label','پروفایل');top.appendChild(avatar);avatar.addEventListener('click',()=>activateNav(['پروفایل','حساب کاربری','اطلاعات پروفایل']))}avatar.textContent=initials();
 if(heading&&logo.nextSibling!==heading){/* grid-area keeps semantic order stable */}
}

function moduleEntries(){
 const deny=['داشبورد','خروج'];
 const seen=new Set();
 return navSources().map(source=>({source,label:normalize(source.textContent).replace(/\d+/g,'').trim()})).filter(item=>item.label&&!deny.some(d=>item.label.includes(d))).filter(item=>{const key=compact(item.label);if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,9);
}
function buildHome(){
 const content=$('#content');if(!content||!appActive())return;
 if(!isDashboard()){content.classList.remove('sa-mobile-home-active');$('#'+HOME_ID)?.remove();return}
 content.classList.add('sa-mobile-home-active');
 const entries=moduleEntries();
 let home=$('#'+HOME_ID);if(!home){home=document.createElement('section');home.id=HOME_ID;content.prepend(home)}
 const welcomeRole=roleHeading().replace(' سامانه','');
 home.innerHTML=`<div class="sa-home-hero"><div class="sa-home-copy"><strong>سلام ${welcomeRole} خوش آمدید</strong><p>شما به باشگاه مراقبین سلامت اول دسترسی کامل دارید.</p></div><div class="sa-home-art">${svg('evaluation')}</div></div><div class="sa-home-section"><div class="sa-home-section-head"><strong>ماژول‌های من</strong><small>${entries.length} دسترسی فعال</small></div><div class="sa-home-grid"></div></div>`;
 const grid=$('.sa-home-grid',home);entries.forEach(({source,label})=>{const card=document.createElement('button');card.type='button';card.className='sa-home-module';card.innerHTML=`${svg(iconFor(label))}<span>${label}</span>`;card.addEventListener('click',()=>{try{HTMLElement.prototype.click.call(source)}catch{};setTimeout(sync,0)});grid?.appendChild(card)});
}

function bottomItems(){
 const caregiver=roleCode()==='CAREGIVER'||roleLabel().includes('مراقب');
 return [
  {key:'profile',label:'پروفایل',icon:'profile',terms:['پروفایل','حساب کاربری','اطلاعات پروفایل']},
  caregiver?{key:'secondary',label:'اعتبار',icon:'wallet',terms:['اعتبارات مالی','کیف پول','اعتبار']}:{key:'secondary',label:'کاربران و دسترسی‌ها',icon:'users',terms:['کاربران و دسترسی','کاربران','دسترسی']},
  {key:'home',label:'خانه',icon:'home',terms:['داشبورد','خانه']},
  {key:'support',label:'پشتیبانی',icon:'support',terms:['پشتیبانی','تیکت']},
  {key:'training',label:'بانک آموزش',icon:'training',terms:['بانک آموزش','آموزش','دوره']}
 ];
}
function ensureBottomNav(){
 if(!appActive()||!isMobile()){$('#'+BOTTOM_NAV_ID)?.remove();return}
 let nav=$('#'+BOTTOM_NAV_ID);if(!nav){nav=document.createElement('nav');nav.id=BOTTOM_NAV_ID;nav.setAttribute('aria-label','ناوبری اصلی موبایل');(app()||document.body).appendChild(nav)}
 nav.innerHTML='';
 bottomItems().forEach(item=>{const b=document.createElement('button');b.type='button';b.dataset.saRoute=item.key;if(item.key==='home')b.className='sa-home';if((item.key==='home'&&isDashboard())||(item.key!=='home'&&compact(currentTitle()).includes(compact(item.label))))b.setAttribute('aria-current','page');b.innerHTML=`${svg(item.icon)}<span>${item.label}</span>`;b.addEventListener('click',()=>{activateNav(item.terms);setTimeout(sync,0)});nav.appendChild(b)});
}

function annotateTables(root=$('#content')){
 if(!root)return;
 $$('table',root).forEach(table=>{
  if(table.classList.contains('sa-mobile-card-table'))return;
  const headers=$$('thead th',table).map(th=>normalize(th.textContent));
  if(!headers.length)return;
  $$('tbody tr',table).forEach(row=>$$('td',row).forEach((cell,index)=>cell.setAttribute('data-sa-label',headers[index]||'')));
  table.classList.add('sa-mobile-card-table');
 });
}
function sync(){
 addStyles();
 ensureBackdrop();
 button()?.setAttribute('aria-controls','sidebar');
 button()?.setAttribute('aria-expanded',isOpen()?'true':'false');
 if(!isMobile()){close();$('#'+BOTTOM_NAV_ID)?.remove();$('#'+HOME_ID)?.remove();$('#content')?.classList.remove('sa-mobile-home-active');return}
 if(!appActive()){$('#'+BOTTOM_NAV_ID)?.remove();return}
 ensureHeader();
 buildHome();
 ensureBottomNav();
 if(!isDashboard())annotateTables();
 document.documentElement.dataset.salamatMobileDesign=VERSION;
}

function installObservers(){
 titleObserver?.disconnect();navObserver?.disconnect();appObserver?.disconnect();
 const title=$('#pageTitle');if(title){titleObserver=new MutationObserver(()=>requestAnimationFrame(sync));titleObserver.observe(title,{childList:true,subtree:true,characterData:true})}
 const nav=$('#sidebarNav');if(nav){navObserver=new MutationObserver(()=>requestAnimationFrame(sync));navObserver.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']})}
 const root=app();if(root){appObserver=new MutationObserver(()=>requestAnimationFrame(sync));appObserver.observe(root,{attributes:true,attributeFilter:['class','aria-hidden']})}
}

document.addEventListener('click',event=>{
 const target=event.target;if(!(target instanceof Element))return;
 if(target.closest('#mobileMenu')){if(!isMobile())return;event.preventDefault();event.stopImmediatePropagation();toggle();return}
 if(target.closest(`#${BACKDROP_ID}`)){event.preventDefault();close();return}
 if(isOpen()&&target.closest('#sidebarNav .nav-item,#sidebarNav button,#logoutButton'))setTimeout(close,0);
 if(target.closest('#sidebarNav .nav-item,#sidebarNav button'))setTimeout(sync,0);
},true);
document.addEventListener('keydown',event=>{if(isMobile()&&isOpen()&&event.key==='Escape'){event.preventDefault();close()}});
MEDIA.addEventListener?.('change',()=>{sync();installObservers()});
window.addEventListener('orientationchange',()=>setTimeout(sync,80),{passive:true});
window.addEventListener('pageshow',()=>{close();sync();installObservers()},{passive:true});
['salamat-authenticated','salamat-shell-ready','salamat-access-ready','salamat-navigation-canonical','salamat-mobile-navigation-complete'].forEach(name=>window.addEventListener(name,()=>{sync();installObservers()},{passive:true}));
function start(){sync();installObservers()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.SalamatMobileShell={version:VERSION,open,close,toggle,sync,get isOpen(){return isOpen()},get isMobile(){return isMobile()}};
})();
