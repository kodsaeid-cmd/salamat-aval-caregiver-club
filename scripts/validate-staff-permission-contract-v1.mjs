import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const access=read('worker/access-control.ts');
const gateway=read('worker/index-account-stability.ts');
const jobAds=read('worker/job-ads-v1.ts');
const training=read('worker/training.ts');
const trainingAdmin=read('worker/training-admin.ts');
const trainingCaregivers=read('worker/training-caregivers.ts');
const caregiverDirectory=read('worker/caregiver-directory-page.ts');
const accountDirectory=read('worker/admin-directory-light.ts');
const profileImages=read('worker/profile-images.ts');
const mobileAdmin=read('mobile-react/admin.tsx');
const desktopApp=read('desktop-react/app.tsx');

const required=[
  'staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.job_ads',
  'staff.payroll','staff.financial_credits','staff.training','staff.evaluations',
  'staff.support','staff.reports','staff.settings',
];
const errors=[];
for(const key of required){
  if(!access.includes(`key: "${key}"`))errors.push(`access-control missing canonical module ${key}`);
  if(!gateway.includes(`module:"${key}"`)&&!['staff.dashboard'].includes(key)){
    const special={
      'staff.job_ads':'staff.job_ads','staff.financial_credits':'staff.financial_credits',
      'staff.payroll':'staff.payroll','staff.training':'staff.training','staff.evaluations':'staff.evaluations',
      'staff.support':'staff.support','staff.reports':'staff.reports','staff.settings':'staff.settings',
      'staff.contracts':'staff.contracts','staff.caregivers':'staff.caregivers','staff.users':'staff.users',
    }[key];
    if(special&&!gateway.includes(special))errors.push(`gateway missing route coverage for ${key}`);
  }
}

const forbidden=[
  [jobAds,/const\s+STAFF_ROLES\s*=/,'job ads must not use a staff role allow-list'],
  [training,/ASSIGNER_ROLES|staffAllowed\s*\(/,'training operations must use canonical ACL'],
  [trainingAdmin,/ALLOWED_ROLES|ADMIN.*,RECRUITER.*,HR/,'training dashboard must not use legacy role allow-list'],
  [trainingCaregivers,/ALLOWED_ROLES|DIRECTORY_ROLES/,'training caregiver picker must not use legacy role allow-list'],
  [caregiverDirectory,/DIRECTORY_ROLES|ALLOWED_ROLES/,'caregiver directory must not use legacy role allow-list'],
  [accountDirectory,/actor\.role\.toUpperCase\(\)\s*!==\s*["']ADMIN["']/,'account directory must use staff.users ACL'],
];
for(const [source,re,message] of forbidden)if(re.test(source))errors.push(message);

for(const marker of [
  'requireAccess(env,actor,"staff.job_ads"',
  'requireAccess(env, actor, "staff.training"',
  'requireAccess(env, actor, "staff.caregivers"',
  'requireAccess(env,actor,"staff.users"',
]){
  const haystack=[jobAds,training,caregiverDirectory,accountDirectory].join('\n');
  if(!haystack.includes(marker))errors.push(`expected canonical ACL marker missing: ${marker}`);
}

for(const key of ['staff.job_ads','staff.financial_credits','staff.training','staff.evaluations','staff.caregivers','staff.users']){
  if(!mobileAdmin.includes(key))errors.push(`mobile staff UI missing ${key}`);
}
for(const key of ['staff.job_ads','staff.financial_credits','staff.training','staff.evaluations','staff.caregivers','staff.users']){
  if(!desktopApp.includes(key)&&!read('desktop-react/modules-admin.tsx').includes(key))errors.push(`desktop staff UI missing ${key}`);
}

if(!profileImages.includes('staff.caregivers'))errors.push('profile images are not tied to caregiver ACL');
if(!access.includes('overrideValue !== undefined && overrideValue !== null'))errors.push('explicit user deny/allow precedence is missing');
if(!gateway.includes('compatibilityRoute'))errors.push('legacy compatibility routes are not behind the canonical gateway');

if(errors.length){
  console.error('STAFF PERMISSION CONTRACT FAILED');
  for(const error of errors)console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Staff Permission Contract v1 passed: ${required.length} canonical staff modules are wired through ACL.`);
