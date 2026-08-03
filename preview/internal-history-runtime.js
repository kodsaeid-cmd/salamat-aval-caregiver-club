(()=>{
'use strict';
if(window.__salamatInternalHistoryRuntime)return;
window.__salamatInternalHistoryRuntime=true;

const STATE_KEY='__salamatClubHistory';
const ROOT_HASH='#/club/home';
const MAX_CHAIN=8;
const NAV_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';
const ACTION_SELECTOR='#content a,#content button,#drawer a,#drawer button';
const EXCLUDED_SELECTOR='form button[type="submit"],button[type="submit"],.danger,.btn.danger,[data-danger],[data-delete],[data-remove]';
const EXCLUDED_WORDS=/^(ثبت|ذخیره|حذف|پاک|تایید|تأیید|رد|ارسال|پرداخت|آپلود|بارگذاری|خروج|بستن|لغو|انصراف)(\s|$)/;
let armed=false;
let replaying=false;
let pending=null;
let sequence=0;
let lastStableState=null;

const normalize=value=>String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const app=()=>document.querySelector('#appView');
const appVisible=()=>Boolean(app()&&!app().classList.contains('hidden'));
const loginVisible=()=>Boolean(document.querySelector('#loginView:not(.hidden)'));
const navButtons=()=>[...document.querySelectorAll(NAV_SELECTOR)];
const currentState=()=>history.state&&history.state[STATE_KEY]?history.state:null;

function stableDataset(element){
  const data={};
  const allow=['module','moduleKey','route','view','action','key','id','userId','caregiverId','recordId','periodId','caseId','index'];
  for(const key of allow){
    const value=element?.dataset?.[key];
    if(value!=null&&String(value).length<=160)data[key]=String(value);
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
    tag:target.tagName.toLowerCase(),
    text:normalize(target.textContent).slice(0,140),
    className:[...target.classList].filter(name=>!['active','open','selected','loading','hidden'].includes(name)).slice(0,8).join(' '),
    dataset:stableDataset(target),
    index:isNav?buttons.indexOf(target):-1,
  };
}

function descriptorKey(item){
  if(!item)return'';
  const data=Object.entries(item.dataset||{}).map(([key,value])=>`${key}:${value}`).join('|');
  return [item.kind,item.id,item.index,item.text,item.className,data].join('~');
}

function activeNavDescriptor(){
  const buttons=navButtons();
  return descriptor(buttons.find(button=>button.classList.contains('active'))||buttons[0]||null);
}

function headings(root){
  if(!root)return'';
  return [...root.querySelectorAll('h1,h2,h3,[data-page-title],[data-title]')]
    .filter(node=>node.getClientRects().length>0)
    .slice(0,6)
    .map(node=>normalize(node.textContent).slice(0,90))
    .join('|');
}

function overlaySignature(){
  const open=[];
  document.querySelectorAll('.drawer.open,[role="dialog"]:not(.hidden),.modal.open,.modal.show,.caregiver-signup-layer:not(.hidden)').forEach(node=>{
    if(node.getClientRects().length)open.push(node.id||[...node.classList].slice(0,3).join('.'));
  });
  return open.join('|');
}

function viewSignature(){
  const content=document.querySelector('#content');
  const title=normalize(document.querySelector('#pageTitle')?.textContent);
  const active=descriptorKey(activeNavDescriptor());
  const shell=content?.firstElementChild;
  const shellKey=shell?`${shell.id}|${[...shell.classList].join('.')}`:'';
  return [title,active,shellKey,headings(content),overlaySignature()].join('::');
}

function slug(value){
  const ascii=normalize(value).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,56);
  return ascii||'page';
}

function routeHash(chain,root=false){
  if(root||!chain?.length)return ROOT_HASH;
  return `#/club/${slug(chain[chain.length-1]?.text||chain[0]?.text)}`;
}

function makeState(chain,{root=false}={}){
  return {
    [STATE_KEY]:true,
    root,
    id:++sequence,
    chain:(chain||[]).slice(0,MAX_CHAIN),
    title:normalize(document.querySelector('#pageTitle')?.textContent)||'باشگاه مراقبین سلامت اول',
    createdAt:Date.now(),
  };
}

function sameChain(a,b){
  const left=(a||[]).map(descriptorKey).join('>');
  const right=(b||[]).map(descriptorKey).join('>');
  return left===right;
}

function pushView(chain){
  if(!armed||replaying||!appVisible()||!chain?.length)return;
  const existing=currentState();
  if(existing&&!existing.root&&sameChain(existing.chain,chain))return;
  const state=makeState(chain);
  history.pushState(state,'',routeHash(chain));
  lastStableState=state;
  window.dispatchEvent(new CustomEvent('salamat-history-pushed',{detail:state}));
}

function rootChain(){
  const nav=activeNavDescriptor()||descriptor(navButtons()[0]||null);
  return nav?[nav]:[];
}

function establishBoundary(){
  if(!appVisible())return;
  armed=true;
  const existing=currentState();
  if(existing){
    lastStableState=existing;
    return;
  }
  const chain=rootChain();
  const root=makeState([],{root:true});
  history.replaceState(root,'',ROOT_HASH);
  const dashboard=makeState(chain);
  history.pushState(dashboard,'',routeHash(chain));
  lastStableState=dashboard;
}

function candidateAllowed(element){
  if(!(element instanceof Element))return false;
  const target=element.closest('a,button,[role="button"]');
  if(!target)return false;
  if(target.closest('#mobileMenu,#logoutButton,#closeDrawer,#drawerBackdrop,#mobileSidebarBackdrop,.toast'))return false;
  if(target.matches(EXCLUDED_SELECTOR)||target.closest(EXCLUDED_SELECTOR))return false;
  if(target.getAttribute('href')?.startsWith('tel:')||target.getAttribute('href')?.startsWith('mailto:'))return false;
  if(EXCLUDED_WORDS.test(normalize(target.textContent)))return false;
  return Boolean(target.closest(NAV_SELECTOR)||target.closest(ACTION_SELECTOR));
}

function chainFor(target){
  const item=descriptor(target);
  if(!item)return null;
  if(item.kind==='nav')return[item];
  const current=currentState();
  const base=current&&!current.root&&Array.isArray(current.chain)?current.chain.slice():rootChain();
  const key=descriptorKey(item);
  if(descriptorKey(base[base.length-1])===key)return base;
  return [...base,item].slice(-MAX_CHAIN);
}

function beginNavigation(target){
  if(!armed||replaying||!appVisible()||!candidateAllowed(target))return;
  const chain=chainFor(target);
  if(!chain)return;
  if(pending?.observer)pending.observer.disconnect();
  const token=Symbol('history-navigation');
  const before=viewSignature();
  const observer=new MutationObserver(()=>{
    if(!pending||pending.token!==token)return;
    const after=viewSignature();
    if(after===before)return;
    observer.disconnect();
    pending=null;
    pushView(chain);
  });
  observer.observe(document.querySelector('#appView')||document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','data-view','data-route']});
  pending={token,observer};
  setTimeout(()=>{
    if(!pending||pending.token!==token)return;
    observer.disconnect();
    pending=null;
    if(viewSignature()!==before)pushView(chain);
  },1500);
}

function selectorEscape(value){
  if(window.CSS?.escape)return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g,character=>`\\${character}`);
}

function matchesDescriptor(element,item){
  if(!(element instanceof Element))return false;
  if(item.id&&element.id===item.id)return true;
  const data=item.dataset||{};
  const entries=Object.entries(data);
  if(entries.length&&entries.every(([key,value])=>element.dataset?.[key]===value))return true;
  const text=normalize(element.textContent);
  return Boolean(item.text&&(text===item.text||text.includes(item.text)||item.text.includes(text)));
}

function locate(item){
  if(!item)return null;
  if(item.id){
    const byId=document.getElementById(item.id);
    if(byId)return byId;
  }
  if(item.kind==='nav'){
    const buttons=navButtons();
    if(item.index>=0&&buttons[item.index]&&matchesDescriptor(buttons[item.index],item))return buttons[item.index];
    return buttons.find(button=>matchesDescriptor(button,item))||null;
  }
  const dataEntries=Object.entries(item.dataset||{});
  if(dataEntries.length){
    const selector=dataEntries.map(([key,value])=>`[data-${key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)}="${selectorEscape(value)}"]`).join('');
    try{
      const found=document.querySelector(`#content ${selector},#drawer ${selector}`);
      if(found)return found;
    }catch{}
  }
  return [...document.querySelectorAll('#content a,#content button,#drawer a,#drawer button')].find(element=>matchesDescriptor(element,item))||null;
}

async function waitFor(item,timeout=2800){
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
  if(typeof window.closeDrawer==='function'){
    try{window.closeDrawer()}catch{}
  }
  document.querySelectorAll('.drawer.open').forEach(node=>node.classList.remove('open'));
  document.querySelectorAll('.drawer-backdrop:not(.hidden)').forEach(node=>node.classList.add('hidden'));
  document.querySelectorAll('.modal.open,.modal.show').forEach(node=>node.classList.remove('open','show'));
}

async function replayChain(chain){
  const safeChain=Array.isArray(chain)&&chain.length?chain:rootChain();
  closeTransientViews();
  for(const item of safeChain){
    const target=await waitFor(item);
    if(!target)continue;
    target.click();
    await sleep(item.kind==='nav'?180:260);
  }
  window.scrollTo({top:0,left:0,behavior:'auto'});
}

async function handlePop(event){
  if(!armed||!appVisible())return;
  const state=event.state;
  if(!state||!state[STATE_KEY]){
    const fallback=lastStableState||makeState(rootChain());
    history.pushState(fallback,'',routeHash(fallback.chain));
    return;
  }
  replaying=true;
  try{
    if(state.root){
      const chain=rootChain();
      await replayChain(chain);
      const dashboard=makeState(chain);
      history.pushState(dashboard,'',routeHash(chain));
      lastStableState=dashboard;
      return;
    }
    await replayChain(state.chain);
    lastStableState=state;
  }finally{
    replaying=false;
  }
}

function disableForLogout(){
  armed=false;
  replaying=false;
  pending?.observer?.disconnect();
  pending=null;
  history.replaceState({salamatLogin:true},'',location.pathname+location.search+'#/login');
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
window.addEventListener('salamat-authenticated',()=>setTimeout(establishBoundary,0));
window.addEventListener('salamat-shell-ready',()=>setTimeout(establishBoundary,0));
window.addEventListener('pageshow',()=>setTimeout(()=>{
  if(appVisible())establishBoundary();
  else if(loginVisible())armed=false;
},0));

const visibilityObserver=new MutationObserver(()=>{
  if(appVisible()&&!armed)establishBoundary();
  if(loginVisible()&&!appVisible())armed=false;
});
visibilityObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(appVisible())establishBoundary()},{once:true});
else if(appVisible())establishBoundary();

window.SalamatInternalHistory={
  establish:establishBoundary,
  push:pushView,
  replay:replayChain,
  reset:disableForLogout,
  get armed(){return armed},
  get state(){return currentState()},
};
})();
