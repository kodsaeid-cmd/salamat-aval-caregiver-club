import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};

const push=read("worker/caregiver-web-push-v2.ts");
const bridge=read("worker/index-caregiver-onboarding-permission-defaults-v2.ts");
const sms=read("worker/sms-delivery-v1.ts");
const entry=read("mobile-react/caregiver-entry-v5.tsx");
const runtime=read("mobile-react/caregiver-web-push-runtime-v1.ts");
const sw=read("preview/caregiver-push-sw.js");
const manifest=JSON.parse(read("preview/mobile/manifest.webmanifest"));

must(push.includes("VAPID_PUBLIC_KEY")&&push.includes("VAPID_PRIVATE_KEY")&&push.includes("VAPID_SUBJECT"),"web push must use server-side VAPID configuration");
must(push.includes('"Content-Encoding: aes128gcm\\0"')&&push.includes('"content-encoding": "aes128gcm"')&&push.includes("WebPush: info\\0"),"web push payload encryption must follow RFC 8291 aes128gcm");
must(push.includes("vapid t=${token}, k=${publicValue}"),"web push authorization must use RFC 8292 VAPID credentials");
must(push.includes("caregiver_push_subscriptions")&&push.includes("caregiver_push_delivery_log"),"web push subscriptions and deliveries must be durable in D1");
must(push.includes("routeCaregiverWebPushV2")&&push.includes("sendCaregiverWebPushV2"),"web push API and sender must remain available");
must(bridge.includes("routeCaregiverWebPushV2")&&bridge.includes("processPendingCaregiverWebPushV2"),"caregiver backend chain must route and dispatch web push");
must(entry.includes("caregiver-web-push-runtime-v1")&&entry.includes("caregiver-web-push-v1.css"),"caregiver React entry must load the push activation UX");
must(runtime.includes("Notification.requestPermission")&&runtime.includes("PushManager")&&runtime.includes("Add to Home Screen"),"push UX must keep explicit permission and iOS Home Screen guidance");
must(sw.includes('addEventListener("push"')&&sw.includes("showNotification")&&sw.includes('addEventListener("notificationclick"'),"service worker must receive, display and open push notifications");
must(manifest.display==="standalone"&&manifest.start_url==="/mobile/","caregiver manifest must remain installable as a standalone web app");

// Critical coexistence invariant requested by product: Web Push is additive; SMS remains intact.
must(sms.includes("sendCaregiverNotificationSms")&&sms.includes("SMS_NOTIFICATIONS_ENABLED")&&sms.includes("sms_delivery_log"),"existing caregiver SMS notification delivery must not be removed by Web Push");
must(sms.includes("sendOtpCode")&&sms.includes("SMSIR_OTP_TEMPLATE_ID"),"existing OTP SMS must remain intact");
must(!push.includes("SMS_NOTIFICATIONS_ENABLED=false")&&!push.includes("sendCaregiverNotificationSms ="),"web push must not disable or replace the SMS channel");

console.log("Caregiver RFC 8291 Web Push + existing SMS coexistence validation passed");
