(()=>{
'use strict';
if(window.__salamatFinancialReferralContinuityV5)return;
window.__salamatFinancialReferralContinuityV5=true;
const VERSION='5.0.1';
const REGISTER_PATH='/api/public/caregivers/register';
const VALID_TABS=new Set(['retention','loans','referrals','wallet']);
const VALID_ADMIN_VIEWS=new Set(['scorecard','referrals','ledger','requests']);
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const normalizeDigits=value=>String(value||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'').slice(0,6);

function activateFinanceTab(tab){
  if(!VALID_TABS.has(tab))return false;
  const root=$('#caregiverUnifiedFinancialProfileV4');
  if(!root)return false;
  window.__salamatFinancialActiveTabV4=tab;
  $$('[data-tab]',root).forEach(button=>{
    const active=button.dataset.tab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',active?'true':'false');
    button.type='button';
  });
  $$('[data-panel]',root).forEach(panel=>{
    const active=panel.dataset.panel===tab;
    panel.classList.toggle('active',active);
    panel.hidden=!active;
    panel.style.setProperty('display',active?'grid':'none','important');
  });
  return true;
}
function activateAdminView(view,button=null){
  if(!VALID_ADMIN_VIEWS.has(view))return false;
  const root=button?.closest?.('.fch3-card')||$('#content .fch3 [data-detail] .fch3-card');
  if(!root)return false;
  $$('[data-view]',root).forEach(node=>{
    const active=node.dataset.view===view;
    node.classList.toggle('active',active);
    node.setAttribute('aria-selected',active?'true':'false');
    node.type='button';
  });
  $$('[data-view-panel]',root).forEach(panel=>{
    const active=panel.dataset.viewPanel===view;
    panel.classList.toggle('active',active);
    panel.hidden=!active;
    panel.style.setProperty('display',active?'block':'none','important');
  });
  return true;
}
function financeTabFromEvent(event){return event.target?.closest?.('#caregiverUnifiedFinancialProfileV4 [data-tab]')||null}
function adminViewFromEvent(event){return event.target?.closest?.('#content .fch3 [data-view]')||null}
function pointerHandler(event){
  const caregiverButton=financeTabFromEvent(event);
  if(caregiverButton){const tab=caregiverButton.dataset.tab;if(VALID_TABS.has(tab)){event.preventDefault();activateFinanceTab(tab)}return}
  const adminButton=adminViewFromEvent(event);
  if(adminButton){const view=adminButton.dataset.view;if(VALID_ADMIN_VIEWS.has(view)){event.preventDefault();activateAdminView(view,adminButton)}}
}
function keyboardHandler(event){
  if(event.key!=='Enter'&&event.key!==' ')return;
  const caregiverButton=financeTabFromEvent(event);if(caregiverButton){event.preventDefault();activateFinanceTab(caregiverButton.dataset.tab);return}
  const adminButton=adminViewFromEvent(event);if(adminButton){event.preventDefault();activateAdminView(adminButton.dataset.view,adminButton)}
}
function repairFinanceTabs(){
  const root=$('#caregiverUnifiedFinancialProfileV4');
  if(root){const current=window.__salamatFinancialActiveTabV4||$('.ufp4-tab.active',root)?.dataset?.tab||'retention';activateFinanceTab(VALID_TABS.has(current)?current:'retention')}
  const adminRoot=$('#content .fch3 [data-detail] .fch3-card');
  if(adminRoot){const current=$('[data-view].active',adminRoot)?.dataset?.view||'scorecard';activateAdminView(VALID_ADMIN_VIEWS.has(current)?current:'scorecard',$(`[data-view="${current}"]`,adminRoot))}
}

function referralCode(){return normalizeDigits($('#caregiverSignupForm [name="referralCode"]')?.value||'')}
function patchPayloadText(text){
  const code=referralCode();if(!code)return text;
  try{const payload=JSON.parse(String(text||'{}'));payload.referralCode=code;return JSON.stringify(payload)}catch{return text}
}
function installRegistrationAuthority(){
  if(window.__salamatReferralRegistrationAuthorityV5)return;
  window.__salamatReferralRegistrationAuthorityV5=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    try{
      const request=input instanceof Request?input:null;
      const rawUrl=typeof input==='string'?input:input instanceof URL?input.toString():request?.url||'';
      const url=new URL(rawUrl,location.href);
      const method=String(init.method||request?.method||'GET').toUpperCase();
      if(url.pathname===REGISTER_PATH&&method==='POST'){
        const code=referralCode();
        if(code){
          if(typeof init.body==='string')init={...init,body:patchPayloadText(init.body)};
          else if(request&&!init.body){
            const text=await request.clone().text();
            const headers=new Headers(request.headers);headers.set('content-type','application/json');
            input=new Request(request.url,{method:request.method,headers,body:patchPayloadText(text),credentials:request.credentials,cache:request.cache,redirect:request.redirect,referrer:request.referrer,referrerPolicy:request.referrerPolicy,integrity:request.integrity,keepalive:request.keepalive,mode:request.mode});
          }
        }
      }
    }catch(error){console.warn('Referral registration authority skipped',error)}
    return nativeFetch(input,init);
  };
}
function normalizeReferralInput(event){
  const input=event.target?.closest?.('#caregiverSignupForm [name="referralCode"]');if(!input)return;
  const next=normalizeDigits(input.value);if(input.value!==next)input.value=next;
}

window.addEventListener('pointerdown',pointerHandler,true);
window.addEventListener('click',pointerHandler,true);
window.addEventListener('keydown',keyboardHandler,true);
document.addEventListener('input',normalizeReferralInput,true);
installRegistrationAuthority();
const content=$('#content');if(content){const observer=new MutationObserver(()=>queueMicrotask(repairFinanceTabs));observer.observe(content,{childList:true,subtree:true})}
queueMicrotask(repairFinanceTabs);
window.SalamatFinancialReferralContinuityV5={version:VERSION,activateFinanceTab,activateAdminView,repairFinanceTabs,normalizeReferralCode:normalizeDigits};
})();