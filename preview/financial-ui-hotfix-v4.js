(()=>{
'use strict';
if(window.__salamatFinancialUiHotfixV4)return;
window.__salamatFinancialUiHotfixV4=true;
const VERSION='4.0.1';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function activateCaregiverTab(button){
 const root=button?.closest?.('#caregiverUnifiedFinancialProfileV4');
 if(!root)return;
 const key=String(button.dataset.tab||'');
 if(!key)return;
 $$('[data-tab]',root).forEach(node=>node.classList.toggle('active',node===button));
 $$('[data-panel]',root).forEach(node=>node.classList.toggle('active',String(node.dataset.panel||'')===key));
 root.dataset.activeTab=key;
}

function normalizeCaregiverTabs(root=document){
 const financialRoot=$('#caregiverUnifiedFinancialProfileV4',root)||((root?.id==='caregiverUnifiedFinancialProfileV4')?root:null);
 if(!financialRoot)return;
 $$('[data-tab]',financialRoot).forEach(button=>{
  if(button.tagName==='BUTTON'&&!button.hasAttribute('type'))button.type='button';
 });
}

function repairAdminCompatibility(root=document){
 const financialRoot=$('#content .fch3[data-finance-hub-version="3.0.0"]',root)||((root?.matches?.('.fch3[data-finance-hub-version="3.0.0"]'))?root:null);
 if(financialRoot&&!financialRoot.classList.contains('fch-root'))financialRoot.classList.add('fch-root');
}

function repair(root=document){
 normalizeCaregiverTabs(root);
 repairAdminCompatibility(root);
}

window.addEventListener('click',event=>{
 const button=event.target?.closest?.('#caregiverUnifiedFinancialProfileV4 [data-tab]');
 if(!button)return;
 queueMicrotask(()=>activateCaregiverTab(button));
},true);

window.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 const button=event.target?.closest?.('#caregiverUnifiedFinancialProfileV4 [data-tab]');
 if(!button)return;
 queueMicrotask(()=>activateCaregiverTab(button));
},true);

function observe(){
 const content=$('#content');
 if(!content||content.dataset.financialUiHotfixObserved==='1')return;
 content.dataset.financialUiHotfixObserved='1';
 const observer=new MutationObserver(records=>{
  for(const record of records){
   for(const node of record.addedNodes){
    if(node?.nodeType===1)repair(node);
   }
  }
 });
 observer.observe(content,{childList:true,subtree:true});
 repair(content);
}

window.addEventListener('salamat-shell-ready',observe);
window.addEventListener('pageshow',observe);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
window.SalamatFinancialUiHotfixV4={version:VERSION,repair:()=>repair(document)};
})();
