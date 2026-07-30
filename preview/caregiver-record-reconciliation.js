(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const EVAL_UI_KEY='salamatAvalEvaluationUIV13';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const Q=[
 {code:'Q-01',title:'کیفیت ارائه خدمات'},
 {code:'Q-02',title:'رضایت خدمت‌گیرنده و خانواده'},
 {code:'Q-03',title:'رعایت کرامت و حقوق خدمت‌گیرنده'},
 {code:'Q-04',title:'اخلاق و رفتار حرفه‌ای'},
 {code:'Q-05',title:'انضباط شغلی'},
 {code:'Q-06',title:'رعایت استانداردهای سلامت اول'},
 {code:'Q-07',title:'همکاری سازمانی'},
 {code:'Q-08',title:'توسعه حرفه‌ای و مشارکت آموزشی'}
];
const $=(selector,root=document)=>root.querySelector(selector);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const normalize=value=>String(value||'').trim().toLowerCase();
const mobile=value=>String(value||'').replace(/\D/g,'').replace(/^98(?=9)/,'0');
const digits=value=>String(value||'').replace(/\D/g,'');
const uid=prefix=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const nowFa=()=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date());
let running=false;
let renderPatched=false;

function authState(){const state=read(AUTH_KEY,{users:[],audit:[]});state.users=Array.isArray(state.users)?state.users:[];state.audit=Array.isArray(state.audit)?state.audit:[];return state}
function evaluationState(){const state=read(EVAL_KEY,{caregivers:[],periods:[],events:[],training:[],complaints:[],appeals:[],correctiveActions:[],committeeDecisions:[],audit:[]});for(const key of ['caregivers','periods','events','training','complaints','appeals','correctiveActions','committeeDecisions','audit'])state[key]=Array.isArray(state[key])?state[key]:[];return state}
function nextCaregiverId(state){let max=0;for(const care of state.caregivers){const match=String(care.id||'').match(/CP-(?:\d{4}-)?(\d+)$/i);if(match)max=Math.max(max,Number(match[1]||0))}let id='';do{id=`CP-1405-${String(++max).padStart(4,'0')}`}while(state.caregivers.some(item=>item.id===id));return id}
function blankCriterion(item){return {code:item.code,title:item.title,status:'نیازمند بررسی تکمیلی',score:null,notes:'',criterionRatings:{},evidence:[],updatedAt:null}}
function createInitialPeriod(caregiverId){return {id:uid('EV'),caregiverId,policyVersion:'SAB-BB-1405-V1.3',title:'دوره ارزیابی اولیه',start:'',end:'',status:'پیش‌نویس',assessor:'کارشناس ارزیابی منابع انسانی',reviewer:'مسئول ارزیابی منابع انسانی',criteria:Object.fromEntries(Q.map(item=>[item.code,blankCriterion(item)])),createdAt:nowFa(),submittedAt:null,finalizedAt:null,finalScore:null}}
function accountNationalId(user){return digits(user.nationalId||user.profile?.nationalId||'')}
function candidateMatches(user,state,claimed){
 const available=state.caregivers.filter(care=>!claimed.has(care.id));
 if(user.caregiverId){const exact=available.find(care=>care.id===user.caregiverId);if(exact)return exact}
 const userMobile=mobile(user.mobile);if(userMobile){const matches=available.filter(care=>mobile(care.phone)===userMobile);if(matches.length===1)return matches[0]}
 const nationalId=accountNationalId(user);if(nationalId){const matches=available.filter(care=>digits(care.nationalId)===nationalId);if(matches.length===1)return matches[0]}
 const email=normalize(user.email||user.username);if(email){const matches=available.filter(care=>normalize(care.profile?.email||care.email)===email);if(matches.length===1)return matches[0]}
 const name=normalize(user.name);if(name){const matches=available.filter(care=>normalize(care.name)===name);if(matches.length===1)return matches[0]}
 return null;
}
function mergeProfile(user,care){
 const source=user.profile&&typeof user.profile==='object'?user.profile:{};
 care.profile={...(care.profile||{})};
 const fields=['city','birthDate','skills','address','bio','adminNote'];
 for(const field of fields)if(!care.profile[field]&&source[field])care.profile[field]=source[field];
 const photo=String(care.profile.photo||user.photo||source.photo||'');
 if(photo){care.profile.photo=photo;user.photo=photo}
 if(!care.profile.email&&(user.email||user.username))care.profile.email=user.email||user.username;
}
function createCaregiverFromUser(user,state){
 const requested=String(user.caregiverId||'').trim();
 const id=requested&&!state.caregivers.some(item=>item.id===requested)?requested:nextCaregiverId(state);
 const source=user.profile&&typeof user.profile==='object'?user.profile:{};
 const care={
  id,name:String(user.name||'مراقب بدون نام').trim(),phone:String(user.mobile||''),nationalId:accountNationalId(user),serviceGroup:String(user.serviceGroup||source.serviceGroup||'مراقبت سالمند'),
  fileStatus:user.status==='approved'?'CP-03 نیازمند تکمیل مدارک':'در انتظار تأیید مدیر',createdAt:user.createdAt||new Date().toISOString(),
  rank:{code:'',title:'در انتظار ارزیابی',stars:0,performanceScore:null,calculatedFrom:'Q'},
  license:{number:'',status:'ثبت نشده',issuedAt:'',expiresAt:''},
  profile:{...source,photo:String(user.photo||source.photo||''),email:user.email||user.username||'',registrationSource:user.source||'admin-user-migration'}
 };
 state.caregivers.push(care);state.periods.push(createInitialPeriod(id));return care;
}
function ensureCaregiverShape(user,care,state){
 let changed=false;
 if(!care.name&&user.name){care.name=user.name;changed=true}
 if(!care.phone&&user.mobile){care.phone=user.mobile;changed=true}
 const nationalId=accountNationalId(user);if(!care.nationalId&&nationalId){care.nationalId=nationalId;changed=true}
 if(!care.serviceGroup){care.serviceGroup=user.serviceGroup||user.profile?.serviceGroup||'مراقبت سالمند';changed=true}
 if(!care.fileStatus){care.fileStatus=user.status==='approved'?'CP-03 نیازمند تکمیل مدارک':'در انتظار تأیید مدیر';changed=true}
 if(!care.rank){care.rank={code:'',title:'در انتظار ارزیابی',stars:0,performanceScore:null,calculatedFrom:'Q'};changed=true}
 if(!care.license){care.license={number:'',status:'ثبت نشده',issuedAt:'',expiresAt:''};changed=true}
 const before=JSON.stringify([care.profile,user.photo]);mergeProfile(user,care);if(before!==JSON.stringify([care.profile,user.photo]))changed=true;
 if(!state.periods.some(period=>period.caregiverId===care.id)){state.periods.push(createInitialPeriod(care.id));changed=true}
 return changed;
}
function setSelectedCaregiver(id){
 if(!id)return;const ui=read(EVAL_UI_KEY,{}),work=read(WORK_KEY,{ui:{}});work.ui=work.ui||{};
 if(!ui.caregiverId)ui.caregiverId=id;if(!work.ui.caregiverId)work.ui.caregiverId=id;
 write(EVAL_UI_KEY,ui);write(WORK_KEY,work);
}
function reconcileCaregiverRecords({notify=true}={}){
 if(running)return {changed:false,created:0,linked:0};running=true;
 try{
  const access=authState(),state=evaluationState(),claimed=new Set();let authChanged=false,evalChanged=false,created=0,linked=0;
  for(const user of access.users.filter(item=>item.role==='caregiver')){
   let care=candidateMatches(user,state,claimed);
   if(!care){care=createCaregiverFromUser(user,state);created+=1;evalChanged=true}
   claimed.add(care.id);
   if(user.caregiverId!==care.id){user.caregiverId=care.id;authChanged=true;linked+=1}
   if(ensureCaregiverShape(user,care,state))evalChanged=true;
   const canonicalPhoto=String(care.profile?.photo||user.photo||'');
   if(String(user.photo||'')!==canonicalPhoto){user.photo=canonicalPhoto;authChanged=true}
  }
  if(created||linked){
   const detail=`${created.toLocaleString('fa-IR')} پرونده ایجاد و ${linked.toLocaleString('fa-IR')} حساب متصل شد.`;
   access.audit.unshift({at:nowFa(),action:'همگام‌سازی حساب و پرونده مراقب',detail});
   state.audit.unshift({id:uid('AUD-REC'),at:nowFa(),action:'بازسازی ارتباط حساب و پرونده',detail});
   access.audit=access.audit.slice(0,300);state.audit=state.audit.slice(0,300);authChanged=true;evalChanged=true;
  }
  if(authChanged)write(AUTH_KEY,access);if(evalChanged)write(EVAL_KEY,state);
  const first=state.caregivers[0];if(first)setSelectedCaregiver(first.id);
  const changed=authChanged||evalChanged;
  if(changed){
   window.dispatchEvent(new CustomEvent('salamat-caregiver-records-reconciled',{detail:{created,linked}}));
   if(notify&&created)try{window.toast?.('پرونده‌های مراقبین همگام شد',`${created.toLocaleString('fa-IR')} پرونده مفقود از روی حساب‌های مراقبین بازسازی شد.`)}catch{}
  }
  return {changed,created,linked};
 }finally{running=false}
}
function refreshCurrentModule(){
 const title=String($('#pageTitle')?.textContent||'').trim();if(!['کاربران و دسترسی‌ها','پرونده حرفه‌ای مراقبین','ارزیابی و پروانه'].includes(title))return;
 const active=$('#sidebarNav .nav-item.active');if(active)setTimeout(()=>active.click(),0);
}
function patchRenderModule(){
 if(renderPatched)return true;let ready=false;try{ready=typeof renderModule==='function'}catch{}if(!ready)return false;
 renderPatched=true;const previous=renderModule;
 renderModule=function(roleModel,module){const label=String(module?.[1]||'');if(['کاربران و دسترسی‌ها','پرونده حرفه‌ای مراقبین','پرونده مراقبین','ارزیابی و پروانه'].includes(label))reconcileCaregiverRecords({notify:false});return previous.apply(this,arguments)};
 return true;
}
function boot(){
 const result=reconcileCaregiverRecords({notify:false});if(result.changed)setTimeout(refreshCurrentModule,30);
 let attempts=0;const timer=setInterval(()=>{attempts+=1;if(patchRenderModule()||attempts>160)clearInterval(timer)},50);
 document.addEventListener('submit',event=>{if(['unifiedAccountProfileForm','caregiverSignupForm','p3UserProfileForm'].includes(event.target?.id))setTimeout(()=>{const outcome=reconcileCaregiverRecords({notify:false});if(outcome.changed)refreshCurrentModule()},80)},true);
 ['salamat-access-changed','salamat-evaluation-changed'].forEach(name=>window.addEventListener(name,()=>setTimeout(()=>{const outcome=reconcileCaregiverRecords({notify:false});if(outcome.changed)refreshCurrentModule()},40)));
 window.addEventListener('storage',event=>{if([AUTH_KEY,EVAL_KEY].includes(event.key))setTimeout(()=>{const outcome=reconcileCaregiverRecords({notify:false});if(outcome.changed)refreshCurrentModule()},20)});
 window.reconcileSalamatCaregiverRecords=reconcileCaregiverRecords;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();