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

const liveVerificationStep='Verify live Turso-backed production and hot static path';
for(const value of [
  'DATABASE_BACKEND: turso','Block uncoordinated schema changes on Turso primary','Deploy Worker and static assets to Cloudflare',
  liveVerificationStep,'run: npm run deploy','node scripts/validate-turso-backend-v1.mjs',
  'https://salamatavalcaregivers.site','https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
  'desktop-react-entry-bridge-v1.js','salamat_session=invalid-production-probe','assetMs<2500',
  '__turso_deploy_probe__','Expected Turso-backed auth probe 401','databasePrimary:\'turso\'',
  'production-deployment-evidence-${{ github.run_id }}','migrations/**','desktop-react/**','mobile-react/**','shared/**',
]) has(workflow,value,`workflow missing ${value}`);

for(const obsolete of [
  'Create encrypted pre-deploy D1 backup','npm run db:migrations:apply','wrangler d1 execute','D1_BACKUP_PASSPHRASE',
]) lacks(workflow,obsolete,`Turso-primary workflow must not depend on legacy D1 deploy step: ${obsolete}`);
expect(workflow.indexOf('Block uncoordinated schema changes on Turso primary')<workflow.indexOf('Deploy Worker and static assets to Cloudflare'),'Turso migration guard must precede deploy');
expect(workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf(liveVerificationStep),'deploy must precede live verification');

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

console.log('Production deploy contract passed: Turso-primary code deploys avoid D1 quota, schema changes are blocked for coordinated migration, both production domains and the auth/static hot paths remain live.');