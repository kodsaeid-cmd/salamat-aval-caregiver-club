import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const backend=String(process.env.DATABASE_BACKEND||'').trim().toLowerCase();
if(backend==='turso'){
  console.log('Post-deploy Data Safety: Turso is primary; legacy D1 snapshot comparison is intentionally skipped for code-only deploys. D1 remains rollback fallback.');
  process.exit(0);
}

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