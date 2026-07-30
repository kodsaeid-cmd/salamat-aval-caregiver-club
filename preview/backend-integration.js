(()=>{
'use strict';

const KEYS={
  auth:'salamatAvalAccessControlV1',
  evaluation:'salamatAvalEvaluationSystemV13',
  admin:'salamatAvalAdminWorkspaceV15',
  caregiverPanel:'salamatAvalCaregiverPanelV1',
  evaluationV1:'salamatAvalEvaluationV1',
  session:'salamatAvalSessionV1',
};
const WATCHED=new Set([KEYS.auth,KEYS.evaluation,KEYS.admin,KEYS.caregiverPanel,KEYS.evaluationV1]);
let currentUser=null;
let hydrating=false;
let saveTimer=null;
let setupInfo={adminExists:true,setupKeyConfigured:false};
const $=(selector,root=document)=>root.querySelector(selector);
const normalizeMobile=value=>String(value||'').replace(/\D/g,'').replace(/^0098/,'0').replace(/^98(?=9)/,'0').replace(/^(9\d{9})$/,'0$1');
const safeParse=(value,fallback)=>{try{return JSON.parse(value)||fallback}catch{return fallback}};
const scrub=value=>{
  if(Array.isArray(value))return value.map(scrub);
  if(!value||typeof value!=='object')return value;
  const out={};
  Object.entries(value).forEach(([key,child])=>{if(!['password','passwordHash','token','sessionToken'].includes(key))out[key]=scrub(child)});
  return out;
};
const roleKey=role=>({ADMIN:'admin',CAREGIVER:'caregiver',RECRUITER:'recruiter',HR:'hr',SUPPORT:'admin',EVALUATOR:'hr',EDUCATION:'hr',OPERATIONS:'admin'}[String(role||'').toUpperCase()]||'caregiver');
const roleLabel=role=>({ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'}[String(role||'').toUpperCase()]||String(role||''));
const initials=name=>String(name||'کاربر').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2);

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.message||'عملیات انجام نشد.');error.status=response.status;error.code=payload.error;throw error}
  return payload;
}
function notify(title,text){
  try{window.toast?.(title,text)}catch{}
  if(!window.toast&&text)console.info(title,text);
}
function showLoginError(message){
  let box=$('#backendLoginMessage');
  if(!box){box=document.createElement('div');box.id='backendLoginMessage';box.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff1f1;color:#a52323;font-size:12px;font-weight:700;line-height:1.8';$('#loginForm .primary-action')?.before(box)}
  box.textContent=message;box.hidden=false;
}
function clearLoginError(){const box=$('#backendLoginMessage');if(box)box.hidden=true}
function collectState(){return scrub({
  auth:safeParse(localStorage.getItem(KEYS.auth),{users:[],audit:[]}),
  evaluation:safeParse(localStorage.getItem(KEYS.evaluation),{}),
  admin:safeParse(localStorage.getItem(KEYS.admin),{}),
  caregiverPanel:safeParse(localStorage.getItem(KEYS.caregiverPanel),{}),
  evaluationV1:safeParse(localStorage.getItem(KEYS.evaluationV1),{}),
})}
async function saveState(){
  if(!currentUser||hydrating)return;
  try{await api('/api/state',{method:'PUT',body:JSON.stringify({state:collectState()})})}
  catch(error){console.error('D1 state save failed',error);notify('ذخیره‌سازی انجام نشد',error.message)}
}
function queueSave(){if(!currentUser||hydrating)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveState,700)}

const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  let next=value;
  if(WATCHED.has(String(key))){
    const parsed=safeParse(String(value),null);
    if(parsed)next=JSON.stringify(scrub(parsed));
  }
  nativeSetItem.call(this,key,next);
  if(this===localStorage&&WATCHED.has(String(key)))queueSave();
};

function applyState(result){
  const state=result?.data?.state||result?.state||{};
  hydrating=true;
  try{
    if(state.auth)nativeSetItem.call(localStorage,KEYS.auth,JSON.stringify(scrub(state.auth)));
    if(state.evaluation)nativeSetItem.call(localStorage,KEYS.evaluation,JSON.stringify(scrub(state.evaluation)));
    if(state.admin)nativeSetItem.call(localStorage,KEYS.admin,JSON.stringify(scrub(state.admin)));
    if(state.caregiverPanel)nativeSetItem.call(localStorage,KEYS.caregiverPanel,JSON.stringify(scrub(state.caregiverPanel)));
    if(state.evaluationV1)nativeSetItem.call(localStorage,KEYS.evaluationV1,JSON.stringify(scrub(state.evaluationV1)));
  }finally{hydrating=false}
}
function setIdentity(user){
  const key=roleKey(user.role);
  try{
    roles[key].name=user.fullName;
    roles[key].initials=initials(user.fullName);
    roles[key].role=roleLabel(user.role);
  }catch{}
  nativeSetItem.call(localStorage,KEYS.session,JSON.stringify({id:user.id,caregiverId:user.caregiverId,name:user.fullName,role:key,backend:true}));
  return key;
}
async function enterApp(user,openLabel=''){
  currentUser=user;
  const state=await api('/api/state');
  applyState(state);
  const key=setIdentity(user);
  openApp(key);
  if(openLabel)setTimeout(()=>[...document.querySelectorAll('#sidebarNav button')].find(x=>x.textContent.includes(openLabel))?.click(),60);
}
async function refresh(openLabel=''){
  if(!currentUser)return;
  await enterApp(currentUser,openLabel);
}
function setupField(){
  const emailFields=$('#emailFields');
  if(!emailFields)return;
  let wrap=$('#setupKeyWrap');
  if(!setupInfo.adminExists){
    if(!wrap){
      wrap=document.createElement('div');wrap.id='setupKeyWrap';wrap.className='field-stack';
      wrap.innerHTML='<label>کد راه‌اندازی مدیر</label><div class="input-box ltr-input"><span class="input-icon" data-icon="key"></span><input id="setupKeyInput" type="password" autocomplete="one-time-code" placeholder="Secret ثبت‌شده در Cloudflare"></div><small style="display:block;margin-top:5px;color:#718078;font-size:10px;line-height:1.7">این کد فقط برای ساخت اولین مدیر استفاده می‌شود.</small>';
      emailFields.appendChild(wrap);try{window.hydrateIcons?.(wrap)}catch{}
    }
    wrap.hidden=false;
  }else if(wrap)wrap.hidden=true;
}
async function loadSetupStatus(){
  try{setupInfo=await api('/api/setup/status');setupField()}catch(error){console.error(error)}
}

async function handleLogin(event){
  event.preventDefault();event.stopImmediatePropagation();clearLoginError();
  const submit=$('#loginForm .primary-action');if(submit)submit.disabled=true;
  try{
    let payload;
    if(selectedMethod==='mobile'){
      payload=await api('/api/auth/verify-otp',{method:'POST',body:JSON.stringify({mobile:normalizeMobile($('#mobileInput')?.value),code:String($('#otpInput')?.value||'').replace(/\D/g,'')})});
    }else{
      const identifier=String($('#emailFields input[type="email"]')?.value||'').trim().toLowerCase();
      const password=String($('#emailFields input[type="password"]')?.value||'');
      if(!setupInfo.adminExists){
        if(selectedRole!=='admin')throw new Error('برای راه‌اندازی اولیه، نوع پنل «مدیر سامانه» را انتخاب کنید.');
        const setupKey=String($('#setupKeyInput')?.value||'');
        await api('/api/setup/admin',{method:'POST',headers:{'x-setup-key':setupKey},body:JSON.stringify({fullName:'مدیر سامانه',username:identifier,email:identifier,password})});
        setupInfo.adminExists=true;setupField();
      }
      payload=await api('/api/auth/login',{method:'POST',body:JSON.stringify({identifier,password})});
    }
    await enterApp(payload.data);
  }catch(error){showLoginError(error.message)}finally{if(submit)submit.disabled=false}
}
async function handleOtp(event){
  event.preventDefault();event.stopImmediatePropagation();clearLoginError();
  const button=$('#sendOtp');if(button)button.disabled=true;
  try{
    const result=await api('/api/auth/request-otp',{method:'POST',body:JSON.stringify({mobile:normalizeMobile($('#mobileInput')?.value)})});
    if(result.debugCode&&$('#otpInput'))$('#otpInput').value=result.debugCode;
    if(button)button.textContent='ارسال مجدد';notify('کد ورود ارسال شد','کد تا پنج دقیقه معتبر است.');
  }catch(error){showLoginError(error.message)}finally{if(button)button.disabled=false}
}
async function handleLogout(event){
  event.preventDefault();event.stopImmediatePropagation();
  try{await api('/api/auth/logout',{method:'POST'})}catch{}
  currentUser=null;localStorage.removeItem(KEYS.session);location.reload();
}

async function handleRegistration(event){
  const form=event.target;if(form?.id!=='caregiverSignupForm')return;
  event.preventDefault();event.stopImmediatePropagation();
  const data=new FormData(form),password=String(data.get('password')||''),confirm=String(data.get('confirmPassword')||'');
  const errorBox=$('#caregiverSignupError');
  const show=message=>{if(errorBox){errorBox.textContent=message;errorBox.classList.add('show')}};
  if(password.length<8)return show('رمز عبور باید حداقل ۸ کاراکتر باشد.');
  if(password!==confirm)return show('تکرار رمز عبور با رمز عبور یکسان نیست.');
  const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{
    const result=await api('/api/public/caregivers/register',{method:'POST',body:JSON.stringify({
      fullName:data.get('name'),mobile:data.get('mobile'),nationalId:data.get('nationalId'),email:data.get('email'),
      serviceGroup:data.get('serviceGroup'),city:data.get('city'),birthDate:data.get('birthDate'),skills:data.get('skills'),
      password,address:data.get('address'),bio:data.get('bio'),
    })});
    $('#caregiverSignupFormWrap')?.classList.add('hidden');$('#caregiverSignupSuccess')?.classList.remove('hidden');
    const request=$('#caregiverSignupRequest');if(request)request.innerHTML=`<strong>کد درخواست عضویت: ${result.data.requestCode}</strong><br><span>شناسه پرونده حرفه‌ای: ${result.data.caregiverId}</span>`;
    const returnButton=$('#caregiverSignupReturn');if(returnButton)returnButton.onclick=()=>{
      $('#caregiverSignupLayer')?.classList.add('hidden');document.body.classList.remove('signup-open');
      const mobile=$('#mobileInput');if(mobile)mobile.value=normalizeMobile(data.get('mobile'));$('#roleOptions [data-role="caregiver"]')?.click();
    };
    form.reset();notify('درخواست عضویت ثبت شد','حساب پس از تأیید مدیر فعال می‌شود.');
  }catch(error){show(error.message)}finally{if(button)button.disabled=false}
}

async function adminUserForm(event){
  const form=event.target;if(form?.id!=='admUserForm')return false;
  event.preventDefault();event.stopImmediatePropagation();
  const data=new FormData(form),password=String(data.get('password')||'');
  if(password.length<8){notify('رمز کوتاه است','رمز باید حداقل ۸ کاراکتر باشد.');return true}
  try{
    await api('/api/users',{method:'POST',body:JSON.stringify({fullName:data.get('name'),role:data.get('role'),username:data.get('username'),password,email:data.get('email'),mobile:data.get('mobile'),status:'PENDING'})});
    await refresh('کاربران و دسترسی‌ها');notify('حساب ایجاد شد','ورود کاربر تا تأیید مدیر مسدود است.');
  }catch(error){notify('ایجاد حساب انجام نشد',error.message)}
  return true;
}
async function adminCaregiverForm(event){
  const form=event.target;if(form?.id!=='admCareForm')return false;
  event.preventDefault();event.stopImmediatePropagation();
  const data=new FormData(form),id=String(data.get('id')||'');
  const body={id,name:data.get('name'),phone:data.get('phone'),nationalId:data.get('nationalId'),serviceGroup:data.get('serviceGroup'),fileStatus:data.get('fileStatus'),city:data.get('city'),address:data.get('address')};
  try{
    await api(id?`/api/caregivers/${encodeURIComponent(id)}`:'/api/caregivers',{method:id?'PATCH':'POST',body:JSON.stringify(body)});
    await refresh('پرونده مراقبین');notify('پرونده ذخیره شد','اطلاعات در D1 ثبت شد.');
  }catch(error){notify('ذخیره پرونده انجام نشد',error.message)}
  return true;
}
async function handleAdminClick(event){
  const button=event.target.closest('[data-user-status],[data-user-reset],[data-user-delete],[data-care-status]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    if(button.dataset.userStatus){const [id,status]=button.dataset.userStatus.split('|');await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});await refresh('کاربران و دسترسی‌ها')}
    else if(button.dataset.userReset){const password=prompt('رمز عبور جدید را وارد کنید (حداقل ۸ کاراکتر)');if(!password)return;if(password.length<8)throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');await api(`/api/users/${encodeURIComponent(button.dataset.userReset)}`,{method:'PATCH',body:JSON.stringify({password})});notify('رمز تغییر کرد','رمز جدید در سرور ثبت شد.')}
    else if(button.dataset.userDelete){if(!confirm('حساب حذف شود؟'))return;await api(`/api/users/${encodeURIComponent(button.dataset.userDelete)}`,{method:'DELETE'});await refresh('کاربران و دسترسی‌ها')}
    else if(button.dataset.careStatus){const [id,status]=button.dataset.careStatus.split('|');await api(`/api/caregivers/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({fileStatus:status})});await refresh('پرونده مراقبین')}
  }catch(error){notify('عملیات انجام نشد',error.message)}
}

async function boot(){
  $('#loginForm')?.addEventListener('submit',handleLogin,true);
  $('#sendOtp')?.addEventListener('click',handleOtp,true);
  $('#logoutButton')?.addEventListener('click',handleLogout,true);
  document.addEventListener('submit',handleRegistration,true);
  document.addEventListener('submit',event=>{if(event.target?.id==='admUserForm')void adminUserForm(event);else if(event.target?.id==='admCareForm')void adminCaregiverForm(event)},true);
  document.addEventListener('click',handleAdminClick,true);
  await loadSetupStatus();
  try{const result=await api('/api/auth/me');await enterApp(result.data)}catch(error){if(error.status!==401)console.error(error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
