import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Production deploy v3 validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);

const workflow=read('.github/workflows/deploy-production.yml');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const version=read('worker/index-data-protection.ts');
const identityMigration=read('migrations/0102_caregiver_identity_unity.sql');
const supportMigration=read('migrations/0104_support_conversation_unity.sql');

const liveVerificationStep='Verify live Worker, custom domain, support unity, mobile reference and synchronized caregiver profile';
for(const value of [
  'Create encrypted pre-deploy D1 backup','Apply additive production migrations','Deploy Worker and static assets to Cloudflare',
  liveVerificationStep,'npm run db:migrations:apply','run: npm run deploy',
  'Verify finance, support unity, notifications, contracts and caregiver identity schema','PRAGMA table_info(contracts)',
  'Missing operational contract columns','Missing caregiver identity triggers','Missing support unity indexes',
  'https://salamatavalcaregivers.site','https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
  "caregiverPlatform:platform","adminRouter:router","routerPriority:'head-first'","accessControl:access","adminCore",
  "routerAsset='5.1.0'","support='3.0.0',supportOwner='3.0.0',notifications='2.0.0'","mobileReference='8.2.0'",
  "frontendContract:'caregiver-platform-v2-router-v5-head-first'",
  "{file:'contract-module-priority-v2.js',version:platform,marker:\"const VERSION='2.0.0'\"}",
  "{file:'staff-module-router-v3.js',version:routerAsset,marker:\"const VERSION='5.0.0'\"}",
  "{file:'staff-support-route-owner-v3.js',version:supportOwner,marker:\"const VERSION='3.0.0'\"}",
  "{file:'staff-support-direct-runtime-v3.js',version:support,marker:\"const VERSION='3.0.0'\"}",
  "{file:'server-notifications-runtime-v2.js',version:notifications,marker:\"const VERSION='2.0.0'\"}",
  "{file:'caregiver-support-notification-bridge-v1.js',version:'1.0.0',marker:\"const VERSION='1.0.0'\"}",
  "{file:'caregiver-self-profile-v1.js',version:profile,marker:\"const VERSION='1.0.0'\"}",
  "{file:'mobile-reference-dashboard-v8-2.js',version:mobileReference,marker:\"const VERSION='8.2.0'\"}",
  'assetResults.every(item=>item.status===200&&item.javascript&&item.markerOk)',
  'const routerTag=`staff-module-router-v3.js?v=${routerAsset}`',
  'const supportOwnerTag=`staff-support-route-owner-v3.js?v=${supportOwner}`',
  'const supportTag=`staff-support-direct-runtime-v3.js?v=${support}`',
  'const notificationsTag=`server-notifications-runtime-v2.js?v=${notifications}`',
  'const mobileReferenceTag=`mobile-reference-dashboard-v8-2.js?v=${mobileReference}`',
  "const supportOwnerHeader=htmlResponse.headers.get('x-salamat-support-route-owner')",
  "const supportUnityHeader=htmlResponse.headers.get('x-salamat-support-unity')",
  "const notificationsHeader=htmlResponse.headers.get('x-salamat-notifications-runtime')",
  "const mobileReferenceHeader=htmlResponse.headers.get('x-salamat-mobile-reference-dashboard')",
  'supportOwnerHeader===supportOwner','supportUnityHeader===support','notificationsHeader===notifications','mobileReferenceHeader===mobileReference',
  'supportConversationUnity:true','supportNotifications:true','mobileReferenceDashboard:true',
]) has(workflow,value,`workflow missing ${value}`);

expect(workflow.indexOf('Create encrypted pre-deploy D1 backup')<workflow.indexOf('Apply additive production migrations'),'backup must precede migrations');
expect(workflow.indexOf('Apply additive production migrations')<workflow.indexOf('Verify finance, support unity, notifications, contracts and caregiver identity schema'),'migrations must precede schema verification');
expect(workflow.indexOf('Verify finance, support unity, notifications, contracts and caregiver identity schema')<workflow.indexOf('Deploy Worker and static assets to Cloudflare'),'schema verification must precede deploy');
expect(workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf(liveVerificationStep),'deploy must precede verification');

for(const value of [
  'const PLATFORM_VERSION = "2.4.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const ACCESS_CONTROL_VERSION = "2.0.0"',
  'const CONTRACT_ROUTE_OWNER_VERSION = "2.0.0"','const SUPPORT_RUNTIME_VERSION = "3.0.0"',
  'const SUPPORT_ROUTE_OWNER_VERSION = "3.0.0"','const SUPPORT_UNITY_VERSION = "3.0.0"',
  'const NOTIFICATIONS_RUNTIME_VERSION = "2.0.0"','const CAREGIVER_SELF_PROFILE_VERSION = "1.0.0"',
  '"contract-module-priority-v2.js"','"staff-support-route-owner-v3.js"','"staff-support-direct-runtime-v3.js"',
  '"server-notifications-runtime-v2.js"','"caregiver-support-notification-bridge-v1.js"','"caregiver-self-profile-v1.js"',
  '"staff-contracts-runtime-v1.js"','"access-control-runtime-v2.js"','"staff-module-router-v3.js"','function stripRuntime',
  'routeSupportConversationUnityV3','routeCaregiverSelfProfileV1','routeStaffContractsV1','routeContractCalendarOverlayV1',
  'headers.set("x-salamat-admin-router", ADMIN_ROUTER_VERSION)','headers.set("x-salamat-access-control", ACCESS_CONTROL_VERSION)',
  'headers.set("x-salamat-router-priority", "head-first")','headers.set("x-salamat-contracts", "1.0.0")',
  'headers.set("x-salamat-contract-route-owner", CONTRACT_ROUTE_OWNER_VERSION)',
  'headers.set("x-salamat-support-runtime", SUPPORT_RUNTIME_VERSION)',
  'headers.set("x-salamat-support-route-owner", SUPPORT_ROUTE_OWNER_VERSION)',
  'headers.set("x-salamat-support-unity", SUPPORT_UNITY_VERSION)',
  'headers.set("x-salamat-notifications-runtime", NOTIFICATIONS_RUNTIME_VERSION)',
  'headers.set("x-salamat-caregiver-profile", CAREGIVER_SELF_PROFILE_VERSION)',
]) has(wrapper,value,`wrapper missing ${value}`);
const removalBlock=wrapper.slice(wrapper.indexOf('for (const fileName of ['),wrapper.indexOf('html = injectCriticalRuntimes'));
for(const removed of ['"access-control-runtime.js"','"staff-support-runtime-v1.js"','"staff-support-direct-runtime-v2.js"','"server-notifications-runtime.js"','"contract-module-priority-v1.js"','"caregiver-canonical-route-owner-v2.js"','"server-training-runtime.js"'])has(removalBlock,removed,`wrapper does not remove ${removed}`);
const runtimeBlock=wrapper.slice(wrapper.indexOf('const RUNTIMES'),wrapper.indexOf('function runtimeVersion'));
for(const forbidden of ['"staff-support-runtime-v1.js"','"staff-support-direct-runtime-v2.js"','"server-notifications-runtime.js"'])lacks(runtimeBlock,forbidden,`legacy runtime remains injected: ${forbidden}`);
expect(runtimeBlock.indexOf('"staff-support-route-owner-v3.js"')<runtimeBlock.indexOf('"staff-support-direct-runtime-v3.js"'),'support owner must precede runtime');
const criticalBlock=wrapper.slice(wrapper.indexOf('const CRITICAL_RUNTIMES'),wrapper.indexOf('const RUNTIMES'));
has(criticalBlock,'"contract-module-priority-v2.js"','contract route owner v2 is not critical');
lacks(criticalBlock,'"contract-module-priority-v1.js"','contract route owner v1 remains critical');
expect(wrapper.indexOf('"contract-module-priority-v2.js"')<wrapper.indexOf('"staff-module-router-v3.js"'),'contract route owner v2 must precede router');
expect(wrapper.indexOf('"staff-module-router-v3.js"')<wrapper.indexOf('"access-control-runtime-v2.js"'),'router must precede access runtime');
expect(wrapper.indexOf('"caregiver-self-profile-v1.js"')<wrapper.indexOf('"caregiver-canonical-route-owner-v3.js"'),'self profile runtime must load before caregiver route owner');
lacks(wrapper,'"panel-module-isolation-v2.js"','legacy positional router remains injected');

for(const value of [
  'CREATE TRIGGER IF NOT EXISTS trg_caregiver_identity_to_user_v1',
  'CREATE TRIGGER IF NOT EXISTS trg_user_identity_to_caregiver_v1',
  "upper(NEW.status)<>'DELETED'",
  "NEW.mobile GLOB '09?????????'",
]) has(identityMigration,value,`identity migration missing ${value}`);
for(const value of [
  'CREATE TABLE IF NOT EXISTS system_notifications',
  'idx_support_threads_category_queue',
  'idx_support_messages_thread_sender',
  'idx_support_notifications_thread',
  "entity_type='support_thread'",
]) has(supportMigration,value,`support migration missing ${value}`);

for(const value of [
  'caregiverPlatform: "2.4.0"','adminRouter: "5.0.0"','routerPriority: "head-first"','accessControl: "2.0.0"',
  'frontendContract: "caregiver-platform-v2-router-v5-head-first"',
]) has(version,value,`version endpoint missing ${value}`);

console.log('Production deploy contract passed: encrypted backup, support conversation/notification unity, D1 indexes, identity triggers, mobile reference v8.2 and live ownership proof are required.');