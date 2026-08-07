import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const owner=read('preview/evaluation-search-submit-owner-v1.js');
const panel=read('preview/panel-route-bootstrap-v1.js');
const worker=read('worker/index-referral-rewards.ts');
const evaluation=read('preview/server-evaluation-runtime-v4.js');

const checks=[
  ['V4 still exposes explicit search form submit', evaluation.includes("event.target?.id==='sev4SearchForm'")&&evaluation.includes("loadDirectory({page:1,query:input?.value||'',focus:true})")],
  ['V4 historical live input is the intercepted source', evaluation.includes("event.target?.id!=='sev4CareSearch'")&&evaluation.includes('state.searchTimer=setTimeout')],
  ['owner intercepts the real V4 search input at window capture', owner.includes("INPUT_ID='sev4CareSearch'")&&owner.includes("window.addEventListener('input'")&&owner.includes('event.stopImmediatePropagation()')&&owner.includes('},true);')],
  ['owner leaves explicit form submit to V4', owner.includes("event.target?.id!==FORM_ID")&&owner.includes('Intentionally do not stop submit')],
  ['panel waits for canonical staff dashboard', panel.includes('canonicalStaffDashboardReady')&&panel.includes(".spx-dashboard")&&panel.includes("staff.dashboard")],
  ['panel does not finish on app visibility alone', panel.includes('if(!surfaceReady())return false;')],
  ['panel observes content mutations until canonical surface arrives', panel.includes('childList:true,subtree:true')],
  ['worker injects evaluation search owner on panel route', worker.includes('evaluation-search-submit-owner-v1.js')&&worker.includes('EVALUATION_SEARCH_OWNER_VERSION')],
  ['worker cache-busts panel runtime v1.1.0', worker.includes('PANEL_ROUTE_VERSION = "1.1.0"')],
];

let failed=0;
for(const [name,ok] of checks){
  console.log(`${ok?'✓':'✗'} ${name}`);
  if(!ok)failed+=1;
}
if(failed){
  console.error(`\n${failed} admin entry/search validation(s) failed.`);
  process.exit(1);
}
console.log('\nAdmin first-paint and submit-only evaluation search contract passed.');
