(()=>{
'use strict';
if(window.__salamatTrainingRecipientPaginationV2)return;
window.__salamatTrainingRecipientPaginationV2=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const state={
  form:null,
  page:1,
  query:'',
  loading:false,
  items:[],
  pagination:{page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false},
  selected:new Map(),
  searchTimer:null,
};

function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
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
function addStyles(){
  if($('#trainingRecipientPaginationStylesV2'))return;
  const style=document.createElement('style');
  style.id='trainingRecipientPaginationStylesV2';
  style.textContent=`
.trp-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:8px;margin-bottom:10px}.trp-toolbar input{width:100%;box-sizing:border-box;border:1px solid #d8e5de;border-radius:11px;background:#fff;padding:10px 11px;font:inherit;outline:none}.trp-toolbar input:focus{border-color:#15945a;box-shadow:0 0 0 3px #e2f5ea}.trp-btn{border:0;border-radius:10px;padding:9px 11px;font:inherit;font-size:9px;font-weight:900;cursor:pointer;background:#e8f6ee;color:#087845}.trp-btn.soft{background:#f1f3f2;color:#65736b}.trp-btn:disabled{opacity:.45;cursor:not-allowed}.trp-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:10px 12px;border-radius:12px;background:#f5f9f7;color:#466052;font-size:10px}.trp-summary strong{font-size:13px;color:#087845}.trp-list{max-height:354px;overflow:auto;display:grid;gap:7px;padding:2px}.trp-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #e1ebe6;border-radius:13px;background:#fff;cursor:pointer;transition:.15s}.trp-card:hover{border-color:#acd8c1}.trp-card.selected{border-color:#0b9856;background:#f0faf5;box-shadow:0 0 0 2px #e4f6ec}.trp-card input{position:absolute;opacity:0;pointer-events:none}.trp-avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#e1f4e9;color:#087845;font-size:12px;font-weight:900;overflow:hidden}.trp-avatar img{width:100%;height:100%;object-fit:cover}.trp-info strong{display:block;font-size:11px;color:#233a2f}.trp-info small{display:block;margin-top:4px;color:#74837b;font-size:9px}.trp-check{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;border:1px solid #cadbd2;color:transparent;background:#fff;font-size:13px}.trp-card.selected .trp-check{background:#078848;border-color:#078848;color:#fff}.trp-empty{padding:30px;text-align:center;border:1px dashed #d8e6df;border-radius:14px;color:#708078}.trp-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #edf3ef}.trp-pages{display:flex;align-items:center;gap:7px}.trp-pages strong{font-size:9px;color:#52665b}@media(max-width:760px){.trp-toolbar{grid-template-columns:1fr 1fr}.trp-toolbar input{grid-column:1/-1}.trp-footer{align-items:stretch;flex-direction:column}}
`;
  document.head.appendChild(style);
}
function avatar(item){
  if(item.avatarUrl)return `<span class="trp-avatar" data-avatar-hydrated="1"><img src="${esc(item.avatarUrl)}?v=${encodeURIComponent(item.avatarId||'1')}" alt="${esc(item.fullName)}"></span>`;
  return `<span class="trp-avatar" data-avatar-hydrated="1">${esc(initials(item.fullName))}</span>`;
}
function normalized(value){return value==='ذکر نشده'?'ثبت نشده':value}
function card(item){
  const id=String(item.id);
  const checked=state.selected.has(id);
  return `<label class="trp-card ${checked?'selected':''}" data-trp-id="${esc(id)}"><input type="checkbox" ${checked?'checked':''}>${avatar(item)}<span class="trp-info"><strong>${esc(item.fullName||'بدون نام')}</strong><small>${esc(item.membershipCode||id)} • ${esc(item.mobile||'شماره ثبت نشده')} ${item.primaryType?`• ${esc(normalized(item.primaryType))}`:''}</small></span><span class="trp-check">✓</span></label>`;
}
function updateSummary(){
  const count=state.selected.size;
  for(const selector of ['#assignmentSelectedCount','#assignmentSelectedCountInline','#trpSelected']){
    const element=$(selector);
    if(element)element.textContent=fa(count);
  }
  const footer=$('#assignmentFooterText');
  const course=$('#trainingAssignmentCourse');
  if(footer)footer.textContent=course?.value?`${fa(count)} مراقب برای دریافت این آموزش انتخاب شده‌اند.`:'پس از انتخاب محتوا و مراقبین، تخصیص ثبت می‌شود.';
}
function bindRows(){
  $$('[data-trp-id]').forEach(row=>row.addEventListener('click',event=>{
    event.preventDefault();
    const id=String(row.dataset.trpId||'');
    const item=state.items.find(candidate=>String(candidate.id)===id);
    if(state.selected.has(id))state.selected.delete(id);else if(item)state.selected.set(id,item);
    row.classList.toggle('selected',state.selected.has(id));
    const input=$('input',row);if(input)input.checked=state.selected.has(id);
    updateSummary();
  }));
  $('#trpPrevious')?.addEventListener('click',()=>{if(state.pagination.hasPrevious){state.page-=1;void loadPage()}});
  $('#trpNext')?.addEventListener('click',()=>{if(state.pagination.hasNext){state.page+=1;void loadPage()}});
}
function renderPage(){
  const list=$('#trpList');
  if(list)list.innerHTML=state.items.length?state.items.map(card).join(''):'<div class="trp-empty">مراقبی با این مشخصات پیدا نشد.</div>';
  const p=state.pagination;
  const footer=$('#trpFooter');
  if(footer)footer.innerHTML=`<span>نمایش ${fa(state.items.length)} مورد از ${fa(p.total)} مراقب</span><div class="trp-pages"><button class="trp-btn soft" id="trpPrevious" ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><strong>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</strong><button class="trp-btn soft" id="trpNext" ${p.hasNext?'':'disabled'}>صفحه بعد</button></div>`;
  bindRows();
  updateSummary();
}
async function loadPage(){
  if(!state.form||state.loading)return;
  state.loading=true;
  const list=$('#trpList');if(list)list.innerHTML='<div class="trp-empty">در حال دریافت ۵۰ مراقب...</div>';
  try{
    const params=new URLSearchParams({page:String(state.page)});
    if(state.query)params.set('q',state.query);
    const payload=await api(`/api/training/caregivers?${params}`);
    state.items=Array.isArray(payload.data)?payload.data:[];
    state.pagination={page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false,...(payload.pagination||{})};
    state.page=Number(state.pagination.page||1);
    renderPage();
  }catch(error){if(list)list.innerHTML=`<div class="trp-empty">${esc(error.message||error)}</div>`}
  finally{state.loading=false}
}
function runSearch(){state.query=String($('#trpSearch')?.value||'').trim();state.page=1;void loadPage()}
function installForm(form){
  state.form=form;state.page=1;state.query='';state.items=[];state.selected.clear();
  const people=$('.assignment-people',form);if(!people)return;
  people.innerHTML=`<div class="assignment-block-title"><strong>انتخاب مراقبین</strong><small>جست‌وجو و صفحه‌بندی در کل دیتابیس</small></div><div class="trp-toolbar" id="trpSearchForm"><input id="trpSearch" placeholder="جست‌وجوی نام، شماره پرونده، موبایل یا گروه خدمتی"><button class="trp-btn" type="button" id="trpSearchButton">جست‌وجو</button><button class="trp-btn" type="button" id="trpSelectPage">انتخاب این صفحه</button><button class="trp-btn soft" type="button" id="trpClear">پاک‌کردن انتخاب‌ها</button></div><div class="trp-summary"><span>انتخاب‌ها هنگام رفتن به صفحات بعدی حفظ می‌شوند.</span><strong><span id="trpSelected">۰</span> نفر</strong></div><div class="trp-list" id="trpList"></div><footer class="trp-footer" id="trpFooter"></footer>`;
  $('#trpSearchButton')?.addEventListener('click',runSearch);
  $('#trpSearch')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runSearch()}});
  $('#trpSearch')?.addEventListener('input',()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(runSearch,450)});
  $('#trpSelectPage')?.addEventListener('click',()=>{state.items.forEach(item=>state.selected.set(String(item.id),item));renderPage()});
  $('#trpClear')?.addEventListener('click',()=>{state.selected.clear();renderPage()});
  $('#trainingAssignmentCourse')?.addEventListener('change',()=>setTimeout(updateSummary,0));
  void loadPage();
}
function patch(){const form=$('#trainingClassicAssignForm');if(!form||form===state.form)return;installForm(form)}
async function submit(event){
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='trainingClassicAssignForm')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const courseId=String($('#trainingAssignmentCourse',form)?.value||'');
  if(!courseId){notify('تخصیص انجام نشد','یک محتوای آموزشی انتخاب کنید.');return}
  if(!state.selected.size){notify('تخصیص انجام نشد','حداقل یک مراقب انتخاب کنید.');return}
  const button=form.querySelector('button[type="submit"]');
  if(button){button.disabled=true;button.textContent='در حال تخصیص...'}
  const status=$('#trainingAssignmentStatus',form);
  if(status){status.hidden=false;status.dataset.tone='info';status.textContent=`در حال ثبت آموزش برای ${fa(state.selected.size)} مراقب...`}
  try{
    const selectedIds=[...state.selected.keys()];
    const dueAt=String(form.elements.dueAt?.value||'');
    const assignmentNote=String(form.elements.assignmentNote?.value||'');
    for(let index=0;index<selectedIds.length;index+=100){
      const chunk=selectedIds.slice(index,index+100);
      if(status)status.textContent=`در حال ثبت ${fa(Math.min(index+chunk.length,selectedIds.length))} از ${fa(selectedIds.length)} مراقب...`;
      await api('/api/training/assignments',{method:'POST',body:JSON.stringify({courseId,caregiverIds:chunk,dueAt,assignmentNote})});
    }
    if(status){status.dataset.tone='success';status.textContent='تخصیص با موفقیت ثبت شد.'}
    notify('آموزش تخصیص داده شد',`آموزش برای ${fa(selectedIds.length)} مراقب ثبت شد.`);
    state.selected.clear();
    setTimeout(()=>{const nav=$$('#sidebarNav .nav-item,#sidebarNav button').find(item=>String(item.textContent||'').includes('بانک آموزش'));nav?.click()},350);
  }catch(error){
    if(status){status.dataset.tone='error';status.textContent=error.message||String(error)}
    if(button){button.disabled=false;button.textContent='ثبت تخصیص آموزش'}
    notify('تخصیص انجام نشد',error.message||String(error));
  }
}
function boot(){
  addStyles();
  document.addEventListener('submit',submit,true);
  const content=$('#content')||document.body;
  new MutationObserver(()=>setTimeout(patch,40)).observe(content,{childList:true,subtree:true});
  patch();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
