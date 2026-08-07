import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Finance/avatar/smoke unity validation failed: ${message}`)};
const has=(source,value,label=value)=>expect(source.includes(value),`missing ${label}`);
const lacks=(source,value,label=value)=>expect(!source.includes(value),`forbidden ${label}`);
const syntax=(path)=>{const source=read(path);new Function(source);return source};

const owner=syntax('preview/staff-financial-credits-route-owner-v3.js');
for(const value of [
  "const VERSION='3.2.1'","const RUNTIME_VERSION='3.0.0'",
  'window.__salamatStaffFinancialCreditsRuntimeV1=true',
  "window.addEventListener('click',capture,true)",
  'fch3[data-finance-hub-version="3.0.0"]',
  'staff-financial-credits-runtime-v2.js',
  'MutationObserver(scheduleRepair)',
  'SalamatFinancialCreditsRouteOwner',
])has(owner,value,'finance owner');
lacks(owner,'window.renderModule','finance owner renderModule dependency');

const avatar=syntax('preview/caregiver-avatar-unity-v2.js');
for(const value of [
  "const VERSION='2.0.0'",'/api/caregiver/platform/profile',
  '#topAvatar','#sidebarAvatar','.p3-report .p3-profile .p3-big',
  'salamat-caregiver-profile-updated','salamat-module-opened',
  'SalamatCaregiverAvatarUnity',
])has(avatar,value,'avatar unity');
lacks(avatar,'localStorage','avatar unity localStorage');

const avatarBackend=read('worker/caregiver-avatar-unity-v2.ts');
for(const value of [
  '/api/caregiver/platform/profile/avatar','uploadUrl.searchParams.set("caregiverId", caregiverId)',
  'uploadUrl.searchParams.set("userId", actor.id)','uploadProfileImage',
  'invalidateCaregiverDirectoryCache','caregiver_only',
])has(avatarBackend,value,'avatar backend');

const directory=read('worker/user-directory-unity-v1.ts');
for(const value of [
  'const DIRECTORY_PATH = "/api/users"','requireAccess(env, actor, "staff.users", "view")',
  "upper(COALESCE(u.status,''))<>'DELETED'","u.id NOT LIKE 'RC-%'",
  "NOT LIKE 'rc-%@invalid.local'","NOT LIKE 'آزمون انتشار%'",
  'avatarUrl','canonical-user-directory-v1',
])has(directory,value,'user directory');

const migration=read('migrations/0103_avatar_unity_smoke_cleanup.sql');
for(const value of [
  'UPDATE profile_images','SET user_id =','DELETE FROM sessions','DELETE FROM user_module_permissions',
  "UPDATE users\nSET status='DELETED'","UPDATE caregivers\nSET full_name='پرونده آزمایشی حذف‌شده'",
])has(migration,value,'migration');
lacks(migration,'DELETE FROM users','migration hard user delete');

const fixture=read('scripts/prepare-release-smoke-fixtures.mjs');
for(const value of ["status='DELETED'",'حساب آزمایشی حذف‌شده','deleted-smoke-'])has(fixture,value,'fixture cleanup');
lacks(fixture,'DELETE FROM users WHERE id IN','fixture hard user delete');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const value of [
  'routeCaregiverAvatarUnityV2','routeUserDirectoryUnityV1',
  'staff-financial-credits-route-owner-v3.js','staff-financial-credits-runtime-v1.js',
  'caregiver-avatar-unity-v2.js','FINANCIAL_ROUTE_OWNER_VERSION = "3.1.0"',
  'CAREGIVER_AVATAR_UNITY_VERSION = "2.0.0"','USER_DIRECTORY_UNITY_VERSION = "1.0.0"',
  'x-salamat-financial-route-owner','x-salamat-caregiver-avatar-unity','x-salamat-user-directory-unity',
])has(wrapper,value,'worker wrapper');
const runtimes=wrapper.slice(wrapper.indexOf('const RUNTIMES'),wrapper.indexOf('function runtimeVersion'));
expect(runtimes.indexOf('staff-financial-credits-route-owner-v3.js')<runtimes.indexOf('staff-financial-credits-runtime-v2.js'),'finance owner must load before finance runtime');
const critical=wrapper.slice(wrapper.indexOf('const CRITICAL_RUNTIMES'),wrapper.indexOf('const RUNTIMES'));
expect(critical.indexOf('contract-module-priority-v2.js')<critical.indexOf('staff-module-router-v3.js'),'contract owner/router order changed');
expect(critical.indexOf('staff-module-router-v3.js')<critical.indexOf('access-control-runtime-v2.js'),'router/access order changed');

const scorecard=read('worker/caregiver-scorecard-v2.ts');
for(const value of ['FROM profile_images pi','AS avatarId','avatarUrl: caregiver.avatarId'])has(scorecard,value,'scorecard avatar');

console.log('Canonical finance route v3.2.1, caregiver avatar unity v2 and safe smoke-account cleanup contracts passed.');
