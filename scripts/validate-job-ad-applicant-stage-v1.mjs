import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const staffList=read('worker/staff-job-ad-list-filters-v1.ts');
const workforce=read('worker/admin-caregiver-workforce-summary-v1.ts');
const desktop=read('desktop-react/job-ads-v4.tsx');
const dashboard=read('desktop-react/users-dashboard-v3.tsx');

assert.match(staffList,/APPLICANT_STAGES=new Set\(\["REQUESTED","DISPATCH","CONTRACT"\]\)/,'staff list must whitelist the three applicant stages');
assert.match(staffList,/p\.get\("applicantStage"\)/,'staff list must accept applicantStage');
assert.match(staffList,/invalid_applicant_stage/,'invalid applicant stages must be rejected');
assert.match(staffList,/COALESCE\(apsc\.lifecycle_status,apsc\.status\)='IN_CONTRACT'/,'contract stage must use canonical lifecycle state');
assert.match(staffList,/COALESCE\(apsd\.lifecycle_status,apsd\.status\)='TRIAL_DISPATCH'/,'dispatch stage must use canonical lifecycle state');
assert.match(staffList,/COALESCE\(apsr\.lifecycle_status,apsr\.status\)='PENDING_CONSULTANT'/,'requested stage must use canonical lifecycle state');
assert.match(staffList,/CASE WHEN \$\{contractStageExpr\} THEN 'CONTRACT' WHEN \$\{dispatchStageExpr\} THEN 'DISPATCH' WHEN \$\{requestedStageExpr\} THEN 'REQUESTED'/,'staff rows must expose the resolved stage with contract > dispatch > requested precedence');

assert.match(desktop,/وضعیت متقاضی پرونده/,'desktop job bank must expose applicant-stage filter');
assert.match(desktop,/value="REQUESTED">فقط درخواست مراقب/);
assert.match(desktop,/value="DISPATCH">متقاضی در اعزام/);
assert.match(desktop,/value="CONTRACT">متقاضی در قرارداد/);
assert.match(desktop,/applicantStage:string/,'desktop filter state must preserve applicantStage through pagination');

assert.match(workforce,/ADMIN_CAREGIVER_WORKFORCE_SUMMARY_VERSION="1\.2\.0"/);
assert.match(workforce,/apc\.caregiver_id=ap\.caregiver_id[\s\S]*IN_CONTRACT/,'dispatch caregiver count must exclude caregivers already in contract');
assert.match(workforce,/requestedOnlyJobAds/,'dashboard summary must expose requested-only case count');
assert.match(workforce,/dispatchJobAds/,'dashboard summary must expose dispatch case count');
assert.match(workforce,/contractJobAds/,'dashboard summary must expose contract case count');
assert.match(workforce,/dispatchToJobAdsPercent:percent\(dispatchJobAds,totalJobAds\)/,'dispatch KPI must compare dispatched cases to total job ads');
assert.match(dashboard,/numerator=\{Number\(workforce\?\.dispatchJobAds\|\|0\)\}/,'dashboard dispatch gauge must use dispatched cases, not unique caregiver count');
assert.match(dashboard,/پرونده دارای متقاضی در اعزام نسبت به کل آگهی‌ها/);

console.log('job-ad applicant-stage filter and dashboard dispatch validation passed');
