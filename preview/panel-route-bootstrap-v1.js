(()=>{
'use strict';
if(window.__salamatPanelRouteBootstrapV1)return;
window.__salamatPanelRouteBootstrapV1=true;
const VERSION='1.3.0',PANEL_PATH='/panel',LOGIN_PATH='/';
const STAFF_ROLES=new Set(['ADMIN','RECRUITER','HR','SUPPORT','EVALUATOR','EDUCATION','OPERATIONS']);
const $=selector=>document.querySelector(selector);
let released=false,scheduled=false;
function onPanelRoute(){return location.pathname===PANEL_PATH||location.pathname===`${PANEL_PATH}/`}
function currentUser(){try{return window.SalamatBackend?.getCurrentUser?.()||window.__salamatAuthenticatedStaffUser||window.SalamatAccessControl?.access?.user||null}catch{return window.__salamatAuthenticatedStaffUser||null}}
function currentRole(){const user=currentUser();return String(user?.actualRole||user?.role||document.documentElement.dataset.currentUserRole||'').trim().toUpperCase()}
function appReady(){const app=$('#appView');return Boolean(app&&!app.classList.contains('hidden')&&!app.hidden&&app.getAttribute('aria-hidden')!=='true')}
function staffButtons(){return [...document.querySelectorAll('#sidebarNav [data-panel-module-key],#sidebarNav [data-staff-module-key]')]}
function keyOf(button){return button?.dataset.panelModuleKey||button?.dataset.staffModuleKey||button?.dataset.accessModule||''}
function isStaffSession(){return STAFF_ROLES.has(currentRole())||staffButtons().some(button=>keyOf(button)==='staff.dashboard')}
function stabilizeCompatibilitySurface(){const login=$('#loginView');if(login&&appReady()){login.classList.add('hidden');login.hidden=true;login.setAttribute('aria-hidden','true');login.setAttribute('inert','');login.style.setProperty('display','none','important')}$('#caregiverSignupLayer')?.remove();try{$('#loginIntroVideo')?.pause()}catch{}}
function preferredStaffModuleKey(){const buttons=staffButtons(),access=window.SalamatAccessControl;const allowed=key=>{try{return typeof access?.can==='function'?access.can(key,'view')!==false:true}catch{return true}};if(buttons.some(button=>keyOf(button)==='staff.dashboard')&&allowed('staff.dashboard'))return 'staff.dashboard';return keyOf(buttons.find(button=>keyOf(button)&&allowed(keyOf(button))))||''}
function releasePanel(reason='ready'){if(released)return true;released=true;stabilizeCompatibilitySurface();$('#salamatPanelRouteLoading')?.remove();document.documentElement.classList.add('salamat-panel-document-ready');document.body?.classList.add('salamat-panel-document-ready');document.documentElement.setAttribute('data-salamat-panel-release',reason);window.dispatchEvent(new CustomEvent('salamat-panel-route-ready',{detail:{reason,version:VERSION}}));return true}
async function dispatchStaffRoute(reason='panel-entry'){
 if(!appReady()||!isStaffSession())return false;const key=preferredStaffModuleKey();if(!key)return false;
 const router=window.SalamatStaffModuleRouter;if(typeof router?.route!=='function')return false;
 await Promise.resolve(router.route(key));window.dispatchEvent(new CustomEvent('salamat-panel-canonical-surface-requested',{detail:{reason,key,version:VERSION}}));releasePanel('staff-route-dispatched');return true;
}
function settle(reason='panel-entry'){
 if(released)return;if(scheduled)return;scheduled=true;
 queueMicrotask(async()=>{scheduled=false;stabilizeCompatibilitySurface();if(await dispatchStaffRoute(reason))return;if(appReady()&&currentRole()==='CAREGIVER'){releasePanel('caregiver-ready');return}if(appReady()&&!isStaffSession()&&currentRole()){releasePanel('panel-ready');return}setTimeout(()=>void dispatchStaffRoute(`${reason}-retry`).then(ok=>{if(!ok&&appReady()&&staffButtons().length)releasePanel('bounded-shell-ready')}),100)});
}
function watch(){const app=$('#appView');if(!app){location.replace(LOGIN_PATH);return}stabilizeCompatibilitySurface();for(const eventName of ['salamat-authenticated','salamat-access-ready','salamat-shell-ready','salamat-navigation-canonical'])window.addEventListener(eventName,()=>settle(eventName));window.addEventListener('pageshow',()=>settle('pageshow'));settle('initial')}
if(!onPanelRoute())return;document.documentElement.classList.add('salamat-panel-document');if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();window.SalamatPanelRoute={version:VERSION,finish:()=>{settle('manual');return released},forceReleaseAfterDeadline:()=>releasePanel('manual-fallback'),get ready(){return released}};
})();
