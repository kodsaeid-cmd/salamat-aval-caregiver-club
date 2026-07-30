(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const ADMIN_ID='SYS-ADMIN';
const ADMIN_USERNAME='GodKod';
const ADMIN_PASSWORD_HASH='eb58f252c37e7e4a8928597aefc2bad2043438cc51825addbeba3f56662cdc87';
const CREDENTIAL_VERSION='god-admin-sha256-v1';

function sha256(ascii){
 const rightRotate=(value,amount)=>(value>>>amount)|(value<<(32-amount));
 const mathPow=Math.pow,maxWord=mathPow(2,32),words=[],asciiBitLength=ascii.length*8;
 let hash=sha256.h=sha256.h||[],k=sha256.k=sha256.k||[],primeCounter=k.length,isComposite={},candidate=2;
 for(;primeCounter<64;candidate++)if(!isComposite[candidate]){for(let i=0;i<313;i+=candidate)isComposite[i]=candidate;hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0}
 ascii+='\x80';while(ascii.length%64-56)ascii+='\x00';
 for(let i=0;i<ascii.length;i++){const j=ascii.charCodeAt(i);if(j>>8)throw new Error('Only ASCII passwords are supported.');words[i>>2]|=j<<((3-i)%4)*8}
 words[words.length]=(asciiBitLength/maxWord)|0;words[words.length]=asciiBitLength;
 for(let j=0;j<words.length;){const w=words.slice(j,j+=16),oldHash=hash.slice(0);hash=hash.slice(0,8);for(let i=0;i<64;i++){const w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4],temp1=hash[7]+(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=i<16?w[i]:(w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))+w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0),temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));hash=[(temp1+temp2)|0,a,hash[1],hash[2],(hash[3]+temp1)|0,e,hash[5],hash[6]]}for(let i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0}
 let result='';for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;result+=(b<16?'0':'')+b.toString(16)}return result;
}
function defaultAuth(){return {users:[
 {id:ADMIN_ID,name:'مدیر سامانه',username:ADMIN_USERNAME,password:ADMIN_PASSWORD_HASH,passwordEncoding:'sha256',email:'admin@salamataval.ir',mobile:'',role:'admin',status:'approved',createdAt:'حساب اولیه سامانه'},
 {id:'USR-CARE-001',name:'مریم حسینی',username:'maryam',password:'123456',email:'maryam@salamataval.ir',mobile:'09128668837',role:'caregiver',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-REC-001',name:'مهدی رضایی',username:'recruiter',password:'123456',email:'recruitment@salamataval.ir',mobile:'09120000001',role:'recruiter',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-HR-001',name:'سارا محمدی',username:'hr',password:'123456',email:'hr@salamataval.ir',mobile:'09120000002',role:'hr',status:'pending',createdAt:'نمونه اولیه'}
 ],audit:[],credentialVersion:CREDENTIAL_VERSION}}
function migrateAdmin(){
 let state;try{state=JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{state=null}if(!state)state=defaultAuth();state.users=Array.isArray(state.users)?state.users:[];state.audit=Array.isArray(state.audit)?state.audit:[];
 let admin=state.users.find(user=>user.id===ADMIN_ID)||state.users.find(user=>user.role==='admin'&&['admin',ADMIN_USERNAME.toLowerCase()].includes(String(user.username||'').toLowerCase()));
 if(!admin){admin={id:ADMIN_ID,name:'مدیر سامانه',email:'admin@salamataval.ir',mobile:'',createdAt:'حساب اولیه سامانه'};state.users.unshift(admin)}
 const changed=admin.id!==ADMIN_ID||admin.username!==ADMIN_USERNAME||admin.password!==ADMIN_PASSWORD_HASH||admin.passwordEncoding!=='sha256'||admin.role!=='admin'||admin.status!=='approved'||state.credentialVersion!==CREDENTIAL_VERSION;
 Object.assign(admin,{id:ADMIN_ID,username:ADMIN_USERNAME,password:ADMIN_PASSWORD_HASH,passwordEncoding:'sha256',role:'admin',status:'approved'});admin.name=admin.name||'مدیر سامانه';admin.email=admin.email||'admin@salamataval.ir';state.credentialVersion=CREDENTIAL_VERSION;
 if(changed)state.audit.unshift({at:new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date()),action:'به‌روزرسانی حساب مدیر کل',detail:'شناسه ورود اصلی سامانه تغییر کرد'});state.audit=state.audit.slice(0,200);localStorage.setItem(AUTH_KEY,JSON.stringify(state));
}
function isAdminSelected(){try{return selectedRole==='admin'}catch{return document.querySelector('#roleOptions [data-role="admin"]')?.classList.contains('active')}}
function sanitizeAdminLogin(){
 const box=document.querySelector('#emailFields'),login=box?.querySelector('input:not([type="password"])'),password=box?.querySelector('input[type="password"]');document.querySelector('#adminCredentialNote')?.remove();if(!isAdminSelected())return;
 if(login){login.type='text';login.placeholder='نام کاربری مدیر کل';login.autocomplete='username';if(String(login.value).trim().toLowerCase()==='admin')login.value=''}
 if(password){password.autocomplete='current-password';if(password.value==='admin')password.value=''}const label=box?.querySelector('label');if(label)label.textContent='نام کاربری';
}
function removeLegacyCopy(root=document){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){const value=node.nodeValue||'';if(/admin\s*[\/:،-]\s*admin/i.test(value))node.nodeValue=value.replace(/حساب مدیر اولیه با\s*admin\s*[\/:،-]\s*admin\s*فعال است\.?/gi,'حساب مدیر کل با شناسه اختصاصی فعال است.').replace(/نام کاربری:\s*admin[\s\S]*رمز عبور:\s*admin/gi,'')}}
function installCredentialGate(){
 migrateAdmin();sanitizeAdminLogin();removeLegacyCopy();
 const form=document.querySelector('#loginForm');form?.addEventListener('submit',event=>{if(!isAdminSelected())return;const method=document.querySelector('#methodTabs button.active')?.dataset.method||'mobile';if(method!=='email')return;const fields=document.querySelectorAll('#emailFields input'),password=fields[1];if(!password)return;const raw=password.value,hashed=sha256(raw);password.value=hashed;setTimeout(()=>{if(document.contains(password)&&password.value===hashed)password.value=raw},0)},true);
 document.querySelectorAll('#roleOptions [data-role]').forEach(button=>button.addEventListener('click',()=>setTimeout(sanitizeAdminLogin,25)));
 const login=document.querySelector('#loginForm');if(login)new MutationObserver(()=>sanitizeAdminLogin()).observe(login,{childList:true,subtree:true});const content=document.querySelector('#content');if(content)new MutationObserver(()=>removeLegacyCopy(content)).observe(content,{childList:true,subtree:true});
 window.addEventListener('storage',event=>{if(event.key===AUTH_KEY)migrateAdmin()});window.addEventListener('salamat-access-changed',()=>setTimeout(migrateAdmin,0));
}
installCredentialGate();
})();

(async()=>{try{const files=['./cp2-00.txt','./cp2-01.txt','./cp2-02.txt'];const parts=await Promise.all(files.map(async file=>{const response=await fetch(file,{cache:'no-store'});if(!response.ok)throw new Error(`Failed to load ${file}`);return response.text()}));eval(parts.join(''));window.__caregiverV2Ready=true;const evaluationScript=document.createElement('script');evaluationScript.src='./evaluation-system.js?v=1.3.2';evaluationScript.async=false;evaluationScript.onload=()=>{window.__evaluationSystemReady=true;const governanceScript=document.createElement('script');governanceScript.src='./evaluation-governance.js?v=1.3.2';governanceScript.async=false;governanceScript.onload=()=>{window.__evaluationGovernanceReady=true;if(!document.querySelector('#appView').classList.contains('hidden')){if(selectedRole==='caregiver')renderDashboard(roles.caregiver);else if(selectedRole==='hr')renderDashboard(roles.hr)}};document.body.appendChild(governanceScript)};document.body.appendChild(evaluationScript);if(!document.querySelector('#appView').classList.contains('hidden')&&selectedRole==='caregiver')renderDashboard(roles.caregiver)}catch(error){console.error('Caregiver panel v2 failed to load',error)}})();