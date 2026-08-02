(()=>{
'use strict';
if(window.__salamatEvaluationDirectoryPaginationFixV4)return;
window.__salamatEvaluationDirectoryPaginationFixV4=true;
window.__salamatEvaluationDirectoryPaginationFixV3=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const DIGITS={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
const normalize=value=>String(value||'')
  .replace(/[۰-۹٠-٩]/g,char=>DIGITS[char]||char)
  .replace(/ي/g,'ی').replace(/ك/g,'ک')
  .replace(/[\u200c\u200d]/g,' ')
  .replace(/\s+/g,' ').trim().toLowerCase();
const canonicalQuery=value=>normalize(value).slice(0,120);
const state={
  page:1,
  query:'',
  pagination:{page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false},
  timer:null,
  refreshing:false,
  redirecting:false,
  loading:false,
  requestId:0,
  directoryPayload:null,
  restoreFocus:false,
};
let networkFetch=window.fetch.bind(window);

function evaluationVisible(){
  const title=String($('#pageTitle')?.textContent||'').trim();
  return title.includes('ارزیابی و پروانه')||title.includes('میزکار ارزیابی');
}
function professionalContext(){
  const title=String($('#pageTitle')?.textContent||'').trim();
  const content=String($('#content')?.textContent||'');
  return title.includes('پرونده حرفه‌ای')||title.includes('پرونده مراقبین')||content.includes('کارنامه حرفه‌ای مراقب');
}
function legacyProfessionalListVisible(){
  if(window.__salamatOpeningProfessionalDetail||$('.cdp-root'))return false;
  const content=String($('#content')?.textContent||'');
  return content.includes('فهرست پرونده‌های حرفه‌ای')||content.includes('جست‌وجوی نام، CP-ID، موبایل، کد ملی یا ایمیل');
}
function notify(title,text){
  try{window.toast?.(title,text)}catch{}
  if(!window.toast)console.info(title,text);
}
function addStyles(){
  if($('#evaluationDirectoryPaginationFixStylesV4'))return;
  $('#evaluationDirectoryPaginationFixStyles')?.remove();
  const style=document.createElement('style');
  style.id='evaluationDirectoryPaginationFixStylesV4';
  style.textContent=`
.evp-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-bottom:12px}.evp-search-row .sev-search{margin:0}.evp-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#08743f;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.evp-btn.primary{background:#078848;color:#fff}.evp-btn:disabled{opacity:.45;cursor:not-allowed}.evp-footer{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid #e8f0ec;color:#62736a;font-size:9px}.evp-pages{display:flex;align-items:center;gap:7px}.evp-pages strong{font-size:9px;color:#42564b}.evp-search-row.busy{opacity:.65;pointer-events:none}.evp-search-error{margin:0 0 10px;padding:9px 11px;border-radius:10px;background:#fff0f1;color:#ad2638;font-size:9px;font-weight:800}@media(max-width:700px){.evp-footer{align-items:stretch;flex-direction:column}.evp-search-row{grid-template-columns:1fr 1fr}.evp-search-row .sev-search{grid-column:1/-1}.evp-pages{justify-content:space-between}}
`;
  document.head.appendChild(style);
}
function pagePath(){
  const target=new URL('/api/admin/caregivers-page',location.origin);
  target.searchParams.set('page',String(state.page));
  const query=canonicalQuery(state.query);
  if(query)target.searchParams.set('q',query);
  return `${target.pathname}${target.search}`;
}
function transformed(payload){
  const source=payload?.data||{};
  const items=Array.isArray(source.items)?source.items:[];
  state.pagination={page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false,...(source.pagination||{})};
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
  setSearchBusy(true);
  try{
    const response=await networkFetch(pagePath(),{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
    const text=await response.text();
    let payload={};
    try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
    if(!response.ok){
      const error=new Error(payload.message||`خطای ${response.status}`);
      error.detail=payload.detail;
      throw error;
    }
    if(requestId!==state.requestId)return null;
    state.directoryPayload=transformed(payload);
    return state.directoryPayload;
  }finally{
    if(requestId===state.requestId){state.loading=false;setSearchBusy(false)}
  }
}
function isDirectoryPath(value){
  try{return new URL(String(value),location.href).pathname==='/api/admin/directory'}catch{return false}
}
function isGet(options,input){return String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='GET'}
async function directoryResponse(){return state.directoryPayload||await fetchPage()||{status:'ok',data:{accounts:[],caregivers:[],counts:{caregiverProfiles:0},pagination:state.pagination,query:state.query}}}
function installBackendBridge(){
  const backend=window.SalamatBackend;
  const current=backend?.api;
  if(typeof current!=='function'||current.__salamatEvaluationPaginationV4)return;
  const base=current.__salamatEvaluationPaginationV3&&current.__originalApi?current.__originalApi:current;
  const original=base.bind(backend);
  const wrapped=async function(path,options={}){
    if(evaluationVisible()&&isDirectoryPath(path)&&isGet(options,null))return directoryResponse();
    return original(path,options);
  };
  wrapped.__salamatEvaluationPaginationV4=true;
  wrapped.__salamatEvaluationPaginationV3=true;
  wrapped.__originalApi=original;
  backend.api=wrapped;
}
function requestInitFrom(input,init){
  if(!(input instanceof Request))return init;
  return {method:input.method,headers:input.headers,credentials:input.credentials,cache:input.cache,redirect:input.redirect,referrer:input.referrer,referrerPolicy:input.referrerPolicy,mode:input.mode,signal:input.signal,...init};
}
function installFetchBridge(){
  const current=window.fetch;
  if(typeof current!=='function'||current.__salamatEvaluationPaginationV4)return;
  const base=current.__salamatEvaluationPaginationV3&&current.__nativeFetch?current.__nativeFetch:current;
  const nativeFetch=base.bind(window);
  networkFetch=nativeFetch;
  const wrapped=async function(input,init){
    let url;
    try{url=new URL(input instanceof Request?input.url:String(input),location.href)}catch{return nativeFetch(input,init)}
    if(evaluationVisible()&&url.origin===location.origin&&url.pathname==='/api/admin/directory'&&isGet(init,input)){
      const body=await directoryResponse();
      return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    return nativeFetch(input,requestInitFrom(input,init));
  };
  wrapped.__salamatEvaluationPaginationV4=true;
  wrapped.__salamatEvaluationPaginationV3=true;
  wrapped.__nativeFetch=nativeFetch;
  window.fetch=wrapped;
}
function evaluationNavButton(){
  return $$('#sidebarNav .nav-item,#sidebarNav button').find(button=>{
    const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
    return text.includes('ارزیابی و پروانه')||text.includes('میزکار ارزیابی');
  })||null;
}
function setSearchBusy(busy){
  $('.evp-search-row')?.classList.toggle('busy',busy);
  const button=$('#evpSearchButton');
  if(button){button.disabled=busy;button.textContent=busy?'در حال جست‌وجو...':'جست‌وجو'}
  const clear=$('#evpClearSearch');
  if(clear)clear.disabled=busy;
}
function showSearchError(message=''){
  const current=$('#evpSearchError');
  if(!message){current?.remove();return}
  const row=$('.evp-search-row');
  if(!row)return;
  const box=current||document.createElement('div');
  box.id='evpSearchError';box.className='evp-search-error';box.textContent=message;
  if(!current)row.insertAdjacentElement('afterend',box);
}
function filterCurrentRows(value){
  const query=normalize(value);
  $$('[data-sev-caregiver]').forEach(row=>{
    const haystack=normalize(row.dataset.search||row.textContent||'');
    row.hidden=Boolean(query&&!haystack.includes(query));
  });
}
function rerenderEvaluation(){
  if(state.refreshing)return;
  state.refreshing=true;
  const button=evaluationNavButton();
  if(button)button.click();
  else window.renderModule?.(window.roles?.admin,['activity','ارزیابی و پروانه']);
  setTimeout(()=>{
    state.refreshing=false;
    injectEvaluationControls();
    if(state.restoreFocus){
      state.restoreFocus=false;
      const input=$('#sevCareSearch');
      input?.focus();
      try{input?.setSelectionRange(input.value.length,input.value.length)}catch{}
    }
  },120);
}
async function executeSearch({focus=true}={}){
  state.page=1;
  state.directoryPayload=null;
  state.restoreFocus=focus;
  showSearchError('');
  try{
    await fetchPage();
    rerenderEvaluation();
  }catch(error){
    const message=[error?.message||'جست‌وجو انجام نشد',error?.detail?String(error.detail).slice(0,300):''].filter(Boolean).join(' — ');
    showSearchError(message);
    notify('جست‌وجو انجام نشد',message);
  }
}
async function changePage(page){
  state.page=Math.max(1,Number(page)||1);
  state.directoryPayload=null;
  state.restoreFocus=false;
  showSearchError('');
  try{await fetchPage();rerenderEvaluation()}catch(error){showSearchError(error?.message||'دریافت صفحه انجام نشد')}
}
function injectEvaluationControls(){
  if(!evaluationVisible())return;
  const input=$('#sevCareSearch');
  const list=$('.sev-care-list');
  if(!input||!list)return;
  if(document.activeElement!==input&&input.value!==state.query)input.value=state.query;
  if(!input.closest('.evp-search-row')){
    const row=document.createElement('div');row.className='evp-search-row';
    input.parentNode?.insertBefore(row,input);row.appendChild(input);
    const search=document.createElement('button');search.type='button';search.id='evpSearchButton';search.className='evp-btn primary';search.textContent='جست‌وجو';row.appendChild(search);
    const clear=document.createElement('button');clear.type='button';clear.id='evpClearSearch';clear.className='evp-btn';clear.textContent='پاک‌کردن';row.appendChild(clear);
  }
  setSearchBusy(state.loading);
  filterCurrentRows(state.query);
  let footer=$('#evpFooter');
  if(!footer){footer=document.createElement('footer');footer.id='evpFooter';footer.className='evp-footer';list.insertAdjacentElement('afterend',footer)}
  const p=state.pagination;
  footer.innerHTML=`<span>نمایش ${fa($$('[data-sev-caregiver]').length)} مورد از ${fa(p.total)} پرونده</span><div class="evp-pages"><button class="evp-btn" id="evpPrevious" ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><strong>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</strong><button class="evp-btn" id="evpNext" ${p.hasNext?'':'disabled'}>صفحه بعد</button></div>`;
}
function caregiverDirectoryNavButton(){
  return $$('#sidebarNav .nav-item,#sidebarNav button').find(button=>{
    const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
    return text==='پرونده مراقبین'||text==='پرونده حرفه‌ای مراقبین'||text.includes('پرونده مراقبین');
  })||null;
}
function openPaginatedCaregiverDirectory(){
  if(state.redirecting)return;
  state.redirecting=true;
  const button=caregiverDirectoryNavButton();
  if(button)button.click();else window.renderModule?.(window.roles?.admin,['activity','پرونده مراقبین']);
  setTimeout(()=>{state.redirecting=false},400);
}
function captureInput(event){
  if(event.target?.id!=='sevCareSearch'||!evaluationVisible())return;
  state.query=String(event.target.value||'');
  filterCurrentRows(state.query);
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>void executeSearch(),320);
}
function captureKey(event){
  if(event.target?.id!=='sevCareSearch'||!evaluationVisible()||event.key!=='Enter')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  clearTimeout(state.timer);
  state.query=String(event.target.value||'');
  void executeSearch();
}
function captureClick(event){
  if(!evaluationVisible())return;
  const search=event.target?.closest?.('#evpSearchButton');
  if(search){event.preventDefault();event.stopPropagation();clearTimeout(state.timer);state.query=String($('#sevCareSearch')?.value||'');void executeSearch();return}
  const clear=event.target?.closest?.('#evpClearSearch');
  if(clear){event.preventDefault();event.stopPropagation();clearTimeout(state.timer);state.query='';const input=$('#sevCareSearch');if(input)input.value='';filterCurrentRows('');void executeSearch();return}
  const previous=event.target?.closest?.('#evpPrevious');
  if(previous&&!previous.disabled){event.preventDefault();void changePage(state.page-1);return}
  const next=event.target?.closest?.('#evpNext');
  if(next&&!next.disabled){event.preventDefault();void changePage(state.page+1)}
}
function captureBack(event){
  const control=event.target?.closest?.('button,a,[role="button"]');
  if(!control||!professionalContext())return;
  const text=String(control.textContent||control.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
  if(!text.includes('بازگشت'))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openPaginatedCaregiverDirectory();
}
function inspectDom(){
  installBackendBridge();installFetchBridge();injectEvaluationControls();
  if(legacyProfessionalListVisible())openPaginatedCaregiverDirectory();
}
function boot(){
  addStyles();installBackendBridge();installFetchBridge();
  document.addEventListener('input',captureInput,true);
  document.addEventListener('keydown',captureKey,true);
  document.addEventListener('click',captureClick,true);
  document.addEventListener('click',captureBack,true);
  new MutationObserver(()=>setTimeout(inspectDom,20)).observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{installBackendBridge();installFetchBridge()},1200);
  window.SalamatEvaluationDirectorySearch={
    search:query=>{state.query=String(query||'');return executeSearch({focus:false})},
    refresh:()=>{state.directoryPayload=null;return fetchPage().then(rerenderEvaluation)},
    state,
  };
  inspectDom();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
