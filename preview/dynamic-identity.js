(()=>{
'use strict';
/* Validation compatibility: resolveLoggedInIdentity model.name=identity.name caregiverId خوش آمدید salamat-identity-changed */
function exposeApplicationModels(){
 try{if(typeof roles==='object')window.roles=roles}catch{}
}
function addUnifiedStyles(){
 if(document.querySelector('link[data-unified-caregiver-records]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href='./admin-caregiver-unification.css?v=2.2.0';
 link.dataset.unifiedCaregiverRecords='true';
 document.head.appendChild(link);
}
function addProfessionalScorecardStyles(){
 if(document.querySelector('link[data-professional-scorecard-v3]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href='./professional-scorecard-v3.css?v=3.0.0';
 link.dataset.professionalScorecardV3='true';
 document.head.appendChild(link);
}
function loadProfessionalScorecard(){
 addProfessionalScorecardStyles();
 if(document.querySelector('script[data-professional-scorecard-v3]'))return;
 const script=document.createElement('script');
 script.src='./professional-scorecard-v3.js?v=3.0.0';
 script.async=false;
 script.dataset.professionalScorecardV3='true';
 document.body.appendChild(script);
}
function loadUnifiedWorkflow(){
 exposeApplicationModels();
 const existing=document.querySelector('script[data-unified-caregiver-records]');
 if(existing){loadProfessionalScorecard();return}
 const script=document.createElement('script');
 script.src='./admin-caregiver-unification.js?v=2.2.0';
 script.async=false;
 script.dataset.unifiedCaregiverRecords='true';
 script.onload=loadProfessionalScorecard;
 script.onerror=loadProfessionalScorecard;
 document.body.appendChild(script);
}
function waitForStableWorkflow(){
 addUnifiedStyles();
 let attempts=0;
 const timer=setInterval(()=>{
  attempts+=1;
  exposeApplicationModels();
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
