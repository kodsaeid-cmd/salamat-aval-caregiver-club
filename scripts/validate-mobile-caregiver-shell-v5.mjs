import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const login=read('preview/mobile-caregiver-shell-v5.js');
const panel=read('preview/mobile-role-icon-shell-v7.js');
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

try{new Function(login)}catch(error){failures.push(`mobile login shell syntax error: ${error.message}`)}
try{new Function(panel)}catch(error){failures.push(`mobile role icon shell syntax error: ${error.message}`)}

// Approved mobile login remains intact.
requireText(login,"const VERSION='5.0.1'",'mobile login shell version must remain 5.0.1');
requireText(login,"const VIDEO_SRC='/media/caregiver-club-intro.mp4?v=2.1.0-edge-cache'",'mobile login must reuse the canonical intro video');
requireText(login,'به باشگاه مراقبین سلامت اول خوش آمدید','mobile splash welcome copy is missing');
requireText(login,"sessionStorage.setItem(SPLASH_KEY,'1')",'splash must only run once per tab session');
requireText(login,"identifier.placeholder='نام کاربری'",'mobile login must remain username/password first');

// V7 is a launcher-first authenticated mobile shell for every role.
requireText(panel,"const VERSION='7.0.0'",'role icon shell version must be 7.0.0');
requireText(panel,"const LAUNCHER_ID='salamatMobileRoleLauncherV7'",'V7 launcher surface is missing');
requireText(panel,"grid-template-columns:repeat(3,minmax(0,1fr))",'all role launchers must use the caregiver-style three-column icon grid');
requireText(panel,"html.salamat-mobile-panel-v7.salamat-mobile-icon-home-v7 #content.content{display:none!important}",'legacy dashboard content must be hidden on mobile home');
requireText(panel,"const launchItems=list.filter(item=>!isHome(item))",'launcher must render every allowed non-dashboard module without a fixed cap');
requireText(panel,"small.textContent=`${launchItems.length.toLocaleString('fa-IR')} دسترسی فعال`",'launcher must expose the real number of allowed modules');
requireText(panel,"module?.panel==='STAFF'&&module?.actions?.view",'staff/admin launcher must come from server access modules');
requireText(panel,"window.SalamatStaffModuleRouter?.access",'staff/admin launcher must read canonical server access state');
requireText(panel,"window.SalamatStaffModuleRouter.route(model.key)",'staff/admin icon navigation must call the canonical staff router directly');
requireText(panel,"window.SalamatCaregiverCanonicalRouteOwner.openModule(model.key)",'caregiver icon navigation must call the canonical caregiver route owner directly');
requireText(panel,"button.addEventListener('click',event=>{event.preventDefault();void navigateModule(item,{push:true})})",'module icon tiles must own their click route directly');
requireText(panel,"navButton('خانه','home',()=>showHome({push:true})",'bottom navigation must include a direct owned home button');
requireText(panel,"navButton('پروفایل','profile',openProfile)",'bottom navigation must include a working profile action');
requireText(panel,"buttons.push(leftPrimary?navModelButton(leftPrimary)",'bottom navigation must map role-specific real modules');
requireText(panel,"#${NAV_ID} button{position:relative;height:61px",'bottom navigation buttons need a dedicated touch surface');
requireText(panel,"touch-action:manipulation",'mobile actions must be touch optimized');
requireText(panel,"const map={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبانی',EVALUATOR:'ارزیاب',EDUCATION:'آموزش',OPERATIONS:'عملیات',CAREGIVER:'مراقب'}",'V7 must cover all authenticated roles');
requireText(panel,"html.salamat-mobile-panel-v7 #sidebar",'old mobile sidebar must be hidden while V7 owns the authenticated shell');
requireText(panel,"html.salamat-mobile-panel-v7 #salamatCaregiverBottomNavV5",'old caregiver bottom nav must be hidden under V7');
requireText(panel,"html.salamat-mobile-panel-v7 #salamatUnifiedMobileNavV6",'retired V6 nav must be hidden under V7');
requireText(panel,"history.replaceState(historyState('guard')",'V7 must install a hardware-back guard');
requireText(panel,"history.pushState(historyState('home'",'V7 must establish a guarded mobile home state');
requireText(panel,"window.addEventListener('popstate',handlePop)",'V7 must own physical/browser back navigation');
requireText(panel,"if(state.kind==='guard')",'back at mobile home must not expose a legacy shell');
requireText(panel,"window.addEventListener('pageshow'",'BFCache restores must reclaim V7');
requireText(panel,"window.SalamatMobileRoleIconShell={version:VERSION",'V7 must expose a single public mobile route owner');
requireAbsent(panel,"innerHTML=`",'V7 dynamic UI should use DOM node composition instead of interpolated HTML');

// Outer worker retires V6 and injects only V7 after the login shell.
requireText(worker,'const MOBILE_UNIFIED_PANEL_VERSION = "7.0.0"','worker V7 version is missing');
requireText(worker,'const MOBILE_RETIRED_UNIFIED_PANEL_ASSET = "mobile-unified-panel-v6.js"','worker must identify retired V6');
requireText(worker,'const MOBILE_UNIFIED_PANEL_ASSET = "mobile-role-icon-shell-v7.js"','worker V7 asset is missing');
requireText(worker,'window.__salamatMobilePanelSingleOwnerV7=true','head kill switch must identify V7 as the mobile owner');
requireText(worker,'window.__salamatMobileUnifiedPanelV6=true','head kill switch must prevent retired V6 from installing');
for(const flag of ['__salamatInternalHistoryRuntimeV2','__salamatInternalHistoryRuntime','__salamatMobileAppExperience','__salamatMobileNavControllerV4','__salamatMobileAppStabilityRuntime','__salamatMobileIntegrityV3','__salamatMobileShellRecoveryV2']){
  requireText(worker,flag,`worker kill switch must retire ${flag} on mobile`);
}
requireText(worker,'stripScript(html, MOBILE_RETIRED_UNIFIED_PANEL_ASSET)','worker must strip retired V6 from final HTML');
requireText(worker,'stripScript(html, MOBILE_SUPERSEDED_NAV_ASSET)','worker must strip obsolete caregiver V5.1 navigation');
requireText(worker,'injectMobileCaregiverShell(html)','worker must preserve login/splash V5');
requireText(worker,'injectMobileUnifiedPanel(html)','worker must inject V7 authenticated shell');
requireOrder(worker,['html = injectMobileCaregiverShell(html);','html = injectMobileUnifiedPanel(html);'],'V7 must load after the approved login shell');
requireText(worker,'x-salamat-mobile-panel','worker must expose V7 production evidence');
requireText(worker,'x-salamat-mobile-history-owner','worker must expose V7 history ownership');
requireText(worker,'x-salamat-mobile-role-icon-shell','worker must expose the role icon shell version');
requireAbsent(worker,'injectMobileCaregiverNavigation(html)','obsolete V5.1 navigation must no longer be injected');

if(failures.length){
  console.error('Mobile role icon shell V7 validation failed:');
  failures.forEach(item=>console.error(` - ${item}`));
  process.exit(1);
}
console.log('Mobile login V5 + all-role icon launcher V7 contract verified.');
