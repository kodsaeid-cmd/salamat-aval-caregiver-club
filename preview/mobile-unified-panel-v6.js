(()=>{
'use strict';
if(window.__salamatUnifiedMobilePanelV6)return;
window.__salamatUnifiedMobilePanelV6=true;

const VERSION='6.0.0';
const MEDIA=window.matchMedia('(max-width:760px)');
const HISTORY_KEY='__salamatMobilePanelV6';
const HEADER_ID='salamatUnifiedMobileHeaderV6';
const NAV_ID='salamatUnifiedMobileNavV6';
const DASH_ID='salamatUnifiedMobileDashboardV6';
const SHEET_ID='salamatUnifiedMobileProfileV6';
const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button';

let frame=0;
let observer=null;
let ownedSession=false;
let exiting=false;
let restoring=false;
let routeToken=0;
let lastTap=0;

const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const normalize=value=>String(value||'')
 .replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
 .replace(/[يى]/g,'ی').replace(/ك/g,'ک')
 .replace(/\s+/g,' ').trim();
const compact=value=>normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const app=()=>$('#appView');
const login=()=>$('#loginView');
const appVisible=()=>Boolean(app()&&!app().classList.contains('hidden'));
const backendRole=()=>normalize(window.SalamatBackend?.getCurrentUser?.()?.role||window.selectedRole||'').toUpperCase();

function sourceButtons(){
 return $$(SOURCE_SELECTOR).filter(button=>{
   if(!(button instanceof HTMLElement)||button.disabled||button.hidden)return false;
   if(button.classList.contains('hidden')||button.getAttribute('aria-hidden')==='true')return false;
   return true;
 });
}
function sourceLabel(source){
 if(!source)return'';
 const explicit=normalize(source.getAttribute('aria-label')||source.dataset.label);
 if(explicit)return explicit;
 const clone=source.cloneNode(true);
 clone.querySelectorAll('b,[data-icon],svg,.badge,.count').forEach(node=>node.remove());
 return normalize(clone.textContent).slice(0,80);
}
function sourceKey(source){
 if(!source)return'';
 const data=source.dataset||{};
 return normalize(data.caregiverModuleKey||data.panelModuleKey||data.accessModule||data.moduleKey||data.module||data.route||data.view||data.key||source.id);
}
function sourceModel(source){return {source,key:sourceKey(source),label:sourceLabel(source)}}
function models(){return sourceButtons().map(sourceModel).filter(item=>item.key||item.label)}
function isHome(item){const key=compact(item?.key),label=compact(item?.label);return key.endsWith('dashboard')||label.includes('داشبورد')}
function homeModel(){return models().find(isHome)||models()[0]||null}
function activeModel(){
 const list=models();
 return list.find(item=>item.source.classList.contains('active')||item.source.getAttribute('aria-current')==='page')
   ||list.find(item=>normalize($('#pageTitle')?.textContent).includes(item.label))
   ||homeModel();
}
function caregiverPanel(){
 const role=backendRole();
 if(role==='CAREGIVER'||normalize($('#sidebarRole')?.textContent).includes('مراقب'))return true;
 return models().some(item=>item.key.startsWith('caregiver.'));
}

const ICONS={
 profile:['circle|12|8|4','path|M4 22a8 8 0 0 1 16 0'],
 home:['path|m3 11 9-8 9 8','path|M5 10v10h14V10M9 20v-6h6v6'],
 back:['path|M19 12H5','path|m12 19-7-7 7-7'],
 more:['circle|5|12|1.4','circle|12|12|1.4','circle|19|12|1.4'],
 generic:['rect|3|3|18|18|4','path|M8 8h8M8 12h8M8 16h5'],
};
function fallbackIcon(kind='generic'){
 const wrap=document.createElement('span');wrap.className='mp6-icon';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 for(const spec of ICONS[kind]||ICONS.generic){
   const parts=spec.split('|'),type=parts.shift();const node=document.createElementNS('http://www.w3.org/2000/svg',type);
   if(type==='path')node.setAttribute('d',parts.join('|'));
   if(type==='circle'){node.setAttribute('cx',parts[0]);node.setAttribute('cy',parts[1]);node.setAttribute('r',parts[2]);}
   if(type==='rect'){node.setAttribute('x',parts[0]);node.setAttribute('y',parts[1]);node.setAttribute('width',parts[2]);node.setAttribute('height',parts[3]);node.setAttribute('rx',parts[4]);}
   svg.appendChild(node);
 }
 wrap.appendChild(svg);return wrap;
}
function cloneIcon(source,kind='generic'){
 const original=source?.querySelector?.('[data-icon],svg');if(!original)return fallbackIcon(kind);
 const wrap=document.createElement('span');wrap.className='mp6-icon';wrap.appendChild(original.cloneNode(true));return wrap;
}
function el(tag,className='',text=''){const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node}

function addStyles(){
 if($('#salamatUnifiedMobilePanelV6Styles'))return;
 const style=document.createElement('style');style.id='salamatUnifiedMobilePanelV6Styles';style.textContent=`
#${HEADER_ID},#${NAV_ID},#${DASH_ID},#${SHEET_ID}{display:none}
@media(max-width:760px){
 html.salamat-mobile-panel-v6{--mp6-green:#185B38;--mp6-green-dark:#123F2A;--mp6-green-soft:#EAF2ED;--mp6-red:#D83429;--mp6-red-soft:#FCECEA;--mp6-canvas:#F4F7F5;--mp6-ink:#173128;--mp6-muted:#718078;--mp6-line:#DFE8E3}
 html.salamat-mobile-panel-v6,html.salamat-mobile-panel-v6 body{background:var(--mp6-canvas)!important;color:var(--mp6-ink)!important;max-width:100%!important;overflow-x:hidden!important}
 html.salamat-mobile-panel-v6 #salamatMobileAppHeader,html.salamat-mobile-panel-v6 #salamatMobileBottomNav,html.salamat-mobile-panel-v6 #salamatCaregiverHeaderV5,html.salamat-mobile-panel-v6 #salamatCaregiverBottomNavV5,html.salamat-mobile-panel-v6 #salamatCaregiverDashboardV5,html.salamat-mobile-panel-v6 #salamatCaregiverBackV51{display:none!important;visibility:hidden!important;pointer-events:none!important}
 html.salamat-mobile-panel-v6 #appView.app{display:block!important;visibility:visible!important;pointer-events:auto!important;min-height:100dvh!important;background:var(--mp6-canvas)!important}
 html.salamat-mobile-panel-v6 #loginView{display:none!important;visibility:hidden!important;pointer-events:none!important}
 html.salamat-mobile-panel-v6 .topbar{display:none!important}
 html.salamat-mobile-panel-v6 .main-area{display:block!important;width:100%!important;min-width:0!important;min-height:100dvh!important;padding-top:calc(72px + env(safe-area-inset-top))!important;padding-bottom:calc(98px + env(safe-area-inset-bottom))!important;background:var(--mp6-canvas)!important;visibility:visible!important;pointer-events:auto!important}
 html.salamat-mobile-panel-v6 #content.content{box-sizing:border-box!important;width:100%!important;max-width:100%!important;margin:0!important;padding:14px 12px 28px!important;overflow-x:hidden!important;background:var(--mp6-canvas)!important}
 html.salamat-mobile-panel-v6 #sidebar.sidebar:not(.open){visibility:hidden!important;pointer-events:none!important}
 #${HEADER_ID}{position:fixed;z-index:420;top:0;right:0;left:0;height:calc(64px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 14px 0;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:9px;border-bottom:1px solid rgba(24,91,56,.10);background:rgba(255,255,255,.97);box-shadow:0 8px 28px rgba(18,63,42,.07);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
 #${HEADER_ID}:after{content:'';position:absolute;right:15px;bottom:-1px;width:42px;height:3px;border-radius:99px;background:linear-gradient(90deg,var(--mp6-red) 0 42%,var(--mp6-green) 42% 100%)}
 #${HEADER_ID} .mp6-back,#${HEADER_ID} .mp6-profile{width:42px;height:42px;padding:0;border:1px solid rgba(24,91,56,.08);border-radius:14px;display:grid;place-items:center;background:var(--mp6-green-soft);color:var(--mp6-green);touch-action:manipulation}
 #${HEADER_ID} .mp6-back[hidden]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
 #${HEADER_ID} .mp6-back .mp6-icon,#${HEADER_ID} .mp6-profile .mp6-icon{width:22px;height:22px;background:transparent!important;box-shadow:none!important}
 #${HEADER_ID} .mp6-copy{min-width:0;text-align:center}#${HEADER_ID} .mp6-copy strong,#${HEADER_ID} .mp6-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HEADER_ID} .mp6-copy strong{color:var(--mp6-ink);font-size:13px;font-weight:950}#${HEADER_ID} .mp6-copy small{margin-top:3px;color:var(--mp6-muted);font-size:8.5px;font-weight:750}
 #${NAV_ID}{position:fixed;z-index:430;right:9px;left:9px;bottom:calc(8px + env(safe-area-inset-bottom));height:76px;padding:7px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:3px;direction:rtl;border:1px solid rgba(24,91,56,.12);border-radius:26px;background:rgba(255,255,255,.98);box-shadow:0 18px 48px rgba(18,63,42,.20);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);isolation:isolate}
 #${NAV_ID} button{position:relative;height:60px;min-width:0;padding:4px 2px;border:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:transparent;color:#78867f;font:inherit;font-size:8px;font-weight:900;line-height:1.2;touch-action:manipulation;-webkit-tap-highlight-color:transparent;pointer-events:auto}#${NAV_ID} button:active{transform:scale(.94)}#${NAV_ID} button.active:not(.home){color:var(--mp6-green);background:linear-gradient(180deg,#F6F9F7,var(--mp6-green-soft));box-shadow:inset 0 0 0 1px rgba(24,91,56,.08)}#${NAV_ID} button.active:not(.home):after{content:'';position:absolute;top:4px;left:50%;width:5px;height:5px;border-radius:50%;background:var(--mp6-red);transform:translateX(-50%)}
 #${NAV_ID} button .mp6-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:11px;color:var(--mp6-green);background:var(--mp6-green-soft);box-shadow:inset 0 0 0 1px rgba(24,91,56,.07)}#${NAV_ID} button .mp6-icon svg,#${HEADER_ID} .mp6-icon svg,#${DASH_ID} .mp6-icon svg{width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}#${NAV_ID} button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #${NAV_ID} button.home{transform:translateY(-14px);color:var(--mp6-green)}#${NAV_ID} button.home:active{transform:translateY(-14px) scale(.94)}#${NAV_ID} button.home .mp6-home-circle{position:relative;width:59px;height:59px;display:grid;place-items:center;border:5px solid var(--mp6-canvas);border-radius:50%;background:linear-gradient(145deg,var(--mp6-green),var(--mp6-green-dark));color:#fff;box-shadow:0 12px 28px rgba(24,91,56,.30)}#${NAV_ID} button.home .mp6-home-circle:after{content:'';position:absolute;top:2px;right:5px;width:9px;height:9px;border:3px solid #fff;border-radius:50%;background:var(--mp6-red)}#${NAV_ID} button.home .mp6-home-circle .mp6-icon{width:26px;height:26px;color:#fff;background:transparent;box-shadow:none}#${NAV_ID} button.home>span:last-child{margin-top:-3px;color:var(--mp6-green);font-weight:950}
 #${DASH_ID}{display:block;margin:0 0 16px;padding:17px 14px 16px;border:1px solid rgba(24,91,56,.07);border-radius:25px;background:#fff;box-shadow:0 10px 30px rgba(18,63,42,.07)}#${DASH_ID} .mp6-welcome{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px;padding:0 2px}#${DASH_ID} .mp6-welcome strong{display:block;color:var(--mp6-ink);font-size:16px;font-weight:950}#${DASH_ID} .mp6-welcome small{display:block;margin-top:5px;color:var(--mp6-muted);font-size:9px;line-height:1.8}#${DASH_ID} .mp6-brand-dot{width:9px;height:9px;flex:0 0 9px;margin-top:7px;border-radius:50%;background:var(--mp6-red);box-shadow:0 0 0 5px var(--mp6-red-soft)}
 #${DASH_ID} .mp6-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 8px}#${DASH_ID} .mp6-module{min-width:0;padding:0;border:0;display:flex;flex-direction:column;align-items:center;gap:7px;background:transparent;color:var(--mp6-ink);font:inherit;touch-action:manipulation}#${DASH_ID} .mp6-module:active{transform:scale(.96)}#${DASH_ID} .mp6-module .mp6-tile{position:relative;width:67px;height:67px;display:grid;place-items:center;border:1px solid rgba(24,91,56,.08);border-radius:22px;background:linear-gradient(145deg,#F7FAF8,var(--mp6-green-soft));color:var(--mp6-green);box-shadow:0 8px 18px rgba(18,63,42,.07)}#${DASH_ID} .mp6-module:nth-child(4n+2) .mp6-tile:after{content:'';position:absolute;top:8px;left:8px;width:6px;height:6px;border-radius:50%;background:var(--mp6-red)}#${DASH_ID} .mp6-module .mp6-icon{width:28px;height:28px;display:grid;place-items:center;background:transparent;color:inherit}#${DASH_ID} .mp6-module .mp6-icon svg{width:25px;height:25px}#${DASH_ID} .mp6-module>span:last-child{width:100%;min-height:28px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#42544a;font-size:8.5px;font-weight:850;line-height:1.65;text-align:center}
 html.salamat-mobile-panel-v6 .surface,html.salamat-mobile-panel-v6 .module-page,html.salamat-mobile-panel-v6 .adm-module,html.salamat-mobile-panel-v6 .cgr3-card,html.salamat-mobile-panel-v6 .ev-card{max-width:100%!important;border-radius:20px!important}html.salamat-mobile-panel-v6 .role-hero,html.salamat-mobile-panel-v6 .adm-hero,html.salamat-mobile-panel-v6 .caregiver-hero-panel,html.salamat-mobile-panel-v6 .cgr3-dashboard-hero,html.salamat-mobile-panel-v6 .cp-page-head,html.salamat-mobile-panel-v6 .ev-page-head{border-radius:23px!important;background:linear-gradient(145deg,var(--mp6-green),var(--mp6-green-dark))!important;box-shadow:0 15px 34px rgba(24,91,56,.18)!important}html.salamat-mobile-panel-v6 .btn.primary,html.salamat-mobile-panel-v6 button.primary{background:var(--mp6-green)!important;border-color:var(--mp6-green)!important}html.salamat-mobile-panel-v6 .btn.danger,html.salamat-mobile-panel-v6 button.danger{background:var(--mp6-red)!important;border-color:var(--mp6-red)!important}
 #${SHEET_ID}{position:fixed;z-index:500;inset:0;display:none;align-items:flex-end;background:rgba(13,37,24,.38);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}#${SHEET_ID}.open{display:flex}#${SHEET_ID} .mp6-sheet{width:100%;padding:14px 16px calc(18px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:#fff;box-shadow:0 -18px 45px rgba(18,63,42,.18)}#${SHEET_ID} .mp6-sheet-handle{width:42px;height:4px;margin:0 auto 17px;border-radius:99px;background:#dbe4df}#${SHEET_ID} .mp6-profile-card{display:grid;grid-template-columns:56px minmax(0,1fr) 42px;align-items:center;gap:12px;padding:13px;border-radius:19px;background:var(--mp6-green-soft)}#${SHEET_ID} .mp6-profile-mark{width:56px;height:56px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,var(--mp6-green),var(--mp6-green-dark));color:#fff}#${SHEET_ID} .mp6-profile-mark .mp6-icon{width:26px;height:26px;color:#fff;background:transparent}#${SHEET_ID} .mp6-profile-card strong,#${SHEET_ID} .mp6-profile-card small{display:block}#${SHEET_ID} .mp6-profile-card strong{font-size:13px;color:var(--mp6-ink)}#${SHEET_ID} .mp6-profile-card small{margin-top:4px;font-size:9px;color:var(--mp6-muted)}#${SHEET_ID} .mp6-sheet-close{width:42px;height:42px;border:0;border-radius:14px;background:#fff;color:var(--mp6-green);font-size:20px}#${SHEET_ID} .mp6-sheet-note{margin:13px 2px 0;color:var(--mp6-muted);font-size:9px;line-height:1.9}
}
`;(document.head||document.documentElement).appendChild(style);
}

function roleTitle(){
 const explicit=normalize($('#sidebarRole')?.textContent||$('#topRole')?.textContent);if(explicit&&explicit!=='کاربر')return explicit;
 const map={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبانی',EVALUATOR:'ارزیاب',EDUCATION:'آموزش',OPERATIONS:'عملیات',CAREGIVER:'مراقب'};return map[backendRole()]||'کاربر سلامت اول';
}
function userName(){return normalize($('#sidebarName')?.textContent||$('#topName')?.textContent||window.SalamatBackend?.getCurrentUser?.()?.fullName||'کاربر سلامت اول')}
function claimSurface(){
 if(!MEDIA.matches||!ownedSession||exiting)return;
 const html=document.documentElement,body=document.body;html.classList.add('salamat-mobile-panel-v6');body?.classList.add('salamat-mobile-panel-v6');html.classList.remove('salamat-history-landing','salamat-mobile-menu-visible');body?.classList.remove('salamat-history-landing','salamat-mobile-nav-open');
 if(app()){app().classList.remove('hidden');app().removeAttribute('aria-hidden')}if(login()){login().classList.add('hidden');login().setAttribute('aria-hidden','true')}
 const main=$('.main-area');if(main){main.removeAttribute('aria-hidden');try{main.inert=false}catch{}}window.SalamatMobileShell?.close?.({restoreFocus:false});
}
function bindAction(button,action){
 button.addEventListener('pointerup',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();event.stopPropagation();const now=performance.now();if(now-lastTap<90)return;lastTap=now;void action()});
 button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(performance.now()-lastTap<450)return;void action()});
}
function ensureHeader(){
 let header=$('#'+HEADER_ID);if(!header){header=el('header');header.id=HEADER_ID;const back=el('button','mp6-back');back.type='button';back.setAttribute('aria-label','بازگشت به داشبورد');back.appendChild(fallbackIcon('back'));const copy=el('div','mp6-copy');copy.append(el('strong'),el('small'));const profile=el('button','mp6-profile');profile.type='button';profile.setAttribute('aria-label','پروفایل');profile.appendChild(fallbackIcon('profile'));header.append(back,copy,profile);(app()||document.body).appendChild(header);bindAction(back,()=>navigateHome({push:true}));bindAction(profile,openProfile)}
 const active=activeModel(),home=homeModel();$('.mp6-copy strong',header).textContent=active?.label||'پنل سلامت اول';$('.mp6-copy small',header).textContent=roleTitle();$('.mp6-back',header).hidden=Boolean(!active||!home||active.key===home.key||isHome(active));return header;
}
function prioritizedModels(){
 const list=models(),home=homeModel(),rest=list.filter(item=>item!==home&&!isHome(item));const priority=caregiverPanel()?['تقویم','پشتیبانی','آموزش']:['کاربران','مراقبین','پشتیبانی','آموزش','ارزیابی','قرارداد'];const picked=[];
 for(const word of priority){const found=rest.find(item=>!picked.includes(item)&&compact(item.label).includes(compact(word)));if(found)picked.push(found);if(picked.length===3)break}for(const item of rest){if(picked.length>=3)break;if(!picked.includes(item))picked.push(item)}return picked.slice(0,3);
}
function navActionButton(type,label,model=null){
 const button=el('button',type==='home'?'home':'');button.type='button';button.dataset.mp6Action=type;button.setAttribute('aria-label',label);if(model){button.dataset.moduleKey=model.key||'';button.dataset.moduleLabel=model.label||''}
 if(type==='home'){const circle=el('span','mp6-home-circle');circle.appendChild(cloneIcon(model?.source,'home'));button.append(circle,el('span','',label))}else{button.appendChild(type==='profile'?fallbackIcon('profile'):type==='more'?fallbackIcon('more'):cloneIcon(model?.source));button.appendChild(el('span','',label))}
 bindAction(button,()=>{if(type==='profile')return openProfile();if(type==='more')return openMore();if(model)return navigateModel(model,{push:true})});return button;
}
function ensureNav(){
 let nav=$('#'+NAV_ID);if(!nav){nav=el('nav');nav.id=NAV_ID;nav.setAttribute('aria-label','ناوبری اصلی پنل موبایل');(app()||document.body).appendChild(nav)}const home=homeModel(),priority=prioritizedModels();const signature=[home?.key,...priority.map(item=>item.key),caregiverPanel()?'caregiver':'staff'].join('|');
 if(nav.dataset.signature!==signature){nav.dataset.signature=signature;nav.replaceChildren();nav.append(navActionButton('profile','پروفایل'),priority[0]?navActionButton('module',priority[0].label,priority[0]):navActionButton('more','منو'),navActionButton('home','خانه',home),priority[1]?navActionButton('module',priority[1].label,priority[1]):navActionButton('more','منو'),priority[2]?navActionButton('module',priority[2].label,priority[2]):navActionButton('more','منو'))}
 const active=activeModel();$$('button',nav).forEach(button=>{const key=button.dataset.moduleKey;const selected=button.classList.contains('home')?Boolean(active&&isHome(active)):Boolean(key&&active?.key===key);button.classList.toggle('active',selected);button.setAttribute('aria-current',selected?'page':'false')});return nav;
}
function ensureDashboard(){
 const home=homeModel(),active=activeModel(),content=$('#content');if(!content||!home||!active||!isHome(active)){$('#'+DASH_ID)?.remove();return}let dash=$('#'+DASH_ID);const entries=models().filter(item=>!isHome(item));const signature=entries.map(item=>`${item.key}:${item.label}`).join('|');if(!dash){dash=el('section');dash.id=DASH_ID;content.prepend(dash)}if(dash.dataset.signature===signature)return;dash.dataset.signature=signature;dash.replaceChildren();
 const welcome=el('div','mp6-welcome'),copy=el('div');copy.append(el('strong','',`سلام ${userName().split(' ')[0]||'کاربر'} 👋`),el('small','',`${roleTitle()} • دسترسی‌های شما`));welcome.append(copy,el('span','mp6-brand-dot'));const grid=el('div','mp6-grid');
 for(const item of entries){const button=el('button','mp6-module');button.type='button';button.dataset.moduleKey=item.key;button.setAttribute('aria-label',item.label);const tile=el('span','mp6-tile');tile.appendChild(cloneIcon(item.source));button.append(tile,el('span','',item.label));bindAction(button,()=>navigateModel(item,{push:true}));grid.appendChild(button)}dash.append(welcome,grid);
}
async function waitRouter(timeout=1800){
 const started=performance.now();while(performance.now()-started<timeout){if(caregiverPanel()&&typeof window.SalamatCaregiverCanonicalRouteOwner?.openModule==='function')return'caregiver';if(!caregiverPanel()&&typeof window.SalamatStaffModuleRouter?.route==='function')return'staff';await sleep(60)}return'';
}
async function routeDirect(item){
 if(!item)return false;const mode=await waitRouter();try{if(mode==='caregiver'){await window.SalamatCaregiverCanonicalRouteOwner.openModule(item.key);return true}if(mode==='staff'){await window.SalamatStaffModuleRouter.route(item.key);return true}}catch(error){console.warn('[mobile-v6] canonical route failed',item.key,error)}try{HTMLElement.prototype.click.call(item.source);return true}catch{}try{return item.source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,view:window}))}catch{return false}
}
function setActiveSource(item){if(!item)return;sourceButtons().forEach(source=>{const selected=source===item.source;source.classList.toggle('active',selected);source.setAttribute('aria-current',selected?'page':'false')})}
async function navigateModel(item,{push=true,fromPop=false}={}){
 if(!item||exiting||(restoring&&!fromPop))return false;const token=++routeToken;claimSurface();closeSheet();const before=normalize($('#pageTitle')?.textContent);const ok=await routeDirect(item);if(token!==routeToken)return false;if(ok){setActiveSource(item);window.scrollTo({top:0,left:0,behavior:'auto'})}await sleep(20);sync();if(ok&&push&&!fromPop)pushHistory(item.key);window.dispatchEvent(new CustomEvent('salamat-mobile-v6-routed',{detail:{key:item.key,label:item.label,ok}}));if(!ok&&window.toast)window.toast('مسیر باز نشد','لطفاً صفحه را یک‌بار تازه‌سازی کنید.');return ok||before!==normalize($('#pageTitle')?.textContent);
}
function navigateHome(options={}){const home=homeModel();if(home)return navigateModel(home,options);return false}
function openMore(){claimSurface();if(window.SalamatMobileShell?.open){window.SalamatMobileShell.open({focus:true});return}const sidebar=$('#sidebar');if(sidebar){sidebar.classList.add('open');sidebar.style.visibility='visible';sidebar.style.pointerEvents='auto'}}
function ensureProfileSheet(){
 let sheet=$('#'+SHEET_ID);if(sheet)return sheet;sheet=el('div');sheet.id=SHEET_ID;sheet.setAttribute('aria-hidden','true');const panel=el('section','mp6-sheet');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','پروفایل کاربر');panel.appendChild(el('div','mp6-sheet-handle'));const card=el('div','mp6-profile-card'),mark=el('div','mp6-profile-mark');mark.appendChild(fallbackIcon('profile'));const info=el('div');info.append(el('strong'),el('small'));const close=el('button','mp6-sheet-close','×');close.type='button';close.setAttribute('aria-label','بستن');card.append(mark,info,close);panel.append(card,el('p','mp6-sheet-note','این نمای موبایل از همان حساب و سطح دسترسی نسخه دسکتاپ استفاده می‌کند.'));sheet.appendChild(panel);(app()||document.body).appendChild(sheet);bindAction(close,closeSheet);sheet.addEventListener('pointerup',event=>{if(event.target===sheet)closeSheet()});return sheet;
}
function openProfile(){
 if(caregiverPanel()&&typeof window.SalamatCaregiverSelfProfile?.open==='function'){try{window.SalamatCaregiverSelfProfile.open();setTimeout(sync,0);return}catch{}}const profileSource=models().find(item=>/پروفایل|حساب من/.test(item.label));if(profileSource){void navigateModel(profileSource,{push:true});return}const trigger=$('.csp1-profile-trigger')||$('#topAvatar')||$('#sidebarAvatar');if(trigger&&trigger.matches('button,[role="button"],a')){try{trigger.click();return}catch{}}const sheet=ensureProfileSheet();$('.mp6-profile-card strong',sheet).textContent=userName();$('.mp6-profile-card small',sheet).textContent=roleTitle();sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');
}
function closeSheet(){const sheet=$('#'+SHEET_ID);if(!sheet)return;sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true')}
function historyState(key,{root=false,guard=false}={}){return {[HISTORY_KEY]:true,version:VERSION,key:key||homeModel()?.key||'',root,guard,at:Date.now()}}
function isOwnedState(state){return Boolean(state&&state[HISTORY_KEY])}
function baseUrl(){return `${location.pathname}${location.search}`}
function armHistory(){
 if(!ownedSession||exiting)return;const home=homeModel(),active=activeModel()||home;if(!home)return;const current=history.state;if(isOwnedState(current))return;history.replaceState(historyState(home.key,{root:true}),'',baseUrl());history.pushState(historyState(active?.key||home.key,{guard:true}),'',baseUrl());
}
function pushHistory(key){if(!ownedSession||exiting||restoring)return;const current=history.state;if(isOwnedState(current)&&current.key===key&&!current.root)return;history.pushState(historyState(key),'',baseUrl())}
async function handlePop(event){
 if(!ownedSession||exiting||!MEDIA.matches)return;restoring=true;claimSurface();try{let state=event.state;if(!isOwnedState(state)){const home=homeModel();if(!home)return;history.replaceState(historyState(home.key,{root:true}),'',baseUrl());history.pushState(historyState(home.key,{guard:true}),'',baseUrl());await navigateModel(home,{push:false,fromPop:true});return}const item=models().find(model=>model.key===state.key)||homeModel();if(item)await navigateModel(item,{push:false,fromPop:true});if(state.root){const home=homeModel();history.pushState(historyState(home?.key||state.key,{guard:true}),'',baseUrl())}}finally{setTimeout(()=>{restoring=false;claimSurface();sync()},20)}
}
function sync(){
 cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!MEDIA.matches){document.documentElement.classList.remove('salamat-mobile-panel-v6');document.body?.classList.remove('salamat-mobile-panel-v6');return}if(appVisible()&&!exiting)ownedSession=true;if(!ownedSession||exiting||(!appVisible()&&!window.SalamatBackend?.getCurrentUser?.()))return;claimSurface();ensureHeader();ensureNav();ensureDashboard();armHistory()});
}
function install(){
 addStyles();window.addEventListener('popstate',handlePop);window.addEventListener('pageshow',event=>{if(event.persisted&&ownedSession){claimSurface();armHistory()}sync()});for(const eventName of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-module-opened','salamat-staff-route-complete','salamat-mobile-navigation-complete'])window.addEventListener(eventName,()=>setTimeout(sync,0));window.addEventListener('salamat-logged-out',()=>{exiting=true;ownedSession=false;closeSheet();document.documentElement.classList.remove('salamat-mobile-panel-v6');document.body?.classList.remove('salamat-mobile-panel-v6')});$('#logoutButton')?.addEventListener('click',()=>{exiting=true},{capture:true});MEDIA.addEventListener?.('change',sync);observer=new MutationObserver(sync);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden','data-caregiver-module-key','data-panel-module-key','data-access-module']});sync();window.SalamatUnifiedMobilePanel={version:VERSION,sync,home:()=>navigateHome({push:true}),route:key=>{const item=models().find(model=>model.key===key);return item?navigateModel(item,{push:true}):Promise.resolve(false)},profile:openProfile};window.dispatchEvent(new CustomEvent('salamat-mobile-panel-v6-ready',{detail:{version:VERSION}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();