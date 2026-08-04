import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Production deploy v3 validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);

const workflow=read('.github/workflows/deploy-production.yml');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const version=read('worker/index-data-protection.ts');
const identityMigration=read('migrations/0102_caregiver_identity_unity.sql');

for(const value of [
  'Create encrypted pre-deploy D1 backup','Apply additive production migrations','Deploy Worker and static assets to Cloudflare',
  'Verify live Worker, custom domain, contracts and synchronized caregiver profile','npm run db:migrations:apply','run: npm run deploy',
  'Verify finance, support, contracts and caregiver identity schema','PRAGMA table_info(contracts)','Missing operational contract columns','Missing caregiver identity triggers',
  'https://salamatavalcaregivers.site','https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
  "caregiverPlatform:platform","adminRouter:router","routerPriority:'head-first'","accessControl:access","adminCore",
  "const platform='2.4.0',router='5.0.0',access='2.0.0',contracts='1.0.0',adminCore='3.0.1',contractOwner='2.0.0',support='2.0.0',profile='1.0.0'",
  "frontendContract:'caregiver-platform-v2-router-v5-head-first'",
  "{file:'contract-module-priority-v2.js',version:platform,marker:\"const VERSION='2.0.0'\"}",
  "{file:'staff-support-direct-runtime-v2.js',version:platform,marker:\"const VERSION='2.0.0'\"}",
  "{file:'caregiver-self-profile-v1.js',version:profile,marker:\"const VERSION='1.0.0'\"}",
  'assetResults.every(item=>item.status===200&&item.javascript&&item.markerOk)',
  'const contractPriorityTag=`contract-module-priority-v2.js?v=${platform}`',
  'const profileTag=`caregiver-self-profile-v1.js?v=${profile}`',
  'const supportTag=`staff-support-direct-runtime-v2.js?v=${platform}`',
  "const profileHeader=htmlResponse.headers.get('x-salamat-caregiver-profile')",
  "const contractOwnerHeader=htmlResponse.headers.get('x-salamat-contract-route-owner')",
  "const supportHeader=htmlResponse.headers.get('x-salamat-support-runtime')",
  'profileHeader===profile','contractOwnerHeader===contractOwner','supportHeader===support',
  'trg_caregiver_identity_to_user_v1','trg_user_identity_to_caregiver_v1',
  'synchronizedCaregiverProfile:true','caregiverIdentityTriggers:true',
]) has(workflow,value,`workflow missing ${value}`);

expect(workflow.indexOf('Create encrypted pre-deploy D1 backup')<workflow.indexOf('Apply additive production migrations'),'backup must precede migrations');
expect(workflow.indexOf('Apply additive production migrations')<workflow.indexOf('Verify finance, support, contracts and caregiver identity schema'),'migrations must precede schema verification');
expect(workflow.indexOf('Verify finance, support, contracts and caregiver identity schema')<workflow.indexOf('Deploy Worker and static assets to Cloudflare'),'schema verification must precede deploy');
expect(workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf('Verify live Worker, custom domain, contracts and synchronized caregiver profile'),'deploy must precede verification');

for(const value of [
  'const PLATFORM_VERSION = "2.4.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const ACCESS_CONTROL_VERSION = "2.0.0"',
  'const CONTRACT_ROUTE_OWNER_VERSION = "2.0.0"','const SUPPORT_RUNTIME_VERSION = "2.0.0"','const CAREGIVER_SELF_PROFILE_VERSION = "1.0.0"',
  '"contract-module-priority-v2.js"','"staff-support-direct-runtime-v2.js"','"caregiver-self-profile-v1.js"',
  '"staff-contracts-runtime-v1.js"','"access-control-runtime-v2.js"','"staff-module-router-v3.js"','function stripRuntime',
  'routeCaregiverSelfProfileV1','routeStaffContractsV1','routeContractCalendarOverlayV1',
  'headers.set("x-salamat-admin-router", ADMIN_ROUTER_VERSION)','headers.set("x-salamat-access-control", ACCESS_CONTROL_VERSION)',
  'headers.set("x-salamat-router-priority", "head-first")','headers.set("x-salamat-contracts", "1.0.0")',
  'headers.set("x-salamat-contract-route-owner", CONTRACT_ROUTE_OWNER_VERSION)',
  'headers.set("x-salamat-support-runtime", SUPPORT_RUNTIME_VERSION)',
  'headers.set("x-salamat-caregiver-profile", CAREGIVER_SELF_PROFILE_VERSION)',
]) has(wrapper,value,`wrapper missing ${value}`);
const removalBlock=wrapper.slice(wrapper.indexOf('for (const fileName of ['),wrapper.indexOf('html = injectCriticalRuntimes'));
for(const removed of ['"access-control-runtime.js"','"staff-support-runtime-v1.js"','"contract-module-priority-v1.js"','"caregiver-canonical-route-owner-v2.js"','"server-training-runtime.js"'])has(removalBlock,removed,`wrapper does not remove ${removed}`);
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
  'caregiverPlatform: "2.4.0"','adminRouter: "5.0.0"','routerPriority: "head-first"','accessControl: "2.0.0"',
  'frontendContract: "caregiver-platform-v2-router-v5-head-first"',
]) has(version,value,`version endpoint missing ${value}`);

console.log('Production deploy contract passed: backup, D1 identity triggers, current runtime ownership and synchronized caregiver profile proof are required.');
