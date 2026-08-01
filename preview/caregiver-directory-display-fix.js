(()=>{
'use strict';
if(window.__salamatCaregiverDirectoryDisplayFixV1)return;
window.__salamatCaregiverDirectoryDisplayFixV1=true;
const replacements=new Map([
 ['NEW','ارزیابی نشده'],
 ['ذکر نشده','ثبت نشده'],
 ['در انتظار بررسی','نیازمند بررسی'],
]);
function patch(){
 const root=document.querySelector('.cdp-root');if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){const value=String(node.nodeValue||'').trim();if(replacements.has(value))node.nodeValue=String(node.nodeValue||'').replace(value,replacements.get(value))}
}
function boot(){const content=document.querySelector('#content')||document.body;new MutationObserver(()=>setTimeout(patch,20)).observe(content,{childList:true,subtree:true,characterData:true});patch()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
