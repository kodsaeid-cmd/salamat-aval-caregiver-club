import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('migrations/0122_caregiver_reregistration_v1.sql');
const worker=read('worker/caregiver-reregistration-v1.ts');
const outer=read('worker/index-desktop-react-v1.ts');
const users=read('desktop-react/users-access-v3.tsx');
const usersCards=read('desktop-react/users-access-v4.tsx');
const dashboard=read('desktop-react/users-dashboard-v3.tsx');
const signup=read('mobile-react/mobile-signup-v1.tsx');
const expect=(v,m)=>{if(!v)throw new Error(`Caregiver re-registration v1 validation failed: ${m}`)};
const has=(s,n,m)=>expect(s.includes(n),m);

has(migration,'CREATE TABLE IF NOT EXISTS caregiver_registration_events','registration event ledger missing');
has(migration,"registration_kind IN ('NEW','REREGISTRATION')",'registration classification missing');
has(migration,"UPDATE caregivers\nSET active = 0",'existing caregiver reset missing');
has(migration,"UPDATE users\nSET status = 'INACTIVE'",'existing caregiver accounts are not reset');
expect(!/DELETE\s+FROM/i.test(migration),'migration must remain additive/non-destructive');
has(migration,"SET expires_at = '1970-01-01T00:00:00.000Z'",'old caregiver sessions are not expired');

has(worker,'findCaregiverByNationalId','national-id re-registration match missing');
has(worker,"registration_kind='REREGISTRATION'",'re-registration event is not written');
has(worker,"username=?,password_hash=?,status='PENDING'",'existing login identity is not replaced/pended');
has(worker,'mobile,mobile,passwordHash','new caregiver account does not use mobile as username');
has(worker,'/api/admin/caregiver-registrations/summary','registration summary endpoint missing');
has(worker,'/api/admin/caregiver-registrations/seen','one-time admin seen endpoint missing');
has(outer,'routeCaregiverReregistrationV1(request,env)','outer worker does not intercept re-registration before new registration');
expect(outer.indexOf('routeCaregiverReregistrationV1(request,env)')<outer.indexOf('routePendingReferralUnityV1(request,env)'),'re-registration must run before referral/new-registration path');
has(outer,'recordNewCaregiverRegistrationV1','new-registration classification is not recorded');

has(users,'جدید الورود','new registration filter missing');
has(users,'ثبت نام مجدد','re-registration filter/tag missing');
has(users,'registration=useState(initialRegistration)','URL-driven registration filter missing');
has(usersCards,'ثبت نام جدید','users module new-registration counter missing');
has(usersCards,'ثبت نام مجددی‌ها','users module re-registration counter missing');
has(dashboard,'ثبت نام جدید','admin dashboard new-registration card missing');
has(dashboard,'ثبت نام مجددی‌ها','admin dashboard re-registration card missing');
has(signup,'تبریک! شما به شبکه مراقبین سلامت اول پیوستید','required success message missing');

console.log('Caregiver re-registration v1 contract passed.');
