import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`OTP/SMS validation failed: ${message}`)};
const has=(source,value,label)=>expect(source.includes(value),`${label} missing ${value}`);
const lacks=(source,value,label)=>expect(!source.includes(value),`${label} contains forbidden ${value}`);
const syntax=path=>{const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(result.status===0,`${path} syntax: ${result.stderr||result.stdout}`)};

const auth=read('worker/auth.ts');
const sms=read('worker/sms-delivery-v1.ts');
const dispatcher=read('worker/caregiver-change-dispatcher-v1.ts');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const migration=read('migrations/0105_otp_sms_caregiver_notifications.sql');
const runtime=read('preview/login-otp-sms-runtime-v1.js');
const envExample=read('.env.example');

syntax('preview/login-otp-sms-runtime-v1.js');
for(const value of [
  'OTP_TTL_SECONDS, sendOtpCode','sendOtpCode(env, mobile, code)','otp_resend_limited',
  'resendAfterSeconds: OTP_TTL_SECONDS','LOGIN_OTP','expires_at>?',
])has(auth,value,'auth');
lacks(auth,'300_000','auth five-minute OTP');
lacks(auth,'expiresInSeconds: 300','auth five-minute response');

for(const value of [
  'SMS_DELIVERY_VERSION = "1.0.0"','OTP_TTL_SECONDS = 120','https://api.sms.ir/v1/send/verify',
  'https://api.sms.ir/v1/send/bulk','SMS_GATEWAY_URL','SMS_NOTIFICATIONS_ENABLED',
  'sms_delivery_log','mobile_hash','notifyCaregiverChangeFromAudit','sendCaregiverNotificationSms',
])has(sms,value,'sms delivery');
lacks(sms,'console.log(code','OTP secrecy');
lacks(sms,'mobile TEXT NOT NULL','SMS evidence must not persist plaintext mobile');

for(const value of [
  'caregiver_change_dispatches','LEFT JOIN caregiver_change_dispatches','d.audit_id IS NULL',
  'CREATE_SUPPORT_(?:MESSAGE|THREAD)','processPendingCaregiverChangeNotifications',
])has(dispatcher,value,'dispatcher');

for(const value of [
  'LOGIN_OTP_SMS_VERSION = "paused"','x-salamat-login-otp-sms','x-salamat-caregiver-sms-notifications',
  'processPendingCaregiverChangeNotifications(env, 5)','finally {','stripRuntime(html, fileName)',
])has(wrapper,value,'worker wrapper');
const runtimeBlock=wrapper.slice(wrapper.indexOf('const RUNTIMES'),wrapper.indexOf('function runtimeVersion'));
lacks(runtimeBlock,'"login-otp-sms-runtime-v1.js"','paused OTP live runtime');
const removalBlock=wrapper.slice(wrapper.indexOf('for (const fileName of ['),wrapper.indexOf('html = injectCriticalRuntimes'));
has(removalBlock,'"login-otp-sms-runtime-v1.js"','paused OTP legacy removal');

for(const value of [
  'idx_otp_mobile_active_created','sms_delivery_log','caregiver_change_dispatches',
  "'pre_sms_baseline'",'trg_sms_delivery_no_update_v1','trg_sms_delivery_no_delete_v1',
])has(migration,value,'migration');
expect(migration.indexOf("'pre_sms_baseline'")<migration.indexOf('trg_sms_delivery_no_update_v1'),'historical audit baseline must precede immutable delivery triggers');

for(const value of [
  "const VERSION='1.0.0'","const TTL=120",'window.addEventListener(\'click\',captureClick,true)',
  "window.addEventListener('submit'",'/api/auth/request-otp','/api/auth/verify-otp',
  'پشتیبانی شبانه‌روزی سلامت اول','tel:1527','قدرت گرفته از مرکز سلامت اول','by Kod',
])has(runtime,value,'dormant login runtime');
lacks(runtime,"mobile.value='09128668837'",'login demo mobile');
lacks(runtime,"otp.value='152700'",'login demo OTP');

for(const value of [
  'SMS_PROVIDER="SMSIR"','SMSIR_API_KEY="replace-with-secret"','SMSIR_OTP_TEMPLATE_ID',
  'SMS_NOTIFICATIONS_ENABLED="true"','OTP_DEBUG="false"',
])has(envExample,value,'environment example');

console.log('OTP/SMS backend remains available, while the login OTP browser runtime is intentionally paused and stripped from the live shell.');
