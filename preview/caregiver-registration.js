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

(()=>{
'use strict';
const VIDEO_SRC='./media/caregiver-club-intro.mp4?v=1.0.0';
const STYLE_ID='salamat-login-intro-video-style';
const SECTION_ID='loginIntroVideoShowcase';

function installStyles(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');
 style.id=STYLE_ID;
 style.textContent=`
 #loginView.login-page{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:26px;min-height:100vh;overflow:auto}
 .login-intro-video{position:relative;width:min(1500px,100%);display:grid;grid-template-columns:minmax(0,1.1fr) minmax(340px,.9fr);align-items:stretch;overflow:hidden;border:1px solid rgba(8,116,63,.13);border-radius:30px;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(239,248,243,.98));box-shadow:0 24px 70px rgba(26,74,51,.13);isolation:isolate}
 .login-intro-video:before{content:"";position:absolute;inset:auto -90px -120px auto;width:340px;height:340px;border-radius:50%;background:rgba(225,38,38,.07);z-index:-1}
 .login-intro-copy{padding:42px 46px;display:flex;flex-direction:column;justify-content:center;gap:18px}
 .login-intro-kicker{display:inline-flex;align-items:center;gap:9px;width:max-content;padding:8px 13px;border-radius:999px;background:rgba(8,116,63,.09);color:#08743f;font-size:13px;font-weight:800}
 .login-intro-kicker i{width:8px;height:8px;border-radius:50%;background:#e12626;box-shadow:0 0 0 5px rgba(225,38,38,.09)}
 .login-intro-copy h2{margin:0;color:#153c2b;font-size:clamp(25px,2.4vw,38px);line-height:1.4;letter-spacing:-.7px}
 .login-intro-copy>p{margin:0;color:#62776c;font-size:15px;line-height:2;max-width:650px}
 .login-intro-benefits{display:flex;flex-wrap:wrap;gap:10px}
 .login-intro-benefits span{display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border-radius:12px;border:1px solid rgba(8,116,63,.11);background:#fff;color:#315444;font-size:13px;font-weight:750}
 .login-intro-benefits span:before{content:"✓";display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#e8f5ed;color:#08743f;font-weight:900}
 .login-intro-actions{display:flex;align-items:center;flex-wrap:wrap;gap:13px;margin-top:2px}
 .login-intro-cta{border:0;border-radius:14px;padding:13px 19px;background:linear-gradient(135deg,#08743f,#0b8c4d);color:#fff;font:inherit;font-size:14px;font-weight:850;cursor:pointer;box-shadow:0 12px 26px rgba(8,116,63,.22);transition:transform .2s ease,box-shadow .2s ease}
 .login-intro-cta:hover{transform:translateY(-2px);box-shadow:0 16px 32px rgba(8,116,63,.27)}
 .login-intro-sound{display:flex;align-items:center;gap:7px;color:#75877e;font-size:12px}
 .login-intro-sound:before{content:"◉";color:#e12626;font-size:10px}
 .login-intro-player{position:relative;min-height:390px;background:linear-gradient(145deg,#0c3423,#061e15);overflow:hidden}
 .login-intro-player video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#071d14;opacity:0;transition:opacity .35s ease}
 .login-intro-player.is-ready video{opacity:1}
 .login-intro-player:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(5,30,20,.18),transparent 36%,transparent 70%,rgba(5,30,20,.08))}
 .login-intro-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px;text-align:center;color:#fff;background:radial-gradient(circle at 70% 25%,rgba(27,154,88,.38),transparent 36%),linear-gradient(145deg,#0c3423,#061e15);transition:opacity .3s ease}
 .login-intro-player.is-ready .login-intro-placeholder{opacity:0;pointer-events:none}
 .login-intro-placeholder img{width:150px;max-width:48%;filter:drop-shadow(0 8px 18px rgba(0,0,0,.24));background:#fff;border-radius:17px;padding:12px}
 .login-intro-placeholder strong{font-size:18px}
 .login-intro-placeholder small{max-width:330px;color:rgba(255,255,255,.72);line-height:1.8}
 .login-intro-loader{width:38px;height:38px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:loginIntroSpin .8s linear infinite}
 .login-intro-player.is-error .login-intro-loader{display:none}
 .login-intro-player.is-error .login-intro-placeholder small:after{content:" برای فعال‌شدن پخش، فایل ویدئو باید در مسیر رسانه سایت قرار گیرد."}
 @keyframes loginIntroSpin{to{transform:rotate(360deg)}}
 @media(max-width:980px){.login-intro-video{grid-template-columns:1fr}.login-intro-player{min-height:clamp(260px,56vw,480px);order:-1}.login-intro-copy{padding:32px}}
 @media(max-width:640px){#loginView.login-page{padding:12px!important;gap:16px}.login-intro-video{border-radius:22px}.login-intro-copy{padding:25px 21px}.login-intro-player{min-height:230px}.login-intro-copy h2{font-size:24px}.login-intro-benefits span{font-size:12px}.login-intro-actions{align-items:stretch;flex-direction:column}.login-intro-cta{width:100%}}
 @media(prefers-reduced-motion:reduce){.login-intro-cta,.login-intro-player video,.login-intro-placeholder{transition:none}.login-intro-loader{animation:none}}
 `;
 document.head.appendChild(style);
}

function installShowcase(){
 const loginView=document.getElementById('loginView');
 const shell=loginView?.querySelector('.login-shell');
 if(!loginView||!shell||document.getElementById(SECTION_ID))return;
 installStyles();
 const section=document.createElement('section');
 section.id=SECTION_ID;
 section.className='login-intro-video';
 section.setAttribute('aria-labelledby','loginIntroVideoTitle');
 section.innerHTML=`
   <div class="login-intro-copy">
     <span class="login-intro-kicker"><i></i>راهنمای پیوستن به شبکه مراقبین</span>
     <h2 id="loginIntroVideoTitle">در کمتر از یک دقیقه با مسیر عضویت آشنا شوید</h2>
     <p>مراحل ثبت‌نام، تکمیل پروفایل حرفه‌ای و پیوستن به شبکه مراقبین سلامت اول را در این ویدئو ببینید و همین حالا مسیر حرفه‌ای خود را آغاز کنید.</p>
     <div class="login-intro-benefits"><span>قرارداد رسمی</span><span>امنیت شغلی</span><span>تسهیلات و پاداش معرفی</span><span>شبکه حرفه‌ای مراقبین</span></div>
     <div class="login-intro-actions">
       <button type="button" class="login-intro-cta" id="loginIntroSignupCta">ثبت‌نام در شبکه مراقبین</button>
       <span class="login-intro-sound">ویدئو خودکار و بی‌صدا شروع می‌شود؛ صدا را از کنترل پخش فعال کنید.</span>
     </div>
   </div>
   <div class="login-intro-player" id="loginIntroPlayer">
     <video id="loginIntroVideo" muted playsinline controls preload="metadata" aria-label="ویدئوی معرفی عضویت در باشگاه مراقبین سلامت اول"></video>
     <div class="login-intro-placeholder">
       <div class="login-intro-loader" aria-hidden="true"></div>
       <img src="./logo-salamat-aval.svg" alt="سلامت اول">
       <strong>ویدئوی معرفی باشگاه مراقبین</strong>
       <small>ویدئو هنگام رسیدن به این بخش به‌صورت خودکار آماده و پخش می‌شود.</small>
     </div>
   </div>`;
 shell.insertAdjacentElement('afterend',section);
 const video=section.querySelector('#loginIntroVideo');
 const player=section.querySelector('#loginIntroPlayer');
 const cta=section.querySelector('#loginIntroSignupCta');
 let sourceLoaded=false;
 const loadAndPlay=()=>{
   if(!sourceLoaded){sourceLoaded=true;video.src=VIDEO_SRC;video.load()}
   if(document.visibilityState==='visible')video.play().catch(()=>{});
 };
 video.addEventListener('loadeddata',()=>{player.classList.add('is-ready');video.play().catch(()=>{})},{once:true});
 video.addEventListener('error',()=>{player.classList.add('is-error')},{once:true});
 cta.addEventListener('click',()=>document.getElementById('openCaregiverRegistration')?.click());
 if('IntersectionObserver'in window){
   const observer=new IntersectionObserver(entries=>{
     for(const entry of entries){
       if(entry.isIntersecting&&entry.intersectionRatio>.2)loadAndPlay();
       else if(sourceLoaded&&!video.paused)video.pause();
     }
   },{threshold:[0,.2,.55]});
   observer.observe(section);
 }else loadAndPlay();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause()});
 try{window.hydrateIcons?.(section)}catch{}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installShowcase,{once:true});else installShowcase();
})();