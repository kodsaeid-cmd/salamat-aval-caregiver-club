import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Production deploy v3 validation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);

const workflow=read('.github/workflows/deploy-production.yml');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const version=read('worker/index-data-protection.ts');

for(const value of [
  'Create encrypted pre-deploy D1 backup','Apply additive production migrations','Deploy Worker and static assets to Cloudflare',
  'Verify live Worker, custom domain and head-first sidebar router v5 bundle','npm run db:migrations:apply','run: npm run deploy',
  'https://salamatavalcaregivers.site','https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
  "caregiverPlatform:platform","adminRouter:router","routerPriority:'head-first'","accessControl:access","adminCore",
  "const platform='2.4.0',router='5.0.0',access='2.0.0',adminCore='3.0.1'",
  "frontendContract:'caregiver-platform-v2-router-v5-head-first'",
  "const assets=['access-control-runtime-v2.js','staff-module-router-v3.js','staff-financial-credits-runtime-v2.js','staff-payroll-runtime-v1.js','staff-support-runtime-v1.js','staff-system-settings-runtime-v1.js']",
  'assetResults.every(item=>item.status===200&&item.javascript&&item.routerV5)',
  "text.includes(\"const VERSION='5.0.0'\")",
  "html.includes(`access-control-runtime-v2.js?v=${platform}`)",
  "html.includes(`staff-module-router-v3.js?v=${platform}`)",
  "!html.match(/access-control-runtime\\.js(?:\\?|[\"'])/)",
  'const priorityHeader=htmlResponse.headers.get(\'x-salamat-router-priority\')',
  "routerHeader===router","priorityHeader==='head-first'","accessHeader===access","platformHeader===platform",
  'const criticalOrder=routerIndex>=0&&accessIndex>routerIndex&&(firstLegacy===Infinity||accessIndex<firstLegacy)',
])has(workflow,value,`workflow missing ${value}`);

expect(workflow.indexOf('Create encrypted pre-deploy D1 backup')<workflow.indexOf('Apply additive production migrations'),'backup must precede migrations');
expect(workflow.indexOf('Apply additive production migrations')<workflow.indexOf('Deploy Worker and static assets to Cloudflare'),'migrations must precede deploy');
expect(workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf('Verify live Worker, custom domain and head-first sidebar router v5 bundle'),'deploy must precede verification');

for(const value of [
  'const PLATFORM_VERSION = "2.4.0"','const ADMIN_ROUTER_VERSION = "5.0.0"','const ACCESS_CONTROL_VERSION = "2.0.0"',
  '"access-control-runtime-v2.js"','"staff-module-router-v3.js"','access-control-runtime\\.js',
  'headers.set("x-salamat-admin-router", ADMIN_ROUTER_VERSION)','headers.set("x-salamat-access-control", ACCESS_CONTROL_VERSION)',
  'headers.set("x-salamat-router-priority", "head-first")',
])has(wrapper,value,`wrapper missing ${value}`);
lacks(wrapper,'"panel-module-isolation-v2.js"','legacy positional router remains injected');

for(const value of [
  'caregiverPlatform: "2.4.0"','adminRouter: "5.0.0"','routerPriority: "head-first"','accessControl: "2.0.0"',
  'frontendContract: "caregiver-platform-v2-router-v5-head-first"',
])has(version,value,`version endpoint missing ${value}`);

console.log('Production deploy v3 contract passed: encrypted backup, real deploy, dual-domain platform 2.4 head-first router headers and direct JavaScript asset downloads are required.');
