(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const EVAL_UI_KEY='salamatAvalEvaluationUIV13';
const SESSION_KEY='salamatAvalSessionV1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const store=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const normalize=value=>String(value||'').trim().toLowerCase();
const normalizeMobile=value=>String(value||'').replace(/\D/g,'').replace(/^98(?=9)/,'0');
const roleLabels={caregiver:'مراقب',recruiter:'کارشناس جذب',hr:'منابع انسانی',admin:'مدیر سامانه'};
const panelLabels={caregiver:'پنل مراقب',recruiter:'پنل کارشناس جذب',hr:'پنل منابع انسانی',admin:'پنل مدیر سامانه'};
let syncQueued=false;
let syncing=false;
function selectedRoleKey(){try{return typeof selectedRole==='string'?selectedRole:'caregiver'}catch{return 'caregiver'}}
function authState(){const state=parse(AUTH_KEY,{users:[],audit:[]});state.users||=[];return state}
function evaluationState(){const state=parse(EVAL_KEY,{caregivers:[]});state.caregivers||=[];return state}
function sessionState(){return parse(SESSION_KEY,{})}
function initials(name){const parts=String(name||'کاربر سلامت اول').trim().split(/\s+/).filter(Boolean);return parts.map(part=>part[0]).join('').slice(0,2)||'ک‌س'}
function findCaregiver(user,state=evaluationState()){
 if(!user)return null;
 if(user.caregiverId){const linked=state.caregivers.find(item=>item.id===user.caregiverId);if(linked)return linked}
 const mobile=normalizeMobile(user.mobile);
 if(mobile){const matches=state.caregivers.filter(item=>normalizeMobile(item.phone)===mobile);if(matches.length===1)return matches[0]}
 const byName=state.caregivers.filter(item=>normalize(item.name)===normalize(user.name));
 return byName.length===1?byName[0]:null;
}
function persistCaregiverLink(user,caregiver){
 if(!user||!caregiver||user.caregiverId===caregiver.id)return;
 const state=authState(),stored=state.users.find(item=>item.id===user.id);if(!stored)return;
 stored.caregiverId=caregiver.id;store(AUTH_KEY,state);user.caregiverId=caregiver.id;
}
function resolveLoggedInIdentity(roleHint=''){
 const current=sessionState(),access=authState();
 let user=access.users.find(item=>item.id===current.userId)||null;
 const role=user?.role||current.role||roleHint||selectedRoleKey();
 if(!user&&current.name)user={id:current.userId||'',name:current.name,role,mobile:'',email:'',username:''};
 const evaluation=evaluationState();
 const caregiver=role==='caregiver'?findCaregiver(user,evaluation):null;
 if(user&&caregiver)persistCaregiverLink(user,caregiver);
 const name=String(caregiver?.name||user?.name||current.name||roleLabels[role]||'کاربر سلامت اول').trim();
 const firstName=name.split(/\s+/)[0]||name;
 const rankTitle=caregiver?.rank?.title&&caregiver.rank.title!=='در انتظار ارزیابی'?caregiver.rank.title:'';
 const roleTitle=role==='caregiver'?(rankTitle?`مراقب ${rankTitle}`:'مراقب'):(roleLabels[role]||'کاربر');
 const photo=caregiver?.profile?.photo||user?.photo||'';
 return {role,user,caregiver,name,firstName,initials:initials(name),roleTitle,photo};
}
function welcomeTitle(identity){
 const first=identity.firstName;
 if(identity.role==='admin')return `سلام ${first}، به مرکز فرمان باشگاه خوش آمدید`;
 if(identity.role==='recruiter')return `سلام ${first}، به پنل جذب مراقبین خوش آمدید`;
 if(identity.role==='hr')return `سلام ${first}، به پنل منابع انسانی خوش آمدید`;
 return `سلام ${first}، به پنل مراقب خود خوش آمدید`;
}
function welcomeText(identity){
 const access=authState(),evaluation=evaluationState();
 const work=parse('salamatAvalAdminWorkspaceV15',{contracts:[],assignments:[],tickets:[],payroll:[]});
 if(identity.role==='admin'){
  const pending=access.users.filter(item=>item.status==='pending').length;
  const openTickets=(work.tickets||[]).filter(item=>!['بسته','مختومه'].includes(item.status)).length;
  return `${pending.toLocaleString('fa-IR')} حساب در انتظار تأیید و ${openTickets.toLocaleString('fa-IR')} پیام یا تیکت باز دارید.`;
 }
 if(identity.role==='recruiter'){
  const incomplete=evaluation.caregivers.filter(item=>String(item.fileStatus||'').includes('CP-03')||String(item.fileStatus||'').includes('تکمیل مدارک')).length;
  return `${incomplete.toLocaleString('fa-IR')} پرونده مراقب نیازمند تکمیل یا پیگیری است.`;
 }
 if(identity.role==='hr'){
  const active=(work.contracts||[]).filter(item=>item.status==='فعال').length;
  const pendingPay=(work.payroll||[]).filter(item=>item.status!=='پرداخت‌شده').length;
  return `${active.toLocaleString('fa-IR')} قرارداد فعال و ${pendingPay.toLocaleString('fa-IR')} فیش در انتظار اقدام دارید.`;
 }
 const caregiverId=identity.caregiver?.id||identity.user?.caregiverId||'';
 const assigned=(work.assignments||[]).filter(item=>item.caregiverId===caregiverId&&item.status!=='تکمیل‌شده').length;
 return assigned?`${assigned.toLocaleString('fa-IR')} آموزش تخصیص‌یافته در انتظار تکمیل دارید.`:`اطلاعات پرونده، آموزش‌ها، ارزیابی‌ها و پیام‌ها براساس پروفایل ${identity.name} نمایش داده می‌شود.`;
}
function syncSession(identity){
 const current=sessionState();if(!current.userId&&!identity.user?.id)return;
 const next={...current,userId:identity.user?.id||current.userId,role:identity.role,name:identity.name};
 if(identity.caregiver?.id)next.caregiverId=identity.caregiver.id;
 if(JSON.stringify(next)!==JSON.stringify(current))store(SESSION_KEY,next);
}
function syncCaregiverContext(identity){
 if(identity.role!=='caregiver'||!identity.caregiver?.id)return;
 const ui=parse(EVAL_UI_KEY,{});if(ui.caregiverId===identity.caregiver.id)return;
 ui.caregiverId=identity.caregiver.id;store(EVAL_UI_KEY,ui);
}
function roleStore(){try{return typeof roles!=='undefined'?roles:null}catch{return null}}
function syncRoleModel(identity){
 const models=roleStore(),model=models?.[identity.role];if(!model)return;
 model.name=identity.name;model.initials=identity.initials;model.role=identity.roleTitle;
 model.heroTitle=welcomeTitle(identity);model.heroText=welcomeText(identity);
}
function setText(id,value){const element=document.getElementById(id);if(element&&element.textContent!==value)element.textContent=value}
function setAvatar(id,identity){
 const element=document.getElementById(id);if(!element)return;
 if(identity.photo){
  const current=element.querySelector('img');
  if(!current||current.src!==identity.photo){element.innerHTML=`<img src="${identity.photo}" alt="تصویر ${identity.name}">`}
  element.classList.add('has-photo');
 }else{
  if(element.textContent!==identity.initials||element.querySelector('img'))element.textContent=identity.initials;
  element.classList.remove('has-photo');
 }
}
function syncChrome(identity){
 setText('sidebarName',identity.name);setText('topName',identity.name);
 setText('sidebarRole',identity.roleTitle);setText('topRole',identity.roleTitle);
 setAvatar('sidebarAvatar',identity);setAvatar('topAvatar',identity);
 document.documentElement.dataset.currentUserId=identity.user?.id||'';
 document.documentElement.dataset.currentUserRole=identity.role;
}
function syncCurrentContent(identity){
 const root=$('#content');if(!root)return;
 const title=welcomeTitle(identity),text=welcomeText(identity);
 const roleHero=$('.role-hero',root);if(roleHero){const heading=$('h2',roleHero),paragraph=$('p',roleHero);if(heading&&heading.textContent!==title)heading.textContent=title;if(paragraph&&paragraph.textContent!==text)paragraph.textContent=text}
 const careHero=$('.ev-care-hero',root);if(identity.role==='caregiver'&&careHero){const heading=$('h2',careHero),paragraph=$('p',careHero);if(heading&&heading.textContent!==title)heading.textContent=title;if(paragraph&&paragraph.textContent!==text)paragraph.textContent=text}
 const adminHero=$('.adm-hero',root);if(identity.role==='admin'&&adminHero){const eyebrow=$(':scope>div>span',adminHero);if(eyebrow&&eyebrow.textContent!==title)eyebrow.textContent=title}
 if(identity.role==='caregiver'){
  $$('.ap-profile-head h2,.ap-rank-head h2,.ap-score-person strong',root).forEach(element=>{if(element.textContent!==identity.name)element.textContent=identity.name});
 }
}
function applyIdentity(roleHint=''){
 if(syncing)return resolveLoggedInIdentity(roleHint);
 syncing=true;
 try{
  const identity=resolveLoggedInIdentity(roleHint);syncSession(identity);syncCaregiverContext(identity);syncRoleModel(identity);syncChrome(identity);syncCurrentContent(identity);return identity;
 }finally{syncing=false}
}
function scheduleIdentitySync(roleHint=''){
 if(syncQueued)return;syncQueued=true;
 requestAnimationFrame(()=>{syncQueued=false;applyIdentity(roleHint)});
}
function syncAccountFromCaregiver(){
 const identity=resolveLoggedInIdentity();if(identity.role!=='caregiver'||!identity.user?.id||!identity.caregiver)return;
 const access=authState(),user=access.users.find(item=>item.id===identity.user.id);if(!user)return;
 user.name=identity.caregiver.name||user.name;user.mobile=identity.caregiver.phone||user.mobile;user.caregiverId=identity.caregiver.id;
 store(AUTH_KEY,access);syncSession({...identity,name:user.name,firstName:String(user.name).split(/\s+/)[0]||user.name,user});
 window.dispatchEvent(new CustomEvent('salamat-identity-changed',{detail:{userId:user.id,caregiverId:user.caregiverId,name:user.name}}));
 scheduleIdentitySync();
}
function patchApplicationFunctions(){
 if(window.__salamatDynamicIdentityFunctionsPatched)return;window.__salamatDynamicIdentityFunctionsPatched=true;
 try{
  if(typeof openApp==='function'){
   const previousOpenApp=openApp;
   openApp=function(roleKey){const identity=applyIdentity(roleKey);const result=previousOpenApp.apply(this,arguments);scheduleIdentitySync(roleKey);setTimeout(()=>{const current=applyIdentity(roleKey);try{window.toast?.(`خوش آمدید ${current.name}`,`ورود به ${panelLabels[current.role]||'پنل کاربری'} با موفقیت انجام شد.`)}catch{}},40);return result};
  }
 }catch(error){console.error('Dynamic identity openApp patch failed',error)}
 try{
  if(typeof renderDashboard==='function'){
   const previousDashboard=renderDashboard;
   renderDashboard=function(){applyIdentity();const result=previousDashboard.apply(this,arguments);scheduleIdentitySync();return result};
  }
  if(typeof renderModule==='function'){
   const previousModule=renderModule;
   renderModule=function(){applyIdentity();const result=previousModule.apply(this,arguments);scheduleIdentitySync();return result};
  }
 }catch(error){console.error('Dynamic identity render patch failed',error)}
}
function boot(){
 if(window.__salamatDynamicIdentityV20)return;window.__salamatDynamicIdentityV20=true;
 patchApplicationFunctions();
 document.addEventListener('submit',event=>{if(event.target?.id==='careProfileForm')setTimeout(syncAccountFromCaregiver,40)},true);
 document.getElementById('logoutButton')?.addEventListener('click',()=>{localStorage.removeItem(SESSION_KEY)},true);
 window.addEventListener('salamat-access-changed',()=>scheduleIdentitySync());
 window.addEventListener('salamat-evaluation-changed',()=>scheduleIdentitySync());
 window.addEventListener('salamat-identity-changed',()=>scheduleIdentitySync());
 const observer=new MutationObserver(()=>scheduleIdentitySync());observer.observe(document.body,{subtree:true,childList:true});
 scheduleIdentitySync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();