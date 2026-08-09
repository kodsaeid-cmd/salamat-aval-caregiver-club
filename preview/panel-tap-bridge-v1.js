(()=>{
'use strict';
if(window.__salamatPanelTapBridgeV1)return;
window.__salamatPanelTapBridgeV1=true;

const VERSION='1.1.0';
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
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

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
  const node=document.querySelector('#appView');
  return Boolean(MEDIA.matches&&node&&!node.classList.contains('hidden')&&node.getAttribute('aria-hidden')!=='true');
}
function panelType(){
  return String(window.SalamatAccessControl?.panelType||window.SalamatStaffModuleRouter?.access?.panel||window.__salamatResolvedPanel||'').toUpperCase();
}
function isStaffPanel(){return panelType()==='STAFF'}
function sourceButtons(){
  return [...document.querySelectorAll(SOURCE_SELECTOR)].filter(node=>node instanceof HTMLElement&&!node.disabled&&!node.hidden&&node.getAttribute('aria-hidden')!=='true');
}
function labelOf(node){
  if(!node)return'';
  const explicit=node.getAttribute?.('aria-label')||node.dataset?.label;
  if(explicit)return normalize(explicit);
  const clone=node.cloneNode(true);
  clone.querySelectorAll?.('b,[data-icon],svg,.badge,.count').forEach(child=>child.remove());
  return normalize(clone.textContent);
}
function aliasesFor(label){
  const value=compact(label);
  if(value==='خانه'||value.includes('داشبورد'))return['داشبورد','داشبورد مدیریتی','داشبورد کاربر','داشبورد مراقب','خانه'];
  if(value.includes('کاربر')||value.includes('دسترسی'))return['کاربران و دسترسی‌ها','کاربران','مدیریت کاربران','نقش‌ها و دسترسی‌ها'];
  if(value.includes('مراقب')||value.includes('پرونده'))return['پرونده مراقبین','مراقبین','مدیریت مراقبین'];
  if(value.includes('قرارداد'))return['قراردادها','قرارداد'];
  if(value.includes('حقوق')||value.includes('پرداخت')||value.includes('فیش'))return['حقوق و پرداخت','حقوق و دستمزد','حقوق و فیش حقوقی'];
  if(value.includes('اعتبار')||value.includes('مالی')||value.includes('کیفپول'))return['اعتبارات مالی','کیف پول','اعتبارات'];
  if(value.includes('آموزش')||value.includes('دوره'))return['بانک آموزش','آموزش','آموزش‌های من'];
  if(value.includes('ارزیابی')||value.includes('پروانه')||value.includes('کارنامه')||value.includes('رتبه'))return['ارزیابی و پروانه','پایش و امتیازات','کارنامه کاری','درجه و رتبه'];
  if(value.includes('پشتیبان')||value.includes('امنیت'))return['پشتیبانی','پشتیبانی و امنیت','پشتیبانی پرونده'];
  if(value.includes('تنظیم')||value.includes('لاگ'))return['تنظیمات و لاگ','تنظیمات سامانه','تنظیمات'];
  if(value.includes('پروفایل')||value.includes('حساب'))return['پروفایل من','پروفایل','اطلاعات پروفایل','حساب کاربری'];
  return[normalize(label)];
}
function sourceFor(label){
  const wanted=aliasesFor(label).map(compact).filter(Boolean);
  if(!wanted.length)return null;
  const sources=sourceButtons();
  return sources.find(node=>wanted.includes(compact(labelOf(node))))
    ||sources.find(node=>{
      const value=compact(labelOf(node));
      return value&&wanted.some(alias=>value.includes(alias)||alias.includes(value));
    })||null;
}
function routeKey(source,label){
  const mapped=ROUTES.get(compact(label));
  if(mapped)return mapped;
  const datasetKey=source?.dataset?.panelModuleKey||source?.dataset?.accessModule||source?.dataset?.moduleKey||'';
  return String(datasetKey).startsWith('staff.')?datasetKey:'';
}
function closeTransient(){
  try{window.SalamatMobileShell?.close?.()}catch{}
  document.querySelector('#sidebar')?.classList.remove('open');
  document.body?.classList.remove('salamat-mobile-nav-open');
  document.documentElement?.classList.remove('salamat-mobile-menu-visible');
  const backdrop=document.getElementById('mobileSidebarBackdrop');
  backdrop?.classList.remove('open');
  backdrop?.setAttribute('aria-hidden','true');
}
function finish(label){
  closeTransient();
  requestAnimationFrame(()=>{
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
    window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-complete',{detail:{label,bridgeVersion:VERSION}}));
  });
}
function initials(name){
  const parts=normalize(name).split(' ').filter(Boolean);
  return ((parts[0]?.[0]||'ک')+(parts[1]?.[0]||'')).slice(0,2);
}
function roleLabel(user){return user?.roleLabel||({ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'}[String(user?.role||'').toUpperCase()]||'کاربر سازمانی')}
function staffProfilePage(){
  const access=window.SalamatStaffModuleRouter?.access||{};
  const session=window.SalamatBackend?.getCurrentUser?.()||{};
  const user={...session,...(access.user||{})};
  const name=user.fullName||user.name||document.querySelector('#sidebarName')?.textContent?.trim()||'کاربر سلامت اول';
  const role=roleLabel(user);
  const modules=(access.modules||[]).filter(item=>item.panel==='STAFF'&&item.actions?.view);
  const title=document.querySelector('#pageTitle'),subtitle=document.querySelector('#pageSubtitle'),content=document.querySelector('#content');
  if(title)title.textContent='پروفایل';
  if(subtitle)subtitle.textContent='اطلاعات حساب و دسترسی سازمانی شما';
  if(!content)return false;
  content.classList.remove('sa-mobile-home-active');
  const rows=[
    ['نام و نام خانوادگی',name],
    ['نقش سازمانی',role],
    ['نام کاربری',user.username||user.identifier||'—'],
    ['ایمیل',user.email||'—'],
    ['شماره همراه',user.mobile||user.phone||'—'],
    ['شناسه حساب',user.id||user.userId||'—']
  ];
  content.innerHTML=`<section class="module-page sa-account-profile"><header class="sa-account-head"><span class="sa-account-avatar">${esc(initials(name))}</span><div><small>حساب فعال</small><h2>${esc(name)}</h2><p>${esc(role)}</p></div></header><section class="sa-account-card"><h3>اطلاعات حساب</h3>${rows.map(([label,value])=>`<div class="sa-account-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</section><section class="sa-account-card"><h3>دسترسی‌های فعال</h3><div class="sa-account-access">${modules.length?modules.map(module=>`<span>${esc(module.label)}</span>`).join(''):'<small>دسترسی سازمانی فعالی برای نمایش ثبت نشده است.</small>'}</div></section><button class="sa-account-home" type="button" data-sa-profile-home>بازگشت به خانه</button></section>`;
  finish('پروفایل');
  return true;
}
async function openProfile(){
  const source=sourceFor('پروفایل');
  if(source){
    try{HTMLElement.prototype.click.call(source);finish('پروفایل');return true}catch{}
  }
  if(isStaffPanel())return staffProfilePage();
  try{
    if(typeof window.renderModule==='function'){
      const role=window.roles?.caregiver||{};
      window.renderModule(role,['account','پروفایل من']);
      finish('پروفایل');
      return true;
    }
  }catch{}
  return false;
}
async function openLabel(label){
  const clean=normalize(label);
  if(!clean)return false;
  if(compact(clean).includes('پروفایل')||compact(clean).includes('حسابکاربری'))return openProfile();
  const source=sourceFor(clean);
  const key=routeKey(source,clean);
  const router=window.SalamatStaffModuleRouter;

  if(isStaffPanel()&&key&&typeof router?.route==='function'){
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
    }catch{
      try{
        source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}));
        finish(clean);
        return true;
      }catch{}
    }
  }

  if(isStaffPanel()&&typeof window.renderModule==='function'){
    try{
      window.renderModule({},['home',clean]);
      finish(clean);
      return true;
    }catch{}
  }
  return false;
}
function cardLabel(card){return normalize(card?.dataset?.label||card?.getAttribute?.('aria-label')||card?.querySelector?.('span:last-child')?.textContent||card?.textContent)}
function navLabel(button){return normalize(button?.dataset?.label||button?.getAttribute?.('aria-label')||button?.querySelector?.('span:last-child')?.textContent||button?.textContent)}
function onClick(event){
  if(!appVisible())return;
  const target=event.target;
  if(!(target instanceof Element))return;

  const profileHome=target.closest('[data-sa-profile-home]');
  if(profileHome){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openLabel('خانه');return}

  const card=target.closest(`#${HOME_ID} .sa-home-module`);
  if(card){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openLabel(cardLabel(card));return}

  const navButton=target.closest(`#${BOTTOM_ID} button`);
  if(navButton){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const label=navLabel(navButton);
    if(compact(label).includes('پروفایل'))void openProfile();else void openLabel(label);
    return;
  }

  const avatar=target.closest('.sa-mobile-header-avatar');
  if(avatar){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openProfile()}
}

function addHitAreaStyles(){
  if(document.getElementById('salamatPanelTapBridgeV1Styles'))return;
  const style=document.createElement('style');
  style.id='salamatPanelTapBridgeV1Styles';
  style.textContent=`@media(max-width:760px){#${HOME_ID} .sa-home-module,#${BOTTOM_ID} button,.sa-mobile-header-avatar{pointer-events:auto!important;touch-action:manipulation!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent}#${HOME_ID} .sa-home-module>*,#${BOTTOM_ID} button>*{pointer-events:none!important}.sa-account-profile{direction:rtl;display:grid;gap:12px}.sa-account-head{display:flex;align-items:center;gap:14px;padding:18px;border:1px solid #dce9e2;border-radius:24px;background:linear-gradient(145deg,#fff,#f4faf6);box-shadow:0 12px 28px rgba(22,61,43,.06)}.sa-account-avatar{width:66px;height:66px;min-width:66px;border-radius:21px;background:linear-gradient(145deg,#08743f,#0b9253);color:#fff;display:grid;place-items:center;font-size:19px;font-weight:950;box-shadow:0 10px 24px rgba(8,116,63,.18)}.sa-account-head small{display:block;color:#078848;font-size:8px;font-weight:900}.sa-account-head h2{margin:4px 0 0;font-size:18px;color:#1d2b24}.sa-account-head p{margin:5px 0 0;color:#75827b;font-size:10px}.sa-account-card{padding:16px;border:1px solid #dfeae4;border-radius:21px;background:#fff;box-shadow:0 9px 24px rgba(22,61,43,.045)}.sa-account-card h3{margin:0 0 11px;font-size:13px}.sa-account-row{display:grid;grid-template-columns:110px minmax(0,1fr);gap:9px;padding:10px 0;border-bottom:1px solid #edf2ef}.sa-account-row:last-child{border-bottom:0}.sa-account-row span{color:#7b8882;font-size:9px}.sa-account-row strong{min-width:0;color:#26382f;font-size:10px;overflow-wrap:anywhere}.sa-account-access{display:flex;flex-wrap:wrap;gap:7px}.sa-account-access span{padding:7px 9px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:8.5px;font-weight:900}.sa-account-access small{color:#7a8981;font-size:9px}.sa-account-home{min-height:48px;border:0;border-radius:16px;background:#08743f;color:#fff;font:900 11px/1.2 inherit;touch-action:manipulation;cursor:pointer}}`;
  (document.head||document.documentElement).appendChild(style);
}

document.addEventListener('click',onClick,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHitAreaStyles,{once:true});else addHitAreaStyles();
window.SalamatPanelTapBridge={version:VERSION,openLabel,openProfile};
})();
