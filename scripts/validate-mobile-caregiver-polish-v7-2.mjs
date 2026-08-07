import fs from 'node:fs';
const runtime=fs.readFileSync('preview/mobile-caregiver-profile-icon-polish-v7-2.js','utf8');
const worker=fs.readFileSync('worker/index-unified-financial-v4.ts','utf8');
const failures=[];
const need=(source,text,message)=>{if(!source.includes(text))failures.push(message)};
try{new Function(runtime)}catch(error){failures.push(`runtime syntax: ${error.message}`)}
need(runtime,"const VERSION='7.2.0'",'missing V7.2 version');
need(runtime,'خروج از حساب کاربری','caregiver logout action missing');
need(runtime,"$('#logoutButton')?.click()",'logout must reuse canonical logout button');
need(runtime,'مشاهده و ویرایش پروفایل حرفه‌ای','caregiver profile action missing');
need(runtime,'SalamatCaregiverSelfProfile','caregiver profile must reuse canonical self profile');
for(const kind of ['score','training','calendar','support','wallet','payroll'])need(runtime,`${kind}:[`,`detailed ${kind} icon missing`);
need(runtime,"data-nav-kind=\"profile\"",'profile interception missing');
need(worker,'MOBILE_CAREGIVER_POLISH_VERSION = "7.2.0"','worker polish version missing');
need(worker,'mobile-caregiver-profile-icon-polish-v7-2.js','worker polish asset missing');
need(worker,'injectMobileCaregiverPolish(html)','worker must inject caregiver polish');
need(worker,'x-salamat-mobile-caregiver-polish','worker evidence header missing');
if(failures.length){console.error('Caregiver V7.2 polish validation failed:');for(const item of failures)console.error(` - ${item}`);process.exit(1)}
console.log('Caregiver profile logout + detailed icon polish V7.2 verified.');