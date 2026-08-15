import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const has=(text,needle,message)=>must(text.includes(needle),message||`missing: ${needle}`);

const migration=read('migrations/0113_contract_case_multi_period_history.sql');
has(migration,'CREATE TABLE IF NOT EXISTS contract_cases_v3','V3 contract case table must be additive');
has(migration,'job_contract_id TEXT NOT NULL UNIQUE','canonical contract id must be unique in V3');
has(migration,'job_ad_id TEXT NOT NULL,','job ad must be a non-unique historical grouping key');
must(!migration.includes('DROP TABLE contract_cases_v2'),'V2 contract history must not be dropped');
has(migration,'trg_job_contract_status_to_case_v3','canonical status must synchronize V3 history');

const lifecycle=read('worker/contract-lifecycle-v3.ts');
has(lifecycle,'FROM contract_cases_v3','manager contract list must read V3');
has(lifecycle,'WHERE job_contract_id=? LIMIT 1','reconcile identity must be canonical job contract');
has(lifecycle,'reconcileAllContractCasesV3','all canonical contracts must be backfillable');

const guarantee=read('worker/admin-contract-row-guarantee-v1.ts');
has(guarantee,'from "./contract-lifecycle-v3"','admin row guarantee must use V3 lifecycle');
has(guarantee,'LEFT JOIN contract_cases_v3 c ON c.job_contract_id=jc.id','missing-row repair must be period-specific');
must(!guarantee.includes('WHERE job_ad_id=? LIMIT 1'),'V3 guarantee must never collapse periods by job ad');

const list=[read('worker/contract-list-points-v1.ts'),fs.existsSync('worker/contract-list-points-base-v1.ts')?read('worker/contract-list-points-base-v1.ts'):''].join('\n');
has(list,'normalizeContractDate','contract API must normalize Jalali filters');
has(list,'invalid_jalali_date','invalid Persian dates must fail explicitly');
has(list,'FROM contract_cases_v3','contract list decorator must read multi-period V3');
has(list,'multi-period-v3-jalali','production response must expose V3/Jalali diagnostic source');

const contractUi=read('desktop-react/contracts-lifecycle-v6.tsx');
has(contractUi,'۱۴۰۵/۰۵/۲۱','contract date input must visibly be Jalali');
has(contractUi,'تاریخ شمسی','contract filter accessibility label must identify Jalali dates');
const contractOwner=read('desktop-react/contracts-lifecycle-v2.tsx');
must(contractOwner.includes('./contracts-lifecycle-v7')||contractOwner.includes('./contracts-lifecycle-v6'),'desktop owner must activate Jalali contract UI');

const ads=read('worker/staff-job-ad-list-filters-v1.ts');
for(const token of ['newest','oldest','points_desc','points_asc','contractType','shiftType','consultantId'])has(ads,token,`job-ad filter route missing ${token}`);
has(ads,'COALESCE(a.reward_points,a.contract_points,0)','job-ad point ordering must use displayed reward points');
has(ads,'hasActiveContract','job-ad list must preserve contract display state');

const adsUi=read('desktop-react/job-ads-v4.tsx');
for(const label of ['جدیدترین آگهی','قدیمی‌ترین آگهی','بالاترین امتیاز','پایین‌ترین امتیاز','نوع آگهی','شیفت آگهی','مشاور آگهی'])has(adsUi,label,`desktop job-ad UI missing ${label}`);
has(read('desktop-react/job-ads-v1.tsx'),'./job-ads-v4','desktop job-ad owner must activate V4 filters');

const index=read('worker/index-desktop-react-v1.ts');
has(index,'from "./contract-lifecycle-v3"','production owner must route contract APIs through V3');
has(index,'routeStaffJobAdListFiltersV1','production owner must route staff job-ad filters');

console.log('contract history V3, Jalali filters, and job-ad filter/sort invariants: OK');
