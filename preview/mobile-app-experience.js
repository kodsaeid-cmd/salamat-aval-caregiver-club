(()=>{
'use strict';
if(window.__salamatMobileAppExperience)return;
window.__salamatMobileAppExperience=true;

const media=window.matchMedia('(max-width: 760px)');
const HEADER_ID='salamatMobileAppHeader';
const NAV_ID='salamatMobileBottomNav';
let frame=0;
let navSignature='';

const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const isAppVisible=()=>Boolean(document.querySelector('#appView:not(.hidden)'));
const sourceNav=()=>[...document.querySelectorAll('#sidebarNav .nav-item,#sidebarNav>button')];
const activeIndex=()=>sourceNav().findIndex(button=>button.classList.contains('active'));

const style=document.createElement('style');
style.id='salamatMobileAppExperienceStyles';
style.textContent=`
#${HEADER_ID},#${NAV_ID},#salamatMobileMenuClose{display:none}
@media(max-width:760px){
  html.salamat-mobile-app,html.salamat-mobile-app body{background:#eef4f0!important;color:#17231c!important}
  html.salamat-mobile-app body{min-height:100dvh!important;-webkit-tap-highlight-color:transparent}
  html.salamat-mobile-app #appView.app{display:block!important;min-height:100dvh!important;background:#eef4f0!important}
  html.salamat-mobile-app .main-area{width:100%!important;min-height:100dvh!important;padding-top:calc(70px + env(safe-area-inset-top))!important;padding-bottom:calc(82px + env(safe-area-inset-bottom))!important}
  html.salamat-mobile-app .topbar{display:none!important}
  #${HEADER_ID}{position:fixed;z-index:74;top:0;right:0;left:0;height:calc(64px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0;display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:9px;border-bottom:1px solid rgba(18,83,49,.08);background:rgba(255,255,255,.94);box-shadow:0 7px 28px rgba(20,70,43,.07);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
  #${HEADER_ID} .mapp-back,#${HEADER_ID} .mapp-bell,#${HEADER_ID} .mapp-avatar{width:42px;height:42px;border:0;border-radius:14px;display:grid;place-items:center;background:#f3f8f5;color:#08743f}
  #${HEADER_ID} .mapp-back svg,#${HEADER_ID} .mapp-bell svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  #${HEADER_ID} .mapp-heading{min-width:0;text-align:right}
  #${HEADER_ID} .mapp-heading strong,#${HEADER_ID} .mapp-heading small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #${HEADER_ID} .mapp-heading strong{font-size:14px;font-weight:900;color:#17231c}
  #${HEADER_ID} .mapp-heading small{margin-top:2px;font-size:9px;color:#7e8a83}
  #${HEADER_ID} .mapp-actions{display:flex;align-items:center;gap:7px}
  #${HEADER_ID} .mapp-bell{position:relative}
  #${HEADER_ID} .mapp-bell i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;color:#fff;background:#e52b31;font-size:7px;font-style:normal}
  #${HEADER_ID} .mapp-avatar{overflow:hidden;color:#fff;background:linear-gradient(145deg,#0f8c4d,#08743f);font-size:10px;font-weight:900}
  #${HEADER_ID} .mapp-avatar img{width:100%;height:100%;object-fit:cover}
  #${NAV_ID}{position:fixed;z-index:75;right:9px;left:9px;bottom:calc(8px + env(safe-area-inset-bottom));height:68px;padding:7px 6px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:3px;border:1px solid rgba(8,116,63,.1);border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 16px 46px rgba(11,69,39,.16);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
  #${NAV_ID} button{height:54px;min-width:0;padding:5px 2px;border:0;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#87928c;background:transparent;font-size:8px;font-weight:800;transition:transform .16s ease,background .16s ease,color .16s ease}
  #${NAV_ID} button:active{transform:scale(.94)}
  #${NAV_ID} button.active{color:#08743f;background:#eaf7f0}
  #${NAV_ID} button [data-icon],#${NAV_ID} button svg{width:21px;height:21px;display:block;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  #${NAV_ID} button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  html.salamat-mobile-app .content{width:100%!important;max-width:none!important;margin:0!important;padding:12px 11px 26px!important}
  html.salamat-mobile-app #content>*{animation:salamatMobilePageIn .22s ease both}
  @keyframes salamatMobilePageIn{from{opacity:.35;transform:translateY(7px)}to{opacity:1;transform:none}}
  html.salamat-mobile-app .surface,html.salamat-mobile-app .metric,html.salamat-mobile-app .module-card,html.salamat-mobile-app .caregiver-card,html.salamat-mobile-app .ev-kpi,html.salamat-mobile-app .adm-kpis>button,html.salamat-mobile-app .adm-kpis>div{border:0!important;border-radius:20px!important;background:#fff!important;box-shadow:0 8px 27px rgba(25,69,45,.07)!important}
  html.salamat-mobile-app .surface{overflow:hidden!important;margin-bottom:11px!important}
  html.salamat-mobile-app .surface-head{padding:15px!important;border-bottom:1px solid #edf1ef!important;align-items:center!important}
  html.salamat-mobile-app .surface-head h3{font-size:13px!important}
  html.salamat-mobile-app .surface-head p{font-size:9px!important;line-height:1.7!important}
  html.salamat-mobile-app .role-hero,html.salamat-mobile-app .caregiver-hero-panel,html.salamat-mobile-app .adm-hero,html.salamat-mobile-app .adm-eval-head,html.salamat-mobile-app .cp-page-head,html.salamat-mobile-app .cp-wallet-hero,html.salamat-mobile-app .cp-security-hero,html.salamat-mobile-app .ev-page-head{margin:0 0 12px!important;padding:19px 17px!important;border:0!important;border-radius:23px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:13px!important;color:#fff!important;background:linear-gradient(145deg,#0d8749,#075f35)!important;box-shadow:0 16px 34px rgba(8,116,63,.2)!important}
  html.salamat-mobile-app .role-hero h2,html.salamat-mobile-app .caregiver-hero-panel h2,html.salamat-mobile-app .adm-hero h2,html.salamat-mobile-app .adm-eval-head h2,html.salamat-mobile-app .cp-page-head h2,html.salamat-mobile-app .cp-security-hero h2,html.salamat-mobile-app .ev-page-head h2{margin:4px 0 7px!important;color:#fff!important;font-size:20px!important;line-height:1.55!important}
  html.salamat-mobile-app .role-hero p,html.salamat-mobile-app .caregiver-hero-panel p,html.salamat-mobile-app .adm-hero p,html.salamat-mobile-app .adm-eval-head p,html.salamat-mobile-app .cp-page-head p,html.salamat-mobile-app .cp-security-hero p,html.salamat-mobile-app .ev-page-head p{color:rgba(255,255,255,.82)!important;font-size:10px!important;line-height:1.9!important}
  html.salamat-mobile-app .cp-eyebrow,html.salamat-mobile-app .ev-page-head>div:first-child>span{color:#c9f1db!important;background:rgba(255,255,255,.12)!important;border-color:rgba(255,255,255,.16)!important}
  html.salamat-mobile-app .hero-score{width:100%!important;height:auto!important;padding:12px!important;display:flex!important;border:1px solid rgba(255,255,255,.17)!important;border-radius:17px!important;background:rgba(255,255,255,.1)!important;color:#fff!important}
  html.salamat-mobile-app .hero-score small{color:rgba(255,255,255,.72)!important}
  html.salamat-mobile-app .score-ring{width:62px!important;height:62px!important;background:conic-gradient(#fff 0 87%,rgba(255,255,255,.2) 87%)!important}
  html.salamat-mobile-app .score-ring:before{background:#0b7140!important}
  html.salamat-mobile-app .score-ring strong{color:#fff!important;font-size:18px!important}
  html.salamat-mobile-app .hero-actions,html.salamat-mobile-app .adm-hero-actions,html.salamat-mobile-app .adm-report-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;width:100%!important}
  html.salamat-mobile-app .hero-actions .btn,html.salamat-mobile-app .adm-hero-actions .btn,html.salamat-mobile-app .adm-report-actions .btn{width:100%!important;min-height:44px!important;border-radius:13px!important}
  html.salamat-mobile-app .hero-actions .btn.primary,html.salamat-mobile-app .adm-hero .btn.primary{color:#08743f!important;background:#fff!important}
  html.salamat-mobile-app .hero-actions .btn.outline,html.salamat-mobile-app .adm-hero .btn.outline{color:#fff!important;border-color:rgba(255,255,255,.28)!important;background:rgba(255,255,255,.08)!important}
  html.salamat-mobile-app .metrics,html.salamat-mobile-app .caregiver-metrics,html.salamat-mobile-app .adm-kpis,html.salamat-mobile-app .ev-kpis{width:calc(100% + 22px)!important;margin:0 -11px 13px!important;padding:2px 11px 9px!important;display:flex!important;grid-template-columns:none!important;gap:10px!important;overflow-x:auto!important;scroll-snap-type:x mandatory;overscroll-behavior-inline:contain;scrollbar-width:none}
  html.salamat-mobile-app .metrics::-webkit-scrollbar,html.salamat-mobile-app .caregiver-metrics::-webkit-scrollbar,html.salamat-mobile-app .adm-kpis::-webkit-scrollbar,html.salamat-mobile-app .ev-kpis::-webkit-scrollbar{display:none}
  html.salamat-mobile-app .metric,html.salamat-mobile-app .adm-kpis>button,html.salamat-mobile-app .adm-kpis>div,html.salamat-mobile-app .ev-kpi{flex:0 0 min(78vw,300px)!important;min-height:112px!important;padding:15px!important;scroll-snap-align:start}
  html.salamat-mobile-app .dashboard-grid,html.salamat-mobile-app .caregiver-dashboard-grid,html.salamat-mobile-app .cp-two-column,html.salamat-mobile-app .cp-support-layout,html.salamat-mobile-app .adm-grid.two,html.salamat-mobile-app .ev-grid.two,html.salamat-mobile-app .ev-grid.three{display:block!important}
  html.salamat-mobile-app .module-grid,html.salamat-mobile-app .cp-action-grid,html.salamat-mobile-app .cp-course-grid,html.salamat-mobile-app .cp-stat-grid,html.salamat-mobile-app .ev-q-grid,html.salamat-mobile-app .ev-summary-numbers{padding:10px!important;display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
  html.salamat-mobile-app .module-card,html.salamat-mobile-app .cp-action-card,html.salamat-mobile-app .cp-course-card,html.salamat-mobile-app .ev-q-card{min-height:88px!important;padding:13px!important;border-radius:17px!important;box-shadow:none!important;border:1px solid #edf1ef!important;display:grid!important;grid-template-columns:42px minmax(0,1fr) auto!important;align-items:center!important;gap:11px!important}
  html.salamat-mobile-app .module-card>div,html.salamat-mobile-app .cp-action-card>div{min-width:0!important}
  html.salamat-mobile-app .module-card strong,html.salamat-mobile-app .cp-action-card strong{font-size:11px!important}
  html.salamat-mobile-app .module-card small,html.salamat-mobile-app .cp-action-card small{font-size:8px!important;line-height:1.7!important}
  html.salamat-mobile-app .module-card button,html.salamat-mobile-app .cp-link-btn{min-height:38px!important;border:0!important;border-radius:11px!important;background:#edf8f2!important}
  html.salamat-mobile-app .activity-list,html.salamat-mobile-app .cp-today-list,html.salamat-mobile-app .cp-transaction-list,html.salamat-mobile-app .cp-shift-list{padding:8px 12px 13px!important}
  html.salamat-mobile-app .activity-item,html.salamat-mobile-app .cp-today-item,html.salamat-mobile-app .cp-transaction,html.salamat-mobile-app .cp-shift-row{padding:13px 3px!important;border:0!important;border-bottom:1px solid #edf1ef!important;border-radius:0!important;background:transparent!important}
  html.salamat-mobile-app .adm-toolbar,html.salamat-mobile-app .ev-toolbar{padding:13px!important;border:0!important;border-radius:19px!important;display:grid!important;grid-template-columns:1fr!important;align-items:stretch!important;gap:10px!important;background:#fff!important;box-shadow:0 8px 27px rgba(25,69,45,.07)!important}
  html.salamat-mobile-app .adm-toolbar label,html.salamat-mobile-app .ev-toolbar label,html.salamat-mobile-app .adm-toolbar select,html.salamat-mobile-app .ev-toolbar select,html.salamat-mobile-app .ev-toolbar input,html.salamat-mobile-app .adm-search{width:100%!important;min-width:0!important}
  html.salamat-mobile-app input,html.salamat-mobile-app select,html.salamat-mobile-app textarea{min-height:48px!important;padding:11px 13px!important;border:1px solid #dfe8e3!important;border-radius:13px!important;background:#fff!important;font-size:16px!important;box-shadow:none!important}
  html.salamat-mobile-app textarea{min-height:100px!important}
  html.salamat-mobile-app button,html.salamat-mobile-app .btn{min-height:44px}
  html.salamat-mobile-app .btn{border-radius:13px!important;font-size:10px!important}
  html.salamat-mobile-app .module-summary{padding:10px!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
  html.salamat-mobile-app .summary-card{padding:14px!important;border:0!important;border-radius:16px!important;background:#f3f8f5!important}
  html.salamat-mobile-app .summary-card:last-child:nth-child(odd){grid-column:1/-1}
  html.salamat-mobile-app table.mapp-card-table{display:block!important;width:100%!important;min-width:0!important;border:0!important}
  html.salamat-mobile-app table.mapp-card-table thead{display:none!important}
  html.salamat-mobile-app table.mapp-card-table tbody{padding:10px!important;display:grid!important;gap:10px!important}
  html.salamat-mobile-app table.mapp-card-table tr{padding:12px 13px!important;display:grid!important;gap:0!important;border:1px solid #e6ece9!important;border-radius:17px!important;background:#fff!important;box-shadow:0 5px 18px rgba(25,69,45,.045)!important}
  html.salamat-mobile-app table.mapp-card-table td{min-height:41px!important;padding:9px 0!important;border:0!important;border-bottom:1px dashed #e8eeea!important;display:grid!important;grid-template-columns:minmax(92px,34%) minmax(0,1fr)!important;align-items:center!important;gap:10px!important;white-space:normal!important;text-align:right!important;font-size:10px!important}
  html.salamat-mobile-app table.mapp-card-table td:last-child{border-bottom:0!important}
  html.salamat-mobile-app table.mapp-card-table td:before{content:attr(data-mobile-label);color:#7d8982;font-size:8px;font-weight:800}
  html.salamat-mobile-app table.mapp-card-table td>button,html.salamat-mobile-app table.mapp-card-table td .adm-row-actions{justify-self:start}
  html.salamat-mobile-app .table-wrap,html.salamat-mobile-app .surface.table-wrap,html.salamat-mobile-app .adm-module .table-wrap{overflow:visible!important}
  html.salamat-mobile-app .drawer{top:auto!important;right:0!important;bottom:0!important;left:0!important;width:100%!important;max-width:none!important;height:min(88dvh,760px)!important;max-height:88dvh!important;border-radius:26px 26px 0 0!important;transform:translate3d(0,105%,0)!important;box-shadow:0 -22px 70px rgba(10,52,30,.22)!important}
  html.salamat-mobile-app .drawer.open{transform:translate3d(0,0,0)!important}
  html.salamat-mobile-app .drawer-head{min-height:74px!important;border-radius:26px 26px 0 0!important}
  html.salamat-mobile-app .drawer-body{height:calc(88dvh - 74px)!important;max-height:calc(88dvh - 74px)!important;padding:14px!important}
  html.salamat-mobile-app #sidebar.sidebar{top:auto!important;right:0!important;bottom:0!important;left:0!important;width:100%!important;max-width:none!important;height:min(88dvh,760px)!important;max-height:88dvh!important;padding:17px 14px calc(13px + env(safe-area-inset-bottom))!important;border:0!important;border-radius:28px 28px 0 0!important;transform:translate3d(0,105%,0)!important;box-shadow:0 -25px 70px rgba(8,45,27,.24)!important}
  html.salamat-mobile-app #sidebar.sidebar.open{transform:translate3d(0,0,0)!important}
  html.salamat-mobile-app #sidebar .sidebar-brand{padding-left:46px!important}
  html.salamat-mobile-app #sidebarNav.sidebar-nav{padding:5px 0 11px!important;display:grid!important;grid-template-columns:1fr 1fr!important;align-content:start!important;gap:8px!important}
  html.salamat-mobile-app #sidebarNav.sidebar-nav>.nav-item,html.salamat-mobile-app #sidebarNav.sidebar-nav>button{height:58px!important;min-height:58px!important;max-height:58px!important;padding:0 12px!important;border:1px solid #e7ece9!important;border-radius:16px!important;color:#526159!important;background:#f8fbf9!important;box-shadow:none!important}
  html.salamat-mobile-app #sidebarNav.sidebar-nav>.nav-item.active,html.salamat-mobile-app #sidebarNav.sidebar-nav>button.active{color:#fff!important;border-color:#08743f!important;background:linear-gradient(145deg,#0d8749,#08743f)!important}
  #salamatMobileMenuClose{position:absolute;z-index:2;top:18px;left:14px;width:42px;height:42px;border:0;border-radius:14px;display:grid;place-items:center;color:#08743f;background:#edf8f2}
  #salamatMobileMenuClose svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
  html.salamat-mobile-app .caregiver-signup-dialog{width:100%!important;max-width:none!important;max-height:94dvh!important;align-self:end!important;margin:0!important;border-radius:28px 28px 0 0!important}
  html.salamat-mobile-app .toast{right:11px!important;left:11px!important;bottom:calc(88px + env(safe-area-inset-bottom))!important;border-radius:17px!important}
  html.salamat-mobile-app .mapp-scroll-row{scrollbar-width:none}
}
@media(max-width:390px){
  #${NAV_ID}{right:6px;left:6px;gap:1px}
  #${NAV_ID} button{font-size:7px}
  html.salamat-mobile-app #sidebarNav.sidebar-nav{grid-template-columns:1fr!important}
  html.salamat-mobile-app .hero-actions,html.salamat-mobile-app .adm-hero-actions,html.salamat-mobile-app .adm-report-actions{grid-template-columns:1fr!important}
}
@media(prefers-reduced-motion:reduce){html.salamat-mobile-app #content>*,#${NAV_ID} button{animation:none!important;transition:none!important}}
`;
(document.head||document.documentElement).appendChild(style);

function iconMarkup(type){
  if(type==='back')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  if(type==='bell')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  if(type==='more')return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
}

function ensureHeader(){
  let header=document.getElementById(HEADER_ID);
  if(header)return header;
  header=document.createElement('header');
  header.id=HEADER_ID;
  header.setAttribute('aria-label','نوار بالای اپلیکیشن');
  header.innerHTML=`<button class="mapp-back" type="button" aria-label="بازگشت">${iconMarkup('back')}</button><div class="mapp-heading"><strong>باشگاه مراقبین</strong><small>سلامت اول</small></div><div class="mapp-actions"><button class="mapp-bell" type="button" aria-label="اعلان‌ها">${iconMarkup('bell')}<i>۳</i></button><span class="mapp-avatar">س‌ا</span></div>`;
  const appView=document.querySelector('#appView');
  (appView||document.body).appendChild(header);
  header.querySelector('.mapp-back').addEventListener('click',()=>{
    if(window.SalamatInternalHistory?.back)window.SalamatInternalHistory.back();
    else history.back();
  });
  header.querySelector('.mapp-bell').addEventListener('click',()=>{
    const original=document.querySelector('.topbar .notification');
    if(original)original.click();
    else window.toast?.('اعلان‌ها','در حال حاضر اعلان جدیدی وجود ندارد.');
  });
  return header;
}

function ensureBottomNav(){
  let nav=document.getElementById(NAV_ID);
  if(nav)return nav;
  nav=document.createElement('nav');
  nav.id=NAV_ID;
  nav.setAttribute('aria-label','ناوبری اصلی اپلیکیشن');
  const appView=document.querySelector('#appView');
  (appView||document.body).appendChild(nav);
  nav.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.dataset.more==='true'){
      window.SalamatMobileShell?.open?.();
      return;
    }
    const index=Number(button.dataset.navIndex);
    const source=sourceNav()[index];
    if(source){
      source.click();
      window.SalamatMobileShell?.close?.({restoreFocus:false});
      window.scrollTo({top:0,left:0,behavior:'auto'});
    }
  });
  return nav;
}

function ensureMenuClose(){
  const sidebar=document.querySelector('#sidebar');
  if(!sidebar||document.querySelector('#salamatMobileMenuClose'))return;
  const close=document.createElement('button');
  close.id='salamatMobileMenuClose';
  close.type='button';
  close.setAttribute('aria-label','بستن فهرست ماژول‌ها');
  close.innerHTML=iconMarkup('close');
  close.addEventListener('click',()=>window.SalamatMobileShell?.close?.());
  sidebar.prepend(close);
}

function navIcon(source){
  const holder=source.querySelector('[data-icon]');
  if(holder)return holder.outerHTML;
  const svg=source.querySelector('svg');
  return svg?svg.outerHTML:'<span aria-hidden="true">●</span>';
}

function navLabel(source){
  const clone=source.cloneNode(true);
  clone.querySelectorAll('b,[data-icon],svg').forEach(node=>node.remove());
  return normalize(clone.textContent).slice(0,18)||'ماژول';
}

function rebuildBottomNav(){
  const nav=ensureBottomNav();
  const sources=sourceNav();
  const signature=sources.map(source=>`${navLabel(source)}:${source.classList.contains('active')}`).join('|');
  if(signature===navSignature)return;
  navSignature=signature;
  const primary=sources.slice(0,4);
  nav.innerHTML=primary.map((source,index)=>`<button type="button" data-nav-index="${index}" class="${source.classList.contains('active')?'active':''}">${navIcon(source)}<span>${navLabel(source)}</span></button>`).join('')+`<button type="button" data-more="true" class="${activeIndex()>=4?'active':''}">${iconMarkup('more')}<span>بیشتر</span></button>`;
}

function annotateTables(root=document){
  root.querySelectorAll?.('table.data-table,table.cp-payslip-table,table.adm-table').forEach(table=>{
    if(table.classList.contains('mapp-card-table'))return;
    const labels=[...table.querySelectorAll('thead th')].map(th=>normalize(th.textContent));
    if(!labels.length)return;
    table.querySelectorAll('tbody tr').forEach(row=>{
      [...row.children].forEach((cell,index)=>cell.setAttribute('data-mobile-label',labels[index]||`ستون ${index+1}`));
    });
    table.classList.add('mapp-card-table');
  });
}

function syncHeader(){
  const header=ensureHeader();
  const title=normalize(document.querySelector('#pageTitle')?.textContent)||'باشگاه مراقبین';
  const role=normalize(document.querySelector('#topRole')?.textContent||document.querySelector('#sidebarRole')?.textContent)||'سلامت اول';
  header.querySelector('.mapp-heading strong').textContent=title;
  header.querySelector('.mapp-heading small').textContent=role;
  const sourceAvatar=document.querySelector('#topAvatar');
  const avatar=header.querySelector('.mapp-avatar');
  if(sourceAvatar?.querySelector('img'))avatar.innerHTML=sourceAvatar.querySelector('img').outerHTML;
  else avatar.textContent=normalize(sourceAvatar?.textContent||document.querySelector('#sidebarAvatar')?.textContent||'س‌ا').slice(0,3);
  const badge=document.querySelector('.topbar .notification i');
  const mobileBadge=header.querySelector('.mapp-bell i');
  if(mobileBadge)mobileBadge.textContent=normalize(badge?.textContent||'۳');
}

function activate(){
  const active=media.matches&&isAppVisible();
  document.documentElement.classList.toggle('salamat-mobile-app',active);
  document.body?.classList.toggle('salamat-mobile-app',active);
  if(!active)return;
  ensureHeader();
  ensureBottomNav();
  ensureMenuClose();
  rebuildBottomNav();
  syncHeader();
  annotateTables(document);
}

function schedule(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(activate);
}

media.addEventListener?.('change',schedule);
window.addEventListener('pageshow',schedule);
window.addEventListener('orientationchange',()=>setTimeout(schedule,90));
window.addEventListener('salamat-authenticated',schedule);
window.addEventListener('salamat-shell-ready',schedule);
window.addEventListener('salamat-history-restored',schedule);
window.addEventListener('salamat-history-pushed',schedule);
window.addEventListener('salamat-mobile-menu-opened',()=>document.documentElement.classList.add('salamat-mobile-menu-visible'));
window.addEventListener('salamat-mobile-menu-closed',()=>document.documentElement.classList.remove('salamat-mobile-menu-visible'));

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','data-view','data-route']});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

window.SalamatMobileApp={version:'1.0.0',sync:schedule,annotateTables,rebuildNavigation:rebuildBottomNav};
})();
