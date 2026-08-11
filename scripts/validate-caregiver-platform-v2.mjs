import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver platform prelaunch v2 failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);

const wrapper=read('worker/index-caregiver-platform-v1.ts');
const support=read('preview/staff-support-direct-runtime-v3.js');
const supportOwner=read('preview/staff-support-route-owner-v3.js');
const notifications=read('preview/server-notifications-runtime-v2.js');
const browser=read('scripts/run-admin-priority-browser-smoke-v2.mjs');
const api=read('scripts/run-admin-priority-api-smoke-v2.mjs');
const registration=read('scripts/run-self-registration-production-smoke.mjs');

for(const value of ['const PLATFORM_VERSION = "2.4.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const SUPPORT_RUNTIME_VERSION = "3.0.0"','const SUPPORT_ROUTE_OWNER_VERSION = "3.0.0"','const SUPPORT_UNITY_VERSION = "3.0.0"','const NOTIFICATIONS_RUNTIME_VERSION = "2.0.0"','"contract-module-priority-v2.js"','"staff-module-router-v3.js"','"access-control-runtime-v2.js"','"staff-support-route-owner-v3.js"','"staff-support-direct-runtime-v3.js"','"server-notifications-runtime-v2.js"','x-salamat-support-unity','x-salamat-notifications-runtime','microphone=(self)'])has(wrapper,value,`worker wrapper missing ${value}`);
const runtimeBlock=wrapper.slice(wrapper.indexOf('const RUNTIMES'),wrapper.indexOf('function runtimeVersion'));
for(const forbidden of ['"staff-support-runtime-v1.js"','"staff-support-direct-runtime-v2.js"','"server-notifications-runtime.js"'])lacks(runtimeBlock,forbidden,`legacy runtime still injected: ${forbidden}`);
expect(runtimeBlock.indexOf('"staff-support-route-owner-v3.js"')<runtimeBlock.indexOf('"staff-support-direct-runtime-v3.js"'),'support owner does not precede support runtime');
expect(wrapper.indexOf('"contract-module-priority-v2.js"')<wrapper.indexOf('"staff-module-router-v3.js"')&&wrapper.indexOf('"staff-module-router-v3.js"')<wrapper.indexOf('"access-control-runtime-v2.js"'),'critical runtime order is invalid');

for(const value of ["const VERSION='3.0.0'",'window.SalamatStaffSupport={version:VERSION','/api/caregiver/platform/support/threads','navigator.mediaDevices.getUserMedia'])has(support,value,`support runtime missing ${value}`);
for(const value of ["const VERSION='3.0.0'","window.addEventListener('click',capture,true)",'window.SalamatStaffSupportRouteOwner',"owner:'window-capture'"])has(supportOwner,value,`support route owner missing ${value}`);
for(const value of ["const VERSION='2.0.0'",'SUPPORT_MESSAGE','salamat-open-support-thread','window.SalamatServerNotifications'])has(notifications,value,`notifications runtime missing ${value}`);

for(const value of ["['پشتیبانی','/app/support','پشتیبانی','پشتیبانی']","'/mobile/admin/job_ads'","'/mobile/admin/caregivers'","'/mobile/admin/financial_credits'",'/mobile/scorecard?prelaunch=','tabCount===4','iconCount===4','errors.length===0'])has(browser,value,`browser smoke v2 missing ${value}`);
for(const value of ["'staff.job_ads'","'/api/staff/job-ads?page=1'","'/api/caregiver/platform/support/threads'","passed('root.eleven-module-contract')"])has(api,value,`API smoke v2 missing ${value}`);
for(const value of ["approvalAction:'APPROVE_SELF_REGISTRATION'",'pendingApproval===true','profileOnly===false','login(pendingUser.username)'])has(registration,value,`registration smoke missing ${value}`);

console.log('Caregiver platform 2.4, 11-module staff shell, support unity v3, notifications v2, mobile critical routes and linked-registration production contracts passed.');
