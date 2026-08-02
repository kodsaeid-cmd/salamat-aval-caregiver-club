(()=>{
'use strict';
if(window.__salamatEvaluationSearchCanonicalV1)return;
window.__salamatEvaluationSearchCanonicalV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const DIGITS={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
const state={
  page:1,
  query:'',
  payload:null,
  pagination:{page:1,pageSize:50,total:0,totalPages:1,hasPrevious:false,hasNext:false},
  timer:null,
  requestId:0,
  loading:false,
  rerendering:false,
  restoreFocus:false,
};
let networkFetch=unwrapFetch(window.fetch);

function normalize(value){
  return String(value||'')
    .replace(/[۰-۹٠-٩]/g,char=>DIGITS[char]||char)
    .replace(/ي/g,'ی').replace(/ك/g,'ک')
    .replace(/[\u200c\u200d]/g,' ')
    .replace(/\s+/g,' ').trim().toLowerCase();
}
function queryValue(value){return normalize(value).slice(0,120)}
function fa(value){return Number(value||0).toLocaleString('fa-IR')}
function evaluationVisible(){
  const title=String($('#pageTitle')?.textContent||'').replace(/\s+/g,' ').trim();
  return title.includes('ارزیابی و پروانه')||title.includes('میزکار ارزیابی')||Boolean($('.sev-root'));
}
function isDirectoryPath(value){
  try{return new URL(String(value),location.href).pathname==='/api/admin/directory'}catch{return false}
}
function isGet(options,input){return String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='GET'}
function unwrapFetch(candidate){
  let current=typeof candidate==='function'?candidate:window.fetch;
  const seen=new Set();
  while(typeof current==='function'&&current.__nativeFetch&&!seen.has(current)){
    seen.add(current);current=current.__nativeFetch;
  }
  return current.bind(window);
}
function unwrapBackendApi(candidate){
  let current=candidate;
  const seen=new Set();
  while(typeof current==='function'&&!seen.has(current)){
    seen.add(current);
    if((current.__salamatEvaluationPaginationV3||current.__salamatEvaluationPaginationV4||current.__salamatEvaluationSearchCanonicalV1)&&current.__originalApi){
      current=current.__originalApi;continue;
    }
    break;
  }
  return current;
}
function pagePath(){
  const url=new URL('/api/admin/caregivers-page',location.origin);
  url.searchParams.set('page',String(state.page));
  const query=queryValue(state.query);
  if(query)url.searchParams.set('q',query);
  return `${url.pathname}${url.search}`;
}
function transform(payload){
  const source=payload?.data||{};
  const items=Array.isArray(source.items)?source.items:[];
  state.pagination={page:1,pageSize:50,total:0,totalPages:1,hasPrevious:false,hasNext:false,...(source.pagination||{})};
  state.page=Number(state.pagination.page||1);
  return {
    status:'ok',
    data:{
      accounts:[],
      caregivers:items,
      counts:{caregiverProfiles:Number(state.pagination.total||0)},
      pagination:state.pagination,
      query:state.query,
    },
  };
}
async function fetchPage(){
  const requestId=++state.requestId;
  state.loading=true;
  updateBusy();
  try{
    networkFetch=unwrapFetch(window.fetch);
    const response=await networkFetch(pagePath(),{
      method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},
    });
    const text=await response.text();
    let payload={};
    try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
    if(!response.ok){
      const error=new Error(payload.message||`خطای ${response.status}`);
      error.detail=payload.detail;throw error;
    }
    if(requestId!==state.requestId)return null;
    state.payload=transform(payload);
    return state.payload;
  }finally{
    if(requestId===state.requestId){state.loading=false;updateBusy()}
  }
}
async function directoryPayload(){
  return state.payload||await fetchPage()||{
    status:'ok',data:{accounts:[],caregivers:[],counts:{caregiverProfiles:0},pagination:state.pagination,query:state.query},
  };
}
function installBackendBridge(){
  const backend=window.SalamatBackend;
  const current=backend?.api;
  if(typeof current!=='function'||current.__salamatEvaluationSearchCanonicalV1)return;
  const base=unwrapBackendApi(current);
  if(typeof base!=='function')return;
  const original=base.bind(backend);
  const wrapped=async function(path,options={}){
    if(evaluationVisible()&&isDirectoryPath(path)&&isGet(options,null))return directoryPayload();
    return original(path,options);
  };
  wrapped.__salamatEvaluationSearchCanonicalV1=true;
  wrapped.__salamatEvaluationPaginationV4=true;
  wrapped.__salamatEvaluationPaginationV3=true;
  wrapped.__originalApi=original;
  backend.api=wrapped;
}
function installFetchBridge(){
  const current=window.fetch;
  if(typeof current!=='function'||current.__salamatEvaluationSearchCanonicalV1)return;
  const nativeFetch=unwrapFetch(current);
  networkFetch=nativeFetch;
  const wrapped=async function(input,init){
    let url;
    try{url=new URL(input instanceof Request?input.url:String(input),location.href)}catch{return nativeFetch(input,init)}
    if(evaluationVisible()&&url.origin===location.origin&&url.pathname==='/api/admin/directory'&&isGet(init,input)){
      const payload=await directoryPayload();
      return new Response(JSON.stringify(payload),{
        status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
      });
    }
    return nativeFetch(input,init);
  };
  wrapped.__salamatEvaluationSearchCanonicalV1=true;
  wrapped.__salamatEvaluationPaginationV4=true;
  wrapped.__salamatEvaluationPaginationV3=true;
  wrapped.__nativeFetch=nativeFetch;
  window.fetch=wrapped;
}
function navButton(){
  return $$('#sidebarNav .nav-item,#sidebarNav button').find(button=>{
    const label=String(button.textContent||'').replace(/\s+/g,' ').trim();
    return label.includes('ارزیابی و پروانه')||label.includes('میزکار ارزیابی');
  })||null;
}
function rerender(){
  if(state.rerendering)return;
  state.rerendering=true;
  const button=navButton();
  if(button)button.click();
  else window.renderModule?.(window.roles?.admin||{},['activity','ارزیابی و پروانه']);
  setTimeout(()=>{
    state.rerendering=false;
    installBridges();
    decorate();
    if(state.restoreFocus){
      state.restoreFocus=false;
      const input=$('#sevCareSearch');
      input?.focus();
      try{input?.setSelectionRange(input.value.length,input.value.length)}catch{}
    }
  },180);
}
function updateBusy(){
  const row=$('.evc-search-row');
  row?.classList.toggle('busy',state.loading);
  const button=$('#evcSearchButton');
  if(button){button.disabled=state.loading;button.textContent=state.loading?'در حال جست‌وجو...':'جست‌وجو'}
  const clear=$('#evcClearButton');
  if(clear)clear.disabled=state.loading;
}
function filterVisibleRows(value){
  const query=normalize(value);
  $$('[data-sev-caregiver]').forEach(row=>{
    const haystack=normalize(row.dataset.search||row.textContent||'');
    row.hidden=Boolean(query&&!haystack.includes(query));
  });
}
function showError(message=''){
  const current=$('#evcSearchError');
  if(!message){current?.remove();return}
  const row=$('.evc-search-row');
  if(!row)return;
  const box=current||document.createElement('div');
  box.id='evcSearchError';box.className='evc-search-error';box.textContent=message;
  if(!current)row.insertAdjacentElement('afterend',box);
}
async function execute({focus=true}={}){
  state.page=1;state.payload=null;state.restoreFocus=focus;showError('');
  try{await fetchPage();rerender()}
  catch(error){
    const message=[error?.message||'جست‌وجو انجام نشد',error?.detail?String(error.detail).slice(0,300):''].filter(Boolean).join(' — ');
    showError(message);
    try{window.toast?.('جست‌وجو انجام نشد',message)}catch{}
  }
}
async function changePage(page){
  state.page=Math.max(1,Number(page)||1);state.payload=null;state.restoreFocus=false;showError('');
  try{await fetchPage();rerender()}catch(error){showError(error?.message||'دریافت صفحه انجام نشد')}
}
function addStyles(){
  if($('#evaluationCanonicalSearchStyles'))return;
  const style=document.createElement('style');style.id='evaluationCanonicalSearchStyles';style.textContent=`
  .evc-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-bottom:12px}.evc-search-row .sev-search{margin:0}.evc-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#08743f;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.evc-btn.primary{background:#078848;color:#fff}.evc-btn:disabled{opacity:.5;cursor:not-allowed}.evc-search-row.busy{opacity:.68;pointer-events:none}.evc-footer{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid #e8f0ec;color:#62736a;font-size:9px}.evc-pages{display:flex;align-items:center;gap:7px}.evc-pages strong{font-size:9px;color:#42564b}.evc-search-error{margin:0 0 10px;padding:9px 11px;border-radius:10px;background:#fff0f1;color:#ad2638;font-size:9px;font-weight:800}@media(max-width:700px){.evc-search-row{grid-template-columns:1fr 1fr}.evc-search-row .sev-search{grid-column:1/-1}.evc-footer{align-items:stretch;flex-direction:column}.evc-pages{justify-content:space-between}}
  `;document.head.appendChild(style);
}
function decorate(){
  if(!evaluationVisible())return;
  const input=$('#sevCareSearch');
  const list=$('.sev-care-list');
  if(!input||!list)return;

  const oldRow=input.closest('.evp-search-row');
  if(oldRow){
    oldRow.classList.remove('evp-search-row');oldRow.classList.add('evc-search-row');
    oldRow.querySelectorAll('#evpSearchButton,#evpClearSearch').forEach(node=>node.remove());
  }
  let row=input.closest('.evc-search-row');
  if(!row){
    row=document.createElement('div');row.className='evc-search-row';
    input.parentNode?.insertBefore(row,input);row.appendChild(input);
  }
  if(!$('#evcSearchButton',row)){
    const search=document.createElement('button');search.type='button';search.id='evcSearchButton';search.className='evc-btn primary';search.textContent='جست‌وجو';row.appendChild(search);
  }
  if(!$('#evcClearButton',row)){
    const clear=document.createElement('button');clear.type='button';clear.id='evcClearButton';clear.className='evc-btn';clear.textContent='پاک‌کردن';row.appendChild(clear);
  }
  if(document.activeElement!==input&&input.value!==state.query)input.value=state.query;
  filterVisibleRows(state.query);
  updateBusy();

  $('#evpFooter')?.remove();
  let footer=$('#evcFooter');
  if(!footer){footer=document.createElement('footer');footer.id='evcFooter';footer.className='evc-footer';list.insertAdjacentElement('afterend',footer)}
  const p=state.pagination;
  footer.innerHTML=`<span>نمایش ${fa($$('[data-sev-caregiver]').length)} مورد از ${fa(p.total)} پرونده</span><div class="evc-pages"><button class="evc-btn" id="evcPrevious" ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><strong>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</strong><button class="evc-btn" id="evcNext" ${p.hasNext?'':'disabled'}>صفحه بعد</button></div>`;
}
function captureInput(event){
  if(event.target?.id!=='sevCareSearch'||!evaluationVisible())return;
  event.stopImmediatePropagation();event.stopPropagation();
  state.query=String(event.target.value||'');filterVisibleRows(state.query);
  clearTimeout(state.timer);state.timer=setTimeout(()=>void execute(),350);
}
function captureKey(event){
  if(event.target?.id!=='sevCareSearch'||!evaluationVisible()||event.key!=='Enter')return;
  event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
  clearTimeout(state.timer);state.query=String(event.target.value||'');void execute();
}
function captureClick(event){
  if(!evaluationVisible())return;
  const search=event.target?.closest?.('#evcSearchButton,#evpSearchButton');
  if(search){
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    clearTimeout(state.timer);state.query=String($('#sevCareSearch')?.value||'');void execute();return;
  }
  const clear=event.target?.closest?.('#evcClearButton,#evpClearSearch');
  if(clear){
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    clearTimeout(state.timer);state.query='';const input=$('#sevCareSearch');if(input)input.value='';filterVisibleRows('');void execute();return;
  }
  const previous=event.target?.closest?.('#evcPrevious,#evpPrevious');
  if(previous&&!previous.disabled){event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();void changePage(state.page-1);return}
  const next=event.target?.closest?.('#evcNext,#evpNext');
  if(next&&!next.disabled){event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();void changePage(state.page+1)}
}
function installBridges(){installBackendBridge();installFetchBridge()}
function inspect(){installBridges();decorate()}
function boot(){
  addStyles();installBridges();
  window.addEventListener('input',captureInput,true);
  window.addEventListener('keydown',captureKey,true);
  window.addEventListener('click',captureClick,true);
  new MutationObserver(()=>setTimeout(inspect,10)).observe(document.body,{childList:true,subtree:true});
  setInterval(installBridges,900);
  window.SalamatEvaluationSearch={
    search:query=>{state.query=String(query||'');return execute({focus:false})},
    refresh:()=>{state.payload=null;return fetchPage().then(rerender)},
    state,
  };
  inspect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
