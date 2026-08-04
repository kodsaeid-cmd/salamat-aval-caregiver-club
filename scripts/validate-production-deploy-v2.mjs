import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{
  if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`);
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
  "panelModuleIsolation:'2.0.0'",
  "html.includes('panel-module-isolation-v2.js?v=2.0.0')",
  'gh issue comment "$DEPLOY_ISSUE"',
])requireText(workflow,needle,'production deploy workflow');

const actualDeploy=/name: Deploy Worker and static assets to Cloudflare[\s\S]*?run: npm run deploy(?:\n|$)/.test(workflow);
if(!actualDeploy)throw new Error('production deploy workflow: real wrangler deploy step is missing');

const backupBeforeMigration=workflow.indexOf('Create encrypted pre-deploy D1 backup')<workflow.indexOf('Apply additive production migrations');
const migrationBeforeDeploy=workflow.indexOf('Apply additive production migrations')<workflow.indexOf('Deploy Worker and static assets to Cloudflare');
const deployBeforeVerification=workflow.indexOf('Deploy Worker and static assets to Cloudflare')<workflow.indexOf('Verify live Worker, custom domain and UI bundle');
if(!backupBeforeMigration||!migrationBeforeDeploy||!deployBeforeVerification){
  throw new Error('production deploy workflow: backup, migration, deploy and verification order is unsafe');
}

const version=read('worker/index-data-protection.ts');
for(const needle of [
  'caregiverPlatform: "2.0.0"',
  'panelModuleIsolation: "2.0.0"',
  'frontendContract: "caregiver-platform-v2"',
])requireText(version,needle,'production version endpoint');

const migration=read('migrations/0100_caregiver_finance_support.sql');
requireText(migration,'Additive migration. Existing evaluation and caregiver records are not altered or deleted.','production migration safety');

console.log('Production deploy v2 contract passed: encrypted backup, additive migration, real deploy and live-domain verification are required.');
