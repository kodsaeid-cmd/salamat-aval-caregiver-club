(()=>{
'use strict';
if(window.__salamatPanelTapBridgeV1)return;
window.__salamatPanelTapBridgeV1=true;

const VERSION='1.0.0';
const HOME_ID='salamatMobileHomeV2';
const BOTTOM_ID='salamatMobileUnifiedBottomNavV2';
const MEDIA=window.matchMedia('(max-width:760px)');
const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';

const normalize=value=>String(value||'')
  .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
  .replace(/[يى]/g,'ی')
  .replace(/ك/g,'ک')
  .replace(/\s+/g,' ')
  .trim();
const compact=value=>normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase();

const ROUTES=new Map([
  ['داشبوردمدیریتی','staff.dashboard'],['داشبورد','staff.dashboard'],['خانه','staff.dashboard'],
  ['کاربرانودسترسیها','staff.users'],['مدیریتکاربران','staff.users'],
  ['پروندهمراقبین','staff.caregivers'],['مراقبین','staff.caregivers'],
  ['قراردادها','staff.contracts'],['قرارداد','staff.contracts'],
  ['حقوقوپرداخت','staff.payroll'],['حقوقودستمزد','staff.payroll'],
  ['اعتباراتمالی','staff.financial_credits'],
  ['بانکآموزش','staff.training'],['آموزش','staff.training'],
  ['ارزیابیوپروانه','staff.evaluations'],['پایشوامتیازات','staff.evaluations'],
  ['پشتیبانی','staff.support'],['پشتیبانیوامنیت','staff.support'],
  ['تنظیماتولاگ','staff.settings'],['تنظیماتسامانه','staff.settings']
]);

function appVisible(){
  const app=document.querySelector('#appView');
  return Boolean(MEDIA.matches&&app&&!app.classList.contains('hidden')&&app.getAttribute('aria-hidden')!=='true');
}
function sourceButtons(){
  return [...document.querySelectorAll(SOURCE_SELECTOR)].filter(node=>node instanceof HTMLElement&&!node.disabled);
}
function labelOf(node){
  if(!node)return'';
  const explicit=node.getAttribute?.('aria-label')||node.dataset?.label;
  if(explicit)return normalize(explicit);
  return normalize(node.textContent);
}
function sourceFor(label){
  const wanted=compact(label);
  if(!wanted)return null;
  const sources=sourceButtons();
  return sources.find(node=>compact(labelOf(node))===wanted)
    ||sources.find(node=>{
      const value=compact(labelOf(node));
      return value&&wanted&&(value.includes(wanted)||wanted.includes(value));
    })||null;
}
function routeKey(source,label){
  return source?.dataset?.panelModuleKey
    ||source?.dataset?.accessModule
    ||source?.dataset?.moduleKey
    ||ROUTES.get(compact(label))
    ||'';
}
function closeTransient(){
  try{window.SalamatMobileShell?.close?.()}catch{}
  document.querySelector('#sidebar')?.classList.remove('open');
  document.body?.classList.remove('salamat-mobile-nav-open');
  document.getElementById('mobileSidebarBackdrop')?.classList.remove('open');
}
function finish(label){
  closeTransient();
  requestAnimationFrame(()=>{
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
    window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-complete',{detail:{label,bridgeVersion:VERSION}}));
  });
}
async function openLabel(label){
  const clean=normalize(label);
  if(!clean)return false;
  const source=sourceFor(clean);
  const key=routeKey(source,clean);
  const router=window.SalamatStaffModuleRouter;

  if(key&&typeof router?.route==='function'){
    try{
      await Promise.resolve(router.route(key));
      finish(clean);
      return true;
    }catch(error){
      console.warn('Panel tap bridge canonical route failed',key,error);
    }
  }

  if(source){
    try{
      HTMLElement.prototype.click.call(source);
      finish(clean);
      return true;
    }catch(error){
      try{
        source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}));
        finish(clean);
        return true;
      }catch{}
    }
  }

  if(typeof window.renderModule==='function'){
    try{
      window.renderModule({},['home',clean]);
      finish(clean);
      return true;
    }catch{}
  }
  return false;
}
function cardLabel(card){
  return normalize(card?.dataset?.label||card?.getAttribute?.('aria-label')||card?.querySelector?.('span:last-child')?.textContent||card?.textContent);
}
function navLabel(button){
  return normalize(button?.dataset?.label||button?.getAttribute?.('aria-label')||button?.querySelector?.('span:last-child')?.textContent||button?.textContent);
}
function onClick(event){
  if(!appVisible())return;
  const target=event.target;
  if(!(target instanceof Element))return;

  const card=target.closest(`#${HOME_ID} .sa-home-module`);
  if(card){
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void openLabel(cardLabel(card));
    return;
  }

  const navButton=target.closest(`#${BOTTOM_ID} button`);
  if(navButton){
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const label=navLabel(navButton);
    void openLabel(compact(label)==='خانه'?'داشبورد مدیریتی':label);
    return;
  }

  const avatar=target.closest('.sa-mobile-header-avatar');
  if(avatar){
    const profile=sourceFor('پروفایل')||sourceFor('اطلاعات پروفایل')||sourceFor('حساب کاربری');
    if(!profile)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    try{HTMLElement.prototype.click.call(profile)}catch{}
  }
}

function addHitAreaStyles(){
  if(document.getElementById('salamatPanelTapBridgeV1Styles'))return;
  const style=document.createElement('style');
  style.id='salamatPanelTapBridgeV1Styles';
  style.textContent=`@media(max-width:760px){#${HOME_ID} .sa-home-module,#${BOTTOM_ID} button,.sa-mobile-header-avatar{pointer-events:auto!important;touch-action:manipulation!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent}#${HOME_ID} .sa-home-module>* ,#${BOTTOM_ID} button>*{pointer-events:none!important}}`;
  (document.head||document.documentElement).appendChild(style);
}

document.addEventListener('click',onClick,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHitAreaStyles,{once:true});else addHitAreaStyles();
window.SalamatPanelTapBridge={version:VERSION,openLabel};
})();
