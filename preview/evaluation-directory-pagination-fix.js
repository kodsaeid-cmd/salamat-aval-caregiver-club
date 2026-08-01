(()=>{
'use strict';
if(window.__salamatEvaluationDirectoryPaginationFixV2)return;
window.__salamatEvaluationDirectoryPaginationFixV2=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const state={
  page:1,
  query:'',
  pagination:{page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false},
  timer:null,
  refreshing:false,
  redirecting:false,
};

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
function addStyles(){
  if($('#evaluationDirectoryPaginationFixStyles'))return;
  const style=document.createElement('style');
  style.id='evaluationDirectoryPaginationFixStyles';
  style.textContent=`
.evp-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:12px}.evp-search-row .sev-search{margin:0}.evp-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#08743f;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.evp-btn.primary{background:#078848;color:#fff}.evp-btn:disabled{opacity:.45;cursor:not-allowed}.evp-footer{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid #e8f0ec;color:#62736a;font-size:9px}.evp-pages{display:flex;align-items:center;gap:7px}.evp-pages strong{font-size:9px;color:#42564b}@media(max-width:700px){.evp-footer{align-items:stretch;flex-direction:column}.evp-search-row{grid-template-columns:1fr}.evp-pages{justify-content:space-between}}
`;
  document.head.appendChild(style);
}
function paginatedPath(){
  const target=new URL('/api/admin/caregivers-page',location.origin);
  target.searchParams.set('page',String(state.page));
  if(state.query)target.searchParams.set('q',state.query);
  return `${target.pathname}${target.search}`;
}
function transformPayload(payload){
  const source=payload?.data||{};
  const items=Array.isArray(source.items)?source.items:[];
  state.pagination={page:1,pageSize:50,total:0,totalPages:1,hasNext:false,hasPrevious:false,...(source.pagination||{})};
  state.page=Number(state.pagination.page||1);
  setTimeout(injectEvaluationControls,0);
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
function isDirectoryPath(value){
  try{return new URL(String(value),location.href).pathname==='/api/admin/directory'}catch{return false}
}
function isGet(options,input){
  return String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='GET';
}
function installBackendBridge(){
  const backend=window.SalamatBackend;
  const current=backend?.api;
  if(typeof current!=='function'||current.__salamatEvaluationPaginationV2)return;
  const original=current.bind(backend);
  const wrapped=async function(path,options={}){
    if(evaluationVisible()&&isDirectoryPath(path)&&isGet(options,null)){
      return transformPayload(await original(paginatedPath(),options));
    }
    return original(path,options);
  };
  wrapped.__salamatEvaluationPaginationV2=true;
  wrapped.__originalApi=original;
  backend.api=wrapped;
}
function requestInitFrom(input,init){
  if(!(input instanceof Request))return init;
  return {
    method:input.method,
    headers:input.headers,
    credentials:input.credentials,
    cache:input.cache,
    redirect:input.redirect,
    referrer:input.referrer,
    referrerPolicy:input.referrerPolicy,
    mode:input.mode,
    signal:input.signal,
    ...init,
  };
}
function installFetchBridge(){
  const current=window.fetch;
  if(typeof current!=='function'||current.__salamatEvaluationPaginationV2)return;
  const nativeFetch=current.bind(window);
  const wrapped=async function(input,init){
    let url;
    try{url=new URL(input instanceof Request?input.url:String(input),location.href)}catch{return nativeFetch(input,init)}
    if(!evaluationVisible()||url.origin!==location.origin||url.pathname!=='/api/admin/directory'||!isGet(init,input)){
      return nativeFetch(input,init);
    }
    const response=await nativeFetch(paginatedPath(),requestInitFrom(input,init));
    const text=await response.text();
    let payload={};
    try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
    const body=response.ok?transformPayload(payload):payload;
    return new Response(JSON.stringify(body),{
      status:response.status,
      statusText:response.statusText,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
    });
  };
  wrapped.__salamatEvaluationPaginationV2=true;
  wrapped.__nativeFetch=nativeFetch;
  window.fetch=wrapped;
}
function evaluationNavButton(){
  return $$('#sidebarNav .nav-item,#sidebarNav button').find(button=>{
    const text=String(button.textContent||'').trim();
    return text==='ارزیابی و پروانه'||text==='میزکار ارزیابی';
  })||null;
}
function refreshEvaluation(){
  if(state.refreshing)return;
  state.refreshing=true;
  const button=evaluationNavButton();
  if(button)button.click();
  else window.renderModule?.(window.roles?.admin,['activity','ارزیابی و پروانه']);
  setTimeout(()=>{state.refreshing=false},350);
}
function runSearch(){
  state.query=String($('#sevCareSearch')?.value||'').trim();
  state.page=1;
  refreshEvaluation();
}
function injectEvaluationControls(){
  if(!evaluationVisible())return;
  const input=$('#sevCareSearch');
  const list=$('.sev-care-list');
  if(!input||!list)return;
  input.value=state.query;
  if(!input.closest('.evp-search-row')){
    const row=document.createElement('div');
    row.className='evp-search-row';
    input.parentNode?.insertBefore(row,input);
    row.appendChild(input);
    const button=document.createElement('button');
    button.type='button';
    button.id='evpSearchButton';
    button.className='evp-btn primary';
    button.textContent='جست‌وجو';
    button.addEventListener('click',runSearch);
    row.appendChild(button);
  }
  let footer=$('#evpFooter');
  if(!footer){
    footer=document.createElement('footer');
    footer.id='evpFooter';
    footer.className='evp-footer';
    list.insertAdjacentElement('afterend',footer);
  }
  const p=state.pagination;
  footer.innerHTML=`<span>نمایش حداکثر ۵۰ مراقب از ${fa(p.total)} پرونده</span><div class="evp-pages"><button class="evp-btn" id="evpPrevious" ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><strong>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</strong><button class="evp-btn" id="evpNext" ${p.hasNext?'':'disabled'}>صفحه بعد</button></div>`;
  $('#evpPrevious')?.addEventListener('click',()=>{if(p.hasPrevious){state.page=Math.max(1,state.page-1);refreshEvaluation()}});
  $('#evpNext')?.addEventListener('click',()=>{if(p.hasNext){state.page+=1;refreshEvaluation()}});
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
  if(button)button.click();
  else window.renderModule?.(window.roles?.admin,['activity','پرونده مراقبین']);
  setTimeout(()=>{state.redirecting=false},400);
}
function captureInput(event){
  if(event.target?.id!=='sevCareSearch'||!evaluationVisible())return;
  event.stopImmediatePropagation();
  clearTimeout(state.timer);
  state.timer=setTimeout(runSearch,450);
}
function captureKey(event){
  if(event.target?.id!=='sevCareSearch'||!evaluationVisible()||event.key!=='Enter')return;
  event.preventDefault();
  event.stopImmediatePropagation();
  clearTimeout(state.timer);
  runSearch();
}
function captureBack(event){
  const control=event.target?.closest?.('button,a,[role="button"]');
  if(!control||!professionalContext())return;
  const text=String(control.textContent||control.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
  if(!text.includes('بازگشت'))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPaginatedCaregiverDirectory();
}
function inspectDom(){
  installBackendBridge();
  installFetchBridge();
  injectEvaluationControls();
  if(legacyProfessionalListVisible())openPaginatedCaregiverDirectory();
}
function boot(){
  addStyles();
  installBackendBridge();
  installFetchBridge();
  document.addEventListener('input',captureInput,true);
  document.addEventListener('keydown',captureKey,true);
  document.addEventListener('click',captureBack,true);
  new MutationObserver(()=>setTimeout(inspectDom,20)).observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{installBackendBridge();installFetchBridge()},1200);
  inspectDom();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
