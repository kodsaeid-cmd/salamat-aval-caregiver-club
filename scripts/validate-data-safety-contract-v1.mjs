import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migrationsDir=path.join(root,'migrations');
const files=fs.readdirSync(migrationsDir).filter(f=>/^\d+_.*\.sql$/i.test(f)).sort();
const safetyFloor=105;
const destructive=[
  {name:'DROP TABLE',re:/\bDROP\s+TABLE\b/i},
  {name:'DROP COLUMN',re:/\bDROP\s+COLUMN\b/i},
  {name:'TRUNCATE',re:/\bTRUNCATE\b/i},
  {name:'DELETE FROM',re:/\bDELETE\s+FROM\b/i},
  {name:'REPLACE TABLE',re:/\bALTER\s+TABLE\b[\s\S]{0,180}\bRENAME\s+TO\b/i},
];
const violations=[];
for(const file of files){
  const n=Number(file.match(/^(\d+)/)?.[1]||0);
  if(n<safetyFloor)continue;
  const sql=fs.readFileSync(path.join(migrationsDir,file),'utf8').replace(/--.*$/gm,'');
  for(const rule of destructive)if(rule.re.test(sql))violations.push(`${file}: ${rule.name}`);
}
if(violations.length){
  console.error('DATA SAFETY CONTRACT FAILED: destructive production migration detected.');
  for(const v of violations)console.error(` - ${v}`);
  console.error('Use an explicitly reviewed maintenance workflow and backup/restore plan for destructive data operations.');
  process.exit(1);
}

const uiDirs=['desktop-react','mobile-react'];
const sensitive=/\b(wallet|balance|credit|loan|points?|score|evaluation|payroll|amount|caregiverId|role|permissions?)\b/i;
const browserStore=/\b(localStorage|sessionStorage|indexedDB)\b/;
for(const dir of uiDirs){
  const base=path.join(root,dir);if(!fs.existsSync(base))continue;
  for(const name of fs.readdirSync(base)){
    if(!/\.(?:ts|tsx|js|jsx)$/.test(name))continue;
    const src=fs.readFileSync(path.join(base,name),'utf8');
    if(browserStore.test(src)&&sensitive.test(src))violations.push(`${dir}/${name}: browser storage appears alongside sensitive business data terms`);
  }
}
if(violations.length){
  console.error('DATA SAFETY CONTRACT FAILED: sensitive business truth must remain server-backed.');
  for(const v of violations)console.error(` - ${v}`);
  process.exit(1);
}

const required=[
  ['worker/job-ads-v1.ts','caregiver_contract_point_ledger'],
  ['worker/caregiver-financial-profile-v4.ts','caregiver_wallet_transactions'],
  ['worker/caregiver-scorecard-v2.ts','caregiver_evaluation_periods'],
  ['worker/access-control.ts','user_module_permissions'],
];
for(const [file,marker] of required){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  if(!src.includes(marker))violations.push(`${file}: expected server-backed source marker ${marker} missing`);
}
if(violations.length){
  console.error('DATA SAFETY CONTRACT FAILED: canonical server-backed sources changed unexpectedly.');
  for(const v of violations)console.error(` - ${v}`);
  process.exit(1);
}
console.log('Data Safety Contract v1 passed: additive migrations only, sensitive truth remains server-backed.');
