(()=>{
'use strict';
if(window.__salamatCaregiverSelfProfileV1)return;
window.__salamatCaregiverSelfProfileV1=true;

const VERSION='1.0.0';
const PROFILE_URL='/api/caregiver/platform/profile';
const AVATAR_URL='/api/caregiver/platform/profile/avatar';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').trim();
const splitList=value=>(Array.isArray(value)?value:String(value||'').split(/[,،\n]/)).map(item=>text(item)).filter(Boolean);
let cachedProfile=null;
let loadingProfile=null;
let observerQueued=false;

async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
 const raw=await response.text();let payload={};
 try{payload=raw?JSON.parse(raw):{}}catch{payload={detail:raw}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.payload=payload;throw error}
 return payload;
}
function notify(title,message){try{window.toast?.(title,message)}catch{}if(!window.toast)console.info(title,message)}
function initials(name){return text(name||'م').split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function avatarMarkup(profile,size='large'){
 const name=profile?.fullName||'مراقب';
 if(profile?.avatarUrl)return `<span class="csp1-avatar ${size}"><img src="${esc(profile.avatarUrl)}?v=${encodeURIComponent(profile.avatarId||profile.updatedAt||Date.now())}" alt="${esc(name)}"></span>`;
 return `<span class="csp1-avatar ${size}">${esc(initials(name))}</span>`;
}
function value(profile,key){return esc(profile?.[key]??'')}
function selected(current,key,label){return `<option value="${esc(key)}" ${text(current)===key?'selected':''}>${esc(label)}</option>`}
function close(){$('.csp1-backdrop')?.remove()}
function caregiverActive(){
 const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;
 const role=text(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||$('#sidebarRole')?.textContent).toUpperCase();
 return role==='CAREGIVER'||text($('#sidebarRole')?.textContent).includes('مراقب');
}
function setBusy(button,busy,busyText,normalText){if(!button)return;button.disabled=busy;button.textContent=busy?busyText:normalText}
function addStyles(){
 if($('#caregiverSelfProfileV1Styles'))return;
 const style=document.createElement('style');style.id='caregiverSelfProfileV1Styles';style.textContent=`
.csp1-profile-trigger{cursor:pointer!important}.csp1-profile-trigger:focus-visible{outline:3px solid rgba(8,136,72,.22);outline-offset:4px}.csp1-quick{display:inline-grid;place-items:center;width:28px;height:28px;margin-inline-start:7px;border:1px solid #d9e7df;border-radius:9px;background:#fff;color:#087847;font:inherit;font-size:14px;font-weight:900;cursor:pointer;vertical-align:middle}.csp1-quick:hover{background:#edf8f2}.csp1-avatar{display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#dff3e8;color:#087a45;font-weight:900}.csp1-avatar.small{width:42px;height:42px;font-size:13px}.csp1-avatar.large{width:118px;height:118px;border-radius:30px;font-size:30px}.csp1-avatar img{width:100%;height:100%;object-fit:cover}.csp1-backdrop{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;padding:18px;background:rgba(7,30,19,.62);direction:rtl}.csp1-modal{width:min(1120px,100%);max-height:95vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border-radius:27px;background:#fff;box-shadow:0 34px 100px rgba(0,0,0,.3)}.csp1-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 23px;border-bottom:1px solid #e5eee9}.csp1-head h2{margin:0;font-size:20px}.csp1-head p{margin:7px 0 0;color:#6e7f76;font-size:9px;line-height:1.9}.csp1-close{width:38px;height:38px;border:0;border-radius:12px;background:#eef4f1;color:#40564a;font:inherit;font-size:20px;cursor:pointer}.csp1-body{overflow:auto;padding:18px 22px;background:#f8fbf9}.csp1-loading,.csp1-error{min-height:330px;display:grid;place-items:center;align-content:center;gap:10px;border:1px dashed #cfe0d7;border-radius:20px;background:#fff;color:#66776e;text-align:center;padding:25px}.csp1-loading i{width:32px;height:32px;border:3px solid #dcece4;border-top-color:#078848;border-radius:50%;animation:csp1spin .8s linear infinite}.csp1-error{color:#9d3041;background:#fff8f8;border-color:#efcfd5}.csp1-error strong{font-size:13px}.csp1-error small{font-size:9px;line-height:1.9}@keyframes csp1spin{to{transform:rotate(360deg)}}.csp1-form{display:grid;gap:13px}.csp1-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;padding:18px;border:1px solid #dce8e2;border-radius:20px;background:#fff}.csp1-photo-copy h3{margin:0 0 6px;font-size:14px}.csp1-photo-copy p{margin:0 0 12px;color:#6f7f77;font-size:9px;line-height:1.9}.csp1-photo-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.csp1-photo-actions input{max-width:350px;font:inherit;font-size:9px}.csp1-section{padding:17px;border:1px solid #dce8e2;border-radius:20px;background:#fff}.csp1-section h3{margin:0 0 14px;font-size:13px;color:#153c29}.csp1-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.csp1-field{display:grid;align-content:start;gap:6px;color:#40564a;font-size:9px;font-weight:900}.csp1-field input,.csp1-field select,.csp1-field textarea{width:100%;box-sizing:border-box;border:1px solid #d6e4dc;border-radius:11px;padding:10px 11px;background:#fff;color:#193627;font:inherit;outline:none}.csp1-field input:focus,.csp1-field select:focus,.csp1-field textarea:focus{border-color:#15945a;box-shadow:0 0 0 3px #e3f5eb}.csp1-field textarea{min-height:95px;resize:vertical;line-height:1.9}.csp1-field.wide{grid-column:1/-1}.csp1-field.double{grid-column:span 2}.csp1-help{color:#78877f;font-size:7px;font-weight:500;line-height:1.7}.csp1-status{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.csp1-status article{padding:12px;border-radius:13px;background:#f3f8f5}.csp1-status small{display:block;color:#75857d;font-size:7px}.csp1-status strong{display:block;margin-top:6px;color:#17673f;font-size:10px}.csp1-note{padding:11px 13px;border:1px solid #d6eadf;border-radius:13px;background:#eef8f2;color:#286746;font-size:8px;line-height:1.9}.csp1-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 22px;border-top:1px solid #e5eee9;background:#fff}.csp1-actions span{color:#718078;font-size:8px}.csp1-actions div{display:flex;gap:8px}.csp1-btn{border:0;border-radius:11px;padding:11px 16px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.csp1-btn.primary{background:#078848;color:#fff}.csp1-btn.soft{background:#edf3f0;color:#42584c}.csp1-btn:disabled{opacity:.55;cursor:wait}@media(max-width:900px){.csp1-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.csp1-field.double{grid-column:1/-1}.csp1-status{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.csp1-backdrop{padding:0}.csp1-modal{height:100%;max-height:none;border-radius:0}.csp1-body{padding:13px}.csp1-hero{grid-template-columns:1fr;text-align:center}.csp1-avatar.large{margin:auto}.csp1-photo-actions{justify-content:center}.csp1-grid,.csp1-status{grid-template-columns:1fr}.csp1-field.wide,.csp1-field.double{grid-column:auto}.csp1-actions{align-items:stretch;flex-direction:column}.csp1-actions div{width:100%}.csp1-btn{flex:1}}
`;(document.head||document.documentElement).appendChild(style)
}
function profileForm(profile){
 const specialties=splitList(profile.specialties).join('، '),shifts=splitList(profile.acceptedShifts||profile.shiftServices).join('، ');
 return `<form class="csp1-form" id="csp1Form">
  <section class="csp1-hero"><div id="csp1AvatarPreview">${avatarMarkup(profile)}</div><div class="csp1-photo-copy"><h3>تصویر پروفایل</h3><p>تصویر شما در پنل مراقب، پرونده مراقبین و بخش کاربران و دسترسی‌های مدیر به‌صورت واحد نمایش داده می‌شود.</p><div class="csp1-photo-actions"><input id="csp1AvatarInput" type="file" accept="image/jpeg,image/png,image/webp"><button class="csp1-btn soft" type="button" id="csp1AvatarUpload">بارگذاری تصویر</button></div></div></section>
  <section class="csp1-section"><h3>وضعیت پرونده</h3><div class="csp1-status"><article><small>شماره پرونده</small><strong>${value(profile,'membershipCode')||'—'}</strong></article><article><small>وضعیت حساب</small><strong>${value(profile,'accountStatus')||'—'}</strong></article><article><small>وضعیت پرونده</small><strong>${value(profile,'fileStatus')||'—'}</strong></article><article><small>تکمیل پروفایل</small><strong>${profile.profileCompleted?'تکمیل‌شده':'نیازمند تکمیل'}</strong></article></div></section>
  <section class="csp1-section"><h3>اطلاعات حساب ورود</h3><div class="csp1-grid"><label class="csp1-field">نام کاربری<input name="username" value="${value(profile,'username')}" required autocomplete="username"></label><label class="csp1-field double">رمز عبور جدید<input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="فقط برای تغییر رمز وارد شود"><span class="csp1-help">در صورت خالی ماندن، رمز فعلی تغییر نمی‌کند.</span></label></div></section>
  <section class="csp1-section"><h3>اطلاعات هویتی و تماس</h3><div class="csp1-grid">
   <label class="csp1-field">نام<input name="firstName" value="${value(profile,'firstName')}" required></label><label class="csp1-field">نام خانوادگی<input name="lastName" value="${value(profile,'lastName')}" required></label><label class="csp1-field">نام کامل<input name="fullName" value="${value(profile,'fullName')}" required></label>
   <label class="csp1-field">نام پدر<input name="fatherName" value="${value(profile,'fatherName')}"></label><label class="csp1-field">کد ملی<input name="nationalId" value="${value(profile,'nationalId')}" inputmode="numeric" maxlength="10" pattern="[0-9]{10}" required></label><label class="csp1-field">شماره همراه<input name="mobile" value="${value(profile,'mobile')}" inputmode="tel" pattern="09[0-9]{9}" maxlength="11" required></label>
   <label class="csp1-field">تلفن ثابت<input name="landline" value="${value(profile,'landline')}" inputmode="tel"></label><label class="csp1-field">جنسیت<select name="gender"><option value="">انتخاب نشده</option>${selected(profile.gender,'زن','زن')}${selected(profile.gender,'مرد','مرد')}${selected(profile.gender,'سایر','سایر')}</select></label><label class="csp1-field">تاریخ تولد<input name="birthDate" value="${value(profile,'birthDate')}" placeholder="مثلاً ۱۳۷۰/۰۵/۱۲"></label>
   <label class="csp1-field">سن<input name="age" value="${value(profile,'age')}" inputmode="numeric" type="number" min="18" max="100"></label><label class="csp1-field">گروه سنی<input name="ageGroup" value="${value(profile,'ageGroup')}" placeholder="مثلاً ۳۰ تا ۴۰ سال"></label><label class="csp1-field">لهجه<input name="dialect" value="${value(profile,'dialect')}"></label>
  </div></section>
  <section class="csp1-section"><h3>آدرس، تخصص و نحوه همکاری</h3><div class="csp1-grid">
   <label class="csp1-field">محدوده سکونت<input name="homeRegion" value="${value(profile,'homeRegion')}" required></label><label class="csp1-field double">محدوده فعالیت و آدرس خدمت‌رسانی<input name="activityRegion" value="${value(profile,'activityRegion')}" required></label>
   <label class="csp1-field">تخصص اصلی<input name="primaryType" value="${value(profile,'primaryType')}" required></label><label class="csp1-field double">تمام تخصص‌ها<input name="specialties" value="${esc(specialties)}" placeholder="مثلاً مراقبت سالمند، بیمار، کودک"><span class="csp1-help">چند تخصص را با ویرگول از هم جدا کنید.</span></label>
   <label class="csp1-field wide">شیفت‌ها و خدمات پذیرفته‌شده<input name="acceptedShifts" value="${esc(shifts)}" placeholder="مثلاً روزانه، شبانه، شبانه‌روزی، همراه بیمار"></label>
   <label class="csp1-field">کمک مادر<input name="motherAssistant" value="${value(profile,'motherAssistant')}"></label><label class="csp1-field">وضعیت اشتغال<input name="employed" value="${value(profile,'employed')}"></label><label class="csp1-field wide">سوابق کاری و توضیحات<textarea name="workHistory">${value(profile,'workHistory')}</textarea></label>
  </div></section>
  <div class="csp1-note">تغییرات هویتی، تماس، تخصص و حساب ورود در یک تراکنش روی پرونده مراقب و حساب کاربری ذخیره می‌شود؛ بنابراین نام، تلفن و تصویر در پنل مدیر و بخش کاربران و دسترسی‌ها نیز یکسان خواهند بود.</div>
 </form>`;
}
function modalShell(){
 const wrap=document.createElement('div');wrap.className='csp1-backdrop';wrap.innerHTML=`<section class="csp1-modal" role="dialog" aria-modal="true" aria-labelledby="csp1Title"><header class="csp1-head"><div><h2 id="csp1Title">پروفایل من</h2><p>ویرایش اطلاعات هویتی، تماس، تخصص، تصویر و حساب ورود</p></div><button class="csp1-close" type="button" aria-label="بستن">×</button></header><div class="csp1-body"><div class="csp1-loading"><i></i><strong>در حال دریافت اطلاعات پروفایل...</strong></div></div><footer class="csp1-actions"><span>فیلدهای مدیریتی مانند وضعیت پرونده و دسترسی‌ها فقط توسط مدیر تغییر می‌کنند.</span><div><button class="csp1-btn soft" type="button" data-csp1-close>انصراف</button><button class="csp1-btn primary" type="button" id="csp1Save" disabled>ذخیره تغییرات</button></div></footer></section>`;return wrap;
}
async function loadProfile(force=false){
 if(cachedProfile&&!force)return cachedProfile;
 if(loadingProfile&&!force)return loadingProfile;
 loadingProfile=api(PROFILE_URL).then(payload=>{cachedProfile=payload.data||null;if(cachedProfile)applyIdentity(cachedProfile);return cachedProfile}).finally(()=>{loadingProfile=null});
 return loadingProfile;
}
function formPayload(form){
 const raw=Object.fromEntries(new FormData(form).entries());
 return {
  firstName:text(raw.firstName),lastName:text(raw.lastName),fullName:text(raw.fullName),fatherName:text(raw.fatherName),
  nationalId:text(raw.nationalId),mobile:text(raw.mobile),landline:text(raw.landline),gender:text(raw.gender),birthDate:text(raw.birthDate),
  age:text(raw.age),ageGroup:text(raw.ageGroup),dialect:text(raw.dialect),homeRegion:text(raw.homeRegion),activityRegion:text(raw.activityRegion),
  primaryType:text(raw.primaryType),specialties:splitList(raw.specialties),acceptedShifts:splitList(raw.acceptedShifts),motherAssistant:text(raw.motherAssistant),
  employed:text(raw.employed),workHistory:text(raw.workHistory),username:text(raw.username),password:text(raw.password),
 };
}
async function save(root){
 const form=$('#csp1Form',root);if(!form||!form.reportValidity())return;
 const button=$('#csp1Save',root);setBusy(button,true,'در حال ذخیره...','ذخیره تغییرات');
 try{
  const payload=await api(PROFILE_URL,{method:'PATCH',body:JSON.stringify(formPayload(form))});
  cachedProfile=payload.data||cachedProfile;applyIdentity(cachedProfile);close();
  window.dispatchEvent(new CustomEvent('salamat-caregiver-profile-updated',{detail:{caregiverId:cachedProfile?.id,profile:cachedProfile}}));
  window.dispatchEvent(new CustomEvent('salamat-access-changed',{detail:{source:'caregiver-self-profile'}}));
  try{await window.SalamatCaregiverCanonicalRouteOwner?.reload?.()}catch{}
  notify('پروفایل به‌روزرسانی شد','اطلاعات در پرونده مراقب و حساب کاربری به‌صورت یکپارچه ذخیره شد.');
 }catch(error){notify('ذخیره انجام نشد',error.message||String(error));setBusy(button,false,'در حال ذخیره...','ذخیره تغییرات')}
}
async function uploadAvatar(root){
 const input=$('#csp1AvatarInput',root),file=input?.files?.[0];if(!file){notify('تصویر پروفایل','ابتدا یک تصویر انتخاب کنید.');return}
 const button=$('#csp1AvatarUpload',root);setBusy(button,true,'در حال بارگذاری...','بارگذاری تصویر');
 try{
  const payload=await api(AVATAR_URL,{method:'POST',headers:{'content-type':file.type,'x-file-size':String(file.size)},body:file});
  cachedProfile={...(cachedProfile||{}),avatarId:payload.data?.id,avatarUrl:payload.data?.url,updatedAt:payload.data?.updatedAt};
  $('#csp1AvatarPreview',root).innerHTML=avatarMarkup(cachedProfile);applyIdentity(cachedProfile);
  window.dispatchEvent(new CustomEvent('salamat-caregiver-profile-updated',{detail:{caregiverId:cachedProfile?.id,profile:cachedProfile}}));
  notify('تصویر ثبت شد','تصویر پروفایل در تمام بخش‌های سامانه به‌روزرسانی شد.');
 }catch(error){notify('بارگذاری انجام نشد',error.message||String(error))}
 finally{setBusy(button,false,'در حال بارگذاری...','بارگذاری تصویر')}
}
async function open(){
 if(!caregiverActive())return;
 addStyles();close();const root=modalShell();document.body.appendChild(root);
 $('.csp1-close',root).onclick=close;$('[data-csp1-close]',root).onclick=close;root.addEventListener('click',event=>{if(event.target===root)close()});
 try{
  const profile=await loadProfile(true);if(!profile)throw new Error('پرونده مراقب پیدا نشد.');
  $('.csp1-body',root).innerHTML=profileForm(profile);const saveButton=$('#csp1Save',root);saveButton.disabled=false;saveButton.onclick=()=>save(root);$('#csp1AvatarUpload',root).onclick=()=>uploadAvatar(root);
  const first=$('[name="firstName"]',root),last=$('[name="lastName"]',root),full=$('[name="fullName"]',root);
  const syncName=()=>{if(full&&(!full.dataset.touched||!text(full.value)))full.value=`${text(first?.value)} ${text(last?.value)}`.trim()};first?.addEventListener('input',syncName);last?.addEventListener('input',syncName);full?.addEventListener('input',()=>{full.dataset.touched='1'});
 }catch(error){$('.csp1-body',root).innerHTML=`<div class="csp1-error"><strong>پروفایل دریافت نشد</strong><small>${esc(error.message||String(error))}</small><button class="csp1-btn primary" type="button" data-csp1-retry>تلاش مجدد</button></div>`;$('[data-csp1-retry]',root).onclick=()=>open()}
}
function applyAvatar(selector,profile){
 const node=$(selector);if(!node)return;
 const name=profile?.fullName||'مراقب';
 if(profile?.avatarUrl)node.innerHTML=`<img src="${esc(profile.avatarUrl)}?v=${encodeURIComponent(profile.avatarId||profile.updatedAt||Date.now())}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
 else node.textContent=initials(name);
}
function applyIdentity(profile){
 if(!profile)return;const name=profile.fullName||'مراقب';
 [['#topName',name],['#sidebarName',name]].forEach(([selector,value])=>{const node=$(selector);if(node)node.textContent=value});
 applyAvatar('#topAvatar',profile);applyAvatar('#sidebarAvatar',profile);bindTriggers();
}
function triggerNodes(){return ['#topName','#topRole','#topAvatar','#sidebarName','#sidebarRole','#sidebarAvatar'].map(selector=>$(selector)).filter(Boolean)}
function bindTriggers(){
 if(!caregiverActive())return;addStyles();
 triggerNodes().forEach(node=>{node.classList.add('csp1-profile-trigger');node.dataset.csp1Open='1';node.title='ویرایش پروفایل';if(!node.hasAttribute('tabindex'))node.tabIndex=0});
 const topName=$('#topName'),host=topName?.parentElement;
 if(host&&!$('#caregiverProfileQuickEdit',host)){
  const button=document.createElement('button');button.id='caregiverProfileQuickEdit';button.className='csp1-quick';button.type='button';button.dataset.csp1Open='1';button.title='ویرایش پروفایل';button.setAttribute('aria-label','ویرایش پروفایل');button.textContent='✎';host.appendChild(button);
 }
}
function clickCapture(event){
 const trigger=event.target?.closest?.('[data-csp1-open]');if(!trigger||!caregiverActive())return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void open();
}
function keyCapture(event){if(!['Enter',' '].includes(event.key))return;const trigger=event.target?.closest?.('[data-csp1-open]');if(trigger){event.preventDefault();void open()}}
function queueBind(){if(observerQueued)return;observerQueued=true;queueMicrotask(()=>{observerQueued=false;bindTriggers()})}
function boot(){
 addStyles();document.addEventListener('click',clickCapture,true);document.addEventListener('keydown',keyCapture,true);
 window.addEventListener('salamat-authenticated',()=>setTimeout(()=>{bindTriggers();void loadProfile(true).catch(()=>{})},0));
 window.addEventListener('salamat-access-ready',()=>setTimeout(()=>{bindTriggers();void loadProfile(false).catch(()=>{})},0));
 window.addEventListener('pageshow',()=>setTimeout(()=>{bindTriggers();void loadProfile(false).catch(()=>{})},0));
 new MutationObserver(queueBind).observe(document.body,{childList:true,subtree:true});
 bindTriggers();if(caregiverActive())void loadProfile(false).catch(()=>{});
 window.SalamatCaregiverSelfProfile={version:VERSION,open,reload:()=>loadProfile(true),applyIdentity};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
