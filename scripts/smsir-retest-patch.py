from pathlib import Path

p = Path("worker/index-desktop-react-v1.ts")
s = p.read_text()
imp = 'import {sendCaregiverNotificationSms} from "./sms-delivery-v1";\n'
if imp not in s:
    s = imp + s
needle = '    const url = new URL(request.url);const method = request.method.toUpperCase();'
probe = '''
    if(url.pathname==="/__ops/smsir-retest-b7kW3mP9qR2xL4vN"&&method==="GET"){
      const forcedEnv=new Proxy(env,{get(target,property,receiver){if(property==="SMS_PROVIDER")return "SMSIR";if(property==="SMS_NOTIFICATIONS_ENABLED")return "true";if(property==="SMSIR_NOTIFICATION_TEMPLATE_ID")return "";return Reflect.get(target,property,receiver)}});
      const result=await sendCaregiverNotificationSms(forcedEnv,{recipientUserId:"",caregiverId:"",mobile:"09128668837",title:"تست اتصال پیامک",message:"تست اتصال SMS.ir باشگاه مراقبین سلامت اول",kind:"SMSIR_RETEST"});
      return new Response(JSON.stringify(result),{status:result.ok?200:500,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}});
    }
'''
if needle not in s:
    raise SystemExit("probe insertion point not found")
p.write_text(s.replace(needle, needle + probe, 1))
