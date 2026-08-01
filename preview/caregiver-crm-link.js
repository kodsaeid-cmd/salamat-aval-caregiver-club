(()=>{
'use strict';
if(window.__salamatCaregiverCrmLinkV1)return;
window.__salamatCaregiverCrmLinkV1=true;

const EVAL_KEY='salamatAvalEvaluationSystemV13';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const $=(selector,root=document)=>root.querySelector(selector);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};

function selectedCaregiver(){
  const state=read(EVAL_KEY,{caregivers:[]});
  const work=read(WORK_KEY,{ui:{}});
  const id=String(work?.ui?.caregiverId||'');
  const caregivers=Array.isArray(state?.caregivers)?state.caregivers:[];
  return caregivers.find(item=>String(item?.id||'')===id)||caregivers[0]||null;
}
function validCrmUrl(value){
  try{
    const url=new URL(String(value||''));
    return url.protocol==='http:'&&url.hostname==='91.92.122.86'&&url.port==='9000'&&url.pathname==='/Salamat/main.aspx'&&url.hash.length>1
      ? url.toString()
      : '';
  }catch{return ''}
}
function openCrm(url){
  const popup=window.open(url,'_blank','noopener,noreferrer');
  if(!popup){
    try{window.toast?.('بازشدن CRM مسدود شد','اجازه بازشدن پنجره جدید را برای این سایت فعال کنید.')}catch{}
  }
}
function button(url,compact=false){
  const control=document.createElement('button');
  control.type='button';
  control.className=compact?'btn outline caregiver-crm-old compact':'btn outline caregiver-crm-old';
  control.innerHTML='<span aria-hidden="true">↗</span><span>پرونده قدیمی CRM 360</span>';
  control.title='بازکردن پرونده قدیمی این مراقب در CRM 360';
  control.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openCrm(url)});
  return control;
}
function addStyles(){
  if($('#caregiverCrmLinkStyles'))return;
  const style=document.createElement('style');
  style.id='caregiverCrmLinkStyles';
  style.textContent=`
.caregiver-crm-old{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;border-color:#0a8650!important;color:#087847!important;background:#f2fbf6!important}.caregiver-crm-old:hover{background:#e5f7ed!important}.caregiver-crm-old span:first-child{font-size:15px}.caregiver-crm-old.compact{padding:9px 12px!important;font-size:10px!important}.caregiver-crm-note{font-size:9px;color:#74837b;margin-inline-start:8px}
`;
  document.head.appendChild(style);
}
function inject(){
  const caregiver=selectedCaregiver();
  const url=validCrmUrl(caregiver?.crmUrl);
  const detailVisible=Boolean($('.p3-report'));
  if(!detailVisible)return;

  const top=$('.p3-detail-tools');
  if(top&&!$('.caregiver-crm-old',top)){
    if(url)top.insertBefore(button(url,true),top.firstChild);
    else{
      const disabled=document.createElement('button');
      disabled.type='button';
      disabled.className='btn outline caregiver-crm-old compact';
      disabled.disabled=true;
      disabled.textContent='پرونده قدیمی ثبت نشده';
      top.insertBefore(disabled,top.firstChild);
    }
  }

  const footer=$('.p3-report footer');
  if(footer&&!$('.caregiver-crm-old',footer)){
    if(url)footer.insertBefore(button(url),footer.firstChild);
  }
}
function boot(){
  addStyles();
  inject();
  new MutationObserver(()=>setTimeout(inject,20)).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
