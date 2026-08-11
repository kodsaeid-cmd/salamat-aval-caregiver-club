import fs from 'node:fs';

const [requestedBaseUrl,metadataPath]=process.argv.slice(2);
const password=process.env.ADMIN_CORE_SMOKE_PASSWORD||'';
const ALLOWED_BASE_URL='https://salamatavalcaregivers.site';
if(!requestedBaseUrl||!metadataPath||!password)throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-self-registration-production-smoke.mjs <base-url> <metadata-path>');
const baseUrl=requestedBaseUrl.replace(/\/+$/,'');
if(baseUrl!==ALLOWED_BASE_URL)throw new Error(`Self-registration smoke target is not allowlisted: ${baseUrl}`);
const metadata=JSON.parse(fs.readFileSync(metadataPath,'utf8'));
const root=metadata.users?.root,pendingUser=metadata.users?.pendingCaregiver,pendingProfile=metadata.pendingRegistrationProfile;
if(!root?.username||!pendingUser?.id||!pendingUser?.username||!pendingProfile?.id||!pendingProfile?.membershipCode)throw new Error('Linked pending self-registration fixture is missing.');
const expect=(condition,message)=>{if(!condition)throw new Error(`Self-registration production smoke failed: ${message}`)};
async function request(path,options={}){const response=await fetch(`${baseUrl}${path}`,{redirect:'manual',cache:'no-store',...options,headers:{accept:'application/json','cache-control':'no-cache',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});const text=await response.text();let body=null;try{body=text?JSON.parse(text):null}catch{body={raw:text.slice(0,300)}}return{response,body,text}}
function sessionCookie(response){const values=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];return(values[0]||response.headers.get('set-cookie')||'').split(';')[0]}
async function login(identifier){const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({identifier,password})});expect(result.response.status===200,`login for ${identifier} returned ${result.response.status}: ${JSON.stringify(result.body)}`);const cookie=sessionCookie(result.response);expect(cookie.startsWith('salamat_session='),'session cookie missing');return{cookie,body:result.body}}
async function authed(cookie,path,options={},expected=200){const result=await request(path,{...options,headers:{...(options.headers||{}),cookie}});expect(result.response.status===expected,`${options.method||'GET'} ${path} returned ${result.response.status}; expected ${expected}: ${JSON.stringify(result.body)}`);return result.body}

const rootSession=await login(root.username);expect(rootSession.body?.data?.role==='ADMIN','root fixture is not ADMIN');
const rootCookie=rootSession.cookie;
const before=await authed(rootCookie,'/api/users?page=1&status=PENDING&registration=SELF_REGISTERED');
const pendingRows=Array.isArray(before?.data)?before.data:[];
const beforeRow=pendingRows.find((row)=>row.id===pendingUser.id||row.caregiverId===pendingProfile.id);
expect(beforeRow,'linked pending self-registration is missing from approval queue');
expect(beforeRow.pendingApproval===true,'linked pending self-registration is not marked pendingApproval');
expect(beforeRow.profileOnly===false,'linked fixture unexpectedly rendered as profile-only');

const approved=await authed(rootCookie,`/api/users/${encodeURIComponent(pendingUser.id)}`,{method:'PATCH',body:JSON.stringify({status:'ACTIVE',username:pendingUser.username,role:'CAREGIVER',approvalAction:'APPROVE_SELF_REGISTRATION'})});
expect(approved?.data?.id===pendingUser.id,'approval did not preserve the linked account id');
expect(approved?.data?.status==='ACTIVE'&&approved?.data?.approved===true,'approval did not return ACTIVE/approved state');
await authed(rootCookie,`/api/admin/access/users/${encodeURIComponent(pendingUser.id)}`,{method:'PUT',body:JSON.stringify({role:'CAREGIVER',permissions:[]})});

const afterPending=await authed(rootCookie,'/api/users?page=1&status=PENDING&registration=SELF_REGISTERED');
expect(!(afterPending?.data||[]).some((row)=>row.id===pendingUser.id||row.caregiverId===pendingProfile.id),'approved linked registration remained in pending queue');
const afterSearch=await authed(rootCookie,`/api/users?page=1&q=${encodeURIComponent(pendingProfile.membershipCode)}`);
const activeRow=(afterSearch?.data||[]).find((row)=>row.id===pendingUser.id||row.caregiverId===pendingProfile.id);
expect(activeRow,'approved caregiver account disappeared from users directory');
expect(String(activeRow.status).toUpperCase()==='ACTIVE','approved linked caregiver account is not ACTIVE');
expect(String(activeRow.recruitmentStage).toUpperCase()==='APPROVED','caregiver recruitment stage is not APPROVED');
expect(activeRow.pendingApproval===false,'approved caregiver is still flagged pendingApproval');

const caregiverSession=await login(pendingUser.username);
expect(caregiverSession.body?.data?.role==='CAREGIVER','approved linked account cannot login as CAREGIVER');
await authed(caregiverSession.cookie,'/api/auth/logout',{method:'POST'});
await authed(rootCookie,'/api/auth/logout',{method:'POST'});

fs.mkdirSync('.admin-core-smoke',{recursive:true,mode:0o700});
fs.writeFileSync('.admin-core-smoke/self-registration-approval-result.json',JSON.stringify({caregiverId:pendingProfile.id,userId:pendingUser.id,queueBefore:true,approved:true,queueAfter:false,recruitmentStage:'APPROVED',loginAfterApproval:true,verifiedAt:new Date().toISOString()},null,2),{mode:0o600});
console.log('Linked pending self-registration production smoke passed end to end.');
