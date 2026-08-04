import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{
  if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`);
};
const rejectText=(source,needle,label)=>{
  if(source.includes(needle))throw new Error(`${label}: forbidden ${needle}`);
};

const workflow=read('.github/workflows/deploy-production.yml');
for(const needle of [
  'name: Production Deploy',
  'branches: [main]',
  'CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}',
  'CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
  'D1_BACKUP_PASSPHRASE: ${{ secrets.D1_BACKUP_PASSPHRASE }}',
  'npm run db:migrations:apply',
  'run: npm run deploy',
  'https://salamatavalcaregivers.site',
  'https://salamat-aval-caregiver-club.kod-saeid.workers.dev',
  "caregiverPlatform:'2.1.0'",
  "panelModuleIsolation:'retired'",
  "adminRouter:'4.0.0'",
  "adminCore:'3.0.1'",
  "html.includes('staff-module-router-v3.js?v=2.1.0')",
  "html.includes('staff-financial-credits-runtime-v2.js?v=2.1.0')",
  "html.includes('staff-payroll-runtime-v1.js?v=2.1.0')",
  "!html.includes('panel-module-isolation-v2.js?v=2.1.0')",
  "routerHeader==='4.0.0'",
  "platformHeader==='2.1.0'",
  'gh issue comment "$DEPLOY_ISSUE"',
])requireText(workflow,needle,'production deploy workflow');
rejectText(workflow,"panelModuleIsolation:'2.0.0'",'old panel isolation verification');
rejectText(workflow,"html.includes('panel-module-isolation-v2.js?v=2.0.0')",'old panel isolation asset verification');

const actualDeploy=/name: Deploy Worker and static assets to Cloudflare[\s\S]*?run: npm run deploy(?:\n|$)/.test(workflow);
if(!actualDeploy)throw new Error('production deploy workflow: real wrangler deploy step is missing');

const backupBeforeMigration=workflow.indexOf('Create encrypted pre-deploy D1 backup')<workflow.indexOf('Apply additive production migrations');
const migrationBeforeDeploy=workflow.indexOf('Apply additive production migrations')<workflow.indexOf('Deploy Worker and static assets to Cloudflare');
const deployBeforeVerification=workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf('Verify live Worker, custom domain and admin router v4 bundle');
if(!backupBeforeMigration||!migrationBeforeDeploy||!deployBeforeVerification){
  throw new Error('production deploy workflow: backup, migration, deploy and verification order is unsafe');
}

const version=read('worker/index-data-protection.ts');
for(const needle of [
  'caregiverPlatform: "2.1.0"',
  'panelModuleIsolation: "retired"',
  'adminRouter: "4.0.0"',
  'adminCore: "3.0.1"',
  'frontendContract: "caregiver-platform-v2-router-v4"',
])requireText(version,needle,'production version endpoint');
rejectText(version,'panelModuleIsolation: "2.0.0"','stale production version endpoint');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const needle of [
  'const PLATFORM_VERSION = "2.1.0"',
  'headers.set("x-salamat-admin-router", "4.0.0")',
  '"staff-module-router-v3.js"',
  '"staff-financial-credits-runtime-v2.js"',
  '"staff-payroll-runtime-v1.js"',
])requireText(wrapper,needle,'production worker wrapper');
rejectText(wrapper,'"panel-module-isolation-v2.js"','legacy router injection');

const migration=read('migrations/0100_caregiver_finance_support.sql');
requireText(migration,'Additive migration. Existing evaluation and caregiver records are not altered or deleted.','production migration safety');

console.log('Production deploy router v4 contract passed: encrypted backup, additive migration, real deploy, dual-domain headers and live runtime verification are required.');
