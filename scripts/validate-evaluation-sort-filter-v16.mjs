import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`evaluation sort/filter v16: ${message}`)};

const worker=read('worker/caregiver-directory-page.ts');
const desktop=read('desktop-react/evaluations-v4.tsx');
const mobile=read('mobile-react/admin-evaluations-v4.tsx');
const app=read('desktop-react/app.tsx');
const router=read('mobile-react/admin-router-v2.tsx');

expect(worker.includes('"evaluation_oldest"'),'backend missing evaluation_oldest sort key');
expect(worker.includes('evaluation_oldest: `CASE WHEN ${lastEvaluationAtSql} IS NULL THEN 1 ELSE 0 END ASC, ${lastEvaluationAtSql} ASC'),'evaluation_oldest must keep unevaluated rows last and evaluated rows ascending');
for(const [name,source] of [['desktop',desktop],['mobile',mobile]]){
 for(const value of ['evaluation_recent','evaluation_oldest','score_desc','stars_desc'])expect(source.includes(value),`${name} missing sort ${value}`);
 expect(source.includes('specialty'),`${name} missing specialty filter`);
 expect(source.includes('gender'),`${name} missing gender filter`);
 expect(source.includes('مرتب‌سازی'),`${name} missing sort control`);
 expect(source.includes('فیلتر'),`${name} missing filter control`);
 expect(source.includes('/api/admin/caregivers-page'),`${name} must apply controls to canonical paged API`);
}
expect(app.includes('from "./evaluations-v4"'),'desktop app is not wired to evaluations v4');
expect(router.includes('from "./admin-evaluations-v4"'),'mobile router is not wired to evaluations v4');
console.log('Evaluation sort/filter v16 contract passed for backend, desktop and mobile.');
