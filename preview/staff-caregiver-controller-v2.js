(()=>{
'use strict';
if(window.__salamatStaffCaregiverControllerV2)return;
window.__salamatStaffCaregiverControllerV2=true;

const VERSION='2.0.0';
const MODULE_KEY='staff.caregivers';
const state={page:1,query:'',pagination:null,items:[],view:'list',activeId:'',listAbort:null,recordAbort:null,recordPromise:null,token:0,lastOpenId:'',lastOpenAt:0,lastModuleAt:0};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const isCaregiverLabel=label=>{const text=normalize(label);return text==='پرونده مراقبین'||text==='پرونده حرفه‌ای مراقبین'||text.includes('پرونده مراقب')};
const can=action=>Boolean(window.SalamatAccessControl?.can?.(MODULE_KEY,action)||window.SalamatStrictModuleGuard?.can?.(MODULE_KEY,action));
const initials=name=>normalize(name||'مراقب').split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م';

async function api(path,options={}){
 const headers=new Headers(options.headers||{});if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});const text=await response.text();let payload={};
 try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
 return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function setPage(title,subtitle,html){
 const titleNode=$('#pageTitle'),subtitleNode=$('#pageSubtitle'),content=$('#content');
 if(titleNode)titleNode.textContent=title;if(subtitleNode)subtitleNode.textContent=subtitle;if(content)content.innerHTML=html;
 try{window.hydrateIcons?.(content)}catch{}
}
function markSidebar(){
 $$('#sidebarNav [data-staff-module-key]').forEach(button=>button.classList.toggle('active',button.dataset.staffModuleKey===MODULE_KEY));
}
function statusTone(value){const text=normalize(value);return /فعال|تأیید/.test(text)?'good':/بلک|تعلیق|غیرفعال|حذف/.test(text)?'bad':'warn'}
function avatar(item,cls='scv2-avatar'){return item.avatarUrl?`<img class="${cls}" src="${esc(item.avatarUrl)}" alt="تصویر ${esc(item.fullName||'مراقب')}">`:`<span class="${cls}">${esc(initials(item.fullName))}</span>`}
function listShell(){
 state.view='list';state.activeId='';markSidebar();
 setPage('پرونده مراقبین','فهرست سروری و پرونده حرفه‌ای مراقبین',`<section class="module-page scv2-root" data-view="staff-caregiver-list" data-module-key="${MODULE_KEY}"><header class="scv2-toolbar"><div><span>باشگاه مراقبین سلامت اول</span><h2>پرونده مراقبین</h2><p>جست‌وجو و مشاهده پرونده‌ها مستقیماً از دیتابیس انجام می‌شود.</p></div><div class="scv2-actions"><button type="button" class="scv2-btn" data-scv2-refresh>تازه‌سازی</button></div></header><form class="scv2-search" id="scv2Search"><input id="scv2Query" value="${esc(state.query)}" placeholder="نام، شماره پرونده، موبایل یا کد ملی"><button class="scv2-btn primary" type="submit">جست‌وجو</button></form><div id="scv2Workspace" class="scv2-loading">در حال دریافت پرونده‌ها...</div></section>`);
}
function listMarkup(){
 const p=state.pagination||{};
 return `<section class="scv2-card"><div class="scv2-list">${state.items.map(item=>`<button type="button" class="scv2-person" data-server-caregiver-open="${esc(item.id)}" data-caregiver-id="${esc(item.id)}" data-record-id="${esc(item.id)}" aria-label="مشاهده پرونده ${esc(item.fullName||item.membershipCode||item.id)}"><span>${avatar(item)}</span><span class="scv2-person-main"><strong>${esc(item.fullName||'بدون نام')}</strong><small>${esc(item.membershipCode||item.id)} • ${esc(item.mobile||'بدون موبایل')}</small><em>${esc(item.primaryType||'گروه خدمتی ثبت نشده')}</em></span><span class="scv2-person-side"><i class="${statusTone(item.fileStatus)}">${esc(item.fileStatus||'بدون وضعیت')}</i><b>مشاهده پرونده</b></span></button>`).join('')||'<div class="scv2-empty">پرونده‌ای با این مشخصات پیدا نشد.</div>'}</div><footer class="scv2-footer"><button type="button" class="scv2-btn" data-scv2-prev ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><span>صفحه ${fa(p.page||1)} از ${fa(p.totalPages||1)} • ${fa(p.total||0)} پرونده</span><button type="button" class="scv2-btn" data-scv2-next ${p.hasNext?'':'disabled'}>صفحه بعد</button></footer></section>`;
}
async function loadList(page=state.page,query=state.query){
 state.page=page;state.query=query;state.listAbort?.abort();state.listAbort=new AbortController();const workspace=$('#scv2Workspace');if(workspace){workspace.className='scv2-loading';workspace.textContent='در حال دریافت پرونده‌ها...'}
 try{
  const params=new URLSearchParams({page:String(page)});if(query)params.set('q',query);
  const payload=await api(`/api/admin/caregivers-page?${params}`,{signal:state.listAbort.signal});
  state.items=Array.isArray(payload?.data?.items)?payload.data.items:[];state.pagination=payload?.data?.pagination||{page,totalPages:1,total:state.items.length,hasPrevious:false,hasNext:false};
  const target=$('#scv2Workspace');if(target){target.className='';target.innerHTML=listMarkup()}
  window.dispatchEvent(new CustomEvent('salamat-caregiver-list-ready',{detail:{page:state.page,query:state.query}}));
 }catch(error){if(error.name==='AbortError')return;const target=$('#scv2Workspace');if(target){target.className='scv2-empty';target.textContent=error.message}notify('دریافت پرونده‌ها انجام نشد',error.message)}
}
function openList({force=false}={}){
 if(!can('view')){notify('دسترسی محدود است','مشاهده پرونده مراقبین برای این حساب فعال نیست.');return Promise.resolve(false)}
 const now=performance.now();if(!force&&state.view==='list'&&now-state.lastModuleAt<450)return Promise.resolve(true);state.lastModuleAt=now;
 state.recordAbort?.abort();state.recordPromise=null;listShell();void loadList(state.page,state.query);return Promise.resolve(true);
}
function detailFacts(data){return [
 ['شماره پرونده',data.membershipCode||data.id],['کد ملی',data.nationalId||'—'],['شماره همراه',data.mobile||'—'],['شهر',data.city||data.homeRegion||'—'],
 ['گروه خدمتی',data.primaryType||data.specialty||'—'],['وضعیت پرونده',data.fileStatus||data.cooperationStatus||'—'],['سطح حرفه‌ای',data.professionalLevel||'—'],['وضعیت پروانه',data.licenseStatus||'—'],
 ];}
function profileForm(data){
 if(!can('update'))return '';
 if(!data.crmRecordId||!data.membershipCode)return '<div class="scv2-note">این پرونده برای ویرایش کامل باید ابتدا شناسه CRM و شماره پرونده معتبر داشته باشد.</div>';
 return `<form class="scv2-edit" id="scv2ProfileForm"><input type="hidden" name="caregiverId" value="${esc(data.id)}"><input type="hidden" name="crmRecordId" value="${esc(data.crmRecordId)}"><input type="hidden" name="membershipCode" value="${esc(data.membershipCode)}"><label><span>نام و نام خانوادگی</span><input name="fullName" required value="${esc(data.fullName||'')}"></label><label><span>شماره همراه</span><input name="mobile" dir="ltr" value="${esc(data.mobile||'')}"></label><label><span>کد ملی</span><input name="nationalId" dir="ltr" value="${esc(data.nationalId||'')}"></label><label><span>شهر محل سکونت</span><input name="homeRegion" value="${esc(data.homeRegion||data.city||'')}"></label><label><span>محدوده فعالیت</span><input name="activityRegion" value="${esc(data.activityRegion||data.serviceRegion||data.address||'')}"></label><label><span>تخصص / گروه خدمتی</span><input name="specialty" value="${esc(data.specialty||data.primaryType||'')}"></label><label class="wide"><span>وضعیت پرونده</span><input name="fileStatus" value="${esc(data.fileStatus||data.cooperationStatus||'')}"></label><label class="wide"><span>سوابق کاری</span><textarea name="workHistory" rows="4">${esc(data.workHistory||'')}</textarea></label><button class="scv2-btn primary wide" type="submit">ذخیره تغییرات پرونده</button></form>`;
}
function renderDetail(data){
 state.view='detail';state.activeId=String(data.id||'');markSidebar();
 const facts=detailFacts(data).map(([label,value])=>`<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');
 setPage('پرونده مراقب',data.fullName||data.membershipCode||data.id,`<section class="module-page scv2-root" data-view="staff-caregiver-detail" data-module-key="${MODULE_KEY}" data-record-id="${esc(data.id)}" data-caregiver-id="${esc(data.id)}"><header class="scv2-toolbar"><div><span>${esc(data.membershipCode||data.id)}</span><h2>${esc(data.fullName||'پرونده مراقب')}</h2><p>${esc(data.primaryType||'پرونده حرفه‌ای مراقب')}</p></div><div class="scv2-actions"><button type="button" class="scv2-btn" data-server-caregiver-back>بازگشت به فهرست</button><button type="button" class="scv2-btn" data-scv2-record-refresh="${esc(data.id)}">تازه‌سازی پرونده</button></div></header><section class="scv2-profile"><div class="scv2-identity">${avatar(data,'scv2-avatar large')}<div><strong>${esc(data.fullName||'بدون نام')}</strong><span class="${statusTone(data.fileStatus||data.cooperationStatus)}">${esc(data.fileStatus||data.cooperationStatus||'بدون وضعیت')}</span><small>${esc(data.hasAccount?'حساب کاربری متصل است':'حساب کاربری متصل نیست')}</small></div></div><div class="scv2-facts">${facts}</div></section>${profileForm(data)}</section>`);
 window.dispatchEvent(new CustomEvent('salamat-caregiver-record-opened',{detail:{caregiverId:data.id}}));
}
async function openRecord(id,button=null,{force=false}={}){
 id=String(id||'');if(!id)return false;if(!can('view')){notify('دسترسی محدود است','مشاهده این پرونده برای حساب شما فعال نیست.');return false}
 const now=performance.now();if(!force&&state.recordPromise&&state.lastOpenId===id)return state.recordPromise;if(!force&&state.lastOpenId===id&&now-state.lastOpenAt<550)return true;
 state.lastOpenId=id;state.lastOpenAt=now;button?.setAttribute('aria-busy','true');if(button)button.disabled=true;
 state.recordAbort?.abort();state.recordAbort=new AbortController();const token=++state.token;
 state.recordPromise=(async()=>{
  try{
   const recordPayload=await api(`/api/admin/caregiver-record?id=${encodeURIComponent(id)}`,{signal:state.recordAbort.signal});
   let data=recordPayload.data||{};
   try{const profilePayload=await api(`/api/admin/caregiver-profile?id=${encodeURIComponent(id)}`,{signal:state.recordAbort.signal});data={...data,...(profilePayload.data||{})}}catch(error){if(error.name==='AbortError')throw error}
   if(token!==state.token)return false;renderDetail(data);window.scrollTo({top:0,left:0,behavior:'auto'});return true;
  }catch(error){if(error.name==='AbortError')return false;notify('بازکردن پرونده انجام نشد',error.message);return false}
  finally{button?.removeAttribute('aria-busy');if(button)button.disabled=false;if(token===state.token)state.recordPromise=null}
 })();
 return state.recordPromise;
}
async function saveProfile(form){
 const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
 try{const data=Object.fromEntries(new FormData(form).entries());await api('/api/admin/caregiver-profile',{method:'PATCH',body:JSON.stringify(data)});notify('پرونده ذخیره شد','تغییرات پرونده مراقب در دیتابیس ثبت شد.');await openRecord(data.caregiverId,null,{force:true})}catch(error){notify('ذخیره پرونده انجام نشد',error.detail?`${error.message} — ${error.detail}`:error.message)}finally{if(submit)submit.disabled=false}
}
function historyTarget(value=history.state){
 const chain=Array.isArray(value?.chain)?value.chain:[];const caregiverRoot=chain.some(item=>isCaregiverLabel(item?.text||item?.aria)||item?.dataset?.moduleKey===MODULE_KEY);
 if(!caregiverRoot)return null;const record=[...chain].reverse().find(item=>item?.dataset?.caregiverId||item?.dataset?.recordId);
 return {id:record?.dataset?.caregiverId||record?.dataset?.recordId||''};
}
function restoreHistory(value){
 const target=historyTarget(value);if(!target)return;
 const apply=()=>target.id?void openRecord(target.id,null,{force:true}):void openList({force:true});requestAnimationFrame(apply);setTimeout(apply,160);
}
function onClick(event){
 const open=event.target?.closest?.('[data-server-caregiver-open]');if(open){event.preventDefault();event.stopImmediatePropagation();if(open.dataset.opening==='true')return;open.dataset.opening='true';void openRecord(open.dataset.serverCaregiverOpen,open).finally(()=>delete open.dataset.opening);return}
 const back=event.target?.closest?.('[data-server-caregiver-back]');if(back){event.preventDefault();event.stopImmediatePropagation();const target=historyTarget();if(target?.id&&window.SalamatInternalHistory?.back)window.SalamatInternalHistory.back();else void openList({force:true});return}
 const refresh=event.target?.closest?.('[data-scv2-refresh]');if(refresh){event.preventDefault();void loadList(state.page,state.query);return}
 const recordRefresh=event.target?.closest?.('[data-scv2-record-refresh]');if(recordRefresh){event.preventDefault();void openRecord(recordRefresh.dataset.scv2RecordRefresh,null,{force:true});return}
 const previous=event.target?.closest?.('[data-scv2-prev]');if(previous&&!previous.disabled){event.preventDefault();void loadList(Math.max(1,state.page-1),state.query);return}
 const next=event.target?.closest?.('[data-scv2-next]');if(next&&!next.disabled){event.preventDefault();void loadList(state.page+1,state.query)}
}
function onSubmit(event){
 if(event.target?.id==='scv2Search'){event.preventDefault();const query=String($('#scv2Query')?.value||'').trim();void loadList(1,query);return}
 if(event.target?.id==='scv2ProfileForm'){event.preventDefault();void saveProfile(event.target)}
}
let installAttempts=0;
function install(){
 installAttempts+=1;const current=window.renderModule;if(typeof current!=='function'){if(installAttempts<240)requestAnimationFrame(install);return}
 if(current.__salamatStaffCaregiverControllerV2)return;
 const wrapped=function(model,module){const label=Array.isArray(module)?module[1]:module?.label;if(isCaregiverLabel(label)){void openList({force:true});return}return current.apply(this,arguments)};
 wrapped.__salamatStaffCaregiverControllerV2=true;wrapped.__base=current;window.renderModule=wrapped;
}

document.addEventListener('click',onClick,true);document.addEventListener('submit',onSubmit,true);
window.addEventListener('salamat-history-restored',event=>restoreHistory(event.detail));
window.addEventListener('pageshow',()=>restoreHistory(history.state));
window.addEventListener('salamat-access-changed',()=>{if(state.view==='list'||state.view==='detail'){if(!can('view'))window.SalamatAccessControl?.openModule?.('staff.dashboard')}});

const style=document.createElement('style');style.id='salamatStaffCaregiverStylesV2';style.textContent=`
.scv2-root{direction:rtl;display:grid;gap:14px}.scv2-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:19px;border-radius:22px;color:#fff;background:linear-gradient(145deg,#185b38,#123f2a);box-shadow:0 15px 34px rgba(18,63,42,.18)}.scv2-toolbar span{font-size:9px;color:#cfe8d9}.scv2-toolbar h2{margin:5px 0;font-size:22px}.scv2-toolbar p{margin:0;color:#dcebe3;font-size:10px}.scv2-actions{display:flex;gap:8px;flex-wrap:wrap}.scv2-btn{border:0;border-radius:12px;padding:10px 14px;background:#eaf2ed;color:#185b38;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.scv2-btn.primary{background:#078848;color:#fff}.scv2-btn:disabled{opacity:.45;cursor:not-allowed}.scv2-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:12px;border:1px solid #dce8e2;border-radius:17px;background:#fff}.scv2-search input,.scv2-edit input,.scv2-edit textarea{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;padding:11px 12px;font:inherit;font-size:11px;outline:none}.scv2-search input:focus,.scv2-edit input:focus,.scv2-edit textarea:focus{border-color:#188b55;box-shadow:0 0 0 3px #e4f4eb}.scv2-card,.scv2-profile,.scv2-edit,.scv2-note{border:1px solid #dce8e2;border-radius:22px;background:#fff;box-shadow:0 10px 30px rgba(18,63,42,.05)}.scv2-list{display:grid;gap:8px;padding:12px}.scv2-person{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:11px;align-items:center;width:100%;border:1px solid #e0e9e4;border-radius:17px;padding:11px;background:#fff;text-align:right;cursor:pointer}.scv2-person:hover{border-color:#159058;background:#f5fbf7}.scv2-person:disabled{opacity:.65}.scv2-avatar{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;object-fit:cover;background:#dff2e7;color:#185b38;font-weight:900}.scv2-avatar.large{width:76px;height:76px;border-radius:22px;font-size:18px}.scv2-person-main strong{display:block;font-size:11px}.scv2-person-main small,.scv2-person-main em{display:block;margin-top:4px;color:#718078;font-size:8px;font-style:normal}.scv2-person-side{display:grid;justify-items:end;gap:7px}.scv2-person-side i,.scv2-identity span{padding:5px 8px;border-radius:999px;background:#fff3d9;color:#8e6200;font-size:8px;font-style:normal;font-weight:900}.scv2-person-side i.good,.scv2-identity span.good{background:#e6f5ec;color:#087747}.scv2-person-side i.bad,.scv2-identity span.bad{background:#ffe8eb;color:#ac2638}.scv2-person-side b{color:#188b55;font-size:8px}.scv2-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px;border-top:1px solid #edf2ef;color:#718078;font-size:9px}.scv2-loading,.scv2-empty{padding:44px;text-align:center;border:1px dashed #ccddd4;border-radius:19px;background:#fbfdfc;color:#6c7d74}.scv2-profile{padding:18px;display:grid;gap:18px}.scv2-identity{display:flex;align-items:center;gap:14px}.scv2-identity>div{display:grid;gap:7px}.scv2-identity strong{font-size:18px}.scv2-identity small{color:#718078;font-size:9px}.scv2-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.scv2-facts>div{padding:13px;border-radius:15px;background:#f4f8f6}.scv2-facts small,.scv2-facts strong{display:block}.scv2-facts small{color:#718078;font-size:8px}.scv2-facts strong{margin-top:7px;font-size:10px;word-break:break-word}.scv2-edit{padding:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.scv2-edit label{display:grid;gap:6px}.scv2-edit label span{font-size:9px;font-weight:900;color:#3b5246}.scv2-edit .wide{grid-column:1/-1}.scv2-note{padding:15px;color:#755500;font-size:10px;background:#fffaf0}@media(max-width:760px){.scv2-toolbar{align-items:stretch}.scv2-actions,.scv2-actions .scv2-btn{width:100%}.scv2-search{grid-template-columns:1fr}.scv2-person{grid-template-columns:44px minmax(0,1fr)}.scv2-person-side{grid-column:1/-1;display:flex;justify-content:space-between}.scv2-footer{flex-wrap:wrap}.scv2-facts{grid-template-columns:1fr 1fr}.scv2-edit{grid-template-columns:1fr}.scv2-edit .wide{grid-column:auto}}
`;(document.head||document.documentElement).appendChild(style);
requestAnimationFrame(install);
window.SalamatStaffCaregivers={version:VERSION,openList,openRecord,restore:restoreHistory,get state(){return {...state,listAbort:undefined,recordAbort:undefined,recordPromise:undefined}}};
})();