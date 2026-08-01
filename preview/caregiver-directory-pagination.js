(()=>{
'use strict';
if(window.__salamatCaregiverDirectoryPaginationV1)return;
window.__salamatCaregiverDirectoryPaginationV1=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
let page=1;
let query='';
let loading=false;
let bypass=false;
let routerBase=null;
let searchTimer=null;
let lastItems=[];

function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||null}
function isAdmin(){return String(currentUser()?.role||'').toUpperCase()==='ADMIN'}
function labelOf(value){return String(Array.isArray(value)?value[1]:value||'').trim()}
function isCaregiverLabel(label){return ['پرونده مراقبین','پرونده حرفه‌ای مراقبین','فعال‌سازی پرونده حرفه‌ای مراقبین','فعال سازی پرونده حرفه ای مراقبین'].includes(label)}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2)||'م'}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)alert(`${title}\n${text}`)}
async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.detail=payload.detail;throw error}
  return payload;
}
function setPage(title,subtitle,html){
  const titleEl=$('#pageTitle'),subtitleEl=$('#pageSubtitle'),content=$('#content');
  if(titleEl)titleEl.textContent=title;
  if(subtitleEl)subtitleEl.textContent=subtitle;
  if(content)content.innerHTML=`<section class="module-page cdp-root">${html}</section>`;
}
function avatar(item){return item.avatarUrl?`<span class="cdp-avatar"><img src="${esc(item.avatarUrl)}?v=${encodeURIComponent(item.avatarId||item.createdAt||'1')}" alt="${esc(item.fullName)}"></span>`:`<span class="cdp-avatar">${esc(initials(item.fullName))}</span>`}
function addStyles(){
  if($('#caregiverDirectoryPaginationStyles'))return;
  const style=document.createElement('style');style.id='caregiverDirectoryPaginationStyles';style.textContent=`
  .cdp-root{direction:rtl}.cdp-loading,.cdp-empty{padding:44px;text-align:center;border:1px dashed #cfe0d7;border-radius:20px;color:#66776e;background:#fbfdfc}.cdp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.cdp-toolbar h3{margin:0;font-size:17px}.cdp-toolbar p{margin:6px 0 0;color:#718078;font-size:11px}.cdp-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.cdp-search{min-width:330px;border:1px solid #d9e5df;border-radius:14px;background:#fff;padding:12px 14px;font:inherit;outline:none}.cdp-search:focus{border-color:#14945a;box-shadow:0 0 0 3px #e0f5e9}.cdp-btn{border:0;border-radius:12px;padding:11px 15px;font:inherit;font-size:11px;font-weight:900;cursor:pointer;background:#edf8f2;color:#08743f}.cdp-btn.primary{background:#078848;color:#fff}.cdp-btn:disabled{opacity:.45;cursor:not-allowed}.cdp-panel{border:1px solid #dce8e2;border-radius:22px;background:#fff;overflow:hidden;box-shadow:0 12px 35px rgba(23,74,49,.045)}.cdp-list{display:grid;gap:9px;padding:17px}.cdp-row{display:grid;grid-template-columns:54px minmax(0,1.2fr) repeat(4,minmax(110px,.45fr)) auto;gap:12px;align-items:center;width:100%;border:1px solid #dfe9e4;border-radius:16px;background:#fff;padding:12px;text-align:right;cursor:pointer}.cdp-row:hover{border-color:#11965a;background:#f5fbf8}.cdp-row strong{display:block;font-size:12px;color:#21372d}.cdp-row small{display:block;margin-top:4px;color:#7b8982;font-size:10px}.cdp-cell{font-size:10px;color:#46594f}.cdp-cell b{display:block;color:#21372d;font-size:11px}.cdp-avatar{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;overflow:hidden;background:#dff3e8;color:#087a45;font-weight:900}.cdp-avatar img{width:100%;height:100%;object-fit:cover}.cdp-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:9px;font-weight:900;white-space:nowrap}.cdp-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;border-top:1px solid #e7efeb;background:#fbfdfc}.cdp-pages{display:flex;align-items:center;gap:8px}.cdp-pages strong{font-size:11px;color:#42564b}.cdp-backdrop{position:fixed;inset:0;z-index:12000;background:rgba(12,35,25,.48);display:grid;place-items:center;padding:20px;direction:rtl}.cdp-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 26px 70px rgba(0,0,0,.24)}.cdp-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:21px;border-bottom:1px solid #e7efeb}.cdp-modal-head h3{margin:0;font-size:18px}.cdp-modal-head p{margin:6px 0 0;color:#728179;font-size:10px}.cdp-close{border:0;width:34px;height:34px;border-radius:10px;background:#eef2f0;cursor:pointer}.cdp-modal-body{padding:21px}.cdp-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cdp-detail{padding:12px;border:1px solid #e0e9e4;border-radius:13px;background:#fbfdfc}.cdp-detail small{display:block;color:#7b8982;font-size:9px}.cdp-detail strong{display:block;margin-top:5px;color:#21372d;font-size:12px}.cdp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cdp-form label{display:grid;gap:6px;font-size:10px;font-weight:900;color:#34483e}.cdp-form input,.cdp-form textarea{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;padding:11px;font:inherit}.cdp-wide{grid-column:1/-1}.cdp-modal-actions{display:flex;justify-content:flex-end;gap:9px;padding:17px 21px;border-top:1px solid #e7efeb}@media(max-width:1100px){.cdp-row{grid-template-columns:54px minmax(0,1fr) repeat(2,minmax(100px,.45fr))}.cdp-row .optional{display:none}}@media(max-width:720px){.cdp-toolbar{align-items:stretch;flex-direction:column}.cdp-actions{width:100%}.cdp-search{min-width:0;width:100%}.cdp-row{grid-template-columns:48px minmax(0,1fr) auto}.cdp-cell{display:none}.cdp-footer{align-items:stretch;flex-direction:column}.cdp-details,.cdp-form{grid-template-columns:1fr}.cdp-wide{grid-column:auto}}
  `;document.head.appendChild(style)
}
function rowsMarkup(items){
  if(!items.length)return '<div class="cdp-empty">پرونده‌ای با این مشخصات پیدا نشد.</div>';
  return items.map(item=>`<button class="cdp-row" type="button" data-cdp-id="${esc(item.id)}">${avatar(item)}<span><strong>${esc(item.fullName)}</strong><small>شماره پرونده ${esc(item.membershipCode||item.id)} • ${esc(item.mobile||'شماره ثبت نشده')}</small></span><span class="cdp-cell"><small>گروه خدمتی</small><b>${esc(item.primaryType||'—')}</b></span><span class="cdp-cell"><small>وضعیت پرونده</small><b>${esc(item.fileStatus||'—')}</b></span><span class="cdp-cell optional"><small>سطح حرفه‌ای</small><b>${esc(item.professionalLevel||'در انتظار ارزیابی')}</b></span><span class="cdp-cell optional"><small>حساب ورود</small><b>${item.hasAccount?'متصل':'بدون حساب'}</b></span><span class="cdp-badge">مشاهده پرونده</span></button>`).join('')
}
async function render(){
  if(!isAdmin()||loading)return;
  loading=true;setPage('پرونده مراقبین','نمایش صفحه‌بندی‌شده پرونده‌های حرفه‌ای','<div class="cdp-loading">در حال دریافت ۵۰ پرونده...</div>');
  try{
    const params=new URLSearchParams({page:String(page)});if(query)params.set('q',query);
    const data=(await api(`/api/admin/caregivers-page?${params}`)).data||{};
    lastItems=data.items||[];const p=data.pagination||{page:1,total:0,totalPages:1};page=Number(p.page||1);
    setPage('پرونده مراقبین','نمایش صفحه‌بندی‌شده پرونده‌های حرفه‌ای',`<div class="cdp-toolbar"><div><h3>پرونده‌های حرفه‌ای مراقبین</h3><p>${fa(p.total)} پرونده؛ در هر صفحه فقط ۵۰ مورد دریافت می‌شود.</p></div><div class="cdp-actions"><input class="cdp-search" id="cdpSearch" value="${esc(query)}" placeholder="جست‌وجوی نام، موبایل، کد ملی یا شماره پرونده"><button class="cdp-btn primary" id="cdpCreate">ایجاد پرونده جدید</button></div></div><article class="cdp-panel"><div class="cdp-list">${rowsMarkup(lastItems)}</div><footer class="cdp-footer"><span>نمایش ${fa(lastItems.length)} مورد از ${fa(p.total)} پرونده</span><div class="cdp-pages"><button class="cdp-btn" id="cdpPrevious" ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><strong>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</strong><button class="cdp-btn" id="cdpNext" ${p.hasNext?'':'disabled'}>صفحه بعد</button></div></footer></article>`);
    bind(p);
  }catch(error){setPage('پرونده مراقبین','خطا در دریافت اطلاعات',`<div class="cdp-empty">${esc(error.message||error)}</div>`)}finally{loading=false}
}
function bind(p){
  $('#cdpSearch')?.addEventListener('input',event=>{clearTimeout(searchTimer);const value=event.currentTarget.value;searchTimer=setTimeout(()=>{query=String(value||'').trim();page=1;void render()},350)});
  $('#cdpPrevious')?.addEventListener('click',()=>{if(p.hasPrevious){page-=1;void render()}});
  $('#cdpNext')?.addEventListener('click',()=>{if(p.hasNext){page+=1;void render()}});
  $('#cdpCreate')?.addEventListener('click',openCreate);
  $$('[data-cdp-id]').forEach(row=>row.addEventListener('click',()=>{const item=lastItems.find(x=>x.id===row.dataset.cdpId);if(item)openDetails(item)}));
}
function closeModal(){$('.cdp-backdrop')?.remove()}
function openDetails(item){
  closeModal();const wrap=document.createElement('div');wrap.className='cdp-backdrop';wrap.innerHTML=`<section class="cdp-modal"><header class="cdp-modal-head"><div><h3>${esc(item.fullName)}</h3><p>شماره پرونده ${esc(item.membershipCode||item.id)}</p></div><button class="cdp-close">×</button></header><div class="cdp-modal-body"><div class="cdp-details"><div class="cdp-detail"><small>شماره همراه</small><strong>${esc(item.mobile||'ثبت نشده')}</strong></div><div class="cdp-detail"><small>کد ملی</small><strong>${esc(item.nationalId||'ثبت نشده')}</strong></div><div class="cdp-detail"><small>گروه خدمتی</small><strong>${esc(item.primaryType||'ثبت نشده')}</strong></div><div class="cdp-detail"><small>وضعیت پرونده</small><strong>${esc(item.fileStatus||'ثبت نشده')}</strong></div><div class="cdp-detail"><small>سطح حرفه‌ای</small><strong>${esc(item.professionalLevel||'در انتظار ارزیابی')}</strong></div><div class="cdp-detail"><small>حساب ورود</small><strong>${item.hasAccount?'متصل':'بدون حساب'}</strong></div></div></div><footer class="cdp-modal-actions"><button class="cdp-btn" data-close>بستن</button></footer></section>`;document.body.appendChild(wrap);$('.cdp-close',wrap).onclick=closeModal;$('[data-close]',wrap).onclick=closeModal;wrap.addEventListener('click',event=>{if(event.target===wrap)closeModal()})
}
function openCreate(){
  closeModal();const wrap=document.createElement('div');wrap.className='cdp-backdrop';wrap.innerHTML=`<section class="cdp-modal"><header class="cdp-modal-head"><div><h3>ایجاد پرونده مراقب</h3><p>پس از ثبت، پرونده در صفحه اول قابل جست‌وجو خواهد بود.</p></div><button class="cdp-close">×</button></header><div class="cdp-modal-body"><form class="cdp-form" id="cdpCreateForm"><label>نام و نام خانوادگی<input name="fullName" required></label><label>شماره همراه<input name="mobile" inputmode="numeric" required></label><label>کد ملی<input name="nationalId" inputmode="numeric"></label><label>گروه خدمتی<input name="primaryType" value="مراقبت سالمند"></label><label>شهر<input name="city"></label><label>وضعیت پرونده<input name="fileStatus" value="CP-03 نیازمند تکمیل مدارک"></label><label class="cdp-wide">نشانی<textarea name="address"></textarea></label><label class="cdp-wide">سوابق و توضیحات<textarea name="workHistory"></textarea></label></form></div><footer class="cdp-modal-actions"><button class="cdp-btn" data-close>انصراف</button><button class="cdp-btn primary" id="cdpSubmitCreate">ثبت پرونده</button></footer></section>`;document.body.appendChild(wrap);$('.cdp-close',wrap).onclick=closeModal;$('[data-close]',wrap).onclick=closeModal;$('#cdpSubmitCreate',wrap).onclick=async()=>{const form=$('#cdpCreateForm',wrap);if(!form.reportValidity())return;const body=Object.fromEntries(new FormData(form).entries());const button=$('#cdpSubmitCreate',wrap);button.disabled=true;button.textContent='در حال ثبت...';try{await api('/api/caregivers',{method:'POST',body:JSON.stringify({...body,serviceGroup:body.primaryType,bio:body.workHistory})});closeModal();page=1;query='';await render();notify('پرونده ثبت شد','پرونده جدید با موفقیت ایجاد شد.')}catch(error){notify('ثبت پرونده انجام نشد',error.message||String(error));button.disabled=false;button.textContent='ثبت پرونده'}}
}
function capture(event){
  if(!isAdmin())return;const button=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');if(!button)return;const label=String(button.textContent||'').trim();if(!isCaregiverLabel(label))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();$$('#sidebarNav .nav-item,#sidebarNav button').forEach(item=>item.classList.toggle('active',item===button));page=1;query='';void render();
}
function installRouter(){
  const current=window.renderModule;if(typeof current!=='function'||current.__salamatCaregiverPaginationV1)return;routerBase=current;
  const wrapped=function(...args){const label=labelOf(args[1]);if(!bypass&&isAdmin()&&isCaregiverLabel(label)){page=1;query='';void render();return}return current.apply(this,args)};
  wrapped.__salamatCaregiverPaginationV1=true;window.renderModule=wrapped;
}
function boot(){addStyles();window.addEventListener('click',capture,true);installRouter();setInterval(installRouter,1200);window.addEventListener('salamat-server-directory-refresh',()=>{const title=String($('#pageTitle')?.textContent||'');if(title.includes('پرونده مراقبین'))void render()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
