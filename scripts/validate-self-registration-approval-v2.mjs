import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const worker=read('worker/self-registered-approval-v1.ts');
const outer=read('worker/index-desktop-react-v1.ts');
const onboarding=read('worker/index-caregiver-onboarding-v2.ts');
const desktop=read('desktop-react/users-dashboard-v2.tsx');
const expect=(condition,message)=>{if(!condition)throw new Error(`Self-registration approval v2 validation failed: ${message}`)};
const has=(source,needle,message)=>expect(source.includes(needle),message);

has(outer,'routeSelfRegisteredApprovalV1','active outer worker does not import approval route');
expect(outer.indexOf('routeSelfRegisteredApprovalV1(request, env)')<outer.indexOf('delegateProtectedApp(request, env, ctx)'),'approval route is not evaluated before protected fallback');
has(onboarding,'const pendingApproval = selfRegistered && String(row.status || "").toUpperCase() === "PENDING"','directory does not identify linked pending self-registrations');

has(worker,'async function accountById','linked caregiver account lookup is missing');
has(worker,'async function resolveApprovalTarget','approval target resolver is missing');
has(worker,'String(record.recruitmentStage||"").toUpperCase()!=="SELF_REGISTERED"','real user IDs are not restricted to self-registered caregivers');
has(worker,'approvalAction==="APPROVE_SELF_REGISTRATION"?"ACTIVE":rawStatus','explicit approval action does not force activation');
has(worker,'existing&&normalizedStatus==="ACTIVE"&&!password&&!existing.passwordHash','linked account without password is not protected');
has(worker,"recruitment_stage='APPROVED',cooperation_status='CP-01 فعال'",'approved caregiver state is not normalized');
has(worker,'APPROVE_SELF_REGISTERED_ACCOUNT','linked-account approval audit action is missing');
has(worker,'approved:normalizedStatus==="ACTIVE"','approval response does not expose final state');

has(desktop,'pendingApproval=Boolean(profileOnly||user?.pendingApproval)','linked pending registrations are not treated as approval candidates');
has(desktop,'approvalAction:pendingApproval?"APPROVE_SELF_REGISTRATION":undefined','desktop approval does not send explicit approval intent');
has(desktop,'const defaultStatus=pendingApproval?"ACTIVE"','pending self-registration does not default to ACTIVE');
has(desktop,'requiresPassword=create||profileOnly','existing linked account incorrectly requires password reset');
has(desktop,'حساب ورود مراقب موجود است اما هنوز فعال نشده','linked pending account UI does not explain activation');
has(desktop,'p.data?.id||p.data?.userId||id','desktop does not continue permission save using the real account id');

console.log('Self-registration approval v2 contract passed for profile-only and linked-pending caregiver accounts.');
