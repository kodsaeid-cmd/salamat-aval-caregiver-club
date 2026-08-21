import fs from 'node:fs';

const source=fs.readFileSync('mobile-react/caregiver-job-ads-v1.tsx','utf8');
const css=fs.readFileSync('mobile-react/caregiver-job-ads-list-v2.css','utf8');
const requiredSource=[
 'cja-salary-hero',
 'cja-primary-location',
 'cja-quick-facts',
 'جنسیت موردنیاز',
 'روز در هفته',
 'شامل امتیاز تسهیلات می‌شود',
 'workdayLabel(selected.ad)',
 'gender(selected.ad)',
 'شرح کامل آگهی'
];
for(const token of requiredSource){if(!source.includes(token))throw new Error(`caregiver job ad redesign missing source token: ${token}`)}
const listStart=source.indexOf('className={`cja-card cja-card-v2');
const listEnd=source.indexOf('selected&&<div className="mr-modal-backdrop"',listStart);
const listMarkup=source.slice(listStart,listEnd);
if(listMarkup.includes('cja-condition'))throw new Error('service-recipient condition must stay out of the compact job-ad list card');
if(listMarkup.includes('text(ad.description'))throw new Error('full description must stay out of the compact job-ad list card');
if(listMarkup.includes('fa(ad.durationDays)'))throw new Error('contract duration must stay in detail view, not the compact list card');
for(const token of ['grid-template-columns:repeat(auto-fit,minmax(300px,1fr))','font-size:24px','cja-type-elderly','cja-type-child','cja-type-patient','cja-type-housekeeping','@media(max-width:760px)']){if(!css.includes(token))throw new Error(`caregiver job ad redesign missing CSS token: ${token}`)}
console.log('caregiver job ad card redesign v2 validation passed');
