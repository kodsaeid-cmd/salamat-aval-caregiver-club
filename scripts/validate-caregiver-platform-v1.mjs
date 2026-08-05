import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const requireText=(source,needle,label)=>{if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`)};
const rejectText=(source,needle,label)=>{if(source.includes(needle))throw new Error(`${label}: forbidden ${needle}`)};
const syntax=(path)=>{const source=read(path);new Function(source);return source};

const migration=read('migrations/0100_caregiver_finance_support.sql');
for(const table of ['caregiver_wallet_transactions','caregiver_settlement_requests','caregiver_credit_requests','caregiver_payroll_slips','support_threads','support_messages'])requireText(migration,`CREATE TABLE IF NOT EXISTS ${table}`,'platform migration');
for(const trigger of ['wallet_transaction_is_immutable','support_message_is_immutable'])requireText(migration,trigger,'immutable data');

const contractMigration=read('migrations/0101_operational_contracts.sql');
for(const column of [
  'subscriber_first_name','subscriber_last_name','subscriber_phone_primary','subscriber_phone_secondary',
  'subscriber_national_id','subscriber_birth_date','recipient_same_as_subscriber','recipient_first_name',
  'recipient_last_name','recipient_phone_primary','recipient_phone_secondary','recipient_national_id',
  'recipient_birth_date','subscriber_relation_to_recipient','created_by_user_id','deleted_at',
])requireText(contractMigration,`ADD COLUMN ${column}`,'operational contracts migration');
for(const forbidden of [
  "'subscriberNationalId', json_extract","'recipientNationalId', json_extract",
  "'subscriberPhonePrimary', json_extract","'recipientPhonePrimary', json_extract",
])rejectText(contractMigration,forbidden,'contract audit PII');

const supportMigration=read('migrations/0104_support_conversation_unity.sql');
for(const value of [
  'CREATE TABLE IF NOT EXISTS system_notifications',
  'idx_support_threads_category_queue',
  'idx_support_messages_thread_sender',
  'idx_support_notifications_thread',
  "entity_type='support_thread'",
])requireText(supportMigration,value,'support unity migration');
rejectText(supportMigration,'CREATE TABLE support_messages','support must not duplicate canonical messages');

const catalog=read('worker/caregiver-platform-catalog.ts');
for(const key of ['staff.financial_credits','staff.reports','caregiver.contracts','caregiver.security','caregiver.rank'])requireText(catalog,key,'catalog');
requireText(catalog,'CAREGIVER_PLATFORM_MODULE_CATALOG_VERSION = "3.0.0"','catalog version');
rejectText(catalog,'اعتبار و حقوق مراقبین','finance must not own payroll');

const access=read('worker/panel-access-contract-v2.ts');
for(const value of ['moduleContractVersion: "3.0.0"','"staff.reports"','insertAfterPayroll','پاداش معرفی پرونده، تسویه کیف پول و درخواست اعتبار'])requireText(access,value,'access contract');

const backend=read('worker/caregiver-platform-v1.ts');
for(const route of ['/api/caregiver/platform/dashboard','/api/caregiver/platform/scorecard-record','/api/caregiver/platform/wallet','/api/caregiver/platform/settlements','/api/caregiver/platform/credit-requests','/api/caregiver/platform/payroll','/api/caregiver/platform/support/threads','/api/staff/financial-credits'])requireText(backend,route,'caregiver platform backend route');
requireText(backend,'CUMULATIVE_TARGET_DAYS = 1_200','credit rule');
requireText(backend,'LOAN_AMOUNT_TOMAN = 500_000_000','credit amount');

const supportBackend=read('worker/support-conversation-unity-v3.ts');
for(const value of [
  'const VERSION = "3.0.0"',
  'routeSupportConversationUnityV3',
  '/api/caregiver/platform/support/threads',
  'support-conversation-unity-v3',
  'system_notifications',
  'support_threads',
  'support_messages',
  'SUPPORT_MESSAGE',
  'support:',
  'activeSupportRecipients',
  'activeCaregiverRecipients',
  'requireSupportAccess',
  'navigator',
]){
  if(value==='navigator')continue;
  requireText(supportBackend,value,'support unity backend');
}
for(const value of [
  'canViewResponderIdentity: isSystemAdmin(actor)',
  'responderIdentityVisible: revealStaffIdentity',
  'senderDisplayName = "پشتیبانی سلامت اول"',
  'senderUserId: revealStaffIdentity || mine ? row.senderUserId : null',
  'شما یک پیام خوانده‌نشده از پشتیبانی دارید.',
  "messageType: \"TEXT\" | \"VOICE\" | \"THREAD\"",
  'markThreadRead',
  "entity_type='support_thread'",
  'file.uploadedByUserId !== actor.id',
  "message_type='VOICE'",
  'x-salamat-support-unity',
])requireText(supportBackend,value,'support privacy and notification contract');
rejectText(supportBackend,'localStorage','support backend source');
rejectText(supportBackend,'DELETE FROM support_messages','support message deletion');

const payrollBackend=read('worker/staff-payroll-v1.ts');
for(const route of ['/api/staff/payroll','/api/staff/payroll/caregivers','/api/staff/payroll/'])requireText(payrollBackend,route,'staff payroll route');
requireText(payrollBackend,'const MODULE_KEY = "staff.payroll"','payroll permission boundary');
rejectText(payrollBackend,'staff.financial_credits','payroll must not use finance permission');

const contractsBackend=read('worker/staff-contracts-v1.ts');
for(const value of [
  'const MODULE_KEY = "staff.contracts"','/api/staff/contracts/caregivers','/api/staff/contracts',
  'requireAccess(env, actor, MODULE_KEY','CREATE_CONTRACT','UPDATE_CONTRACT','DELETE_CONTRACT',
  'recipientSameAsSubscriber','subscriberRelationToRecipient','CONTRACT_WEEKDAYS','contractCalendarEvents',
])requireText(contractsBackend,value,'staff contracts backend');
rejectText(contractsBackend,'localStorage','contracts backend source');

const caregiver=syntax('preview/caregiver-platform-runtime-v1.js');
for(const route of ['/api/caregiver/platform/dashboard','/api/caregiver/platform/scorecard-record','/api/caregiver/platform/wallet','/api/caregiver/platform/payroll','/api/caregiver/platform/support/threads'])requireText(caregiver,route,'caregiver runtime');
for(const value of ['پشتیبانی پرونده','پشتیبانی فوری و امنیتی','navigator.mediaDevices.getUserMedia'])requireText(caregiver,value,'caregiver support');
rejectText(caregiver,'localStorage','caregiver server source');

const support=syntax('preview/staff-support-direct-runtime-v3.js');
for(const value of [
  "const VERSION='3.0.0'",
  'data-support-unity-version',
  'پشتیبانی پرونده',
  'پشتیبانی فوری و امنیتی',
  'data-sts3-filter="CASE"',
  'data-sts3-filter="URGENT_SECURITY"',
  'navigator.mediaDevices.getUserMedia',
  'data-sts3-status',
  'message.senderDisplayName',
  'message.responderIdentityVisible',
  'message.isMine',
  'salamat-support-thread-read',
  'window.SalamatStaffSupport={version:VERSION',
])requireText(support,value,'direct staff support v3');
for(const forbidden of ['window.renderModule','localStorage','eval('])rejectText(support,forbidden,'direct staff support v3');

const supportOwner=syntax('preview/staff-support-route-owner-v3.js');
for(const value of [
  "const VERSION='3.0.0'",
  "window.addEventListener('click',capture,true)",
  "buttonKey(button)!=='staff.support'",
  'event.stopImmediatePropagation()',
  'MutationObserver(scheduleRepair)',
  'staff-support-direct-runtime-v3.js',
  'window.SalamatStaffSupportRouteOwner',
  "owner:'window-capture'",
])requireText(supportOwner,value,'support route owner v3');
rejectText(supportOwner,'window.renderModule','support route owner render dependency');

const notifications=syntax('preview/server-notifications-runtime-v2.js');
for(const value of [
  "const VERSION='2.0.0'",
  '/api/notifications?limit=50',
  'SUPPORT_MESSAGE',
  'support:',
  'salamat-open-support-thread',
  'salamat-open-caregiver-support-thread',
  'salamat-support-thread-read',
  'شما یک پیام خوانده‌نشده از پشتیبانی دارید.',
  'window.SalamatServerNotifications',
])requireText(notifications,value,'notifications v2');
const caregiverBridge=syntax('preview/caregiver-support-notification-bridge-v1.js');
for(const value of ['salamat-open-caregiver-support-thread','SalamatCaregiverPlatform?.openSupport','data-cgp-thread','SalamatCaregiverSupportNotificationBridge'])requireText(caregiverBridge,value,'caregiver notification bridge');

const contractsRuntime=syntax('preview/staff-contracts-runtime-v1.js');
for(const value of ["const VERSION='1.0.0'",'window.SalamatStaffContracts','مدیریت قراردادهای مراقبین','/api/staff/contracts/caregivers','خدمت‌گیرنده همان مشترک است','data-sct-jyear'])requireText(contractsRuntime,value,'staff contracts runtime');
rejectText(contractsRuntime,'type="date"','contracts Jalali dates');
rejectText(contractsRuntime,'localStorage','contracts server source');

const contractOwner=syntax('preview/contract-module-priority-v2.js');
for(const value of ["const VERSION='2.0.0'",'staff.contracts','staff-contracts-runtime-v1.js',"window.addEventListener('click',capture,true)",'stopImmediatePropagation()'])requireText(contractOwner,value,'contracts route owner');

const finance=syntax('preview/staff-financial-credits-runtime-v2.js');
for(const value of ['اعتبارات مالی مراقبین','/api/staff/financial-credits/rewards','/api/staff/financial-credits/settlements/','/api/staff/financial-credits/credit-requests/'])requireText(finance,value,'staff finance');
rejectText(finance,'/api/staff/financial-credits/payroll','finance runtime payroll ownership');

const router=syntax('preview/staff-module-router-v3.js');
for(const value of ["const VERSION='5.0.0'",'function canonicalButton','function renderCanonicalNavigation','dataset.panelModuleKey','async function openRuntime'])requireText(router,value,'sidebar router v5');
for(const forbidden of ['setInterval(','nativeRenderNav','window.renderNav','renderNav('])rejectText(router,forbidden,'sidebar router v5');

const wrapper=read('worker/index-caregiver-platform-v1.ts');
for(const value of [
  'routeSupportConversationUnityV3',
  'const SUPPORT_RUNTIME_VERSION = "3.0.0"',
  'const SUPPORT_ROUTE_OWNER_VERSION = "3.0.0"',
  'const SUPPORT_UNITY_VERSION = "3.0.0"',
  'const NOTIFICATIONS_RUNTIME_VERSION = "2.0.0"',
  '"staff-support-route-owner-v3.js"',
  '"staff-support-direct-runtime-v3.js"',
  '"caregiver-support-notification-bridge-v1.js"',
  '"server-notifications-runtime-v2.js"',
  'x-salamat-support-runtime',
  'x-salamat-support-route-owner',
  'x-salamat-support-unity',
  'x-salamat-notifications-runtime',
  'microphone=(self)',
])requireText(wrapper,value,'worker wrapper');
const runtimeBlock=wrapper.slice(wrapper.indexOf('const RUNTIMES'),wrapper.indexOf('function runtimeVersion'));
for(const forbidden of ['"staff-support-runtime-v1.js"','"staff-support-direct-runtime-v2.js"','"server-notifications-runtime.js"'])rejectText(runtimeBlock,forbidden,'legacy runtime injection');
if(!(runtimeBlock.indexOf('"staff-support-route-owner-v3.js"')<runtimeBlock.indexOf('"staff-support-direct-runtime-v3.js"')))throw new Error('worker injection: support owner must precede support runtime');
if(!(wrapper.indexOf('"contract-module-priority-v2.js"')<wrapper.indexOf('"staff-module-router-v3.js"')&&wrapper.indexOf('"staff-module-router-v3.js"')<wrapper.indexOf('"access-control-runtime-v2.js"')))throw new Error('worker injection: contract priority must precede router and access control');

const browserSmoke=read('scripts/run-admin-priority-browser-smoke.mjs');
for(const value of [
  "const SUPPORT = '3.0.0'",
  "const SUPPORT_OWNER = '3.0.0'",
  "const NOTIFICATIONS = '2.0.0'",
  "headers['x-salamat-support-unity'] === SUPPORT",
  'staff-support-route-owner-v3.js',
  'staff-support-direct-runtime-v3.js',
  'server-notifications-runtime-v2.js',
  "await clickModule('پشتیبانی'",
  'supportWorkspace.tabs.length === 2',
])requireText(browserSmoke,value,'support production browser smoke');

console.log('Caregiver platform 2.4, support conversation unity v3, notification runtime v2, operational contracts and access control contracts passed.');
