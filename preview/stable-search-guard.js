(()=>{
'use strict';
if(window.__salamatStableSearchGuardV1)return;
window.__salamatStableSearchGuardV1=true;

const GUARDED_IDS=new Set(['adpSearch','cdpSearch','trpSearch','sevCareSearch']);
function guard(event){
  const target=event.target;
  if(!(target instanceof HTMLInputElement)||!GUARDED_IDS.has(target.id))return;
  event.stopImmediatePropagation();
}
document.addEventListener('input',guard,true);
})();
