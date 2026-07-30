(()=>{
'use strict';

const SESSION_KEY='salamatAvalSessionV1';
const HIDDEN_MODULES=new Set(['رتبه و پروانه','درجه و رتبه']);
const SCORECARD_LABELS=['کارنامه حرفه‌ای','کارنامه کاری'];
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let guardsInstalled=false;
let printInProgress=false;

function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'{}')}catch{return {}}}
function currentRole(){try{return selectedRole||readSession().role||''}catch{return readSession().role||''}}
function isCaregiver(roleModel){try{return roleModel===window.roles?.caregiver||currentRole()==='caregiver'}catch{return currentRole()==='caregiver'}}
function normalizeLabel(value){return String(value||'').replace(/\s+/g,' ').trim()}
function isHiddenLabel(value){return HIDDEN_MODULES.has(normalizeLabel(value))}

function reindexCaregiverNavigation(){
 if(currentRole()!=='caregiver')return;
 $$('#sidebarNav .nav-item').forEach((button,index)=>{button.dataset.index=String(index)});
}

function stripCaregiverRankLicenseModule(){
 try{
  if(window.roles?.caregiver?.nav)window.roles.caregiver.nav=window.roles.caregiver.nav.filter(item=>!isHiddenLabel(item?.[1]));
 }catch{}
 $$('#sidebarNav .nav-item').forEach(button=>{if(isHiddenLabel(button.textContent))button.remove()});
 reindexCaregiverNavigation();
}

function openCaregiverScorecard(){
 const visible=$$('#sidebarNav .nav-item').find(button=>SCORECARD_LABELS.some(label=>normalizeLabel(button.textContent).includes(label)));
 if(visible){visible.click();return}
 try{window.renderModule?.(window.roles?.caregiver,['chart','کارنامه حرفه‌ای'])}catch{}
}

function installNavigationGuards(){
 if(guardsInstalled)return true;
 let ready=false;try{ready=typeof window.renderNav==='function'&&typeof window.renderModule==='function'&&window.roles?.caregiver}catch{}
 if(!ready)return false;
 guardsInstalled=true;
 stripCaregiverRankLicenseModule();
 const previousRenderNav=window.renderNav;
 window.renderNav=function(roleModel){
  if(isCaregiver(roleModel))stripCaregiverRankLicenseModule();
  const result=previousRenderNav.apply(this,arguments);
  if(isCaregiver(roleModel))stripCaregiverRankLicenseModule();
  return result;
 };
 const previousRenderModule=window.renderModule;
 window.renderModule=function(roleModel,module){
  if(isCaregiver(roleModel)&&isHiddenLabel(module?.[1])){
   setTimeout(openCaregiverScorecard,0);
   return;
  }
  const result=previousRenderModule.apply(this,arguments);
  setTimeout(enhanceCaregiverScorecard,0);
  return result;
 };
 return true;
}

function reportOwnerName(report){
 return normalizeLabel(report.querySelector('.p3-profile dd')?.textContent||readSession().name||'مراقب');
}

function restorePrintState(report,titleNode,subtitleNode,previous){
 document.body.classList.remove('printing-caregiver-license');
 report.classList.remove('caregiver-license-print-target');
 if(titleNode)titleNode.textContent=previous.heading;
 if(subtitleNode)subtitleNode.textContent=previous.subtitle;
 document.title=previous.documentTitle;
 printInProgress=false;
 const button=$('#downloadCaregiverLicense');if(button){button.disabled=false;button.textContent='دانلود پروانه'}
}

async function downloadCaregiverLicense(){
 if(printInProgress)return;
 const report=$('.p3-report');if(!report)return;
 printInProgress=true;
 const button=$('#downloadCaregiverLicense');if(button){button.disabled=true;button.textContent='در حال آماده‌سازی…'}
 const titleNode=$('.p3-report>header h2',report),subtitleNode=$('.p3-report>header p',report);
 const previous={heading:titleNode?.textContent||'',subtitle:subtitleNode?.textContent||'',documentTitle:document.title};
 if(titleNode)titleNode.textContent='پروانه فنی مراقب';
 if(subtitleNode)subtitleNode.textContent='کارنامه رسمی شایستگی و عملکرد حرفه‌ای مراقب سلامت اول';
 document.title=`پروانه فنی مراقب - ${reportOwnerName(report)}`;
 document.body.classList.add('printing-caregiver-license');
 report.classList.add('caregiver-license-print-target');
 const restore=()=>restorePrintState(report,titleNode,subtitleNode,previous);
 window.addEventListener('afterprint',restore,{once:true});
 try{await document.fonts?.ready}catch{}
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
 setTimeout(()=>{if(printInProgress&&!window.matchMedia?.('print')?.matches)restore()},60000);
}

function enhanceCaregiverScorecard(){
 stripCaregiverRankLicenseModule();
 if(currentRole()!=='caregiver')return;
 const title=normalizeLabel($('#pageTitle')?.textContent);
 const report=$('.p3-report');
 if(!report||!SCORECARD_LABELS.some(label=>title.includes(label)))return;
 if($('#caregiverLicenseToolbar'))return;
 const toolbar=document.createElement('section');
 toolbar.id='caregiverLicenseToolbar';
 toolbar.className='caregiver-license-toolbar';
 toolbar.innerHTML='<div><strong>پروانه فنی مراقب</strong><small>خروجی رسمی A4 از همین کارنامه؛ در پنجره چاپ گزینه «ذخیره به‌صورت PDF» را انتخاب کنید.</small></div><button type="button" id="downloadCaregiverLicense">دانلود پروانه</button>';
 report.before(toolbar);
 $('#downloadCaregiverLicense')?.addEventListener('click',downloadCaregiverLicense);
}

function boot(){
 stripCaregiverRankLicenseModule();
 let attempts=0;const timer=setInterval(()=>{attempts+=1;if(installNavigationGuards()||attempts>200)clearInterval(timer)},50);
 const nav=$('#sidebarNav'),content=$('#content');
 if(nav)new MutationObserver(stripCaregiverRankLicenseModule).observe(nav,{childList:true,subtree:true});
 if(content){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceCaregiverScorecard()})}).observe(content,{childList:true,subtree:true})}
 window.addEventListener('salamat-identity-changed',()=>setTimeout(()=>{stripCaregiverRankLicenseModule();enhanceCaregiverScorecard()},20));
 setTimeout(enhanceCaregiverScorecard,0);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
