(()=>{
'use strict';
if(window.__salamatCaregiverProfessionalBridgeV6)return;
window.__salamatCaregiverProfessionalBridgeV6=true;

const VERSION='6.1.1';
const KEYS={
 auth:'salamatAvalAccessControlV1',
 evaluation:'salamatAvalEvaluationSystemV13',
 admin:'salamatAvalAdminWorkspaceV15',
 caregiverPanel:'salamatAvalCaregiverPanelV1',
 evaluationV1:'salamatAvalEvaluationV1',
 evaluationUi:'salamatAvalEvaluationUIV13',
};
const safeParse=(value,fallback)=>{try{return JSON.parse(value)||fallback}catch{return fallback}};
const normalized=(value,fallback)=>{const text=String(value||'').trim();if(!text||text==='ذکر نشده')return fallback;if(text==='NEW')return 'ارزیابی نشده';return text};
let openingPromise=null;
let openingId='';

async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);
 return payload;
}
function caregiverState(item){
 const auth=safeParse(localStorage.getItem(KEYS.auth),{users:[],audit:[]});
 const evaluation=safeParse(localStorage.getItem(KEYS.evaluation),{});
 const admin=safeParse(localStorage.getItem(KEYS.admin),{});
 const caregiverPanel=safeParse(localStorage.getItem(KEYS.caregiverPanel),{});
 const evaluationV1=safeParse(localStorage.getItem(KEYS.evaluationV1),{});
 const code=String(item.membershipCode||item.id);
 const caregiver={
  id:code,
  backendId:item.id,
  crmRecordId:item.crmRecordId||'',
  crmUrl:item.crmUrl||'',
  crmSearchValue:item.crmSearchValue||code,
  name:item.fullName,
  fullName:item.fullName,
  phone:item.mobile||'',
  mobile:item.mobile||'',
  nationalId:item.nationalId||'',
  serviceGroup:normalized(item.primaryType,'ثبت نشده'),
  fileStatus:normalized(item.fileStatus,'ثبت نشده'),
  createdAt:item.createdAt||new Date().toISOString(),
  rank:{code:'',title:normalized(item.professionalLevel,'ارزیابی نشده'),stars:0,pri:item.professionalScore??null,decisionRef:'',validFrom:'',validTo:''},
  license:{number:'',status:normalized(item.licenseStatus,'ثبت نشده'),issuedAt:'',expiresAt:'',decisionRef:''},
  profile:{city:item.city||'',birthDate:item.birthDate||'',address:item.address||'',skills:item.skills||'',bio:item.workHistory||'',photo:item.avatarUrl||''},
 };
 return {auth:{...auth,users:[]},evaluation:{...evaluation,caregivers:[caregiver]},admin,caregiverPanel,evaluationV1};
}
function selectCaregiver(item){
 const code=String(item.membershipCode||item.id);
 const work=safeParse(localStorage.getItem(KEYS.admin),{});work.ui||={};work.ui.caregiverId=code;localStorage.setItem(KEYS.admin,JSON.stringify(work));
 const ui=safeParse(localStorage.getItem(KEYS.evaluationUi),{});ui.caregiverId=code;localStorage.setItem(KEYS.evaluationUi,JSON.stringify(ui));
 return code;
}
function bypassNewCaregiverRenderer(renderer){
 let cursor=renderer;
 const visited=new Set();
 while(typeof cursor==='function'&&!visited.has(cursor)){
  visited.add(cursor);
  if(cursor.__salamatStaffCaregiverControllerV2&&typeof cursor.__base==='function')return cursor.__base;
  cursor=cursor.__base;
 }
 return renderer;
}
function setRenderer(renderer){
 window.renderModule=renderer;
 try{renderModule=renderer}catch{}
}
function professionalRow(code){
 return [...document.querySelectorAll('[data-professional-caregiver]')]
  .find(node=>String(node.dataset.professionalCaregiver||'')===String(code))||null;
}
async function activateScorecard(code){
 const delays=[0,60,120,220,380,620,900];
 for(const delay of delays){
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  if(document.querySelector('.p3-report'))return true;
  professionalRow(code)?.click();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  if(document.querySelector('.p3-report'))return true;
 }
 return Boolean(document.querySelector('.p3-report'));
}
async function performOpen(id){
 window.__salamatOpeningProfessionalDetail=true;
 document.documentElement.dataset.caregiverScorecardOpening=String(id);
 try{
  const item=(await api(`/api/admin/caregiver-record?id=${encodeURIComponent(id)}&_ts=${Date.now()}`)).data;
  if(!item)throw new Error('پرونده مراقب از سرور دریافت نشد.');
  const state=caregiverState(item);
  window.SalamatBackend?.applyState?.({data:{state}});
  const code=selectCaregiver(item);
  const backend=window.SalamatBackend;
  const originalGet=backend?.getCurrentUser;
  const activeRenderer=window.renderModule;
  const professionalRenderer=bypassNewCaregiverRenderer(activeRenderer);
  try{
   if(backend&&typeof originalGet==='function')backend.getCurrentUser=()=>({...originalGet.call(backend),role:'HR'});
   setRenderer(professionalRenderer);
   professionalRenderer?.(window.roles?.admin,['activity','پرونده حرفه‌ای مراقبین']);
  }finally{
   setRenderer(activeRenderer);
   if(backend&&typeof originalGet==='function')backend.getCurrentUser=originalGet;
  }
  const opened=await activateScorecard(code);
  if(!opened)throw new Error('کارنامه مراقب آماده نشد.');
  const report=document.querySelector('.p3-report');
  report?.setAttribute('data-caregiver-id',String(item.id));
  report?.setAttribute('data-record-id',String(item.id));
  window.dispatchEvent(new CustomEvent('salamat-caregiver-scorecard-opened',{detail:{caregiverId:item.id,membershipCode:code,version:VERSION,server:true}}));
  return true;
 }finally{
  delete document.documentElement.dataset.caregiverScorecardOpening;
  window.__salamatOpeningProfessionalDetail=false;
 }
}
function openProfessional(id){
 id=String(id||'').trim();if(!id)return Promise.resolve(false);
 if(openingPromise&&openingId===id)return openingPromise;
 openingId=id;
 openingPromise=performOpen(id).finally(()=>{openingPromise=null;openingId=''});
 return openingPromise;
}
function capture(event){
 const row=event.target?.closest?.('.cdp-row[data-cdp-id]');
 if(!row)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 if(row.dataset.professionalOpening==='true')return;
 row.dataset.professionalOpening='true';row.disabled=true;row.setAttribute('aria-busy','true');
 void openProfessional(row.dataset.cdpId).catch(error=>{try{window.toast?.('بازکردن کارنامه انجام نشد',error.message||String(error))}catch{alert(error.message||String(error))}}).finally(()=>{delete row.dataset.professionalOpening;row.disabled=false;row.removeAttribute('aria-busy')});
}
function refreshOpenRecord(event){
 const id=String(event?.detail?.caregiverId||'').trim();
 if(!id||!document.querySelector('.p3-report'))return;
 void openProfessional(id).catch(()=>{});
}
window.addEventListener('click',capture,true);
window.addEventListener('salamat-caregiver-profile-updated',refreshOpenRecord);
window.SalamatCaregiverProfessionalBridge={version:VERSION,open:openProfessional,get opening(){return Boolean(openingPromise)},get caregiverId(){return openingId}};
})();