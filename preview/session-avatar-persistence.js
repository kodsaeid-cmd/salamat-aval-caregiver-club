(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const EVAL_UI_KEY='salamatAvalEvaluationUIV13';
const WORK_KEY='salamatAvalAdminWorkspaceV15';
const SESSION_KEY='salamatAvalSessionV1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const initials=name=>String(name||'کاربر').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'ک‌س';
let syncing=false;
let queued=false;
let restored=false;

function authState(){const state=read(AUTH_KEY,{users:[],audit:[]});state.users=Array.isArray(state.users)?state.users:[];return state}
function evaluationState(){const state=read(EVAL_KEY,{caregivers:[]});state.caregivers=Array.isArray(state.caregivers)?state.caregivers:[];return state}
function sessionUser(){const session=read(SESSION_KEY,{}),access=authState();const user=access.users.find(item=>item.id===session.userId);return {session,user}}
function caregiverFor(user,state=evaluationState()){
 if(!user)return null;
 if(user.caregiverId){const linked=state.caregivers.find(item=>item.id===user.caregiverId);if(linked)return linked}
 const mobile=String(user.mobile||'').replace(/\D/g,'');
 return mobile?state.caregivers.find(item=>String(item.phone||'').replace(/\D/g,'')===mobile)||null:null;
}
function canonicalPhoto(user,caregiver){return String(caregiver?.profile?.photo||user?.photo||'')}

function syncStoredPhotos(){
 const access=authState(),state=evaluationState();let authChanged=false,evalChanged=false;
 for(const user of access.users){
  const caregiver=caregiverFor(user,state);if(!caregiver)continue;
  caregiver.profile={...(caregiver.profile||{})};
  const photo=canonicalPhoto(user,caregiver);
  if(String(user.photo||'')!==photo){user.photo=photo;authChanged=true}
  if(String(caregiver.profile.photo||'')!==photo){caregiver.profile.photo=photo;evalChanged=true}
  if(!user.caregiverId&&caregiver.id){user.caregiverId=caregiver.id;authChanged=true}
 }
 if(authChanged)write(AUTH_KEY,access);
 if(evalChanged)write(EVAL_KEY,state);
 return {access,state};
}

function cleanImageClasses(value){return String(value||'').split(/\s+/).filter(Boolean).filter(item=>!['p3-ph','placeholder','care-photo-placeholder'].includes(item)).join(' ')}
function directAvatar(element,photo,name){
 if(!element)return;
 if(photo){
  if(element.tagName==='IMG'){
   if(element.getAttribute('src')!==photo)element.setAttribute('src',photo);
   element.alt=`تصویر ${name}`;element.className=cleanImageClasses(element.className);return;
  }
  const image=document.createElement('img');image.className=cleanImageClasses(element.className);image.src=photo;image.alt=`تصویر ${name}`;element.replaceWith(image);return;
 }
 if(element.tagName==='IMG'){
  const placeholder=document.createElement('span');placeholder.className=`${element.className} p3-ph`.trim();placeholder.textContent=initials(name);element.replaceWith(placeholder);
 }else if(element.textContent!==initials(name))element.textContent=initials(name);
}
function avatarContainer(element,photo,name){
 if(!element)return;
 if(photo){
  const image=element.querySelector(':scope > img');
  if(image){if(image.getAttribute('src')!==photo)image.src=photo;image.alt=`تصویر ${name}`}
  else element.innerHTML=`<img src="${photo}" alt="تصویر ${String(name||'').replace(/["<>]/g,'')}">`;
  element.classList.add('has-photo');
 }else{
  if(element.querySelector('img')||element.textContent!==initials(name))element.textContent=initials(name);
  element.classList.remove('has-photo');
 }
}
function updateRecordAvatar(root,caregiver){
 if(!root||!caregiver)return;const photo=canonicalPhoto(null,caregiver),name=caregiver.name||'مراقب';
 const container=root.querySelector('.unified-care-avatar,.feature-care-avatar,.persistent-care-avatar');
 if(container)avatarContainer(container,photo,name);
 const direct=root.querySelector('.p3-table-avatar,.adm-care-photo,.care-photo');
 if(direct)directAvatar(direct,photo,name);
}
function selectedCaregiver(state){
 const ui=read(EVAL_UI_KEY,{}),work=read(WORK_KEY,{ui:{}}),id=work?.ui?.caregiverId||ui.caregiverId||'';
 return state.caregivers.find(item=>item.id===id)||null;
}
function syncVisiblePhotos(){
 if(syncing)return;syncing=true;
 try{
  const {access,state}=syncStoredPhotos();
  const {session,user}=sessionUser();const currentCaregiver=caregiverFor(user,state);const currentPhoto=canonicalPhoto(user,currentCaregiver);const currentName=currentCaregiver?.name||user?.name||session.name||'کاربر سلامت اول';
  avatarContainer($('#sidebarAvatar'),currentPhoto,currentName);avatarContainer($('#topAvatar'),currentPhoto,currentName);
  $$('[data-professional-caregiver]').forEach(row=>updateRecordAvatar(row,state.caregivers.find(item=>item.id===row.dataset.professionalCaregiver)));
  $$('[data-unified-care]').forEach(card=>updateRecordAvatar(card,state.caregivers.find(item=>item.id===card.dataset.unifiedCare)));
  $$('[data-feature-care]').forEach(card=>updateRecordAvatar(card,state.caregivers.find(item=>item.id===card.dataset.featureCare)));
  $$('#unifiedUsersTable tbody tr').forEach(row=>{
   const userId=row.dataset.userId||row.querySelector('.ev-cell-note')?.textContent.trim();const rowUser=access.users.find(item=>item.id===userId);if(!rowUser)return;
   const care=caregiverFor(rowUser,state),photo=canonicalPhoto(rowUser,care),cell=row.cells?.[0];if(!cell)return;
   let holder=cell.querySelector('.persistent-user-avatar');
   if(!holder){holder=document.createElement('span');holder.className='persistent-user-avatar';cell.prepend(holder)}
   avatarContainer(holder,photo,care?.name||rowUser.name);
  });
  const care=selectedCaregiver(state)||currentCaregiver;
  if(care){
   const photo=canonicalPhoto(access.users.find(item=>item.caregiverId===care.id),care),name=care.name||'مراقب';
   $$('.p3-big,.ap-profile-photo,.ap-score-photo,.care-photo,.adm-care-photo').forEach(element=>directAvatar(element,photo,name));
   $$('.unified-profile-photo,.p3-user-photo #p3UserPhotoPreview').forEach(element=>avatarContainer(element,photo,name));
  }
 }finally{syncing=false}
}
function schedulePhotoSync(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncVisiblePhotos()})}

function validRememberedSession(){
 const {session,user}=sessionUser();
 if(!session.userId||!user||user.status!=='approved')return null;
 return {session,user};
}
function prepareCaregiverContext(user){
 if(!user?.caregiverId)return;const ui=read(EVAL_UI_KEY,{});if(ui.caregiverId!==user.caregiverId){ui.caregiverId=user.caregiverId;write(EVAL_UI_KEY,ui)}
}
function restoreSession(){
 if(restored)return true;const remembered=validRememberedSession();if(!remembered)return false;
 let ready=false;try{ready=typeof openApp==='function'&&typeof roles==='object'}catch{}if(!ready)return false;
 restored=true;const {session,user}=remembered;prepareCaregiverContext(user);
 try{selectedRole=user.role||session.role||'caregiver'}catch{}
 const roleButton=$(`#roleOptions [data-role="${user.role}"]`);if(roleButton){$$('#roleOptions [data-role]').forEach(button=>button.classList.toggle('active',button===roleButton))}
 const next={...session,userId:user.id,role:user.role,name:user.name,caregiverId:user.caregiverId||session.caregiverId||'',lastSeenAt:Date.now(),remembered:true};write(SESSION_KEY,next);
 try{openApp(user.role)}catch(error){restored=false;console.error('Session restore failed',error);return false}
 setTimeout(()=>{window.dispatchEvent(new CustomEvent('salamat-identity-changed',{detail:{userId:user.id,caregiverId:user.caregiverId||''}}));schedulePhotoSync()},30);
 return true;
}
function boot(){
 syncStoredPhotos();schedulePhotoSync();
 $('#logoutButton')?.addEventListener('click',()=>{restored=false;localStorage.removeItem(SESSION_KEY)},true);
 ['salamat-access-changed','salamat-evaluation-changed','salamat-identity-changed'].forEach(name=>window.addEventListener(name,()=>{syncStoredPhotos();schedulePhotoSync()}));
 window.addEventListener('storage',event=>{if([AUTH_KEY,EVAL_KEY,SESSION_KEY].includes(event.key))schedulePhotoSync()});
 const content=$('#content'),sidebar=$('#sidebarNav');let observer;
 if(content||sidebar){observer=new MutationObserver(schedulePhotoSync);if(content)observer.observe(content,{childList:true,subtree:true});if(sidebar)observer.observe(sidebar,{childList:true,subtree:true})}
 let attempts=0;const timer=setInterval(()=>{attempts+=1;if(restoreSession()||attempts>160)clearInterval(timer)},50);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
