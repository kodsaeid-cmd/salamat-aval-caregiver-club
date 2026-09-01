import fs from 'node:fs';
import {chromium} from 'playwright';

const [requestedBaseUrl,metadataPath]=process.argv.slice(2);
const password=process.env.ADMIN_CORE_SMOKE_PASSWORD||'';
const ALLOWED_BASE_URL='https://salamatavalcaregivers.site';
if(!requestedBaseUrl||!metadataPath||!password)throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-priority-browser-smoke-v2.mjs <base-url> <metadata-path>');
const normalized=requestedBaseUrl.replace(/\/+$/,'');if(normalized!==ALLOWED_BASE_URL)throw new Error(`Browser smoke target is not allowlisted: ${normalized}`);
const baseUrl=ALLOWED_BASE_URL,host='salamatavalcaregivers.site';
const metadata=JSON.parse(fs.readFileSync(metadataPath,'utf8')),rootUser=metadata.users?.root,caregiverUser=metadata.users?.caregiver;
if(!rootUser?.username||!caregiverUser?.username)throw new Error('Root or caregiver smoke identity is missing.');
const EXPECTED_LABELS=['داشبورد مدیریتی','کاربران و دسترسی‌ها','پرونده مراقبین','قراردادها','بانک آگهی‌ها','حقوق و پرداخت','اعتبارات مالی','بانک آموزش','ارزیابی و پروانه','پشتیبانی','مرکز پیامک','تنظیمات و لاگ'];
const ROUTES=[
 ['کاربران و دسترسی‌ها','/app/users','کاربران و دسترسی‌ها','وضعیت حساب'],
 ['پرونده مراقبین','/app/caregivers','پرونده مراقبین','مراقب'],
 ['قراردادها','/app/contracts','قراردادها','قرارداد'],
 ['بانک آگهی‌ها','/app/job_ads','بانک آگهی‌ها','آگهی'],
 ['حقوق و پرداخت','/app/payroll','حقوق و پرداخت','حقوق'],
 ['اعتبارات مالی','/app/financial_credits','اعتبارات مالی','اعتبار'],
 ['بانک آموزش','/app/training','بانک آموزش','آموزش'],
 ['ارزیابی و پروانه','/app/evaluations','ارزیابی و پروانه','ارزیابی'],
 ['پشتیبانی','/app/support','پشتیبانی','پشتیبانی'],
 ['مرکز پیامک','/app/sms_center','مرکز پیامک','پیامک'],
 ['تنظیمات و لاگ','/app/settings','تنظیمات و لاگ','تنظیمات'],
];
const evidenceDir='.admin-core-smoke';fs.mkdirSync(evidenceDir,{recursive:true,mode:0o700});
const resultPath=`${evidenceDir}/priority-browser-result.json`,failurePath=`${evidenceDir}/priority-browser-failure.json`;
const expect=(condition,message)=>{if(!condition)throw new Error(`Admin priority browser smoke v2 failed: ${message}`)};
async function login(identifier){const response=await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({identifier,password})});const body=await response.json().catch(()=>({}));expect(response.status===200,`login ${identifier} returned ${response.status}: ${JSON.stringify(body)}`);const values=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];const raw=values[0]||response.headers.get('set-cookie')||'',pair=raw.split(';')[0],index=pair.indexOf('=');expect(index>0,'session cookie missing');return{name:pair.slice(0,index),value:pair.slice(index+1),body}}
function browserCookie(session){return{name:session.name,value:session.value,domain:host,path:'/',secure:true,httpOnly:true,sameSite:'Lax'}}
function attachErrors(page,bucket){const ignored=['fonts.googleapis.com','static.cloudflareinsights.com'];page.on('pageerror',e=>bucket.push(`pageerror: ${e.stack||e.message}`));page.on('console',m=>{if(m.type()==='error'&&!ignored.some(x=>m.text().includes(x)))bucket.push(`console: ${m.text()}`)})}
async function assertNoUiError(page,label){const text=(await page.locator('body').innerText()).slice(0,12000);expect(!text.includes('دریافت اطلاعات انجام نشد'),`${label} shows data retrieval error`);expect(!text.includes('خطا در بارگذاری ماژول'),`${label} shows module load error`);expect(!text.includes('Application error'),`${label} shows application error`)}

const browser=await chromium.launch({headless:true});
const errors=[];let desktopLabels=[],desktopRoutes=[],mobileAdmin={},caregiverScorecard={};
try{
 const rootSession=await login(rootUser.username);expect(String(rootSession.body?.data?.role||'').toUpperCase()==='ADMIN','root fixture is not ADMIN');
 const desktop=await browser.newContext({locale:'fa-IR',viewport:{width:1440,height:950}});await desktop.addCookies([browserCookie(rootSession)]);const page=await desktop.newPage();attachErrors(page,errors);const response=await page.goto(`${baseUrl}/app/?prelaunch=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});expect(response?.status()===200,'desktop React app did not return 200');await page.waitForSelector('.da-app',{timeout:30000});await page.waitForFunction(()=>document.querySelectorAll('.da-sidebar nav button').length>=12,null,{timeout:30000});desktopLabels=await page.locator('.da-sidebar nav button strong').allTextContents();desktopLabels=desktopLabels.map(x=>x.trim());expect(JSON.stringify(desktopLabels)===JSON.stringify(EXPECTED_LABELS),`desktop sidebar labels differ: ${JSON.stringify(desktopLabels)}`);expect(await page.locator('.da-sidebar nav button svg').count()>=12,'desktop sidebar line icons are missing');
 for(const [label,path,title,marker] of ROUTES){const button=page.locator('.da-sidebar nav button').filter({hasText:label}).first();await button.click();await page.waitForFunction(({path,title})=>location.pathname===path&&document.querySelector('.da-top-title strong')?.textContent?.trim()===title,{path,title},{timeout:30000});await page.waitForFunction(marker=>{const main=document.querySelector('.da-main');if(!main)return false;const text=main.textContent||'';return !text.includes('در حال آماده‌سازی')&&!text.includes('در حال دریافت اطلاعات')&&text.includes(marker)},marker,{timeout:30000}).catch(()=>{});await assertNoUiError(page,label);desktopRoutes.push({label,path:page.url().replace(baseUrl,''),title:(await page.locator('.da-top-title strong').textContent())?.trim()||''})}
 await page.screenshot({path:`${evidenceDir}/priority-router.png`,fullPage:true});await desktop.close();

 const mobileAdminContext=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobileAdminContext.addCookies([browserCookie(rootSession)]);const adminPage=await mobileAdminContext.newPage();attachErrors(adminPage,errors);
 for(const [route,marker] of [['/mobile/admin/job_ads','بانک آگهی‌ها'],['/mobile/admin/caregivers','پرونده مراقبین'],['/mobile/admin/financial_credits','اعتبارات']]){const r=await adminPage.goto(`${baseUrl}${route}?prelaunch=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});expect(r?.status()===200,`${route} did not return 200`);await adminPage.waitForSelector('#mobile-admin-root',{timeout:30000});await adminPage.waitForFunction(marker=>(document.querySelector('#mobile-admin-root')?.textContent||'').includes(marker),marker,{timeout:30000});await assertNoUiError(adminPage,route);mobileAdmin[route]=true}
 await adminPage.screenshot({path:`${evidenceDir}/priority-mobile-admin.png`,fullPage:true});await mobileAdminContext.close();

 const caregiverSession=await login(caregiverUser.username);expect(String(caregiverSession.body?.data?.role||'').toUpperCase()==='CAREGIVER','caregiver fixture is not CAREGIVER');const caregiverContext=await browser.newContext({locale:'fa-IR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});await caregiverContext.addCookies([browserCookie(caregiverSession)]);const caregiverPage=await caregiverContext.newPage();attachErrors(caregiverPage,errors);const cr=await caregiverPage.goto(`${baseUrl}/mobile/scorecard?prelaunch=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});expect(cr?.status()===200,'caregiver scorecard did not return 200');await caregiverPage.waitForSelector('.caregiver-self-scorecard',{timeout:30000});await caregiverPage.waitForSelector('#cmsc-scorecard-tabs',{timeout:30000});const tabCount=await caregiverPage.locator('#cmsc-scorecard-tabs button[data-tab]').count(),iconCount=await caregiverPage.locator('#cmsc-scorecard-tabs .cmsc-tab-icon svg').count();expect(tabCount===4,`caregiver scorecard tab count is ${tabCount}`);expect(iconCount===4,`caregiver scorecard icon count is ${iconCount}`);for(const button of await caregiverPage.locator('#cmsc-scorecard-tabs button[data-tab]').all()){await button.click();await caregiverPage.waitForTimeout(120)}await assertNoUiError(caregiverPage,'caregiver scorecard');caregiverScorecard={tabCount,iconCount,allTabsClickable:true};await caregiverPage.screenshot({path:`${evidenceDir}/priority-caregiver-scorecard.png`,fullPage:true});await caregiverContext.close();

 expect(errors.length===0,`browser errors: ${errors.join(' | ')}`);fs.writeFileSync(resultPath,JSON.stringify({desktopReact:{labels:desktopLabels,routes:desktopRoutes,modules:12},mobileAdmin,caregiverScorecard,browserErrors:errors,verifiedAt:new Date().toISOString()},null,2),{mode:0o600});console.log('Admin priority browser smoke v2 passed: 12 desktop React modules, mobile admin critical routes and caregiver scorecard tabs are operational.');
}catch(error){fs.writeFileSync(failurePath,JSON.stringify({message:error instanceof Error?error.message:String(error),desktopLabels,desktopRoutes,mobileAdmin,caregiverScorecard,browserErrors:errors,verifiedAt:new Date().toISOString()},null,2),{mode:0o600});throw error}finally{await browser.close()}
