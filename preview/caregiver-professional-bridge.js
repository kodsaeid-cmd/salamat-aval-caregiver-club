(()=>{
'use strict';
if(window.__salamatCaregiverProfessionalBridgeV1)return;
window.__salamatCaregiverProfessionalBridgeV1=true;

const KEYS={
 auth:'salamatAvalAccessControlV1',
 evaluation:'salamatAvalEvaluationSystemV13',
 admin:'salamatAvalAdminWorkspaceV15',
 caregiverPanel:'salamatAvalCaregiverPanelV1',
 evaluationV1:'salamatAvalEvaluationV1',
 evaluationUi:'salamatAvalEvaluationUIV13',
};
const safeParse=(value,fallback)=>{try{return JSON.parse(value)||fallback}catch{return fallback}};
async function api(path,options={}){
 if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
 const response=await fetch(path,{credentials:'same-origin',...options});
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
  name:item.fullName,
  fullName:item.fullName,
  phone:item.mobile||'',
  mobile:item.mobile||'',
  nationalId:item.nationalId||'',
  serviceGroup:item.primaryType||'مراقبت سالمند',
  fileStatus:item.fileStatus||'در انتظار بررسی',
  createdAt:item.createdAt||new Date().toISOString(),
  rank:{code:'',title:item.professionalLevel||'در انتظار ارزیابی',stars:0,pri:item.professionalScore??null,decisionRef:'',validFrom:'',validTo:''},
  license:{number:'',status:item.licenseStatus||'ثبت نشده',issuedAt:'',expiresAt:'',decisionRef:''},
  profile:{city:item.city||'',birthDate:item.birthDate||'',address:item.address||'',skills:'',bio:item.workHistory||'',photo:item.avatarUrl||''},
 };
 return {auth:{...auth,users:[]},evaluation:{...evaluation,caregivers:[caregiver]},admin,caregiverPanel,evaluationV1};
}
function selectCaregiver(item){
 const code=String(item.membershipCode||item.id);
 const work=safeParse(localStorage.getItem(KEYS.admin),{});work.ui||={};work.ui.caregiverId=code;localStorage.setItem(KEYS.admin,JSON.stringify(work));
 const ui=safeParse(localStorage.getItem(KEYS.evaluationUi),{});ui.caregiverId=code;localStorage.setItem(KEYS.evaluationUi,JSON.stringify(ui));
 return code;
}
async function openProfessional(id){
 const item=(await api(`/api/admin/caregiver-record?id=${encodeURIComponent(id)}`)).data;
 if(!item)return;
 const state=caregiverState(item);
 window.SalamatBackend?.applyState?.({data:{state}});
 const code=selectCaregiver(item);
 const backend=window.SalamatBackend;
 const originalGet=backend?.getCurrentUser;
 try{
  if(backend&&typeof originalGet==='function')backend.getCurrentUser=()=>({...originalGet.call(backend),role:'HR'});
  window.renderModule?.(window.roles?.admin,['activity','پرونده حرفه‌ای مراقبین']);
 }finally{
  if(backend&&typeof originalGet==='function')backend.getCurrentUser=originalGet;
 }
 setTimeout(()=>{
  try{
   const escaped=window.CSS?.escape?CSS.escape(code):code.replace(/"/g,'\\"');
   document.querySelector(`[data-professional-caregiver="${escaped}"]`)?.click();
  }catch{}
 },120);
}
function capture(event){
 const row=event.target?.closest?.('.cdp-row[data-cdp-id]');
 if(!row)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 row.disabled=true;
 void openProfessional(row.dataset.cdpId).catch(error=>{try{window.toast?.('بازکردن پرونده انجام نشد',error.message||String(error))}catch{alert(error.message||String(error))}}).finally(()=>{row.disabled=false});
}
window.addEventListener('click',capture,true);
})();
