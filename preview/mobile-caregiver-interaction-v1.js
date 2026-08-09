(function(){
'use strict';
if(window.__salamatMobileCaregiverInteractionV1)return;
window.__salamatMobileCaregiverInteractionV1=true;

var VERSION='1.0.2';
var MEDIA=window.matchMedia?window.matchMedia('(max-width:760px)'):{matches:false};
var HOME_ID='salamatMobileHomeV2';
var BOTTOM_ID='salamatMobileUnifiedBottomNavV2';
var SOURCE_SELECTOR='#sidebarNav .nav-item,#sidebarNav>button,#sidebarNav [data-caregiver-module-key],#sidebarNav [data-access-module]';
var syncTimer=0;
var observer=null;

function q(selector,root){return (root||document).querySelector(selector)}
function qa(selector,root){return Array.prototype.slice.call((root||document).querySelectorAll(selector))}
function normalize(value){return String(value||'').replace(/[\u200c\u200f\u202a-\u202e]/g,' ').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim()}
function compact(value){return normalize(value).replace(/[\s\-_\/]+/g,'').toLowerCase()}
function appVisible(){var node=q('#appView');return Boolean(MEDIA.matches&&node&&!node.classList.contains('hidden')&&node.getAttribute('aria-hidden')!=='true')}
function currentUser(){try{return window.SalamatBackend&&typeof window.SalamatBackend.getCurrentUser==='function'?(window.SalamatBackend.getCurrentUser()||{}):{}}catch(error){return{}}}
function panelCode(){
 var accessPanel='';
 try{accessPanel=window.SalamatStaffModuleRouter&&window.SalamatStaffModuleRouter.access&&window.SalamatStaffModuleRouter.access.panel||''}catch(error){}
 var accessControl='';
 try{accessControl=window.SalamatAccessControl&&window.SalamatAccessControl.panelType||''}catch(error){}
 return String(accessControl||accessPanel||window.__salamatResolvedPanel||'').toUpperCase();
}
function roleCode(){
 var user=currentUser();
 var routedRole='';
 try{routedRole=window.SalamatStaffModuleRouter&&window.SalamatStaffModuleRouter.access&&window.SalamatStaffModuleRouter.access.user&&window.SalamatStaffModuleRouter.access.user.role||''}catch(error){}
 return String(user.actualRole||user.role||routedRole||window.selectedRole||'').toUpperCase();
}
function hasCaregiverNavigation(){
 return Boolean(q('#sidebarNav [data-caregiver-module-key],#sidebarNav [data-access-module^="caregiver."],#sidebarNav [data-module-key^="caregiver."]'));
}
function isCaregiver(){
 if(!appVisible())return false;
 if(hasCaregiverNavigation())return true;
 var panel=panelCode();
 if(panel==='CAREGIVER')return true;
 if(panel==='STAFF')return false;
 if(roleCode()==='CAREGIVER')return true;
 return normalize((q('#sidebarRole')||{}).textContent).indexOf('مراقب')!==-1;
}
function sourceButtons(){
 var seen=[];
 return qa(SOURCE_SELECTOR).filter(function(node){
  if(!(node instanceof HTMLElement)||node.disabled||node.hidden||node.getAttribute('aria-hidden')==='true')return false;
  if(seen.indexOf(node)!==-1)return false;
  seen.push(node);return true;
 });
}
function sourceLabel(node){
 if(!node)return'';
 var explicit=node.getAttribute('aria-label')||(node.dataset&&node.dataset.label)||'';
 if(explicit)return normalize(explicit);
 var clone=node.cloneNode(true);
 qa('b,[data-icon],svg,.badge,.count',clone).forEach(function(child){child.remove()});
 return normalize(clone.textContent);
}
function aliases(label){
 var value=compact(label);
 if(value==='خانه'||value.indexOf('داشبورد')!==-1)return['داشبورد','داشبورد مراقب','داشبورد کاربر','خانه'];
 if(value.indexOf('اعتبار')!==-1||value.indexOf('کیفپول')!==-1||value.indexOf('تسهیلات')!==-1)return['کیف پول و اعتبارات','کیف پول','اعتبارات مالی','اعتبارات','اعتبار','تسهیلات'];
 if(value.indexOf('آموزش')!==-1||value.indexOf('دوره')!==-1)return['آموزش‌های من','بانک آموزش','آموزش','دوره‌ها'];
 if(value.indexOf('پشتیبان')!==-1||value.indexOf('تیکت')!==-1)return['پشتیبانی پرونده','پشتیبانی قراردادها','پشتیبانی','تیکت‌ها'];
 if(value.indexOf('تقویم')!==-1||value.indexOf('شیفت')!==-1)return['تقویم کاری','تقویم','شیفت‌ها'];
 if(value.indexOf('ارزیابی')!==-1||value.indexOf('کارنامه')!==-1||value.indexOf('امتیاز')!==-1||value.indexOf('پروانه')!==-1)return['کارنامه کاری','ارزیابی و پروانه','پایش و امتیازات','ارزیابی'];
 if(value.indexOf('قرارداد')!==-1)return['قراردادهای من','قراردادها','قرارداد'];
 if(value.indexOf('پروفایل')!==-1||value.indexOf('حساب')!==-1)return['پروفایل من','پروفایل','اطلاعات پروفایل','حساب کاربری'];
 return[normalize(label)];
}
function findSource(label){
 var wanted=aliases(label).map(compact).filter(Boolean);
 var sources=sourceButtons();
 var exact=sources.find(function(node){return wanted.indexOf(compact(sourceLabel(node)))!==-1});
 if(exact)return exact;
 return sources.find(function(node){var value=compact(sourceLabel(node));return value&&wanted.some(function(term){return value.indexOf(term)!==-1||term.indexOf(value)!==-1})})||null;
}
function sourceKey(source){
 if(!source||!source.dataset)return'';
 return String(source.dataset.caregiverModuleKey||source.dataset.accessModule||source.dataset.moduleKey||source.dataset.route||source.dataset.view||'');
}
function removeMobileHome(){
 var content=q('#content');
 if(content)content.classList.remove('sa-mobile-home-active');
 var home=q('#'+HOME_ID);
 if(home&&home.parentNode)home.parentNode.removeChild(home);
}
function safeScrollTop(){
 try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(error){try{window.scrollTo(0,0)}catch(ignore){}}
}
function scheduleSync(){
 clearTimeout(syncTimer);
 syncTimer=setTimeout(function(){
  try{if(window.SalamatMobileShell&&typeof window.SalamatMobileShell.sync==='function')window.SalamatMobileShell.sync()}catch(error){}
  safeScrollTop();
 },20);
 setTimeout(function(){try{if(window.SalamatMobileShell&&typeof window.SalamatMobileShell.sync==='function')window.SalamatMobileShell.sync()}catch(error){}},140);
 setTimeout(function(){try{if(window.SalamatMobileShell&&typeof window.SalamatMobileShell.sync==='function')window.SalamatMobileShell.sync()}catch(error){}},360);
}
function finish(label){
 scheduleSync();
 try{window.dispatchEvent(new CustomEvent('salamat-mobile-navigation-complete',{detail:{label:label,caregiverInteractionVersion:VERSION}}))}catch(error){}
}
function clickSource(source,label){
 if(!source)return false;
 removeMobileHome();
 try{HTMLElement.prototype.click.call(source);finish(label||sourceLabel(source));return true}catch(error){}
 try{source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));finish(label||sourceLabel(source));return true}catch(error){}
 return false;
}
function openProfile(){
 removeMobileHome();
 try{if(window.SalamatCaregiverSelfProfile&&typeof window.SalamatCaregiverSelfProfile.open==='function'){window.SalamatCaregiverSelfProfile.open();finish('پروفایل');return true}}catch(error){}
 var source=findSource('پروفایل');
 if(source)return clickSource(source,'پروفایل');
 var avatar=q('#topAvatar')||q('#sidebarAvatar');
 if(avatar){try{HTMLElement.prototype.click.call(avatar);finish('پروفایل');return true}catch(error){}}
 return false;
}
function openLabel(label){
 var clean=normalize(label);
 if(!clean)return false;
 var value=compact(clean);
 if(value.indexOf('پروفایل')!==-1||value.indexOf('حسابکاربری')!==-1)return openProfile();
 var source=findSource(clean);
 var key=sourceKey(source);
 var owner=window.SalamatCaregiverCanonicalRouteOwner;
 var isHome=value==='خانه'||value.indexOf('داشبورد')!==-1;
 if(isHome){
  removeMobileHome();
  try{
   if(owner&&typeof owner.openDashboard==='function'){
    Promise.resolve(owner.openDashboard()).then(function(){finish(clean)},function(){if(source)clickSource(source,clean)});
    return true;
   }
  }catch(error){}
  if(source)return clickSource(source,clean);
  return false;
 }
 removeMobileHome();
 try{
  if(owner&&typeof owner.openModule==='function'&&key&&key.indexOf('caregiver.')===0){
   Promise.resolve(owner.openModule(key)).then(function(){finish(clean)},function(error){console.warn('[caregiver-interaction] canonical route failed',key,error);if(source)clickSource(source,clean)});
   return true;
  }
 }catch(error){}
 if(source)return clickSource(source,clean);
 return false;
}
function cardLabel(card){
 if(!card)return'';
 return normalize((card.dataset&&card.dataset.label)||card.getAttribute('aria-label')||(q('span:last-child',card)||{}).textContent||card.textContent);
}
function navLabel(button){
 if(!button)return'';
 return normalize((button.dataset&&button.dataset.label)||button.getAttribute('aria-label')||(q('span:last-child',button)||{}).textContent||button.textContent);
}
function onClick(event){
 if(!isCaregiver())return;
 var target=event.target;
 if(!(target instanceof Element))return;
 var card=target.closest('#'+HOME_ID+' .sa-home-module');
 var nav=target.closest('#'+BOTTOM_ID+' button');
 var avatar=target.closest('.sa-mobile-header-avatar');
 if(!card&&!nav&&!avatar)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 if(avatar){openProfile();return}
 if(card){openLabel(cardLabel(card));return}
 if(nav){openLabel(navLabel(nav));return}
}
function patchLogin(){
 if(!MEDIA.matches)return;
 var form=q('#loginForm');
 if(form){form.noValidate=true;form.setAttribute('novalidate','novalidate')}
 var email=q('#emailFields');
 if(!email)return;
 var input=q('input[type="email"],input[type="text"]',email);
 if(input){
  if(String(input.type||'').toLowerCase()!=='text'){try{input.type='text'}catch(error){}}
  if(!input.id)input.id='backendIdentifierInput';
  input.setAttribute('autocomplete','username');
  input.setAttribute('autocapitalize','none');
  input.setAttribute('autocorrect','off');
  input.setAttribute('spellcheck','false');
  input.setAttribute('inputmode','text');
 }
 var password=q('input[type="password"]',email);
 if(password){password.setAttribute('autocomplete','current-password');password.setAttribute('autocapitalize','none');password.setAttribute('autocorrect','off');password.setAttribute('spellcheck','false')}
 var video=q('#salamatMobileExactLoginV2 video')||q('#loginIntroVideo');
 if(video){video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.setAttribute('muted','');video.muted=true}
}
function addStyles(){
 if(q('#salamatMobileCaregiverInteractionV1Styles'))return;
 var style=document.createElement('style');
 style.id='salamatMobileCaregiverInteractionV1Styles';
 style.textContent='@media(max-width:760px){#'+HOME_ID+' .sa-home-module,#'+BOTTOM_ID+' button,.sa-mobile-header-avatar{cursor:pointer!important;-webkit-tap-highlight-color:transparent!important;touch-action:manipulation!important}body.salamat-mobile-login-exact{min-height:100vh!important;-webkit-overflow-scrolling:touch!important}body.salamat-mobile-login-exact #loginView.login-page,body.salamat-mobile-login-exact #loginView .login-shell,body.salamat-mobile-login-exact #loginView .login-content{min-height:100vh!important}#sidebar.sidebar{height:100vh!important}}@supports(height:100svh){@media(max-width:760px){body.salamat-mobile-login-exact #loginView.login-page,body.salamat-mobile-login-exact #loginView .login-shell,body.salamat-mobile-login-exact #loginView .login-content{min-height:100svh!important}}}@supports(height:100dvh){@media(max-width:760px){#sidebar.sidebar{height:100dvh!important}}}';
 (document.head||document.documentElement).appendChild(style);
}
function resync(){patchLogin();scheduleSync()}
function installObserver(){
 if(observer)observer.disconnect();
 var login=q('#loginView');
 if(!login)return;
 observer=new MutationObserver(function(){patchLogin()});
 observer.observe(login,{childList:true,subtree:true,attributes:true,attributeFilter:['class','type','hidden','aria-hidden']});
}
function mediaChanged(){addStyles();patchLogin();scheduleSync()}
function boot(){
 addStyles();patchLogin();installObserver();
 document.addEventListener('click',onClick,true);
 window.addEventListener('pageshow',function(){patchLogin();scheduleSync()});
 window.addEventListener('salamat-authenticated',function(){setTimeout(function(){installObserver();scheduleSync()},0)});
 window.addEventListener('salamat-logged-out',function(){setTimeout(function(){patchLogin();installObserver()},0)});
 window.addEventListener('salamat-mobile-login-surface',patchLogin);
 window.addEventListener('salamat-access-ready',scheduleSync);
 window.addEventListener('salamat-shell-ready',scheduleSync);
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')resync()});
 if(MEDIA.addEventListener)MEDIA.addEventListener('change',mediaChanged);else if(MEDIA.addListener)MEDIA.addListener(mediaChanged);
 window.SalamatMobileCaregiverInteraction={version:VERSION,openLabel:openLabel,openProfile:openProfile,sync:resync};
 try{window.dispatchEvent(new CustomEvent('salamat-mobile-caregiver-interaction-ready',{detail:{version:VERSION}}))}catch(error){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
