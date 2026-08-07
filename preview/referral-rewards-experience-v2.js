(()=>{
'use strict';
if(window.__salamatReferralRewardsExperienceV2)return;
window.__salamatReferralRewardsExperienceV2=true;

const VERSION='2.2.0';
const ENDPOINT='/api/caregiver/platform/referrals';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=v=>Number(v||0).toLocaleString('fa-IR');
const state={data:null,promise:null,lastLoadedAt:0,timer:0,observers:[]};

async function api(path){const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);return payload}
function toast(a,b){try{window.toast?.(a,b)}catch{}if(!window.toast)console.info(a,b)}
function role(){try{return String(window.SalamatBackend?.getCurrentUser?.()?.role||window.__salamatPanelAccessV2?.user?.role||'').toUpperCase()}catch{return ''}}
function caregiverActive(){return role()==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب')}
function activeModule(){return $('#sidebarNav [data-caregiver-module-key].active')?.dataset?.caregiverModuleKey||$('#sidebarNav [data-panel-module-key].active')?.dataset?.panelModuleKey||''}
function pageTitle(){return String($('#pageTitle')?.textContent||'').trim()}
function isDashboard(){const key=activeModule();return caregiverActive()&&(key==='caregiver.dashboard'||(!key&&pageTitle().includes('داشبورد')))}
async function loadData(){if(state.data&&Date.now()-state.lastLoadedAt<30000)return state.data;if(state.promise)return state.promise;state.promise=api(ENDPOINT).then(p=>{state.data=p.data||{};state.lastLoadedAt=Date.now();return state.data}).finally(()=>state.promise=null);return state.promise}
async function copyCode(code){if(!code||code==='—')return;try{await navigator.clipboard.writeText(code);toast('کد معرف کپی شد',code)}catch{window.prompt('کد معرف شما',code)}}
function addStyles(){if($('#referralDashboardOnlyV22Styles'))return;const style=document.createElement('style');style.id='referralDashboardOnlyV22Styles';style.textContent=`.refv2-dashboard-code{position:relative}.refv2-dashboard-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}.refv2-dashboard-row strong{margin:0!important;letter-spacing:2px;direction:ltr}.refv2-dashboard-copy{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);color:#fff;border-radius:8px;padding:5px 8px;font:inherit;font-size:7px;font-weight:900;cursor:pointer}.refv2-dashboard-pending{display:block!important;margin-top:5px!important;color:#fff4cb!important;font-size:7px!important}`;(document.head||document.documentElement).appendChild(style)}
function enhanceSignup(){const form=$('#caregiverSignupForm');if(!form)return;let input=form.querySelector('[name="referralCode"]');if(!input){const label=document.createElement('label');label.className='caregiver-signup-field';label.innerHTML='<span>کد معرف مراقب <small style="font-weight:400;color:#7b8b82">(اختیاری)</small></span><input name="referralCode" autocomplete="off" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" placeholder="مثلاً 482731" dir="ltr"><small class="ref-signup-hint">کد معرف ۶ رقمی است و پس از ثبت‌نام ابتدا معرف و سپس مدیر سامانه آن را بررسی می‌کنند.</small>';const anchor=form.querySelector('[name="skills"]')?.closest('label');if(anchor?.nextSibling)form.insertBefore(label,anchor.nextSibling);else form.appendChild(label);input=label.querySelector('input')}input.maxLength=6;input.setAttribute('inputmode','numeric');if(!input.dataset.refv2Bound){input.dataset.refv2Bound='1';input.addEventListener('input',()=>{input.value=String(input.value||'').replace(/\D/g,'').slice(0,6)})}}
async function renderDashboardCode(){if(!isDashboard()){$('#referralDashboardCodeV2')?.remove();return}const side=$('.cgr3-dashboard-side')||$('.cgp-hero-side')||$('.cgr3-dashboard-hero')||$('.cgp-hero');if(!side)return;try{const data=await loadData();if(!isDashboard()||!side.isConnected)return;const code=data?.caregiver?.referralCode||'—',pending=Number(data?.summary?.awaitingMyConfirmation||0),signature=`${code}:${pending}`;let card=$('#referralDashboardCodeV2');if(!card){card=document.createElement('div');card.id='referralDashboardCodeV2';card.className='refv2-dashboard-code';side.prepend(card)}if(card.dataset.refv2Signature!==signature){card.dataset.refv2Signature=signature;card.innerHTML=`<small>کد معرف من</small><span class="refv2-dashboard-row"><strong>${esc(code)}</strong><button type="button" class="refv2-dashboard-copy" data-refv2-copy="${esc(code)}">کپی</button></span>${pending?`<small class="refv2-dashboard-pending">${fa(pending)} معرفی منتظر تأیید شما</small>`:''}`}}catch{}}
function enforce(){addStyles();enhanceSignup();if(isDashboard())renderDashboardCode();else $('#referralDashboardCodeV2')?.remove();$('#caregiverReferralRewardsV2')?.remove()}
function schedule(){clearTimeout(state.timer);state.timer=setTimeout(enforce,100)}
function observeTarget(target){if(!target)return;const observer=new MutationObserver(schedule);observer.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-caregiver-module-key']});state.observers.push(observer)}
document.addEventListener('click',event=>{const copy=event.target.closest?.('[data-refv2-copy]');if(copy){event.preventDefault();copyCode(copy.dataset.refv2Copy)}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observeTarget($('#content'));observeTarget($('#sidebarNav'));schedule()},{once:true});else{observeTarget($('#content'));observeTarget($('#sidebarNav'));schedule()}
window.SalamatReferralRewardsExperienceV2={version:VERSION,refresh:()=>{state.data=null;schedule()}};
})();
