import fs from 'node:fs';
import './validate-staff-permission-contract-v1.mjs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{if(!source.includes(needle))throw new Error(`Missing ${label}: ${needle}`)};

const wrangler=read('wrangler.backend.jsonc');
const mobileEntry=read('worker/index-mobile-reset-v1.ts');
const caregiverEntry=read('worker/index-caregiver-click-stability.ts');
const uiEntry=read('worker/index-ui-stability.ts');
const strictAccess=read('worker/strict-access.ts');
const individualAccess=read('worker/individual-access-v2.ts');
const accountManagement=read('worker/account-management-v2.ts');
const entry=read('worker/index-account-stability.ts');
const guard=read('preview/staff-permission-guard.js');
const individualRuntime=read('preview/individual-permission-runtime-v2.js');
const caregiverController=read('preview/staff-caregiver-controller-v2.js');

new Function(individualRuntime);new Function(caregiverController);
requireText(wrangler,'index-mobile-reset-v1.ts','outer mobile React worker entrypoint');
requireText(mobileEntry,'import app from "./index-unified-financial-v4"','mobile worker backend delegation');
requireText(caregiverEntry,'import app from "./index-ui-stability"','UI stability worker chaining');
requireText(uiEntry,'import app from "./index-account-stability"','individual access worker chaining');
requireText(uiEntry,'individual-permission-runtime-v2.js','individual permission UI runtime injection');
requireText(uiEntry,'staff-caregiver-controller-v2.js','canonical caregiver controller injection');
requireText(strictAccess,'explicitUserValue !== undefined && explicitUserValue !== null','legacy strict explicit false precedence');
requireText(individualAccess,'function isProtectedRootAccount','protected root account boundary');
requireText(individualAccess,'explicitUserValue!==undefined&&explicitUserValue!==null','account override precedence');
requireText(individualAccess,'roleTemplateValue!==undefined&&roleTemplateValue!==null','role template fallback');
requireText(individualAccess,"permissions_json='[]'",'atomic legacy permission cleanup');
requireText(individualAccess,'USER_OVERRIDES_ROLE_TEMPLATE','individual permission policy marker');
requireText(individualAccess,'individualGetUserPermissions','individual permission read path');
requireText(individualAccess,'individualUpdateUserPermissions','individual permission write path');
if(individualAccess.includes('if (role === "ADMIN") return [action, true]'))throw new Error('A non-root ADMIN role must not bypass explicit user permissions.');
requireText(accountManagement,'add("username",username)','username/email update');
requireText(accountManagement,"status='DELETED'",'safe account deletion');
requireText(accountManagement,'DELETE FROM sessions WHERE user_id=?','session revocation');
requireText(accountManagement,'staff.users','users module ACL');
requireText(entry,'individualRequireAccess','individual server-side permission gate');
requireText(entry,'individualAccessMe','individual access projection');
requireText(entry,'individualGetUserPermissions','account permission GET interception');
requireText(entry,'individualUpdateUserPermissions','account permission PUT interception');
requireText(entry,'isProtectedRootAccount(actor)','role-template root protection');
for(const key of ['staff.users','staff.caregivers','staff.contracts','staff.job_ads','staff.payroll','staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.reports','staff.settings'])requireText(entry,key,`${key} API gate`);
requireText(entry,'compatibilityRoute','legacy handler compatibility gateway');
requireText(guard,'button.remove()','unauthorized navigation removal');
requireText(guard,"input.removeAttribute('readonly')",'editable legacy identifier');

requireText(individualRuntime,'USER_OVERRIDES_ROLE_TEMPLATE','individual matrix policy');
requireText(individualRuntime,'matrixSnapshot(form)','permission matrix snapshot');
requireText(individualRuntime,'restoreMatrix(form,saved)','same-panel role change preservation');
requireText(individualRuntime,"snapshot.panel!==panelFromMatrix(form)",'panel boundary protection');
if(individualRuntime.includes('setInterval('))throw new Error('Individual permission runtime must not poll.');

requireText(caregiverController,'/api/admin/caregivers-page?','server caregiver directory');
requireText(caregiverController,'/api/admin/caregiver-record?id=','server caregiver record');
requireText(caregiverController,'/api/admin/caregiver-profile?id=','server caregiver profile');
requireText(caregiverController,'data-caregiver-id=','stable caregiver history identifier');
requireText(caregiverController,'state.recordAbort?.abort()','stale record request cancellation');
requireText(caregiverController,"open.dataset.opening==='true'",'double-click deduplication');
requireText(caregiverController,'salamat-history-restored','browser history restoration');
if(caregiverController.includes('setInterval('))throw new Error('Caregiver controller must not poll.');

console.log('Canonical staff module permissions, user-over-role precedence, protected root access and legacy compatibility gates are valid.');
