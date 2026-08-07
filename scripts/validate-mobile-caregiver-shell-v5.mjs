import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const login=read('preview/mobile-caregiver-shell-v5.js');
const panel=read('preview/mobile-role-icon-shell-v7-1.js');
const worker=read('worker/index-unified-financial-v4.ts');
const failures=[];
const has=(source,text,message)=>{if(!source.includes(text))failures.push(message||`missing: ${text}`)};
const absent=(source,text,message)=>{if(source.includes(text))failures.push(message||`must be absent: ${text}`)};
const ordered=(source,items,message)=>{let cursor=-1;for(const item of items){const next=source.indexOf(item,cursor+1);if(next<0||next<cursor){failures.push(message||`invalid order: ${items.join(' -> ')}`);return}cursor=next}};

try{new Function(login)}catch(error){failures.push(`mobile login syntax: ${error.message}`)}
try{new Function(panel)}catch(error){failures.push(`mobile V7.1 syntax: ${error.message}`)}

has(login,"const VERSION='5.0.1'",'approved login shell must remain 5.0.1');
has(login,"const VIDEO_SRC='/media/caregiver-club-intro.mp4?v=2.1.0-edge-cache'",'approved intro video must remain intact');
has(login,'به باشگاه مراقبین سلامت اول خوش آمدید','mobile splash copy is missing');
has(login,"identifier.placeholder='نام کاربری'",'mobile login must remain username/password first');

has(panel,"const VERSION='7.1.0'",'role icon shell must be version 7.1.0');
has(panel,"const LAUNCHER_ID='salamatMobileRoleLauncherV71'",'launcher surface is missing');
has(panel,'grid-template-columns:repeat(3,minmax(0,1fr))','all role homes must use the caregiver-style 3-column icon grid');
has(panel,'html.salamat-mobile-panel-v71.salamat-mobile-icon-home-v71 #content.content{display:none!important}','legacy dashboard must be hidden on mobile home');
has(panel,'const items=list.filter(item=>!isHome(item))','launcher must include every allowed non-home module without a fixed cap');
has(panel,"count.textContent=`${items.length.toLocaleString('fa-IR')} دسترسی فعال`",'launcher must display real role access count');
has(panel,"module?.panel==='STAFF'&&module?.actions?.view",'admin/staff module grid must come from server access');
has(panel,'window.SalamatStaffModuleRouter?.access','admin/staff shell must consume canonical access state');
has(panel,'await window.SalamatStaffModuleRouter.route(model.key)','admin/staff icon tiles must route directly through canonical router');
has(panel,'await window.SalamatCaregiverCanonicalRouteOwner.openModule(model.key)','caregiver icon tiles must route directly through canonical owner');
has(panel,"button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void navigateModule(item,{push:true})})",'launcher icon buttons must own their click handlers');
has(panel,"makeNavButton('خانه','home',showModules",'bottom navigation must include a directly owned home button');
has(panel,"makeNavButton('پروفایل','profile',openProfile)",'bottom navigation must include a working profile action');
has(panel,'const plan=bottomPlan()','bottom navigation must be mapped from actual role modules');
has(panel,'touch-action:manipulation','touch targets must be optimized for mobile');
has(panel,"ADMIN:'مدیر سامانه'",'admin role must be explicitly supported');
for(const role of ['RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS','CAREGIVER'])has(panel,`${role}:`,`role ${role} must be supported`);
has(panel,'html.salamat-mobile-panel-v71 #sidebar','legacy mobile sidebar must be hidden');
has(panel,'html.salamat-mobile-panel-v71 #salamatCaregiverBottomNavV5','old caregiver bottom nav must be hidden');
has(panel,'html.salamat-mobile-panel-v71 #salamatUnifiedMobileNavV6','old V6 nav must be hidden');
has(panel,"history.replaceState(state('guard')",'V7.1 must establish a hardware-back guard');
has(panel,"history.pushState(state('home'",'V7.1 must establish guarded home history');
has(panel,"window.addEventListener('popstate',onPop)",'V7.1 must own physical/browser back');
has(panel,"entry.kind==='guard'",'home back must not expose an older shell');
has(panel,"window.addEventListener('pageshow'",'BFCache restore must reclaim V7.1');
has(panel,'window.SalamatMobileRoleIconShell={version:VERSION','V7.1 must expose one public mobile route owner');
has(panel,"new MutationObserver(schedule).observe(nav",'launcher must watch canonical role navigation for access changes');
absent(panel,"new MutationObserver(schedule).observe(document.documentElement",'V7.1 must not observe and mutate its own whole DOM tree');
absent(panel,'innerHTML=`','dynamic V7.1 UI must use DOM composition instead of interpolated HTML');

has(worker,'const MOBILE_UNIFIED_PANEL_VERSION = "7.1.0"','worker mobile panel version must be 7.1.0');
has(worker,'const MOBILE_RETIRED_UNIFIED_PANEL_ASSET = "mobile-unified-panel-v6.js"','worker must identify retired V6');
has(worker,'const MOBILE_RETIRED_ROLE_ICON_ASSET = "mobile-role-icon-shell-v7.js"','worker must identify retired V7.0');
has(worker,'const MOBILE_UNIFIED_PANEL_ASSET = "mobile-role-icon-shell-v7-1.js"','worker must inject only V7.1');
has(worker,'window.__salamatMobilePanelSingleOwnerV71=true','head kill switch must declare V7.1 as owner');
has(worker,'window.__salamatMobileRoleIconShellV7=true','head kill switch must stop retired V7.0');
has(worker,'window.__salamatMobileUnifiedPanelV6=true','head kill switch must stop V6');
for(const flag of ['__salamatInternalHistoryRuntimeV2','__salamatInternalHistoryRuntime','__salamatMobileAppExperience','__salamatMobileNavControllerV4','__salamatMobileAppStabilityRuntime','__salamatMobileIntegrityV3','__salamatMobileShellRecoveryV2'])has(worker,flag,`worker must retire ${flag} on mobile`);
has(worker,'stripScript(html, MOBILE_RETIRED_UNIFIED_PANEL_ASSET)','worker must strip V6');
has(worker,'stripScript(html, MOBILE_RETIRED_ROLE_ICON_ASSET)','worker must strip V7.0');
has(worker,'stripScript(html, MOBILE_SUPERSEDED_NAV_ASSET)','worker must strip old caregiver nav repair');
has(worker,'injectMobileCaregiverShell(html)','worker must keep approved login/splash V5');
has(worker,'injectMobileUnifiedPanel(html)','worker must inject V7.1 authenticated shell');
ordered(worker,['html = injectMobileCaregiverShell(html);','html = injectMobileUnifiedPanel(html);'],'V7.1 must load after login shell');
has(worker,'x-salamat-mobile-role-icon-shell','worker must expose V7.1 evidence header');
has(worker,'x-salamat-mobile-history-owner','worker must expose V7.1 history owner');
absent(worker,'injectMobileCaregiverNavigation(html)','obsolete V5.1 navigation must not be injected');

if(failures.length){console.error('Mobile role icon shell V7.1 validation failed:');failures.forEach(item=>console.error(` - ${item}`));process.exit(1)}
console.log('Mobile login V5 + all-role icon launcher V7.1 contract verified.');
