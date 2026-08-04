(()=>{
'use strict';
if(window.__salamatCaregiverAvatarUnityV2)return;
window.__salamatCaregiverAvatarUnityV2=true;

const VERSION='2.0.0';
const PROFILE_URL='/api/caregiver/platform/profile';
const $=(selector,root=document)=>root.querySelector(selector);
const text=value=>String(value??'').trim();
const state={profile:null,loading:null,queued:false,observer:null};

async function api(path){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache'}});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}
 return payload;
}
function caregiverActive(){
 const app=$('#appView');if(!app||app.classList.contains('hidden'))return false;
 const role=text(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatAccessControl?.access?.user?.role||window.selectedRole||$('#sidebarRole')?.textContent).toUpperCase();
 return role==='CAREGIVER'||text($('#sidebarRole')?.textContent).includes('مراقب');
}
function initials(name){return text(name||'مراقب').split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function imageUrl(profile){
 const url=text(profile?.avatarUrl);if(!url)return '';
 const token=encodeURIComponent(profile?.avatarId||profile?.updatedAt||VERSION);
 return `${url}${url.includes('?')?'&':'?'}v=${token}`;
}
function applyAvatarNode(node,profile){
 if(!node)return;
 const name=text(profile?.fullName)||'مراقب',src=imageUrl(profile);
 if(!src){if(!node.querySelector('img')&&text(node.textContent)!==initials(name))node.textContent=initials(name);return}
 let image=node.matches('img')?node:node.querySelector('img');
 if(!image){
  node.textContent='';image=document.createElement('img');node.appendChild(image);
 }
 if(image.getAttribute('src')!==src)image.setAttribute('src',src);
 image.setAttribute('alt',name);
 image.setAttribute('data-caregiver-avatar-unity',VERSION);
 Object.assign(image.style,{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit',display:'block'});
}
function applyScorecard(profile){
 if(!profile?.avatarUrl)return;
 const host=$('#content .cgr3-report .p3-profile .p3-big,#content .p3-report .p3-profile .p3-big');
 if(!host)return;
 const name=text(profile.fullName)||'مراقب',src=imageUrl(profile);
 if(host.matches('img')){
  if(host.getAttribute('src')!==src)host.setAttribute('src',src);
  host.setAttribute('alt',name);host.setAttribute('data-caregiver-avatar-unity',VERSION);return;
 }
 const image=document.createElement('img');image.className=host.className.replace(/\bp3-ph\b/g,'').trim()||'p3-big';image.src=src;image.alt=name;image.dataset.caregiverAvatarUnity=VERSION;host.replaceWith(image);
}
function apply(profile=state.profile){
 if(!profile||!caregiverActive())return false;
 state.profile=profile;
 const name=text(profile.fullName)||'مراقب';
 for(const selector of ['#topName','#sidebarName']){const node=$(selector);if(node&&text(node.textContent)!==name)node.textContent=name}
 applyAvatarNode($('#topAvatar'),profile);applyAvatarNode($('#sidebarAvatar'),profile);applyScorecard(profile);
 return true;
}
async function load(force=false){
 if(!caregiverActive())return null;
 if(state.profile&&!force){apply();return state.profile}
 if(state.loading)return state.loading;
 state.loading=api(`${PROFILE_URL}?avatarUnity=${Date.now()}`).then(payload=>{state.profile=payload.data||null;apply();return state.profile}).catch(error=>{if(error.status!==401&&error.status!==403)console.error('Caregiver avatar unity failed',error);return null}).finally(()=>{state.loading=null});
 return state.loading;
}
function queueApply(){
 if(state.queued)return;state.queued=true;
 queueMicrotask(()=>{state.queued=false;if(state.profile)apply();else if(caregiverActive())void load(false)});
}
function observe(){
 if(state.observer||!document.body)return;
 state.observer=new MutationObserver(queueApply);
 state.observer.observe(document.body,{childList:true,subtree:true});
}
function profileUpdated(event){
 const profile=event?.detail?.profile;
 if(profile){state.profile={...(state.profile||{}),...profile};apply();return}
 void load(true);
}
function boot(){
 observe();
 window.addEventListener('salamat-caregiver-profile-updated',profileUpdated);
 window.addEventListener('salamat-authenticated',()=>setTimeout(()=>void load(true),0));
 window.addEventListener('salamat-access-ready',()=>setTimeout(()=>void load(false),0));
 window.addEventListener('salamat-module-opened',queueApply);
 window.addEventListener('salamat-caregiver-scorecard-opened',queueApply);
 window.addEventListener('pageshow',()=>setTimeout(()=>void load(false),0));
 if(caregiverActive())void load(false);
 window.SalamatCaregiverAvatarUnity={version:VERSION,reload:()=>load(true),apply,get profile(){return state.profile}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
