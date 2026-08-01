(()=>{
'use strict';
if(window.__salamatAccountDirectoryPaginationV2)return;
window.__salamatAccountDirectoryPaginationV2=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const roleFa={ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
const statusFa={ACTIVE:'فعال',APPROVED:'فعال',PENDING:'در انتظار تأیید',INACTIVE:'غیرفعال',SUSPENDED:'تعلیق‌شده'};
const state={page:1,query:'',loading:false,searchTimer:null,data:null};

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||null}
function isAdmin(){return String(currentUser()?.role||'').toUpperCase()==='ADMIN'}
function moduleLabel(value){return String(Array.isArray(value)?value[1]:value||'').trim()}
function isTarget(label){return label.includes('کاربران و دسترسی')||label==='مدیریت کاربران'}
function initials(name){return String(name||'ک').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'ک'}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();
  let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.detail=payload.detail;throw error}
  return payload;
}
function setPage(title,subtitle,html){
  const titleEl=$('#pageTitle'),subtitleEl=$('#pageSubtitle'),content=$('#content');
  if(titleEl)titleEl.textContent=title;
  if(subtitleEl)subtitleEl.textContent=subtitle;
  if(content)content.innerHTML=`<section class="module-page adp-root">${html}</section>`;
}
function addStyles(){
  if($('#accountDirectoryPaginationStylesV2'))return;
  const style=document.createElement('style');
  style.id='accountDirectoryPaginationStylesV2';
  style.textContent=`
.adp-root{direction:rtl}.adp-loading,.adp-empty{padding:42px;text-align:center;border:1px dashed #cfe0d7;border-radius:20px;color:#66776e;background:#fbfdfc}.adp-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.adp-summary div{padding:13px 15px;border:1px solid #dce8e2;border-radius:16px;background:#fff}.adp-summary small{display:block;color:#74837b;font-size:9px}.adp-summary strong{display:block;margin-top:6px;color:#087847;font-size:18px}.adp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.adp-toolbar h3{margin:0;font-size:17px}.adp-toolbar p{margin:6px 0 0;color:#718078;font-size:10px}.adp-searchbox{display:flex;gap:8px;align-items:center}.adp-search{min-width:350px;border:1px solid #d9e5df;border-radius:14px;background:#fff;padding:12px 14px;font:inherit;outline:none}.adp-search:focus{border-color:#14945a;box-shadow:0 0 0 3px #e0f5e9}.adp-btn{border:0;border-radius:11px;padding:10px 14px;background:#edf8f2;color:#08743f;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.adp-btn.primary{background:#078848;color:#fff}.adp-btn.danger{background:#ffeaed;color:#b52238}.adp-btn:disabled{opacity:.45;cursor:not-allowed}.adp-panel{border:1px solid #dce8e2;border-radius:22px;background:#fff;overflow:hidden}.adp-list{display:grid;gap:8px;padding:16px}.adp-row{display:grid;grid-template-columns:52px minmax(0,1.2fr) minmax(110px,.5fr) minmax(110px,.5fr) minmax(110px,.5fr) auto;gap:12px;align-items:center;width:100%;padding:11px;border:1px solid #e0e9e4;border-radius:15px;background:#fff;text-align:right;cursor:pointer}.adp-row:hover{border-color:#11965a;background:#f5fbf8}.adp-row strong{display:block;font-size:12px;color:#21372d}.adp-row small{display:block;margin-top:4px;color:#7b8982;font-size:9px}.adp-cell b{display:block;font-size:11px;color:#21372d}.adp-avatar{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:#dff3e8;color:#087a45;font-weight:900}.adp-avatar img{width:100%;height:100%;object-fit:cover}.adp-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:9px;font-weight:900}.adp-badge.warn{background:#fff1d8;color:#976000}.adp-badge.danger{background:#ffe8eb;color:#b31f36}.adp-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-top:1px solid #e7efeb;background:#fbfdfc}.adp-pages{display:flex;align-items:center;gap:8px}.adp-pages strong{font-size:10px}.adp-backdrop{position:fixed;inset:0;z-index:13000;background:rgba(12,35,25,.48);display:grid;place-items:center;padding:20px;direction:rtl}.adp-modal{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 26px 70px rgba(0,0,0,.24)}.adp-modal-head{display:flex;justify-content:space-between;gap:14px;padding:20px;border-bottom:1px solid #e7efeb}.adp-modal-head h3{margin:0}.adp-modal-head p{margin:6px 0 0;color:#728179;font-size:10px}.adp-close{border:0;width:34px;height:34px;border-radius:10px;background:#eef2f0;cursor:pointer}.adp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:20px}.adp-form label{display:grid;gap:6px;font-size:10px;font-weight:900;color:#34483e}.adp-form input,.adp-form select{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;padding:11px;font:inherit}.adp-wide{grid-column:1/-1}.adp-modal-actions{display:flex;gap:9px;justify-content:flex-end;padding:16px 20px;border-top:1px solid #e7efeb}@media(max-width:900px){.adp-summary{grid-template-columns:repeat(2,1fr)}.adp-row{grid-template-columns:48px minmax(0,1fr) minmax(100px,.5fr) auto}.adp-row .optional{display:none}}@media(max-width:650px){.adp-toolbar{align-items:stretch;flex-direction:column}.adp-searchbox{width:100%}.adp-search{min-width:0;width:100%}.adp-row{grid-template-columns:46px minmax(0,1fr) auto}.adp-cell{display:none}.adp-footer{align-items:stretch;flex-direction:column}.adp-form{grid-template-columns:1fr}.adp-wide{grid-column:auto}}
`;
  document.head.appendChild(style);
}
function avatar(item){
  if(item.avatarUrl)return `<span class="adp-avatar"><img src="${esc(item.avatarUrl)}?v=${encodeURIComponent(item.avatarId||item.createdAt||'1')}" alt="${esc(item.fullName)}"></span>`;
  return `<span class="adp-avatar">${esc(initials(item.fullName))}</span>`;
}
function tone(status){const key=String(status||'').toUpperCase();return key==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(key)?'danger':''}
function rows(items){
  if(!items.length)return '<div class="adp-empty">حسابی با این مشخصات پیدا نشد.</div>';
  return items.map(item=>`<button class="adp-row" type="button" data-account-id="${esc(item.id)}">${avatar(item)}<span><strong>${esc(item.fullName||item.caregiverFullName||'بدون نام')}</strong><small>${esc(item.username||'بدون نام کاربری')} • ${esc(item.mobile||item.caregiverMobile||'شماره ثبت نشده')}</small></span><span class="adp-cell"><small>نقش</small><b>${esc(roleFa[String(item.role||'').toUpperCase()]||item.role||'—')}</b></span><span class="adp-cell optional"><small>شماره پرونده</small><b>${esc(item.membershipCode||'—')}</b></span><span class="adp-cell optional"><small>وضعیت</small><b>${esc(statusFa[String(item.status||'').toUpperCase()]||item.status||'—')}</b></span><span class="adp-badge ${tone(item.status)}">مشاهده و ویرایش</span></button>`).join('');
}
async function render(){
  if(!isAdmin()||state.loading)return;
  state.loading=true;
  setPage('کاربران و دسترسی‌ها','مدیریت صفحه‌بندی‌شده حساب‌های سامانه','<div class="adp-loading">در حال دریافت ۵۰ حساب...</div>');
  try{
    const params=new URLSearchParams({page:String(state.page)});if(state.query)params.set('q',state.query);
    const data=(await api(`/api/admin/directory?${params}`)).data||{};
    state.data=data;
    const p={page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false,...(data.pagination||{})};
    state.page=Number(p.page||1);
    const counts=data.counts||{};
    setPage('کاربران و دسترسی‌ها','مدیریت صفحه‌بندی‌شده حساب‌های سامانه',`<section class="adp-summary"><div><small>کل حساب‌ها</small><strong>${fa(counts.accounts)}</strong></div><div><small>حساب مراقبین</small><strong>${fa(counts.caregiverAccounts)}</strong></div><div><small>حساب فعال</small><strong>${fa(counts.activeAccounts)}</strong></div><div><small>پرونده بدون حساب</small><strong>${fa(counts.profilesWithoutAccounts)}</strong></div></section><div class="adp-toolbar"><div><h3>فهرست حساب‌ها</h3><p>هر صفحه ۵۰ حساب؛ جست‌وجو در کل دیتابیس انجام می‌شود.</p></div><div class="adp-searchbox"><input class="adp-search" id="adpSearch" value="${esc(state.query)}" placeholder="نام، نام کاربری، موبایل، کد ملی یا شماره پرونده"><button class="adp-btn primary" type="button" id="adpSearchButton">جست‌وجو</button></div></div><article class="adp-panel"><div class="adp-list">${rows(data.accounts||[])}</div><footer class="adp-footer"><span>نمایش ${fa((data.accounts||[]).length)} مورد از ${fa(p.total)} نتیجه</span><div class="adp-pages"><button class="adp-btn" id="adpPrevious" ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><strong>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</strong><button class="adp-btn" id="adpNext" ${p.hasNext?'':'disabled'}>صفحه بعد</button></div></footer></article>`);
    bind(p);
  }catch(error){setPage('کاربران و دسترسی‌ها','خطا در دریافت اطلاعات',`<div class="adp-empty">${esc(error.message||error)}</div>`)}
  finally{state.loading=false}
}
function runSearch(){state.query=String($('#adpSearch')?.value||'').trim();state.page=1;void render()}
function bind(p){
  $('#adpSearchButton')?.addEventListener('click',runSearch);
  $('#adpSearch')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runSearch()}});
  $('#adpSearch')?.addEventListener('input',()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(runSearch,450)});
  $('#adpPrevious')?.addEventListener('click',()=>{if(p.hasPrevious){state.page-=1;void render()}});
  $('#adpNext')?.addEventListener('click',()=>{if(p.hasNext){state.page+=1;void render()}});
  $$('[data-account-id]').forEach(row=>row.addEventListener('click',()=>{
    const item=(state.data?.accounts||[]).find(candidate=>String(candidate.id)===String(row.dataset.accountId));
    if(item)openDetails(item);
  }));
}
function closeModal(){$('.adp-backdrop')?.remove()}
function openDetails(item){
  closeModal();
  const wrap=document.createElement('div');wrap.className='adp-backdrop';
  wrap.innerHTML=`<section class="adp-modal"><header class="adp-modal-head"><div><h3>${esc(item.fullName||'حساب کاربری')}</h3><p>${esc(item.username||'بدون نام کاربری')} ${item.membershipCode?`• پرونده ${esc(item.membershipCode)}`:''}</p></div><button class="adp-close" type="button">×</button></header><form class="adp-form" id="adpEditForm"><input type="hidden" name="userId" value="${esc(item.id)}"><input type="hidden" name="caregiverId" value="${esc(item.caregiverId||'')}"><label>نام و نام خانوادگی<input name="fullName" value="${esc(item.fullName||'')}" required></label><label>نام کاربری<input name="username" value="${esc(item.username||'')}" required></label><label>شماره همراه<input name="mobile" value="${esc(item.mobile||item.caregiverMobile||'')}"></label><label>نقش<select name="role">${Object.entries(roleFa).map(([value,label])=>`<option value="${value}" ${String(item.role).toUpperCase()===value?'selected':''}>${label}</option>`).join('')}</select></label><label>وضعیت<select name="status">${Object.entries(statusFa).filter(([key])=>key!=='APPROVED').map(([value,label])=>`<option value="${value}" ${String(item.status).toUpperCase()===value?'selected':''}>${label}</option>`).join('')}</select></label><label>رمز عبور جدید<input name="password" type="password" minlength="8" placeholder="برای حفظ رمز خالی بگذارید"></label>${item.membershipCode?`<label class="adp-wide">شماره پرونده<input value="${esc(item.membershipCode)}" disabled></label>`:''}</form><footer class="adp-modal-actions"><button class="adp-btn" data-close type="button">بستن</button>${String(item.role).toUpperCase()!=='ADMIN'?'<button class="adp-btn danger" id="adpDelete" type="button">حذف حساب</button>':''}<button class="adp-btn primary" id="adpSave" type="button">ذخیره تغییرات</button></footer></section>`;
  document.body.appendChild(wrap);
  $('.adp-close',wrap).onclick=closeModal;$('[data-close]',wrap).onclick=closeModal;
  wrap.addEventListener('click',event=>{if(event.target===wrap)closeModal()});
  $('#adpSave',wrap).onclick=async()=>{
    const form=$('#adpEditForm',wrap);if(!form.reportValidity())return;
    const body=Object.fromEntries(new FormData(form).entries());if(!body.password)delete body.password;
    const button=$('#adpSave',wrap);button.disabled=true;button.textContent='در حال ذخیره...';
    try{await api('/api/admin/directory/profile',{method:'PATCH',body:JSON.stringify(body)});closeModal();await render();notify('تغییرات ذخیره شد','حساب کاربری به‌روزرسانی شد.')}
    catch(error){notify('ذخیره انجام نشد',error.message||String(error));button.disabled=false;button.textContent='ذخیره تغییرات'}
  };
  $('#adpDelete',wrap)?.addEventListener('click',async()=>{
    if(!confirm('این حساب حذف شود؟ پرونده مراقب برای حفظ سوابق باقی می‌ماند.'))return;
    try{await api(`/api/users/${encodeURIComponent(item.id)}`,{method:'DELETE'});closeModal();await render();notify('حساب حذف شد','حساب ورود حذف شد.')}
    catch(error){notify('حذف انجام نشد',error.message||String(error))}
  });
}
function capture(event){
  if(!isAdmin())return;
  const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(!button||!isTarget(String(button.textContent||'').trim()))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  $$('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',item===button));
  state.page=1;state.query='';void render();
}
function install(){
  const current=window.renderModule;
  if(typeof current!=='function'||current.__salamatAccountDirectoryPaginationV2)return;
  const wrapped=function(...args){if(isAdmin()&&isTarget(moduleLabel(args[1]))){state.page=1;state.query='';void render();return}return current.apply(this,args)};
  wrapped.__salamatAccountDirectoryPaginationV2=true;
  window.renderModule=wrapped;try{renderModule=wrapped}catch{}
}
function boot(){addStyles();window.addEventListener('click',capture,true);install();setInterval(install,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
