(()=>{
'use strict';
if(window.__salamatMobileIntegrityV3)return;
window.__salamatMobileIntegrityV3=true;

const VERSION='3.0.0';
const NAV_ID='salamatMobileBottomNav';
const HEADER_ID='salamatMobileAppHeader';
const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';
const media=matchMedia('(max-width:760px)');
const registry=new Map();
let frame=0,activeTask=null,queued='',lastPointer='',lastPointerAt=0;

const normalize=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=v=>normalize(v).replace(/[\s\-_\/]+/g,'').toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const appVisible=()=>Boolean(document.querySelector('#appView:not(.hidden)'));
const nav=()=>document.getElementById(NAV_ID);
const sourceButtons=()=>[...document.querySelectorAll(SOURCE_SELECTOR)].filter(x=>x instanceof HTMLElement&&!x.disabled&&!x.hidden&&!x.classList.contains('hidden')&&x.getAttribute('aria-hidden')!=='true');

const aliases=new Map([
 ['داشبورد','داشبورد مدیریتی'],['داشبوردمدیریتی','داشبورد مدیریتی'],['داشبوردکاربر','داشبورد مدیریتی'],
 ['کاربران','کاربران و دسترسی‌ها'],['مدیریتکاربران','کاربران و دسترسی‌ها'],['دسترسیها','کاربران و دسترسی‌ها'],['نقشهاودسترسیها','کاربران و دسترسی‌ها'],['کاربرانودسترسیها','کاربران و دسترسی‌ها'],
 ['مراقبین','پرونده مراقبین'],['مدیریتمراقبین','پرونده مراقبین'],['پروندههایمراقبین','پرونده مراقبین'],['پرونده مراقبین','پرونده مراقبین'],
 ['قرارداد','قراردادها'],['حقوقودستمزد','حقوق و پرداخت'],['پرداخت','حقوق و پرداخت'],['آموزش','بانک آموزش'],
 ['ارزیابی','ارزیابی و پروانه'],['پایشوامتیازات','ارزیابی و پروانه'],['پشتیبانی','پشتیبانی و امنیت'],['امنیت','پشتیبانی و امنیت'],
 ['گزارش','گزارش‌ها'],['گزارشها','گزارش‌ها'],['تنظیمات','تنظیمات و لاگ'],['تنظیماتسامانه','تنظیمات و لاگ']
].map(([k,v])=>[compact(k),v]));
const canonical=v=>aliases.get(compact(v))||normalize(v);

const PATHS={
 home:'<path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.2V20h13V9.2M9.2 20v-6.2h5.6V20"/>',
 users:'<path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-1.4a4.2 4.2 0 0 0-3.2-4M16.6 3.2a4 4 0 0 1 0 7.6"/>',
 caregiver:'<circle cx="12" cy="7" r="3.7"/><path d="M5.2 20v-1.4A6.8 6.8 0 0 1 12 11.8a6.8 6.8 0 0 1 6.8 6.8V20"/>',
 briefcase:'<rect x="2.7" y="6.8" width="18.6" height="13.2" rx="2.4"/><path d="M8 6.8V4.3h8v2.5M2.7 12h18.6"/>',
 money:'<rect x="2.5" y="5.2" width="19" height="13.6" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.3h.01M18 14.7h.01"/>',
 book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M8 7h8M8 11h6"/>',
 chart:'<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 2 5-6"/>',
 message:'<path d="M20.5 15.5A3.5 3.5 0 0 1 17 19H8l-5 3V7a4 4 0 0 1 4-4h10a3.5 3.5 0 0 1 3.5 3.5Z"/><path d="M8 9h8M8 13h5"/>',
 report:'<path d="M14 2.7H6a2 2 0 0 0-2 2v14.6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.7Z"/><path d="M14 2.7v6h6M8 13h8M8 17h6"/>',
 settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19 14a2 2 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a2 2 0 0 0-2-.4 2 2 0 0 0-1.2 1.8v.2h-4v-.2a2 2 0 0 0-1.2-1.8 2 2 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a2 2 0 0 0 .4-2A2 2 0 0 0 2 12.8h-.2v-4H2A2 2 0 0 0 3.8 7a2 2 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a2 2 0 0 0 2 .4A2 2 0 0 0 9.4.8V.6h4v.2a2 2 0 0 0 1.2 1.8 2 2 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a2 2 0 0 0-.4 2 2 2 0 0 0 1.8 1.2h.2v4h-.2A2 2 0 0 0 19 14Z"/>',
 shield:'<path d="M12 22s8-3.8 8-10.2V5.2L12 2 4 5.2v6.6C4 18.2 12 22 12 22Z"/><path d="m8.7 12 2.1 2.1 4.7-4.8"/>',
 more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
};
const iconKey=label=>{const x=compact(canonical(label));if(x.includes('داشبورد'))return'home';if(x.includes('کاربر')||x.includes('دسترسی')||x.includes('نقش'))return'users';if(x.includes('مراقب'))return'caregiver';if(x.includes('قرارداد')||x.includes('ساعت')||x.includes('شیفت'))return'briefcase';if(x.includes('حقوق')||x.includes('پرداخت')||x.includes('کیفپول'))return'money';if(x.includes('آموزش')||x.includes('دوره'))return'book';if(x.includes('ارزیابی')||x.includes('امتیاز')||x.includes('کارنامه'))return'chart';if(x.includes('پشتیبانی')||x.includes('پیام')||x.includes('امنیت'))return'message';if(x.includes('گزارش'))return'report';if(x.includes('تنظیم'))return'settings';return'shield'};
const icon=key=>`<span class="sa-mobile-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${PATHS[key]||PATHS.shield}</svg></span>`;

const style=document.createElement('style');
style.id='salamatMobileIntegrityV3Styles';
style.textContent=`
@media(max-width:760px){
 html.salamat-mobile-app{--sa-green:#185B38;--sa-dark:#123F2A;--sa-soft:#EAF2ED;--sa-red:#D83429;--sa-red-soft:#FCECEA;--sa-ink:#173128;--sa-muted:#6B7E74;--sa-canvas:#F3F7F4;--sa-line:#DCE7E1}
 html.salamat-mobile-app,html.salamat-mobile-app body{background:var(--sa-canvas)!important;color:var(--sa-ink)!important}
 html.salamat-mobile-app #appView.app.hidden,html.salamat-history-landing #appView{display:none!important}
 html.salamat-mobile-app .main-area{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}
 html.salamat-mobile-app #${HEADER_ID}{z-index:154!important;background:rgba(255,255,255,.97)!important;border-bottom:1px solid rgba(24,91,56,.12)!important;box-shadow:0 8px 30px rgba(18,63,42,.08)!important}
 html.salamat-mobile-app #${HEADER_ID}:after{content:'';position:absolute;right:16px;bottom:-1px;width:38px;height:3px;border-radius:99px;background:var(--sa-red)}
 html.salamat-mobile-app #${HEADER_ID} .mapp-back,html.salamat-mobile-app #${HEADER_ID} .mapp-bell{color:var(--sa-green)!important;background:var(--sa-soft)!important;border:1px solid rgba(24,91,56,.09)!important}
 html.salamat-mobile-app #${HEADER_ID} .mapp-avatar{background:linear-gradient(145deg,var(--sa-green),var(--sa-dark))!important}
 html.salamat-mobile-app #${HEADER_ID} .mapp-bell i{background:var(--sa-red)!important}
 html.salamat-mobile-app #${NAV_ID}{z-index:155!important;right:8px!important;left:8px!important;height:76px!important;padding:7px!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;border:1px solid rgba(24,91,56,.14)!important;border-radius:25px!important;background:rgba(255,255,255,.98)!important;box-shadow:0 18px 48px rgba(18,63,42,.2)!important;pointer-events:auto!important;isolation:isolate!important;touch-action:manipulation!important}
 html.salamat-mobile-app #${NAV_ID} button{position:relative!important;height:61px!important;min-height:61px!important;padding:5px 2px!important;border:0!important;border-radius:18px!important;color:#718078!important;background:transparent!important;pointer-events:auto!important;touch-action:manipulation!important;font-size:8px!important;font-weight:900!important}
 html.salamat-mobile-app #${NAV_ID} button.active,html.salamat-mobile-app #${NAV_ID} button[aria-current="page"]{color:var(--sa-green)!important;background:linear-gradient(180deg,#F3F8F5,var(--sa-soft))!important;box-shadow:inset 0 0 0 1px rgba(24,91,56,.08)!important}
 html.salamat-mobile-app #${NAV_ID} button.active:after{content:'';position:absolute;top:4px;left:50%;width:5px;height:5px;border-radius:50%;background:var(--sa-red);transform:translateX(-50%)}
 html.salamat-mobile-app #${NAV_ID}[aria-busy="true"]{opacity:.72}
 html.salamat-mobile-app #${NAV_ID}[aria-busy="true"] button{pointer-events:none!important}
 html.salamat-mobile-app .sa-mobile-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:11px;color:var(--sa-green);background:var(--sa-soft);box-shadow:inset 0 0 0 1px rgba(24,91,56,.08)}
 html.salamat-mobile-app .sa-mobile-icon svg{width:19px!important;height:19px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}
 html.salamat-mobile-app #${NAV_ID} button.active .sa-mobile-icon{color:#fff;background:linear-gradient(145deg,var(--sa-green),var(--sa-dark));box-shadow:0 6px 15px rgba(24,91,56,.22)}
 html.salamat-mobile-app #sidebarNav [data-icon],html.salamat-mobile-app #content [data-icon],html.salamat-mobile-app .metric-icon{color:var(--sa-green)!important;background:var(--sa-soft)!important;border-radius:12px!important}
 html.salamat-mobile-app #content .danger [data-icon],html.salamat-mobile-app #content [data-danger] [data-icon],html.salamat-mobile-app #content .alert [data-icon]{color:var(--sa-red)!important;background:var(--sa-red-soft)!important}
 html.salamat-mobile-app .role-hero,html.salamat-mobile-app .adm-hero,html.salamat-mobile-app .caregiver-hero-panel,html.salamat-mobile-app .cp-page-head,html.salamat-mobile-app .ev-page-head{background:linear-gradient(145deg,var(--sa-green),var(--sa-dark))!important;box-shadow:0 16px 34px rgba(24,91,56,.22)!important}
 html.salamat-mobile-app .btn.primary,html.salamat-mobile-app button.primary,html.salamat-mobile-app .primary-action{background:var(--sa-green)!important;border-color:var(--sa-green)!important;color:#fff!important}
 html.salamat-mobile-app .btn.danger,html.salamat-mobile-app button.danger{background:var(--sa-red)!important;border-color:var(--sa-red)!important;color:#fff!important}
 html.salamat-mobile-app .surface,html.salamat-mobile-app .module-card,html.salamat-mobile-app .metric,html.salamat-mobile-app .adm-kpis>*{border:1px solid rgba(24,91,56,.07)!important;box-shadow:0 9px 26px rgba(18,63,42,.07)!important}
 html.salamat-mobile-app .adm-permissions{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;padding:10px!important}
 html.salamat-mobile-app .adm-permissions>div{padding:14px!important;border:1px solid var(--sa-line)!important;border-radius:18px!important;background:#fff!important}
 html.salamat-mobile-app .adm-permissions label{min-height:44px!important;padding:8px 0!important;display:flex!important;align-items:center!important;gap:9px!important;border-bottom:1px dashed var(--sa-line)!important}
 html.salamat-mobile-app .adm-permissions input{width:21px!important;height:21px!important;min-height:0!important;accent-color:var(--sa-green)!important}
 html.salamat-mobile-app table.sa-card-table{display:block!important;width:100%!important;min-width:0!important;border:0!important}
 html.salamat-mobile-app table.sa-card-table thead{display:none!important}
 html.salamat-mobile-app table.sa-card-table tbody{display:grid!important;gap:10px!important;padding:10px!important}
 html.salamat-mobile-app table.sa-card-table tr{display:grid!important;padding:12px!important;border:1px solid var(--sa-line)!important;border-radius:18px!important;background:#fff!important;box-shadow:0 6px 18px rgba(18,63,42,.05)!important}
 html.salamat-mobile-app table.sa-card-table td{display:grid!important;grid-template-columns:minmax(96px,35%) minmax(0,1fr)!important;gap:10px!important;padding:9px 0!important;border:0!important;border-bottom:1px dashed var(--sa-line)!important;white-space:normal!important;word-break:break-word!important}
 html.salamat-mobile-app table.sa-card-table td:last-child{border-bottom:0!important}
 html.salamat-mobile-app table.sa-card-table td:before{content:attr(data-sa-label);color:var(--sa-muted);font-size:9px;font-weight:900}
 html.salamat-mobile-app button,html.salamat-mobile-app a,html.salamat-mobile-app input,html.salamat-mobile-app select,html.salamat-mobile-app textarea{touch-action:manipulation}
 html.salamat-mobile-app button:focus-visible,html.salamat-mobile-app a:focus-visible,html.salamat-mobile-app input:focus-visible,html.salamat-mobile-app select:focus-visible,html.salamat-mobile-app textarea:focus-visible{outline:3px solid rgba(24,91,56,.2)!important;outline-offset:2px!important}
 html.salamat-mobile-menu-visible #${NAV_ID}{opacity:0!important;pointer-events:none!important;transform:translateY(110%)!important}
 @keyframes saNavError{25%{transform:translateX(3px)}50%{transform:translateX(-3px)}75%{transform:translateX(2px)}}
 html.salamat-mobile-app #${NAV_ID} .sa-nav-error{animation:saNavError .3s ease;background:var(--sa-red-soft)!important;color:var(--sa-red)!important}
}
`;
(document.head||document.documentElement).appendChild(style);

function labelOf(source){
 const explicit=source.getAttribute('aria-label')||source.dataset.label;
 if(explicit)return canonical(explicit);
 const clone=source.cloneNode(true);clone.querySelectorAll('b,[data-icon],svg,.badge,.count').forEach(x=>x.remove());
 return canonical(normalize(clone.textContent).slice(0,70)||'ماژول');
}
function routeId(source,index){return compact(source.dataset.moduleKey||source.dataset.module||source.dataset.route||source.dataset.view||source.dataset.key||source.id||labelOf(source))||`route${index}`}
function syncRegistry(){
 registry.clear();sourceButtons().forEach((source,index)=>{const id=routeId(source,index),label=labelOf(source);source.dataset.mobileRouteId=id;source.dataset.mobileRouteLabel=label;registry.set(id,{source,index,label})});
}
function activeSource(){return sourceButtons().find(x=>x.classList.contains('active')||x.getAttribute('aria-current')==='page')||null}
function markActive(source){sourceButtons().forEach(x=>{const on=x===source;x.classList.toggle('active',on);x.setAttribute('aria-current',on?'page':'false')})}
function fingerprint(){const c=document.querySelector('#content'),a=activeSource();return [normalize(document.querySelector('#pageTitle')?.textContent),a?.dataset.mobileRouteId||'',c?.firstElementChild?.className||'',normalize(c?.textContent).slice(0,240)].join('|')}
function titleMatches(a,b){a=compact(a);b=compact(b);return Boolean(a&&b&&(a===b||a.includes(b)||b.includes(a)||(a.includes('داشبورد')&&b.includes('داشبورد'))||(b==='کاربرانودسترسیها'&&a.includes('کاربران')&&a.includes('دسترسی'))))}
function adminContext(){return /مدیر|ادمین/.test(normalize(document.querySelector('#sidebarRole')?.textContent||document.querySelector('#topRole')?.textContent))}
const adminRoutes=new Set(['داشبورد مدیریتی','کاربران و دسترسی‌ها','پرونده مراقبین','قراردادها','حقوق و پرداخت','بانک آموزش','ارزیابی و پروانه','پشتیبانی و امنیت','گزارش‌ها','تنظیمات و لاگ']);

function repair(){
 const panel=document.querySelector('#sidebar'),open=panel?.classList.contains('open');
 if(!open){document.body?.classList.remove('salamat-mobile-nav-open');document.documentElement.classList.remove('salamat-mobile-menu-visible');const b=document.getElementById('mobileSidebarBackdrop');b?.classList.remove('open');b?.setAttribute('aria-hidden','true');const m=document.querySelector('.main-area');if(m){m.removeAttribute('aria-hidden');if('inert'in m)m.inert=false}}
 const n=nav(),since=Number(n?.dataset.busySince||0);if(since&&Date.now()-since>3500){n?.removeAttribute('aria-busy');n?.removeAttribute('data-busy-since');activeTask=null}
 [...document.querySelectorAll(`#${NAV_ID}`)].slice(0,-1).forEach(x=>x.remove());
 [...document.querySelectorAll(`#${HEADER_ID}`)].slice(0,-1).forEach(x=>x.remove());
}
function closeTransient(){window.SalamatMobileShell?.close?.({restoreFocus:false});repair();document.querySelectorAll('.drawer.open,.modal.open,.modal.show').forEach(x=>x.classList.remove('open','show'));document.querySelectorAll('.drawer-backdrop:not(.hidden)').forEach(x=>x.classList.add('hidden'))}
function annotateTables(root=document){root.querySelectorAll?.('table.data-table,table.adm-table,table.cp-payslip-table').forEach(t=>{const heads=[...t.querySelectorAll('thead th')].map(x=>normalize(x.textContent));if(!heads.length)return;t.querySelectorAll('tbody tr').forEach(r=>[...r.children].forEach((c,i)=>c.setAttribute('data-sa-label',heads[i]||`ستون ${i+1}`)));t.classList.add('sa-card-table')})}

function buildNav(){
 const n=nav();if(!n||!media.matches||!appVisible())return;syncRegistry();const sources=sourceButtons();if(!sources.length)return;const active=activeSource(),primary=sources.slice(0,4),signature=sources.map(x=>`${x.dataset.mobileRouteId}:${x===active}`).join('|');
 if(n.dataset.integritySignature!==signature){n.dataset.integritySignature=signature;n.innerHTML=primary.map(source=>{const id=source.dataset.mobileRouteId,label=source.dataset.mobileRouteLabel,on=source===active;return `<button type="button" data-mobile-route="${encodeURIComponent(id)}" aria-label="${label.replace(/"/g,'&quot;')}" aria-current="${on?'page':'false'}" class="${on?'active':''}">${icon(iconKey(label))}<span>${label}</span></button>`}).join('')+`<button type="button" data-mobile-more="true" aria-label="نمایش همه ماژول‌ها">${icon('more')}<span>بیشتر</span></button>`}
}
function resolveEntry(id){syncRegistry();return registry.get(id)||[...registry.values()].find(x=>compact(x.label)===compact(id))}
function nativeClick(source){try{HTMLElement.prototype.click.call(source);return true}catch{try{return source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}))}catch{return false}}}
async function wait(entry,before,timeout){const start=performance.now();while(performance.now()-start<timeout){const changed=fingerprint()!==before,on=activeSource()===entry.source,match=titleMatches(document.querySelector('#pageTitle')?.textContent,entry.label);if((changed&&on)||(match&&(changed||on)))return true;await sleep(55)}return false}
function adminFallback(entry){if(!adminContext()||!adminRoutes.has(entry.label)||typeof window.renderModule!=='function')return false;try{markActive(entry.source);window.renderModule({},[iconKey(entry.label),entry.label]);return true}catch{return false}}
function fail(button,entry){button?.classList.add('sa-nav-error');setTimeout(()=>button?.classList.remove('sa-nav-error'),360);window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-failed',{detail:{label:entry?.label||''}}));window.toast?.('بازکردن ماژول انجام نشد','مسیر موبایل تازه‌سازی شد؛ دوباره انتخاب کنید.')}
async function run(id,button){const entry=resolveEntry(id);if(!entry){fail(button);schedule();return false}closeTransient();const before=fingerprint();entry.source.focus?.({preventScroll:true});nativeClick(entry.source);let ok=await wait(entry,before,850);if(!ok){try{entry.source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}))}catch{}ok=await wait(entry,before,500)}if(!ok&&adminFallback(entry))ok=await wait(entry,before,1000);if(ok){markActive(entry.source);closeTransient();annotateTables();scrollTo({top:0,left:0,behavior:'auto'});window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-complete',{detail:{label:entry.label,id}}));return true}fail(button,entry);return false}
async function activate(id,button){if(activeTask){queued=id;return activeTask}const n=nav();n?.setAttribute('aria-busy','true');n?.setAttribute('data-busy-since',String(Date.now()));activeTask=(async()=>{try{return await run(id,button)}finally{n?.removeAttribute('aria-busy');n?.removeAttribute('data-busy-since');activeTask=null;schedule();if(queued){const next=queued;queued='';setTimeout(()=>void activate(next,nav()?.querySelector(`[data-mobile-route="${encodeURIComponent(next)}"]`)),0)}}})();return activeTask}
function buttonFrom(target){return target instanceof Element?target.closest(`#${NAV_ID} button`):null}
function handle(button,type){if(button.matches('[data-mobile-more],[data-more="true"]')){repair();window.SalamatMobileShell?.open?.({focus:true});return}const id=decodeURIComponent(button.dataset.mobileRoute||'');if(!id){schedule();return}if(type==='pointer'){lastPointer=id;lastPointerAt=performance.now()}void activate(id,button)}
function pointerup(e){if(e.pointerType==='mouse')return;const b=buttonFrom(e.target);if(!b)return;e.preventDefault();e.stopImmediatePropagation();handle(b,'pointer')}
function click(e){const b=buttonFrom(e.target);if(!b)return;e.preventDefault();e.stopImmediatePropagation();const id=decodeURIComponent(b.dataset.mobileRoute||'');if(id===lastPointer&&performance.now()-lastPointerAt<700)return;handle(b,'click')}
document.addEventListener('pointerup',pointerup,true);document.addEventListener('click',click,true);document.addEventListener('keydown',e=>{const b=buttonFrom(e.target);if(!b||!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();handle(b,'keyboard')},true);

function sync(){repair();const visible=media.matches&&appVisible()&&!document.documentElement.classList.contains('salamat-history-landing');nav()?.setAttribute('aria-hidden',visible?'false':'true');document.getElementById(HEADER_ID)?.setAttribute('aria-hidden',visible?'false':'true');if(!visible)return;buildNav();annotateTables()}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(sync)}
media.addEventListener?.('change',schedule);addEventListener('resize',schedule,{passive:true});addEventListener('pageshow',schedule);addEventListener('orientationchange',()=>setTimeout(schedule,90));document.addEventListener('visibilitychange',schedule);['salamat-authenticated','salamat-shell-ready','salamat-access-changed','salamat-history-restored','salamat-history-pushed','salamat-mobile-menu-closed','salamat-mobile-navigation-complete'].forEach(x=>addEventListener(x,schedule));
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','disabled','data-view','data-route','data-module','data-module-key','data-index']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.SalamatMobileAppStability={version:VERSION,sync:schedule,repair,openModules:()=>window.SalamatMobileShell?.open?.({focus:true}),navigate(label){syncRegistry();const c=canonical(label),entry=[...registry].find(([id,x])=>id===label||compact(x.label)===compact(c));return entry?activate(entry[0],null):Promise.resolve(false)},activateIndex(i){const s=sourceButtons()[Number(i)];return s?activate(s.dataset.mobileRouteId||routeId(s,Number(i)),null):Promise.resolve(false)},get routes(){syncRegistry();return [...registry.values()].map(x=>({id:x.source.dataset.mobileRouteId,label:x.label,index:x.index}))}};
})();
