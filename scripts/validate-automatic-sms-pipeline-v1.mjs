import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const canonical=read('worker/index-desktop-react-v1.ts');
const statusSms=read('worker/job-application-status-sms-v1.ts');
const activationSms=read('worker/caregiver-activation-sms-v1.ts');
const jobBankSms=read('worker/job-bank-reminder-sms-v1.ts');
const genericDispatcher=read('worker/index-caregiver-platform-v1.ts');
const delivery=read('worker/sms-delivery-v1.ts');
const runtime=read('shared/job-application-status-sms-runtime-v1.ts');
const readiness=read('worker/automatic-sms-readiness-v1.ts');

assert.match(canonical,/processPendingJobApplicationStatusSmsV1/,'canonical worker must own job-status SMS processing');
assert.match(canonical,/routeJobApplicationStatusSmsFlushV1/,'canonical worker must expose the authenticated flush route');
assert.match(canonical,/scheduleJobStatusSms\(env,ctx,"canonical-lifecycle"\)/,'successful lifecycle PATCH must trigger server-side SMS processing');
assert.match(canonical,/scheduleJobStatusSms\(env,ctx,`cron:\$\{controller\.cron\}`\)/,'cron events must retry pending job-status SMS');
assert.match(canonical,/processPendingCaregiverActivationSmsV1/,'caregiver activation SMS processing must remain wired');
assert.match(canonical,/scheduleJobBankReminderSlotV1/,'job-bank reminder scheduling must remain wired');
assert.match(canonical,/consumeJobBankReminderQueueV1/,'job-bank SMS queue consumer must remain wired');

assert.match(statusSms,/WHERE id=\? AND status IN \('PENDING','FAILED'\)/,'job-status SMS events must be atomically claimed');
assert.match(statusSms,/meta\?\.changes/,'job-status SMS claim must verify that only one worker owns the send');
assert.match(statusSms,/\/api\/admin\/job-status-sms\/flush/,'browser flush endpoint must exist');
assert.match(statusSms,/requireAccess\(env,actor,"staff\.job_ads","update"\)/,'flush endpoint must require job-ad update access');
assert.match(statusSms,/SMSIR_JOB_STATUS_TEMPLATE_ID/,'job-status template configuration must remain independent');
assert.match(runtime,/\/api\/admin\/job-status-sms\/flush/,'desktop/mobile runtime must target the real flush endpoint');

assert.match(activationSms,/SMSIR_ACTIVATION_TEMPLATE_ID/,'activation template path must remain intact');
assert.match(jobBankSms,/SMSIR_JOB_BANK_TEMPLATE_ID/,'job-bank reminder template path must remain intact');
assert.match(jobBankSms,/JOB_BANK_SMS_QUEUE_NAME/,'job-bank queue ownership must remain intact');
assert.match(genericDispatcher,/processPendingCaregiverChangeNotifications/,'generic caregiver-change SMS dispatcher must remain wired in the protected platform chain');

for(const invariant of ['sendCaregiverNotificationSms','SMS_NOTIFICATIONS_ENABLED','sms_delivery_log','sendOtpCode','SMSIR_OTP_TEMPLATE_ID'])assert.match(delivery,new RegExp(invariant),`SMS invariant missing: ${invariant}`);
assert.match(readiness,/\/api\/system\/sms-readiness/,'non-sensitive production SMS readiness endpoint is required');
for(const field of ['activationSmsReady','jobBankReminderSmsReady','jobApplicationStatusSmsReady','genericNotificationChannelConfigured'])assert.match(readiness,new RegExp(field),`readiness field missing: ${field}`);

console.log('automatic SMS pipeline v1 validation passed');
