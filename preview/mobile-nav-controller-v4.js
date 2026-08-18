(()=>{
'use strict';
if(window.__salamatMobileNavControllerV4)return;
window.__salamatMobileNavControllerV4=true;

const VERSION='4.0.0';
const NAV_ID='salamatMobileBottomNav';
const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';
const media=window.matchMedia('(max-width:760px)');
let frame=0;
let routeToken=0;

const normalize=value=>String(value||'')
  .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
  .replace(/[يى]/g,'ی')
  .replace(/ك/g,'ک')
  .replace(/\s+/g,' ')
  .trim();
const compact=value=>normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase();
const appVisible=()=>Boolean(document.querySelector('#appView:not(.hidden)'));
const sourceButtons=()=>[...document.querySelectorAll(SOURCE_SELECTOR)].filter(button=>{
  if(!(button instanceof HTMLElement)||button.disabled||button.hidden)return false;
  if(button.classList.contains('hidden')||button.getAttribute('aria-hidden')==='true')return false;
  return true;
});

const aliases=new Map([
  ['داشبورد','داشبورد مدیریتی'],['داشبوردمدیریتی','داشبورد مدیریتی'],['داشبوردکاربر','داشبورد مدیریتی'],
  ['کاربران','کاربران و دسترسی‌ها'],['مدیریتکاربران','کاربران و دسترسی‌ها'],['کاربرانودسترسیها','کاربران و دسترسی‌ها'],['نقشهاودسترسیها','کاربران و دسترسی‌ها'],['دسترسیها','کاربران و دسترسی‌ها'],
  ['مراقبین','پرونده مراقبین'],['مدیریتمراقبین','پرونده مراقبین'],['پروندههایمراقبین','پرونده مراقبین'],
  ['قرارداد','قراردادها'],['پرداخت','حقوق و پرداخت'],['حقوقودستمزد','حقوق و پرداخت'],['آموزش','بانک آموزش'],
  ['ارزیابی','ارزیابی و پروانه'],['پشتیبانی','پشتیبانی و امنیت'],['امنیت','پشتیبانی و امنیت'],
  ['گزارش','گزارش‌ها'],['گزارشها','گزارش‌ها'],['تنظیمات','تنظیمات و لاگ'],['تنظیماتسامانه','تنظیمات و لاگ']
].map(([key,value])=>[compact(key),value]));
const canonical=value=>aliases.get(compact(value))||normalize(value);

const ICONS={
  home:'<path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.2V20h13V9.2M9.2 20v-6.2h5.6V20"/>',
  users:'<path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-1.4a4.2 4.2 0 0 0-3.2-4M16.6 3.2a4 4 0 0 1 0 7.6"/>',
  caregiver:'<circle cx="12" cy="7" r="3.7"/><path d="M5.2 20v-1.4A6.8 6.8 0 0 1 12 11.8a6.8 6.8 0 0 1 6.8 6.8V20"/>',
  briefcase:'<rect x="2.7" y="6.8" width="18.6" height="13.2" rx="2.4"/><path d="M8 6.8V4.3h8v2.5M2.7 12h18.6"/>',
  money:'<rect x="2.5" y="5.2" width="19" height="13.6" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.3h.01M18 14.7h.01"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M8 7h8M8 11h6"/>',
  chart:'<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 2 5-6"/>',
  message:'<path d="M20.5 15.5A3.5 3.5 0 0 1 17 19H8l-5 3V7a4 4 0 0 1 4-4h10a3.5 3.5 0 0 1 3.5 3.5Z"/><path d="M8 9h8M8 13h5"/>',
  report:'<path d="M14 2.7H6a2 2 0 0 0-2 2v14.6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.7Z"/><path d="M14 2.7v6h6M8 13h8M8 17h6"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19 14a2 2 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a2 2 0 0 0-2-.4 2 2 0 0 0-1.2 1.8v.2h-4v-.2a2 2 0 0 0-1.2-1.8 2 2 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a2 2 0 0 0 .4-2A2 2 0 0 0 2 12.8h-.2v-4H2A2 2 0 0 0 3.8 7a2 2 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a2 2 0 0 0 2 .4A2 2 0 0 0 9.4.8V.6h4v.2a2 2 0 0 0 1.2 1.8 2 2 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a2 2 0 0 0-.4 2 2 2 0 0 0 1.8 1.2h.2v4h-.2A2 2 0 0 0 19 14Z"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
};
const iconKey=label=>{
  const value=compact(canonical(label));
  if(value.includes('داشبورد'))return'home';
  if(value.includes('کاربر')||value.includes('دسترسی')||value.includes('نقش'))return'users';
  if(value.includes('مراقب'))return'caregiver';
  if(value.includes('قرارداد')||value.includes('شیفت')||value.includes('ساعت'))return'briefcase';
  if(value.includes('حقوق')||value.includes('پرداخت')||value.includes('کیفپول'))return'money';
  if(value.includes('آموزش')||value.includes('دوره'))return'book';
  if(value.includes('ارزیابی')||value.includes('امتیاز')||value.includes('کارنامه'))return'chart';
  if(value.includes('پشتیبانی')||value.includes('پیام')||value.includes('امنیت'))return'message';
  if(value.includes('گزارش'))return'report';
  return'settings';
};
const icon=key=>`<span class="sa-v4-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[key]||ICONS.settings}</svg></span>`;

const style=document.createElement('style');
style.id='salamatMobileNavV4Styles';
style.textContent=`
@media(max-width:760px){
 html.salamat-mobile-app{--sa-green:#185B38;--sa-dark:#123F2A;--sa-soft:#EAF2ED;--sa-red:#D83429;--sa-muted:#708078}
 html.salamat-mobile-app #${NAV_ID}{z-index:180!important;right:8px!important;left:8px!important;bottom:calc(8px + env(safe-area-inset-bottom))!important;height:76px!important;padding:7px!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;border:1px solid rgba(24,91,56,.14)!important;border-radius:25px!important;background:rgba(255,255,255,.98)!important;box-shadow:0 18px 48px rgba(18,63,42,.2)!important;pointer-events:auto!important;touch-action:manipulation!important;isolation:isolate!important}
 html.salamat-mobile-app #${NAV_ID} button{position:relative!important;height:61px!important;min-height:61px!important;padding:5px 2px!important;border:0!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;color:var(--sa-muted)!important;background:transparent!important;pointer-events:auto!important;touch-action:manipulation!important;font-size:8px!important;font-weight:900!important;-webkit-tap-highlight-color:transparent}
 html.salamat-mobile-app #${NAV_ID} button:active{transform:scale(.95)}
 html.salamat-mobile-app #${NAV_ID} button.active,html.salamat-mobile-app #${NAV_ID} button[aria-current="page"]{color:var(--sa-green)!important;background:linear-gradient(180deg,#F5F9F7,var(--sa-soft))!important;box-shadow:inset 0 0 0 1px rgba(24,91,56,.09)!important}
 html.salamat-mobile-app #${NAV_ID} button.active:after{content:'';position:absolute;top:4px;left:50%;width:5px;height:5px;border-radius:50%;background:var(--sa-red);transform:translateX(-50%)}
 html.salamat-mobile-app .sa-v4-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:11px;color:var(--sa-green);background:var(--sa-soft);box-shadow:inset 0 0 0 1px rgba(24,91,56,.08)}
 html.salamat-mobile-app .sa-v4-icon svg{width:19px!important;height:19px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}
 html.salamat-mobile-app #${NAV_ID} button.active .sa-v4-icon{color:#fff;background:linear-gradient(145deg,var(--sa-green),var(--sa-dark));box-shadow:0 6px 15px rgba(24,91,56,.22)}
 html.salamat-mobile-app #${NAV_ID} button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 html.salamat-mobile-app .main-area{padding-bottom:calc(98px + env(safe-area-inset-bottom))!important}
 html.salamat-mobile-app #${NAV_ID}[aria-hidden="true"]{display:none!important}
}
`;
(document.head||document.documentElement).appendChild(style);

function labelOf(source){
  const explicit=source.getAttribute('aria-label')||source.dataset.label;
  if(explicit)return canonical(explicit);
  const clone=source.cloneNode(true);
  clone.querySelectorAll('b,[data-icon],svg,.badge,.count').forEach(node=>node.remove());
  return canonical(normalize(clone.textContent).slice(0,70)||'ماژول');
}
function routeOf(source,index){
  return compact(source.dataset.moduleKey||source.dataset.module||source.dataset.route||source.dataset.view||source.dataset.key||source.id||labelOf(source))||`route${index}`;
}
function activeSource(){
  return sourceButtons().find(button=>button.classList.contains('active')||button.getAttribute('aria-current')==='page')||null;
}
function claimNavigation(){
  const current=document.getElementById(NAV_ID);
  if(!current)return null;
  if(current.dataset.saOwner==='v4')return current;
  const owned=current.cloneNode(false);
  owned.id=NAV_ID;
  owned.dataset.saOwner='v4';
  owned.setAttribute('aria-label','ناوبری اصلی درخواستکیشن');
  current.replaceWith(owned);
  return owned;
}
function repairShell(){
  const sidebar=document.querySelector('#sidebar');
  if(!sidebar?.classList.contains('open')){
    document.body?.classList.remove('salamat-mobile-nav-open');
    document.documentElement.classList.remove('salamat-mobile-menu-visible');
    const backdrop=document.getElementById('mobileSidebarBackdrop');
    backdrop?.classList.remove('open');
    backdrop?.setAttribute('aria-hidden','true');
    const main=document.querySelector('.main-area');
    if(main){main.removeAttribute('aria-hidden');if('inert'in main)main.inert=false;}
  }
}
function closeTransient(){
  window.SalamatMobileShell?.close?.({restoreFocus:false});
  document.querySelector('#sidebar')?.classList.remove('open');
  document.body?.classList.remove('salamat-mobile-nav-open');
  document.documentElement.classList.remove('salamat-mobile-menu-visible');
  const backdrop=document.getElementById('mobileSidebarBackdrop');
  backdrop?.classList.remove('open');
  backdrop?.setAttribute('aria-hidden','true');
  const main=document.querySelector('.main-area');
  if(main){main.removeAttribute('aria-hidden');if('inert'in main)main.inert=false;}
}
function openMore(){
  if(window.SalamatMobileShell?.open){window.SalamatMobileShell.open({focus:true});return;}
  const sidebar=document.querySelector('#sidebar');
  sidebar?.classList.add('open');
  document.body?.classList.add('salamat-mobile-nav-open');
  document.documentElement.classList.add('salamat-mobile-menu-visible');
  const backdrop=document.getElementById('mobileSidebarBackdrop');
  backdrop?.classList.add('open');
  backdrop?.setAttribute('aria-hidden','false');
}
function syncActive(source){
  sourceButtons().forEach(button=>{
    const on=button===source;
    button.classList.toggle('active',on);
    button.setAttribute('aria-current',on?'page':'false');
  });
}
function titleMatches(label){
  const title=compact(document.querySelector('#pageTitle')?.textContent);
  const expected=compact(label);
  return Boolean(title&&expected&&(title===expected||title.includes(expected)||expected.includes(title)||(expected==='کاربرانودسترسیها'&&title.includes('کاربران')&&title.includes('دسترسی'))));
}
function isAdmin(){
  return /مدیر|ادمین/.test(normalize(document.querySelector('#sidebarRole')?.textContent||document.querySelector('#topRole')?.textContent));
}
function directAdminFallback(source,label){
  if(!isAdmin()||typeof window.renderModule!=='function')return false;
  try{
    syncActive(source);
    window.renderModule({},[iconKey(label),label]);
    return true;
  }catch{return false;}
}
function activateSource(source,label){
  const token=++routeToken;
  closeTransient();
  syncActive(source);
  try{HTMLElement.prototype.click.call(source);}catch{
    try{source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}));}catch{}
  }
  setTimeout(()=>{
    if(token!==routeToken)return;
    if(!titleMatches(label)){
      try{source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}));}catch{}
    }
  },80);
  setTimeout(()=>{
    if(token!==routeToken)return;
    if(!titleMatches(label))directAdminFallback(source,label);
    closeTransient();
    window.scrollTo({top:0,left:0,behavior:'auto'});
    window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-complete',{detail:{label}}));
    schedule();
  },220);
}
function resolveButton(button){
  const sources=sourceButtons();
  const explicit=decodeURIComponent(button.dataset.v4Route||button.dataset.mobileRoute||'');
  if(explicit){
    const found=sources.find((source,index)=>routeOf(source,index)===explicit);
    if(found)return {source:found,label:labelOf(found)};
  }
  const rawIndex=button.dataset.navIndex??button.dataset.sourceIndex;
  if(rawIndex!==undefined){
    const index=Number(rawIndex);
    if(Number.isInteger(index)&&sources[index])return {source:sources[index],label:labelOf(sources[index])};
  }
  const label=canonical(normalize(button.textContent));
  const source=sources.find(item=>compact(labelOf(item))===compact(label));
  return source?{source,label:labelOf(source)}:null;
}
function onNavigationClick(event){
  const target=event.target;
  if(!(target instanceof Element))return;
  const button=target.closest(`#${NAV_ID} button`);
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(button.matches('[data-v4-more],[data-mobile-more],[data-more="true"]')){openMore();return;}
  const resolved=resolveButton(button);
  if(!resolved){schedule();return;}
  activateSource(resolved.source,resolved.label);
}
document.addEventListener('click',onNavigationClick,true);

function rebuild(){
  const navigation=claimNavigation();
  if(!navigation||!media.matches||!appVisible())return;
  const sources=sourceButtons();
  if(!sources.length)return;
  const active=activeSource();
  const primary=sources.slice(0,4);
  const signature=sources.map((source,index)=>`${routeOf(source,index)}:${source===active}`).join('|');
  const valid=navigation.querySelectorAll('button[data-v4-route]').length===primary.length&&Boolean(navigation.querySelector('button[data-v4-more]'));
  if(navigation.dataset.v4Signature===signature&&valid)return;
  navigation.dataset.v4Signature=signature;
  navigation.innerHTML=primary.map((source,index)=>{
    const route=routeOf(source,index);
    const label=labelOf(source);
    const on=source===active;
    return `<button type="button" data-v4-route="${encodeURIComponent(route)}" class="${on?'active':''}" aria-label="${label.replace(/"/g,'&quot;')}" aria-current="${on?'page':'false'}">${icon(iconKey(label))}<span>${label}</span></button>`;
  }).join('')+`<button type="button" data-v4-more="true" aria-label="نمایش همه ماژول‌ها">${icon('more')}<span>بیشتر</span></button>`;
}
function sync(){
  repairShell();
  const visible=media.matches&&appVisible()&&!document.documentElement.classList.contains('salamat-history-landing');
  const navigation=document.getElementById(NAV_ID);
  navigation?.setAttribute('aria-hidden',visible?'false':'true');
  if(!visible)return;
  rebuild();
}
function schedule(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(sync);
}

media.addEventListener?.('change',schedule);
window.addEventListener('pageshow',schedule);
window.addEventListener('orientationchange',()=>setTimeout(schedule,80));
window.addEventListener('salamat-authenticated',schedule);
window.addEventListener('salamat-shell-ready',schedule);
window.addEventListener('salamat-access-changed',schedule);
window.addEventListener('salamat-history-restored',schedule);
window.addEventListener('salamat-history-pushed',schedule);
window.addEventListener('salamat-mobile-menu-closed',schedule);
window.addEventListener('salamat-mobile-navigation-complete',schedule);
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','disabled','data-index','data-route','data-module','data-module-key']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

window.SalamatMobileNavigation={
  version:VERSION,
  sync:schedule,
  navigate(label){
    const canonicalLabel=canonical(label);
    const source=sourceButtons().find(item=>compact(labelOf(item))===compact(canonicalLabel));
    if(!source)return false;
    activateSource(source,labelOf(source));
    return true;
  },
  openMore,
  routes(){return sourceButtons().map((source,index)=>({route:routeOf(source,index),label:labelOf(source),index}));}
};
})();