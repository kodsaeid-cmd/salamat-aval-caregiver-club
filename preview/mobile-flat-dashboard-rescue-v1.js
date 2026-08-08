(()=>{
'use strict';
if(window.__salamatMobileFlatDashboardRescueV1)return;
window.__salamatMobileFlatDashboardRescueV1=true;
const MEDIA=window.matchMedia('(max-width:760px)');
const ROOT='salamatMobileRoleLauncherV71';
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const norm=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=v=>norm(v).replace(/[\s\-_\/]+/g,'').toLowerCase();
const PATHS={
 users:'<circle cx="12" cy="7.5" r="3.2"/><path d="M5.4 20v-1.6c0-3.1 2.8-5.2 6.6-5.2s6.6 2.1 6.6 5.2V20"/><path d="M18.1 6.1a3 3 0 0 1 0 5.8M20.2 14.5c1.9.8 2.8 2.2 2.8 4.1V20"/>',
 caregivers:'<circle cx="9" cy="7.2" r="3.1"/><path d="M3.5 20v-1.4c0-3.2 2.3-5.2 5.5-5.2 1.4 0 2.7.4 3.7 1.1"/><circle cx="17.2" cy="9" r="2.4"/><path d="M13 20v-1.1c0-2.8 1.8-4.5 4.2-4.5 2.5 0 4.3 1.7 4.3 4.5V20"/>',
 contracts:'<path d="M6 3.5h9l3 3V21H6z"/><path d="M15 3.5V7h3M9 11h6M9 14.5h6"/><path d="m9.2 18 1.2 1.2 2.7-2.7"/>',
 training:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22z"/>',
 credits:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 9.5h18M7 15h4"/>',
 payroll:'<rect x="3" y="6" width="18" height="12" rx="2.7"/><path d="M3 10h18M7 14h3"/>',
 evaluation:'<path d="M12 2.8 20 6v5.7c0 4.9-3.1 8.2-8 9.5-4.9-1.3-8-4.6-8-9.5V6z"/><path d="m8.3 11.8 2.2 2.2 5-5"/>',
 support:'<path d="M5 13v-2a7 7 0 0 1 14 0v2"/><path d="M5 12H3.8A1.8 1.8 0 0 0 2 13.8v3.4A1.8 1.8 0 0 0 3.8 19H6v-7zM19 12h1.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H18v-7z"/><path d="M18 19c-1.3 1.5-3 2.2-5 2.2"/>',
 settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.2 13.4c.1-.5.1-1 0-1.4l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.3-.8L15.2 4h-4.1l-.4 3.2c-.5.2-.9.5-1.3.8L7 7 5 10.5 7 12c-.1.5-.1 1 0 1.4l-2 1.5L7 18.4l2.4-1c.4.3.8.6 1.3.8l.4 3.2h4.1l.4-3.2c.5-.2.9-.5 1.3-.8l2.4 1 2-3.5z"/>'
};
function kind(button){const v=`${compact(button?.dataset?.moduleKey||'')} ${compact(button?.textContent||'')}`;if(v.includes('contract')||v.includes('قرارداد'))return'contracts';if(v.includes('training')||v.includes('education')||v.includes('آموزش'))return'training';if(v.includes('payroll')||v.includes('salary')||v.includes('حقوق')||v.includes('پرداخت')||v.includes('فیش'))return'payroll';if(v.includes('financial')||v.includes('credit')||v.includes('wallet')||v.includes('اعتبار')||v.includes('تسهیلات')||v.includes('کیفپول'))return'credits';if(v.includes('setting')||v.includes('audit')||v.includes('log')||v.includes('تنظیم')||v.includes('لاگ'))return'settings';if(v.includes('support')||v.includes('security')||v.includes('پشتیبانی')||v.includes('امنیت'))return'support';if(v.includes('evalu')||v.includes('license')||v.includes('score')||v.includes('ارزیابی')||v.includes('پروانه')||v.includes('کارنامه'))return'evaluation';if(v.includes('users')||v.includes('access')||v.includes('کاربران')||v.includes('دسترسی'))return'users';return'caregivers'}
function dataIcon(k){const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0B7A46" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[k]||PATHS.caregivers}</svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`}
function ensureStyle(){if($('#salamatMobileFlatDashboardRescueV1Styles'))return;const s=document.createElement('style');s.id='salamatMobileFlatDashboardRescueV1Styles';s.textContent=`@media(max-width:760px){
html body #${ROOT}.m83-rescue-home .m71-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px 12px!important;align-items:stretch!important}
html body #${ROOT}.m83-rescue-home .m71-module{position:relative!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:11px!important;min-width:0!important;min-height:118px!important;padding:17px 7px 13px!important;border:1px solid rgba(255,255,255,.98)!important;border-radius:26px!important;background:linear-gradient(145deg,#fff,#f9fcfa)!important;box-shadow:0 12px 28px rgba(28,65,47,.08),inset 0 1px 0 #fff!important;overflow:hidden!important}
html body #${ROOT}.m83-rescue-home .m71-module .m71-module-icon,html body #${ROOT}.m83-rescue-home .m71-module .m73-admin-icon{width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background-color:transparent!important;background-repeat:no-repeat!important;background-position:center!important;background-size:40px 40px!important;display:block!important;overflow:visible!important}
html body #${ROOT}.m83-rescue-home .m71-module .m71-module-icon>*,html body #${ROOT}.m83-rescue-home .m71-module .m73-admin-icon>*{display:none!important}
html body #${ROOT}.m83-rescue-home .m71-label{position:static!important;width:100%!important;min-height:18px!important;margin:0!important;padding:0 2px!important;background:transparent!important;color:#1C3128!important;font-size:11px!important;line-height:1.55!important;font-weight:900!important;text-align:center!important;box-shadow:none!important;white-space:normal!important}
@media(max-width:430px){html body #${ROOT}.m83-rescue-home .m71-grid{gap:15px 10px!important}html body #${ROOT}.m83-rescue-home .m71-module{min-height:112px!important;border-radius:24px!important;padding:15px 5px 12px!important;gap:9px!important}html body #${ROOT}.m83-rescue-home .m71-module .m71-module-icon,html body #${ROOT}.m83-rescue-home .m71-module .m73-admin-icon{background-size:38px 38px!important}html body #${ROOT}.m83-rescue-home .m71-label{font-size:10.5px!important}}
}`;(document.head||document.documentElement).appendChild(s)}
function normalizeCard(button){button.removeAttribute('data-m82-photo');button.style.removeProperty('--m82-photo');const icon=$('.m71-module-icon,.m73-admin-icon',button);if(!icon)return;const k=kind(button);button.dataset.m83Kind=k;icon.innerHTML='';icon.style.setProperty('background-image',dataIcon(k),'important');icon.style.setProperty('background-repeat','no-repeat','important');icon.style.setProperty('background-position','center','important');icon.style.setProperty('background-size','40px 40px','important')}
function apply(){if(!MEDIA.matches)return false;window.__salamatMobileReferenceDashboardV82=true;$('#salamatMobileReferenceDashboardV82Styles')?.remove();const root=$('#'+ROOT);if(!root)return false;root.classList.remove('m82-reference-home');root.classList.add('m83-home','m83-rescue-home');$$('.m71-module',root).forEach(normalizeCard);ensureStyle();document.documentElement.dataset.salamatMobileFlatRescue='1.3.0';return true}
let attempts=0,timer=0;function retry(){clearTimeout(timer);apply();if(++attempts<120)timer=setTimeout(retry,250)}
function start(){ensureStyle();retry();['salamat-mobile-v71-home','salamat-authenticated','salamat-access-ready','salamat-mobile-role-icon-shell-ready'].forEach(n=>window.addEventListener(n,()=>{attempts=0;retry()},{passive:true}));window.addEventListener('pageshow',()=>{attempts=0;retry()},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
