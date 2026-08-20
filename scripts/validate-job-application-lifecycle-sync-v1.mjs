import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const lifecycle=read('worker/job-application-lifecycle-v1.ts');
const jobAds=read('worker/job-ads-v2.ts');
const staffList=read('worker/staff-job-ad-list-filters-v1.ts');

assert.match(jobAds,/import \{ensureJobApplicationLifecycleSchema,lifecycleUpdateStatement\} from "\.\/job-application-lifecycle-v1"/,'legacy job-ad mutation route must use the lifecycle helper');
assert.match(jobAds,/async function updateApplication[\s\S]*await ensureJobApplicationLifecycleSchema\(env\)/,'application mutation must ensure lifecycle schema before changing status');
assert.match(jobAds,/const ts=nowIso\(\),statements=\[lifecycleUpdateStatement\(env,applicationId,next,ts\)\]/,'application mutation must update status and lifecycle_status atomically through the canonical helper');
assert.doesNotMatch(jobAds,/UPDATE care_job_applications SET status=\?,updated_at=\? WHERE id=\?/,'legacy status-only application update must not remain');

assert.match(lifecycle,/status IN \('PENDING_CONSULTANT','TRIAL_DISPATCH','REJECTED','IN_CONTRACT'\)/,'reconciliation must cover the four mutable legacy states');
assert.match(lifecycle,/lifecycle_status IN \('PENDING_CONSULTANT','TRIAL_DISPATCH','REJECTED','IN_CONTRACT'\)/,'reconciliation must only replace mutable legacy lifecycle states');
assert.match(lifecycle,/lifecycle_status<>status/,'reconciliation must repair stale lifecycle values from the current legacy status');
const reconciliation=lifecycle.match(/UPDATE care_job_applications`?[\s\S]*?lifecycle_status<>status/)?.[0]||'';
assert.ok(!reconciliation.includes("'WITHDRAWN'")&&!reconciliation.includes("'COMPLETED'"),'reconciliation must preserve canonical WITHDRAWN and COMPLETED states whose shadow status may be REJECTED');

assert.match(staffList,/import \{ensureJobApplicationLifecycleSchema\} from "\.\/job-application-lifecycle-v1"/,'staff job bank must import lifecycle reconciliation');
assert.match(staffList,/if\(url\.pathname!=="\/api\/staff\/job-ads"\|\|method!=="GET"\)return null;[\s\S]*await ensureJobApplicationLifecycleSchema\(env\)/,'staff job bank must repair stale lifecycle rows before applying applicant-stage filters');

console.log('job application lifecycle synchronization validation passed');
