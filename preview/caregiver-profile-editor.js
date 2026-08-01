(()=>{
'use strict';
if(window.__salamatCaregiverProfileEditorV1)return;
window.__salamatCaregiverProfileEditorV1=true;

const EVAL_KEY='salamatAvalEvaluationSystemV13';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();
  let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.detail=payload.detail;throw error}
  return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
function close(){$('.cpe-backdrop')?.remove()}
function value(item,key){return esc(item?.[key]??'')}
function checked(item,key){return item?.[key]?'checked':''}
function option(current,key,label){return `<option value="${esc(key)}" ${String(current||'').toUpperCase()===key?'selected':''}>${esc(label)}</option>`}
function selectedProfessionalCaregiver(){
  const state=read(EVAL_KEY,{caregivers:[]});
  const work=read(WORK_KEY,{ui:{}});
  const id=String(work?.ui?.caregiverId||'');
  const caregivers=Array.isArray(state?.caregivers)?state.caregivers:[];
  return caregivers.find(item=>String(item?.id||'')===id)||caregivers[0]||null;
}
function addStyles(){
  if($('#caregiverProfileEditorStyles'))return;
  const style=document.createElement('style');
  style.id='caregiverProfileEditorStyles';
  style.textContent=`
.cpe-backdrop{position:fixed;inset:0;z-index:18000;background:rgba(8,30,20,.56);display:grid;place-items:center;padding:18px;direction:rtl}.cpe-modal{width:min(1120px,100%);max-height:94vh;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#fff;border-radius:26px;box-shadow:0 30px 90px rgba(0,0,0,.28)}.cpe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:20px 22px;border-bottom:1px solid #e5eee9}.cpe-head h3{margin:0;font-size:19px}.cpe-head p{margin:7px 0 0;color:#718078;font-size:10px}.cpe-close{border:0;width:36px;height:36px;border-radius:11px;background:#eef3f0;font:inherit;font-size:18px;cursor:pointer}.cpe-body{overflow:auto;padding:18px 22px;background:#fbfdfc}.cpe-loading,.cpe-error{padding:50px;text-align:center;border:1px dashed #d4e3db;border-radius:18px;background:#fff;color:#61746a}.cpe-section{margin-bottom:14px;padding:16px;border:1px solid #dce8e2;border-radius:18px;background:#fff}.cpe-section h4{margin:0 0 13px;font-size:13px;color:#153c29}.cpe-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.cpe-field{display:grid;align-content:start;gap:6px;font-size:9px;font-weight:900;color:#41564a}.cpe-field input,.cpe-field select,.cpe-field textarea{width:100%;box-sizing:border-box;border:1px solid #d8e5de;border-radius:11px;padding:10px 11px;background:#fff;font:inherit;outline:none}.cpe-field textarea{min-height:74px;resize:vertical}.cpe-field input:focus,.cpe-field select:focus,.cpe-field textarea:focus{border-color:#129158;box-shadow:0 0 0 3px #e3f5eb}.cpe-field.wide{grid-column:1/-1}.cpe-field.double{grid-column:span 2}.cpe-check{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #dce8e2;border-radius:11px;background:#f7fbf9;font-size:9px;font-weight:900;color:#40564a}.cpe-check input{width:auto}.cpe-note{margin-top:10px;padding:10px 12px;border-radius:11px;background:#fff7df;color:#775c10;font-size:9px;line-height:1.9}.cpe-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 22px;border-top:1px solid #e5eee9;background:#fff}.cpe-actions div{display:flex;gap:8px}.cpe-btn{border:0;border-radius:11px;padding:11px 16px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.cpe-btn.primary{background:#078848;color:#fff}.cpe-btn.soft{background:#edf3f0;color:#43584d}.cpe-btn:disabled{opacity:.55;cursor:wait}.cpe-edit-launch{display:inline-flex!important;align-items:center;gap:7px}.cpe-account-edit-note{display:inline-flex;padding:5px 8px;border-radius:8px;background:#eef7f2;color:#087847;font-size:8px;font-weight:900}@media(max-width:900px){.cpe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cpe-field.double{grid-column:1/-1}}@media(max-width:620px){.cpe-backdrop{padding:0}.cpe-modal{height:100%;max-height:none;border-radius:0}.cpe-grid{grid-template-columns:1fr}.cpe-field.wide,.cpe-field.double{grid-column:auto}.cpe-actions{align-items:stretch;flex-direction:column}.cpe-actions div{width:100%}.cpe-btn{flex:1}}
`;
  document.head.appendChild(style);
}
function formMarkup(item){
  const shifts=Array.isArray(item.acceptedShifts)?item.acceptedShifts.join('، '):(item.shiftServices||'');
  return `<form id="cpeForm">
    <input type="hidden" name="caregiverId" value="${value(item,'id')}">
    <section class="cpe-section"><h4>اتصال CRM و حساب ورود</h4><div class="cpe-grid">
      <label class="cpe-field">شناسه رکورد CRM<input name="crmRecordId" value="${value(item,'crmRecordId')}" required></label>
      <label class="cpe-field">شماره پرونده CRM<input name="membershipCode" inputmode="numeric" value="${value(item,'membershipCode')}" required></label>
      <label class="cpe-field">نام کاربری<input name="username" value="${value(item,'username')}"></label>
      <label class="cpe-field">وضعیت حساب<select name="accountStatus">${option(item.accountStatus,'ACTIVE','فعال')}${option(item.accountStatus,'PENDING','در انتظار تأیید')}${option(item.accountStatus,'SUSPENDED','تعلیق‌شده')}${option(item.accountStatus,'INACTIVE','غیرفعال')}</select></label>
      <label class="cpe-field">رمز عبور جدید<input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="بدون تغییر باقی بماند"></label>
      <label class="cpe-field">آخرین ورود<input value="${value(item,'lastLoginAt')}" disabled></label>
    </div></section>
    <section class="cpe-section"><h4>اطلاعات هویتی و تماس</h4><div class="cpe-grid">
      <label class="cpe-field">نام<input name="firstName" value="${value(item,'firstName')}"></label>
      <label class="cpe-field">نام خانوادگی<input name="lastName" value="${value(item,'lastName')}"></label>
      <label class="cpe-field">نام کامل<input name="fullName" value="${value(item,'fullName')}" required></label>
      <label class="cpe-field">نام پدر<input name="fatherName" value="${value(item,'fatherName')}"></label>
      <label class="cpe-field">کد ملی<input name="nationalId" inputmode="numeric" maxlength="10" value="${value(item,'nationalId')}"></label>
      <label class="cpe-field">جنسیت<input name="gender" value="${value(item,'gender')}"></label>
      <label class="cpe-field">گروه سنی<input name="ageGroup" value="${value(item,'ageGroup')}"></label>
      <label class="cpe-field">سن<input name="age" type="number" min="0" max="150" value="${value(item,'age')}"></label>
      <label class="cpe-field">تاریخ تولد<input name="birthDate" value="${value(item,'birthDate')}"></label>
      <label class="cpe-field">شماره همراه پاک‌سازی‌شده<input name="mobile" inputmode="tel" value="${value(item,'mobile')}"></label>
      <label class="cpe-field">مقدار خام ستون پنل<input name="panelMobileRaw" value="${value(item,'panelMobileRaw')}"></label>
      <label class="cpe-field">مقدار خام تلفن همراه<input name="mobileRaw" value="${value(item,'mobileRaw')}"></label>
      <label class="cpe-field">تلفن ثابت<input name="landline" value="${value(item,'landline')}"></label>
      <label class="cpe-field">لهجه<input name="dialect" value="${value(item,'dialect')}"></label>
    </div></section>
    <section class="cpe-section"><h4>وضعیت پرونده، تخصص و فعالیت</h4><div class="cpe-grid">
      <label class="cpe-field">وضعیت پرونده<input name="fileStatus" value="${value(item,'fileStatus')}"></label>
      <label class="cpe-field">تکمیل مدارک<input name="documentsCompleted" value="${value(item,'documentsCompleted')}"></label>
      <label class="cpe-field">تحویل مدارک<input name="documentsDelivered" value="${value(item,'documentsDelivered')}"></label>
      <label class="cpe-field">تخصص مراقب<input name="specialty" value="${value(item,'specialty')}"></label>
      <label class="cpe-field">محدوده منزل<input name="homeRegion" value="${value(item,'homeRegion')}"></label>
      <label class="cpe-field">محدوده فعالیت<input name="activityRegion" value="${value(item,'activityRegion')}"></label>
      <label class="cpe-field double">شیفت‌ها و خدمات پذیرفته‌شده<input name="shiftServices" value="${esc(shifts)}"></label>
      <label class="cpe-field">کمک مادر<input name="motherAssistant" value="${value(item,'motherAssistant')}"></label>
      <label class="cpe-field">مشغول به کار<input name="employed" value="${value(item,'employed')}"></label>
      <label class="cpe-check"><input type="checkbox" name="blacklisted" ${checked(item,'blacklisted')}>قرارگرفتن در لیست سیاه</label>
      <label class="cpe-check"><input type="checkbox" name="active" ${checked(item,'active')}>پرونده فعال</label>
      <label class="cpe-check"><input type="checkbox" name="profileCompleted" ${checked(item,'profileCompleted')}>پروفایل تکمیل‌شده</label>
      <label class="cpe-field wide">سوابق و توضیحات<textarea name="workHistory">${value(item,'workHistory')}</textarea></label>
    </div></section>
    <section class="cpe-section"><h4>اطلاعات عملیاتی استخراج‌شده از CRM</h4><div class="cpe-grid">
      <label class="cpe-field">علت بازگشت<input name="returnReason" value="${value(item,'returnReason')}"></label>
      <label class="cpe-field">تاریخ بازگشت<input name="returnDateRaw" value="${value(item,'returnDateRaw')}"></label>
      <label class="cpe-field">نحوه آشنایی<input name="acquaintanceSource" value="${value(item,'acquaintanceSource')}"></label>
      <label class="cpe-field">نتیجه بازیابی<input name="recoveryResult" value="${value(item,'recoveryResult')}"></label>
      <label class="cpe-field">مالک پرونده در CRM<input name="crmOwner" value="${value(item,'crmOwner')}"></label>
      <label class="cpe-field">تاریخ ویرایش منبع<input name="sourceModifiedAtRaw" value="${value(item,'sourceModifiedAtRaw')}"></label>
      <label class="cpe-field">تاریخ ایجاد منبع<input name="sourceCreatedAtRaw" value="${value(item,'sourceCreatedAtRaw')}"></label>
      <label class="cpe-field">تاریخ به‌روزرسانی مدارک<input name="documentsUpdatedAtRaw" value="${value(item,'documentsUpdatedAtRaw')}"></label>
      <label class="cpe-field">تاریخ تکمیل مدارک<input name="documentsCompletedAtRaw" value="${value(item,'documentsCompletedAtRaw')}"></label>
      <label class="cpe-field wide">Checksum منبع<input name="sourceChecksum" value="${value(item,'sourceChecksum')}" readonly></label>
    </div><div class="cpe-note">این ویرایش مستقیماً در دیتابیس باشگاه ثبت می‌شود. در همگام‌سازی یا واردسازی بعدی CRM، فیلدهای متعلق به CRM ممکن است دوباره به‌روزرسانی شوند.</div></section>
  </form>`;
}
async function open(caregiverId){
  const id=String(caregiverId||'').trim();
  if(!id){notify('ویرایش پرونده','شناسه مراقب پیدا نشد.');return}
  close();
  const wrap=document.createElement('div');
  wrap.className='cpe-backdrop';
  wrap.innerHTML=`<section class="cpe-modal"><header class="cpe-head"><div><h3>ویرایش کامل پرونده مراقب</h3><p>تمام اطلاعات واردشده از CRM 360 و مشخصات حساب ورود</p></div><button class="cpe-close" type="button">×</button></header><div class="cpe-body"><div class="cpe-loading">در حال دریافت اطلاعات کامل پرونده...</div></div><footer class="cpe-actions"><span></span><div><button class="cpe-btn soft" type="button" data-cpe-close>انصراف</button><button class="cpe-btn primary" type="button" id="cpeSave" disabled>ذخیره تغییرات</button></div></footer></section>`;
  document.body.appendChild(wrap);
  $('.cpe-close',wrap).onclick=close;
  $('[data-cpe-close]',wrap).onclick=close;
  wrap.addEventListener('click',event=>{if(event.target===wrap)close()});
  try{
    const item=(await api(`/api/admin/caregiver-profile?id=${encodeURIComponent(id)}`)).data;
    $('.cpe-head h3',wrap).textContent=`ویرایش پرونده ${item.fullName||''}`;
    $('.cpe-head p',wrap).textContent=`شماره پرونده ${item.membershipCode||'—'} • اطلاعات CRM و حساب ورود`;
    $('.cpe-body',wrap).innerHTML=formMarkup(item);
    const save=$('#cpeSave',wrap);save.disabled=false;save.onclick=()=>saveForm(wrap);
  }catch(error){
    $('.cpe-body',wrap).innerHTML=`<div class="cpe-error">${esc(error.message||error)}</div>`;
  }
}
async function saveForm(root){
  const form=$('#cpeForm',root);if(!form||!form.reportValidity())return;
  const save=$('#cpeSave',root);save.disabled=true;save.textContent='در حال ذخیره...';
  const data=Object.fromEntries(new FormData(form).entries());
  for(const name of ['blacklisted','active','profileCompleted'])data[name]=Boolean(form.elements[name]?.checked);
  data.acceptedShifts=String(data.shiftServices||'').split(/[,،]/).map(item=>item.trim()).filter(Boolean);
  try{
    await api('/api/admin/caregiver-profile',{method:'PATCH',body:JSON.stringify(data)});
    const caregiverId=String(data.caregiverId||'');
    close();
    window.dispatchEvent(new CustomEvent('salamat-caregiver-profile-updated',{detail:{caregiverId}}));
    window.dispatchEvent(new CustomEvent('salamat-server-directory-refresh',{detail:{caregiverId}}));
    notify('پرونده به‌روزرسانی شد','تمام تغییرات در دیتابیس باشگاه ذخیره شد.');
  }catch(error){
    notify('ذخیره انجام نشد',error.message||String(error));
    save.disabled=false;save.textContent='ذخیره تغییرات';
  }
}
function injectProfessionalButton(){
  const caregiver=selectedProfessionalCaregiver();
  const id=String(caregiver?.backendId||'').trim();
  if(!id||!$('.p3-report'))return;
  const top=$('.p3-detail-tools');
  if(top&&!$('.cpe-edit-launch',top)){
    const button=document.createElement('button');
    button.type='button';button.className='btn primary cpe-edit-launch';button.textContent='ویرایش اطلاعات پرونده';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(id)});
    top.appendChild(button);
  }
  const footer=$('.p3-report footer');
  if(footer&&!$('.cpe-edit-launch',footer)){
    const button=document.createElement('button');
    button.type='button';button.className='btn primary cpe-edit-launch';button.textContent='ویرایش کامل اطلاعات';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(id)});
    footer.insertBefore(button,footer.firstChild);
  }
}
function captureAccountClick(event){
  const row=event.target?.closest?.('.adp-row[data-caregiver-id]');
  const id=String(row?.dataset?.caregiverId||'').trim();
  if(!row||!id)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  open(id);
}
function boot(){
  addStyles();
  window.SalamatCaregiverProfileEditor={open};
  document.addEventListener('click',captureAccountClick,true);
  new MutationObserver(()=>setTimeout(injectProfessionalButton,20)).observe(document.body,{childList:true,subtree:true});
  injectProfessionalButton();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
