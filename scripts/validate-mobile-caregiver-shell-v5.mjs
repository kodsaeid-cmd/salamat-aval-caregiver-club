import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const shell=read('preview/mobile-caregiver-shell-v5.js');
const navigation=read('preview/mobile-caregiver-navigation-v5-1.js');
const worker=read('worker/index-unified-financial-v4.ts');

const failures=[];
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message||`missing: ${text}`)};
const requireOrder=(source,items,message)=>{
  let cursor=-1;
  for(const item of items){
    const next=source.indexOf(item,cursor+1);
    if(next<0||next<cursor){failures.push(message||`invalid order: ${items.join(' -> ')}`);return}
    cursor=next;
  }
};

try{new Function(shell)}catch(error){failures.push(`mobile shell syntax error: ${error.message}`)}
try{new Function(navigation)}catch(error){failures.push(`mobile navigation syntax error: ${error.message}`)}

requireText(shell,"const VERSION='5.0.1'",'mobile shell version must remain 5.0.1');
requireText(shell,"const sourceNav=()=>$$('#sidebarNav .nav-item,#sidebarNav>button')",'module source must remain the desktop sidebar navigation');
requireText(shell,'function gridSources()','dashboard grid must be derived from desktop modules');
requireText(shell,'return sourceNav().filter','dashboard grid must filter the real desktop module list');
requireText(shell,"button.addEventListener('click',()=>clickSource(source))",'base dashboard module tiles must still delegate to desktop modules');
requireText(shell,"window.SalamatCaregiverSelfProfile.open()",'profile bottom action must use the existing caregiver desktop profile module');
requireText(shell,"matchSource(['تقویم کاری','تقویم'])",'calendar bottom action must map to the desktop calendar module');
requireText(shell,"matchSource(['پشتیبانی قراردادها','پشتیبانی پرونده','پشتیبانی'])",'support bottom action must map to the existing desktop support module');
requireText(shell,"matchSource(['آموزش‌های من','آموزش'])",'training bottom action must map to the existing desktop training module');
requireText(shell,"matchSource(['داشبورد'])",'home bottom action must map to the desktop dashboard module');
requireOrder(shell,["createNavButton('profile','پروفایل'","createNavButton('calendar','تقویم'","createNavButton('home','خانه'","createNavButton('support','پشتیبانی'","createNavButton('training','آموزش'"],'bottom navigation must be RTL: profile, calendar, home, support, training');
requireText(shell,"const VIDEO_SRC='/media/caregiver-club-intro.mp4?v=2.1.0-edge-cache'",'mobile login must reuse the canonical main intro video');
requireText(shell,'به باشگاه مراقبین سلامت اول خوش آمدید','mobile splash welcome copy is missing');
requireText(shell,"sessionStorage.setItem(SPLASH_KEY,'1')",'splash must only run once per tab session');
requireText(shell,"identifier.placeholder='نام کاربری'",'mobile login must be username/password first');
requireText(shell,"document.documentElement.classList.toggle('salamat-caregiver-dashboard-v5',active)",'mobile dashboard state class is missing');
requireText(shell,'grid-template-columns:repeat(3,minmax(0,1fr))','caregiver mobile module grid must use three columns');
requireText(shell,'dashboard.replaceChildren(welcome,wrap)','dashboard must use DOM-safe node composition');
requireText(shell,'target.replaceChildren()','profile avatar must be composed without reinterpreting DOM text as HTML');

requireText(navigation,"const VERSION='5.1.0'",'mobile navigation repair version must be 5.1.0');
requireText(navigation,"window.SalamatCaregiverCanonicalRouteOwner",'navigation repair must target the canonical caregiver route owner');
requireText(navigation,"typeof owner?.openModule==='function'",'navigation repair must call canonical openModule instead of relying on hidden button click');
requireText(navigation,"const moduleKey=source=>String(source?.dataset?.caregiverModuleKey",'navigation repair must read real desktop caregiver module keys');
requireText(navigation,"document.addEventListener('click',captureNavigation,true)",'navigation repair must own mobile click capture before the legacy bubbling handler');
requireText(navigation,"event.stopImmediatePropagation()",'navigation repair must suppress the obsolete bubbling route delegation');
requireText(navigation,"const BACK_ID='salamatCaregiverBackV51'",'module header must include a back control');
requireText(navigation,"button.setAttribute('aria-label','بازگشت به داشبورد')",'back control must be accessible and return to dashboard');
requireText(navigation,"if(back)back.hidden=dashboardActive()",'back control must hide on dashboard and appear on module pages');
requireText(navigation,"button[data-mc5-action=\"profile\"] .mc5-nav-icon",'profile bottom navigation must have an explicit icon treatment');
requireText(navigation,"#e52b31",'mobile panel must include Salamat Aval brand red as a controlled accent');
requireText(navigation,".mc5-module:nth-child(3n+2) .mc5-module-icon",'module grid must use subtle red brand accents without replacing the green primary color');

requireText(worker,'const MOBILE_CAREGIVER_SHELL_VERSION = "5.0.1"','worker mobile shell version is missing');
requireText(worker,'const MOBILE_CAREGIVER_NAVIGATION_VERSION = "5.1.0"','worker mobile navigation repair version is missing');
requireText(worker,'injectMobileCaregiverShell(html)','worker must inject the mobile caregiver shell in final HTML');
requireText(worker,'injectMobileCaregiverNavigation(html)','worker must inject the mobile caregiver navigation repair after the shell');
requireOrder(worker,['html = injectMobileCaregiverShell(html);','html = injectMobileCaregiverNavigation(html);'],'navigation repair must be injected after the base mobile shell');
requireText(worker,'x-salamat-mobile-caregiver-shell','worker must expose mobile shell production evidence header');
requireText(worker,'x-salamat-mobile-caregiver-navigation','worker must expose mobile navigation production evidence header');
requireText(worker,'mobile-caregiver-navigation-v5-1.js','worker must inject the canonical mobile navigation repair asset');

if(failures.length){
  console.error('Mobile caregiver shell V5 validation failed:');
  failures.forEach(item=>console.error(` - ${item}`));
  process.exit(1);
}
console.log('Mobile caregiver shell V5 + navigation 5.1 contract verified.');
