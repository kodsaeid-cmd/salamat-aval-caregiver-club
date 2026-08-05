(()=>{
'use strict';
if(window.__salamatCaregiverSupportNotificationBridgeV1)return;
window.__salamatCaregiverSupportNotificationBridgeV1=true;

const VERSION='1.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();

function caregiverActive(){const role=String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatAccessControl?.access?.user?.role||$('#sidebarRole')?.textContent||'').toUpperCase();return role==='CAREGIVER'||clean($('#sidebarRole')?.textContent).includes('مراقب')}
function supportButton(){return $$('#sidebarNav .nav-item,#sidebarNav>button').find(item=>clean(item.textContent).includes('پشتیبانی'))}
function waitForThread(threadId,deadline=Date.now()+6000){
 const button=$(`[data-cgp-thread="${CSS.escape(threadId)}"]`);if(button){button.click();return true}
 if(Date.now()>=deadline)return false;setTimeout(()=>waitForThread(threadId,deadline),80);return false;
}
async function open(event){
 if(!caregiverActive())return;const threadId=String(event?.detail?.threadId||'');
 try{await window.SalamatCaregiverPlatform?.openSupport?.()}catch{}
 if(!$('#content .cgp-support'))supportButton()?.click();
 if(threadId)waitForThread(threadId);
}
window.addEventListener('salamat-open-caregiver-support-thread',event=>void open(event));
window.SalamatCaregiverSupportNotificationBridge={version:VERSION,open:(threadId='')=>open({detail:{threadId}})};
})();
