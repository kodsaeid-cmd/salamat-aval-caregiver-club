(()=>{
'use strict';
if(window.__salamatMobilePanelPolishV73)return;
window.__salamatMobilePanelPolishV73=true;

const VERSION='7.3.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const NAV_ID='salamatMobileRoleBottomNavV71';
const LAUNCHER_ID='salamatMobileRoleLauncherV71';
const STYLE_ID='salamatMobilePanelPolishV73Styles';
const SVG_NS='http://www.w3.org/2000/svg';
let blurTimer=0;
let syncFrame=0;
let navObserver=null;
let launcherObserver=null;

const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=value=>normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase();
const role=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatStaffModuleRouter?.access?.user?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase();
const isCaregiver=()=>role()==='CAREGIVER'||normalize($('#sidebarRole')?.textContent).includes('مراقب');
const isAdmin=()=>role()==='ADMIN';

const ICONS={
 home:[['path',{d:'M4 10.8 12 4l8 6.8'}],['path',{d:'M6.5 9.5V20h11V9.5'}],['path',{d:'M9.5 20v-6h5v6'}]],
 profile:[['circle',{cx:'12',cy:'8',r:'3.6'}],['path',{d:'M5 20.5c.7-4.2 3.1-6.4 7-6.4s6.3 2.2 7 6.4'}]],
 users:[['circle',{cx:'9',cy:'8',r:'3.2'}],['path',{d:'M3.5 20c.5-3.7 2.5-5.6 5.5-5.6s5 1.9 5.5 5.6'}],['path',{d:'M16.3 5.8a3 3 0 0 1 0 5.7M17 14.6c2.2.5 3.5 2.2 3.8 5.4'}]],
 caregivers:[['path',{d:'M8.2 6.5a3.8 3.8 0 1 0 7.6 0'}],['path',{d:'M5.2 20c.4-4.2 2.7-6.4 6.8-6.4 4 0 6.4 2.2 6.8 6.4'}],['path',{d:'M12 2v3M10.5 3.5h3'}],['path',{d:'M18.6 7.5h2.8M20 6.1v2.8'}]],
 contracts:[['rect',{x:'5',y:'3',width:'14',height:'18',rx:'2.5'}],['path',{d:'M8 7h8M8 10.5h6'}],['path',{d:'m9 16 2 2 4.5-5'}]],
 payroll:[['rect',{x:'3',y:'5',width:'18',height:'14',rx:'3'}],['path',{d:'M3 9h18M7 14h4'}],['circle',{cx:'17',cy:'14',r:'1.7'}]],
 wallet:[['path',{d:'M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z'}],['path',{d:'M15.5 10H21v5h-5.5a2.5 2.5 0 0 1 0-5Z'}],['circle',{cx:'16.8',cy:'12.5',r:'.65'}]],
 training:[['path',{d:'m3 8.5 9-4 9 4-9 4z'}],['path',{d:'M7 10.8v5.3c2.8 2.1 7.2 2.1 10 0v-5.3'}],['path',{d:'M21 9v6'}]],
 evaluation:[['rect',{x:'5',y:'3.5',width:'14',height:'17',rx:'2.3'}],['path',{d:'M9 3.5V2h6v1.5'}],['path',{d:'m8 10 1.5 1.5L12 9M8 15h8'}]],
 support:[['path',{d:'M5 13v-1a7 7 0 0 1 14 0v1'}],['path',{d:'M5 12H3.8A1.8 1.8 0 0 0 2 13.8v2.4A1.8 1.8 0 0 0 3.8 18H6v-6zM19 12h1.2a1.8 1.8 0 0 1 1.8 1.8v2.4A1.8 1.8 0 0 1 20.2 18H18v-6z'}],['path',{d:'M18 18c-.8 2-2.5 3-5 3'}]],
 settings:[['path',{d:'M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M16 14v6'}]],
 calendar:[['rect',{x:'3.5',y:'5',width:'17',height:'16',rx:'2.5'}],['path',{d:'M8 2.5v5M16 2.5v5M3.5 10h17'}],['path',{d:'m8 15 2 2 5-5'}]],
 modules:[['rect',{x:'4',y:'4',width:'6',height:'6',rx:'1.8'}],['rect',{x:'14',y:'4',width:'6',height:'6',rx:'1.8'}],['rect',{x:'4',y:'14',width:'6',height:'6',rx:'1.8'}],['rect',{x:'14',y:'14',width:'6',height:'6',rx:'1.8'}]],
 reports:[['path',{d:'M5 20V10M10 20V5M15 20v-8M20 20V8'}],['path',{d:'M3 20h19'}]],
};
function svg(kind){const node=document.createElementNS(SVG_NS,'svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('aria-hidden','true');for(const [tag,attrs] of ICONS[kind]||ICONS.modules){const child=document.createElementNS(SVG_NS,tag);for(const [key,value] of Object.entries(attrs))child.setAttribute(key,value);node.appendChild(child)}return node}
function kindFor(value){const text=compact(value);if(text.includes('dashboard')||text.includes('داشبورد')||text==='home'||text.includes('خانه'))return'home';if(text.includes('profile')||text.includes('پروفایل'))return'profile';if(text.includes('users')||text.includes('کاربران')||text.includes('دسترسی'))return'users';if(text.includes('caregiver')||text.includes('مراقب'))return'caregivers';if(text.includes('contract')||text.includes('قرارداد'))return'contracts';if(text.includes('payroll')||text.includes('حقوق')||text.includes('پرداخت'))return'payroll';if(text.includes('financial')||text.includes('wallet')||text.includes('اعتبار')||text.includes('کیفپول'))return'wallet';if(text.includes('training')||text.includes('education')||text.includes('آموزش'))return'training';if(text.includes('evaluation')||text.includes('ارزیابی')||text.includes('پروانه')||text.includes('کارنامه'))return'evaluation';if(text.includes('support')||text.includes('پشتیبانی')||text.includes('امنیت'))return'support';if(text.includes('settings')||text.includes('تنظیم')||text.includes('لاگ'))return'settings';if(text.includes('calendar')||text.includes('تقویم')||text.includes('شیفت'))return'calendar';if(text.includes('report')||text.includes('گزارش'))return'reports';return'modules'}
function addStyles(){if($('#'+STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
@media(max-width:760px){
#${NAV_ID}{right:10px!important;left:10px!important;bottom:calc(9px + env(safe-area-inset-bottom))!important;height:70px!important;padding:7px 8px!important;gap:2px!important;border:1px solid rgba(24,91,56,.12)!important;border-radius:22px!important;background:rgba(255,255,255,.985)!important;box-shadow:0 12px 34px rgba(18,63,42,.16)!important;transition:transform .24s ease,opacity .18s ease!important;overflow:visible!important}
#${NAV_ID} button{height:55px!important;padding:4px 1px!important;gap:2px!important;border-radius:15px!important;font-size:7.8px!important;color:#77877e!important;background:transparent!important;transition:transform .16s ease,color .16s ease,background .16s ease!important}
#${NAV_ID} button:active{transform:scale(.94)!important}
#${NAV_ID} .m71-nav-icon{width:31px!important;height:31px!important;min-width:31px!important;min-height:31px!important;border-radius:12px!important;color:#5f7468!important;background:transparent!important;box-shadow:none!important;transition:.18s ease!important}
#${NAV_ID} .m71-nav-icon svg{width:21px!important;height:21px!important;stroke-width:1.75!important}
#${NAV_ID} button.active:not(.m71-home){color:#185B38!important;background:#f1f7f3!important}
#${NAV_ID} button.active:not(.m71-home) .m71-nav-icon{color:#185B38!important;background:#e5f1e9!important;box-shadow:none!important}
#${NAV_ID} button.active:not(.m71-home):after{top:3px!important;width:4px!important;height:4px!important;background:#D83429!important}
#${NAV_ID} button.m71-home{height:64px!important;min-width:0!important;transform:translateY(-12px)!important;background:transparent!important;overflow:visible!important}
#${NAV_ID} button.m71-home:active{transform:translateY(-12px) scale(.95)!important}
#${NAV_ID} button.m71-home .m71-nav-icon{width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;max-width:54px!important;max-height:54px!important;aspect-ratio:1/1!important;box-sizing:border-box!important;flex:0 0 54px!important;border:4px solid #F4F7F5!important;border-radius:999px!important;color:#fff!important;background:linear-gradient(145deg,#1b6841,#123f2a)!important;box-shadow:0 9px 22px rgba(24,91,56,.27)!important}
#${NAV_ID} button.m71-home .m71-nav-icon svg{width:23px!important;height:23px!important;stroke-width:1.8!important}
#${NAV_ID} button.m71-home span:last-child{margin-top:-3px!important;color:#185B38!important;font-size:7.5px!important}
body.salamat-mobile-input-focus #${NAV_ID}{transform:translateY(calc(100% + 34px))!important;opacity:0!important;pointer-events:none!important}
html.salamat-mobile-panel-v71 .main-area{padding-bottom:calc(112px + env(safe-area-inset-bottom))!important}
html.salamat-mobile-panel-v71 #content.content{padding-bottom:42px!important}
html.salamat-mobile-panel-v71 #${LAUNCHER_ID} .m73-admin-icon{position:relative;width:62px;height:62px;display:grid;place-items:center;border:1px solid rgba(24,91,56,.11);border-radius:19px;color:#185B38;background:linear-gradient(145deg,#fff,#f5faf7);box-shadow:0 8px 21px rgba(18,63,42,.075),inset 0 1px 0 #fff;overflow:hidden}
html.salamat-mobile-panel-v71 #${LAUNCHER_ID} .m73-admin-icon:after{content:'';position:absolute;right:8px;bottom:7px;width:8px;height:3px;border-radius:99px;background:#D83429}
html.salamat-mobile-panel-v71 #${LAUNCHER_ID} .m73-admin-icon svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
html.salamat-mobile-panel-v71 #${LAUNCHER_ID} .m71-module[data-admin-kind='support'] .m73-admin-icon,html.salamat-mobile-panel-v71 #${LAUNCHER_ID} .m71-module[data-admin-kind='payroll'] .m73-admin-icon{color:#C92F27;background:linear-gradient(145deg,#fff5f3,#fff);border-color:rgba(216,52,41,.13)}
body.salamat-mobile-login-v5 #loginView .join-network-block{display:block!important;width:100%!important;margin:14px 0 2px!important;padding:0!important}
body.salamat-mobile-login-v5 #loginView .join-network-action{width:100%!important;min-height:58px!important;padding:11px 13px!important;border:1px solid rgba(24,91,56,.14)!important;border-radius:16px!important;display:grid!important;grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;text-align:right!important;color:#185B38!important;background:linear-gradient(145deg,#edf7f1,#fff)!important;box-shadow:0 8px 20px rgba(18,63,42,.08)!important;font:inherit!important}
body.salamat-mobile-login-v5 #loginView .join-network-action>[data-icon]{width:40px!important;height:40px!important;border-radius:13px!important;display:grid!important;place-items:center!important;color:#fff!important;background:linear-gradient(145deg,#185B38,#123F2A)!important}
body.salamat-mobile-login-v5 #loginView .join-network-action strong{display:block!important;font-size:10.5px!important;font-weight:950!important;line-height:1.7!important;color:#174B31!important}
body.salamat-mobile-login-v5 #loginView .join-network-action small{display:block!important;margin-top:2px!important;font-size:7.8px!important;line-height:1.75!important;color:#6f8077!important}
}
`;document.head.appendChild(style)}
function polishNav(){if(!MEDIA.matches)return;const nav=$('#'+NAV_ID);if(!nav)return;$$('button',nav).forEach(button=>{const key=button.dataset.navKey||'';const label=button.getAttribute('aria-label')||button.textContent||'';const kind=button.classList.contains('m71-home')?'home':kindFor(`${key} ${label}`);const box=$('.m71-nav-icon',button);if(box&&box.dataset.m73Kind!==kind){box.replaceChildren(svg(kind));box.dataset.m73Kind=kind}})}
function polishAdminLauncher(){if(!MEDIA.matches||isCaregiver())return;const launcher=$('#'+LAUNCHER_ID);if(!launcher)return;$$('.m71-module',launcher).forEach(button=>{const key=button.dataset.moduleKey||'';const label=$('.m71-label',button)?.textContent||button.textContent||'';const kind=kindFor(`${key} ${label}`);button.dataset.adminKind=kind;const old=$('.m71-module-icon',button);if(!old)return;if(old.classList.contains('m73-admin-icon')&&old.dataset.m73Kind===kind)return;old.classList.add('m73-admin-icon');old.dataset.m73Kind=kind;old.replaceChildren(svg(kind))})}
function setKeyboardFocus(on){document.body?.classList.toggle('salamat-mobile-input-focus',Boolean(on))}
function onFocusIn(event){if(!MEDIA.matches)return;if(event.target?.matches?.('input,textarea,select,[contenteditable="true"]')){clearTimeout(blurTimer);setKeyboardFocus(true)}}
function onFocusOut(){if(!MEDIA.matches)return;clearTimeout(blurTimer);blurTimer=setTimeout(()=>{const active=document.activeElement;setKeyboardFocus(Boolean(active?.matches?.('input,textarea,select,[contenteditable="true"]')))},380)}
function openCaregiver(id){if(!id)return false;try{if(typeof window.SalamatCaregiverProfileEditor?.open==='function'){window.SalamatCaregiverProfileEditor.open(id);return true}window.dispatchEvent(new CustomEvent('salamat-open-caregiver-profile',{detail:{caregiverId:id}}));return true}catch{return false}}
function resultTarget(event){return event.target?.closest?.('.adp-row[data-caregiver-id],.cdp-row[data-caregiver-id]')||null}
function captureAdminResult(event){if(!MEDIA.matches||!isAdmin())return;const row=resultTarget(event);if(!row)return;const id=String(row.dataset.caregiverId||row.dataset.cdpId||'').trim();if(!id)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setKeyboardFocus(false);openCaregiver(id)}
function installScopedObservers(){const nav=$('#'+NAV_ID);if(nav&&!navObserver){navObserver=new MutationObserver(sync);navObserver.observe(nav,{childList:true,subtree:true})}const launcher=$('#'+LAUNCHER_ID);if(launcher&&!launcherObserver){launcherObserver=new MutationObserver(sync);launcherObserver.observe(launcher,{childList:true,subtree:true})}}
function sync(){cancelAnimationFrame(syncFrame);syncFrame=requestAnimationFrame(()=>{addStyles();polishNav();polishAdminLauncher();installScopedObservers()})}
function install(){addStyles();document.addEventListener('focusin',onFocusIn,true);document.addEventListener('focusout',onFocusOut,true);document.addEventListener('click',captureAdminResult,true);window.addEventListener('salamat-authenticated',sync);window.addEventListener('salamat-shell-ready',sync);window.addEventListener('salamat-access-ready',sync);window.addEventListener('salamat-mobile-role-icon-shell-ready',sync);window.addEventListener('salamat-mobile-v71-home',sync);window.addEventListener('salamat-mobile-v71-route',sync);MEDIA.addEventListener?.('change',()=>{if(!MEDIA.matches)setKeyboardFocus(false);sync()});sync();window.SalamatMobilePanelPolish={version:VERSION,sync}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();