import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`UI stability validation failed: ${message}`)};

const wrangler=read('wrangler.backend.jsonc');
const entry=read('worker/index-ui-stability.ts');
const bootstrap=read('preview/staff-shell-bootstrap-v3.js');
const jalali=read('preview/evaluation-jalali-calendar.js');

expect(wrangler.includes('worker/index-ui-stability.ts'),'UI stability worker is not the active entrypoint');
expect(entry.includes('staff-shell-bootstrap-v3.js'),'staff shell bootstrap is not injected');
expect(entry.includes('evaluation-jalali-calendar.js'),'Jalali calendar is not injected');
expect(entry.includes('import app from "./index-account-stability"'),'UI worker does not preserve account/access stability');

expect(bootstrap.includes('salamat-shell-preparing'),'legacy staff shell is not hidden during access resolution');
expect(bootstrap.includes('visibility:hidden!important'),'pre-render shell suppression is missing');
expect(bootstrap.includes("justify-content','flex-start','important'"),'compact navigation alignment is missing');
expect(bootstrap.includes('navigationReady(snapshot)'),'staff panel is revealed before authorized navigation is ready');
expect(!bootstrap.includes('setInterval('),'staff shell bootstrap must not poll with setInterval');

expect(jalali.includes('jalaliToIso'),'Jalali to Gregorian storage conversion is missing');
expect(jalali.includes('isoToJalali'),'Gregorian storage to Jalali display conversion is missing');
expect(jalali.includes('تقویم رسمی هجری شمسی'),'Persian calendar UI is missing');
expect(jalali.includes("input.type='hidden'"),'native Gregorian date control is not retired');
expect(jalali.includes('MONTHS=['),'Persian month names are missing');
expect(jalali.includes('data-sjal-day'),'calendar day selection is missing');
expect(!jalali.includes('setInterval('),'Jalali calendar must not use polling');

console.log('Jalali calendar, compact navigation and no-flash staff shell contract passed.');
