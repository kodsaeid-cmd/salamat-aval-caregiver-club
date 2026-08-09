import fs from 'node:fs';

const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath)throw new Error('Usage: node scripts/compare-data-safety-snapshots-v1.mjs <before.json> <after.json>');
const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
const b=before.metrics||{},a=after.metrics||{};
const keys=[...new Set([...Object.keys(b),...Object.keys(a)])];
const errors=[];
for(const key of keys){
  if(b[key]===null||b[key]===undefined)continue;
  if(a[key]===null||a[key]===undefined){errors.push(`${key}: existed before deploy but is missing after deploy`);continue}
  if(Number(a[key])!==Number(b[key]))errors.push(`${key}: ${b[key]} -> ${a[key]}`);
}
if(errors.length){
  console.error('DATA INTEGRITY CHECK FAILED. Production business data changed during migration/deploy:');
  for(const e of errors)console.error(` - ${e}`);
  console.error('Stop release investigation here. Use the encrypted pre-deploy backup and audit the migration before any further write.');
  process.exit(1);
}
console.log('Data integrity snapshot passed: protected counts and financial/score totals are unchanged.');
