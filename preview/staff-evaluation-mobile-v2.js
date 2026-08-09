(()=>{
'use strict';
if(window.__salamatStaffEvaluationMobileV2)return;
window.__salamatStaffEvaluationMobileV2=true;

const VERSION='2.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
let active=false;
let mode='directory';
let indicator='';
let raf=0;
let observer=null;

function routerAccess(){return window.SalamatStaffModuleRouter?.access||null}
function role(){
  const backend=window.SalamatBackend?.getCurrentUser?.()||{};
  return String(routerAccess()?.user?.role||backend.actualRole||backend.role||'').toUpperCase();
}
function eligible(){return MEDIA.matches&&role()==='ADMIN'}
function root(){return $('.sev4-root')}
function evalState(){return window.SalamatEvaluationModuleV4?.state||null}
function caregiverName(){
  const state=evalState();
  const id=String(state?.selectedCaregiverId||'');
  return (state?.caregivers||[]).find(item=>String(item.id)===id)?.fullName||$('.sev4-profile h2',root())?.textContent?.trim()||'مراقب';
}
function indicatorCard(code=indicator){
  return $$('.sev4-indicator[data-sev4-indicator]',root()).find(card=>String(card.dataset.sev4Indicator||'')===String(code||''))||null;
}
function indicatorName(){return $('.sev4-indicator-title strong',indicatorCard())?.textContent?.trim()||'شاخص ارزیابی'}

function addStyles(){
  if($('#salamatStaffEvaluationMobileV2Styles'))return;
  const style=document.createElement('style');
  style.id='salamatStaffEvaluationMobileV2Styles';
  style.textContent=`
@media(max-width:760px){
 .sev4-root.sem2{direction:rtl;display:block!important}.sev4-root.sem2 .sev4-layout{display:block!important}
 .sev4-root.sem2-directory>.sev4-layout>aside.sev4-panel{display:block!important;width:100%!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}.sev4-root.sem2-directory>.sev4-layout>main.sev4-panel{display:none!important}.sev4-root.sem2-directory>.sev4-layout>aside.sev4-panel>.sev4-head{padding:0 2px 12px!important;border:0!important;background:transparent!important}.sev4-root.sem2-directory>.sev4-layout>aside.sev4-panel>.sev4-head h3{font-size:18px!important;font-weight:950!important;color:#1b2b23!important}.sev4-root.sem2-directory>.sev4-layout>aside.sev4-panel>.sev4-head p{font-size:10px!important;line-height:1.9!important;color:#78867f!important}.sev4-root.sem2-directory>.sev4-layout>aside.sev4-panel>.sev4-body{padding:0!important}
 .sev4-root.sem2-directory .sev4-search-form{position:sticky!important;top:106px!important;z-index:28!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:0 0 14px!important;padding:10px!important;border:1px solid #dce9e2!important;border-radius:18px!important;background:rgba(255,255,255,.97)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;box-shadow:0 10px 26px rgba(22,61,43,.08)!important}.sev4-root.sem2-directory .sev4-search{grid-column:1/-1!important;width:100%!important;min-height:48px!important;padding:11px 14px!important;border-radius:13px!important;font-size:16px!important}.sev4-root.sem2-directory .sev4-search-form .sev4-btn{min-height:42px!important;font-size:10px!important}.sev4-root.sem2-directory .sev4-meta{margin:0 3px 10px!important;font-size:9px!important}.sev4-root.sem2-directory .sev4-list{display:grid!important;gap:9px!important;max-height:none!important;overflow:visible!important;padding:0!important}.sev4-root.sem2-directory .sev4-care{grid-template-columns:50px minmax(0,1fr) auto!important;min-height:76px!important;padding:11px!important;border:1px solid #dfeae4!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 22px rgba(21,65,45,.045)!important;touch-action:manipulation!important}.sev4-root.sem2-directory .sev4-care.active{border-color:#dfeae4!important;background:#fff!important}.sev4-root.sem2-directory .sev4-care strong{font-size:12px!important;line-height:1.7!important}.sev4-root.sem2-directory .sev4-care small{font-size:8.5px!important;line-height:1.8!important}.sev4-root.sem2-directory .sev4-pagination{margin-top:13px!important;padding:12px 3px 0!important}
 .sev4-root.sem2-overview>.sev4-layout>aside.sev4-panel,.sev4-root.sem2-criterion>.sev4-layout>aside.sev4-panel{display:none!important}.sev4-root.sem2-overview>.sev4-layout>main.sev4-panel,.sev4-root.sem2-criterion>.sev4-layout>main.sev4-panel{display:block!important;width:100%!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}.sev4-root.sem2-overview>.sev4-layout>main.sev4-panel>.sev4-head,.sev4-root.sem2-criterion>.sev4-layout>main.sev4-panel>.sev4-head{display:none!important}.sev4-root.sem2-overview>.sev4-layout>main.sev4-panel>.sev4-body,.sev4-root.sem2-criterion>.sev4-layout>main.sev4-panel>.sev4-body{padding:0!important}
 .sem2-toolbar{position:sticky;top:106px;z-index:29;display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 11px;border:1px solid #dce9e2;border-radius:17px;background:rgba(255,255,255,.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 9px 24px rgba(22,61,43,.08)}.sem2-back{width:40px;height:40px;min-width:40px;border:0;border-radius:12px;background:#eaf6ef;color:#08743f;display:grid;place-items:center;font:950 22px/1 inherit;touch-action:manipulation;cursor:pointer}.sem2-copy{min-width:0;flex:1}.sem2-copy strong,.sem2-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sem2-copy strong{font-size:12px;color:#20342a}.sem2-copy small{margin-top:4px;font-size:8.5px;color:#7a8981}
 .sev4-root.sem2-overview .sev4-profile{margin-bottom:10px;padding:13px!important;border:1px solid #dce9e2!important;border-radius:18px!important;background:#fff!important;box-shadow:0 7px 20px rgba(20,64,44,.04)!important}.sev4-root.sem2-overview .sev4-avatar-lg{width:58px!important;height:58px!important;border-radius:17px!important;font-size:18px!important}.sev4-root.sem2-overview .sev4-profile h2{font-size:15px!important}.sev4-root.sem2-overview .sev4-profile p{font-size:8.5px!important;line-height:1.7!important}.sev4-root.sem2-overview .sev4-period-hub{display:block!important;margin:0 0 12px!important;padding:12px!important;border-radius:17px!important;background:#f8fcfa!important}.sev4-root.sem2-overview .sev4-period-select-row{grid-template-columns:1fr!important}.sev4-root.sem2-overview #sev4NewPeriod{width:100%!important;min-height:42px!important}.sev4-root.sem2-overview .sev4-kpis,.sev4-root.sem2-overview .sev4-scale{display:none!important}
 .sev4-root.sem2-overview .sev4-indicators{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.sev4-root.sem2-overview .sev4-indicator{display:block!important;min-width:0!important;border:1px solid #dce8e2!important;border-radius:20px!important;background:linear-gradient(145deg,#fff,#fbfdfc)!important;overflow:hidden!important;box-shadow:0 10px 25px rgba(22,61,43,.055)!important}.sev4-root.sem2-overview .sev4-indicator-body{display:none!important}.sev4-root.sem2-overview .sev4-indicator-head{position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;min-height:138px!important;padding:14px 12px 12px!important;gap:7px!important;background:transparent!important;text-align:right!important;touch-action:manipulation!important}.sev4-root.sem2-overview .sev4-indicator-title{order:1!important;display:block!important}.sev4-root.sem2-overview .sev4-indicator-title b{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:38px!important;height:23px!important;margin:0 0 7px!important;padding:0 7px!important;border-radius:999px!important;background:#eaf6ef!important;color:#08743f!important;font-size:8px!important}.sev4-root.sem2-overview .sev4-indicator-title strong{display:block!important;min-height:38px!important;font-size:11px!important;line-height:1.75!important;color:#20342a!important}.sev4-root.sem2-overview .sev4-indicator-title small{display:none!important}.sev4-root.sem2-overview .sev4-score{display:flex!important;align-items:baseline!important;gap:5px!important;order:2!important;padding:7px 9px!important;border-radius:12px!important;background:#f0f8f3!important;text-align:right!important}.sev4-root.sem2-overview .sev4-score strong{font-size:18px!important;color:#08743f!important}.sev4-root.sem2-overview .sev4-score small{font-size:7.2px!important;color:#728279!important}.sev4-root.sem2-overview .sev4-indicator-head>span:nth-child(2){order:3!important;display:block!important;margin-top:auto!important}.sev4-root.sem2-overview .sev4-indicator-head>span:nth-child(2)>small{display:block!important;margin-top:5px!important;font-size:7.5px!important;color:#859189!important}.sev4-root.sem2-overview .sev4-progress{height:6px!important;border-radius:999px!important}.sev4-root.sem2-overview .sev4-indicator-head:after{content:'‹';position:absolute;left:10px;top:11px;color:#8e9b94;font-size:18px;font-weight:950}.sev4-root.sem2-overview .sev4-final{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-top:13px!important;padding:14px!important;border-radius:18px!important}.sev4-root.sem2-overview .sev4-final .sev4-btn{width:100%!important;min-height:47px!important}
 .sev4-root.sem2-criterion .sev4-profile,.sev4-root.sem2-criterion .sev4-period-hub,.sev4-root.sem2-criterion .sev4-kpis,.sev4-root.sem2-criterion .sev4-scale,.sev4-root.sem2-criterion .sev4-final{display:none!important}.sev4-root.sem2-criterion .sev4-indicators{display:block!important}.sev4-root.sem2-criterion .sev4-indicator{display:none!important}.sev4-root.sem2-criterion .sev4-indicator.sem2-active{display:block!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}.sev4-root.sem2-criterion .sev4-indicator.sem2-active>.sev4-indicator-head{display:block!important;margin:0 0 10px!important;padding:13px!important;border:1px solid #dce9e2!important;border-radius:17px!important;background:#fff!important;cursor:default!important}.sev4-root.sem2-criterion .sev4-indicator-title b{display:inline-flex!important;margin:0 0 6px!important;padding:5px 8px!important;border-radius:999px!important;background:#eaf6ef!important;color:#08743f!important}.sev4-root.sem2-criterion .sev4-indicator-title strong{display:block!important;font-size:12px!important;line-height:1.8!important}.sev4-root.sem2-criterion .sev4-indicator-title small{display:none!important}.sev4-root.sem2-criterion .sev4-score{margin-top:8px!important;text-align:right!important}.sev4-root.sem2-criterion .sev4-score strong{font-size:19px!important}.sev4-root.sem2-criterion .sev4-indicator-body{display:block!important;padding:0!important;border:0!important}.sev4-root.sem2-criterion .sev4-criterion{display:block!important;margin:0 0 9px!important;padding:13px!important;border:1px solid #dce9e2!important;border-radius:17px!important;background:#fff!important}.sev4-root.sem2-criterion .sev4-criterion-title{display:block!important;margin-bottom:11px!important}.sev4-root.sem2-criterion .sev4-criterion-title strong{font-size:11px!important;line-height:1.9!important}.sev4-root.sem2-criterion .sev4-criterion-title small{font-size:8px!important;line-height:1.7!important}.sev4-root.sem2-criterion .sev4-score-options{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}.sev4-root.sem2-criterion .sev4-score-option span{min-height:54px!important;padding:5px 2px!important;border-radius:10px!important;font-size:6.8px!important;line-height:1.35!important}.sev4-root.sem2-criterion .sev4-score-option span b{font-size:14px!important}.sev4-root.sem2-criterion .sev4-note{min-height:44px!important;margin-top:7px!important;font-size:10px!important}.sev4-root.sem2-criterion .sev4-indicator-footer{position:sticky!important;bottom:calc(96px + env(safe-area-inset-bottom))!important;z-index:24!important;display:block!important;margin-top:11px!important;padding:10px!important;border:1px solid #d7e7df!important;border-radius:16px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 10px 28px rgba(21,65,45,.11)!important}.sev4-root.sem2-criterion .sev4-hint{display:none!important}.sev4-root.sem2-criterion .sev4-indicator-footer .sev4-btn{width:100%!important;min-height:48px!important}.sev4-root.sem2 .sev4-modal{padding:12px!important}.sev4-root.sem2 .sev4-dialog{max-height:calc(100dvh - 24px)!important;border-radius:20px!important}
}
@media(max-width:365px){.sev4-root.sem2-overview .sev4-indicators{gap:8px!important}.sev4-root.sem2-overview .sev4-indicator-head{min-height:132px!important;padding:12px 9px 10px!important}.sev4-root.sem2-overview .sev4-indicator-title strong{font-size:10px!important}.sev4-root.sem2-criterion .sev4-score-option span{font-size:6.2px!important}}
`;
  (document.head||document.documentElement).appendChild(style);
}

function ensureToolbar(r){
  if(mode==='directory'){ $$('.sem2-toolbar',r).forEach(node=>node.remove()); return; }
  const body=$('.sev4-layout main.sev4-panel .sev4-body',r);if(!body)return;
  let bar=$('.sem2-toolbar',body);
  if(!bar){bar=document.createElement('div');bar.className='sem2-toolbar';body.prepend(bar)}
  const title=mode==='criterion'?indicatorName():caregiverName();
  const sub=mode==='criterion'?`امتیازدهی معیارهای شاخص برای ${caregiverName()}`:'شاخص موردنظر را برای ارزیابی انتخاب کنید';
  const back=mode==='criterion'?'overview':'directory';
  const html=`<button type="button" class="sem2-back" data-sem2-back="${back}" aria-label="بازگشت">›</button><div class="sem2-copy"><strong>${title}</strong><small>${sub}</small></div>`;
  if(bar.innerHTML!==html)bar.innerHTML=html;
}
function apply(){
  raf=0;
  if(!active||!eligible())return;
  const r=root();if(!r)return;
  r.classList.remove('sem2-directory','sem2-overview','sem2-criterion');
  r.classList.add('sem2',`sem2-${mode}`);r.dataset.sem2Version=VERSION;r.dataset.sem2Mode=mode;
  $$('.sev4-indicator[data-sev4-indicator]',r).forEach(card=>{
    const chosen=mode==='criterion'&&String(card.dataset.sev4Indicator||'')===String(indicator||'');
    card.classList.toggle('sem2-active',chosen);if(chosen)card.classList.add('open');
  });
  ensureToolbar(r);
}
function schedule(){if(!raf)raf=requestAnimationFrame(apply)}
function rootWasReplaced(records){
  return records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element&&(node.matches?.('.sev4-root')||node.querySelector?.('.sev4-root'))));
}
function observe(){
  const content=$('#content');if(!content||observer)return;
  observer=new MutationObserver(records=>{
    if(active&&!root()){active=false;mode='directory';indicator='';return}
    if(active&&rootWasReplaced(records))schedule();
  });
  observer.observe(content,{childList:true,subtree:true});
}
function openDirectory(){
  if(!eligible())return;
  active=true;mode='directory';indicator='';schedule();requestAnimationFrame(()=>window.scrollTo?.({top:0,left:0,behavior:'auto'}));
}
function leave(){active=false;mode='directory';indicator=''}

function onModule(event){
  const key=String(event?.detail?.key||'');
  if(key==='staff.evaluations')openDirectory();else if(key)leave();
}
function onClick(event){
  if(!active||!eligible())return;
  const r=root();const target=event.target;if(!r||!(target instanceof Element))return;
  const back=target.closest('[data-sem2-back]');
  if(back){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(back.dataset.sem2Back==='overview'){mode='overview'}else{mode='directory';indicator=''}
    schedule();requestAnimationFrame(()=>window.scrollTo?.({top:0,left:0,behavior:'auto'}));return;
  }
  const caregiver=target.closest('[data-sev4-caregiver]');
  if(caregiver){mode='overview';indicator='';schedule();return}
  if(mode==='overview'){
    const card=target.closest('.sev4-indicator[data-sev4-indicator]');
    if(card){indicator=String(card.dataset.sev4Indicator||'');mode='criterion';schedule();requestAnimationFrame(()=>window.scrollTo?.({top:0,left:0,behavior:'auto'}))}
  }
}
function boot(){
  addStyles();observe();document.addEventListener('click',onClick,true);window.addEventListener('salamat-module-opened',onModule);
  window.addEventListener('pageshow',()=>{if(eligible()&&root()&&String($('#pageTitle')?.textContent||'').includes('ارزیابی'))openDirectory()});
  MEDIA.addEventListener?.('change',()=>{if(!MEDIA.matches)leave();else if(root()&&String($('#pageTitle')?.textContent||'').includes('ارزیابی'))openDirectory()});
  window.SalamatStaffEvaluationMobile={version:VERSION,openDirectory,get mode(){return mode},get activeIndicator(){return indicator}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
