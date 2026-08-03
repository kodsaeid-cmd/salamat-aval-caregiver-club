(()=>{
'use strict';
if(window.__salamatInternalHistoryRuntimeV2)return;
window.__salamatInternalHistoryRuntimeV2=true;
window.__salamatInternalHistoryRuntime=true;

const STATE_KEY='__salamatClubHistoryV2';
const LANDING_HASH='#/home';
const APP_HASH='#/club';
const MAX_CHAIN=10;
const NAV_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';
const ACTION_SELECTOR='#content a,#content button,#drawer a,#drawer button';
const EXCLUDED_SELECTOR='form button[type="submit"],button[type="submit"],.danger,.btn.danger,[data-danger],[data-delete],[data-remove],[data-submit]';
const EXCLUDED_WORDS=/^(ثبت|ذخیره|حذف|پاک|تایید|تأیید|رد|ارسال|پرداخت|آپلود|بارگذاری|خروج|بستن|لغو|انصراف)(\s|$)/;
const BASE_URL=()=>`${location.pathname}${location.search}`;

let armed=false;
let restoring=false;
let landingMode=false;
let explicitLogout=false;
let sequence=0;
let pendingChain=null;
let pendingBefore='';
let viewTimer=0;
let lastFingerprint='';
let lastAppState=null;
let scrollTimer=0;

const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const app=()=>document.querySelector('#appView');
const login=()=>document.querySelector('#loginView');
const appVisible=()=>Boolean(app()&&!app().classList.contains('hidden'));
const loginVisible=()=>Boolean(login()&&!login().classList.contains('hidden'));
const navButtons=()=>[...document.querySelectorAll(NAV_SELECTOR)];
const stateOf=value=>value&&value[STATE_KEY]?value:null;
const currentState=()=>stateOf(history.state);

function stableDataset(element){
  const data={};
  const allow=['module','moduleKey','route','view','action','key','id','userId','caregiverId','recordId','periodId','caseId','index','tab','section','step','page'];
  for(const key of allow){
    const value=element?.dataset?.[key];
    if(value!=null&&String(value).length<=180)data[key]=String(value);
  }
  return data;
}

function descriptor(element){
  if(!(element instanceof Element))return null;
  const nav=element.closest(NAV_SELECTOR);
  const target=nav||element.closest('a,button,[role="button"]');
  if(!target)return null;
  const isNav=Boolean(nav);
  const buttons=isNav?navButtons():[];
  return {
    kind:isNav?'nav':'action',
    id:target.id||'',
    text:normalize(target.textContent).slice(0,150),
    aria:normalize(target.getAttribute('aria-label')).slice(0,100),
    className:[...target.classList].filter(name=>!['active','open','selected','loading','hidden','show'].includes(name)).slice(0,8).join(' '),
    dataset:stableDataset(target),
    index:isNav?buttons.indexOf(target):-1,
  };
}

function descriptorKey(item){
  if(!item)return'';
  const data=Object.entries(item.dataset||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}:${value}`).join('|');
  return [item.kind,item.id,item.index,item.text,item.aria,item.className,data].join('~');
}

function activeNav(){
  const buttons=navButtons();
  return buttons.find(button=>button.classList.contains('active'))||buttons[0]||null;
}

function activeNavDescriptor(){return descriptor(activeNav())}

function overlayFingerprint(){
  const values=[];
  document.querySelectorAll('.drawer.open,[role="dialog"]:not(.hidden),.modal.open,.modal.show,.caregiver-signup-layer:not(.hidden)').forEach(node=>{
    if(!node.getClientRects().length)return;
    const title=normalize(node.querySelector('h1,h2,h3,[data-title]')?.textContent||document.querySelector('#drawerTitle')?.textContent);
    values.push(`${node.id||[...node.classList].slice(0,3).join('.')}:${title}`);
  });
  return values.join('|');
}

function routeMarkers(){
  return [...document.querySelectorAll('#content [data-view],#content [data-route],#content [data-page],#content [data-section],#content [data-tab]')]
    .filter(node=>node.getClientRects().length>0)
    .slice(0,5)
    .map(node=>`${node.id}:${node.dataset.view||''}:${node.dataset.route||''}:${node.dataset.page||''}:${node.dataset.section||''}:${node.dataset.tab||''}`)
    .join('|');
}

function viewFingerprint(){
  const content=document.querySelector('#content');
  const first=content?.firstElementChild;
  const firstKey=first?`${first.id}|${[...first.classList].filter(name=>!['loading','hidden'].includes(name)).join('.')}`:'';
  const headings=[...document.querySelectorAll('#content h1,#content h2,#content h3')]
    .filter(node=>node.getClientRects().length>0)
    .slice(0,4)
    .map(node=>normalize(node.textContent).slice(0,100))
    .join('|');
  return [
    normalize(document.querySelector('#pageTitle')?.textContent),
    descriptorKey(activeNavDescriptor()),
    firstKey,
    headings,
    routeMarkers(),
    overlayFingerprint(),
  ].join('::');
}

function slug(value){
  return normalize(value).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,58)||'home';
}

function hashFor(chain){
  const tail=chain?.[chain.length-1];
  return `${APP_HASH}/${slug(tail?.text||tail?.aria||document.querySelector('#pageTitle')?.textContent)}`;
}

function makeLandingState(){
  return {[STATE_KEY]:true,kind:'landing',id:++sequence,chain:[],scrollY:0,createdAt:Date.now()};
}

function makeAppState(chain,fingerprint=viewFingerprint()){
  return {
    [STATE_KEY]:true,
    kind:'app',
    id:++sequence,
    chain:(chain||[]).slice(0,MAX_CHAIN),
    fingerprint,
    title:normalize(document.querySelector('#pageTitle')?.textContent)||'باشگاه مراقبین سلامت اول',
    scrollY:window.scrollY||0,
    createdAt:Date.now(),
  };
}

function sameChain(left,right){
  return (left||[]).map(descriptorKey).join('>')===(right||[]).map(descriptorKey).join('>');
}

function rootChain(){
  const item=activeNavDescriptor()||descriptor(navButtons()[0]);
  return item?[item]:[];
}

function markLandingEntry(){
  const state=currentState();
  if(state)return state;
  const landing=makeLandingState();
  history.replaceState(landing,'',`${BASE_URL()}${LANDING_HASH}`);
  return landing;
}

function showLanding(){
  landingMode=true;
  restoring=true;
  closeTransientViews();
  app()?.classList.add('hidden');
  login()?.classList.remove('hidden');
  document.documentElement.classList.add('salamat-history-landing');
  document.body?.classList.add('salamat-history-landing');
  window.scrollTo({top:0,left:0,behavior:'auto'});
  requestAnimationFrame(()=>{restoring=false;window.dispatchEvent(new CustomEvent('salamat-history-landing'))});
}

function showApp(){
  landingMode=false;
  login()?.classList.add('hidden');
  app()?.classList.remove('hidden');
  document.documentElement.classList.remove('salamat-history-landing');
  document.body?.classList.remove('salamat-history-landing');
}

async function waitForNavigation(timeout=4500){
  const started=performance.now();
  while(performance.now()-started<timeout){
    if(appVisible()&&navButtons().length)return true;
    await sleep(60);
  }
  return false;
}

async function establish(){
  if(explicitLogout)return;
  if(!appVisible())return;
  if(!(await waitForNavigation()))return;
  armed=true;
  landingMode=false;
  const existing=currentState();
  if(existing?.kind==='app'){
    lastAppState=existing;
    lastFingerprint=viewFingerprint();
    return;
  }
  if(!existing)markLandingEntry();
  const chain=rootChain();
  const appState=makeAppState(chain);
  history.pushState(appState,'',`${BASE_URL()}${hashFor(chain)}`);
  lastAppState=appState;
  lastFingerprint=appState.fingerprint;
  window.dispatchEvent(new CustomEvent('salamat-history-established',{detail:appState}));
}

function updateCurrentScroll(){
  const state=currentState();
  if(!state||state.kind!=='app'||restoring)return;
  const next={...state,scrollY:window.scrollY||0};
  history.replaceState(next,'',location.href);
  lastAppState=next;
}

function pushRoute(chain,fingerprint=viewFingerprint()){
  if(!armed||restoring||landingMode||!appVisible()||!chain?.length)return;
  const current=currentState();
  if(current?.kind==='app'&&current.fingerprint===fingerprint&&sameChain(current.chain,chain))return;
  updateCurrentScroll();
  const state=makeAppState(chain,fingerprint);
  history.pushState(state,'',`${BASE_URL()}${hashFor(chain)}`);
  lastAppState=state;
  lastFingerprint=fingerprint;
  pendingChain=null;
  pendingBefore='';
  window.dispatchEvent(new CustomEvent('salamat-history-pushed',{detail:state}));
}

function candidateAllowed(element){
  if(!(element instanceof Element))return false;
  const target=element.closest('a,button,[role="button"]');
  if(!target)return false;
  if(target.closest('#mobileMenu,#logoutButton,#closeDrawer,#drawerBackdrop,#mobileSidebarBackdrop,.toast,#salamatMobileAppHeader,#salamatMobileBottomNav,#salamatMobileMenuClose'))return false;
  if(target.matches(EXCLUDED_SELECTOR)||target.closest(EXCLUDED_SELECTOR))return false;
  const href=target.getAttribute('href')||'';
  if(/^(tel:|mailto:|javascript:)/i.test(href))return false;
  if(EXCLUDED_WORDS.test(normalize(target.textContent)))return false;
  return Boolean(target.closest(NAV_SELECTOR)||target.closest(ACTION_SELECTOR));
}

function chainFor(target){
  const item=descriptor(target);
  if(!item)return null;
  if(item.kind==='nav')return[item];
  const current=currentState();
  const base=current?.kind==='app'&&Array.isArray(current.chain)?current.chain.slice():rootChain();
  if(descriptorKey(base[base.length-1])===descriptorKey(item))return base;
  return [...base,item].slice(-MAX_CHAIN);
}

function scheduleViewCheck(){
  clearTimeout(viewTimer);
  viewTimer=setTimeout(()=>{
    if(!armed||restoring||landingMode||!appVisible())return;
    const fingerprint=viewFingerprint();
    if(!fingerprint||fingerprint===lastFingerprint)return;
    let chain=pendingChain;
    if(!chain?.length){
      const current=currentState();
      const active=activeNavDescriptor();
      if(active&&descriptorKey(current?.chain?.[0])!==descriptorKey(active))chain=[active];
      else chain=current?.chain?.length?current.chain:rootChain();
    }
    pushRoute(chain,fingerprint);
  },110);
}

function beginNavigation(target){
  if(!armed||restoring||landingMode||!appVisible()||!candidateAllowed(target))return;
  updateCurrentScroll();
  pendingChain=chainFor(target);
  pendingBefore=viewFingerprint();
  setTimeout(scheduleViewCheck,0);
  setTimeout(()=>{
    if(pendingChain&&viewFingerprint()!==pendingBefore)scheduleViewCheck();
  },1200);
}

function selectorEscape(value){
  if(window.CSS?.escape)return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g,character=>`\\${character}`);
}

function matchesDescriptor(element,item){
  if(!(element instanceof Element)||!item)return false;
  if(item.id&&element.id===item.id)return true;
  const entries=Object.entries(item.dataset||{});
  if(entries.length&&entries.every(([key,value])=>element.dataset?.[key]===value))return true;
  const text=normalize(element.textContent);
  const aria=normalize(element.getAttribute('aria-label'));
  return Boolean((item.aria&&aria===item.aria)||(item.text&&(text===item.text||text.includes(item.text)||item.text.includes(text))));
}

function locate(item){
  if(!item)return null;
  if(item.id){
    const found=document.getElementById(item.id);
    if(found)return found;
  }
  if(item.kind==='nav'){
    const buttons=navButtons();
    if(item.index>=0&&buttons[item.index]&&matchesDescriptor(buttons[item.index],item))return buttons[item.index];
    return buttons.find(button=>matchesDescriptor(button,item))||null;
  }
  const entries=Object.entries(item.dataset||{});
  if(entries.length){
    const selector=entries.map(([key,value])=>`[data-${key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)}="${selectorEscape(value)}"]`).join('');
    try{
      const found=document.querySelector(`#content ${selector},#drawer ${selector}`);
      if(found)return found;
    }catch{}
  }
  return [...document.querySelectorAll('#content a,#content button,#drawer a,#drawer button')].find(element=>matchesDescriptor(element,item))||null;
}

async function waitFor(item,timeout=3600){
  const started=performance.now();
  while(performance.now()-started<timeout){
    const found=locate(item);
    if(found&&found.getClientRects().length)return found;
    await sleep(70);
  }
  return null;
}

function closeTransientViews(){
  window.SalamatMobileShell?.close?.({restoreFocus:false});
  document.querySelector('#mobileSidebarBackdrop')?.classList.remove('open');
  if(typeof window.closeDrawer==='function'){
    try{window.closeDrawer()}catch{}
  }
  document.querySelectorAll('.drawer.open').forEach(node=>node.classList.remove('open'));
  document.querySelectorAll('.drawer-backdrop:not(.hidden)').forEach(node=>node.classList.add('hidden'));
  document.querySelectorAll('.modal.open,.modal.show').forEach(node=>node.classList.remove('open','show'));
}

async function replay(chain){
  showApp();
  await waitForNavigation();
  closeTransientViews();
  const safe=Array.isArray(chain)&&chain.length?chain:rootChain();
  for(const item of safe){
    const target=await waitFor(item);
    if(!target)continue;
    target.click();
    await sleep(item.kind==='nav'?220:330);
  }
}

async function handlePop(event){
  const state=stateOf(event.state);
  if(!state){
    if(appVisible()&&armed&&!explicitLogout){
      const fallback=lastAppState||makeAppState(rootChain());
      history.pushState(fallback,'',`${BASE_URL()}${hashFor(fallback.chain)}`);
    }
    return;
  }
  if(state.kind==='landing'){
    showLanding();
    return;
  }
  if(state.kind!=='app')return;
  armed=true;
  landingMode=false;
  restoring=true;
  try{
    await replay(state.chain);
    lastAppState=state;
    lastFingerprint=viewFingerprint();
    requestAnimationFrame(()=>window.scrollTo({top:Number(state.scrollY)||0,left:0,behavior:'auto'}));
  }finally{
    setTimeout(()=>{
      restoring=false;
      pendingChain=null;
      pendingBefore='';
      lastFingerprint=viewFingerprint();
      window.dispatchEvent(new CustomEvent('salamat-history-restored',{detail:state}));
    },80);
  }
}

function disableForLogout(){
  explicitLogout=true;
  armed=false;
  restoring=false;
  landingMode=true;
  pendingChain=null;
  clearTimeout(viewTimer);
  const landing=makeLandingState();
  history.replaceState(landing,'',`${BASE_URL()}${LANDING_HASH}`);
  lastAppState=null;
  lastFingerprint='';
}

function back(){
  const state=currentState();
  if(state?.kind==='app')history.back();
  else showLanding();
}

document.addEventListener('click',event=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  if(target.closest('#logoutButton')){
    disableForLogout();
    return;
  }
  beginNavigation(target);
},true);

window.addEventListener('popstate',event=>void handlePop(event));
window.addEventListener('scroll',()=>{
  clearTimeout(scrollTimer);
  scrollTimer=setTimeout(updateCurrentScroll,140);
},{passive:true});
window.addEventListener('salamat-authenticated',()=>{
  explicitLogout=false;
  setTimeout(()=>void establish(),0);
});
window.addEventListener('salamat-shell-ready',()=>setTimeout(()=>void establish(),0));
window.addEventListener('pageshow',()=>setTimeout(()=>{
  const state=currentState();
  if(state?.kind==='landing'&&loginVisible())landingMode=true;
  if(appVisible())void establish();
},0));

const observer=new MutationObserver(()=>{
  if(restoring)return;
  if(appVisible()){
    if(!armed&&!explicitLogout)void establish();
    scheduleViewCheck();
  }
});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','data-view','data-route','data-page','data-section','data-tab']});

markLandingEntry();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(appVisible())void establish()},{once:true});
else if(appVisible())void establish();

window.SalamatInternalHistory={
  version:'2.0.0',
  establish,
  push:pushRoute,
  replay,
  back,
  reset:disableForLogout,
  showLanding,
  get armed(){return armed},
  get restoring(){return restoring},
  get state(){return currentState()},
};
})();
