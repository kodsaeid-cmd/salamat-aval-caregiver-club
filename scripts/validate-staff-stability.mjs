import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function expect(condition,message){if(!condition)throw new Error(`Staff stability validation failed: ${message}`)}

const wrangler=read('wrangler.backend.jsonc');
const protectionEntry=read('worker/index-data-protection.ts');
const caregiverEntry=read('worker/index-caregiver-click-stability.ts');
const uiEntry=read('worker/index-ui-stability.ts');
const strictEntry=read('worker/index-account-stability.ts');
const entry=read('worker/index-stability.ts');
const evaluations=read('worker/evaluations-v2.ts');
const controller=read('preview/evaluation-module-controller-v2.js');
const runtime=read('preview/server-evaluation-runtime-v4.js');

new Function(controller);
new Function(runtime);

expect(wrangler.includes('worker/index-data-protection.ts'),'data protection worker is not the active outer entrypoint');
expect(protectionEntry.includes('import app from "./index-caregiver-click-stability"'),'data protection worker does not delegate to the current caregiver/UI entrypoint');
expect(caregiverEntry.includes('import app from "./index-ui-stability"'),'caregiver interaction worker does not preserve the UI stability layer');
expect(uiEntry.includes('import app from "./index-account-stability"'),'UI worker does not wrap strict account stability');
expect(strictEntry.includes('import app from "./index-stability"'),'strict worker does not wrap the stabilized worker');
expect(entry.includes('evaluation-module-controller-v2.js'),'new evaluation controller is not injected');
expect(entry.includes('evaluation-module-controller.js'),'old evaluation controller is not stripped');
for(const legacy of [
  'evaluation-directory-pagination-fix.js',
  'server-evaluation-runtime-v2.js',
  'recruiter-server-runtime.js',
  'recruiter-live-runtime-loader.js',
])expect(entry.includes(legacy),`legacy runtime ${legacy} is not stripped from final HTML`);

expect(!runtime.includes('setInterval('),'evaluation runtime must not poll');
expect(!runtime.includes('MutationObserver'),'evaluation runtime must not observe the whole page');
expect(!runtime.includes('window.renderModule='),'evaluation runtime must not replace the global router');
expect(!runtime.includes('#sidebarNav'),'evaluation runtime must not own staff navigation');
expect(runtime.includes("can('create')"),'create permission is not enforced in the UI');
expect(runtime.includes("can('update')"),'update permission is not enforced in the UI');
expect(runtime.includes('type="date"'),'period storage inputs are missing');
expect(runtime.includes('durationDays('),'period duration hint is missing');
expect(!runtime.includes("prompt('عنوان دوره"),'legacy prompt-based period creation is still active');
expect(runtime.includes("finally{state.savingIndicator='';render()}"),'indicator save does not reliably unlock and rerender the form');
expect(runtime.includes('state.openIndicator=next'),'next indicator is not opened after a successful save');
expect(runtime.includes('state.periodDialogOpen=true'),'new period dialog is not implemented');

expect(controller.includes('stopImmediatePropagation'),'controller does not prevent legacy navigation races');
expect(controller.includes('__salamatServerEvaluationRuntimeV3=true'),'third generation runtime is not retired');
expect(controller.includes('SalamatEvaluationModuleV4'),'fourth generation runtime is not activated');

expect(evaluations.includes('includeAudit && saved'),'scorer identity is not conditionally projected');
expect(evaluations.includes('actor.role.toUpperCase() === "ADMIN"'),'admin-only audit visibility is not enforced');
expect(evaluations.includes('LEFT JOIN users u ON u.id=s.scored_by_user_id'),'scorer identity is not read from the database');
const getStart=evaluations.indexOf('export async function getCaregiverEvaluationV2');
const createStart=evaluations.indexOf('export async function createEvaluationPeriodV2');
const getBody=evaluations.slice(getStart,createStart);
expect(!getBody.includes('createPeriodRecord('),'opening evaluation must not create a draft period');

console.log('Protected backend delegation, staff shell, evaluation period UI, and save-flow contract passed.');
