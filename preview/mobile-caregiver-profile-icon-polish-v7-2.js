(()=>{
'use strict';
if(window.__salamatMobileCaregiverProfileIconPolishV72)return;
window.__salamatMobileCaregiverProfileIconPolishV72=true;
const VERSION='7.2.0';
const DESIGN_VERSION='8.1.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const PROFILE='salamatMobileRoleProfileV71';
const NAV='salamatMobileRoleBottomNavV71';
const LAUNCHER='salamatMobileRoleLauncherV71';
const STYLE_ID='salamatMobileGlassPhotoV81Styles';
const ATLAS='./media/mobile-glass-atlas.svg?v=8.1.0';
const SVG_NS='http://www.w3.org/2000/svg';
const $=(s,r=document)=>r?.querySelector?.(s)||null,$$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const caregiver=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب');
const norm=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=v=>norm(v).replace(/[\s\-_\/]+/g,'').toLowerCase();
let launcherObserver=null,profileObserver=null,syncFrame=0,styleFrame=0;

const I={
 profile:[['circle',{cx:'12',cy:'8',r:'4'}],['path',{d:'M4.5 21a7.5 7.5 0 0 1 15 0'}]],
 logout:[['path',{d:'M10 5H5v14h5'}],['path',{d:'M13 8l4 4-4 4M8 12h9'}]],
 modules:[['rect',{x:'3',y:'3',width:'7',height:'7',rx:'2'}],['rect',{x:'14',y:'3',width:'7',height:'7',rx:'2'}],['rect',{x:'3',y:'14',width:'7',height:'7',rx:'2'}],['rect',{x:'14',y:'14',width:'7',height:'7',rx:'2'}]]
};
function svg(k){const s=document.createElementNS(SVG_NS,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');for(const [t,a] of I[k]||I.modules){const n=document.createElementNS(SVG_NS,t);for(const [x,y] of Object.entries(a))n.setAttribute(x,y);s.appendChild(n)}return s}

function legacyKind(label,key=''){const v=norm(`${label} ${key}`);if(/کارنامه|ارزیابی|امتیاز|درجه|رتبه/.test(v))return'score';if(/آموزش|دوره/.test(v))return'training';if(/تقویم|شیفت/.test(v))return'calendar';if(/پشتیبانی|پرونده|تماس/.test(v))return'support';if(/حقوق|فیش/.test(v))return'payroll';if(/کیف پول|اعتبار|پاداش|مالی/.test(v))return'wallet';return'modules'}
function photoKind(label,key=''){
  const v=compact(`${label} ${key}`);
  if(/training|education|آموزش|دوره/.test(v))return'training';
  if(/support|پشتیبانی|تماس|پیام|conversation/.test(v))return'support';
  if(/evaluation|evaluate|score|license|ارزیابی|پروانه|کارنامه|امتیاز|رتبه|درجه/.test(v))return'evaluation';
  if(/financial|wallet|payroll|credit|loan|benefit|تسهیلات|اعتبار|وام|پاداش|مالی|کیفپول|حقوق|فیش|پرداخت/.test(v))return'financial';
  if(/contract|document|قرارداد|سند|مدرک/.test(v))return'contracts';
  if(/notification|notice|announcement|اطلاعیه|اعلان|خبر/.test(v))return'notifications';
  if(/profile|settings|account|پروفایل|تنظیم|حساب/.test(v))return'profile';
  return'jobs';
}

function styleText(){return `
@media(max-width:760px){
html.salamat-mobile-panel-v71{--mg81-green:#185B38;--mg81-dark:#123F2A;--mg81-red:#D83429;--mg81-ink:#20372C;--mg81-muted:#728278;--mg81-soft:#EAF4EE;--mg81-line:rgba(24,91,56,.10)}
html.salamat-mobile-panel-v71 #${LAUNCHER}{padding:12px 12px 32px!important;background:radial-gradient(circle at 8% 2%,rgba(32,137,78,.10),transparent 26%),linear-gradient(180deg,#f8fbf9 0%,#f4f7f5 54%,#f7f9f8 100%)!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-welcome{position:relative;overflow:hidden;padding:16px 16px 15px!important;border:1px solid rgba(255,255,255,.92)!important;border-radius:24px!important;color:var(--mg81-ink)!important;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(236,247,240,.94))!important;box-shadow:0 10px 28px rgba(18,63,42,.08),inset 0 1px 0 rgba(255,255,255,.98)!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-welcome:before{content:'';position:absolute;width:150px;height:150px;left:-66px;top:-74px;border-radius:50%;background:radial-gradient(circle,rgba(24,91,56,.16),rgba(24,91,56,0) 68%);pointer-events:none}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-welcome span{position:relative;padding:5px 9px!important;border-radius:999px!important;color:var(--mg81-green)!important;background:rgba(234,244,238,.92)!important;font-size:8px!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-welcome h2{position:relative;margin:9px 0 4px!important;color:var(--mg81-green)!important;font-size:17px!important;line-height:1.7!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-welcome p{position:relative;color:var(--mg81-muted)!important;font-size:9px!important;line-height:1.9!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-section-head{margin:18px 2px 10px!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-section-head strong{color:var(--mg81-ink)!important;font-size:12.5px!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-section-head small{color:var(--mg81-muted)!important;font-size:7.8px!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:13px 8px!important;align-items:start!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module{min-width:0!important;min-height:108px!important;padding:0 2px 2px!important;gap:6px!important;border:0!important;border-radius:22px!important;background:transparent!important;contain:layout paint;transform:translateZ(0);transition:transform .18s cubic-bezier(.2,.8,.2,1)!important;-webkit-tap-highlight-color:transparent!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module:active{transform:translate3d(0,2px,0) scale(.965)!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m71-module-icon,
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m73-admin-icon{position:relative!important;width:100%!important;max-width:112px!important;height:auto!important;aspect-ratio:4/3!important;flex:0 0 auto!important;overflow:hidden!important;border:1px solid rgba(255,255,255,.92)!important;border-radius:21px!important;background-color:#edf5f0!important;background-image:url('${ATLAS}')!important;background-repeat:no-repeat!important;background-size:400% 200%!important;box-shadow:0 9px 22px rgba(18,63,42,.10),inset 0 1px 0 rgba(255,255,255,.98)!important;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease!important;color:transparent!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m71-module-icon:before,
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m73-admin-icon:before{content:'';position:absolute;z-index:2;inset:0;border-radius:inherit;background:linear-gradient(145deg,rgba(255,255,255,.20) 0%,rgba(255,255,255,0) 40%,rgba(255,255,255,.10) 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.34);pointer-events:none}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m71-module-icon:after,
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m73-admin-icon:after{display:none!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m71-module-icon svg,
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module .m73-admin-icon svg{opacity:0!important;pointer-events:none!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module:active .m71-module-icon{transform:scale(.975)!important;box-shadow:0 5px 15px rgba(18,63,42,.09),inset 0 1px 0 rgba(255,255,255,.98)!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='training'] .m71-module-icon{background-position:0% 0%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='support'] .m71-module-icon{background-position:33.333% 0%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='evaluation'] .m71-module-icon{background-position:66.667% 0%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='financial'] .m71-module-icon{background-position:100% 0%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='jobs'] .m71-module-icon{background-position:0% 100%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='contracts'] .m71-module-icon{background-position:33.333% 100%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='notifications'] .m71-module-icon{background-position:66.667% 100%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module[data-glass-photo='profile'] .m71-module-icon{background-position:100% 100%!important}
html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-label{width:100%!important;min-height:24px!important;padding:0 1px!important;color:#243d32!important;font-size:8.9px!important;font-weight:950!important;line-height:1.55!important;text-align:center!important}

#${NAV}{right:10px!important;left:10px!important;bottom:calc(9px + env(safe-area-inset-bottom))!important;height:72px!important;padding:7px 8px!important;gap:2px!important;border:1px solid rgba(255,255,255,.88)!important;border-radius:24px!important;background:rgba(255,255,255,.78)!important;box-shadow:0 14px 36px rgba(18,63,42,.16),inset 0 1px 0 rgba(255,255,255,.92)!important;backdrop-filter:blur(12px) saturate(1.08)!important;-webkit-backdrop-filter:blur(12px) saturate(1.08)!important;overflow:visible!important}
#${NAV} button{height:56px!important;padding:4px 1px!important;gap:2px!important;border-radius:15px!important;color:#718078!important;background:transparent!important;font-size:7.7px!important;transition:transform .16s cubic-bezier(.2,.8,.2,1),color .16s ease,background .16s ease!important}
#${NAV} button:active{transform:scale(.94)!important}
#${NAV} .m71-nav-icon{width:31px!important;height:31px!important;min-width:31px!important;min-height:31px!important;border:1px solid transparent!important;border-radius:12px!important;color:#62756b!important;background:rgba(255,255,255,.28)!important;box-shadow:none!important;transition:transform .16s ease,color .16s ease,background .16s ease!important}
#${NAV} .m71-nav-icon svg{width:21px!important;height:21px!important;stroke-width:1.75!important}
#${NAV} button.active:not(.m71-home){color:var(--mg81-green)!important;background:rgba(234,244,238,.72)!important}
#${NAV} button.active:not(.m71-home) .m71-nav-icon{color:var(--mg81-green)!important;background:rgba(255,255,255,.72)!important;border-color:rgba(24,91,56,.09)!important}
#${NAV} button.active:not(.m71-home):after{top:3px!important;width:4px!important;height:4px!important;background:var(--mg81-red)!important}
#${NAV} button.m71-home{height:64px!important;transform:translateY(-11px)!important;background:transparent!important;overflow:visible!important}
#${NAV} button.m71-home:active{transform:translateY(-11px) scale(.95)!important}
#${NAV} button.m71-home .m71-nav-icon{width:55px!important;height:55px!important;min-width:55px!important;min-height:55px!important;max-width:55px!important;max-height:55px!important;flex:0 0 55px!important;border:1px solid rgba(24,91,56,.14)!important;border-radius:17px!important;color:#149652!important;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(232,247,238,.94))!important;box-shadow:0 9px 24px rgba(24,91,56,.18),inset 0 1px 0 rgba(255,255,255,1)!important}
#${NAV} button.m71-home .m71-nav-icon svg{width:25px!important;height:25px!important;stroke-width:1.85!important}
#${NAV} button.m71-home span:last-child{margin-top:-3px!important;color:var(--mg81-green)!important;font-size:7.5px!important}

.m72-caregiver-actions{display:grid;gap:9px;margin-top:15px}.m72-caregiver-actions button{min-height:52px;border:0;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:10px;font-weight:950;touch-action:manipulation}.m72-caregiver-actions svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.m72-open-profile{color:#185B38;background:#EAF2ED}.m72-logout{color:#fff;background:#D83429;box-shadow:0 10px 22px rgba(216,52,41,.2)}#${PROFILE}.m72-caregiver .m71-profile-actions{display:none!important}
}
@media(max-width:760px) and (prefers-reduced-motion:reduce){html.salamat-mobile-panel-v71 #${LAUNCHER} .m71-module,#${NAV} button,#${NAV} .m71-nav-icon{transition:none!important}}
`;}
function styles(){let s=$('#'+STYLE_ID);if(!s){s=document.createElement('style');s.id=STYLE_ID;s.dataset.designVersion=DESIGN_VERSION;s.textContent=styleText();document.head.appendChild(s)}return s}
function keepStyleLast(){cancelAnimationFrame(styleFrame);styleFrame=requestAnimationFrame(()=>{const s=$('#'+STYLE_ID);if(s&&s.parentElement===document.head)document.head.appendChild(s)})}

function polish(){if(!MEDIA.matches)return;$$(`#${LAUNCHER} .m71-module`).forEach(b=>{const label=$('.m71-label',b)?.textContent||b.textContent||'';const key=b.dataset.moduleKey||'';const photo=photoKind(label,key);if(b.dataset.glassPhoto!==photo)b.dataset.glassPhoto=photo;if(caregiver())b.dataset.caregiverIcon=legacyKind(label,key)})}
function profileActions(){if(!caregiver()||!MEDIA.matches)return;const layer=$('#'+PROFILE);if(!layer)return;layer.classList.add('m72-caregiver');const card=$('.m71-profile-card',layer);if(!card||$('.m72-caregiver-actions',card))return;const actions=document.createElement('div');actions.className='m72-caregiver-actions';const open=document.createElement('button');open.type='button';open.className='m72-open-profile';open.append(svg('profile'),document.createTextNode('مشاهده و ویرایش پروفایل حرفه‌ای'));open.addEventListener('click',()=>{layer.classList.remove('open');layer.setAttribute('aria-hidden','true');window.SalamatCaregiverSelfProfile?.open?.()});const out=document.createElement('button');out.type='button';out.className='m72-logout';out.append(svg('logout'),document.createTextNode('خروج از حساب کاربری'));out.addEventListener('click',()=>$('#logoutButton')?.click());actions.append(open,out);card.appendChild(actions)}
function intercept(e){if(!caregiver()||!MEDIA.matches)return;const b=e.target?.closest?.(`#${NAV} [data-nav-kind="profile"],#salamatMobileRoleHeaderV71 .m71-profile`);if(!b)return;e.preventDefault();e.stopImmediatePropagation();const layer=$('#'+PROFILE);if(!layer)return;profileActions();layer.classList.add('open');layer.setAttribute('aria-hidden','false')}
function installScopedObservers(){const launcher=$('#'+LAUNCHER);if(launcher&&(!launcherObserver||launcherObserver.__root!==launcher)){launcherObserver?.disconnect();launcherObserver=new MutationObserver(schedule);launcherObserver.__root=launcher;launcherObserver.observe(launcher,{childList:true,subtree:true})}const profile=$('#'+PROFILE);if(profile&&(!profileObserver||profileObserver.__root!==profile)){profileObserver?.disconnect();profileObserver=new MutationObserver(schedule);profileObserver.__root=profile;profileObserver.observe(profile,{childList:true,subtree:true})}}
function sync(){styles();polish();profileActions();installScopedObservers();keepStyleLast()}
function schedule(){cancelAnimationFrame(syncFrame);syncFrame=requestAnimationFrame(sync)}
function install(){document.addEventListener('click',intercept,true);window.addEventListener('salamat-authenticated',schedule);window.addEventListener('salamat-mobile-role-icon-shell-ready',schedule);window.addEventListener('salamat-mobile-v71-home',schedule);window.addEventListener('salamat-mobile-v71-route',schedule);window.addEventListener('salamat-shell-ready',schedule);window.addEventListener('salamat-access-ready',schedule);MEDIA.addEventListener?.('change',schedule);schedule();setTimeout(schedule,0);window.SalamatMobileCaregiverProfileIconPolish={version:VERSION,designVersion:DESIGN_VERSION,sync:schedule,photoKind}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();