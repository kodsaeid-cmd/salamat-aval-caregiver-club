import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Admin contract delete validation failed: ${message}`)};

const decorator=read('worker/contract-list-points-v1.ts');
const ui=read('desktop-react/contracts-lifecycle-v7.tsx');
const alias=read('desktop-react/contracts-lifecycle-v2.tsx');
const migration=read('migrations/0120_admin_contract_deletion_tombstones.sql');

expect(decorator.includes('method==="DELETE"')&&decorator.includes('deleteContractAsAdmin'),'DELETE contract route is missing');
expect(decorator.includes('toUpperCase()!=="ADMIN"')&&decorator.includes('حذف قرارداد فقط در اختیار مدیر سامانه است'),'backend must enforce exact ADMIN role');
expect(decorator.includes('contract_admin_deletions_v1')&&decorator.includes('preservedOperationalHistory:true'),'safe deletion tombstone/history contract is missing');
expect(ui.includes('toUpperCase()==="ADMIN"'),'frontend must expose deletion only to ADMIN');
expect(ui.includes('data.adminContractDelete')||ui.includes('dataset.adminContractDelete'),'frontend delete control marker is missing');
expect(ui.includes('method:"DELETE"')&&ui.includes('حذف قرارداد'),'frontend delete action is missing');
expect(alias.includes('./contracts-lifecycle-v7'),'contracts lifecycle v7 is not active');
expect(migration.includes('CREATE TABLE IF NOT EXISTS contract_admin_deletions_v1'),'deletion tombstone migration is missing');

console.log('Admin-only contract deletion validation passed.');
