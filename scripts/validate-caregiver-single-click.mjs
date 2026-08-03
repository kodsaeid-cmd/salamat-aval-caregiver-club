import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver route validation failed: ${message}`)};

const wrangler=read('wrangler.backend.jsonc');
const wrapper=read('worker/index-caregiver-click-stability.ts');
const runtime=read('preview/staff-caregiver-single-click-fix-v1.js');
const routeOwner=read('preview/staff-caregiver-route-owner-v1.js');
const directory=read('preview/caregiver-directory-pagination.js');
const professional=read('preview/caregiver-professional-bridge.js');
const staffPlatform=read('preview/staff-platform-runtime.js');

new Function(runtime);
new Function(routeOwner);
new Function(directory);
new Function(professional);

expect(wrangler.includes('index-caregiver-click-stability.ts'),'final caregiver interaction worker is not active');
expect(wrangler.includes('index-ui-stability.ts'),'caregiver interaction worker does not document the delegated UI layer');
expect(wrapper.includes('import app from "./index-ui-stability"'),'existing UI stability chain is not preserved');
expect(wrapper.includes('caregiver-directory-pagination.js'),'previous caregiver directory is not cache-versioned');
expect(wrapper.includes('caregiver-professional-bridge.js'),'professional scorecard bridge is not cache-versioned');
expect(wrapper.includes('staff-caregiver-route-owner-v1.js'),'caregiver route owner is not injected');
expect(wrapper.includes('staff-caregiver-single-click-fix-v1.js'),'desktop interaction recovery is not injected');
expect(wrapper.includes('DIRECTORY_VERSION = "3.1.0"'),'restored directory version is incorrect');
expect(wrapper.includes('PROFESSIONAL_VERSION = "6.1.1"'),'scorecard bridge version is incorrect');
expect(wrapper.includes('ROUTE_OWNER_VERSION = "2.0.0"'),'unlocked route owner version is incorrect');
expect(wrapper.includes('x-salamat-caregiver-directory'),'directory deployment diagnostic header is missing');
expect(wrapper.includes('x-salamat-caregiver-scorecard'),'scorecard deployment diagnostic header is missing');
expect(wrapper.includes('x-salamat-caregiver-route-owner'),'route owner deployment diagnostic header is missing');

expect(staffPlatform.includes("if(typeof window.renderModule==='function')"),'staff fallback path changed unexpectedly');

expect(directory.includes("const VERSION='3.1.0'"),'previous directory design version is missing');
expect(directory.includes('class="cdp-row"'),'previous caregiver row design was not preserved');
expect(directory.includes('مشاهده کارنامه'),'caregiver row no longer announces the scorecard action');
expect(directory.includes('/api/admin/caregivers-page?'),'directory does not read the first view from the server');
expect(directory.includes("cache:'no-store'"),'directory request may reuse stale browser data');
expect(directory.includes("data-view=\"staff-caregiver-list\""),'directory does not expose a stable server list surface');
expect(directory.includes('window.SalamatCaregiverDirectoryPagination'),'directory does not expose the canonical open API');
expect(directory.includes('salamat-caregiver-directory-rendered'),'directory server lifecycle event is missing');
expect(directory.includes('isProfessionalTransition()'),'directory router can still interrupt scorecard rendering');
expect(directory.includes('wrapped.__base=current'),'professional renderer cannot bypass the directory wrapper');
expect(!directory.includes('setInterval('),'directory router must not poll or continuously reclaim the module');

expect(professional.includes("const VERSION='6.1.1'"),'professional scorecard bridge version is missing');
expect(professional.includes('/api/admin/caregiver-record?id='),'scorecard does not refresh the selected record from the server');
expect(professional.includes("cache:'no-store'"),'scorecard may read a stale caregiver record');
expect(professional.includes("['activity','پرونده حرفه‌ای مراقبین']"),'previous professional report renderer is not preserved');
expect(professional.includes('data-professional-caregiver'),'previous scorecard selection flow is not preserved');
expect(professional.includes("document.querySelector('.p3-report')"),'previous caregiver scorecard surface is not verified');
expect(professional.includes('bypassNewCaregiverRenderer'),'new simplified detail renderer is not bypassed');
expect(professional.includes('function professionalRow(code)'),'scorecard row selection is not deterministic');
expect(professional.includes("document.querySelectorAll('[data-professional-caregiver]')"),'scorecard selector does not use direct dataset comparison');
expect(!professional.includes("code.replace(/\"/g"),'scorecard selector still performs incomplete manual escaping');
expect(professional.includes('salamat-caregiver-scorecard-opened'),'scorecard lifecycle event is missing');
expect(professional.includes('window.SalamatCaregiverProfessionalBridge'),'scorecard bridge API is missing');

expect(routeOwner.includes("const VERSION='2.0.0'"),'route owner v2 is missing');
expect(routeOwner.includes("const MODULE_KEY='staff.caregivers'"),'caregiver module ownership is missing');
expect(routeOwner.includes('window.SalamatCaregiverDirectoryPagination'),'route does not open the previous server-backed directory');
expect(!routeOwner.includes('window.SalamatStaffCaregivers'),'route still opens the replacement caregiver design');
expect(routeOwner.includes("const DIRECTORY_READY_SELECTOR='.cdp-root[data-view=\"staff-caregiver-list\"] .cdp-panel'"),'route can settle on a loading shell before server data arrives');
expect(routeOwner.includes('directoryReady()'),'route does not verify a rendered server directory');
expect(routeOwner.includes("const SCORECARD_SELECTOR='.p3-report,[data-professional-caregiver]'"),'professional scorecard is not accepted as a valid caregiver surface');
expect(routeOwner.includes('professionalTransition()'),'scorecard transition is not protected from route repair');
expect(routeOwner.includes('function releaseRoute'),'route ownership cannot be released');
expect(routeOwner.includes("releaseRoute('pointer-other-module')"),'other sidebar modules cannot release caregiver ownership immediately');
expect(routeOwner.includes("releaseRoute(`access-router:${String(key||'unknown')}`)"),'programmatic navigation cannot release caregiver ownership');
expect(routeOwner.includes("if(!isCaregiverLabel(label))releaseRoute"),'rendering another module does not release caregiver ownership');
expect(routeOwner.includes("releaseRoute('active-module-changed')"),'late content changes cannot unlock a stale caregiver route');
expect(routeOwner.includes('routeActive&&!professionalTransition()'),'late-render repair is scoped to the active caregiver route');
expect(routeOwner.includes('access.openModule=wrapped'),'access router is not patched');
expect(routeOwner.includes('window.renderModule=wrapped'),'render router is not patched');
expect(routeOwner.includes("observer.observe(content,{childList:true,subtree:true})"),'late stale view replacement is not observed');
expect(!routeOwner.includes('localStorage'),'route owner must not source caregiver data locally');
expect(!routeOwner.includes('setInterval('),'route owner must not poll or lock navigation');

expect(runtime.includes("const DESKTOP=window.matchMedia('(min-width:761px)')"),'desktop-only row recovery scope is missing');
expect(runtime.includes("document.addEventListener('pointerdown',onPointerDown,true)"),'first physical pointer event is not captured');
expect(runtime.includes('event.stopImmediatePropagation()'),'duplicate legacy row handlers are not neutralized');
expect(!runtime.includes('setInterval('),'desktop row recovery must not poll permanently');

console.log('The previous caregiver directory design is restored, its first render and selected caregiver are refreshed from server APIs, the professional scorecard opens through the previous report renderer with safe row selection, and caregiver route ownership releases cleanly for every other module.');