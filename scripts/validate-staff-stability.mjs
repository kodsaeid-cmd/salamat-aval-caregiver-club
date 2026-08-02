import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function expect(condition,message){if(!condition)throw new Error(`Staff stability validation failed: ${message}`)}

const wrangler=read('wrangler.backend.jsonc');
const strictEntry=read('worker/index-account-stability.ts');
const entry=read('worker/index-stability.ts');
const evaluations=read('worker/evaluations-v2.ts');
const controller=read('preview/evaluation-module-controller-v2.js');
const runtime=read('preview/server-evaluation-runtime-v4.js');

new Function(controller);
new Function(runtime);

expect(wrangler.includes('worker/index-account-stability.ts'),'strict stabilized worker is not the active entrypoint');
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
expect(runtime.includes('type="date"'),'period dates do not use dropdown calendar inputs');
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

console.log('Staff shell, evaluation period UI, and save-flow contract passed.');
