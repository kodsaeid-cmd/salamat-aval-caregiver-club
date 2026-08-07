import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const shell=read('preview/mobile-caregiver-shell-v5.js');
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

requireText(shell,"const VERSION='5.0.1'",'mobile shell version must be 5.0.1');
requireText(shell,"const sourceNav=()=>$$('#sidebarNav .nav-item,#sidebarNav>button')",'module source must remain the desktop sidebar navigation');
requireText(shell,'function gridSources()','dashboard grid must be derived from desktop modules');
requireText(shell,'return sourceNav().filter','dashboard grid must filter the real desktop module list');
requireText(shell,"button.addEventListener('click',()=>clickSource(source))",'dashboard module tiles must delegate to the original desktop module buttons');
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

requireText(worker,'const MOBILE_CAREGIVER_SHELL_VERSION = "5.0.1"','worker mobile shell version is missing');
requireText(worker,'injectMobileCaregiverShell(html)','worker must inject the mobile caregiver shell in final HTML');
requireText(worker,'x-salamat-mobile-caregiver-shell','worker must expose mobile shell production evidence header');
requireText(worker,'mobile-caregiver-shell-v5.js','worker must inject the canonical mobile caregiver shell asset');

if(failures.length){
  console.error('Mobile caregiver shell V5 validation failed:');
  failures.forEach(item=>console.error(` - ${item}`));
  process.exit(1);
}
console.log('Mobile caregiver shell V5 contract verified.');
