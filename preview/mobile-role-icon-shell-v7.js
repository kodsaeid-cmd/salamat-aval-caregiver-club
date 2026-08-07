(()=>{
'use strict';
if(window.__salamatMobileRoleIconShellV7)return;
window.__salamatMobileRoleIconShellV7=true;

const VERSION='7.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const HEADER_ID='salamatMobileRoleHeaderV7';
const LAUNCHER_ID='salamatMobileRoleLauncherV7';
const NAV_ID='salamatMobileRoleBottomNavV7';
const PROFILE_ID='salamatMobileRoleProfileV7';
const STATE_KEY='__salamatMobileRoleIconV7';
const STAFF_HIDDEN=new Set(['staff.reports']);
const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';
const SVG_NS='http://www.w3.org/2000/svg';
let frame=0;
let signature='';
let activeKey='';
let homeMode=true;
let exiting=false;
let staffReloadRequested=false;
let restoring=false;

const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const normalize=value=>String(value||'')
 .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
 .replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=value=>normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase();
const appVisible=()=>Boolean($('#appView:not(.hidden)'));
const roleRaw=()=>String(
 window.SalamatBackend?.getCurrentUser?.()?.role||
 window.SalamatStaffModuleRouter?.access?.user?.role||
 window.selectedRole||$('#sidebarRole')?.textContent||''
).toUpperCase();
const isCaregiver=()=>roleRaw()==='CAREGIVER'||normalize($('#sidebarRole')?.textContent).includes('مراقب');
const roleLabel=()=>{
 const role=roleRaw();
 const map={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبانی',EVALUATOR:'ارزیاب',EDUCATION:'آموزش',OPERATIONS:'عملیات',CAREGIVER:'مراقب'};
 return map[role]||normalize($('#sidebarRole')?.textContent)||'کاربر سلامت اول';
};
const userName=()=>normalize(
 window.SalamatBackend?.getCurrentUser?.()?.fullName||
 window.SalamatBackend?.getCurrentUser?.()?.name||
 window.SalamatStaffModuleRouter?.access?.user?.fullName||
 window.SalamatStaffModuleRouter?.access?.user?.name||
 $('#sidebarName')?.textContent||$('#topName')?.textContent||'کاربر سلامت اول'
);
const firstName=()=>userName().split(/\s+/).filter(Boolean)[0]||'همراه';

const ICONS={
 home:[['path',{d:'m3 11 9-8 9 8'}],['path',{d:'M5 10v10h14V10M9 20v-6h6v6'}]],
 profile:[['circle',{cx:'12',cy:'8',r:'4'}],['path',{d:'M4 22a8 8 0 0 1 16 0'}]],
 modules:[['rect',{x:'3',y:'3',width:'7',height:'7',rx:'2'}],['rect',{x:'14',y:'3',width:'7',height:'7',rx:'2'}],['rect',{x:'3',y:'14',width:'7',height:'7',rx:'2'}],['rect',{x:'14',y:'14',width:'7',height:'7',rx:'2'}]],
 users:[['circle',{cx:'9',cy:'7',r:'4'}],['path',{d:'M2 21v-1.5A5.5 5.5 0 0 1 7.5 14h3A5.5 5.5 0 0 1 16 19.5V21'}],['path',{d:'M17 4.2a4 4 0 0 1 0 7.6M18 14.4a5 5 0 0 1 4 4.9V21'}]],
 caregiver:[['circle',{cx:'12',cy:'7',r:'3.7'}],['path',{d:'M5.2 21v-2.2A6.8 6.8 0 0 1 12 12a6.8 6.8 0 0 1 6.8 6.8V21'}],['path',{d:'M12 2v3M10.5 3.5h3'}]],
 briefcase:[['rect',{x:'2.7',y:'6.8',width:'18.6',height:'13.2',rx:'2.4'}],['path',{d:'M8 6.8V4.3h8v2.5M2.7 12h18.6'}]],
 wallet:[['rect',{x:'2.5',y:'5',width:'19',height:'14',rx:'2.5'}],['path',{d:'M16 10h5.5v5H16a2.5 2.5 0 0 1 0-5Z'}],['circle',{cx:'17',cy:'12.5',r:'.7'}]],
 book:[['path',{d:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z'}],['path',{d:'M8 7h8M8 11h6'}]],
 chart:[['path',{d:'M4 20V4M4 20h16'}],['path',{d:'m7 15 4-4 3 2 5-6'}]],
 support:[['path',{d:'M20.5 15.5A3.5 3.5 0 0 1 17 19H8l-5 3V7a4 4 0 0 1 4-4h10a3.5 3.5 0 0 1 3.5 3.5Z'}],['path',{d:'M8 9h8M8 13h5'}]],
 calendar:[['rect',{x:'3',y:'4',width:'18',height:'17',rx:'2'}],['path',{d:'M16 2v4M8 2v4M3 10h18'}]],
 settings:[['circle',{cx:'12',cy:'12',r:'3.2'}],['path',{d:'M19 14a2 2 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a2 2 0 0 0-2-.4 2 2 0 0 0-1.2 1.8v.2h-4v-.2a2 2 0 0 0-1.2-1.8 2 2 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a2 2 0 0 0 .4-2A2 2 0 0 0 2 12.8h-.2v-4H2A2 2 0 0 0 3.8 7a2 2 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a2 2 0 0 0 2 .4A2 2 0 0 0 9.4.8V.6h4v.2a2 2 0 0 0 1.2 1.8 2 2 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a2 2 0 0 0-.4 2 2 2 0 0 0 1.8 1.2h.2v4h-.2A2 2 0 0 0 19 14Z'}]],
 shield:[['path',{d:'M12 22s8-3.8 8-10.2V5.2L12 2 4 5.2v6.6C4 18.2 12 22 12 22Z'}],['path',{d:'m8.7 12 2.1 2.1 4.7-4.8'}]],
 back:[['path',{d:'m9 18 6-6-6-6'}]],
 close:[['path',{d:'M18 6 6 18M6 6l12 12'}]],
 logout:[['path',{d:'M10 17l5-5-5-5M15 12H3'}],['path',{d:'M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5'}]],
};
function iconKind(model){
 const value=compact(`${model?.key||''} ${model?.label||''} ${model?.icon||''}`);
 if(value.includes('dashboard')||value.includes('داشبورد'))return'home';
 if(value.includes('calendar')||value.includes('تقویم'))return'calendar';
 if(value.includes('user')||value.includes('کاربر')||value.includes('دسترسی'))return'users';
 if(value.includes('caregiver')||value.includes('مراقب'))return'caregiver';
 if(value.includes('contract')||value.includes('قرارداد')||value.includes('شیفت')||value.includes('ساعت'))return'briefcase';
 if(value.includes('pay')||value.includes('financial')||value.includes('wallet')||value.includes('حقوق')||value.includes('پرداخت')||value.includes('کیفپول')||value.includes('اعتبار'))return'wallet';
 if(value.includes('train')||value.includes('education')||value.includes('آموزش')||value.includes('دوره'))return'book';
 if(value.includes('evalu')||value.includes('score')||value.includes('کارنامه')||value.includes('ارزیابی')||value.includes('امتیاز'))return'chart';
 if(value.includes('support')||value.includes('پشتیبانی')||value.includes('امنیت')||value.includes('پیام'))return'support';
 if(value.includes('setting')||value.includes('تنظیم')||value.includes('لاگ'))return'settings';
 return'shield';
}
function svgIcon(kind,className=''){
 const svg=document.createElementNS(SVG_NS,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');if(className)svg.setAttribute('class',className);
 for(const [tag,attrs] of ICONS[kind]||ICONS.shield){const node=document.createElementNS(SVG_NS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);svg.appendChild(node)}
 return svg;
}
function buttonIcon(kind,className='mp7-icon'){
 const wrap=document.createElement('span');wrap.className=className;wrap.appendChild(svgIcon(kind));return wrap;
}

function addStyles(){
 if($('#salamatMobileRoleIconShellV7Styles'))return;
 const style=document.createElement('style');style.id='salamatMobileRoleIconShellV7Styles';style.textContent=`
#${HEADER_ID},#${LAUNCHER_ID},#${NAV_ID},#${PROFILE_ID}{display:none}
@media(max-width:760px){
 html.salamat-mobile-panel-v7{--mp7-green:#185B38;--mp7-dark:#123F2A;--mp7-soft:#EAF2ED;--mp7-red:#D83429;--mp7-red-soft:#FCECEA;--mp7-ink:#173128;--mp7-muted:#74847B;--mp7-bg:#F4F7F5;--mp7-line:#DDE7E2;background:var(--mp7-bg)!important}
 html.salamat-mobile-panel-v7,html.salamat-mobile-panel-v7 body{width:100%!important;max-width:100%!important;min-height:100dvh!important;overflow-x:hidden!important;background:var(--mp7-bg)!important;color:var(--mp7-ink)!important}
 html.salamat-mobile-panel-v7 #appView.app{display:block!important;width:100%!important;min-height:100dvh!important;background:var(--mp7-bg)!important}
 html.salamat-mobile-panel-v7 #sidebar,html.salamat-mobile-panel-v7 #mobileSidebarBackdrop,html.salamat-mobile-panel-v7 #mobileMenu,html.salamat-mobile-panel-v7 .topbar,html.salamat-mobile-panel-v7 #salamatMobileAppHeader,html.salamat-mobile-panel-v7 #salamatMobileBottomNav,html.salamat-mobile-panel-v7 #salamatCaregiverHeaderV5,html.salamat-mobile-panel-v7 #salamatCaregiverBottomNavV5,html.salamat-mobile-panel-v7 #salamatCaregiverDashboardV5,html.salamat-mobile-panel-v7 #salamatUnifiedMobileHeaderV6,html.salamat-mobile-panel-v7 #salamatUnifiedMobileNavV6,html.salamat-mobile-panel-v7 #salamatUnifiedMobileDashboardV6{display:none!important;visibility:hidden!important;pointer-events:none!important}
 html.salamat-mobile-panel-v7 .main-area{display:block!important;width:100%!important;min-height:100dvh!important;padding:calc(72px + env(safe-area-inset-top)) 0 calc(98px + env(safe-area-inset-bottom))!important;background:var(--mp7-bg)!important}
 html.salamat-mobile-panel-v7 #content.content{display:block;width:100%!important;max-width:100%!important;margin:0!important;padding:14px 12px 26px!important;background:var(--mp7-bg)!important;overflow-x:hidden!important}
 html.salamat-mobile-panel-v7.salamat-mobile-icon-home-v7 #content.content{display:none!important}
 #${HEADER_ID}{position:fixed;z-index:410;top:0;right:0;left:0;height:calc(64px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 13px 0;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:9px;border-bottom:1px solid rgba(24,91,56,.1);background:rgba(255,255,255,.96);box-shadow:0 8px 28px rgba(18,63,42,.07);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
 #${HEADER_ID}:after{content:'';position:absolute;right:15px;bottom:-1px;width:36px;height:3px;border-radius:99px;background:var(--mp7-red)}
 #${HEADER_ID} button{width:42px;height:42px;padding:0;border:0;border-radius:14px;display:grid;place-items:center;color:var(--mp7-green);background:var(--mp7-soft);touch-action:manipulation;-webkit-tap-highlight-color:transparent}
 #${HEADER_ID} button[hidden]{visibility:hidden!important;display:grid!important;pointer-events:none!important;opacity:0}
 #${HEADER_ID} button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
 #${HEADER_ID} .mp7-heading{min-width:0;text-align:center}.mp7-heading strong,.mp7-heading small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp7-heading strong{font-size:13px;font-weight:950;color:var(--mp7-ink)}.mp7-heading small{margin-top:3px;font-size:8px;color:var(--mp7-muted)}
 #${HEADER_ID} .mp7-profile{font-size:10px;font-weight:950;color:#fff;background:linear-gradient(145deg,var(--mp7-green),var(--mp7-dark))}
 #${LAUNCHER_ID}{display:none;width:100%;min-height:calc(100dvh - 170px);padding:14px 14px 30px;direction:rtl}
 html.salamat-mobile-panel-v7.salamat-mobile-icon-home-v7 #${LAUNCHER_ID}{display:block!important}
 #${LAUNCHER_ID} .mp7-welcome{padding:18px 17px 17px;border-radius:24px;color:#fff;background:linear-gradient(145deg,var(--mp7-green),var(--mp7-dark));box-shadow:0 16px 34px rgba(18,63,42,.2)}
 #${LAUNCHER_ID} .mp7-welcome span{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.12);font-size:8px;font-weight:900}
 #${LAUNCHER_ID} .mp7-welcome h2{margin:10px 0 5px;color:#fff;font-size:18px;line-height:1.6;font-weight:950}
 #${LAUNCHER_ID} .mp7-welcome p{margin:0;color:rgba(255,255,255,.8);font-size:9px;line-height:1.9}
 #${LAUNCHER_ID} .mp7-section-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin:20px 2px 12px}
 #${LAUNCHER_ID} .mp7-section-head strong{font-size:13px;font-weight:950}#${LAUNCHER_ID} .mp7-section-head small{color:var(--mp7-muted);font-size:8px}
 #${LAUNCHER_ID} .mp7-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 10px;align-items:start}
 #${LAUNCHER_ID} .mp7-module{min-width:0;min-height:92px;padding:7px 3px;border:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:7px;background:transparent;color:var(--mp7-ink);font:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
 #${LAUNCHER_ID} .mp7-module:active{transform:scale(.94)}
 #${LAUNCHER_ID} .mp7-module .mp7-module-icon{width:62px;height:62px;display:grid;place-items:center;border:1px solid rgba(24,91,56,.09);border-radius:20px;color:var(--mp7-green);background:#fff;box-shadow:0 9px 24px rgba(18,63,42,.08)}
 #${LAUNCHER_ID} .mp7-module:nth-child(4n+2) .mp7-module-icon{color:var(--mp7-red);background:var(--mp7-red-soft);border-color:rgba(216,52,41,.1)}
 #${LAUNCHER_ID} .mp7-module:nth-child(4n+4) .mp7-module-icon{background:var(--mp7-soft)}
 #${LAUNCHER_ID} .mp7-module svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
 #${LAUNCHER_ID} .mp7-module .mp7-label{width:100%;min-height:24px;display:block;overflow:hidden;text-align:center;color:#30453A;font-size:8.7px;font-weight:900;line-height:1.45}
 #${LAUNCHER_ID} .mp7-empty{padding:28px 14px;border:1px dashed var(--mp7-line);border-radius:20px;text-align:center;color:var(--mp7-muted);background:#fff;font-size:10px;line-height:1.9}
 #${NAV_ID}{position:fixed;z-index:420;right:8px;left:8px;bottom:calc(8px + env(safe-area-inset-bottom));height:76px;padding:7px 7px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:3px;border:1px solid rgba(24,91,56,.13);border-radius:25px;background:rgba(255,255,255,.98);box-shadow:0 18px 48px rgba(18,63,42,.2);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
 #${NAV_ID} button{position:relative;height:61px;min-width:0;padding:5px 2px;border:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:transparent;color:#78877F;font:inherit;font-size:8px;font-weight:900;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
 #${NAV_ID} button:active{transform:scale(.94)}#${NAV_ID} button.active{color:var(--mp7-green);background:linear-gradient(180deg,#F5F9F7,var(--mp7-soft))}#${NAV_ID} button.active:after{content:'';position:absolute;top:4px;left:50%;width:5px;height:5px;border-radius:50%;background:var(--mp7-red);transform:translateX(-50%)}
 #${NAV_ID} .mp7-nav-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:11px;color:var(--mp7-green);background:var(--mp7-soft)}#${NAV_ID} .mp7-nav-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
 #${NAV_ID} button.active .mp7-nav-icon{color:#fff;background:linear-gradient(145deg,var(--mp7-green),var(--mp7-dark));box-shadow:0 6px 15px rgba(24,91,56,.2)}
 #${NAV_ID} button.mp7-home{transform:translateY(-13px);background:transparent!important}#${NAV_ID} button.mp7-home:active{transform:translateY(-13px) scale(.94)}#${NAV_ID} button.mp7-home:after{display:none!important}#${NAV_ID} button.mp7-home .mp7-nav-icon{width:57px;height:57px;border:5px solid var(--mp7-bg);border-radius:50%;color:#fff;background:linear-gradient(145deg,var(--mp7-green),var(--mp7-dark));box-shadow:0 11px 25px rgba(24,91,56,.3)}#${NAV_ID} button.mp7-home .mp7-nav-icon svg{width:24px;height:24px}#${NAV_ID} button.mp7-home span:last-child{margin-top:-1px;color:var(--mp7-green)}
 #${NAV_ID} button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #${PROFILE_ID}{position:fixed;z-index:450;inset:0;display:none;align-items:end;background:rgba(12,31,21,.44);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}#${PROFILE_ID}.open{display:flex!important}#${PROFILE_ID} .mp7-profile-card{width:100%;padding:16px 16px calc(18px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:#fff;box-shadow:0 -20px 55px rgba(18,63,42,.2)}#${PROFILE_ID} .mp7-profile-head{display:flex;align-items:center;gap:12px}.mp7-profile-avatar{width:56px;height:56px;display:grid;place-items:center;border-radius:18px;color:#fff;background:linear-gradient(145deg,var(--mp7-green),var(--mp7-dark));font-weight:950}.mp7-profile-copy{min-width:0;flex:1}.mp7-profile-copy strong,.mp7-profile-copy small{display:block}.mp7-profile-copy strong{font-size:14px}.mp7-profile-copy small{margin-top:4px;color:var(--mp7-muted);font-size:9px}.mp7-profile-close{width:40px;height:40px;border:0;border-radius:13px;display:grid;place-items:center;color:var(--mp7-green);background:var(--mp7-soft)}.mp7-profile-close svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}.mp7-profile-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.mp7-profile-actions button{min-height:48px;border:0;border-radius:14px;font:inherit;font-size:9px;font-weight:900}.mp7-profile-actions .mp7-modules{color:var(--mp7-green);background:var(--mp7-soft)}.mp7-profile-actions .mp7-logout{color:#fff;background:var(--mp7-red)}
 html.salamat-mobile-panel-v7 body.salamat-mobile-nav-open{overflow:auto!important;touch-action:auto!important}
}
`;(document.head||document.documentElement).appendChild(style)
}

function sourceVisible(source){
 if(!(source instanceof HTMLElement)||source.disabled||source.hidden||source.classList.contains('hidden')||source.getAttribute('aria-hidden')==='true')return false;
 return getComputedStyle(source).display!=='none';
}
function sourceLabel(source){
 if(!source)return'';const clone=source.cloneNode(true);clone.querySelectorAll('b,[data-icon],svg,.badge,.count').forEach(node=>node.remove());return normalize(clone.textContent);
}
function sourceModel(source,index){
 const data=source.dataset||{};
 const key=String(data.caregiverModuleKey||data.panelModuleKey||data.accessModule||data.moduleKey||data.module||data.route||data.view||data.key||source.id||`module-${index}`);
 const label=sourceLabel(source)||key;
 return{key,label,icon:data.icon||source.querySelector('[data-icon]')?.getAttribute('data-icon')||'',source};
}
function sourceModels(){return $$(SOURCE_SELECTOR).filter(sourceVisible).map(sourceModel)}
function staffAccessModels(){
 const access=window.SalamatStaffModuleRouter?.access;
 const modules=Array.isArray(access?.modules)?access.modules:[];
 return modules.filter(module=>module?.panel==='STAFF'&&module?.actions?.view&&!STAFF_HIDDEN.has(String(module.key||''))).map(module=>({
   key:String(module.key||''),label:normalize(module.label||module.key),icon:String(module.icon||''),source:$(`[data-panel-module-key="${CSS.escape(String(module.key||''))}"],[data-access-module="${CSS.escape(String(module.key||''))}"]`)
 }));
}
function models(){
 if(isCaregiver())return sourceModels().filter(item=>String(item.key).startsWith('caregiver.')||!String(item.key).startsWith('staff.'));
 const access=staffAccessModels();return access.length?access:sourceModels().filter(item=>!String(item.key).startsWith('caregiver.'));
}
function isHome(model){return /dashboard|home/.test(compact(`${model?.key||''} ${model?.label||''}`))||normalize(model?.label).includes('داشبورد')}
function homeModel(list=models()){
 return list.find(isHome)||{key:isCaregiver()?'caregiver.dashboard':'staff.dashboard',label:'داشبورد',icon:'home',source:null};
}
function findByWords(list,words){
 const normalized=words.map(compact);return list.find(item=>{const value=compact(`${item.key} ${item.label}`);return normalized.some(word=>value.includes(word))})||null;
}
function currentModuleKey(list=models()){
 if(homeMode)return homeModel(list).key;
 const active=list.find(item=>item.source?.classList?.contains('active')||item.source?.getAttribute?.('aria-current')==='page');
 return active?.key||activeKey||homeModel(list).key;
}
function modelByKey(key,list=models()){return list.find(item=>item.key===key)||null}

function claim(){
 if(!MEDIA.matches||!appVisible()||exiting)return false;
 document.documentElement.classList.add('salamat-mobile-panel-v7');document.body?.classList.add('salamat-mobile-panel-v7');
 document.documentElement.classList.remove('salamat-mobile-panel-v6','salamat-caregiver-mobile-v5','salamat-mobile-app');
 document.body?.classList.remove('salamat-mobile-panel-v6','salamat-caregiver-mobile-v5','salamat-mobile-app','salamat-mobile-nav-open');
 $('#sidebar')?.classList.remove('open');$('#mobileSidebarBackdrop')?.classList.remove('open');
 $('#loginView')?.classList.add('hidden');$('#appView')?.classList.remove('hidden');
 return true;
}
function release(){
 document.documentElement.classList.remove('salamat-mobile-panel-v7','salamat-mobile-icon-home-v7');document.body?.classList.remove('salamat-mobile-panel-v7','salamat-mobile-icon-home-v7');
 $('#'+HEADER_ID)?.remove();$('#'+LAUNCHER_ID)?.remove();$('#'+NAV_ID)?.remove();$('#'+PROFILE_ID)?.remove();signature='';
}

function ensureHeader(){
 let header=$('#'+HEADER_ID);if(header)return header;
 header=document.createElement('header');header.id=HEADER_ID;header.setAttribute('aria-label','نوار بالای پنل موبایل');
 const back=document.createElement('button');back.type='button';back.className='mp7-back';back.setAttribute('aria-label','بازگشت');back.appendChild(svgIcon('back'));back.addEventListener('click',()=>{if(homeMode)return;history.back()});
 const heading=document.createElement('div');heading.className='mp7-heading';const title=document.createElement('strong');const sub=document.createElement('small');heading.append(title,sub);
 const profile=document.createElement('button');profile.type='button';profile.className='mp7-profile';profile.setAttribute('aria-label','پروفایل');profile.addEventListener('click',openProfile);
 header.append(back,heading,profile);($('#appView')||document.body).appendChild(header);return header;
}
function syncHeader(){
 const header=ensureHeader();const back=$('.mp7-back',header);if(back)back.hidden=homeMode;
 const title=$('.mp7-heading strong',header),sub=$('.mp7-heading small',header);if(title)title.textContent=homeMode?roleLabel():normalize($('#pageTitle')?.textContent)||roleLabel();if(sub)sub.textContent='باشگاه مراقبین سلامت اول';
 const profile=$('.mp7-profile',header);if(profile){const initials=userName().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'س‌ا';profile.textContent=initials}
}

function ensureLauncher(){
 let launcher=$('#'+LAUNCHER_ID);if(launcher)return launcher;
 launcher=document.createElement('section');launcher.id=LAUNCHER_ID;launcher.setAttribute('aria-label','ماژول‌های پنل');
 const main=$('.main-area')||$('#appView');const content=$('#content');if(main&&content&&content.parentElement===main)main.insertBefore(launcher,content);else main?.appendChild(launcher);return launcher;
}
function moduleSignature(list){return `${roleRaw()}|${list.map(item=>`${item.key}:${item.label}`).join('|')}`}
function rebuildLauncher(force=false){
 const list=models(),launcher=ensureLauncher(),next=moduleSignature(list);if(!force&&next===signature&&launcher.childElementCount)return;signature=next;launcher.replaceChildren();
 const welcome=document.createElement('section');welcome.className='mp7-welcome';const eyebrow=document.createElement('span');eyebrow.textContent=roleLabel();const h2=document.createElement('h2');h2.textContent=`سلام ${firstName()}، خوش آمدید`;const p=document.createElement('p');p.textContent='تمام ماژول‌هایی که برای حساب شما فعال است از همین صفحه در دسترس قرار دارد.';welcome.append(eyebrow,h2,p);
 const head=document.createElement('div');head.className='mp7-section-head';const strong=document.createElement('strong');strong.textContent='ماژول‌های من';const small=document.createElement('small');const launchItems=list.filter(item=>!isHome(item));small.textContent=`${launchItems.length.toLocaleString('fa-IR')} دسترسی فعال`;head.append(strong,small);
 launcher.append(welcome,head);
 if(!launchItems.length){const empty=document.createElement('div');empty.className='mp7-empty';empty.textContent='در حال دریافت دسترسی‌های این حساب…';launcher.appendChild(empty);return}
 const grid=document.createElement('div');grid.className='mp7-grid';
 launchItems.forEach(item=>{const button=document.createElement('button');button.type='button';button.className='mp7-module';button.dataset.moduleKey=item.key;button.setAttribute('aria-label',item.label);const icon=buttonIcon(iconKind(item),'mp7-module-icon');const label=document.createElement('span');label.className='mp7-label';label.textContent=item.label;button.append(icon,label);button.addEventListener('click',event=>{event.preventDefault();void navigateModule(item,{push:true})});grid.appendChild(button)});
 launcher.appendChild(grid);
}

function initials(value){return normalize(value).split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'س‌ا'}
function ensureProfile(){
 let layer=$('#'+PROFILE_ID);if(layer)return layer;
 layer=document.createElement('div');layer.id=PROFILE_ID;layer.setAttribute('aria-hidden','true');
 const card=document.createElement('section');card.className='mp7-profile-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','پروفایل کاربر');
 const head=document.createElement('div');head.className='mp7-profile-head';const avatar=document.createElement('span');avatar.className='mp7-profile-avatar';const copy=document.createElement('div');copy.className='mp7-profile-copy';const name=document.createElement('strong');const role=document.createElement('small');copy.append(name,role);const close=document.createElement('button');close.type='button';close.className='mp7-profile-close';close.setAttribute('aria-label','بستن');close.appendChild(svgIcon('close'));close.addEventListener('click',closeProfile);head.append(avatar,copy,close);
 const actions=document.createElement('div');actions.className='mp7-profile-actions';const modules=document.createElement('button');modules.type='button';modules.className='mp7-modules';modules.textContent='نمایش همه ماژول‌ها';modules.addEventListener('click',()=>{closeProfile();showHome({push:true})});const logout=document.createElement('button');logout.type='button';logout.className='mp7-logout';logout.textContent='خروج از حساب';logout.addEventListener('click',()=>{closeProfile();const original=$('#logoutButton');if(original)original.click()});actions.append(modules,logout);card.append(head,actions);layer.appendChild(card);layer.addEventListener('click',event=>{if(event.target===layer)closeProfile()});($('#appView')||document.body).appendChild(layer);return layer;
}
function syncProfile(){const layer=ensureProfile();$('.mp7-profile-avatar',layer).textContent=initials(userName());$('.mp7-profile-copy strong',layer).textContent=userName();$('.mp7-profile-copy small',layer).textContent=roleLabel()}
function openProfile(){
 if(isCaregiver()&&typeof window.SalamatCaregiverSelfProfile?.open==='function'){window.SalamatCaregiverSelfProfile.open();return}
 const layer=ensureProfile();syncProfile();layer.classList.add('open');layer.setAttribute('aria-hidden','false');syncBottomNav();
}
function closeProfile(){const layer=$('#'+PROFILE_ID);layer?.classList.remove('open');layer?.setAttribute('aria-hidden','true');syncBottomNav()}

function navButton(label,kind,handler,{home=false,key=''}={}){
 const button=document.createElement('button');button.type='button';button.dataset.navKey=key;button.dataset.navKind=kind;button.setAttribute('aria-label',label);if(home)button.classList.add('mp7-home');button.append(buttonIcon(kind==='module'?'modules':kind,'mp7-nav-icon'));const text=document.createElement('span');text.textContent=label;button.appendChild(text);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();handler()});return button;
}
function navModelButton(item){return navButton(item.label,iconKind(item),()=>void navigateModule(item,{push:true}),{key:item.key})}
function ensureBottomNav(){
 let nav=$('#'+NAV_ID);if(!nav){nav=document.createElement('nav');nav.id=NAV_ID;nav.setAttribute('aria-label','ناوبری پایین پنل');($('#appView')||document.body).appendChild(nav)}
 const list=models(),home=homeModel(list),others=list.filter(item=>!isHome(item));
 const support=findByWords(others,['support','پشتیبانی']);const training=findByWords(others,['training','education','آموزش']);const calendar=findByWords(others,['calendar','تقویم']);
 const used=new Set();const take=item=>{if(!item||used.has(item.key))return null;used.add(item.key);return item};
 const leftPrimary=take(isCaregiver()?calendar:others[0]);
 const rightPrimary=take(support)||take(others.find(item=>!used.has(item.key)));
 const farRight=take(training)||take(findByWords(others,['settings','تنظیم']))||take(others.find(item=>!used.has(item.key)));
 const buttons=[];
 buttons.push(navButton('پروفایل','profile',openProfile));
 buttons.push(leftPrimary?navModelButton(leftPrimary):navButton('ماژول‌ها','modules',()=>showHome({push:true})));
 buttons.push(navButton('خانه','home',()=>showHome({push:true}),{home:true,key:home.key}));
 buttons.push(rightPrimary?navModelButton(rightPrimary):navButton('ماژول‌ها','modules',()=>showHome({push:true})));
 buttons.push(farRight?navModelButton(farRight):navButton('ماژول‌ها','modules',()=>showHome({push:true})));
 nav.replaceChildren(...buttons);return nav;
}
function syncBottomNav(){
 const nav=ensureBottomNav(),profileOpen=$('#'+PROFILE_ID)?.classList.contains('open');const key=currentModuleKey();
 $$('button',nav).forEach(button=>{const selected=(button.dataset.navKind==='profile'&&profileOpen)||(!profileOpen&&((homeMode&&button.classList.contains('mp7-home'))||(!homeMode&&button.dataset.navKey===key)));button.classList.toggle('active',selected);button.setAttribute('aria-current',selected?'page':'false')});
}

async function waitForRouter(timeout=3800){
 const started=performance.now();
 while(performance.now()-started<timeout){
  if(isCaregiver()&&typeof window.SalamatCaregiverCanonicalRouteOwner?.openModule==='function')return'caregiver';
  if(!isCaregiver()&&typeof window.SalamatStaffModuleRouter?.route==='function')return'staff';
  await new Promise(resolve=>setTimeout(resolve,60));
 }
 return'';
}
function nativeFallback(model){
 const source=model?.source||$(`[data-caregiver-module-key="${CSS.escape(model?.key||'')}"]`)||$(`[data-panel-module-key="${CSS.escape(model?.key||'')}"]`)||$(`[data-access-module="${CSS.escape(model?.key||'')}"]`);if(!source)return false;try{HTMLElement.prototype.click.call(source);return true}catch{return false}
}
async function routeDirect(model){
 if(!model?.key)return false;const mode=await waitForRouter();
 try{
  if(mode==='caregiver'){await window.SalamatCaregiverCanonicalRouteOwner.openModule(model.key);return true}
  if(mode==='staff'){await window.SalamatStaffModuleRouter.route(model.key);return true}
 }catch(error){console.warn('[mobile-v7] canonical route failed',model.key,error)}
 return nativeFallback(model);
}
function markSource(model){$$(SOURCE_SELECTOR).forEach(source=>{const item=sourceModel(source,0),on=item.key===model?.key;source.classList.toggle('active',on);source.setAttribute('aria-current',on?'page':'false')})}
function applyHomeState(value){homeMode=Boolean(value);document.documentElement.classList.toggle('salamat-mobile-icon-home-v7',homeMode);document.body?.classList.toggle('salamat-mobile-icon-home-v7',homeMode);const launcher=ensureLauncher();launcher.setAttribute('aria-hidden',homeMode?'false':'true');const content=$('#content');content?.setAttribute('aria-hidden',homeMode?'true':'false')}
function historyState(kind,key=''){return{[STATE_KEY]:true,kind,key,version:VERSION,at:Date.now()}}
function ownedState(state){return Boolean(state&&state[STATE_KEY])}
function establishHistory(){
 if(exiting||!appVisible())return;const state=history.state;if(ownedState(state))return;
 history.replaceState(historyState('guard'),'',location.href);history.pushState(historyState('home',homeModel().key),'',location.href);
}
function pushHistory(kind,key){const current=history.state;if(ownedState(current)&&current.kind===kind&&current.key===key)return;history.pushState(historyState(kind,key),'',location.href)}
function showHome({push=false,fromPop=false}={}){
 if(!claim())return;closeProfile();const home=homeModel();activeKey=home.key;applyHomeState(true);markSource(home);rebuildLauncher();syncHeader();syncBottomNav();window.scrollTo({top:0,left:0,behavior:'auto'});if(push&&!fromPop)pushHistory('home',home.key);window.dispatchEvent(new CustomEvent('salamat-mobile-v7-home',{detail:{key:home.key}}));
}
async function navigateModule(model,{push=false,fromPop=false}={}){
 if(!claim()||!model)return false;if(isHome(model)){showHome({push,fromPop});return true}closeProfile();applyHomeState(false);activeKey=model.key;syncHeader();syncBottomNav();const ok=await routeDirect(model);if(!ok){showHome({push:false});window.toast?.('بازکردن ماژول انجام نشد','دسترسی‌های حساب تازه‌سازی شد؛ دوباره انتخاب کنید.');return false}markSource(model);await new Promise(resolve=>setTimeout(resolve,30));syncHeader();syncBottomNav();window.scrollTo({top:0,left:0,behavior:'auto'});if(push&&!fromPop)pushHistory('module',model.key);window.dispatchEvent(new CustomEvent('salamat-mobile-v7-route',{detail:{key:model.key}}));return true
}
async function handlePop(event){
 if(exiting||!MEDIA.matches||!appVisible())return;const state=event.state;
 if(!ownedState(state)){restoring=true;showHome({push:false,fromPop:true});history.pushState(historyState('home',homeModel().key),'',location.href);restoring=false;return}
 if(state.kind==='guard'){restoring=true;showHome({push:false,fromPop:true});history.pushState(historyState('home',homeModel().key),'',location.href);restoring=false;return}
 if(state.kind==='home'){showHome({push:false,fromPop:true});return}
 if(state.kind==='module'){const model=modelByKey(state.key);if(model){restoring=true;await navigateModule(model,{push:false,fromPop:true});restoring=false}else showHome({push:false,fromPop:true})}
}

function maybeRequestStaffAccess(){
 if(isCaregiver()||staffReloadRequested||window.SalamatStaffModuleRouter?.access)return;const router=window.SalamatStaffModuleRouter;if(typeof router?.reload!=='function')return;staffReloadRequested=true;Promise.resolve(router.reload()).catch(()=>{}).finally(()=>schedule())
}
function sync(){
 cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  if(!MEDIA.matches||!appVisible()||exiting){release();return}
  if(!claim())return;maybeRequestStaffAccess();ensureHeader();ensureLauncher();rebuildLauncher();ensureBottomNav();syncProfile();
  if(!ownedState(history.state))establishHistory();
  if(!activeKey){showHome({push:false});return}
  applyHomeState(homeMode);syncHeader();syncBottomNav();
 })
}
function schedule(){sync()}
function onLogout(){exiting=true;release()}
function captureLogout(event){if(event.target?.closest?.('#logoutButton'))onLogout()}

function install(){
 addStyles();window.addEventListener('popstate',handlePop);window.addEventListener('pageshow',()=>{exiting=false;setTimeout(()=>{if(appVisible()){claim();if(!ownedState(history.state))establishHistory();schedule()}},0)});
 window.addEventListener('salamat-authenticated',()=>{exiting=false;activeKey='';homeMode=true;setTimeout(schedule,0)});window.addEventListener('salamat-logged-out',onLogout);window.addEventListener('salamat-access-ready',schedule);window.addEventListener('salamat-shell-ready',schedule);window.addEventListener('salamat-module-opened',()=>{if(!restoring&&!homeMode){setTimeout(schedule,0)}});document.addEventListener('click',captureLogout,true);MEDIA.addEventListener?.('change',schedule);
 const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','data-caregiver-module-key','data-panel-module-key','data-access-module']});
 setInterval(()=>{if(MEDIA.matches&&appVisible())schedule()},1500);schedule();
 window.SalamatMobileRoleIconShell={version:VERSION,home:()=>showHome({push:true}),route:key=>{const model=modelByKey(String(key));return model?navigateModule(model,{push:true}):Promise.resolve(false)},sync:schedule,get modules(){return models().map(({key,label,icon})=>({key,label,icon}))}};
 window.dispatchEvent(new CustomEvent('salamat-mobile-role-icon-shell-ready',{detail:{version:VERSION}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
