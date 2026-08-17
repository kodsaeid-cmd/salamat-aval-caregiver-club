import fs from 'node:fs';
const read=(path)=>fs.readFileSync(path,'utf8');
const migration=read('migrations/0123_job_ad_weekdays_score_v1.sql');
const policy=read('shared/job-ad-weekday-policy-v1.ts');
const runtime=read('shared/job-ad-weekdays-runtime-v1.ts');
const worker=read('worker/job-ad-weekdays-policy-v14.ts');
const router=read('worker/staff-job-ad-list-filters-v1.ts');
const desktop=read('desktop-react/job-ads-v1.tsx');
const mobile=read('mobile-react/admin-job-ads-v3.tsx');
const workflow=read('.github/workflows/contract-exit-job-ad-user-controls.yml');
const expect=(value,message)=>{if(!value)throw new Error(`Job-ad weekdays v14 validation failed: ${message}`)};
const has=(source,needle,message)=>expect(source.includes(needle),message);

has(migration,'ADD COLUMN work_weekdays_json','work-weekdays column missing');
has(migration,'ADD COLUMN weekday_score_factor','weekday score factor column missing');
has(migration,'["SAT","SUN","MON","TUE","WED","THU"]','legacy/default six-day baseline missing');
expect(!/\b(?:DROP|DELETE|UPDATE)\b/i.test(migration),'migration must remain additive and non-destructive');

for(const day of ['SAT','SUN','MON','TUE','WED','THU','FRI'])has(policy,`key:"${day}"`,`${day} weekday option missing`);
for(const label of ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'])has(policy,label,`${label} canonical weekday label missing`);
has(policy,'return Math.min(1,(6+count)/12)','two-fewer-days => one-effective-workday formula missing');
has(policy,'Math.min(6,normalizeJobAdWeekdays(value).length)','six-day score ceiling missing');
const factor=(count)=>Math.min(1,(6+Math.min(6,count))/12);
expect(factor(7)===1&&factor(6)===1,'six/seven days must remain at full score');
expect(Math.abs(factor(5)-11/12)<1e-12,'five-day factor must be 11/12');
expect(Math.abs(factor(4)-10/12)<1e-12,'four-day factor must be 10/12');
expect(Math.abs(factor(3)-9/12)<1e-12,'three-day factor must be 9/12');
expect(Math.abs(factor(2)-8/12)<1e-12,'two-day factor must be 8/12');
expect(Math.abs(factor(1)-7/12)<1e-12,'one-day factor must be 7/12');

has(runtime,'روزهای کاری هفته','weekday selector UI missing');
has(runtime,'JOB_AD_WEEKDAYS.map','weekday selector is not rendered from canonical Saturday-Friday options');
has(runtime,'body.workWeekdays=days','weekday selection is not sent with create/update');
has(runtime,'applyJobAdWeekdayScore','live score is not weekday-adjusted');
has(runtime,'جمعه قابل انتخاب است اما امتیاز را بالاتر از سقف ۶ روزه نمی‌برد.','score-ceiling explanation missing');

has(worker,'routeJobAdWeekdaysPolicyV14','v14 route export missing');
has(worker,'حداقل یک روز کاری هفته را انتخاب کنید.','server-side empty-week validation missing');
has(worker,'applyJobAdWeekdayScore','server-side score adjustment missing');
has(worker,'work_weekdays_json','weekdays are not persisted');
has(worker,'weekday_score_factor','weekday factor is not persisted');
has(worker,'mutationPolicy:"v14-weekdays"','audit policy marker missing');
has(worker,'workWeekdays:jobAdWeekdaysOrDefault','detail response does not expose saved weekdays');

expect(router.indexOf('routeJobAdWeekdaysPolicyV14(request,env)')<router.indexOf('routeJobAdMutationPolicyV13(request,env)'),'v14 must own create/update/detail before v13');
has(desktop,'job-ad-weekdays-runtime-v1','desktop weekday runtime import missing');
has(mobile,'job-ad-weekdays-runtime-v1','mobile weekday runtime import missing');
has(workflow,'validate-job-ad-weekdays-score-v14.mjs','weekday validator is not wired into workflow');

console.log('Job-ad weekdays v14 contract passed.');
