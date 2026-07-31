(()=>{
'use strict';

if(window.__salamatServerDirectoryRuntimeV2)return;
window.__salamatServerDirectoryRuntimeV2=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value||'').trim().toLowerCase();
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const roleFa={ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
const statusFa={ACTIVE:'فعال',APPROVED:'فعال',PENDING:'در انتظار تأیید',INACTIVE:'غیرفعال',SUSPENDED:'تعلیق‌شده'};
const permissionOptions=[
 ['USER_MANAGEMENT','مدیریت کاربران'],['CAREGIVER_MANAGEMENT','مدیریت مراقبین'],['CONTRACT_MANAGEMENT','مدیریت قراردادها'],
 ['PAYROLL_MANAGEMENT','حقوق و پرداخت'],['TRAINING_MANAGEMENT','بانک آموزش'],['EVALUATION_MANAGEMENT','ارزیابی و پروانه'],
 ['SUPPORT_MANAGEMENT','پشتیبانی و امنیت'],['REPORTS','گزارش‌ها'],['SETTINGS','تنظیمات سامانه'],
];
let cache=null;
let selectedUserKey='';
let moduleRouterBase=null;
let bypassRoute=false;
let showCreateCaregiver=false;

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||null}
function isAdmin(){return String(currentUser()?.role||'').toUpperCase()==='ADMIN'}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
function errorText(error){return [error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:'',error?.detail?String(error.detail).slice(0,500):''].filter(Boolean).join(' — ')}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}
function invalidate(){cache=null}
async function directory(force=false){if(cache&&!force)return cache;const result=await api('/api/admin/directory');cache=result.data;return cache}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function avatar(item,size='md'){
  const cls=`sd-avatar sd-avatar-${size}`;
  return item?.avatarUrl?`<span class="${cls}"><img src="${esc(item.avatarUrl)}?v=${encodeURIComponent(item.avatarId||item.updatedAt||Date.now())}" alt="${esc(item.fullName||'پروفایل')}"></span>`:`<span class="${cls}">${esc(initials(item?.fullName))}</span>`;
}
function setPage(title,subtitle,html){
  const titleEl=$('#pageTitle'),subEl=$('#pageSubtitle'),content=$('#content');
  if(titleEl)titleEl.textContent=title;
  if(subEl)subEl.textContent=subtitle;
  if(content)content.innerHTML=`<section class="module-page sd2-root">${html}</section>`;
  try{window.hydrateIcons?.(content)}catch{}
}
function loading(title,subtitle){setPage(title,subtitle,'<div class="sd-loading">در حال دریافت اطلاعات...</div>')}
function statusClass(status){const key=String(status||'').toUpperCase();return key==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(key)?'danger':''}
function userByKey(data,key){
  if(key.startsWith('profile:')){const id=key.slice(8);const caregiver=data.caregivers.find(item=>item.id===id);return caregiver?{kind:'orphan',caregiver}:null}
  const account=data.accounts.find(item=>item.id===key);if(!account)return null;
  const caregiver=account.caregiverId?data.caregivers.find(item=>item.id===account.caregiverId):null;
  return {kind:'account',account,caregiver};
}
function accountSearchText(account,caregiver){return normalize([account.fullName,account.username,account.mobile,account.role,roleFa[account.role],statusFa[account.status],caregiver?.membershipCode,caregiver?.nationalId].join(' '))}
function caregiverSearchText(caregiver){return normalize([caregiver.fullName,caregiver.mobile,caregiver.membershipCode,caregiver.id,caregiver.nationalId,caregiver.primaryType,caregiver.fileStatus,caregiver.username].join(' '))}

function addStyles(){
  if($('#serverDirectoryStylesV2'))return;
  const style=document.createElement('style');style.id='serverDirectoryStylesV2';style.textContent=`
  .sd2-root{direction:rtl}.sd-loading,.sd-empty{padding:44px;text-align:center;border:1px dashed #cfe0d7;border-radius:20px;color:#66776e;background:#fbfdfc}
  .sd-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.sd-toolbar h3{margin:0;font-size:17px}.sd-toolbar p{margin:6px 0 0;color:#76857d;font-size:11px}.sd-toolbar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .sd-search{min-width:300px;border:1px solid #d9e5df;border-radius:14px;background:#fff;padding:12px 14px;font:inherit;outline:none}.sd-search:focus{border-color:#14945a;box-shadow:0 0 0 3px #e0f5e9}
  .sd-btn{border:0;border-radius:12px;padding:11px 15px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.sd-btn.primary{background:#078848;color:#fff}.sd-btn.soft{background:#edf8f2;color:#08743f}.sd-btn.warn{background:#fff1d8;color:#9a6300}.sd-btn.danger{background:#ffeaed;color:#b52238}.sd-btn:disabled{opacity:.55;cursor:wait}
  .sd-workspace{display:grid;grid-template-columns:minmax(350px,.9fr) minmax(0,1.35fr);gap:16px;align-items:start;direction:rtl}.sd-panel{border:1px solid #dce8e2;border-radius:22px;background:#fff;overflow:hidden;box-shadow:0 12px 35px rgba(23,74,49,.045)}.sd-panel-head{padding:18px 20px;border-bottom:1px solid #edf2ef}.sd-panel-head h3{margin:0;font-size:15px}.sd-panel-head p{margin:6px 0 0;color:#7b8982;font-size:10px}.sd-panel-body{padding:18px}
  .sd-list{display:grid;gap:8px;max-height:690px;overflow:auto;padding:4px}.sd-row{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:11px;align-items:center;width:100%;border:1px solid #e0e9e4;border-radius:15px;background:#fff;padding:11px;text-align:right;cursor:pointer;transition:.16s}.sd-row:hover{border-color:#a7d8bf;transform:translateY(-1px)}.sd-row.active{border-color:#0c9957;background:#f0faf5;box-shadow:0 0 0 2px #e0f5ea}.sd-row-main strong{display:block;color:#21372d;font-size:12px}.sd-row-main small{display:block;margin-top:4px;color:#78877f;font-size:10px;line-height:1.7}.sd-row-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
  .sd-avatar{display:grid;place-items:center;overflow:hidden;background:#dff3e8;color:#087a45;font-weight:900;border-radius:15px;flex:none}.sd-avatar img{width:100%;height:100%;object-fit:cover}.sd-avatar-md{width:50px;height:50px}.sd-avatar-lg{width:104px;height:104px;border-radius:26px;font-size:28px}.sd-avatar-sm{width:44px;height:44px;border-radius:13px}
  .sd-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:9px;font-weight:900;white-space:nowrap}.sd-badge.warn{background:#fff1d8;color:#976000}.sd-badge.danger{background:#ffe8eb;color:#b31f36}.sd-badge.neutral{background:#f1f3f2;color:#647269}
  .sd-profile-top{display:flex;align-items:center;gap:16px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid #edf2ef}.sd-profile-top h3{margin:0;font-size:19px}.sd-profile-top p{margin:6px 0 0;color:#74837b;font-size:11px}.sd-photo-actions{margin-top:9px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sd-photo-actions input{max-width:210px;font-size:10px}
  .sd-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sd-form label{display:flex;flex-direction:column;gap:6px;color:#34483e;font-size:10px;font-weight:900}.sd-form input,.sd-form select,.sd-form textarea{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;background:#fff;padding:11px 12px;font:inherit;outline:none}.sd-form input:focus,.sd-form select:focus,.sd-form textarea:focus{border-color:#15945a;box-shadow:0 0 0 3px #e1f5ea}.sd-form textarea{min-height:90px;resize:vertical}.sd-wide{grid-column:1/-1}.sd-form-actions{grid-column:1/-1;display:flex;gap:9px;justify-content:flex-start;flex-wrap:wrap;margin-top:3px}.sd-section-title{grid-column:1/-1;margin:6px 0 0;padding-top:12px;border-top:1px solid #edf2ef;font-size:12px;color:#08743f}
  .sd-permissions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.sd-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px!important;border:1px solid #e4ebe7;border-radius:11px;padding:9px;font-weight:700!important}.sd-check input{width:auto!important;margin:0}
  .sd-inline-error{display:none;grid-column:1/-1;padding:11px 12px;border-radius:11px;background:#fff0f1;color:#ad2638;font-size:10px;font-weight:900;line-height:1.8}.sd-inline-error.show{display:block}
  .sd-care-list{display:grid;gap:9px}.sd-care-row{display:grid;grid-template-columns:54px minmax(0,1.2fr) repeat(4,minmax(110px,.45fr)) auto;gap:12px;align-items:center;width:100%;border:1px solid #dfe9e4;border-radius:16px;background:#fff;padding:12px;text-align:right;cursor:pointer}.sd-care-row:hover{border-color:#11965a;background:#f5fbf8}.sd-care-row strong{display:block;font-size:12px}.sd-care-row small{display:block;margin-top:4px;color:#7b8982;font-size:10px}.sd-care-cell{font-size:10px;color:#46594f}.sd-care-cell b{display:block;color:#21372d;font-size:11px}.sd-create-box{margin-bottom:16px;border:1px solid #cfe5da;border-radius:18px;background:#f8fcfa;padding:18px}
  @media(max-width:1180px){.sd-workspace{grid-template-columns:1fr}.sd-list{max-height:430px}.sd-care-row{grid-template-columns:54px minmax(0,1fr) repeat(2,minmax(100px,.5fr));}.sd-care-row .optional{display:none}}
  @media(max-width:720px){.sd-toolbar{align-items:stretch;flex-direction:column}.sd-toolbar-actions{width:100%}.sd-search{min-width:0;width:100%}.sd-form{grid-template-columns:1fr}.sd-wide,.sd-section-title,.sd-form-actions,.sd-permissions{grid-column:auto}.sd-permissions{grid-template-columns:1fr}.sd-care-row{grid-template-columns:48px minmax(0,1fr) auto}.sd-care-cell{display:none}}
  `;document.head.appendChild(style);
}

function permissionsMarkup(selected=[]){const set=new Set(selected||[]);return permissionOptions.map(([value,label])=>`<label class="sd-check"><input type="checkbox" name="permissions" value="${value}" ${set.has(value)?'checked':''}>${label}</label>`).join('')}
function accountListRows(data){
  const rows=data.accounts.map(account=>{const caregiver=account.caregiverId?data.caregivers.find(item=>item.id===account.caregiverId):null;return {key:account.id,account,caregiver,kind:'account'}});
  data.caregivers.filter(item=>!item.userId).forEach(caregiver=>rows.push({key:`profile:${caregiver.id}`,caregiver,kind:'orphan'}));
  if(!rows.length)return '<div class="sd-empty">هنوز حساب یا پرونده‌ای ثبت نشده است.</div>';
  return rows.map(item=>{
    const account=item.account||{};const caregiver=item.caregiver||{};const name=account.fullName||caregiver.fullName;const role=item.kind==='orphan'?'پرونده بدون حساب':roleFa[String(account.role||'').toUpperCase()]||account.role;
    const status=item.kind==='orphan'?'بدون حساب ورود':statusFa[String(account.status||'').toUpperCase()]||account.status;
    const selected=item.key===selectedUserKey?'active':'';
    return `<button class="sd-row ${selected}" data-sd-user-key="${esc(item.key)}" data-search="${esc(item.kind==='account'?accountSearchText(account,caregiver):caregiverSearchText(caregiver))}">
      ${avatar({...account,...caregiver,fullName:name,avatarUrl:account.avatarUrl||caregiver.avatarUrl,avatarId:account.avatarId||caregiver.avatarId})}
      <span class="sd-row-main"><strong>${esc(name)}</strong><small>${esc(account.username||caregiver.membershipCode||caregiver.id||'—')}<br>${esc(account.mobile||caregiver.mobile||'شماره ثبت نشده')}</small></span>
      <span class="sd-row-side"><i class="sd-badge ${item.kind==='orphan'?'warn':''}">${esc(role)}</i><i class="sd-badge ${item.kind==='orphan'?'warn':statusClass(account.status)}">${esc(status)}</i></span>
    </button>`;
  }).join('');
}

function detailMarkup(data,key){
  if(key==='new')return createAccountMarkup();
  const selected=userByKey(data,key);
  if(!selected)return '<div class="sd-empty">برای مشاهده و ویرایش، یک ردیف را انتخاب کنید.</div>';
  const account=selected.account||null,caregiver=selected.caregiver||null;
  const name=account?.fullName||caregiver?.fullName||'';
  const avatarItem={fullName:name,avatarUrl:account?.avatarUrl||caregiver?.avatarUrl,avatarId:account?.avatarId||caregiver?.avatarId};
  return `<div class="sd-profile-top">${avatar(avatarItem,'lg')}<div><h3>${esc(name)}</h3><p>${account?`${esc(roleFa[String(account.role).toUpperCase()]||account.role)} • ${esc(account.username||'بدون نام کاربری')}`:`${esc(caregiver?.membershipCode||caregiver?.id)} • هنوز حساب ورود ندارد`}</p><div class="sd-photo-actions"><input id="sdAvatarInput" type="file" accept="image/jpeg,image/png,image/webp"><button class="sd-btn soft" id="sdAvatarUpload" type="button">ثبت تصویر پروفایل</button></div></div></div>
  <form class="sd-form" id="sdProfileForm">
    <input type="hidden" name="userId" value="${esc(account?.id||'')}"><input type="hidden" name="caregiverId" value="${esc(caregiver?.id||account?.caregiverId||'')}">
    <label>نام و نام خانوادگی<input name="fullName" value="${esc(name)}" required></label>
    ${account?`<label>نام کاربری یا ایمیل ورود<input name="username" value="${esc(account.username||'')}" autocomplete="username" required></label>`:'<div></div>'}
    <label>شماره همراه<input name="mobile" value="${esc(account?.mobile||caregiver?.mobile||'')}" inputmode="numeric"></label>
    ${account?`<label>نقش<select name="role">${Object.entries(roleFa).map(([value,label])=>`<option value="${value}" ${String(account.role).toUpperCase()===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>وضعیت حساب<select name="status">${[['ACTIVE','فعال'],['PENDING','در انتظار تأیید'],['SUSPENDED','تعلیق‌شده'],['INACTIVE','غیرفعال']].map(([value,label])=>`<option value="${value}" ${String(account.status).toUpperCase()===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>رمز عبور جدید<input name="password" type="password" autocomplete="new-password" placeholder="برای حفظ رمز فعلی خالی بگذارید"></label>`:''}
    ${caregiver?`<h4 class="sd-section-title">اطلاعات پرونده حرفه‌ای</h4>
    <label>کد ملی<input name="nationalId" value="${esc(caregiver.nationalId||'')}" inputmode="numeric"></label>
    <label>تاریخ تولد<input name="birthDate" value="${esc(caregiver.birthDate||'')}" placeholder="۱۴۰۰/۰۱/۰۱"></label>
    <label>شهر<input name="city" value="${esc(caregiver.city||'')}"></label>
    <label>گروه خدمتی<input name="primaryType" value="${esc(caregiver.primaryType||'')}"></label>
    <label>وضعیت پرونده<input name="fileStatus" value="${esc(caregiver.fileStatus||'')}"></label>
    <label>سطح حرفه‌ای<input name="professionalLevel" value="${esc(caregiver.professionalLevel||'')}"></label>
    <label class="sd-wide">نشانی<textarea name="address">${esc(caregiver.address||'')}</textarea></label>
    <label class="sd-wide">سوابق و توضیحات حرفه‌ای<textarea name="workHistory">${esc(caregiver.workHistory||'')}</textarea></label>`:''}
    ${account?`<h4 class="sd-section-title">سطوح دسترسی</h4><div class="sd-permissions">${permissionsMarkup(account.permissions)}</div>`:''}
    <div class="sd-inline-error" id="sdProfileError"></div>
    <div class="sd-form-actions"><button class="sd-btn primary" type="submit">ذخیره تغییرات</button>${account&&String(account.role).toUpperCase()!=='ADMIN'?'<button class="sd-btn danger" type="button" id="sdDeleteAccount">حذف حساب</button>':''}${!account?'<button class="sd-btn soft" type="button" id="sdCreateLinkedAccount">ساخت حساب ورود متصل</button>':''}</div>
  </form>`;
}

function createAccountMarkup(){return `<div class="sd-profile-top"><span class="sd-avatar sd-avatar-lg">+</span><div><h3>ایجاد حساب جدید</h3><p>برای نقش مراقب، حساب ورود و پرونده حرفه‌ای با هم ایجاد می‌شوند.</p></div></div>
<form class="sd-form" id="sdCreateAccountForm">
  <label>نام و نام خانوادگی<input name="fullName" required></label><label>نقش<select name="role" id="sdCreateRole">${Object.entries(roleFa).map(([value,label])=>`<option value="${value}" ${value==='CAREGIVER'?'selected':''}>${label}</option>`).join('')}</select></label>
  <label>نام کاربری یا ایمیل ورود<input name="username" autocomplete="username" required></label><label>شماره همراه<input name="mobile" inputmode="numeric"></label>
  <label>رمز عبور<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>وضعیت<select name="status"><option value="ACTIVE">فعال</option><option value="PENDING">در انتظار تأیید</option></select></label>
  <div id="sdCreateCaregiverFields" class="sd-wide"><div class="sd-form"><h4 class="sd-section-title">اطلاعات پرونده مراقب</h4><label>کد ملی<input name="nationalId" inputmode="numeric"></label><label>گروه خدمتی<input name="primaryType" value="مراقبت سالمند"></label><label>شهر<input name="city"></label><label>وضعیت پرونده<input name="fileStatus" value="CP-03 نیازمند تکمیل مدارک"></label><label class="sd-wide">نشانی<textarea name="address"></textarea></label><label class="sd-wide">سوابق و توضیحات<textarea name="workHistory"></textarea></label></div></div>
  <h4 class="sd-section-title">سطوح دسترسی</h4><div class="sd-permissions">${permissionsMarkup([])}</div><div class="sd-inline-error" id="sdCreateError"></div><div class="sd-form-actions"><button class="sd-btn primary" type="submit">ایجاد حساب</button><button class="sd-btn soft" type="button" id="sdCancelCreate">انصراف</button></div>
</form>`}

function collectForm(form){const data=new FormData(form),body={};for(const [key,value] of data.entries()){if(key==='permissions')continue;body[key]=String(value).trim()}body.permissions=data.getAll('permissions').map(String);return body}
function showInline(id,message){const box=$(id);if(!box)return;box.textContent=message;box.classList.add('show')}
function setBusy(form,busy,text='در حال ثبت...'){const button=form?.querySelector('[type="submit"]');if(!button)return;if(!button.dataset.original)button.dataset.original=button.textContent;button.disabled=busy;button.textContent=busy?text:button.dataset.original}

async function bindUserDetail(data){
  const form=$('#sdProfileForm');
  form?.addEventListener('submit',async event=>{event.preventDefault();const body=collectForm(form);if(!body.password)delete body.password;setBusy(form,true);try{await api('/api/admin/directory/profile',{method:'PATCH',body:JSON.stringify(body)});invalidate();const fresh=await directory(true);renderUsersFromData(fresh,selectedUserKey);notify('تغییرات ذخیره شد','اطلاعات پروفایل به‌روزرسانی شد.')}catch(error){showInline('#sdProfileError',errorText(error))}finally{setBusy(form,false)}});
  $('#sdAvatarUpload')?.addEventListener('click',async()=>{const file=$('#sdAvatarInput')?.files?.[0];if(!file){showInline('#sdProfileError','ابتدا یک تصویر انتخاب کنید.');return}const selected=userByKey(data,selectedUserKey),userId=selected?.account?.id||'',caregiverId=selected?.caregiver?.id||selected?.account?.caregiverId||'';const button=$('#sdAvatarUpload');button.disabled=true;button.textContent='در حال بارگذاری...';try{const params=new URLSearchParams();if(userId)params.set('userId',userId);if(caregiverId)params.set('caregiverId',caregiverId);await api(`/api/profile-images?${params}`,{method:'POST',headers:{'content-type':file.type,'x-file-size':String(file.size)},body:file});invalidate();const fresh=await directory(true);renderUsersFromData(fresh,selectedUserKey);notify('تصویر ثبت شد','تصویر پروفایل به‌روزرسانی شد.')}catch(error){showInline('#sdProfileError',errorText(error))}finally{button.disabled=false;button.textContent='ثبت تصویر پروفایل'}});
  $('#sdDeleteAccount')?.addEventListener('click',async()=>{const selected=userByKey(data,selectedUserKey);if(!selected?.account||!confirm('حساب کاربری حذف شود؟ پرونده حرفه‌ای برای حفظ سوابق باقی می‌ماند.'))return;try{await api(`/api/users/${encodeURIComponent(selected.account.id)}`,{method:'DELETE'});invalidate();const fresh=await directory(true);selectedUserKey='';renderUsersFromData(fresh,'');notify('حساب حذف شد','حساب ورود حذف شد و پرونده حرفه‌ای باقی ماند.')}catch(error){showInline('#sdProfileError',errorText(error))}});
  $('#sdCreateLinkedAccount')?.addEventListener('click',()=>{const selected=userByKey(data,selectedUserKey);if(!selected?.caregiver)return;const username=prompt('نام کاربری یا ایمیل ورود را وارد کنید:');if(!username)return;const password=prompt('رمز عبور جدید را وارد کنید (حداقل ۸ کاراکتر):');if(!password)return;void createLinkedAccount(selected.caregiver,username,password)});
}
async function createLinkedAccount(caregiver,username,password){try{const result=await api('/api/caregiver-accounts',{method:'POST',body:JSON.stringify({caregiverId:caregiver.id,fullName:caregiver.fullName,mobile:caregiver.mobile,username,password,status:'ACTIVE',nationalId:caregiver.nationalId,serviceGroup:caregiver.primaryType,fileStatus:caregiver.fileStatus,city:caregiver.city,address:caregiver.address,workHistory:caregiver.workHistory})});invalidate();const fresh=await directory(true);selectedUserKey=result?.data?.user?.id||'';renderUsersFromData(fresh,selectedUserKey);notify('حساب ساخته شد','حساب ورود به پرونده موجود متصل شد.')}catch(error){showInline('#sdProfileError',errorText(error))}}

async function bindCreateAccount(){
  const form=$('#sdCreateAccountForm'),role=$('#sdCreateRole'),fields=$('#sdCreateCaregiverFields');
  const toggle=()=>{if(fields)fields.hidden=String(role?.value||'').toUpperCase()!=='CAREGIVER'};role?.addEventListener('change',toggle);toggle();
  $('#sdCancelCreate')?.addEventListener('click',()=>{selectedUserKey='';void renderUsers()});
  form?.addEventListener('submit',async event=>{event.preventDefault();const body=collectForm(form),isCaregiver=String(body.role).toUpperCase()==='CAREGIVER';setBusy(form,true,isCaregiver?'در حال ساخت حساب و پرونده...':'در حال ساخت حساب...');try{let result;if(isCaregiver){result=await api('/api/caregiver-accounts',{method:'POST',body:JSON.stringify({...body,serviceGroup:body.primaryType,bio:body.workHistory})})}else{result=await api('/api/users',{method:'POST',body:JSON.stringify(body)})}invalidate();const fresh=await directory(true);selectedUserKey=result?.data?.user?.id||result?.data?.id||'';renderUsersFromData(fresh,selectedUserKey);notify('حساب ایجاد شد',isCaregiver?'حساب ورود و پرونده حرفه‌ای با موفقیت ایجاد شدند.':'حساب سازمانی ایجاد شد.')}catch(error){showInline('#sdCreateError',errorText(error))}finally{setBusy(form,false)}})
}

function bindUserList(data){
  $('#sdUserSearch')?.addEventListener('input',event=>{const query=normalize(event.currentTarget.value);$$('[data-sd-user-key]').forEach(row=>row.hidden=Boolean(query&&!String(row.dataset.search||'').includes(query)))});
  $$('[data-sd-user-key]').forEach(row=>row.addEventListener('click',()=>{selectedUserKey=row.dataset.sdUserKey;renderUsersFromData(data,selectedUserKey)}));
  $('#sdNewAccount')?.addEventListener('click',()=>{selectedUserKey='new';renderUsersFromData(data,'new')});
}
function renderUsersFromData(data,key){
  if(key!==undefined)selectedUserKey=key;
  if(!selectedUserKey){selectedUserKey=data.accounts[0]?.id||(data.caregivers.find(item=>!item.userId)?`profile:${data.caregivers.find(item=>!item.userId).id}`:'')}
  setPage('کاربران و دسترسی‌ها','مدیریت حساب‌ها، پروفایل‌ها و سطح دسترسی',`
    <div class="sd-toolbar"><div><h3>فهرست کاربران و پروفایل‌ها</h3><p>${fa(data.accounts.length)} حساب و ${fa(data.caregivers.length)} پرونده حرفه‌ای</p></div><div class="sd-toolbar-actions"><input class="sd-search" id="sdUserSearch" placeholder="جست‌وجوی نام، موبایل، نام کاربری، کد ملی یا کد پرونده"><button class="sd-btn primary" id="sdNewAccount">ایجاد حساب جدید</button></div></div>
    <div class="sd-workspace"><article class="sd-panel"><div class="sd-panel-head"><h3>فهرست</h3><p>برای مشاهده جزئیات روی هر ردیف کلیک کنید.</p></div><div class="sd-panel-body"><div class="sd-list">${accountListRows(data)}</div></div></article><article class="sd-panel"><div class="sd-panel-head"><h3>پروفایل و تنظیمات حساب</h3><p>اطلاعات فرد، پرونده و تصویر پروفایل را ویرایش کنید.</p></div><div class="sd-panel-body" id="sdDetailPane">${detailMarkup(data,selectedUserKey)}</div></article></div>`);
  bindUserList(data);if(selectedUserKey==='new')void bindCreateAccount();else void bindUserDetail(data)
}
async function renderUsers(){if(!isAdmin())return;loading('کاربران و دسترسی‌ها','مدیریت حساب‌ها، پروفایل‌ها و سطح دسترسی');try{renderUsersFromData(await directory(true),selectedUserKey)}catch(error){setPage('کاربران و دسترسی‌ها','خطا در دریافت اطلاعات',`<div class="sd-empty">${esc(errorText(error))}</div>`)}}

function caregiverRows(data){if(!data.caregivers.length)return '<div class="sd-empty">هنوز پرونده مراقبی ثبت نشده است.</div>';return data.caregivers.map(item=>`<button class="sd-care-row" data-caregiver-id="${esc(item.id)}" data-membership="${esc(item.membershipCode||item.id)}" data-search="${esc(caregiverSearchText(item))}">${avatar(item)}<span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||item.id)} • ${esc(item.mobile||'شماره ثبت نشده')}</small></span><span class="sd-care-cell"><small>گروه خدمتی</small><b>${esc(item.primaryType||'—')}</b></span><span class="sd-care-cell"><small>وضعیت پرونده</small><b>${esc(item.fileStatus||'—')}</b></span><span class="sd-care-cell optional"><small>سطح حرفه‌ای</small><b>${esc(item.professionalLevel||'در انتظار ارزیابی')}</b></span><span class="sd-care-cell optional"><small>حساب ورود</small><b>${item.hasAccount?'فعال/متصل':'بدون حساب'}</b></span><span class="sd-badge">مشاهده کارنامه</span></button>`).join('')}
function caregiverCreateMarkup(){return `<div class="sd-create-box"><div class="sd-toolbar"><div><h3>ایجاد پرونده مراقب</h3><p>این فرم فقط پرونده حرفه‌ای می‌سازد؛ حساب ورود را می‌توان از ماژول کاربران متصل کرد.</p></div><button class="sd-btn soft" id="sdCancelCaregiverCreate">بستن</button></div><form class="sd-form" id="sdCreateCaregiverForm"><label>نام و نام خانوادگی<input name="fullName" required></label><label>شماره همراه<input name="mobile" inputmode="numeric" required></label><label>کد ملی<input name="nationalId" inputmode="numeric"></label><label>گروه خدمتی<input name="primaryType" value="مراقبت سالمند"></label><label>شهر<input name="city"></label><label>وضعیت پرونده<input name="fileStatus" value="CP-03 نیازمند تکمیل مدارک"></label><label class="sd-wide">نشانی<textarea name="address"></textarea></label><label class="sd-wide">سوابق و توضیحات<textarea name="workHistory"></textarea></label><div class="sd-inline-error" id="sdCareCreateError"></div><div class="sd-form-actions"><button class="sd-btn primary" type="submit">ثبت پرونده</button></div></form></div>`}
async function openProfessional(caregiver){
  try{
    const state=await api('/api/state');window.SalamatBackend?.applyState?.(state);
    const workKey='salamatAvalAdminWorkspaceV15',uiKey='salamatAvalEvaluationUIV13';
    const work=JSON.parse(localStorage.getItem(workKey)||'{}');work.ui||={};work.ui.caregiverId=caregiver.membershipCode||caregiver.id;localStorage.setItem(workKey,JSON.stringify(work));
    const ui=JSON.parse(localStorage.getItem(uiKey)||'{}');ui.caregiverId=caregiver.membershipCode||caregiver.id;localStorage.setItem(uiKey,JSON.stringify(ui));
    bypassRoute=true;try{window.renderModule?.(window.roles?.admin,['activity','پرونده حرفه‌ای مراقبین'])}finally{bypassRoute=false}
    setTimeout(()=>{const id=CSS.escape(caregiver.membershipCode||caregiver.id);document.querySelector(`[data-professional-caregiver="${id}"]`)?.click()},80);
  }catch(error){notify('بازکردن کارنامه انجام نشد',errorText(error))}
}
function bindCaregiverDirectory(data){
  $('#sdCareSearch')?.addEventListener('input',event=>{const query=normalize(event.currentTarget.value);$$('[data-caregiver-id]').forEach(row=>row.hidden=Boolean(query&&!String(row.dataset.search||'').includes(query)))});
  $$('[data-caregiver-id]').forEach(row=>row.addEventListener('click',()=>{const item=data.caregivers.find(caregiver=>caregiver.id===row.dataset.caregiverId);if(item)void openProfessional(item)}));
  $('#sdNewCaregiver')?.addEventListener('click',()=>{showCreateCaregiver=true;renderCaregiversFromData(data)});
  $('#sdCancelCaregiverCreate')?.addEventListener('click',()=>{showCreateCaregiver=false;renderCaregiversFromData(data)});
  $('#sdCreateCaregiverForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,body=collectForm(form);setBusy(form,true,'در حال ثبت پرونده...');try{await api('/api/caregivers',{method:'POST',body:JSON.stringify({...body,serviceGroup:body.primaryType,bio:body.workHistory})});invalidate();showCreateCaregiver=false;renderCaregiversFromData(await directory(true));notify('پرونده ثبت شد','پرونده جدید در فهرست مراقبین قرار گرفت.')}catch(error){showInline('#sdCareCreateError',errorText(error))}finally{setBusy(form,false)}})
}
function renderCaregiversFromData(data){setPage('پرونده مراقبین','فهرست پرونده‌های حرفه‌ای و دسترسی به کارنامه هر مراقب',`${showCreateCaregiver?caregiverCreateMarkup():''}<div class="sd-toolbar"><div><h3>پرونده‌های حرفه‌ای مراقبین</h3><p>${fa(data.caregivers.length)} پرونده؛ با انتخاب هر ردیف کارنامه حرفه‌ای باز می‌شود.</p></div><div class="sd-toolbar-actions"><input class="sd-search" id="sdCareSearch" placeholder="جست‌وجوی نام، موبایل، کد ملی یا کد پرونده"><button class="sd-btn primary" id="sdNewCaregiver">ایجاد پرونده جدید</button></div></div><article class="sd-panel"><div class="sd-panel-body"><div class="sd-care-list">${caregiverRows(data)}</div></div></article>`);bindCaregiverDirectory(data)}
async function renderCaregivers(){if(!isAdmin())return;loading('پرونده مراقبین','فهرست پرونده‌های حرفه‌ای و دسترسی به کارنامه هر مراقب');try{renderCaregiversFromData(await directory(true))}catch(error){setPage('پرونده مراقبین','خطا در دریافت اطلاعات',`<div class="sd-empty">${esc(errorText(error))}</div>`)}}

function moduleLabel(module){return String(Array.isArray(module)?module[1]:module||'').trim()}
function isUsersLabel(label){return label.includes('کاربران و دسترسی')}
function isCaregiverLabel(label){return ['پرونده مراقبین','پرونده حرفه‌ای مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین','فعال سازی پرونده حرفه ای مراقبین'].includes(label)}
function installRouter(){
  const current=window.renderModule;
  if(typeof current!=='function'||current.__salamatDirectoryV2)return;
  moduleRouterBase=current;
  const wrapped=function(...args){const label=moduleLabel(args[1]);if(!bypassRoute&&isAdmin()&&isUsersLabel(label)){void renderUsers();return}if(!bypassRoute&&isAdmin()&&isCaregiverLabel(label)){void renderCaregivers();return}return current.apply(this,args)};
  wrapped.__salamatDirectoryV2=true;window.renderModule=wrapped;
}
function captureNav(event){
  if(!isAdmin())return;
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');if(!button)return;
  const label=String(button.textContent||'').trim();
  if(isUsersLabel(label)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();$$('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',item===button));void renderUsers()}
  else if(isCaregiverLabel(label)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();$$('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',item===button));void renderCaregivers()}
}
function boot(){addStyles();document.addEventListener('click',captureNav,true);installRouter();const timer=setInterval(installRouter,300);setTimeout(()=>{clearInterval(timer);setInterval(installRouter,1600)},30000);window.addEventListener('salamat-server-directory-refresh',()=>{invalidate();const title=String($('#pageTitle')?.textContent||'');if(title.includes('کاربران'))void renderUsers();else if(title.includes('پرونده مراقبین'))void renderCaregivers()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
