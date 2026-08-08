(()=>{
'use strict';
if(window.__salamatMobileEvaluationDrilldownV76)return;
window.__salamatMobileEvaluationDrilldownV76=true;

const VERSION='7.6.0';
const MOBILE=window.matchMedia('(max-width:760px)');
const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];

let mode='directory';
let activeIndicator='';
let selectedCaregiver='';
let directoryLocked=true;
let rootObserver=null;
let contentObserver=null;
let syncFrame=0;
let loginRepairFrame=0;
let loginRepairAttempts=0;
let logoutInFlight=false;

function state(){return window.SalamatEvaluationModuleV4?.state||null}
function root(){return $('.sev4-root')}
function selectedName(){
  const profile=$('.sev4-profile h2',root());
  if(profile?.textContent?.trim())return profile.textContent.trim();
  const current=state();
  const id=String(current?.selectedCaregiverId||'');
  const item=(current?.caregivers||[]).find(row=>String(row.id)===id);
  return String(item?.fullName||'مراقب').trim()||'مراقب';
}
function indicatorTitle(code){
  const card=$(`.sev4-indicator[data-sev4-indicator="${CSS.escape(String(code||''))}"]`,root());
  return $('.sev4-indicator-title strong',card)?.textContent?.trim()||String(code||'شاخص ارزیابی');
}

function addStyles(){
  if($('#salamatMobileEvaluationDrilldownV76Styles'))return;
  const style=document.createElement('style');
  style.id='salamatMobileEvaluationDrilldownV76Styles';
  style.textContent=`
@media(max-width:760px){
  .sev4-root.me76-root .sev4-layout{display:block!important}
  .sev4-root.me76-root .me76-toolbar{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 11px;border:1px solid #dbe9e1;border-radius:16px;background:#fff;position:sticky;top:calc(66px + env(safe-area-inset-top));z-index:20;box-shadow:0 7px 18px rgba(18,63,42,.07)}
  .sev4-root.me76-root .me76-back{width:40px;height:40px;min-width:40px;border:0;border-radius:12px;background:#eaf4ee;color:#185b38;font:inherit;font-size:19px;font-weight:900;display:grid;place-items:center;touch-action:manipulation}
  .sev4-root.me76-root .me76-toolbar-copy{min-width:0;flex:1;text-align:right}
  .sev4-root.me76-root .me76-toolbar-copy strong,.sev4-root.me76-root .me76-toolbar-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sev4-root.me76-root .me76-toolbar-copy strong{font-size:12px;color:#20372c}
  .sev4-root.me76-root .me76-toolbar-copy small{margin-top:3px;font-size:8.5px;color:#78877f}

  .sev4-root.me76-directory> .sev4-layout>main.sev4-panel{display:none!important}
  .sev4-root.me76-directory> .sev4-layout>aside.sev4-panel{display:block!important;width:100%!important}
  .sev4-root.me76-directory .sev4-care.active{border-color:#e0e9e4!important;background:#fff!important;box-shadow:none!important}

  .sev4-root.me76-overview> .sev4-layout>aside.sev4-panel,
  .sev4-root.me76-criterion> .sev4-layout>aside.sev4-panel{display:none!important}
  .sev4-root.me76-overview> .sev4-layout>main.sev4-panel,
  .sev4-root.me76-criterion> .sev4-layout>main.sev4-panel{display:block!important;width:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important}
  .sev4-root.me76-overview> .sev4-layout>main.sev4-panel>.sev4-head,
  .sev4-root.me76-criterion> .sev4-layout>main.sev4-panel>.sev4-head{display:none!important}
  .sev4-root.me76-overview> .sev4-layout>main.sev4-panel>.sev4-body,
  .sev4-root.me76-criterion> .sev4-layout>main.sev4-panel>.sev4-body{padding:0!important}

  .sev4-root.me76-overview .sev4-profile{padding:13px;border:1px solid #dce8e2;border-radius:18px;background:#fff;margin-bottom:10px}
  .sev4-root.me76-overview .sev4-avatar-lg{width:58px;height:58px;border-radius:17px;font-size:18px}
  .sev4-root.me76-overview .sev4-profile h2{font-size:15px!important}
  .sev4-root.me76-overview .sev4-period-hub{display:block!important;margin:0 0 12px!important;padding:12px!important;border-radius:16px!important}
  .sev4-root.me76-overview .sev4-period-current{align-items:center!important}
  .sev4-root.me76-overview .sev4-period-controls{margin-top:10px}
  .sev4-root.me76-overview .sev4-kpis,.sev4-root.me76-overview .sev4-scale{display:none!important}
  .sev4-root.me76-overview .sev4-indicators{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  .sev4-root.me76-overview .sev4-indicator{display:block!important;border:1px solid #dbe7e1!important;border-radius:18px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 7px 18px rgba(18,63,42,.055)!important}
  .sev4-root.me76-overview .sev4-indicator-body{display:none!important}
  .sev4-root.me76-overview .sev4-indicator-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important;align-items:center!important;min-height:94px!important;padding:15px!important;background:#fff!important;touch-action:manipulation!important}
  .sev4-root.me76-overview .sev4-indicator-title{min-width:0}
  .sev4-root.me76-overview .sev4-indicator-title b{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:42px!important;height:25px!important;padding:0 8px!important;border-radius:999px!important;background:#eaf6ef!important;margin:0 0 7px!important;font-size:9px!important}
  .sev4-root.me76-overview .sev4-indicator-title strong{display:block!important;font-size:12px!important;line-height:1.8!important;color:#20372c!important}
  .sev4-root.me76-overview .sev4-indicator-title small{margin-top:4px!important;font-size:8px!important;line-height:1.7!important}
  .sev4-root.me76-overview .sev4-indicator-head>span:nth-child(2){grid-column:1/-1;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important}
  .sev4-root.me76-overview .sev4-indicator-head>span:nth-child(2) small{margin:0!important;font-size:8px!important;white-space:nowrap!important}
  .sev4-root.me76-overview .sev4-progress{height:7px!important}
  .sev4-root.me76-overview .sev4-score{grid-column:2;grid-row:1;min-width:58px;padding:8px;border-radius:13px;background:#f2f8f4}
  .sev4-root.me76-overview .sev4-score strong{font-size:17px!important}
  .sev4-root.me76-overview .sev4-score small{font-size:7.5px!important}
  .sev4-root.me76-overview .sev4-indicator-head:after{content:'‹';grid-column:2;grid-row:2;color:#185b38;font-size:24px;font-weight:900;line-height:1;justify-self:center}
  .sev4-root.me76-overview .sev4-final{margin-top:12px!important;padding:14px!important;border-radius:17px!important;display:grid!important;grid-template-columns:1fr!important}
  .sev4-root.me76-overview .sev4-final .sev4-btn{width:100%!important;min-height:46px!important}

  .sev4-root.me76-criterion .sev4-profile,
  .sev4-root.me76-criterion .sev4-period-hub,
  .sev4-root.me76-criterion .sev4-kpis,
  .sev4-root.me76-criterion .sev4-scale,
  .sev4-root.me76-criterion .sev4-final{display:none!important}
  .sev4-root.me76-criterion .sev4-indicators{display:block!important}
  .sev4-root.me76-criterion .sev4-indicator{display:none!important}
  .sev4-root.me76-criterion .sev4-indicator.me76-active-indicator{display:block!important;border:0!important;border-radius:0!important;background:transparent!important;overflow:visible!important}
  .sev4-root.me76-criterion .sev4-indicator.me76-active-indicator>.sev4-indicator-head{display:block!important;padding:14px!important;margin-bottom:10px!important;border:1px solid #dce8e2!important;border-radius:17px!important;background:#fff!important;cursor:default!important}
  .sev4-root.me76-criterion .sev4-indicator.me76-active-indicator>.sev4-indicator-head>span:nth-child(2),
  .sev4-root.me76-criterion .sev4-indicator.me76-active-indicator>.sev4-indicator-head>.sev4-score{display:none!important}
  .sev4-root.me76-criterion .sev4-indicator-title b{display:inline-flex!important;margin-bottom:6px!important;padding:5px 8px!important;border-radius:999px!important;background:#eaf6ef!important}
  .sev4-root.me76-criterion .sev4-indicator-title strong{display:block!important;font-size:13px!important;line-height:1.8!important}
  .sev4-root.me76-criterion .sev4-indicator-body{display:block!important;padding:0!important;border:0!important}
  .sev4-root.me76-criterion .sev4-criterion{display:block!important;padding:14px!important;margin-bottom:10px!important;border:1px solid #dce8e2!important;border-radius:17px!important;background:#fff!important}
  .sev4-root.me76-criterion .sev4-criterion-title{display:block!important;margin-bottom:12px!important}
  .sev4-root.me76-criterion .sev4-criterion-title strong{font-size:11.5px!important;line-height:1.9!important}
  .sev4-root.me76-criterion .sev4-score-options{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}
  .sev4-root.me76-criterion .sev4-score-option span{min-height:52px!important;padding:5px 2px!important;font-size:7px!important}
  .sev4-root.me76-criterion .sev4-score-option span b{font-size:14px!important}
  .sev4-root.me76-criterion .sev4-note{min-height:44px!important;font-size:10px!important}
  .sev4-root.me76-criterion .sev4-indicator-footer{position:sticky;bottom:calc(88px + env(safe-area-inset-bottom));z-index:15;margin-top:12px!important;padding:10px!important;border:1px solid #d8e7df!important;border-radius:15px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 9px 24px rgba(18,63,42,.11)!important}
  .sev4-root.me76-criterion .sev4-hint{display:none!important}
  .sev4-root.me76-criterion .sev4-indicator-footer .sev4-btn{width:100%!important;min-height:48px!important}
}
`;
  (document.head||document.documentElement).appendChild(style);
}

function toolbarMarkup(kind){
  const wrap=document.createElement('div');
  wrap.className='me76-toolbar';
  wrap.dataset.me76Toolbar=kind;
  const back=document.createElement('button');
  back.type='button';
  back.className='me76-back';
  back.dataset.me76Back=kind==='criterion'?'indicators':'directory';
  back.setAttribute('aria-label',kind==='criterion'?'بازگشت به شاخص‌ها':'بازگشت به فهرست مراقبین');
  back.textContent='›';
  const copy=document.createElement('div');
  copy.className='me76-toolbar-copy';
  const strong=document.createElement('strong');
  const small=document.createElement('small');
  if(kind==='criterion'){
    strong.textContent=indicatorTitle(activeIndicator);
    small.textContent=`ارزیابی ${selectedName()} • امتیازدهی معیارهای شاخص`;
  }else{
    strong.textContent=selectedName();
    small.textContent='صفحه ارزیابی مراقب • انتخاب شاخص برای امتیازدهی';
  }
  copy.append(strong,small);
  wrap.append(back,copy);
  return wrap;
}

function ensureToolbar(){
  const r=root();
  if(!r||mode==='directory'){$$('.me76-toolbar',r||document).forEach(node=>node.remove());return}
  const body=$(':scope > .sev4-layout > main.sev4-panel > .sev4-body',r)||$('.sev4-layout main.sev4-panel .sev4-body',r);
  if(!body)return;
  const kind=mode==='criterion'?'criterion':'overview';
  const old=$('.me76-toolbar',body);
  if(old?.dataset.me76Toolbar===kind){
    const strong=$('.me76-toolbar-copy strong',old),small=$('.me76-toolbar-copy small',old);
    if(kind==='criterion'){
      if(strong)strong.textContent=indicatorTitle(activeIndicator);
      if(small)small.textContent=`ارزیابی ${selectedName()} • امتیازدهی معیارهای شاخص`;
    }else{
      if(strong)strong.textContent=selectedName();
      if(small)small.textContent='صفحه ارزیابی مراقب • انتخاب شاخص برای امتیازدهی';
    }
    return;
  }
  old?.remove();
  body.prepend(toolbarMarkup(kind));
}

function applyIndicatorSelection(){
  const r=root();
  if(!r)return;
  $$('.sev4-indicator',r).forEach(card=>{
    const active=mode==='criterion'&&String(card.dataset.sev4Indicator||'')===String(activeIndicator||'');
    card.classList.toggle('me76-active-indicator',active);
    if(active)card.classList.add('open');
  });
}

function applyMode(){
  const r=root();
  if(!r)return;
  r.classList.add('me76-root');
  r.classList.toggle('me76-directory',mode==='directory');
  r.classList.toggle('me76-overview',mode==='overview');
  r.classList.toggle('me76-criterion',mode==='criterion');
  r.dataset.me76Mode=mode;
  r.dataset.me76Version=VERSION;
  ensureToolbar();
  applyIndicatorSelection();
}

function resetDirectory(lock=true){
  directoryLocked=lock;
  mode='directory';
  activeIndicator='';
  selectedCaregiver='';
  applyMode();
  window.scrollTo?.({top:0,left:0,behavior:'auto'});
}

function reconcile(){
  if(!MOBILE.matches)return;
  const r=root();
  if(!r)return;
  if(directoryLocked){
    mode='directory';
    activeIndicator='';
    selectedCaregiver='';
    applyMode();
    return;
  }
  const current=state();
  const caregiverId=String(current?.selectedCaregiverId||'');
  if(!caregiverId){mode='directory';activeIndicator='';selectedCaregiver=''}
  else if(caregiverId!==selectedCaregiver){selectedCaregiver=caregiverId;mode='overview';activeIndicator=''}
  if(mode==='criterion'){
    const exists=Boolean($(`.sev4-indicator[data-sev4-indicator="${CSS.escape(String(activeIndicator||''))}"]`,r));
    if(!exists){mode='overview';activeIndicator=''}
  }
  applyMode();
}
function schedule(){cancelAnimationFrame(syncFrame);syncFrame=requestAnimationFrame(reconcile)}

function observeRoot(){
  const r=root();
  if(!r||rootObserver?.__root===r)return;
  rootObserver?.disconnect();
  rootObserver=new MutationObserver(schedule);
  rootObserver.__root=r;
  rootObserver.observe(r,{childList:true,subtree:true});
  schedule();
}
function observeContent(){
  const content=$('#content');
  if(!content||contentObserver)return;
  contentObserver=new MutationObserver(()=>{observeRoot();schedule()});
  contentObserver.observe(content,{childList:true,subtree:false});
}

function loginVisible(){
  const login=$('#loginView');
  return Boolean(login&&!login.classList.contains('hidden')&&!login.hidden&&login.getAttribute('aria-hidden')!=='true');
}
function loginReady(){return Boolean($('#salamatMobileLoginStageV5')&&document.body?.classList.contains('salamat-mobile-login-v5'))}
function repairLogin(){
  loginRepairFrame=0;
  if(!MOBILE.matches||!loginVisible())return;
  loginRepairAttempts+=1;
  window.SalamatMobileLoginIsolation?.sync?.();
  const owner=window.SalamatMobileCaregiverShellV5;
  if(typeof owner?.rebuild==='function'&&(loginRepairAttempts===1||loginRepairAttempts%8===0))owner.rebuild();
  else if(typeof owner?.sync==='function'&&(loginRepairAttempts===1||loginRepairAttempts%8===0))owner.sync();
  if(loginReady()){
    document.documentElement.classList.remove('salamat-mobile-preboot-v74');
    document.documentElement.dataset.salamatMobileLoginOwner=VERSION;
    const url=new URL(location.href);
    if(url.searchParams.has('salamat-mobile-login'))history.replaceState(history.state,'',url.pathname||'/');
    return;
  }
  if(loginRepairAttempts>=180){
    document.documentElement.classList.remove('salamat-mobile-preboot-v74');
    document.documentElement.dataset.salamatMobileLoginRepairFailOpen=VERSION;
    return;
  }
  loginRepairFrame=requestAnimationFrame(repairLogin);
}
function ensureApprovedLogin(reset=false){
  if(!MOBILE.matches||!loginVisible())return;
  document.documentElement.classList.add('salamat-mobile-preboot-v74');
  if(reset)loginRepairAttempts=0;
  cancelAnimationFrame(loginRepairFrame);
  loginRepairFrame=requestAnimationFrame(repairLogin);
}

async function runMobileLogout(event){
  const trigger=event.target?.closest?.('#logoutButton,.m71-logout,.m72-logout');
  if(!trigger||!MOBILE.matches)return false;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(logoutInFlight)return true;
  logoutInFlight=true;
  document.documentElement.classList.add('salamat-mobile-preboot-v74');
  trigger.disabled=true;
  try{
    if(typeof window.SalamatBackend?.api==='function')await window.SalamatBackend.api('/api/auth/logout',{method:'POST'});
    else await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});
  }catch(error){console.warn('Mobile logout request failed; continuing to signed-out surface',error)}
  try{localStorage.removeItem('salamatAvalSessionV1')}catch{}
  const target=`/?salamat-mobile-login=v5&logout=${Date.now()}`;
  location.replace(target);
  return true;
}

function pointerCapture(event){
  if(!MOBILE.matches)return;
  if(event.target?.closest?.('#logoutButton,.m71-logout,.m72-logout')){
    document.documentElement.classList.add('salamat-mobile-preboot-v74');
    return;
  }
  const caregiver=event.target?.closest?.('.sev4-root [data-sev4-caregiver]');
  if(!caregiver)return;
  directoryLocked=false;
  mode='overview';
  activeIndicator='';
  selectedCaregiver=String(caregiver.dataset.sev4Caregiver||'');
}

function capture(event){
  if(!MOBILE.matches)return;
  if(event.target?.closest?.('#logoutButton,.m71-logout,.m72-logout')){void runMobileLogout(event);return}
  const r=root();
  if(!r||!event.target?.closest?.('.sev4-root'))return;
  const back=event.target.closest('[data-me76-back]');
  if(back){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(back.dataset.me76Back==='indicators'){mode='overview';activeIndicator=''}
    else{resetDirectory(true);return}
    applyMode();
    window.scrollTo?.({top:0,behavior:'auto'});
    return;
  }
  const caregiver=event.target.closest('[data-sev4-caregiver]');
  if(caregiver){directoryLocked=false;mode='overview';activeIndicator='';selectedCaregiver=String(caregiver.dataset.sev4Caregiver||'');schedule();return}
  if(mode!=='overview')return;
  const head=event.target.closest('.sev4-indicator-head');
  if(!head)return;
  const card=head.closest('.sev4-indicator[data-sev4-indicator]');
  if(!card)return;
  activeIndicator=String(card.dataset.sev4Indicator||'');
  if(!activeIndicator)return;
  mode='criterion';
  const current=state();
  if(current)current.openIndicator=activeIndicator;
  requestAnimationFrame(()=>{applyMode();window.scrollTo?.({top:0,behavior:'auto'})});
}

function onModuleOpened(event){
  if(!MOBILE.matches)return;
  const key=String(event?.detail?.key||'');
  if(key==='staff.evaluations')resetDirectory(true);
  setTimeout(()=>{observeRoot();schedule()},0);
}
function onMobileRoute(event){
  if(String(event?.detail?.key||'')==='staff.evaluations')resetDirectory(true);
  onModuleOpened(event);
}
function cleanupDesktop(){
  const r=root();
  if(!r)return;
  r.classList.remove('me76-root','me76-directory','me76-overview','me76-criterion');
  delete r.dataset.me76Mode;
  $$('.me76-toolbar',r).forEach(node=>node.remove());
  $$('.me76-active-indicator',r).forEach(node=>node.classList.remove('me76-active-indicator'));
}

function boot(){
  addStyles();
  document.addEventListener('pointerdown',pointerCapture,true);
  document.addEventListener('click',capture,true);
  window.addEventListener('salamat-module-opened',onModuleOpened);
  window.addEventListener('salamat-mobile-v71-route',onMobileRoute);
  window.addEventListener('salamat-authenticated',onModuleOpened);
  window.addEventListener('salamat-mobile-login-surface',()=>ensureApprovedLogin(false));
  window.addEventListener('pageshow',()=>ensureApprovedLogin(true));
  MOBILE.addEventListener?.('change',()=>{if(MOBILE.matches){observeRoot();schedule();ensureApprovedLogin(true)}else cleanupDesktop()});
  observeContent();
  observeRoot();
  schedule();
  ensureApprovedLogin(true);
  window.SalamatMobileEvaluationDrilldown={version:VERSION,sync:schedule,openDirectory:()=>resetDirectory(true),ensureLogin:()=>ensureApprovedLogin(true),get mode(){return mode},get activeIndicator(){return activeIndicator},get directoryLocked(){return directoryLocked}};
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();