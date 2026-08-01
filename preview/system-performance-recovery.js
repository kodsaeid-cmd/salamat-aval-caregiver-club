(()=>{
'use strict';
if(window.__salamatSystemPerformanceRecoveryV1)return;
window.__salamatSystemPerformanceRecoveryV1=true;

const MAX_BROWSER_ROWS=150;
const report=[];

function parse(value){try{return JSON.parse(value)}catch{return null}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function roleOf(item){return String(item?.role||'').toLowerCase()}
function trimArray(value,keep){return Array.isArray(value)?value.slice(0,keep):value}

function repairAccessControl(){
 const key='salamatAvalAccessControlV1';const state=parse(localStorage.getItem(key));
 if(!state||!Array.isArray(state.users)||state.users.length<=MAX_BROWSER_ROWS)return;
 const staff=state.users.filter(item=>roleOf(item)!=='caregiver');
 state.users=staff.slice(0,MAX_BROWSER_ROWS);
 state.audit=trimArray(state.audit,100);
 if(save(key,state))report.push(`${key}:${state.users.length}`);
}
function repairEvaluation(){
 const key='salamatAvalEvaluationSystemV13';const state=parse(localStorage.getItem(key));
 if(!state||!Array.isArray(state.caregivers)||state.caregivers.length<=MAX_BROWSER_ROWS)return;
 state.caregivers=[];
 state.events=trimArray(state.events,250);
 state.audit=trimArray(state.audit,100);
 if(save(key,state))report.push(`${key}:0`);
}
function repairAdminWorkspace(){
 const key='salamatAvalAdminWorkspaceV15';const state=parse(localStorage.getItem(key));
 if(!state||typeof state!=='object')return;
 let changed=false;
 for(const field of ['assignments','payroll','contracts','tickets','securityReports','audit']){
  if(Array.isArray(state[field])&&state[field].length>1000){state[field]=state[field].slice(0,500);changed=true}
 }
 if(changed&&save(key,state))report.push(`${key}:trimmed`);
}
function removeOversizedSnapshots(){
 for(let index=localStorage.length-1;index>=0;index-=1){
  const key=localStorage.key(index);if(!key)continue;
  if(!/salamat|caregiver/i.test(key))continue;
  const value=localStorage.getItem(key)||'';
  if(value.length<4_000_000)continue;
  if(/Checkpoint/i.test(key))continue;
  try{localStorage.removeItem(key);report.push(`${key}:removed`)}catch{}
 }
}

repairAccessControl();
repairEvaluation();
repairAdminWorkspace();
removeOversizedSnapshots();
try{sessionStorage.setItem('salamatPerformanceRecoveryReport',JSON.stringify({at:new Date().toISOString(),report}))}catch{}
})();
