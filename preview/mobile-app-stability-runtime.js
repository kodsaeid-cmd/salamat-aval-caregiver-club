(()=>{
'use strict';
if(window.__salamatMobileAppStabilityRuntime)return;
window.__salamatMobileAppStabilityRuntime=true;

const VERSION='2.0.0';
const MOBILE_QUERY='(max-width: 760px)';
const NAV_ID='salamatMobileBottomNav';
const HEADER_ID='salamatMobileAppHeader';
const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';
const media=window.matchMedia(MOBILE_QUERY);
let syncFrame=0;
let activationToken=0;
let busyUntil=0;
let lastTapAt=0;

const normalize=value=>String(value||'')
  .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
  .replace(/\s+/g,' ')
  .trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const isAppVisible=()=>Boolean(document.querySelector('#appView:not(.hidden)'));
const sidebar=()=>document.querySelector('#sidebar');
const bottomNav=()=>document.getElementById(NAV_ID);

const style=document.createElement('style');
style.id='salamatMobileAppStabilityStyles';
style.textContent=`
@media(max-width:760px){
  html.salamat-mobile-app #appView.app.hidden,
  html.salamat-history-landing #appView.app,
  html.salamat-history-landing #appView{display:none!important}
  html.salamat-history-landing #loginView{display:block!important;visibility:visible!important;pointer-events:auto!important}
  html.salamat-mobile-app #${NAV_ID}{z-index:135!important;pointer-events:auto!important;isolation:isolate!important;touch-action:manipulation!important;transform:translateZ(0)}
  html.salamat-mobile-app #${NAV_ID} button,
  html.salamat-mobile-app #${NAV_ID} button *{pointer-events:auto!important;touch-action:manipulation!important;-webkit-user-select:none;user-select:none}
  html.salamat-mobile-app #${NAV_ID}[aria-busy="true"] button{pointer-events:none!important}
  html.salamat-mobile-app #${NAV_ID} button[aria-current="page"]{color:#08743f!important;background:#eaf7f0!important}
  html.salamat-mobile-app #${NAV_ID} button.mapp-nav-error{animation:salamatNavShake .28s ease}
  html.salamat-mobile-app #${HEADER_ID}{z-index:134!important;pointer-events:auto!important}
  html.salamat-mobile-app #${HEADER_ID} button{pointer-events:auto!important;touch-action:manipulation!important}
  html.salamat-mobile-menu-visible #${NAV_ID}{opacity:0!important;transform:translateY(calc(100% + 24px))!important;pointer-events:none!important}
  @keyframes salamatNavShake{25%{transform:translateX(3px)}50%{transform:translateX(-3px)}75%{transform:translateX(2px)}}
}
`;
(document.head||document.documentElement).appendChild(style);

function sourceButtons(){
  return [...document.querySelectorAll(SOURCE_SELECTOR)].filter(button=>{
    if(!(button instanceof HTMLElement))return false;
    if(button.disabled||button.classList.contains('hidden')||button.getAttribute('aria-hidden')==='true')return false;
    const style=getComputedStyle(button);
    return style.display!=='none';
  });
}

function sourceLabel(source){
  const clone=source.cloneNode(true);
  clone.querySelectorAll('b,[data-icon],svg').forEach(node=>node.remove());
  return normalize(clone.textContent).slice(0,24)||'ماژول';
}

function sourceIcon(source){
  const icon=source.querySelector('[data-icon]');
  if(icon)return icon.outerHTML;
  const svg=source.querySelector('svg');
  return svg?svg.outerHTML:'<span aria-hidden="true">●</span>';
}

function sourceKey(source,index){
  const dataset=source.dataset||{};
  const stable=dataset.moduleKey||dataset.module||dataset.route||dataset.view||dataset.key||dataset.index||source.id;
  return stable?`key:${stable}`:`index:${index}:${sourceLabel(source)}`;
}

function activeSourceIndex(sources=sourceButtons()){
  return sources.findIndex(source=>source.classList.contains('active')||source.getAttribute('aria-current')==='page');
}

function viewFingerprint(){
  const content=document.querySelector('#content');
  const first=content?.firstElementChild;
  const heading=normalize(document.querySelector('#pageTitle')?.textContent);
  const active=activeSourceIndex();
  const firstKey=first?`${first.id}:${[...first.classList].join('.')}`:'';
  const text=normalize(content?.textContent).slice(0,220);
  return `${heading}|${active}|${firstKey}|${text}`;
}

function repairShellState(){
  const panel=sidebar();
  const open=Boolean(panel?.classList.contains('open'));
  if(!open){
    document.body?.classList.remove('salamat-mobile-nav-open');
    document.documentElement.classList.remove('salamat-mobile-menu-visible');
    const backdrop=document.getElementById('mobileSidebarBackdrop');
    backdrop?.classList.remove('open');
    backdrop?.setAttribute('aria-hidden','true');
    const main=document.querySelector('.main-area');
    if(main){
      main.removeAttribute('aria-hidden');
      if('inert' in main)main.inert=false;
    }
  }
  if(!media.matches){
    window.SalamatMobileShell?.close?.({restoreFocus:false});
    document.body?.classList.remove('salamat-mobile-nav-open');
    document.documentElement.classList.remove('salamat-mobile-menu-visible');
  }
}

function closeTransientNavigation(){
  window.SalamatMobileShell?.close?.({restoreFocus:false});
  const backdrop=document.getElementById('mobileSidebarBackdrop');
  backdrop?.classList.remove('open');
  backdrop?.setAttribute('aria-hidden','true');
  document.body?.classList.remove('salamat-mobile-nav-open');
  document.documentElement.classList.remove('salamat-mobile-menu-visible');
  const main=document.querySelector('.main-area');
  if(main){
    main.removeAttribute('aria-hidden');
    if('inert' in main)main.inert=false;
  }
}

function buildBottomNavigation(){
  const nav=bottomNav();
  if(!nav||!media.matches||!isAppVisible())return;
  const sources=sourceButtons();
  if(!sources.length)return;
  const active=activeSourceIndex(sources);
  const primary=sources.slice(0,4);
  const signature=sources.map((source,index)=>`${sourceKey(source,index)}:${source.classList.contains('active')}`).join('|');
  if(nav.dataset.stabilitySignature!==signature){
    nav.dataset.stabilitySignature=signature;
    nav.innerHTML=primary.map((source,index)=>{
      const selected=index===active;
      const label=sourceLabel(source);
      const key=sourceKey(source,index);
      return `<button type="button" data-stable-nav="true" data-source-index="${index}" data-source-key="${encodeURIComponent(key)}" class="${selected?'active':''}" aria-label="${label.replace(/"/g,'&quot;')}" aria-current="${selected?'page':'false'}">${sourceIcon(source)}<span>${label}</span></button>`;
    }).join('')+`<button type="button" data-stable-more="true" class="${active>=4?'active':''}" aria-label="نمایش همه ماژول‌ها" aria-current="${active>=4?'page':'false'}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg><span>بیشتر</span></button>`;
  }else{
    [...nav.querySelectorAll('button[data-stable-nav]')].forEach((button,index)=>{
      const selected=index===active;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-current',selected?'page':'false');
    });
    const more=nav.querySelector('button[data-stable-more]');
    more?.classList.toggle('active',active>=4);
    more?.setAttribute('aria-current',active>=4?'page':'false');
  }
  nav.removeAttribute('aria-busy');
}

function resolveSource(button){
  const sources=sourceButtons();
  const rawKey=decodeURIComponent(button.dataset.sourceKey||'');
  const index=Number(button.dataset.sourceIndex);
  if(Number.isInteger(index)&&sources[index]){
    if(!rawKey||sourceKey(sources[index],index)===rawKey)return sources[index];
  }
  return sources.find((source,sourceIndex)=>sourceKey(source,sourceIndex)===rawKey)
    ||sources.find(source=>sourceLabel(source)===normalize(button.textContent))
    ||null;
}

function dispatchNativeClick(source){
  try{
    HTMLElement.prototype.click.call(source);
    return true;
  }catch{
    try{
      return source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}));
    }catch{return false}
  }
}

async function activateSource(button){
  const token=++activationToken;
  const nav=bottomNav();
  const now=performance.now();
  if(now<busyUntil)return;
  busyUntil=now+260;
  nav?.setAttribute('aria-busy','true');
  button.classList.remove('mapp-nav-error');
  repairShellState();
  closeTransientNavigation();

  let source=resolveSource(button);
  if(!source){
    scheduleSync();
    nav?.removeAttribute('aria-busy');
    button.classList.add('mapp-nav-error');
    window.toast?.('مسیر در دسترس نیست','فهرست ماژول‌ها تازه‌سازی شد؛ دوباره انتخاب کنید.');
    return;
  }

  const before=viewFingerprint();
  const expectedIndex=sourceButtons().indexOf(source);
  source.focus?.({preventScroll:true});
  dispatchNativeClick(source);
  await sleep(90);
  if(token!==activationToken)return;

  let changed=viewFingerprint()!==before||activeSourceIndex()===expectedIndex;
  if(!changed){
    source=resolveSource(button)||source;
    source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}));
    await sleep(180);
    changed=viewFingerprint()!==before||activeSourceIndex()===sourceButtons().indexOf(source);
  }

  if(changed){
    closeTransientNavigation();
    window.scrollTo({top:0,left:0,behavior:'auto'});
    window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-complete',{detail:{index:expectedIndex,label:sourceLabel(source)}}));
  }else{
    button.classList.add('mapp-nav-error');
    window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-failed',{detail:{index:expectedIndex,label:sourceLabel(source)}}));
    window.toast?.('بازکردن ماژول انجام نشد','لطفاً یک‌بار صفحه را تازه‌سازی کنید.');
  }
  nav?.removeAttribute('aria-busy');
  scheduleSync();
}

function openAllModules(){
  repairShellState();
  if(!media.matches||!isAppVisible())return;
  window.SalamatMobileShell?.open?.({focus:true});
}

function onBottomNavigationClick(event){
  const target=event.target;
  if(!(target instanceof Element))return;
  const button=target.closest(`#${NAV_ID} button`);
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const now=performance.now();
  if(now-lastTapAt<120)return;
  lastTapAt=now;
  if(button.matches('[data-stable-more],[data-more="true"]')){
    openAllModules();
    return;
  }
  void activateSource(button);
}

document.addEventListener('click',onBottomNavigationClick,true);

document.addEventListener('keydown',event=>{
  const target=event.target;
  if(!(target instanceof Element)||!target.closest(`#${NAV_ID} button`))return;
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  target.closest('button')?.click();
},true);

function sync(){
  repairShellState();
  const nav=bottomNav();
  const header=document.getElementById(HEADER_ID);
  const visible=media.matches&&isAppVisible();
  nav?.setAttribute('aria-hidden',visible?'false':'true');
  header?.setAttribute('aria-hidden',visible?'false':'true');
  if(!visible)return;
  buildBottomNavigation();
}

function scheduleSync(){
  cancelAnimationFrame(syncFrame);
  syncFrame=requestAnimationFrame(sync);
}

media.addEventListener?.('change',scheduleSync);
window.addEventListener('pageshow',scheduleSync);
window.addEventListener('orientationchange',()=>setTimeout(scheduleSync,80));
window.addEventListener('salamat-authenticated',scheduleSync);
window.addEventListener('salamat-shell-ready',scheduleSync);
window.addEventListener('salamat-history-restored',scheduleSync);
window.addEventListener('salamat-history-pushed',scheduleSync);
window.addEventListener('salamat-mobile-navigation-complete',scheduleSync);
window.addEventListener('salamat-mobile-menu-closed',scheduleSync);

const observer=new MutationObserver(scheduleSync);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','disabled','data-view','data-route','data-module','data-module-key']});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleSync,{once:true});
else scheduleSync();

window.SalamatMobileAppStability={
  version:VERSION,
  sync:scheduleSync,
  activateIndex(index){
    const button=bottomNav()?.querySelector(`button[data-source-index="${Number(index)}"]`);
    if(button)return activateSource(button);
    return Promise.resolve(false);
  },
  openModules:openAllModules,
  repair:repairShellState,
};
})();
