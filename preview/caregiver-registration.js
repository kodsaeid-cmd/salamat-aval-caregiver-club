(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const $=(selector,root=document)=>root.querySelector(selector);
const normalizeMobile=value=>String(value||'').replace(/\D/g,'').replace(/^98(?=9)/,'0');
const normalize=value=>String(value||'').trim().toLowerCase();
const uid=()=>`USR-CARE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const initialState=()=>({users:[
 {id:'SYS-ADMIN',name:'مدیر سامانه',username:'admin',password:'admin',email:'admin@salamataval.ir',mobile:'',role:'admin',status:'approved',createdAt:'حساب اولیه سامانه'},
 {id:'USR-CARE-001',name:'مریم حسینی',username:'maryam',password:'123456',email:'maryam@salamataval.ir',mobile:'09128668837',role:'caregiver',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-REC-001',name:'مهدی رضایی',username:'recruiter',password:'123456',email:'recruitment@salamataval.ir',mobile:'09120000001',role:'recruiter',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-HR-001',name:'سارا محمدی',username:'hr',password:'123456',email:'hr@salamataval.ir',mobile:'09120000002',role:'hr',status:'pending',createdAt:'نمونه اولیه'}
],audit:[]});
function loadAuth(){
 try{const state=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');if(state?.users?.length)return state}catch{}
 const state=initialState();localStorage.setItem(AUTH_KEY,JSON.stringify(state));return state;
}
function saveAuth(state,detail){
 state.audit=state.audit||[];
 state.audit.unshift({at:new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date()),action:'ثبت‌نام مراقب',detail});
 state.audit=state.audit.slice(0,200);
 localStorage.setItem(AUTH_KEY,JSON.stringify(state));
 window.dispatchEvent(new CustomEvent('salamat-access-changed',{detail:{type:'caregiver-registration'}}));
}
function showError(message){const box=$('#caregiverSignupError');if(!box)return;box.textContent=message;box.classList.add('show')}
function clearError(){const box=$('#caregiverSignupError');if(!box)return;box.textContent='';box.classList.remove('show')}
function openSignup(){
 const layer=$('#caregiverSignupLayer');if(!layer)return;
 clearError();layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');document.body.classList.add('signup-open');
 setTimeout(()=>$('#caregiverSignupForm input[name="name"]')?.focus(),30);
}
function resetSignupView(){
 $('#caregiverSignupFormWrap')?.classList.remove('hidden');
 $('#caregiverSignupSuccess')?.classList.add('hidden');
 $('#caregiverSignupForm')?.reset();
 clearError();
}
function closeSignup(){
 const layer=$('#caregiverSignupLayer');if(!layer)return;
 layer.classList.add('hidden');layer.setAttribute('aria-hidden','true');document.body.classList.remove('signup-open');
 setTimeout(resetSignupView,180);
}
function finishSignup(mobile){
 const caregiverButton=$('#roleOptions [data-role="caregiver"]');caregiverButton?.click();
 const mobileInput=$('#mobileInput');if(mobileInput)mobileInput.value=mobile;
 const otpInput=$('#otpInput');if(otpInput)otpInput.value='';
 closeSignup();
 setTimeout(()=>$('#mobileInput')?.focus(),20);
}
function submitSignup(event){
 event.preventDefault();clearError();
 const form=event.currentTarget,formData=new FormData(form);
 const name=String(formData.get('name')||'').trim();
 const mobile=normalizeMobile(formData.get('mobile'));
 const email=normalize(formData.get('email'));
 const username=normalize(formData.get('username'));
 const password=String(formData.get('password')||'');
 const confirmPassword=String(formData.get('confirmPassword')||'');
 const consent=formData.get('consent')==='on';
 if(name.length<3)return showError('نام و نام خانوادگی را کامل وارد کنید.');
 if(!/^09\d{9}$/.test(mobile))return showError('شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showError('ساختار ایمیل واردشده صحیح نیست.');
 if(!/^[a-z0-9._-]{3,32}$/.test(username))return showError('نام کاربری باید ۳ تا ۳۲ کاراکتر انگلیسی و شامل حروف، عدد، نقطه، خط تیره یا زیرخط باشد.');
 if(password.length<6)return showError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
 if(password!==confirmPassword)return showError('تکرار رمز عبور با رمز عبور یکسان نیست.');
 if(!consent)return showError('برای ارسال درخواست باید تأیید صحت اطلاعات و شرط تأیید مدیر را بپذیرید.');
 const state=loadAuth();
 if(state.users.some(user=>normalize(user.username)===username))return showError('این نام کاربری قبلاً ثبت شده است.');
 if(state.users.some(user=>normalizeMobile(user.mobile)===mobile))return showError('برای این شماره همراه قبلاً حساب ایجاد شده است.');
 if(email&&state.users.some(user=>normalize(user.email)===email))return showError('برای این ایمیل قبلاً حساب ایجاد شده است.');
 const id=uid();
 state.users.push({id,name,role:'caregiver',username,password,email,mobile,status:'pending',createdAt:new Date().toISOString(),source:'self-registration'});
 saveAuth(state,`${username} • ${mobile} • pending`);
 form.reset();
 $('#caregiverSignupFormWrap')?.classList.add('hidden');
 const success=$('#caregiverSignupSuccess');success?.classList.remove('hidden');
 const request=$('#caregiverSignupRequest');if(request)request.textContent=`کد درخواست عضویت: ${id}`;
 const returnButton=$('#caregiverSignupReturn');if(returnButton)returnButton.onclick=()=>finishSignup(mobile);
 try{window.toast?.('درخواست عضویت ثبت شد','حساب مراقب در انتظار تأیید مدیر سامانه قرار گرفت.')}catch{}
}
function boot(){
 $('#openCaregiverRegistration')?.addEventListener('click',openSignup);
 $('#closeCaregiverSignup')?.addEventListener('click',closeSignup);
 $('#caregiverSignupBackdrop')?.addEventListener('click',closeSignup);
 $('#caregiverSignupForm')?.addEventListener('submit',submitSignup);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#caregiverSignupLayer')?.classList.contains('hidden'))closeSignup()});
 try{window.hydrateIcons?.($('#caregiverSignupLayer'))}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
