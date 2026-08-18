from pathlib import Path

p = Path("worker/index-desktop-react-v1.ts")
s = p.read_text()

activation_import = 'import {processPendingCaregiverActivationSmsV1} from "./caregiver-activation-sms-v1";\n'
job_import = 'import {JOB_BANK_SMS_QUEUE_NAME,consumeJobBankReminderQueueV1,isJobBankReminderCronV1,scheduleJobBankReminderSlotV1} from "./job-bank-reminder-sms-v1";\n'
if job_import not in s:
    if activation_import not in s:
        raise SystemExit("activation import anchor not found")
    s = s.replace(activation_import, activation_import + job_import, 1)

old = '''  async scheduled(controller: WorkerScheduledController, env: any, ctx: WorkerLifecycleContext) {
    try{await reconcileLegacyOpenContracts(env)}catch(error){console.error("legacy_contract_scheduled_reconcile_failed",error instanceof Error?error.message:String(error))}
    ctx.waitUntil(reconcileAllActiveContracts(env));
    ctx.waitUntil(processPendingCaregiverActivationSmsV1(env,50));
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  }
};'''

new = '''  async scheduled(controller: WorkerScheduledController, env: any, ctx: WorkerLifecycleContext) {
    const maintenanceCron=controller.cron==="17 2 * * *";
    if(maintenanceCron){
      try{await reconcileLegacyOpenContracts(env)}catch(error){console.error("legacy_contract_scheduled_reconcile_failed",error instanceof Error?error.message:String(error))}
      ctx.waitUntil(reconcileAllActiveContracts(env));
      ctx.waitUntil(processPendingCaregiverActivationSmsV1(env,50));
    }
    if(isJobBankReminderCronV1(controller.cron))ctx.waitUntil(scheduleJobBankReminderSlotV1(env,controller.scheduledTime,controller.cron));
    if(maintenanceCron&&typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);
  },
  async queue(batch:any,env:any,ctx:WorkerLifecycleContext){
    if(batch?.queue===JOB_BANK_SMS_QUEUE_NAME){await consumeJobBankReminderQueueV1(batch,env);return;}
    const nestedQueue=(app as any).queue;
    if(typeof nestedQueue==="function")return nestedQueue.call(app,batch,env,ctx);
  }
};'''

if old not in s:
    if new in s:
        p.write_text(s)
        raise SystemExit(0)
    raise SystemExit("scheduled block anchor not found")

p.write_text(s.replace(old, new, 1))
