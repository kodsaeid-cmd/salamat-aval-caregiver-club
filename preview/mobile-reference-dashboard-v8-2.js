(()=>{
'use strict';
if(window.__salamatMobileReferenceDashboardV82)return;
window.__salamatMobileReferenceDashboardV82=true;

const VERSION='8.2.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const HEADER_ID='salamatMobileRoleHeaderV71';
const LAUNCHER_ID='salamatMobileRoleLauncherV71';
const NAV_ID='salamatMobileRoleBottomNavV71';
const PHOTO_BASE='./media/mobile-reference/';
let scheduled=0;

const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const normalize=v=>String(v||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
const compact=v=>normalize(v).replace(/[\s\-_\/]+/g,'').toLowerCase();
const role=()=>String(window.SalamatStaffModuleRouter?.access?.user?.role||window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||'').toUpperCase();

const PHOTO={
 contracts:'contracts.webp',caregivers:'caregivers.webp',users:'users.webp',training:'training.webp',credits:'credits.webp',payroll:'payroll.webp',settings:'settings.webp',support:'support.webp',evaluation:'evaluation.webp'
};
function photoKind(button){
  const key=compact(button?.dataset?.moduleKey||'');
  const label=compact(button?.textContent||'');
  const value=`${key} ${label}`;
  if(value.includes('contract')||label.includes('قرارداد')||label.includes('ساعاتقرارداد'))return'contracts';
  if(value.includes('training')||value.includes('education')||label.includes('آموزش')||label.includes('بانکآموزش'))return'training';
  if(value.includes('payroll')||value.includes('salary')||label.includes('حقوق')||label.includes('پرداخت')||label.includes('فیش'))return'payroll';
  if(value.includes('financial')||value.includes('credit')||value.includes('wallet')||label.includes('اعتبار')||label.includes('تسهیلات')||label.includes('کیفپول'))return'credits';
  if(value.includes('setting')||value.includes('audit')||value.includes('log')||label.includes('تنظیم')||label.includes('لاگ'))return'settings';
  if(value.includes('support')||value.includes('security')||label.includes('پشتیبانی')||label.includes('امنیت'))return'support';
  if(value.includes('evalu')||value.includes('license')||value.includes('score')||label.includes('ارزیابی')||label.includes('پروانه')||label.includes('کارنامه'))return'evaluation';
  if(value.includes('users')||value.includes('access')||label.includes('کاربران')||label.includes('دسترسی'))return'users';
  if(key.includes('staffcaregiver')||label.includes('پرونده')||label.includes('مراقبین')||label.includes('پروفایل'))return'caregivers';
  return'';
}

function addStyles(){
  if($('#salamatMobileReferenceDashboardV82Styles'))return;
  const style=document.createElement('style');
  style.id='salamatMobileReferenceDashboardV82Styles';
  style.textContent=`
@media(max-width:760px){
html.salamat-mobile-panel-v71{--m82-green:#0d633c;--m82-green-2:#14945b;--m82-red:#e1262d;--m82-ink:#102b21;--m82-muted:#65756d;--m82-bg:#f7faf8;background:radial-gradient(circle at 6% 4%,rgba(21,145,88,.08),transparent 31%),linear-gradient(180deg,#fff 0%,#f8fbf9 56%,#f2f8f4 100%)!important}
html.salamat-mobile-panel-v71 body,html.salamat-mobile-panel-v71 #appView.app,html.salamat-mobile-panel-v71 .main-area{background:transparent!important}
html.salamat-mobile-panel-v71.salamat-mobile-icon-home-v71 .main-area{padding-top:calc(102px + env(safe-area-inset-top))!important;padding-bottom:calc(112px + env(safe-area-inset-bottom))!important}

html.salamat-mobile-icon-home-v71 #${HEADER_ID}{height:calc(94px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 16px 0;grid-template-columns:72px minmax(0,1fr) 104px;border:0;background:rgba(255,255,255,.9);box-shadow:0 10px 32px rgba(16,71,45,.055);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
html.salamat-mobile-icon-home-v71 #${HEADER_ID}:after{width:52px;height:4px;right:18px;background:var(--m82-red);bottom:0}
html.salamat-mobile-icon-home-v71 #${HEADER_ID} .m71-heading{grid-column:2;grid-row:1;text-align:center;align-self:center}
html.salamat-mobile-icon-home-v71 #${HEADER_ID} .m71-heading strong{font-size:18px;line-height:1.35;font-weight:950;color:var(--m82-ink)}
html.salamat-mobile-icon-home-v71 #${HEADER_ID} .m71-heading small{font-size:10px;margin-top:5px;color:#7a8a82}
html.salamat-mobile-icon-home-v71 #${HEADER_ID} .m71-profile{grid-column:1;grid-row:1;justify-self:start;width:62px;height:62px;border-radius:22px;font-size:12px;background:linear-gradient(145deg,#176846,#084b31);box-shadow:0 10px 24px rgba(9,82,51,.14)}
html.salamat-mobile-icon-home-v71 #${HEADER_ID} .m71-back{display:none!important}
#${HEADER_ID} .m82-logo{display:none}
html.salamat-mobile-icon-home-v71 #${HEADER_ID} .m82-logo{display:block;grid-column:3;grid-row:1;width:96px;height:68px;object-fit:contain;justify-self:end;filter:drop-shadow(0 5px 9px rgba(18,63,42,.04))}

#${LAUNCHER_ID}.m82-reference-home{position:relative;padding:18px 14px 34px;min-height:calc(100dvh - 190px);background:transparent}
#${LAUNCHER_ID}.m82-reference-home:before{content:'';position:absolute;z-index:-1;top:0;right:-28%;width:76%;height:420px;background:radial-gradient(ellipse at 68% 20%,rgba(21,145,88,.08),transparent 58%);pointer-events:none}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome{position:relative;overflow:hidden;min-height:184px;padding:28px 27px 24px;border:1px solid rgba(255,255,255,.95);border-radius:34px;color:var(--m82-ink);background:linear-gradient(115deg,rgba(255,255,255,.86),rgba(246,252,248,.78));box-shadow:0 18px 48px rgba(16,74,47,.075),inset 0 1px 0 rgba(255,255,255,.98);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome:before{content:'';position:absolute;left:-12px;top:-50px;width:270px;height:240px;border-radius:78% 12% 82% 18%;transform:rotate(-24deg);background:radial-gradient(ellipse at 42% 42%,rgba(103,170,121,.16) 0 42%,rgba(103,170,121,.035) 43% 64%,transparent 65%);opacity:.85;pointer-events:none}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome:after{content:'';position:absolute;right:23px;bottom:23px;width:3px;height:55px;border-radius:999px;background:var(--m82-red);opacity:.92}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome span{position:relative;z-index:2;padding:7px 13px;border:0;border-radius:999px;color:#0a663c;background:rgba(232,246,238,.88);font-size:11px;font-weight:900;box-shadow:none}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome h2{position:relative;z-index:2;margin:22px 0 8px;font-size:25px;line-height:1.42;font-weight:950;color:#0c6a3e}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome p{position:relative;z-index:2;margin:0;max-width:82%;font-size:13px;line-height:2;color:#687970}
#${LAUNCHER_ID}.m82-reference-home .m71-section-head{margin:29px 6px 15px;align-items:end}
#${LAUNCHER_ID}.m82-reference-home .m71-section-head strong{font-size:20px;font-weight:950;color:#102f24}
#${LAUNCHER_ID}.m82-reference-home .m71-section-head small{font-size:11px;color:#547365}

#${LAUNCHER_ID}.m82-reference-home .m71-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:23px 20px!important;align-items:start!important}
#${LAUNCHER_ID}.m82-reference-home .m71-module{position:relative!important;display:block!important;min-width:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transform:translateZ(0);will-change:transform;transition:transform .19s cubic-bezier(.2,.8,.2,1),filter .19s ease!important}
#${LAUNCHER_ID}.m82-reference-home .m71-module:active{transform:translateY(3px) scale(.965)!important;filter:saturate(1.06) brightness(.98)}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m71-module-icon{position:relative!important;width:100%!important;height:auto!important;aspect-ratio:1.18/1!important;margin:0!important;border-radius:28px!important;border:2px solid rgba(255,255,255,.88)!important;overflow:hidden!important;background-image:var(--m82-photo)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;box-shadow:0 15px 29px rgba(37,63,50,.115),inset 0 1px 0 rgba(255,255,255,.92)!important;transform:translateZ(0)}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m71-module-icon:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.03) 0%,transparent 46%,rgba(255,255,255,.08) 100%);pointer-events:none}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m71-module-icon>svg{display:none!important}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m72-photo-glyph{display:none!important}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m71-label{position:absolute!important;z-index:5!important;right:2px!important;left:2px!important;bottom:2px!important;width:auto!important;min-height:43px!important;margin:0!important;padding:9px 5px 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:0 0 26px 26px!important;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;color:#0b281e!important;font-size:12px!important;line-height:1.45!important;font-weight:950!important;text-align:center!important;box-shadow:0 -4px 16px rgba(255,255,255,.18)!important}

#${NAV_ID}{right:10px!important;left:10px!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;width:auto!important;min-height:88px!important;padding:8px 10px!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;align-items:center!important;gap:1px!important;border:1px solid rgba(255,255,255,.96)!important;border-radius:31px!important;background:rgba(255,255,255,.88)!important;box-shadow:0 20px 45px rgba(15,72,44,.13),inset 0 1px 0 #fff!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important}
#${NAV_ID} button{min-width:0!important;height:70px!important;padding:5px 2px!important;border:0!important;border-radius:20px!important;background:transparent!important;color:#68786f!important;box-shadow:none!important;transition:transform .18s ease,color .18s ease,background .18s ease!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#${NAV_ID} button:active{transform:scale(.93)!important}
#${NAV_ID} button svg{width:25px!important;height:25px!important;stroke-width:1.8!important}
#${NAV_ID} button span:not(.m71-home-icon){font-size:9px!important;font-weight:800!important;line-height:1.3!important;white-space:normal!important}
#${NAV_ID} button.m71-home,#${NAV_ID} .m71-home{height:78px!important;max-width:78px!important;margin:-17px auto 0!important;border:1px solid rgba(169,221,192,.65)!important;border-radius:24px!important;color:#0c9a58!important;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(229,247,237,.93))!important;box-shadow:0 12px 29px rgba(17,145,83,.18),inset 0 1px 0 #fff!important}
#${NAV_ID} button.m71-home svg,#${NAV_ID} .m71-home svg{width:31px!important;height:31px!important;stroke:#0c9a58!important;filter:drop-shadow(0 4px 7px rgba(12,154,88,.12))}

@media(max-width:430px){
#${LAUNCHER_ID}.m82-reference-home{padding-right:10px;padding-left:10px}
#${LAUNCHER_ID}.m82-reference-home .m71-grid{gap:18px 12px!important}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m71-module-icon{border-radius:24px!important}
#${LAUNCHER_ID}.m82-reference-home .m71-module[data-m82-photo] .m71-label{border-radius:0 0 22px 22px!important;font-size:10.5px!important;min-height:40px!important}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome{min-height:169px;padding:24px 22px}
#${LAUNCHER_ID}.m82-reference-home .m71-welcome h2{font-size:22px}
}
@media(prefers-reduced-motion:reduce){#${LAUNCHER_ID}.m82-reference-home .m71-module,#${NAV_ID} button{transition:none!important}}
}
`;
  document.head.appendChild(style);
}

function ensureLogo(){
  const header=$(`#${HEADER_ID}`);if(!header)return;
  if(!$('.m82-logo',header)){
    const img=document.createElement('img');img.className='m82-logo';img.src='./logo-salamat-aval.svg';img.alt='سلامت اول';img.decoding='async';img.fetchPriority='high';header.appendChild(img);
  }
}
function decorateWelcome(launcher){
  const welcome=$('.m71-welcome',launcher);if(!welcome)return;
  if(role()==='ADMIN'){
    const badge=$('span',welcome),title=$('h2',welcome),copy=$('p',welcome);
    if(badge)badge.textContent='مدیر سامانه';
    if(title)title.textContent='سلام مدیر، خوش آمدید';
    if(copy)copy.textContent='تمام ماژول‌هایی که برای حساب شما فعال است از همین صفحه در دسترس قرار دارد.';
  }
  const head=$('.m71-section-head',launcher);if(head){
    const strong=$('strong',head),small=$('small',head);if(strong)strong.textContent='ماژول‌های من';
    if(small){const count=$$('.m71-module',launcher).length;small.textContent=`${count.toLocaleString('fa-IR')} دسترسی فعال`;}
  }
}
function decorateCards(launcher){
  $$('.m71-module',launcher).forEach(button=>{
    const kind=photoKind(button);if(!kind||!PHOTO[kind])return;
    button.dataset.m82Photo=kind;
    button.style.setProperty('--m82-photo',`url("${PHOTO_BASE}${PHOTO[kind]}?v=${VERSION}")`);
  });
}
function decorate(){
  scheduled=0;if(!MEDIA.matches)return;
  const launcher=$(`#${LAUNCHER_ID}`);if(!launcher)return;
  launcher.classList.add('m82-reference-home');
  ensureLogo();decorateWelcome(launcher);decorateCards(launcher);
  document.documentElement.dataset.salamatMobileReferenceDashboard=VERSION;
}
function schedule(){if(!MEDIA.matches||scheduled)return;scheduled=requestAnimationFrame(decorate)}
function install(){
  addStyles();schedule();
  ['salamat-mobile-v71-home','salamat-authenticated','salamat-access-ready'].forEach(name=>window.addEventListener(name,schedule,{passive:true}));
  MEDIA.addEventListener?.('change',schedule);
}
window.SalamatMobileReferenceDashboard={version:VERSION,decorate:schedule};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();