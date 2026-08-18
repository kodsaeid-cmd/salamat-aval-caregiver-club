from pathlib import Path

p = Path("worker/index-desktop-react-v1.ts")
s = p.read_text()
imp = 'import {sendCaregiverNotificationSms} from "./sms-delivery-v1";\n'
if imp not in s:
    s = imp + s
needle = '    const url = new URL(request.url);const method = request.method.toUpperCase();'
probe = '''
    if(url.pathname==="/__ops/smsir-activation-live-test-8kP2sX7mQ4vN6cR1"&&method==="GET"){
      const activationTemplate=String((env as any).SMSIR_ACTIVATION_TEMPLATE_ID||"").trim();
      if(!activationTemplate){
        return new Response(JSON.stringify({ok:false,error:"SMSIR_ACTIVATION_TEMPLATE_ID_missing"}),{status:500,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}});
      }
      const forcedEnv=new Proxy(env as any,{get(target,property,receiver){
        if(property==="SMS_PROVIDER")return "SMSIR";
        if(property==="SMS_NOTIFICATIONS_ENABLED")return "true";
        if(property==="SMSIR_NOTIFICATION_TEMPLATE_ID")return activationTemplate;
        if(property==="SMSIR_NOTIFICATION_TITLE_PARAMETER")return String((target as any).SMSIR_ACTIVATION_STATUS_PARAMETER||"STATUS").trim()||"STATUS";
        if(property==="SMSIR_NOTIFICATION_MESSAGE_PARAMETER")return String((target as any).SMSIR_ACTIVATION_PASSWORD_PARAMETER||"PASSWORD").trim()||"PASSWORD";
        return Reflect.get(target,property,receiver);
      }});
      const result=await sendCaregiverNotificationSms(forcedEnv,{recipientUserId:"",caregiverId:"",mobile:"09128668837",title:"فعال گردید",message:"کد ملی",kind:"PROFILE_ACTIVATED_LIVE_TEST"});
      return new Response(JSON.stringify({ok:result.ok,provider:result.provider||null,messageId:result.messageId||null,error:result.error||null,templateConfigured:true}),{status:result.ok?200:500,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}});
    }
'''
if needle not in s:
    raise SystemExit("probe insertion point not found")
p.write_text(s.replace(needle, needle + probe, 1))
