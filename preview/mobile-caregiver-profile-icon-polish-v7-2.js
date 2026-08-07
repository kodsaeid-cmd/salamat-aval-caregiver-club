(()=>{
'use strict';
if(window.__salamatMobileCaregiverProfileIconPolishV72)return;
window.__salamatMobileCaregiverProfileIconPolishV72=true;
const VERSION='7.2.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const SHELL_PROFILE='salamatMobileRoleProfileV71';
const STYLE_ID='salamatMobileCaregiverProfileIconPolishV72Styles';
const SVG_NS='http://www.w3.org/2000/svg';
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const role=()=>String(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||$('#sidebarRole')?.textContent||'').toUpperCase();
const caregiver=()=>role()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب');
const normalize=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const ICONS={
 score:[['path',{d:'M4 19V5'}],['path',{d:'M4 19h16'}],['path',{d:'m7 15 3.2-3.4 2.7 2.1 4.6-5.2'}],['circle',{cx:'17.5',cy:'8.5',r:'1.2'}]],
 training:[['path',{d:'M4.5 5.5A2.5 2.5 0 0 1 7 3h12v16H7a2.5 2.5 0 0 0-2.5 2.5z'}],['path',{d:'M8 7h7M8 10.5h5'}],['path',{d:'m15.5 14 1.4 1.4 2.6-2.8'}]],
 calendar:[['rect',{x:'3',y:'4',width:'18',height:'17',rx:'2.5'}],['path',{d:'M8 2v4M16 2v4M3 9.5h18'}],['path',{d:'m8 15 2 2 5-5'}]],
 support:[['path',{d:'M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v8a3.5 3.5 0 0 1-3.5 3.5H10l-5.5 4v-5.2A3.5 3.5 0 0 1 4 14z'}],['path',{d:'M8 8h8M8 12h5'}]],
 wallet:[['rect',{x:'3',y:'5',width:'18',height:'14',rx:'3'}],['path',{d:'M15.5 10H21v5h-5.5a2.5 2.5 0 0 1 0-5Z'}],['circle',{cx:'16.5',cy:'12.5',r:'.7'}],['path',{d:'M6.5 8h5'}]],
 payroll:[['rect',{x:'5',y:'3',width:'14',height:'18',rx:'2'}],['path',{d:'M8 7h8M8 11h8M8 15h4'}],['path',{d:'m14.5 16 1.5 1.5 3-3'}]],
 profile:[['circle',{cx:'12',cy:'8',r:'4'}],['path',{d:'M4.5 21a7.5 7.5 0 0 1 15 0'}]],
 phone:[['path',{d:'M6.8 3h2.8l1.2 5-2 1.5a14 14 0 0 0 5.7 5.7l1.5-2 5 1.2v2.8A3.8 3.8 0 0 1 17.2 21C9.4 21 3 14.6 3 6.8A3.8 3.8 0 0 1 6.8 3Z'}]],
 logout:[['path',{d:'M10 5H5v14h5'}],['path',{d:'M13 8l4 4-4 4M8 12h9'}]],
 modules:[['rect',{x:'3',y:'3',width:'7',height:'7',rx:'2'}],['rect',{x:'14',y:'3',width:'7',height:'7',rx:'2'}],['rect',{x:'3',y:'14',width:'7',height:'7',rx:'2'}],['rect',{x:'14',y:'14',width:'7',height:'7',rx:'2'}]],
};
function svg(kind){const node=document.createElementNS(SVG_NS,'svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('aria-hidden','true');for(const [tag,attrs] of ICONS[kind]||ICONS.modules){const child=document.createElementNS(SVG_NS,tag);Object.entries(attrs).forEach(([k,v])=>child.setAttribute(k,v));node.appendChild(child)}return node}
function iconKind(label,key=''){const v=normalize(`${label} ${key}`).toLowerCase();if(/کارنامه|ارزیابی|امتیاز|درجه|رتبه/.test(v))return'score';if(/آموزش|دوره/.test(v))return'training';if(/تقویم|شیفت/.test(v))return'calendar';if(/پشتیبانی|پرونده|تماس/.test(v))return'support';if(/حقوق|فیش/.test(v))return'payroll';if(/کیف پول|اعتبار|پاداش|مالی/.test(v))return'wallet';if(/پروفایل|مشخصات/.test(v))return'profile';return'modules'}
function addStyles(){if($('#'+STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
@media(max-width:760px){
html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module-icon{position:relative;overflow:hidden;border-radius:19px!important;border:1px solid rgba(24,91,56,.12)!important;background:linear-gradient(145deg,#fff,#f7fbf8)!important;box-shadow:0 8px 20px rgba(18,63,42,.08),inset 0 1px 0 rgba(255,255,255,.9)!important}
html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module-icon:after{content:'';position:absolute;right:8px;bottom:6px;width:7px;height:3px;border-radius:99px;background:#D83429;opacity:.9}
html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module-icon svg{width:30px!important;height:30px!important;stroke-width:1.65!important}
html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module[data-caregiver-icon='training'] .m71-module-icon,html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module[data-caregiver-icon='calendar'] .m71-module-icon{background:linear-gradient(145deg,#eef8f2,#fff)!important}
html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module[data-caregiver-icon='support'] .m71-module-icon,html.salamat-mobile-panel-v71 #salamatMobileRoleLauncherV71 .m71-module[data-caregiver-icon='payroll'] .m71-module-icon{color:#D83429!important;background:linear-gradient(145deg,#fff4f2,#fff)!important;border-color:rgba(216,52,41,.12)!important}
#${SHELL_PROFILE}.open .m72-caregiver-profile{display:grid}.m72-caregiver-profile{display:none;gap:9px;margin-top:15px}.m72-caregiver-profile button{min-height:52px;border:0;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:10px;font-weight:950;touch-action:manipulation}.m72-caregiver-profile svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.m72-open-profile{color:#185B38;background:#EAF2ED}.m72-logout{color:#fff;background:#D83429;box-shadow:0 10px 22px rgba(216,52,41,.2)}
#${SHELL_PROFILE}.m72-caregiver .m71-profile-actions{display:none!important}
}`;(document.head||document.documentElement).appendChild(style)}
function polishIcons(){if(!caregiver()||!MEDIA.matches)return;$$('#salamatMobileRoleLauncherV71 .m71-module').forEach(button=>{const label=normalize($('.m71-label',button)?.textContent),key=button.dataset.moduleKey||'';const kind=iconKind(label,key);button.dataset.caregiverIcon=kind;const box=$('.m71-module-icon',button);if(box&&box.dataset.polished!==kind){box.replaceChildren(svg(kind));box.dataset.polished=kind}})}
function ensureProfileActions(){if(!caregiver()||!MEDIA.matches)return;const layer=$('#'+SHELL_PROFILE);if(!layer)return;layer.classList.add('m72-caregiver');const card=$('.m71-profile-card',layer);if(!card||$('.m72-caregiver-profile',card))return;const actions=document.createElement('div');actions.className='m72-caregiver-profile';const open=document.createElement('button');open.type='button';open.className='m72-open-profile';open.append(svg('profile'),document.createTextNode('مشاهده و ویرایش پروفایل حرفه‌ای'));open.addEventListener('click',()=>{layer.classList.remove('open');layer.setAttribute('aria-hidden','true');window.SalamatCaregiverSelfProfile?.open?.()});const logout=document.createElement('button');logout.type='button';logout.className='m72-logout';logout.append(svg('logout'),document.createTextNode('خروج از حساب کاربری'));logout.addEventListener('click',()=>{$('#logoutButton')?.click()});actions.append(open,logout);card.appendChild(actions)}
function interceptProfile(event){if(!caregiver()||!MEDIA.matches)return;const button=event.target?.closest?.('#salamatMobileRoleBottomNavV71 [data-nav-kind="profile"],#salamatMobileRoleHeaderV71 .m71-profile');if(!button)return;event.preventDefault();event.stopImmediatePropagation();const layer=$('#'+SHELL_PROFILE);if(!layer)return;ensureProfileActions();layer.classList.add('open');layer.setAttribute('aria-hidden','false')}
function sync(){addStyles();polishIcons();ensureProfileActions()}
function install(){document.addEventListener('click',interceptProfile,true);window.addEventListener('salamat-authenticated',()=>setTimeout(sync,0));window.addEventListener('salamat-mobile-role-icon-shell-ready',()=>setTimeout(sync,0));new MutationObserver(()=>requestAnimationFrame(sync)).observe(document.documentElement,{childList:true,subtree:true});setInterval(sync,1800);sync();window.SalamatMobileCaregiverProfileIconPolish={version:VERSION,sync}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();