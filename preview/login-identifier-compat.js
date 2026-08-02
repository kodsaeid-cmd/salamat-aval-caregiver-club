(()=>{
'use strict';
if(window.__salamatLoginIdentifierCompatV1)return;
window.__salamatLoginIdentifierCompatV1=true;

function identifierField(fields){
  return fields?.querySelector('#backendIdentifierInput,input[autocomplete="username"],input[data-login-identifier],input[type="text"]')||null;
}
function syncIdentifier(){
  const form=document.getElementById('loginForm');
  const fields=document.getElementById('emailFields');
  if(!form||!fields)return;
  form.noValidate=true;
  form.setAttribute('novalidate','novalidate');
  const source=identifierField(fields);
  if(!source)return;
  source.id='backendIdentifierInput';
  source.setAttribute('autocomplete','username');
  source.setAttribute('data-login-identifier','true');
  let bridge=document.getElementById('backendIdentifierEmailBridge');
  if(!bridge){
    bridge=document.createElement('input');
    bridge.id='backendIdentifierEmailBridge';
    bridge.type='email';
    bridge.hidden=true;
    bridge.tabIndex=-1;
    bridge.setAttribute('aria-hidden','true');
    fields.prepend(bridge);
  }
  bridge.value=String(source.value||'').trim();
}

document.addEventListener('submit',event=>{
  if(event.target?.id==='loginForm')syncIdentifier();
},true);
document.addEventListener('input',event=>{
  if(event.target?.matches?.('#backendIdentifierInput,input[data-login-identifier]'))syncIdentifier();
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncIdentifier,{once:true});
else syncIdentifier();
})();
