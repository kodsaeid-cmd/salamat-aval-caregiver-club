(()=>{
'use strict';
if(window.__salamatStableSearchGuardV2)return;
window.__salamatStableSearchGuardV2=true;

const GUARDED_IDS=new Set(['adpSearch','cdpSearch','trpSearch','sevCareSearch']);
function guard(event){
  const target=event.target;
  if(!(target instanceof HTMLInputElement)||!GUARDED_IDS.has(target.id))return;
  event.stopImmediatePropagation();
}
window.addEventListener('input',guard,true);
})();
