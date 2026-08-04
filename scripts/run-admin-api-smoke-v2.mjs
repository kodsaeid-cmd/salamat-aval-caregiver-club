import fs from 'node:fs';

const [rawBaseUrl, metadataPath] = process.argv.slice(2);
const password = process.env.ADMIN_CORE_SMOKE_PASSWORD || '';
if (!rawBaseUrl || !metadataPath || !password) {
  throw new Error('Usage: ADMIN_CORE_SMOKE_PASSWORD=... node scripts/run-admin-api-smoke-v2.mjs <base-url> <metadata-path>');
}
const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const rootUser = metadata.users?.root;
if (!rootUser?.username) throw new Error('Root smoke identity is missing.');

const EXPECTED_MODULES = [
  'staff.dashboard','staff.users','staff.caregivers','staff.contracts','staff.payroll',
  'staff.financial_credits','staff.training','staff.evaluations','staff.support','staff.settings',
];
const checks=[];
const expect=(condition,message)=>{if(!condition)throw new Error(`Admin API smoke v2 failed: ${message}`)};
const passed=check=>checks.push({check,status:'passed'});
async function request(path,options={}){
  const response=await fetch(`${baseUrl}${path}`,{redirect:'manual',cache:'no-store',...options,headers:{accept:'application/json','cache-control':'no-cache',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
  const text=await response.text();let body=null;try{body=text?JSON.parse(text):null}catch{body={raw:text.slice(0,300)}}
  return {response,body,text};
}
async function waitForRelease(){
  const deadline=Date.now()+240_000;let last='no response';
  while(Date.now()<deadline){
    const version=await request(`/api/system/version?access-v2=${Date.now()}`).catch(error=>({response:{status:0},body:null,error}));
    const html=await fetch(`${baseUrl}/?access-v2=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}}).then(async response=>({response,text:await response.text()})).catch(error=>({response:{status:0,headers:new Headers()},text:'',error}));
    const ready=version.response.status===200&&version.body?.caregiverPlatform==='2.2.0'&&version.body?.adminRouter==='4.0.0'&&version.body?.accessControl==='2.0.0'&&html.response.status===200&&html.response.headers.get('x-salamat-caregiver-platform')==='2.2.0'&&html.response.headers.get('x-salamat-admin-router')==='4.0.0'&&html.response.headers.get('x-salamat-access-control')==='2.0.0'&&html.text.includes('access-control-runtime-v2.js?v=2.2.0')&&!/access-control-runtime\.js(?:\?|["'])/.test(html.text)&&html.text.includes('staff-module-router-v3.js?v=2.2.0');
    if(ready)return {version:version.body,html};
    last=JSON.stringify({version:version.body,htmlStatus:html.response.status,platform:html.response.headers.get?.('x-salamat-caregiver-platform'),router:html.response.headers.get?.('x-salamat-admin-router'),access:html.response.headers.get?.('x-salamat-access-control'),v2:html.text.includes('access-control-runtime-v2.js?v=2.2.0'),v1:/access-control-runtime\.js(?:\?|["'])/.test(html.text)});
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error(`Admin API smoke v2 failed: release did not converge: ${last}`);
}
function sessionCookie(response){const values=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];return (values[0]||response.headers.get('set-cookie')||'').split(';')[0]}
async function authed(cookie,path,expected=200){const result=await request(path,{headers:{cookie}});expect(result.response.status===expected,`${path} returned ${result.response.status}; expected ${expected}: ${JSON.stringify(result.body)}`);return result.body}

const release=await waitForRelease();
expect(release.version.frontendContract==='caregiver-platform-v2-router-v4-access-v2','frontend contract is not access v2');passed('release.access-v2');
const login=await request('/api/auth/login',{method:'POST',body:JSON.stringify({identifier:rootUser.username,password})});
expect(login.response.status===200,`login returned ${login.response.status}: ${JSON.stringify(login.body)}`);const cookie=sessionCookie(login.response);expect(cookie.startsWith('salamat_session='),'session cookie missing');passed('root.login');
const access=await authed(cookie,'/api/access/me');
expect(access?.data?.panel==='STAFF','root did not enter staff panel');expect(access?.data?.moduleContractVersion==='3.0.0','module contract is not 3.0.0');
const modules=access.data.modules.map(module=>module.key);expect(JSON.stringify(modules)===JSON.stringify(EXPECTED_MODULES),`visible module order differs: ${JSON.stringify(modules)}`);expect(!modules.includes('staff.reports'),'reports remain visible');passed('root.ten-module-contract');
const config=await authed(cookie,'/api/access/configuration');const configKeys=new Set((config?.data?.modules||[]).map(module=>module.key));expect(configKeys.has('staff.financial_credits'),'finance missing from permissions matrix');expect(configKeys.has('staff.support'),'support missing from permissions matrix');expect(!configKeys.has('staff.reports'),'reports remain in permissions matrix');passed('root.permissions-matrix');
const users=await authed(cookie,'/api/users?page=1');expect(Array.isArray(users?.data),'users endpoint did not return accounts');passed('root.users');
const training=await authed(cookie,'/api/training/admin');expect(Array.isArray(training?.data?.courses)&&Array.isArray(training?.data?.assignments),'training endpoint invalid');passed('root.training');
const finance=await authed(cookie,'/api/staff/financial-credits');expect(finance?.data&&!Object.hasOwn(finance.data,'payroll'),'finance still contains payroll');passed('root.finance');
const payroll=await authed(cookie,'/api/staff/payroll?page=1&pageSize=10');expect(Array.isArray(payroll?.data?.slips),'payroll endpoint invalid');passed('root.payroll');
const settings=await authed(cookie,'/api/staff/system-settings');expect(settings?.data?.settings?.systemName,'settings endpoint invalid');passed('root.settings');
const logs=await authed(cookie,'/api/staff/audit-logs?page=1&pageSize=10');expect(Array.isArray(logs?.data?.logs),'audit endpoint invalid');passed('root.audit');
const logout=await request('/api/auth/logout',{method:'POST',headers:{cookie}});expect(logout.response.status===200,'logout failed');passed('root.logout');
const evidence={caregiverPlatform:'2.2.0',adminRouter:'4.0.0',accessControl:'2.0.0',visibleModules:EXPECTED_MODULES,pollingAccessRuntimeRemoved:true,checks,verifiedAt:new Date().toISOString()};
fs.mkdirSync('.admin-core-smoke',{recursive:true,mode:0o700});fs.writeFileSync('.admin-core-smoke/result-v2.json',JSON.stringify(evidence,null,2),{mode:0o600});
console.log(`Admin API smoke v2 passed with ${checks.length} checks.`);
