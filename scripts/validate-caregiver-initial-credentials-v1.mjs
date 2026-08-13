import fs from 'node:fs';

const policy=fs.readFileSync('worker/caregiver-initial-credentials-v1.ts','utf8');
const outer=fs.readFileSync('worker/index-desktop-react-v1.ts','utf8');
const profile=fs.readFileSync('worker/caregiver-self-profile-v1.ts','utf8');
const users=fs.readFileSync('mobile-react/admin-users-access-v1.tsx','utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver initial credentials v1 validation failed: ${message}`)};
const has=(source,needle,message)=>expect(source.includes(needle),message);

has(policy,"username,password_hash,role,status",'pending account insert is missing');
has(policy,"mobile,mobile,passwordHash",'registration does not use mobile as initial username');
has(policy,"await hashPassword(nationalId)",'national id is not hashed as the initial password');
has(policy,"'CAREGIVER','PENDING'",'self-registration account is not pending');
has(policy,'account_pending_approval','pending login response code is missing');
has(policy,'حساب شما در انتظار تأیید مدیرسامانه است','pending approval message is missing');
has(policy,'["view","create","update","delete"].every','full Users & Access authority gate is missing');
has(policy,'FIRST_CAREGIVER_LOGIN','first caregiver login event is missing');
has(policy,'مراقب عزیز به باشگاه مراقبین خوش آمدید','welcome notification copy is missing');
has(policy,'اطلاعات حساب کاربری','profile account UI section is missing');
has(policy,'name="passwordConfirm"','password confirmation field is missing');
has(policy,'minlength="8"','eight-character minimum is missing');
has(policy,'ورود\\s*با\\s*(پیامک','OTP-login UI hider is missing');
has(policy,'اگر اولین بار وارد باشگاه می‌شوید','initial credential login hint is missing');
has(outer,'routeCaregiverInitialCredentialsV1(request,env)','production entry does not route credential policy first');
has(outer,'decorateCaregiverWelcomeNotificationV1','welcome notification decorator is not wired');
has(outer,'caregiver-account-ui-v1.js','account UI runtime is not injected');
has(profile,'UPDATE users SET ${userFields.join(",")}', 'self profile is not writing the canonical users row');
has(profile,'if (password && password.length < 8)','server-side minimum password length is missing');
has(users,'pendingApproval?"APPROVE_SELF_REGISTRATION":undefined','admin users module does not send explicit approval action');

console.log('Caregiver initial credentials v1 contract passed.');
