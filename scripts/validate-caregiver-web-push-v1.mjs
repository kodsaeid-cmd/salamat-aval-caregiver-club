import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};

const push=read("worker/caregiver-web-push-v2.ts");
const bridge=read("worker/index-caregiver-onboarding-permission-defaults-v2.ts");
const sms=read("worker/sms-delivery-v1.ts");
const entry=read("mobile-react/caregiver-entry-v5.tsx");
const runtime=read("mobile-react/caregiver-web-push-runtime-v1.ts");
const center=read("mobile-react/caregiver-notification-center-v1.tsx");
const centerCss=read("mobile-react/caregiver-notification-center-v1.css");
const sw=read("preview/caregiver-push-sw.js");
const bootstrap=read(".github/workflows/bootstrap-caregiver-web-push.yml");
const ensureSecrets=read("scripts/ensure-caregiver-web-push-secrets.mjs");
const pkg=JSON.parse(read("package.json"));
const manifest=JSON.parse(read("preview/mobile/manifest.webmanifest"));

must(push.includes("VAPID_PUBLIC_KEY")&&push.includes("VAPID_PRIVATE_KEY")&&push.includes("VAPID_SUBJECT"),"web push must use server-side VAPID configuration");
must(push.includes('"Content-Encoding: aes128gcm\\0"')&&push.includes('"content-encoding": "aes128gcm"')&&push.includes("WebPush: info\\0"),"web push payload encryption must follow RFC 8291 aes128gcm");
must(push.includes("vapid t=${token}, k=${publicValue}"),"web push authorization must use RFC 8292 VAPID credentials");
must(push.includes("caregiver_push_subscriptions")&&push.includes("caregiver_push_delivery_log"),"web push subscriptions and deliveries must be durable in D1");
must(push.includes("routeCaregiverWebPushV2")&&push.includes("sendCaregiverWebPushV2"),"web push API and sender must remain available");
must(push.includes("AND EXISTS(")&&push.includes("s.enabled=1")&&push.includes("datetime(n.created_at)>=datetime(s.created_at)"),"system push fanout must only select caregivers who had already opted in before the notification was created");
must(bridge.includes("routeCaregiverWebPushV2")&&bridge.includes("processPendingCaregiverWebPushV2"),"caregiver backend chain must route and dispatch web push");
must(entry.includes("caregiver-web-push-runtime-v1")&&entry.includes("caregiver-web-push-v1.css"),"caregiver React entry must load the push activation UX");
must(runtime.includes("Notification.requestPermission")&&runtime.includes("PushManager")&&runtime.includes("Add to Home Screen"),"push UX must keep explicit permission and iOS Home Screen guidance");
must(runtime.includes("salamat:caregiver-push-settings")&&runtime.includes("if(!config.configured)return"),"push runtime must expose settings from the visible UI and keep retrying while VAPID is not configured");
must(center.includes("cvn-push-card")&&center.includes("تنظیم و فعال‌سازی")&&center.includes("پیامک‌های فعلی"),"notification center must always surface a persistent push activation card without implying SMS replacement");
must(centerCss.includes(".cvn-push-card"),"push activation card must have dedicated notification-center styling");
must(sw.includes('addEventListener("push"')&&sw.includes("showNotification")&&sw.includes('addEventListener("notificationclick"'),"service worker must receive, display and open push notifications");
must(manifest.display==="standalone"&&manifest.start_url==="/mobile/","caregiver manifest must remain installable as a standalone web app");
must(bootstrap.includes("scripts/ensure-caregiver-web-push-secrets.mjs")&&bootstrap.includes("Repair and verify production VAPID secrets"),"production bootstrap workflow must invoke the deterministic VAPID repair helper");
must(ensureSecrets.includes('"secret", "list"')&&ensureSecrets.includes('"secret", "put"')&&ensureSecrets.includes("generateKey")&&ensureSecrets.includes("VAPID_PRIVATE_KEY: priv.d"),"production VAPID repair helper must create and upload a complete P-256 VAPID pair through the Cloudflare secret put path");
must(ensureSecrets.includes("CAREGIVER_WEB_PUSH_VAPID_REPAIRED_V2")&&ensureSecrets.includes("stableAndRepaired"),"VAPID repair must force one known-good repair once, then preserve the stable key pair");
must(bootstrap.includes("Report Web Push bootstrap evidence")&&bootstrap.includes("gh issue comment 90"),"VAPID bootstrap must record non-secret production evidence");
const deploy=String(pkg?.scripts?.deploy||"");
const deployWorkers=String(pkg?.scripts?.["deploy:workers"]||"");
must(deploy.includes("wrangler deploy")&&deploy.includes("ensure-caregiver-web-push-secrets.mjs")&&deploy.indexOf("wrangler deploy")<deploy.indexOf("ensure-caregiver-web-push-secrets.mjs"),"real production deploy must deploy the latest Worker before repairing VAPID secrets because Cloudflare secret put requires the latest Worker version to be deployed");
must(deployWorkers.includes("wrangler deploy")&&deployWorkers.includes("ensure-caregiver-web-push-secrets.mjs")&&deployWorkers.indexOf("wrangler deploy")<deployWorkers.indexOf("ensure-caregiver-web-push-secrets.mjs"),"direct Worker deploy must deploy the latest Worker before repairing Web Push VAPID secrets");

// Critical coexistence invariant requested by product: Web Push is additive; SMS remains intact.
must(sms.includes("sendCaregiverNotificationSms")&&sms.includes("SMS_NOTIFICATIONS_ENABLED")&&sms.includes("sms_delivery_log"),"existing caregiver SMS notification delivery must not be removed by Web Push");
must(sms.includes("sendOtpCode")&&sms.includes("SMSIR_OTP_TEMPLATE_ID"),"existing OTP SMS must remain intact");
must(!push.includes("SMS_NOTIFICATIONS_ENABLED=false")&&!push.includes("sendCaregiverNotificationSms ="),"web push must not disable or replace the SMS channel");

console.log("Caregiver RFC 8291 Web Push + visible activation UI + deploy-before-VAPID repair + existing SMS coexistence validation passed");
