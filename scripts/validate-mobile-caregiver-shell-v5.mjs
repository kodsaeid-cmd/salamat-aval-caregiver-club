import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const shell=read('preview/mobile-caregiver-shell-v5.js');
const panel=read('preview/mobile-unified-panel-v6.js');
const worker=read('worker/index-unified-financial-v4.ts');

const failures=[];
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message||`missing: ${text}`)};
const requireAbsent=(source,text,message)=>{if(source.includes(text))failures.push(message||`must be absent: ${text}`)};
const requireOrder=(source,items,message)=>{
  let cursor=-1;
  for(const item of items){
    const next=source.indexOf(item,cursor+1);
    if(next<0||next<cursor){failures.push(message||`invalid order: ${items.join(' -> ')}`);return}
    cursor=next;
  }
};

try{new Function(shell)}catch(error){failures.push(`mobile login shell syntax error: ${error.message}`)}
try{new Function(panel)}catch(error){failures.push(`unified mobile panel syntax error: ${error.message}`)}

// V5 remains the login/splash owner only.
requireText(shell,"const VERSION='5.0.1'",'mobile login shell version must remain 5.0.1');
requireText(shell,"const VIDEO_SRC='/media/caregiver-club-intro.mp4?v=2.1.0-edge-cache'",'mobile login must reuse the canonical intro video');
requireText(shell,'به باشگاه مراقبین سلامت اول خوش آمدید','mobile splash welcome copy is missing');
requireText(shell,"sessionStorage.setItem(SPLASH_KEY,'1')",'splash must only run once per tab session');
requireText(shell,"identifier.placeholder='نام کاربری'",'mobile login must remain username/password first');

// V6 is the only authenticated mobile panel owner for caregiver and all staff roles.
requireText(panel,"const VERSION='6.0.0'",'unified mobile panel version must be 6.0.0');
requireText(panel,"const SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button'",'mobile modules must be derived from the canonical desktop sidebar');
requireText(panel,'data.caregiverModuleKey||data.panelModuleKey||data.accessModule','unified panel must read both caregiver and staff canonical module keys');
requireText(panel,"window.SalamatCaregiverCanonicalRouteOwner?.openModule",'caregiver navigation must route through the canonical caregiver route owner');
requireText(panel,"window.SalamatStaffModuleRouter?.route",'staff/admin navigation must route through the canonical staff router');
requireText(panel,"await window.SalamatCaregiverCanonicalRouteOwner.openModule(item.key)",'caregiver buttons must call canonical openModule directly');
requireText(panel,"await window.SalamatStaffModuleRouter.route(item.key)",'staff/admin buttons must call canonical route directly');
requireText(panel,"grid-template-columns:repeat(3,minmax(0,1fr))",'all mobile dashboards must use the unified three-column module grid');
requireText(panel,"navActionButton('profile','پروفایل')",'bottom navigation must always include the explicit profile action');
requireText(panel,"navActionButton('home','خانه',home)",'bottom navigation must keep the elevated center home action');
requireText(panel,"profile:['circle|12|8|4'",'profile must have an explicit line icon even without an avatar');
requireText(panel,'--mp6-red:#D83429','unified panel must carry the Salamat Aval red brand accent');
requireText(panel,'--mp6-green:#185B38','unified panel must keep green as the primary brand color');
requireText(panel,"const map={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبانی',EVALUATOR:'ارزیاب',EDUCATION:'آموزش',OPERATIONS:'عملیات',CAREGIVER:'مراقب'}",'unified panel must cover every authenticated role');
requireText(panel,"html.salamat-mobile-panel-v6 #salamatMobileAppHeader",'unified panel must hide the historical generic mobile shell');
requireText(panel,"html.salamat-mobile-panel-v6 #salamatCaregiverHeaderV5",'unified panel must hide the historical caregiver panel shell');
requireText(panel,"history.replaceState(historyState(home.key,{root:true})",'hardware-back ownership must replace legacy history with a V6 root');
requireText(panel,"history.pushState(historyState(active?.key||home.key,{guard:true})",'hardware-back ownership must arm a dashboard guard entry');
requireText(panel,"window.addEventListener('popstate',handlePop)",'unified panel must own the physical/browser back event');
requireText(panel,"window.addEventListener('pageshow'",'BFCache restores must re-claim the unified shell');
requireText(panel,"if(!isOwnedState(state))",'foreign legacy history states must be recovered into V6');
requireText(panel,"if(state.root)",'root back navigation must be re-armed instead of exposing an older shell');
requireText(panel,"window.SalamatUnifiedMobilePanel={version:VERSION",'unified panel must expose a public sync/route owner for recovery');

// The outer worker must disable legacy mobile navigation/history before those scripts execute.
requireText(worker,'const MOBILE_UNIFIED_PANEL_VERSION = "6.0.0"','worker unified mobile panel version is missing');
requireText(worker,'const MOBILE_UNIFIED_PANEL_ASSET = "mobile-unified-panel-v6.js"','worker unified panel asset is missing');
requireText(worker,'data-salamat-mobile-panel-owner','worker must inject a mobile single-owner kill switch in the head');
for(const flag of ['__salamatInternalHistoryRuntimeV2','__salamatInternalHistoryRuntime','__salamatMobileAppExperience','__salamatMobileNavControllerV4','__salamatMobileAppStabilityRuntime','__salamatMobileIntegrityV3','__salamatMobileShellRecoveryV2']){
  requireText(worker,flag,`worker kill switch must retire ${flag} on mobile`);
}
requireText(worker,'stripScript(html, MOBILE_SUPERSEDED_NAV_ASSET)','worker must remove the obsolete caregiver navigation repair');
requireText(worker,'injectMobileCaregiverShell(html)','worker must preserve the approved mobile login/splash shell');
requireText(worker,'injectMobileUnifiedPanel(html)','worker must inject V6 as the authenticated panel owner');
requireOrder(worker,['html = injectMobileCaregiverShell(html);','html = injectMobileUnifiedPanel(html);'],'V6 must load after the login shell');
requireText(worker,'x-salamat-mobile-panel','worker must expose V6 production evidence');
requireText(worker,'x-salamat-mobile-history-owner','worker must expose the mobile history owner version');
requireAbsent(worker,'injectMobileCaregiverNavigation(html)','obsolete V5.1 navigation must no longer be injected');

if(failures.length){
  console.error('Unified mobile panel validation failed:');
  failures.forEach(item=>console.error(` - ${item}`));
  process.exit(1);
}
console.log('Mobile login V5 + unified authenticated panel V6 contract verified.');
