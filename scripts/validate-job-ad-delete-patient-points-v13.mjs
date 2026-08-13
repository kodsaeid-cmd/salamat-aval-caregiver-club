import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const requireText=(body,text,label)=>{if(!body.includes(text))throw new Error(`${label}: missing ${text}`)};
const forbid=(body,text,label)=>{if(body.includes(text))throw new Error(`${label}: forbidden ${text}`)};

const migration=read('migrations/0114_job_ad_soft_delete_patient_points.sql');
requireText(migration,'ALTER TABLE care_job_ads ADD COLUMN deleted_at TEXT','migration tombstone');
requireText(migration,"recipient_condition='PATIENT'",'migration patient condition');
requireText(migration,'130.0 * duration_days / 180.0','migration patient scale');
requireText(migration,'points_basis_days=180','migration patient basis');
requireText(migration,'points_base_value=130','migration patient base');

const mutation=read('worker/job-ad-mutation-policy-v13.ts');
requireText(mutation,'PATIENT:{PATIENT:{label:"بیمار",normal:130,temporary:130}}','backend patient rule');
requireText(mutation,'const basisDays=patient?180','backend patient basis');
requireText(mutation,'const recipientCondition=contractType==="PATIENT"?"PATIENT"','backend fixed patient condition');
requireText(mutation,"SET status='CLOSED',deleted_at=?",'safe tombstone delete');
requireText(mutation,"status='ACTIVE'",'active contract deletion guard');
requireText(mutation,'active_contract_blocks_delete','active contract error');
forbid(mutation,"SET status='DELETED'",'legacy illegal delete status');

const list=read('worker/staff-job-ad-list-filters-v1.ts');
requireText(list,'routeJobAdMutationPolicyV13(request,env)','mutation owner before legacy controls');
requireText(list,'a.deleted_at IS NULL','tombstone list exclusion');
requireText(list,'staff-filter-v13-tombstone','list source evidence');
const outer=read('worker/index-desktop-react-v1.ts');
const listPos=outer.indexOf('routeStaffJobAdListFiltersV1(request,env)'),controlPos=outer.indexOf('routeContractExitJobAdUserControlsV1(request,env)');
if(listPos<0||controlPos<0||listPos>controlPos)throw new Error('canonical bank route must execute before legacy job-ad controls');
const wrangler=read('wrangler.backend.jsonc');
requireText(wrangler,'./worker/index-desktop-react-v1.ts','canonical production entry');

const ui=read('shared/job-ad-patient-points-v13.ts');
requireText(ui,"option.value='PATIENT'",'fixed UI patient condition');
requireText(ui,"option.textContent='بیمار'",'fixed UI patient label');
requireText(ui,'130*Math.max(1,Number(digits(duration))||1)/180','live patient scaling');
requireText(ui,"condition.disabled=true",'no patient condition choice');
requireText(read('desktop-react/job-ads-v1.tsx'),'../shared/job-ad-patient-points-v13','desktop patient runtime');
requireText(read('mobile-react/admin-job-ads-v3.tsx'),'../shared/job-ad-patient-points-v13','mobile patient runtime');

const points=days=>Math.max(1,Math.round(130*days/180));
const expected=new Map([[90,65],[180,130],[360,260],[10,7]]);
for(const [days,want] of expected){const got=points(days);if(got!==want)throw new Error(`patient points ${days}d: expected ${want}, got ${got}`)}

console.log('job ad delete + patient points v13 validation passed',Object.fromEntries([...expected].map(([days,value])=>[`${days}d`,value])));
