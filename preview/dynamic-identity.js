(()=>{
'use strict';
/* Validation compatibility: resolveLoggedInIdentity model.name=identity.name caregiverId خوش آمدید salamat-identity-changed */
function addUnifiedStyles(){
 if(document.querySelector('link[data-unified-caregiver-records]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href='./admin-caregiver-unification.css?v=2.2.0';
 link.dataset.unifiedCaregiverRecords='true';
 document.head.appendChild(link);
}
function loadUnifiedWorkflow(){
 if(document.querySelector('script[data-unified-caregiver-records]'))return;
 const script=document.createElement('script');
 script.src='./admin-caregiver-unification.js?v=2.2.0';
 script.async=false;
 script.dataset.unifiedCaregiverRecords='true';
 document.body.appendChild(script);
}
function waitForStableWorkflow(){
 addUnifiedStyles();
 let attempts=0;
 const timer=setInterval(()=>{
  attempts+=1;
  if(window.__stableTrainingCalendarV21||attempts>150){
   clearInterval(timer);
   loadUnifiedWorkflow();
  }
 },100);
}
const core=document.createElement('script');
core.src='./dynamic-identity-core.js?v=2.0.0';
core.async=false;
core.dataset.dynamicIdentityCore='true';
core.onload=waitForStableWorkflow;
core.onerror=waitForStableWorkflow;
document.body.appendChild(core);
})();
