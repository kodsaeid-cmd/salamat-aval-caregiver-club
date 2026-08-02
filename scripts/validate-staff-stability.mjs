import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function expect(condition,message){if(!condition)throw new Error(`Staff stability validation failed: ${message}`)}

const wrangler=read('wrangler.backend.jsonc');
const entry=read('worker/index-stability.ts');
const evaluations=read('worker/evaluations-v2.ts');
const controller=read('preview/evaluation-module-controller.js');
const runtime=read('preview/server-evaluation-runtime-v3.js');

expect(wrangler.includes('worker/index-stability.ts'),'stabilized worker is not the active entrypoint');
expect(entry.includes('evaluation-module-controller.js'),'evaluation controller is not injected');
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

expect(controller.includes('stopImmediatePropagation'),'controller does not prevent legacy navigation races');
expect(controller.includes('__salamatServerEvaluationRuntimeV2=true'),'legacy evaluation runtime is not retired');

expect(evaluations.includes('includeAudit && saved'),'scorer identity is not conditionally projected');
expect(evaluations.includes('actor.role.toUpperCase() === "ADMIN"'),'admin-only audit visibility is not enforced');
expect(evaluations.includes('LEFT JOIN users u ON u.id=s.scored_by_user_id'),'scorer identity is not read from the database');
const getStart=evaluations.indexOf('export async function getCaregiverEvaluationV2');
const createStart=evaluations.indexOf('export async function createEvaluationPeriodV2');
const getBody=evaluations.slice(getStart,createStart);
expect(!getBody.includes('createPeriodRecord('),'opening evaluation must not create a draft period');

console.log('Staff shell and evaluation stability contract passed.');
