(()=>{
'use strict';
if(window.__salamatStaffEvaluationMobileV1)return;
window.__salamatStaffEvaluationMobileV1=true;

const VERSION='1.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
let active=false;
let mode='directory';
let activeIndicator='';
let frame=0;
let observer=null;

function role(){
  const access=window.SalamatStaffModuleRouter?.access;
  const backend=window.SalamatBackend?.getCurrentUser?.()||{};
  return String(access?.user?.role||backend.actualRole||backend.role||'').toUpperCase();
}
function isAdmin(){return role()==='ADMIN'}
function state(){return window.SalamatEvaluationModuleV4?.state||null}
function root(){return $('.sev4-root')}
function selectedCaregiver(){
  const current=state();
  const id=String(current?.selectedCaregiverId||'');
  return (current?.caregivers||[]).find(item=>String(item.id)===id)||null;
}
function selectedName(){return selectedCaregiver()?.fullName||$('.sev4-profile h2',root())?.textContent?.trim()||'مراقب'}
function indicatorTitle(code){return $(`.sev4-indicator[data-sev4-indicator="${CSS.escape(String(code||''))}"] .sev4-indicator-title strong`,root())?.textContent?.trim()||'شاخص ارزیابی'}

function addStyles(){
  if($('#salamatStaffEvaluationMobileV1Styles'))return;
  const style=document.createElement('style');
  style.id='salamatStaffEvaluationMobileV1Styles';
  style.textContent=`
@media(max-width:760px){
 .sev4-root.sem1-root{direction:rtl;display:block!important}
 .sev4-root.sem1-root .sev4-layout{display:block!important}
 .sev4-root.sem1-directory>.sev4-layout>aside.sev4-panel{display:block!important;width:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important}
 .sev4-root.sem1-directory>.sev4-layout>main.sev4-panel{display:none!important}
 .sev4-root.sem1-directory>.sev4-layout>aside.sev4-panel>.sev4-head{padding:2px 2px 13px!important;border:0!important;background:transparent!important}
 .sev4-root.sem1-directory>.sev4-layout>aside.sev4-panel>.sev4-head h3{font-size:18px!important;font-weight:950!important;color:#1c2c24!important}
 .sev4-root.sem1-directory>.sev4-layout>aside.sev4-panel>.sev4-head p{font-size:10px!important;line-height:1.9!important;color:#7b8882!important}
 .sev4-root.sem1-directory>.sev4-layout>aside.sev4-panel>.sev4-body{padding:0!important}
 .sev4-root.sem1-directory .sev4-search-form{position:sticky!important;top:106px!important;z-index:28!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:0 0 14px!important;padding:10px!important;border:1px solid rgba(221,234,227,.92)!important;border-radius:18px!important;background:rgba(255,255,255,.96)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;box-shadow:0 10px 26px rgba(22,61,43,.08)!important}
 .sev4-root.sem1-directory .sev4-search{grid-column:1/-1!important;width:100%!important;min-height:48px!important;padding:11px 14px!important;border-radius:13px!important;font-size:16px!important}
 .sev4-root.sem1-directory .sev4-search-form .sev4-btn{min-height:42px!important;font-size:10px!important}
 .sev4-root.sem1-directory .sev4-meta{margin:0 3px 10px!important;font-size:9px!important}
 .sev4-root.sem1-directory .sev4-list{display:grid!important;gap:9px!important;max-height:none!important;overflow:visible!important;padding:0!important}
 .sev4-root.sem1-directory .sev4-care{grid-template-columns:50px minmax(0,1fr) auto!important;min-height:76px!important;padding:11px!important;border:1px solid #dfeae4!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 22px rgba(21,65,45,.045)!important;touch-action:manipulation!important}
 .sev4-root.sem1-directory .sev4-care.active{border-color:#dfeae4!important;background:#fff!important;box-shadow:0 8px 22px rgba(21,65,45,.045)!important}
 .sev4-root.sem1-directory .sev4-care strong{font-size:12px!important;line-height:1.7!important}
 .sev4-root.sem1-directory .sev4-care small{font-size:8.5px!important;line-height:1.8!important}
 .sev4-root.sem1-directory .sev4-pagination{margin-top:13px!important;padding:12px 3px 0!important}

 .sev4-root.sem1-overview>.sev4-layout>aside.sev4-panel,.sev4-root.sem1-criterion>.sev4-layout>aside.sev4-panel{display:none!important}
 .sev4-root.sem1-overview>.sev4-layout>main.sev4-panel,.sev4-root.sem1-criterion>.sev4-layout>main.sev4-panel{display:block!important;width:100%!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
 .sev4-root.sem1-overview>.sev4-layout>main.sev4-panel>.sev4-head,.sev4-root.sem1-criterion>.sev4-layout>main.sev4-panel>.sev4-head{display:none!important}
 .sev4-root.sem1-overview>.sev4-layout>main.sev4-panel>.sev4-body,.sev4-root.sem1-criterion>.sev4-layout>main.sev4-panel>.sev4-body{padding:0!important}
 .sem1-toolbar{position:sticky;top:106px;z-index:27;display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 11px;border:1px solid rgba(218,233,225,.95);border-radius:17px;background:rgba(255,255,255,.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 9px 24px rgba(22,61,43,.08)}
 .sem1-back{width:40px;height:40px;min-width:40px;border:0;border-radius:12px;background:#eaf6ef;color:#08743f;display:grid;place-items:center;font:950 22px/1 inherit;touch-action:manipulation;cursor:pointer}
 .sem1-toolbar-copy{min-width:0;flex:1;text-align:right}.sem1-toolbar-copy strong,.sem1-toolbar-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sem1-toolbar-copy strong{font-size:12px;color:#20342a}.sem1-toolbar-copy small{margin-top:4px;font-size:8.5px;color:#7a8981}

 .sev4-root.sem1-overview .sev4-profile{margin-bottom:10px;padding:13px;border:1px solid #dce9e2;border-radius:18px;background:#fff;box-shadow:0 7px 20px rgba(20,64,44,.04)}
 .sev4-root.sem1-overview .sev4-avatar-lg{width:58px!important;height:58px!important;border-radius:17px!important;font-size:18px!important}.sev4-root.sem1-overview .sev4-profile h2{font-size:15px!important}.sev4-root.sem1-overview .sev4-profile p{font-size:8.5px!important;line-height:1.7!important}
 .sev4-root.sem1-overview .sev4-period-hub{display:block!important;margin:0 0 12px!important;padding:12px!important;border-radius:17px!important;background:#f8fcfa!important}.sev4-root.sem1-overview .sev4-period-controls{margin-top:10px!important}.sev4-root.sem1-overview .sev4-period-select-row{grid-template-columns:1fr!important}.sev4-root.sem1-overview #sev4NewPeriod{width:100%!important;min-height:42px!important}
 .sev4-root.sem1-overview .sev4-kpis,.sev4-root.sem1-overview .sev4-scale{display:none!important}
 .sev4-root.sem1-overview .sev4-indicators{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
 .sev4-root.sem1-overview .sev4-indicator{display:block!important;min-width:0!important;border:1px solid #dce8e2!important;border-radius:20px!important;background:linear-gradient(145deg,#fff,#fbfdfc)!important;overflow:hidden!important;box-shadow:0 10px 25px rgba(22,61,43,.055)!important}
 .sev4-root.sem1-overview .sev4-indicator-body{display:none!important}
 .sev4-root.sem1-overview .sev4-indicator-head{position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;width:100%!important;min-height:138px!important;padding:14px 12px 12px!important;gap:7px!important;background:transparent!important;text-align:right!important;touch-action:manipulation!important}
 .sev4-root.sem1-overview .sev4-indicator-title{display:block!important;min-width:0!important;order:1!important}.sev4-root.sem1-overview .sev4-indicator-title b{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:38px!important;height:23px!important;margin:0 0 7px!important;padding:0 7px!important;border-radius:999px!important;background:#eaf6ef!important;color:#08743f!important;font-size:8px!important}.sev4-root.sem1-overview .sev4-indicator-title strong{display:block!important;min-height:38px!important;font-size:11px!important;line-height:1.75!important;color:#20342a!important}.sev4-root.sem1-overview .sev4-indicator-title small{display:none!important}
 .sev4-root.sem1-overview .sev4-indicator-head>span:nth-child(2){display:block!important;order:3!important;margin-top:auto!important}.sev4-root.sem1-overview .sev4-indicator-head>span:nth-child(2)>small{display:block!important;margin-top:5px!important;font-size:7.5px!important;line-height:1.5!important;color:#859189!important}.sev4-root.sem1-overview .sev4-progress{height:6px!important;border-radius:999px!important}
 .sev4-root.sem1-overview .sev4-score{display:flex!important;align-items:baseline!important;gap:5px!important;order:2!important;text-align:right!important;padding:7px 9px!important;border-radius:12px!important;background:#f0f8f3!important}.sev4-root.sem1-overview .sev4-score strong{font-size:18px!important;color:#08743f!important}.sev4-root.sem1-overview .sev4-score small{font-size:7.2px!important;color:#728279!important}
 .sev4-root.sem1-overview .sev4-indicator-head:after{content:'‹';position:absolute;left:10px;top:11px;color:#8e9b94;font-size:18px;font-weight:950;line-height:1}
 .sev4-root.sem1-overview .sev4-final{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-top:13px!important;padding:14px!important;border-radius:18px!important}.sev4-root.sem1-overview .sev4-final .sev4-btn{width:100%!important;min-height:47px!important}

 .sev4-root.sem1-criterion .sev4-profile,.sev4-root.sem1-criterion .sev4-period-hub,.sev4-root.sem1-criterion .sev4-kpis,.sev4-root.sem1-criterion .sev4-scale,.sev4-root.sem1-criterion .sev4-final{display:none!important}
 .sev4-root.sem1-criterion .sev4-indicators{display:block!important}.sev4-root.sem1-criterion .sev4-indicator{display:none!important}.sev4-root.sem1-criterion .sev4-indicator.sem1-active-indicator{display:block!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
 .sev4-root.sem1-criterion .sev4-indicator.sem1-active-indicator>.sev4-indicator-head{display:block!important;margin:0 0 10px!important;padding:13px!important;border:1px solid #dce9e2!important;border-radius:17px!important;background:#fff!important;cursor:default!important}.sev4-root.sem1-criterion .sev4-indicator.sem1-active-indicator>.sev4-indicator-head>span:nth-child(2){margin-top:10px!important}.sev4-root.sem1-criterion .sev4-indicator-title b{display:inline-flex!important;margin:0 0 6px!important;padding:5px 8px!important;border-radius:999px!important;background:#eaf6ef!important;color:#08743f!important}.sev4-root.sem1-criterion .sev4-indicator-title strong{display:block!important;font-size:12px!important;line-height:1.8!important}.sev4-root.sem1-criterion .sev4-indicator-title small{display:none!important}.sev4-root.sem1-criterion .sev4-score{margin-top:8px!important;text-align:right!important}.sev4-root.sem1-criterion .sev4-score strong{font-size:19px!important}.sev4-root.sem1-criterion .sev4-score small{font-size:8px!important}
 .sev4-root.sem1-criterion .sev4-indicator-body{display:block!important;padding:0!important;border:0!important}.sev4-root.sem1-criterion .sev4-criterion{display:block!important;margin:0 0 9px!important;padding:13px!important;border:1px solid #dce9e2!important;border-radius:17px!important;background:#fff!important}.sev4-root.sem1-criterion .sev4-criterion-title{display:block!important;margin-bottom:11px!important}.sev4-root.sem1-criterion .sev4-criterion-title strong{font-size:11px!important;line-height:1.9!important}.sev4-root.sem1-criterion .sev4-criterion-title small{font-size:8px!important;line-height:1.7!important}
 .sev4-root.sem1-criterion .sev4-score-options{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}.sev4-root.sem1-criterion .sev4-score-option span{min-height:54px!important;padding:5px 2px!important;border-radius:10px!important;font-size:6.8px!important;line-height:1.35!important}.sev4-root.sem1-criterion .sev4-score-option span b{font-size:14px!important}.sev4-root.sem1-criterion .sev4-note{min-height:44px!important;margin-top:7px!important;font-size:10px!important}.sev4-root.sem1-criterion .sev4-indicator-footer{position:sticky!important;bottom:calc(96px + env(safe-area-inset-bottom))!important;z-index:24!important;display:block!important;margin-top:11px!important;padding:10px!important;border:1px solid #d7e7df!important;border-radius:16px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 10px 28px rgba(21,65,45,.11)!important}.sev4-root.sem1-criterion .sev4-hint{display:none!important}.sev4-root.sem1-criterion .sev4-indicator-footer .sev4-btn{width:100%!important;min-height:48px!important}
 .sev4-root.sem1-criterion .sev4-readonly{margin-bottom:10px!important}
 .sev4-root.sem1-root .sev4-modal{padding:12px!important}.sev4-root.sem1-root .sev4-dialog{max-height:calc(100dvh - 24px)!important;border-radius:20px!important}.sev4-root.sem1-root .sev4-period-form{padding:15px!important}
}
@media(max-width:365px){.sev4-root.sem1-overview .sev4-indicators{gap:8px!important}.sev4-root.sem1-overview .sev4-indicator-head{min-height:132px!important;padding:12px 9px 10px!important}.sev4-root.sem1-overview .sev4-indicator-title strong{font-size:10px!important}.sev4-root.sem1-criterion .sev4-score-option span{font-size:6.2px!important}}
`;
  (document.head||document.documentElement).appendChild(style);
}

function toolbar(){
  const r=root();if(!r||mode==='directory')return null;
  const holder=$(':scope > .sev4-layout > main.sev4-panel > .sev4-body',r)||$('.sev4-layout main.sev4-panel .sev4-body',r);if(!holder)return null;
  let bar=$('.sem1-toolbar',holder);
  if(!bar){bar=document.createElement('div');bar.className='sem1-toolbar';holder.prepend(bar)}
  const title=mode==='criterion'?indicatorTitle(activeIndicator):selectedName();
  const subtitle=mode==='criterion'?`امتیازدهی معیارهای شاخص برای ${selectedName()}`:'شاخص موردنظر را برای ارزیابی انتخاب کنید';
  bar.innerHTML=`<button type="button" class="sem1-back" data-sem1-back="${mode==='criterion'?'overview':'directory'}" aria-label="بازگشت">›</button><div class="sem1-toolbar-copy"><strong>${title}</strong><small>${subtitle}</small></div>`;
  return bar;
}

function apply(){
  frame=0;
  if(!active||!MEDIA.matches||!isAdmin())return;
  const r=root();if(!r)return;
  r.classList.add('sem1-root');
  r.classList.toggle('sem1-directory',mode==='directory');
  r.classList.toggle('sem1-overview',mode==='overview');
  r.classList.toggle('sem1-criterion',mode==='criterion');
  r.dataset.sem1Mode=mode;r.dataset.sem1Version=VERSION;
  $$('.sem1-toolbar',r).forEach(node=>node.remove());
  $$('.sev4-indicator',r).forEach(card=>{
    const selected=mode==='criterion'&&String(card.dataset.sev4Indicator||'')===String(activeIndicator||'');
    card.classList.toggle('sem1-active-indicator',selected);
    if(selected)card.classList.add('open');
  });
  toolbar();
}
function schedule(){if(frame)return;frame=requestAnimationFrame(apply)}
function observe(){
  const content=$('#content');if(!content||observer)return;
  observer=new MutationObserver(()=>schedule());observer.observe(content,{childList:true,subtree:true});
}
function activateDirectory(){active=true;mode='directory';activeIndicator='';observe();schedule();requestAnimationFrame(()=>window.scrollTo?.({top:0,left:0,behavior:'auto'}))}
function leave(){active=false;mode='directory';activeIndicator='';}

function onModuleOpened(event){
  if(event?.detail?.key==='staff.evaluations'&&MEDIA.matches&&isAdmin())activateDirectory();
  else if(event?.detail?.key&&event.detail.key!=='staff.evaluations')leave();
}
function onPointer(event){
  if(!active||!MEDIA.matches||!isAdmin()||!root())return;
  const target=event.target;if(!(target instanceof Element))return;
  const caregiver=target.closest('[data-sev4-caregiver]');
  if(caregiver){mode='overview';activeIndicator='';schedule();return}
  if(mode==='overview'){
    const head=target.closest('.sev4-indicator-head');const card=head?.closest?.('.sev4-indicator[data-sev4-indicator]');
    if(card){activeIndicator=String(card.dataset.sev4Indicator||'');mode='criterion';schedule()}
  }
}
function onClick(event){
  if(!active||!MEDIA.matches||!isAdmin()||!root())return;
  const target=event.target;if(!(target instanceof Element))return;
  const back=target.closest('[data-sem1-back]');
  if(back){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const next=back.dataset.sem1Back;if(next==='overview'){mode='overview';activeIndicator=''}else{mode='directory';activeIndicator=''}schedule();requestAnimationFrame(()=>window.scrollTo?.({top:0,left:0,behavior:'auto'}));return}
  const caregiver=target.closest('[data-sev4-caregiver]');if(caregiver){mode='overview';activeIndicator='';schedule();return}
  if(mode==='overview'){
    const head=target.closest('.sev4-indicator-head');const card=head?.closest?.('.sev4-indicator[data-sev4-indicator]');
    if(card){activeIndicator=String(card.dataset.sev4Indicator||'');mode='criterion';schedule();requestAnimationFrame(()=>window.scrollTo?.({top:0,left:0,behavior:'auto'}))}
  }
}

function boot(){
  addStyles();observe();
  document.addEventListener('pointerdown',onPointer,true);
  document.addEventListener('click',onClick,true);
  window.addEventListener('salamat-module-opened',onModuleOpened);
  window.addEventListener('salamat-mobile-navigation-complete',event=>{const label=String(event?.detail?.label||'');if(!label.includes('ارزیابی')&&!label.includes('پروانه')&&active&&!root())leave()});
  window.addEventListener('pageshow',()=>{if(MEDIA.matches&&isAdmin()&&String($('#pageTitle')?.textContent||'').includes('ارزیابی')&&root())activateDirectory()});
  MEDIA.addEventListener?.('change',()=>{if(!MEDIA.matches)leave();else if(isAdmin()&&String($('#pageTitle')?.textContent||'').includes('ارزیابی')&&root())activateDirectory()});
  window.SalamatStaffEvaluationMobile={version:VERSION,openDirectory:activateDirectory,get mode(){return mode},get activeIndicator(){return activeIndicator}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
