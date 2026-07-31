(()=>{
'use strict';

const KEYS={
 auth:'salamatAvalAccessControlV1',
 evaluation:'salamatAvalEvaluationSystemV13',
 admin:'salamatAvalAdminWorkspaceV15',
 caregiverPanel:'salamatAvalCaregiverPanelV1',
 evaluationV1:'salamatAvalEvaluationV1',
};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

function notify(title,text){
 try{window.toast?.(title,text)}catch{}
 if(!window.toast)alert(`${title}\n${text}`);
}
async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',...options,headers});
 const text=await response.text();
 let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){
  const error=new Error(payload.message||`خطای ${response.status}`);
  error.status=response.status;error.code=payload.error;error.detail=payload.detail;error.payload=payload;
  throw error;
 }
 return payload;
}
function applyServerState(payload){
 const state=payload?.data?.state||payload?.state||{};
 if(state.auth)localStorage.setItem(KEYS.auth,JSON.stringify(state.auth));
 if(state.evaluation)localStorage.setItem(KEYS.evaluation,JSON.stringify(state.evaluation));
 if(state.admin)localStorage.setItem(KEYS.admin,JSON.stringify(state.admin));
 if(state.caregiverPanel)localStorage.setItem(KEYS.caregiverPanel,JSON.stringify(state.caregiverPanel));
 if(state.evaluationV1)localStorage.setItem(KEYS.evaluationV1,JSON.stringify(state.evaluationV1));
}
async function refreshState(openNeedle=''){
 const result=await api('/api/state');
 applyServerState(result);
 if(openNeedle){
  setTimeout(()=>{
   const button=$$('#sidebarNav .nav-item, #sidebarNav button').find(item=>String(item.textContent||'').includes(openNeedle));
   if(button)button.click();
  },40);
 }
 return result;
}
function setBusy(form,busy,label){
 const button=form?.querySelector('[type="submit"],button:not([type])');
 if(!button)return;
 if(!button.dataset.originalText)button.dataset.originalText=button.textContent||'ذخیره';
 button.disabled=busy;
 button.textContent=busy?(label||'در حال ذخیره در سرور...'):button.dataset.originalText;
}
function errorText(error){
 const parts=[error?.message||'عملیات انجام نشد'];
 if(error?.code)parts.push(`کد: ${error.code}`);
 if(error?.detail)parts.push(String(error.detail).slice(0,300));
 return parts.join(' — ');
}

async function submitCaregiver(event){
 const form=event.target;if(form?.id!=='admCareForm')return false;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const data=new FormData(form),id=String(data.get('id')||'').trim();
 const body={
  id,
  fullName:data.get('name'),
  mobile:data.get('phone'),
  nationalId:data.get('nationalId'),
  serviceGroup:data.get('serviceGroup'),
  fileStatus:data.get('fileStatus'),
  city:data.get('city'),
  address:data.get('address'),
  adminNote:data.get('adminNote'),
 };
 setBusy(form,true,'در حال ثبت پرونده در دیتابیس...');
 try{
  const result=await api(id?`/api/caregivers/${encodeURIComponent(id)}`:'/api/caregivers',{method:id?'PATCH':'POST',body:JSON.stringify(body)});
  await refreshState('پرونده');
  notify('پرونده روی سرور ذخیره شد',id?'تغییرات پرونده در D1 ثبت شد.':`مراقب با شناسه ${result?.data?.membershipCode||result?.data?.id||''} ایجاد شد.`);
 }catch(error){
  console.error('Canonical caregiver save failed',error);
  notify('ذخیره پرونده انجام نشد',errorText(error));
 }finally{setBusy(form,false)}
 return true;
}

async function submitUser(event){
 const form=event.target;if(form?.id!=='admUserForm')return false;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const data=new FormData(form),password=String(data.get('password')||'');
 if(password.length<8){notify('رمز کوتاه است','رمز باید حداقل ۸ کاراکتر باشد.');return true}
 const body={fullName:data.get('name'),role:data.get('role'),username:data.get('username'),password,email:data.get('email'),mobile:data.get('mobile'),status:'PENDING'};
 setBusy(form,true,'در حال ایجاد حساب در دیتابیس...');
 try{
  await api('/api/users',{method:'POST',body:JSON.stringify(body)});
  await refreshState('کاربران');
  notify('حساب روی سرور ایجاد شد','حساب در D1 ثبت شد و تا تأیید مدیر غیرفعال است.');
 }catch(error){
  console.error('Canonical user save failed',error);
  notify('ایجاد حساب انجام نشد',errorText(error));
 }finally{setBusy(form,false)}
 return true;
}

window.addEventListener('submit',event=>{
 if(event.target?.id==='admCareForm'){void submitCaregiver(event);return}
 if(event.target?.id==='admUserForm'){void submitUser(event)}
},true);

window.SalamatCanonicalData={api,refreshState,applyServerState};
})();
