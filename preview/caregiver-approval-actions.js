(()=>{
'use strict';
if(window.__salamatCaregiverApprovalActionsV1)return;
window.__salamatCaregiverApprovalActionsV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let directoryData=null;
let loadingPromise=null;
let applying=false;

function isUsersPage(){return String($('#pageTitle')?.textContent||'').includes('کاربران و دسترسی')}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}
function errorText(error){return [error?.message||'عملیات انجام نشد',error?.detail?String(error.detail).slice(0,300):''].filter(Boolean).join(' — ')}
async function loadDirectory(force=false){
  if(directoryData&&!force)return directoryData;
  if(loadingPromise&&!force)return loadingPromise;
  loadingPromise=api('/api/admin/directory').then(payload=>{directoryData=payload.data||{accounts:[],caregivers:[]};return directoryData}).finally(()=>{loadingPromise=null});
  return loadingPromise;
}
function addStyles(){
  if($('#caregiverApprovalActionsStyles'))return;
  const style=document.createElement('style');style.id='caregiverApprovalActionsStyles';style.textContent=`
  .caregiver-approval-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:-3px 4px 7px;padding:8px;border:1px solid #dfe9e4;border-top:0;border-radius:0 0 13px 13px;background:#f8fbf9}
  .caregiver-approval-actions button{border:0;border-radius:9px;padding:8px 7px;font:inherit;font-size:9px;font-weight:900;cursor:pointer;transition:.15s}
  .caregiver-approval-actions button:hover:not(:disabled){transform:translateY(-1px)}
  .caregiver-approval-actions button:disabled{opacity:.48;cursor:not-allowed}
  .caregiver-approval-actions .approve{background:#e4f7ec;color:#087844}.caregiver-approval-actions .suspend{background:#fff1d9;color:#965e00}.caregiver-approval-actions .delete{background:#ffe8eb;color:#b4233b}
  .caregiver-approval-actions.busy{opacity:.62;pointer-events:none}
  @media(max-width:720px){.caregiver-approval-actions{grid-template-columns:1fr 1fr 1fr}}
  `;document.head.appendChild(style);
}
function resolveRow(data,key){
  if(String(key).startsWith('profile:')){
    const caregiverId=String(key).slice(8),caregiver=(data.caregivers||[]).find(item=>item.id===caregiverId);
    return caregiver?{caregiver,account:null}:null;
  }
  const account=(data.accounts||[]).find(item=>item.id===key);
  if(!account||String(account.role||'').toUpperCase()!=='CAREGIVER')return null;
  const caregiver=(data.caregivers||[]).find(item=>item.id===account.caregiverId)||null;
  return caregiver?{caregiver,account}:null;
}
function actionsMarkup(item,key){
  const status=String(item.account?.status||'').toUpperCase(),hasAccount=Boolean(item.account);
  return `<div class="caregiver-approval-actions" data-caa-key="${String(key).replace(/"/g,'&quot;')}">
    <button type="button" class="approve" data-caa-action="approve" ${!hasAccount||['ACTIVE','APPROVED'].includes(status)?'disabled':''} title="${hasAccount?'تأیید و فعال‌سازی حساب مراقب':'این پرونده حساب ورود ندارد'}">تأیید</button>
    <button type="button" class="suspend" data-caa-action="suspend" ${!hasAccount||status==='SUSPENDED'?'disabled':''} title="${hasAccount?'تعلیق حساب مراقب':'این پرونده حساب ورود ندارد'}">تعلیق</button>
    <button type="button" class="delete" data-caa-action="delete">حذف</button>
  </div>`;
}
async function apply(){
  if(applying||!isUsersPage())return;
  const list=$('.sd-list');if(!list)return;
  applying=true;
  try{
    const data=await loadDirectory();
    $$('[data-sd-user-key]',list).forEach(row=>{
      const key=String(row.dataset.sdUserKey||''),item=resolveRow(data,key);
      const next=row.nextElementSibling;
      if(!item){if(next?.classList.contains('caregiver-approval-actions'))next.remove();return}
      if(next?.classList.contains('caregiver-approval-actions'))return;
      row.insertAdjacentHTML('afterend',actionsMarkup(item,key));
    });
  }catch(error){console.error('Caregiver approval actions failed',error)}finally{applying=false}
}
function setBusy(box,busy){box.classList.toggle('busy',busy);$$('button',box).forEach(button=>button.disabled=busy||button.dataset.wasDisabled==='1')}
async function runAction(box,action){
  const data=await loadDirectory(),item=resolveRow(data,String(box.dataset.caaKey||''));
  if(!item)return notify('پرونده پیدا نشد','فهرست را به‌روزرسانی کنید.');
  if(action!=='delete'&&!item.account)return notify('حساب ورود وجود ندارد','ابتدا از پروفایل این مراقب یک حساب ورود متصل بسازید.');
  if(action==='delete'&&!confirm(`حساب و پرونده «${item.caregiver.fullName||'مراقب'}» از فهرست حذف شود؟`))return;
  $$('button',box).forEach(button=>button.dataset.wasDisabled=button.disabled?'1':'0');setBusy(box,true);
  try{
    if(action==='approve'){
      await api(`/api/admin/caregivers/${encodeURIComponent(item.caregiver.id)}/status`,{method:'PATCH',body:JSON.stringify({status:'ACTIVE'})});
      notify('مراقب تأیید شد','حساب ورود فعال و پرونده مراقب تأیید شد.');
    }else if(action==='suspend'){
      await api(`/api/admin/caregivers/${encodeURIComponent(item.caregiver.id)}/status`,{method:'PATCH',body:JSON.stringify({status:'SUSPENDED'})});
      notify('مراقب تعلیق شد','ورود حساب مراقب تا فعال‌سازی مجدد مسدود شد.');
    }else{
      await api(`/api/admin/caregivers/${encodeURIComponent(item.caregiver.id)}`,{method:'DELETE'});
      notify('مراقب حذف شد','حساب و پرونده از فهرست فعال سامانه حذف شدند.');
    }
    directoryData=null;
    window.dispatchEvent(new CustomEvent('salamat-server-directory-refresh'));
    setTimeout(()=>{void loadDirectory(true).then(apply)},250);
  }catch(error){notify('عملیات انجام نشد',errorText(error));setBusy(box,false)}
}
function onClick(event){
  const button=event.target?.closest?.('[data-caa-action]');if(!button)return;
  const box=button.closest('.caregiver-approval-actions');if(!box)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void runAction(box,button.dataset.caaAction);
}
function boot(){
  addStyles();document.addEventListener('click',onClick,true);
  const content=$('#content');if(content)new MutationObserver(()=>void apply()).observe(content,{childList:true,subtree:true});
  window.addEventListener('salamat-server-directory-refresh',()=>{directoryData=null;setTimeout(()=>void apply(),150)});
  void apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
