(()=>{
'use strict';
if(window.__salamatCaregiverCrmLinkV2)return;
window.__salamatCaregiverCrmLinkV2=true;

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
    return url.protocol==='http:'&&url.hostname==='91.92.122.86'&&url.port==='9000'&&url.pathname==='/Salamat/main.aspx'&&url.hash==='#324188475'
      ? url.toString()
      : '';
  }catch{return ''}
}
async function copySearchValue(value){
  const text=String(value||'').trim();
  if(!text)return false;
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    try{
      const input=document.createElement('textarea');
      input.value=text;
      input.style.position='fixed';
      input.style.opacity='0';
      document.body.appendChild(input);
      input.select();
      const copied=document.execCommand('copy');
      input.remove();
      return copied;
    }catch{return false}
  }
}
function openCrm(url,searchValue){
  const popup=window.open(url,'_blank','noopener,noreferrer');
  if(!popup){
    try{window.toast?.('بازشدن CRM مسدود شد','اجازه بازشدن پنجره جدید را برای این سایت فعال کنید.')}catch{}
    return;
  }
  void copySearchValue(searchValue).then(copied=>{
    const fileNo=String(searchValue||'').trim();
    try{
      if(copied&&fileNo)window.toast?.('شماره پرونده کپی شد',`شماره پرونده ${fileNo} را در جست‌وجوی CRM جای‌گذاری کنید.`);
      else window.toast?.('صفحه مراقبین CRM باز شد','شماره پرونده را از بالای کارنامه در جست‌وجوی CRM وارد کنید.');
    }catch{}
  });
}
function button(url,searchValue,compact=false){
  const control=document.createElement('button');
  control.type='button';
  control.className=compact?'btn outline caregiver-crm-old compact':'btn outline caregiver-crm-old';
  control.innerHTML='<span aria-hidden="true">↗</span><span>پرونده قدیمی CRM 360</span>';
  control.title=`بازکردن بخش مراقبین CRM و جست‌وجوی شماره پرونده ${String(searchValue||'')}`;
  control.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    openCrm(url,searchValue);
  });
  return control;
}
function addStyles(){
  if($('#caregiverCrmLinkStyles'))return;
  const style=document.createElement('style');
  style.id='caregiverCrmLinkStyles';
  style.textContent=`
.caregiver-crm-old{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;border-color:#0a8650!important;color:#087847!important;background:#f2fbf6!important}.caregiver-crm-old:hover{background:#e5f7ed!important}.caregiver-crm-old span:first-child{font-size:15px}.caregiver-crm-old.compact{padding:9px 12px!important;font-size:10px!important}.caregiver-crm-search-hint{display:inline-flex;align-items:center;padding:7px 10px;border-radius:10px;background:#f3f7f5;color:#64766c;font-size:9px;font-weight:800}
`;
  document.head.appendChild(style);
}
function inject(){
  const caregiver=selectedCaregiver();
  const url=validCrmUrl(caregiver?.crmUrl);
  const searchValue=String(caregiver?.crmSearchValue||caregiver?.id||'').trim();
  const detailVisible=Boolean($('.p3-report'));
  if(!detailVisible||!url)return;

  const top=$('.p3-detail-tools');
  if(top&&!$('.caregiver-crm-old',top)){
    top.insertBefore(button(url,searchValue,true),top.firstChild);
    if(searchValue&&!$('.caregiver-crm-search-hint',top)){
      const hint=document.createElement('span');
      hint.className='caregiver-crm-search-hint';
      hint.textContent=`شماره جست‌وجو: ${searchValue}`;
      top.insertBefore(hint,top.children[1]||null);
    }
  }

  const footer=$('.p3-report footer');
  if(footer&&!$('.caregiver-crm-old',footer)){
    footer.insertBefore(button(url,searchValue),footer.firstChild);
  }
}
function boot(){
  addStyles();
  inject();
  new MutationObserver(()=>setTimeout(inject,20)).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
