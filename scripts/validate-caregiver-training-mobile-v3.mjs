import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Training/mobile v3 validation failed: ${message}`)};
const has=(source,value,label=value)=>expect(source.includes(value),`missing ${label}: ${value}`);
const lacks=(source,value,label=value)=>expect(!source.includes(value),`forbidden ${label}: ${value}`);
const syntax=path=>{const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});expect(result.status===0,`${path} syntax failed: ${result.stderr||result.stdout}`);return read(path)};

const training=syntax('preview/caregiver-training-direct-v3.js');
for(const value of [
  "const VERSION='3.0.0'",'/api/training/my','data-cgt3-open','مشاهده آموزش',
  '/api/training/enrollments/','/api/training/sessions/','/heartbeat','/complete',
  'payload.data?.assignment','playsinline','calc(100dvh - 260px)',
  'SalamatCaregiverTrainingV3','salamat-caregiver-training-ready',
])has(training,value,'caregiver training v3');
lacks(training,'localStorage','training local storage');

const owner=syntax('preview/caregiver-training-route-owner-v3.js');
for(const value of [
  "const VERSION='3.0.0'","window.addEventListener('click',capture,true)",
  "buttonKey(button)!=='caregiver.training'",'event.stopImmediatePropagation()',
  'caregiver-training-direct-v3.js','SalamatCaregiverTrainingRouteOwner',
])has(owner,value,'training route owner');
lacks(owner,'window.renderModule','legacy render dependency');

const mobile=syntax('preview/mobile-shell-recovery-v2.js');
for(const value of [
  "const VERSION='2.0.0'",'salamat-mobile-session-active','#mobileMenu',
  'window.SalamatMobileShell?.sync','window.SalamatMobileApp?.sync',
  "window.addEventListener('click',capture,true)",'MutationObserver(schedule)',
  'SalamatMobileShellRecovery',
])has(mobile,value,'mobile recovery v2');

const backend=read('worker/caregiver-training-unity-v3.ts');
for(const value of [
  'CAREGIVER_TRAINING_UNITY_VERSION = "3.0.0"','routeCaregiverTrainingUnityV3',
  'LEFT JOIN users u ON u.id=e.assigned_by_user_id',"'سامانه سلامت اول' AS assignedByName",
  '/api/training/my','training_view_sessions','training_engagement',
  'caregiver-training-unity-v3','caregiver_only',
])has(backend,value,'training backend v3');
lacks(backend,'JOIN users u ON u.id=e.assigned_by_user_id AND','assigner-dependent inner join');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const value of [
  'routeCaregiverTrainingUnityV3','CAREGIVER_TRAINING_VERSION = "3.0.0"',
  'MOBILE_SHELL_RECOVERY_VERSION = "2.0.0"','LOGIN_OTP_SMS_VERSION = "paused"',
  '"caregiver-training-route-owner-v3.js"','"caregiver-training-direct-v3.js"',
  '"mobile-shell-recovery-v2.js"','x-salamat-caregiver-training',
  'x-salamat-mobile-shell-recovery',
])has(wrapper,value,'worker wrapper');
const runtimeBlock=wrapper.slice(wrapper.indexOf('const RUNTIMES'),wrapper.indexOf('function runtimeVersion'));
lacks(runtimeBlock,'"caregiver-training-direct-v2.js"','old training runtime injection');
lacks(runtimeBlock,'"login-otp-sms-runtime-v1.js"','paused OTP runtime injection');
expect(runtimeBlock.indexOf('"caregiver-training-route-owner-v3.js"')<runtimeBlock.indexOf('"caregiver-training-direct-v3.js"'),'training owner must load before viewer runtime');
expect(runtimeBlock.indexOf('"caregiver-training-direct-v3.js"')<runtimeBlock.indexOf('"caregiver-canonical-route-owner-v3.js"'),'training owner/viewer must register before canonical caregiver router');

console.log('Caregiver training viewer v3, assigner-independent training API and mobile shell recovery v2 contracts passed.');
