import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver directory filters v1 failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);

const backend=read('worker/caregiver-directory-page.ts');
const desktop=read('desktop-react/caregiver-directory-filters-v1.tsx');
const desktopApp=read('desktop-react/app.tsx');
const mobile=read('mobile-react/admin-caregivers-v5.tsx');
const mobileRouter=read('mobile-react/admin-router-v2.tsx');

for(const value of ['gender','ageMin','ageMax','specialty','sort'])has(backend,`url.searchParams.get("${value}")`,`backend does not read ${value}`);
for(const value of ['evaluation_due','evaluation_recent','created_desc','created_asc','age_asc','age_desc','score_desc','name_asc'])has(backend,value,`backend sort missing ${value}`);
for(const value of ['caregiver_evaluation_periods','lastEvaluationAt','lastEvaluationStatus','lastEvaluationScore','skills_json AS skillsJson','c.gender','AS age'])has(backend,value,`backend metadata missing ${value}`);
has(backend,"CASE WHEN ${lastEvaluationAtSql} IS NULL THEN 0 ELSE 1 END ASC",'evaluation due sort must prioritize never-evaluated caregivers');

for(const value of ['جنسیت','سن از','سن تا','تخصص / گروه خدمتی','ترتیب نمایش','evaluation_due','created_desc','score_desc'])has(desktop,value,`desktop filter missing ${value}`);
has(desktop,'url.pathname==="/api/admin/caregivers-page"','desktop wrapper must scope filter forwarding to caregiver directory only');
has(desktop,'CaregiversActivityPage','desktop must preserve the existing rich caregiver activity scorecard');
has(desktopApp,'from "./caregiver-directory-filters-v1"','desktop app is not using filtered caregiver directory');

for(const value of ['gender','ageMin','ageMax','specialty','sort','evaluation_due','created_desc','score_desc','فیلتر و ترتیب نمایش','lastEvaluationAt','primaryType','item.age','genderFa'])has(mobile,value,`mobile v5 missing ${value}`);
has(mobileRouter,'AdminCaregiversMobileV5','mobile router is not using caregiver v5');

console.log('Caregiver directory filters v1 passed: server-side age/gender/specialty filtering and evaluation/profile sorting are wired on desktop and mobile.');
