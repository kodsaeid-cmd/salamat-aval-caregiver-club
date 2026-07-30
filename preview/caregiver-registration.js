(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const $=(selector,root=document)=>root.querySelector(selector);
const normalizeMobile=value=>String(value||'').replace(/\D/g,'').replace(/^98(?=9)/,'0');
const normalize=value=>String(value||'').trim().toLowerCase();
const userId=()=>`USR-CARE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const initialState=()=>({users:[
 {id:'SYS-ADMIN',name:'مدیر سامانه',username:'admin',password:'admin',email:'admin@salamataval.ir',mobile:'',role:'admin',status:'approved',createdAt:'حساب اولیه سامانه'},
 {id:'USR-CARE-001',name:'مریم حسینی',username:'maryam',password:'123456',email:'maryam@salamataval.ir',mobile:'09128668837',role:'caregiver',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-REC-001',name:'مهدی رضایی',username:'recruiter',password:'123456',email:'recruitment@salamataval.ir',mobile:'09120000001',role:'recruiter',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-HR-001',name:'سارا محمدی',username:'hr',password:'123456',email:'hr@salamataval.ir',mobile:'09120000002',role:'hr',status:'pending',createdAt:'نمونه اولیه'}
],audit:[]});
function loadAuth(){try{const state=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');if(state?.users?.length)return state}catch{}const state=initialState();localStorage.setItem(AUTH_KEY,JSON.stringify(state));return state}
function loadEvaluation(){try{const state=JSON.parse(localStorage.getItem(EVAL_KEY)||'null');if(state){state.caregivers||=[];state.periods||=[];state.events||=[];state.training||=[];state.complaints||=[];state.appeals||=[];state.correctiveActions||=[];state.committeeDecisions||=[];state.audit||=[];return state}}catch{}return {caregivers:[],periods:[],events:[],training:[],complaints:[],appeals:[],correctiveActions:[],committeeDecisions:[],audit:[]}}
function nextCaregiverId(state){let sequence=state.caregivers.length+1;let id='';do{id=`CP-1405-${String(sequence++).padStart(4,'0')}`}while(state.caregivers.some(item=>item.id===id));return id}
function timestampFa(){return new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date())}
function saveAuth(state,detail){state.audit=state.audit||[];state.audit.unshift({at:timestampFa(),action:'ثبت‌نام مراقب',detail});state.audit=state.audit.slice(0,200);localStorage.setItem(AUTH_KEY,JSON.stringify(state))}
function saveEvaluation(state,caregiver){state.audit=state.audit||[];state.audit.unshift({id:`AUD-REG-${Date.now().toString(36).toUpperCase()}`,at:timestampFa(),action:'تشکیل پرونده اولیه توسط مراقب',detail:`${caregiver.name} • ${caregiver.id}`});state.audit=state.audit.slice(0,300);localStorage.setItem(EVAL_KEY,JSON.stringify(state))}
function showError(message){const box=$('#caregiverSignupError');if(!box)return;box.textContent=message;box.classList.add('show')}
function clearError(){const box=$('#caregiverSignupError');if(!box)return;box.textContent='';box.classList.remove('show')}
function openSignup(){const layer=$('#caregiverSignupLayer');if(!layer)return;clearError();layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');document.body.classList.add('signup-open');setTimeout(()=>$('#caregiverSignupForm input[name="name"]')?.focus(),30)}
function resetSignupView(){$('#caregiverSignupFormWrap')?.classList.remove('hidden');$('#caregiverSignupSuccess')?.classList.add('hidden');$('#caregiverSignupForm')?.reset();clearError()}
function closeSignup(){const layer=$('#caregiverSignupLayer');if(!layer)return;layer.classList.add('hidden');layer.setAttribute('aria-hidden','true');document.body.classList.remove('signup-open');setTimeout(resetSignupView,180)}
function finishSignup(mobile){const caregiverButton=$('#roleOptions [data-role="caregiver"]');caregiverButton?.click();const mobileInput=$('#mobileInput');if(mobileInput)mobileInput.value=mobile;const otpInput=$('#otpInput');if(otpInput)otpInput.value='';closeSignup();setTimeout(()=>$('#mobileInput')?.focus(),20)}
function submitSignup(event){
 event.preventDefault();clearError();
 const form=event.currentTarget,data=new FormData(form);
 const name=String(data.get('name')||'').trim();
 const mobile=normalizeMobile(data.get('mobile'));
 const nationalId=String(data.get('nationalId')||'').replace(/\D/g,'');
 const email=normalize(data.get('email'));
 const serviceGroup=String(data.get('serviceGroup')||'مراقبت سالمند');
 const city=String(data.get('city')||'').trim();
 const birthDate=String(data.get('birthDate')||'').trim();
 const address=String(data.get('address')||'').trim();
 const skills=String(data.get('skills')||'').trim();
 const bio=String(data.get('bio')||'').trim();
 const password=String(data.get('password')||'');
 const confirmPassword=String(data.get('confirmPassword')||'');
 const consent=data.get('consent')==='on';
 if(name.length<3)return showError('نام و نام خانوادگی را کامل وارد کنید.');
 if(!/^09\d{9}$/.test(mobile))return showError('شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.');
 if(nationalId&&!/^\d{10}$/.test(nationalId))return showError('کد ملی باید ۱۰ رقم باشد.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showError('ایمیل سازمانی یا ایمیل ورود را به‌صورت صحیح وارد کنید.');
 if(password.length<6)return showError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
 if(password!==confirmPassword)return showError('تکرار رمز عبور با رمز عبور یکسان نیست.');
 if(!consent)return showError('برای ارسال درخواست باید صحت اطلاعات و شرط تأیید مدیر را بپذیرید.');
 const authState=loadAuth(),evaluationState=loadEvaluation();
 if(authState.users.some(user=>normalize(user.username)===email||normalize(user.email)===email))return showError('برای این ایمیل قبلاً حساب ایجاد شده است.');
 if(authState.users.some(user=>normalizeMobile(user.mobile)===mobile))return showError('برای این شماره همراه قبلاً حساب ایجاد شده است.');
 if(nationalId&&evaluationState.caregivers.some(caregiver=>String(caregiver.nationalId||'').replace(/\D/g,'')===nationalId))return showError('برای این کد ملی قبلاً پرونده مراقب تشکیل شده است.');
 const id=userId(),caregiverId=nextCaregiverId(evaluationState),createdAt=new Date().toISOString();
 const caregiver={id:caregiverId,name,phone:mobile,nationalId,serviceGroup,fileStatus:'در انتظار تأیید مدیر',createdAt,rank:{code:'',title:'در انتظار ارزیابی',stars:0,pri:null,decisionRef:'',validFrom:'',validTo:''},license:{number:'',status:'ثبت نشده',issuedAt:'',expiresAt:'',decisionRef:''},profile:{city,birthDate,address,skills,bio,registrationSource:'self-registration'}};
 evaluationState.caregivers.push(caregiver);
 authState.users.push({id,name,role:'caregiver',username:email,password,email,mobile,status:'pending',caregiverId,createdAt,source:'self-registration'});
 saveEvaluation(evaluationState,caregiver);saveAuth(authState,`${email} • ${mobile} • ${caregiverId} • pending`);
 window.dispatchEvent(new CustomEvent('salamat-access-changed',{detail:{type:'caregiver-registration',userId:id,caregiverId}}));
 window.dispatchEvent(new CustomEvent('salamat-evaluation-changed',{detail:{caregiverId}}));
 form.reset();$('#caregiverSignupFormWrap')?.classList.add('hidden');$('#caregiverSignupSuccess')?.classList.remove('hidden');
 const request=$('#caregiverSignupRequest');if(request)request.innerHTML=`<strong>کد درخواست عضویت: ${id}</strong><br><span>شناسه پرونده حرفه‌ای: ${caregiverId}</span>`;
 const returnButton=$('#caregiverSignupReturn');if(returnButton)returnButton.onclick=()=>finishSignup(mobile);
 try{window.toast?.('درخواست عضویت ثبت شد','حساب و پرونده حرفه‌ای مراقب در انتظار تأیید مدیر سامانه قرار گرفت.')}catch{}
}
function boot(){$('#openCaregiverRegistration')?.addEventListener('click',openSignup);$('#closeCaregiverSignup')?.addEventListener('click',closeSignup);$('#caregiverSignupBackdrop')?.addEventListener('click',closeSignup);$('#caregiverSignupForm')?.addEventListener('submit',submitSignup);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#caregiverSignupLayer')?.classList.contains('hidden'))closeSignup()});try{window.hydrateIcons?.($('#caregiverSignupLayer'))}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
