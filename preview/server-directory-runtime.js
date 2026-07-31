(()=>{
'use strict';

if(window.__salamatServerDirectoryRuntimeV1)return;
window.__salamatServerDirectoryRuntimeV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const roleFa={ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
const statusFa={ACTIVE:'فعال',APPROVED:'فعال',PENDING:'در انتظار تأیید',INACTIVE:'غیرفعال',SUSPENDED:'تعلیق‌شده'};
let cache=null;
let selectedCaregiverId='';
let pendingProfileId='';
let moduleRouterBase=null;
let dashboardRouterBase=null;

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||null}
function isAdmin(){return String(currentUser()?.role||'').toUpperCase()==='ADMIN'}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
function errorText(error){return [error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:'',error?.detail?String(error.detail).slice(0,400):''].filter(Boolean).join(' — ')}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}
function addStyles(){
  if($('#serverDirectoryStyles'))return;
  const style=document.createElement('style');style.id='serverDirectoryStyles';style.textContent=`
  .sd-source{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #b7e3cd;border-radius:999px;background:#edf9f3;color:#08743f;font-size:11px;font-weight:900}
  .sd-source:before{content:'';width:8px;height:8px;border-radius:50%;background:#13a060;box-shadow:0 0 0 4px #d9f3e6}
  .sd-loading,.sd-empty{padding:40px;text-align:center;border:1px dashed #cfe0d7;border-radius:18px;color:#607269;background:#fbfdfc}
  .sd-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}.sd-kpi{padding:18px;border:1px solid #dce9e2;border-radius:18px;background:#fff}.sd-kpi small{display:block;color:#728079;font-size:11px}.sd-kpi strong{display:block;margin-top:8px;color:#08743f;font-size:24px}
  .sd-grid{display:grid;grid-template-columns:minmax(330px,.9fr) minmax(0,1.5fr);gap:16px;align-items:start}.sd-card{border:1px solid #dce9e2;border-radius:20px;background:#fff;overflow:hidden}.sd-pad{padding:20px}.sd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.sd-head h3{margin:0;font-size:16px}.sd-head p{margin:5px 0 0;color:#718078;font-size:11px}
  .sd-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sd-form label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:800;color:#35473f}.sd-form input,.sd-form select,.sd-form textarea,.sd-search{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;background:#fff;padding:11px 12px;font:inherit;outline:none}.sd-form input:focus,.sd-form select:focus,.sd-form textarea:focus,.sd-search:focus{border-color:#15945a;box-shadow:0 0 0 3px #e1f5ea}.sd-wide{grid-column:1/-1}.sd-actions{display:flex;gap:8px;flex-wrap:wrap}.sd-btn{border:0;border-radius:11px;padding:10px 14px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.sd-btn.primary{background:#078848;color:#fff}.sd-btn.soft{background:#edf8f2;color:#08743f}.sd-btn.warn{background:#fff3dc;color:#9b6200}.sd-btn.danger{background:#ffeaed;color:#b52238}.sd-btn:disabled{opacity:.55;cursor:wait}
  .sd-table-wrap{overflow:auto}.sd-table{width:100%;border-collapse:collapse;min-width:850px}.sd-table th,.sd-table td{padding:12px;border-bottom:1px solid #edf2ef;text-align:right;font-size:11px;vertical-align:middle}.sd-table th{color:#697b72;background:#fafcfb;font-weight:900;position:sticky;top:0}.sd-table strong{display:block;color:#263b32}.sd-table small{display:block;margin-top:3px;color:#87958e}.sd-badge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:900;background:#edf8f2;color:#08743f}.sd-badge.warn{background:#fff1d8;color:#9a6300}.sd-badge.danger{background:#ffe9ec;color:#b32035}
  .sd-list{display:grid;gap:9px;max-height:660px;overflow:auto;padding-left:3px}.sd-person{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;width:100%;border:1px solid #dce9e2;border-radius:14px;background:#fff;padding:10px;text-align:right;cursor:pointer}.sd-person.active{border-color:#15945a;background:#f1faf5}.sd-avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#dbf2e5;color:#08743f;font-weight:900}.sd-person span strong{display:block;font-size:12px}.sd-person span small{display:block;margin-top:4px;color:#798980;font-size:10px}.sd-orphans{margin-top:16px;border-top:1px solid #e8efeb;padding-top:14px}.sd-note{padding:12px;border-radius:12px;background:#fff8e9;color:#7f5a0d;font-size:11px;line-height:1.9}.sd-error{padding:12px;border-radius:12px;background:#fff0f1;color:#ad2638;font-size:11px;font-weight:800}
  @media(max-width:1100px){.sd-kpis{grid-template-columns:repeat(2,1fr)}.sd-grid{grid-template-columns:1fr}}@media(max-width:700px){.sd-form{grid-template-columns:1fr}.sd-wide{grid-column:auto}.sd-kpis{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
}
function setPage(title,subtitle,html){
  const titleEl=$('#pageTitle'),subEl=$('#pageSubtitle'),content=$('#content');
  if(titleEl)titleEl.textContent=title;if(subEl)subEl.textContent=subtitle;if(content)content.innerHTML=`<section class="module-page sd-root">${html}</section>`;
  try{window.hydrateIcons?.(content)}catch{}
}
function loading(title,subtitle){setPage(title,subtitle,'<div class="sd-loading">در حال خواندن مستقیم اطلاعات از Cloudflare D1...</div>')}
async function directory(force=false){
  if(cache&&!force)return cache;
  const result=await api('/api/admin/directory');cache=result.data;return cache;
}
function invalidate(){cache=null}
function initials(name){return String(name||'م').trim().split(/\s+/).map(part=>part[0]).join('').slice(0,2)}
function accountStatusClass(status){const key=String(status||'').toUpperCase();return key==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(key)?'danger':''}
function linkedBadge(account){
  if(String(account.role).toUpperCase()!=='CAREGIVER')return '<span class="sd-badge">سازمانی</span>';
  return account.linked?`<span class="sd-badge">${esc(account.membershipCode||account.caregiverId)}</span>`:'<span class="sd-badge danger">بدون پرونده</span>';
}
function findNav(label){return $$('#sidebarNav .nav-item,#sidebarNav button').find(button=>String(button.textContent||'').includes(label))}
function go(label){findNav(label)?.click()}

async function renderDashboard(){
  if(!isAdmin())return dashboardRouterBase?.apply(this,arguments);
  loading('داشبورد مدیریتی','نمای زنده حساب‌ها و پرونده‌ها از دیتابیس مرکزی');
  try{
    const data=await directory(true),c=data.counts;
    setPage('داشبورد مدیریتی','نمای زنده حساب‌ها و پرونده‌ها از دیتابیس مرکزی',`
      <div class="sd-head"><div><h3>وضعیت یکپارچگی اطلاعات</h3><p>این اعداد مستقیماً از D1 خوانده می‌شوند و وابسته به حافظه مرورگر نیستند.</p></div><span class="sd-source">منبع: Cloudflare D1</span></div>
      <section class="sd-kpis">
       <article class="sd-kpi"><small>همه حساب‌ها</small><strong>${fa(c.accounts)}</strong></article>
       <article class="sd-kpi"><small>حساب مراقب</small><strong>${fa(c.caregiverAccounts)}</strong></article>
       <article class="sd-kpi"><small>پرونده مراقب</small><strong>${fa(c.caregiverProfiles)}</strong></article>
       <article class="sd-kpi"><small>پرونده بدون حساب</small><strong>${fa(c.profilesWithoutAccounts)}</strong></article>
       <article class="sd-kpi"><small>حساب بدون پرونده</small><strong>${fa(c.accountsWithoutProfiles)}</strong></article>
      </section>
      <section class="sd-grid">
       <article class="sd-card sd-pad"><div class="sd-head"><div><h3>مدیریت حساب‌ها</h3><p>ایجاد حساب و پرونده متصل در یک تراکنش</p></div></div><button class="sd-btn primary" data-sd-go="کاربران و دسترسی‌ها">ورود به کاربران و دسترسی‌ها</button></article>
       <article class="sd-card sd-pad"><div class="sd-head"><div><h3>پرونده‌های حرفه‌ای</h3><p>مشاهده و ویرایش مستقیم پرونده‌های ثبت‌شده</p></div></div><button class="sd-btn soft" data-sd-go="پرونده مراقبین">ورود به پرونده مراقبین</button></article>
      </section>`);
    $$('[data-sd-go]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.sdGo)));
  }catch(error){setPage('داشبورد مدیریتی','خطا در دریافت اطلاعات',`<div class="sd-error">${esc(errorText(error))}</div>`)}
}

function userRows(accounts){
  if(!accounts.length)return '<tr><td colspan="7"><div class="sd-empty">هیچ حسابی در D1 ثبت نشده است.</div></td></tr>';
  return accounts.map(account=>`<tr>
    <td><strong>${esc(account.fullName)}</strong><small>${esc(account.id)}</small></td>
    <td>${esc(roleFa[String(account.role).toUpperCase()]||account.role)}</td>
    <td dir="ltr"><strong>${esc(account.username||'—')}</strong></td>
    <td dir="ltr">${esc(account.mobile||'—')}</td>
    <td>${linkedBadge(account)}</td>
    <td><span class="sd-badge ${accountStatusClass(account.status)}">${esc(statusFa[String(account.status).toUpperCase()]||account.status)}</span></td>
    <td><div class="sd-actions">
      ${String(account.status).toUpperCase()==='ACTIVE'?'':`<button class="sd-btn soft" data-sd-user="activate" data-id="${esc(account.id)}">فعال‌سازی</button>`}
      <button class="sd-btn warn" data-sd-user="reset" data-id="${esc(account.id)}">رمز جدید</button>
      ${String(account.role).toUpperCase()==='ADMIN'?'':`<button class="sd-btn danger" data-sd-user="suspend" data-id="${esc(account.id)}">تعلیق</button><button class="sd-btn danger" data-sd-user="delete" data-id="${esc(account.id)}">حذف</button>`}
    </div></td>
  </tr>`).join('');
}
function orphanRows(caregivers){
  const rows=caregivers.filter(item=>!item.userId);
  if(!rows.length)return '<div class="sd-note">همه پرونده‌های مراقبین به حساب ورود متصل هستند.</div>';
  return `<div class="sd-orphans"><div class="sd-head"><div><h3>پرونده‌های بدون حساب ورود</h3><p>برای این پرونده‌ها یک حساب متصل بسازید.</p></div><span class="sd-badge warn">${fa(rows.length)} مورد</span></div><div class="sd-list">${rows.map(item=>`<button class="sd-person" data-sd-link-profile="${esc(item.id)}"><b class="sd-avatar">${esc(initials(item.fullName))}</b><span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||item.id)} • ${esc(item.mobile||'شماره ثبت نشده')}</small></span><i class="sd-badge warn">ساخت حساب</i></button>`).join('')}</div></div>`;
}
async function renderUsers(){
  if(!isAdmin())return;
  loading('کاربران و دسترسی‌ها','حساب‌های واقعی سامانه و اتصال مستقیم به پرونده‌ها');
  try{
    const data=await directory(true),accounts=data.accounts||[],caregivers=data.caregivers||[];
    const linked=pendingProfileId?caregivers.find(item=>item.id===pendingProfileId):null;
    setPage('کاربران و دسترسی‌ها','حساب‌های واقعی سامانه و اتصال مستقیم به پرونده‌ها',`
      <div class="sd-head"><div><h3>مرجع واحد حساب و پرونده</h3><p>ثبت، تأیید و فهرست از D1 خوانده می‌شود؛ localStorage منبع این صفحه نیست.</p></div><span class="sd-source">منبع: Cloudflare D1</span></div>
      <section class="sd-grid">
       <article class="sd-card sd-pad">
        <div class="sd-head"><div><h3>${linked?'ساخت حساب برای پرونده موجود':'ایجاد حساب سازمانی'}</h3><p>${linked?`پرونده ${esc(linked.membershipCode||linked.id)} انتخاب شده است.`:'برای نقش مراقب، حساب و پرونده هم‌زمان و متصل ساخته می‌شوند.'}</p></div>${linked?'<button class="sd-btn soft" type="button" id="sdCancelLink">لغو اتصال</button>':''}</div>
        <form class="sd-form" id="serverAccountForm">
         <input type="hidden" name="caregiverId" value="${esc(linked?.id||'')}">
         <label>نام و نام خانوادگی<input name="fullName" required value="${esc(linked?.fullName||'')}"></label>
         <label>نقش<select name="role" id="sdRole"><option value="CAREGIVER" ${linked?'selected':''}>مراقب</option><option value="RECRUITER">کارشناس جذب</option><option value="HR">منابع انسانی</option><option value="SUPPORT">پشتیبان</option><option value="EVALUATOR">ارزیاب</option></select></label>
         <label>نام کاربری یا ایمیل ورود<input name="username" autocomplete="username" required dir="ltr"></label>
         <label>رمز عبور<input name="password" type="password" autocomplete="new-password" minlength="8" required dir="ltr"></label>
         <label>شماره همراه<input name="mobile" required value="${esc(linked?.mobile||'')}" placeholder="09128668837" dir="ltr"></label>
         <label>وضعیت<select name="status"><option value="ACTIVE">فعال و قابل ورود</option><option value="PENDING">در انتظار تأیید</option></select></label>
         <div class="sd-wide" id="sdCareFields"><div class="sd-form">
          <label>کد ملی<input name="nationalId" value="${esc(linked?.nationalId||'')}" maxlength="10" dir="ltr"></label>
          <label>گروه خدمتی<select name="serviceGroup"><option>مراقبت سالمند</option><option>مراقبت بیمار</option><option>مراقبت کودک</option><option>خدمات تخصصی</option></select></label>
          <label>وضعیت پرونده<select name="fileStatus"><option>CP-03 نیازمند تکمیل مدارک</option><option>CP-01 فعال</option><option>CP-02 مشروط</option><option>در انتظار تأیید مدیر</option></select></label>
          <label>شهر<input name="city" value="${esc(linked?.city||'')}"></label>
          <label class="sd-wide">نشانی<textarea name="address" rows="2">${esc(linked?.address||'')}</textarea></label>
          <label class="sd-wide">سوابق و معرفی حرفه‌ای<textarea name="bio" rows="3">${esc(linked?.workHistory||'')}</textarea></label>
         </div></div>
         <button class="sd-btn primary sd-wide" type="submit">${linked?'ساخت حساب و اتصال به این پرونده':'ایجاد حساب و اطلاعات وابسته'}</button>
        </form>
        ${orphanRows(caregivers)}
       </article>
       <article class="sd-card"><div class="sd-pad"><div class="sd-head"><div><h3>فهرست حساب‌های D1</h3><p>${fa(accounts.length)} حساب ثبت‌شده</p></div><input class="sd-search" id="sdUserSearch" placeholder="جست‌وجوی نام، نام کاربری، موبایل یا شناسه"></div></div><div class="sd-table-wrap"><table class="sd-table"><thead><tr><th>کاربر</th><th>نقش</th><th>نام کاربری</th><th>موبایل</th><th>پرونده متصل</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody id="sdUserBody">${userRows(accounts)}</tbody></table></div></article>
      </section>`);
    bindUsers(data);
  }catch(error){setPage('کاربران و دسترسی‌ها','خطا در دریافت اطلاعات',`<div class="sd-error">${esc(errorText(error))}</div>`)}
}
function bindUsers(data){
  const form=$('#serverAccountForm'),role=$('#sdRole'),fields=$('#sdCareFields');
  const syncRole=()=>{if(fields)fields.hidden=role?.value!=='CAREGIVER'};role?.addEventListener('change',syncRole);syncRole();
  $('#sdCancelLink')?.addEventListener('click',()=>{pendingProfileId='';void renderUsers()});
  $$('[data-sd-link-profile]').forEach(button=>button.addEventListener('click',()=>{pendingProfileId=button.dataset.sdLinkProfile||'';void renderUsers()}));
  form?.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('[type="submit"]'),fd=new FormData(form),roleValue=String(fd.get('role')||'CAREGIVER').toUpperCase();
    const body={fullName:fd.get('fullName'),role:roleValue,username:fd.get('username'),email:fd.get('username'),password:fd.get('password'),mobile:fd.get('mobile'),status:fd.get('status'),caregiverId:fd.get('caregiverId'),nationalId:fd.get('nationalId'),serviceGroup:fd.get('serviceGroup'),fileStatus:fd.get('fileStatus'),city:fd.get('city'),address:fd.get('address'),bio:fd.get('bio')};
    if(button){button.disabled=true;button.textContent='در حال ثبت قطعی در D1...'}
    try{
      const result=await api(roleValue==='CAREGIVER'?'/api/caregiver-accounts':'/api/users',{method:'POST',body:JSON.stringify(body)});
      const caregiverId=result?.data?.caregiver?.id;
      if(caregiverId&&body.mobile)await api(`/api/caregivers/${encodeURIComponent(caregiverId)}`,{method:'PATCH',body:JSON.stringify({fullName:body.fullName,mobile:body.mobile})}).catch(()=>null);
      pendingProfileId='';invalidate();notify('ثبت قطعی انجام شد',roleValue==='CAREGIVER'?'حساب ورود و پرونده حرفه‌ای متصل در D1 ساخته شدند.':'حساب سازمانی در D1 ساخته شد.');await renderUsers();
    }catch(error){notify('ایجاد حساب انجام نشد',errorText(error));if(button){button.disabled=false;button.textContent='ایجاد حساب و اطلاعات وابسته'}}
  });
  $$('[data-sd-user]').forEach(button=>button.addEventListener('click',async()=>{
    const action=button.dataset.sdUser,id=button.dataset.id;if(!id)return;
    try{
      if(action==='reset'){const password=prompt('رمز عبور جدید را وارد کنید؛ حداقل ۸ کاراکتر');if(!password)return;await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({password})});notify('رمز ثبت شد','رمز جدید در D1 ذخیره شد.');return}
      if(action==='delete'){if(!confirm('این حساب ورود از D1 حذف شود؟ پرونده حرفه‌ای برای سوابق باقی می‌ماند.'))return;await api(`/api/users/${encodeURIComponent(id)}`,{method:'DELETE'})}
      if(action==='activate')await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'ACTIVE'})});
      if(action==='suspend')await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'SUSPENDED'})});
      invalidate();await renderUsers();
    }catch(error){notify('عملیات انجام نشد',errorText(error))}
  }));
  $('#sdUserSearch')?.addEventListener('input',event=>{const q=String(event.currentTarget.value||'').trim().toLowerCase();$$('#sdUserBody tr').forEach(row=>row.hidden=Boolean(q&&!String(row.textContent||'').toLowerCase().includes(q)))});
}

function caregiverList(rows,selected){
  if(!rows.length)return '<div class="sd-empty">هیچ پرونده‌ای در D1 ثبت نشده است.</div>';
  return rows.map(item=>`<button class="sd-person ${item.id===selected?'active':''}" data-sd-care="${esc(item.id)}"><b class="sd-avatar">${esc(initials(item.fullName))}</b><span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||item.id)} • ${esc(item.mobile||'بدون شماره')}</small></span><i class="sd-badge ${item.hasAccount?'':'warn'}">${item.hasAccount?'حساب متصل':'بدون حساب'}</i></button>`).join('');
}
async function renderCaregivers(requestedId=''){
  if(!isAdmin())return;
  loading('پرونده مراقبین','پرونده‌های حرفه‌ای واقعی ثبت‌شده در دیتابیس مرکزی');
  try{
    const data=await directory(true),rows=data.caregivers||[];
    if(requestedId)selectedCaregiverId=requestedId;
    if(!rows.some(item=>item.id===selectedCaregiverId))selectedCaregiverId=rows[0]?.id||'';
    const item=rows.find(row=>row.id===selectedCaregiverId)||null;
    setPage('پرونده مراقبین','پرونده‌های حرفه‌ای واقعی ثبت‌شده در دیتابیس مرکزی',`
      <div class="sd-head"><div><h3>پرونده‌های D1</h3><p>ایجاد حساب و پرونده فقط از «کاربران و دسترسی‌ها» انجام می‌شود تا رکورد یتیم ساخته نشود.</p></div><span class="sd-source">منبع: Cloudflare D1</span></div>
      <section class="sd-grid">
       <article class="sd-card sd-pad"><div class="sd-head"><div><h3>فهرست پرونده‌ها</h3><p>${fa(rows.length)} پرونده</p></div></div><input class="sd-search" id="sdCareSearch" placeholder="جست‌وجوی نام، CP-ID، موبایل یا کد ملی"><div class="sd-list" id="sdCareList" style="margin-top:12px">${caregiverList(rows,selectedCaregiverId)}</div></article>
       <article class="sd-card sd-pad">${item?`<div class="sd-head"><div><h3>ویرایش پرونده انتخابی</h3><p>${esc(item.membershipCode||item.id)}</p></div><span class="sd-badge ${item.hasAccount?'':'warn'}">${item.hasAccount?`حساب: ${esc(item.username||item.userId)}`:'بدون حساب ورود'}</span></div>
        <form class="sd-form" id="serverCaregiverForm">
         <input type="hidden" name="id" value="${esc(item.id)}">
         <label>نام و نام خانوادگی<input name="fullName" required value="${esc(item.fullName)}"></label>
         <label>شماره همراه<input name="mobile" required value="${esc(item.mobile)}" dir="ltr"></label>
         <label>کد ملی<input name="nationalId" value="${esc(item.nationalId||'')}" maxlength="10" dir="ltr"></label>
         <label>گروه خدمتی<select name="serviceGroup"><option ${item.primaryType==='مراقبت سالمند'?'selected':''}>مراقبت سالمند</option><option ${item.primaryType==='مراقبت بیمار'?'selected':''}>مراقبت بیمار</option><option ${item.primaryType==='مراقبت کودک'?'selected':''}>مراقبت کودک</option><option ${item.primaryType==='خدمات تخصصی'?'selected':''}>خدمات تخصصی</option></select></label>
         <label>وضعیت پرونده<select name="fileStatus">${['CP-03 نیازمند تکمیل مدارک','CP-01 فعال','CP-02 مشروط','در انتظار تأیید مدیر'].map(status=>`<option ${item.fileStatus===status?'selected':''}>${status}</option>`).join('')}</select></label>
         <label>شهر<input name="city" value="${esc(item.city||'')}"></label>
         <label class="sd-wide">نشانی<textarea name="address" rows="3">${esc(item.address||'')}</textarea></label>
         <label class="sd-wide">سوابق و معرفی حرفه‌ای<textarea name="workHistory" rows="4">${esc(item.workHistory||'')}</textarea></label>
         <button class="sd-btn primary sd-wide" type="submit">ذخیره مستقیم در D1</button>
        </form>
        ${item.hasAccount?'':`<div class="sd-note" style="margin-top:14px">این پرونده حساب ورود ندارد. <button class="sd-btn warn" id="sdCreateLinkedAccount">ساخت حساب متصل</button></div>`}`:'<div class="sd-empty">پرونده‌ای انتخاب نشده است.</div>'}</article>
      </section>`);
    bindCaregivers(rows,item);
  }catch(error){setPage('پرونده مراقبین','خطا در دریافت اطلاعات',`<div class="sd-error">${esc(errorText(error))}</div>`)}
}
function bindCaregivers(rows,item){
  $$('[data-sd-care]').forEach(button=>button.addEventListener('click',()=>void renderCaregivers(button.dataset.sdCare)));
  $('#sdCareSearch')?.addEventListener('input',event=>{const q=String(event.currentTarget.value||'').trim().toLowerCase();$$('#sdCareList .sd-person').forEach(row=>row.hidden=Boolean(q&&!String(row.textContent||'').toLowerCase().includes(q)))});
  $('#sdCreateLinkedAccount')?.addEventListener('click',()=>{pendingProfileId=item?.id||'';go('کاربران و دسترسی‌ها')});
  $('#serverCaregiverForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,fd=new FormData(form),id=String(fd.get('id')||''),button=form.querySelector('[type="submit"]');if(button){button.disabled=true;button.textContent='در حال ذخیره در D1...'}
    const body={fullName:fd.get('fullName'),mobile:fd.get('mobile'),nationalId:fd.get('nationalId'),serviceGroup:fd.get('serviceGroup'),fileStatus:fd.get('fileStatus'),city:fd.get('city'),address:fd.get('address'),workHistory:fd.get('workHistory')};
    try{await api(`/api/caregivers/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});invalidate();notify('پرونده ذخیره شد','اطلاعات مستقیماً در D1 به‌روزرسانی شد.');await renderCaregivers(id)}catch(error){notify('ذخیره پرونده انجام نشد',errorText(error));if(button){button.disabled=false;button.textContent='ذخیره مستقیم در D1'}}
  });
}

function routeModule(roleModel,nav,args,base){
  const label=String(nav?.[1]||'').trim();
  if(isAdmin()&&label==='کاربران و دسترسی‌ها'){void renderUsers();return}
  if(isAdmin()&&['پرونده مراقبین','پرونده حرفه‌ای مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین','فعال سازی پرونده حرفه ای مراقبین'].includes(label)){void renderCaregivers();return}
  return base.apply(this,args);
}
function installRouters(){
  const currentModule=window.renderModule;
  if(typeof currentModule==='function'&&!currentModule.__salamatServerDirectoryRouter){
    moduleRouterBase=currentModule;
    const wrapped=function(...args){return routeModule.call(this,args[0],args[1],args,currentModule)};
    wrapped.__salamatServerDirectoryRouter=true;window.renderModule=wrapped;
  }
  const currentDashboard=window.renderDashboard;
  if(typeof currentDashboard==='function'&&!currentDashboard.__salamatServerDashboardRouter){
    dashboardRouterBase=currentDashboard;
    const wrapped=function(...args){if(isAdmin()){void renderDashboard();return}return currentDashboard.apply(this,args)};
    wrapped.__salamatServerDashboardRouter=true;window.renderDashboard=wrapped;
  }
}
function boot(){
  addStyles();installRouters();
  const timer=setInterval(installRouters,250);setTimeout(()=>{clearInterval(timer);setInterval(installRouters,1500)},30000);
  window.addEventListener('salamat-identity-changed',installRouters);
  window.addEventListener('salamat-server-directory-refresh',()=>{invalidate();const title=String($('#pageTitle')?.textContent||'');if(title.includes('کاربران'))void renderUsers();else if(title.includes('پرونده مراقبین'))void renderCaregivers()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
