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
 'Verify live Worker, custom domain and access control v2 bundle','npm run db:migrations:apply','run: npm run deploy',
 'https://salamatavalcaregivers.site','https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
 "caregiverPlatform:'2.2.0'","adminRouter:'4.0.0'","accessControl:'2.0.0'","adminCore:'3.0.1'",
 "html.includes('access-control-runtime-v2.js?v=2.2.0')","!html.match(/access-control-runtime\\.js(?:\\?|[\"'])/)",
 "html.includes('staff-module-router-v3.js?v=2.2.0')","accessHeader==='2.0.0'",
])has(workflow,value,`workflow missing ${value}`);
expect(workflow.indexOf('Create encrypted pre-deploy D1 backup')<workflow.indexOf('Apply additive production migrations'),'backup must precede migrations');
expect(workflow.indexOf('Apply additive production migrations')<workflow.indexOf('Deploy Worker and static assets to Cloudflare'),'migrations must precede deploy');
expect(workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf('Verify live Worker, custom domain and access control v2 bundle'),'deploy must precede verification');
for(const value of ['const PLATFORM_VERSION = "2.2.0"','const ACCESS_CONTROL_VERSION = "2.0.0"','"access-control-runtime-v2.js"','access-control-runtime\\.js','x-salamat-access-control'])has(wrapper,value,`wrapper missing ${value}`);
lacks(wrapper,'"panel-module-isolation-v2.js"','legacy positional router remains injected');
for(const value of ['caregiverPlatform: "2.2.0"','adminRouter: "4.0.0"','accessControl: "2.0.0"','frontendContract: "caregiver-platform-v2-router-v4-access-v2"'])has(version,value,`version endpoint missing ${value}`);
console.log('Production deploy v3 contract passed: encrypted backup, real deploy, dual-domain access v2 headers and removal of polling runtime are required.');
