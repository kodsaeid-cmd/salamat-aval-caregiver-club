import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Panel module isolation failed: ${message}`)};
const has=(source,value,message)=>expect(source.includes(value),message);
const lacks=(source,value,message)=>expect(!source.includes(value),message);

const access=read('worker/panel-access-contract-v2.ts');
const router=read('preview/panel-module-isolation-v2.js');
const wrapper=read('worker/index-caregiver-platform-v1.ts');
const finance=read('preview/staff-financial-credits-runtime-v1.js');
const training=read('preview/training-admin-classic-runtime.js');

new Function(router);

for(const value of [
  '/api/access/me',
  '/api/access/configuration',
  'staff.financial_credits',
  'insertAfterPayroll',
  'REMOVED_CAREGIVER_KEYS',
  'moduleContractVersion: "2.0.0"',
])has(access,value,`access contract is missing ${value}`);

for(const key of [
  'staff.training',
  'staff.financial_credits',
  'staff.support',
  'caregiver.dashboard',
  'caregiver.scorecard',
  'caregiver.wallet',
  'caregiver.payroll',
  'caregiver.support',
])has(router,key,`router is missing stable key ${key}`);

has(router,'event.stopImmediatePropagation()','custom modules do not have a single click owner');
has(router,'window.selectedRole=role','role boundary is not reset after account changes');
has(router,"key==='staff.training'",'training does not have an exact route');
has(router,"key==='staff.financial_credits'",'finance does not have an exact route');
has(router,'panelModuleKey','sidebar items do not receive stable keys');
has(router,'subtree:false','observer is not limited to the sidebar list');
lacks(router,"label.includes('آموزش')",'training routing still depends on partial labels');
lacks(router,"label.includes('پشتیبانی')",'support routing still depends on partial labels');

has(finance,"label==='اعتبارات مالی'",'finance runtime no longer recognizes its exact legacy label');
has(training,"label.includes('آموزش')",'existing training renderer is not preserved');
has(wrapper,'routePanelAccessContractV2','normalized access route is not active');
has(wrapper,'panel-module-isolation-v2.js','isolation runtime is not injected');
expect(wrapper.indexOf('panel-module-isolation-v2.js')>wrapper.indexOf('staff-support-runtime-v1.js'),'isolation runtime must load after feature runtimes');

console.log('Panel module isolation v2 passed: finance is a distinct module, training has an exact route, and caregiver/staff role boundaries are reset.');
