(()=>{
'use strict';
if(window.__salamatServerNotificationsV2)return;
window.__salamatServerNotificationsV2=true;
window.__salamatServerNotificationsV1=true;

const VERSION='2.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state={items:[],unread:0,timer:0,initialized:false,refreshing:false};

async function api(path,options={}){
 if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
 const headers=new Headers(options.headers||{});if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{}
 if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);return payload;
}
function formatTime(value){try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return ''}}
function button(){return $('.round-btn.notification')}
function caregiverPanel(){const role=String(window.SalamatBackend?.getCurrentUser?.()?.role||window.SalamatAccessControl?.access?.user?.role||$('#sidebarRole')?.textContent||'').toUpperCase();return role==='CAREGIVER'||String($('#sidebarRole')?.textContent||'').includes('مراقب')}
function updateBadge(){const target=button();if(!target)return;target.id='serverNotificationButton';let badge=$('i',target);if(!badge){badge=document.createElement('i');target.appendChild(badge)}badge.textContent=Number(state.unread||0)>9?'۹+':Number(state.unread||0).toLocaleString('fa-IR');badge.hidden=!state.unread;target.classList.toggle('has-unread',Boolean(state.unread));target.setAttribute('aria-label',state.unread?`${state.unread} اعلان خوانده‌نشده`:'مرکز اعلان‌ها')}
function ensurePanel(){
 let panel=$('#serverNotificationPanel');if(panel?.dataset.notificationVersion===VERSION)return panel;
 panel?.remove();$('#globalNotificationPanel')?.remove();panel=document.createElement('aside');panel.id='serverNotificationPanel';panel.dataset.notificationVersion=VERSION;panel.className='global-notification-panel hidden';panel.setAttribute('aria-hidden','true');panel.innerHTML='<header><div><small>مرکز اعلان‌های سلامت اول</small><h3>پیام‌ها و تغییرات مرتبط با شما</h3></div><button type="button" data-server-notice-close aria-label="بستن">×</button></header><div class="global-notification-body"></div><footer><button type="button" data-server-notice-read-all style="border:0;background:transparent;color:#087a45;font:inherit;font-weight:900;cursor:pointer">خواندن همه اعلان‌ها</button></footer>';document.body.appendChild(panel);
 $('[data-server-notice-close]',panel).addEventListener('click',close);
 $('[data-server-notice-read-all]',panel).addEventListener('click',async()=>{try{await api('/api/notifications/read-all',{method:'POST'});state.items=state.items.map(item=>({...item,readAt:item.readAt||new Date().toISOString()}));state.unread=0;renderPanel();updateBadge();window.dispatchEvent(new CustomEvent('salamat-notifications-read-all'))}catch{}});
 return panel;
}
function renderPanel(){
 const panel=ensurePanel(),body=$('.global-notification-body',panel),items=state.items||[];
 body.innerHTML=items.length?items.map(item=>`<button type="button" class="global-notification-item ${item.readAt?'':'important'}" data-server-notice-id="${esc(item.id)}" data-server-notice-route="${esc(item.route||'')}"><span>${item.readAt?'خوانده‌شده':'جدید'}</span><strong>${esc(item.title)}</strong><small>${esc(item.message)}</small><small style="margin-top:6px;opacity:.7">${esc(formatTime(item.createdAt))}</small></button>`).join(''):'<div class="global-notification-empty"><strong>اعلان تازه‌ای وجود ندارد</strong><small>پیام‌های پشتیبانی، وضعیت مرخصی و تغییرات مهم اینجا نمایش داده می‌شوند.</small></div>';
 body.querySelectorAll('[data-server-notice-id]').forEach(item=>item.addEventListener('click',async()=>{const id=item.dataset.serverNoticeId,route=item.dataset.serverNoticeRoute;try{await api(`/api/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'})}catch{}const record=state.items.find(entry=>entry.id===id);if(record&&!record.readAt){record.readAt=new Date().toISOString();state.unread=Math.max(0,state.unread-1)}updateBadge();close();navigate(route)}));
}
function navigate(route){
 if(!route)return;
 if(String(route).startsWith('support:')){
  const threadId=String(route).slice('support:'.length);
  window.dispatchEvent(new CustomEvent(caregiverPanel()?'salamat-open-caregiver-support-thread':'salamat-open-support-thread',{detail:{threadId,source:'notification'}}));return;
 }
 const nav=[...document.querySelectorAll('#sidebarNav .nav-item,#sidebarNav button')].find(item=>String(item.textContent||'').includes(route));if(nav){nav.click();return}try{window.renderModule?.(window.roles?.caregiver,['home',route])}catch{}
}
function announceNew(previousItems,nextItems){
 if(!state.initialized)return;
 const previous=new Set(previousItems.filter(item=>!item.readAt).map(item=>item.id));
 const support=nextItems.find(item=>!item.readAt&&item.category==='SUPPORT_MESSAGE'&&!previous.has(item.id));
 if(support){try{window.toast?.('پیام خوانده‌نشده پشتیبانی','شما یک پیام خوانده‌نشده از پشتیبانی دارید.')}catch{}}
}
async function refresh(){
 if(state.refreshing)return;state.refreshing=true;
 try{const previous=state.items;const result=await api('/api/notifications?limit=50');const next=result.data||[];announceNew(previous,next);state.items=next;state.unread=Number(result.unread||0);updateBadge();if(!ensurePanel().classList.contains('hidden'))renderPanel();state.initialized=true}catch{state.items=[];state.unread=0;updateBadge()}finally{state.refreshing=false}
}
function open(){const panel=ensurePanel();renderPanel();panel.classList.remove('hidden');panel.setAttribute('aria-hidden','false')}
function close(){const panel=$('#serverNotificationPanel');panel?.classList.add('hidden');panel?.setAttribute('aria-hidden','true')}
function capture(event){const target=event.target?.closest?.('.round-btn.notification');if(!target)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const panel=ensurePanel();panel.classList.contains('hidden')?open():close()}
function boot(){
 document.addEventListener('click',capture,true);document.addEventListener('click',event=>{if(!event.target.closest('#serverNotificationPanel')&&!event.target.closest('.round-btn.notification'))close()});
 for(const eventName of ['salamat-identity-changed','salamat-access-changed','salamat-authenticated','salamat-notifications-refresh','salamat-support-thread-read'])window.addEventListener(eventName,()=>setTimeout(refresh,80));
 void refresh();clearInterval(state.timer);state.timer=setInterval(refresh,30000);window.SalamatServerNotifications={version:VERSION,refresh,open,close,navigate};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
