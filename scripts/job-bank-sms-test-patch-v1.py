from pathlib import Path

p = Path("worker/index-desktop-react-v1.ts")
s = p.read_text()

anchor_import = 'import {processPendingCaregiverActivationSmsV1} from "./caregiver-activation-sms-v1";\n'
test_import = 'import {sendSmsIrTemplateV1} from "./sms-ir-template-v1";\n'
if test_import not in s:
    if anchor_import not in s:
        raise SystemExit("import anchor not found")
    s = s.replace(anchor_import, anchor_import + test_import, 1)

anchor_fetch = '    const url = new URL(request.url);const method = request.method.toUpperCase();\n'
probe = '''    const url = new URL(request.url);const method = request.method.toUpperCase();
    if(url.pathname==="/__ops/job-bank-sms-test-ready"&&request.headers.get("x-ops-probe")==="jb-sms-test-20260818-v1")return new Response("ready",{status:200});
    if(url.pathname==="/__ops/job-bank-sms-test-send"&&request.headers.get("x-ops-probe")==="jb-sms-test-20260818-v1"){
      if(method!=="POST")return new Response("method_not_allowed",{status:405});
      const row:any=await env.DB.prepare(`SELECT COUNT(*) AS count FROM care_job_ads WHERE status='PUBLISHED'`).first();
      const count=Math.max(1,Number(row?.count||0));
      const result=await sendSmsIrTemplateV1(env,{
        recipientUserId:null,
        caregiverId:null,
        mobile:"09128668837",
        templateId:String(env.SMSIR_JOB_BANK_TEMPLATE_ID||""),
        parameters:[{name:String(env.SMSIR_JOB_BANK_COUNT_PARAMETER||"COUNT"),value:String(count)}],
        kind:"JOB_BANK_REMINDER_TEST"
      });
      return Response.json({ok:result.ok,provider:result.provider,messageId:(result as any).messageId||null,error:(result as any).error||null,count,parameter:String(env.SMSIR_JOB_BANK_COUNT_PARAMETER||"COUNT")},{status:result.ok?200:500});
    }
'''

if probe not in s:
    if anchor_fetch not in s:
        raise SystemExit("fetch anchor not found")
    s = s.replace(anchor_fetch, probe, 1)

p.write_text(s)
