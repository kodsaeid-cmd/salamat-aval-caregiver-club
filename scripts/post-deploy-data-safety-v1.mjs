import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const before='production-evidence/reports/data-safety-before.json';
const after='production-evidence/reports/data-safety-after-deploy.json';
if(!fs.existsSync(before)){
  if(process.env.GITHUB_ACTIONS==='true')throw new Error('DATA_SAFETY: production deploy is missing its pre-deploy integrity snapshot.');
  console.warn('DATA_SAFETY: no production pre-deploy snapshot found; post-deploy remote comparison skipped outside GitHub Actions.');
  process.exit(0);
}
execFileSync(process.execPath,['scripts/data-safety-snapshot-v1.mjs',after],{stdio:'inherit',env:process.env});
execFileSync(process.execPath,['scripts/compare-data-safety-snapshots-v1.mjs',before,after],{stdio:'inherit',env:process.env});
console.log('Post-deploy Data Safety Contract verified.');
