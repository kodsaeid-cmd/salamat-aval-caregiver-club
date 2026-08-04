(()=>{
'use strict';
if(window.__salamatRenderModuleOwnerGuardV1)return;
window.__salamatRenderModuleOwnerGuardV1=true;

const VERSION='1.0.0';
let activeRender=typeof window.renderModule==='function'?window.renderModule:null;
let safeTraining=activeRender?.__trainingAdminClassicV2?activeRender:null;
let rejectedSupportAssignments=0;
let acceptedAssignments=activeRender?1:0;

function isFunction(value){return typeof value==='function'}
function isSupportWrapper(value){return isFunction(value)&&value.__staffSupportV1===true}
function isTrainingWrapper(value){return isFunction(value)&&value.__trainingAdminClassicV2===true}
function chainContainsSupport(value,seen=new Set()){
  if(!isFunction(value)||seen.has(value))return false;
  seen.add(value);
  if(isSupportWrapper(value))return true;
  return chainContainsSupport(value.__base,seen)||chainContainsSupport(value.__trainingAdminClassicBase,seen);
}
function trainingBase(value){return value?.__trainingAdminClassicBase||null}
function chooseTraining(value){
  if(!isTrainingWrapper(value))return null;
  const base=trainingBase(value);
  if(!chainContainsSupport(base))return value;
  const visited=new Set();
  const queue=[base];
  while(queue.length){
    const candidate=queue.shift();
    if(!isFunction(candidate)||visited.has(candidate))continue;
    visited.add(candidate);
    if(isTrainingWrapper(candidate)&&!chainContainsSupport(trainingBase(candidate)))return candidate;
    if(candidate.__trainingAdminClassicBase)queue.push(candidate.__trainingAdminClassicBase);
    if(candidate.__base)queue.push(candidate.__base);
  }
  return null;
}
function normalize(value){
  if(!isFunction(value))return activeRender;
  if(isSupportWrapper(value)){
    rejectedSupportAssignments+=1;
    return activeRender||value.__base||null;
  }
  if(isTrainingWrapper(value)){
    const candidate=chooseTraining(value);
    if(candidate)safeTraining=candidate;
    return safeTraining||candidate||value;
  }
  return value;
}

try{
  Object.defineProperty(window,'renderModule',{
    configurable:true,
    enumerable:true,
    get(){return activeRender},
    set(value){
      const normalized=normalize(value);
      if(isFunction(normalized)){
        activeRender=normalized;
        acceptedAssignments+=1;
      }
    },
  });
  if(activeRender)window.renderModule=activeRender;
}catch(error){
  console.error('Render module owner guard could not install',error);
}

window.SalamatRenderModuleOwnerGuard={
  version:VERSION,
  get active(){return activeRender},
  get safeTraining(){return safeTraining},
  get rejectedSupportAssignments(){return rejectedSupportAssignments},
  get acceptedAssignments(){return acceptedAssignments},
  stabilize(){
    const normalized=normalize(window.renderModule);
    if(isFunction(normalized))activeRender=normalized;
    return activeRender;
  },
};
})();
