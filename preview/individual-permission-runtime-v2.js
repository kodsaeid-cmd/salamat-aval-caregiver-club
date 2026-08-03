(()=>{
'use strict';
if(window.__salamatIndividualPermissionRuntimeV2)return;
window.__salamatIndividualPermissionRuntimeV2=true;

const VERSION='2.0.0';
const FORM_SELECTOR='#spxAccountForm';
const snapshots=new WeakMap();
let observer=null;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const panelForRole=role=>String(role||'').toUpperCase()==='CAREGIVER'?'CAREGIVER':'STAFF';
const panelFromMatrix=form=>{
 const key=$('[data-spx-module]',form)?.dataset.spxModule||'';
 return key.startsWith('caregiver.')?'CAREGIVER':key.startsWith('staff.')?'STAFF':panelForRole(form.elements.role?.value);
};
function matrixSnapshot(form){
 return {
  panel:panelFromMatrix(form),
  values:new Map($$('[data-spx-module]',form).map(row=>[
   row.dataset.spxModule,
   Object.fromEntries($$('[data-spx-action]',row).map(input=>[input.dataset.spxAction,Boolean(input.checked)])),
  ])),
 };
}
function restoreMatrix(form,snapshot){
 if(!snapshot||snapshot.panel!==panelFromMatrix(form))return false;
 $$('[data-spx-module]',form).forEach(row=>{
  const saved=snapshot.values.get(row.dataset.spxModule);if(!saved)return;
  $$('[data-spx-action]',row).forEach(input=>{if(input.dataset.spxAction in saved)input.checked=Boolean(saved[input.dataset.spxAction])});
 });
 return true;
}
function enhance(form){
 if(!(form instanceof HTMLFormElement))return;
 form.dataset.individualPermissionPolicy='USER_OVERRIDES_ROLE_TEMPLATE';
 const note=$('.spx-note',form);
 if(note){
  note.innerHTML='<strong>دسترسی اختصاصی این حساب</strong><br>نقش فقط عنوان سازمانی و الگوی اولیه است. مجوزهای ذخیره‌شده همین کاربر بر نقش اولویت دارند؛ بنابراین دو کاربر با نقش یکسان می‌توانند دسترسی کاملاً متفاوت داشته باشند.';
  note.dataset.individualPolicy='true';
 }
 const title=$('.spx-field.wide>span',form);
 if(title&&!title.querySelector('.spx-individual-badge')){
  const badge=document.createElement('small');badge.className='spx-individual-badge';badge.textContent='مستقل از نقش';title.appendChild(badge);
 }
}
function captureRoleChange(event){
 const select=event.target;
 if(!(select instanceof HTMLSelectElement)||select.name!=='role')return;
 const form=select.closest(FORM_SELECTOR);if(!form)return;
 const snapshot=matrixSnapshot(form);snapshots.set(form,snapshot);
 queueMicrotask(()=>{
  const saved=snapshots.get(form);const samePanel=saved?.panel===panelForRole(select.value);
  if(samePanel)restoreMatrix(form,saved);
  enhance(form);
  const note=$('.spx-note',form);
  if(note){
   note.insertAdjacentHTML('beforeend',samePanel
    ? '<br><em>نقش تغییر کرد؛ انتخاب‌های اختصاصی قبلی این حساب حفظ شد.</em>'
    : '<br><em>نوع پنل تغییر کرد؛ ماژول‌های پنل جدید از الگوی اولیه نقش بارگذاری شدند و اکنون قابل شخصی‌سازی‌اند.</em>');
  }
 },0);
}
function scan(root=document){
 root.querySelectorAll?.(FORM_SELECTOR).forEach(enhance);
 if(root.matches?.(FORM_SELECTOR))enhance(root);
}
function observe(){
 const content=document.querySelector('#content');
 if(!content){requestAnimationFrame(observe);return}
 observer?.disconnect();observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof Element)scan(node)})));
 observer.observe(content,{childList:true,subtree:true});scan(content);
}
function clearSnapshots(){
 try{for(let i=sessionStorage.length-1;i>=0;i-=1){const key=sessionStorage.key(i);if(key?.startsWith('salamatAccessSnapshotV2:'))sessionStorage.removeItem(key)}}catch{}
}

document.addEventListener('change',captureRoleChange,true);
document.addEventListener('submit',event=>{const form=event.target;if(form?.matches?.(FORM_SELECTOR)){enhance(form);clearSnapshots()}},true);
window.addEventListener('salamat-access-changed',()=>{clearSnapshots();scan()});
window.addEventListener('pageshow',()=>{clearSnapshots();scan()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();

const style=document.createElement('style');style.id='salamatIndividualPermissionStylesV2';style.textContent=`
.spx-individual-badge{display:inline-flex;margin-right:7px;padding:3px 7px;border-radius:999px;background:#e8f5ed;color:#185b38;font-size:7px;font-weight:900;vertical-align:middle}.spx-note[data-individual-policy="true"]{border:1px solid #d8e9df;background:#f5faf7;color:#355347}.spx-note[data-individual-policy="true"] strong{color:#185b38}.spx-note[data-individual-policy="true"] em{color:#8b5b00;font-style:normal;font-weight:800}
`;(document.head||document.documentElement).appendChild(style);
window.SalamatIndividualPermissions={version:VERSION,scan,clearCache:clearSnapshots};
})();