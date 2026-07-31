(()=>{
'use strict';

if(window.__salamatServerNotificationsV1)return;
window.__salamatServerNotificationsV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let cached={items:[],unread:0};
let timer=null;

async function api(path,options={}){
  if(window.SalamatBackend?.api)return window.SalamatBackend.api(path,options);
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={}}
  if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);return payload;
}
function formatTime(value){try{return new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return ''}}
function button(){return $('.round-btn.notification')}
function updateBadge(){const target=button();if(!target)return;target.id='serverNotificationButton';let badge=$('i',target);if(!badge){badge=document.createElement('i');target.appendChild(badge)}badge.textContent=String(Math.min(9,Number(cached.unread||0)));badge.hidden=!cached.unread;target.classList.toggle('has-unread',Boolean(cached.unread));target.setAttribute('aria-label',cached.unread?`${cached.unread} اعلان خوانده‌نشده`:'مرکز اعلان‌ها')}
function ensurePanel(){let panel=$('#serverNotificationPanel');if(panel)return panel;$('#globalNotificationPanel')?.remove();panel=document.createElement('aside');panel.id='serverNotificationPanel';panel.className='global-notification-panel hidden';panel.setAttribute('aria-hidden','true');panel.innerHTML='<header><div><small>مرکز اعلان‌های سلامت اول</small><h3>پیام‌ها و تغییرات مرتبط با شما</h3></div><button type="button" data-server-notice-close aria-label="بستن">×</button></header><div class="global-notification-body"></div><footer><button type="button" data-server-notice-read-all style="border:0;background:transparent;color:#087a45;font:inherit;font-weight:900;cursor:pointer">خواندن همه اعلان‌ها</button></footer>';document.body.appendChild(panel);$('[data-server-notice-close]',panel).addEventListener('click',close);$('[data-server-notice-read-all]',panel).addEventListener('click',async()=>{try{await api('/api/notifications/read-all',{method:'POST'});cached.items=cached.items.map(item=>({...item,readAt:item.readAt||new Date().toISOString()}));cached.unread=0;renderPanel();updateBadge()}catch{}});return panel}
function renderPanel(){const panel=ensurePanel(),body=$('.global-notification-body',panel),items=cached.items||[];body.innerHTML=items.length?items.map(item=>`<button type="button" class="global-notification-item ${item.readAt?'':'important'}" data-server-notice-id="${esc(item.id)}" data-server-notice-route="${esc(item.route||'')}"><span>${item.readAt?'خوانده‌شده':'جدید'}</span><strong>${esc(item.title)}</strong><small>${esc(item.message)}</small><small style="margin-top:6px;opacity:.7">${esc(formatTime(item.createdAt))}</small></button>`).join(''):'<div class="global-notification-empty"><strong>اعلان تازه‌ای وجود ندارد</strong><small>پیام‌های پشتیبانی، وضعیت مرخصی و تغییرات مهم اینجا نمایش داده می‌شوند.</small></div>';body.querySelectorAll('[data-server-notice-id]').forEach(item=>item.addEventListener('click',async()=>{const id=item.dataset.serverNoticeId,route=item.dataset.serverNoticeRoute;try{await api(`/api/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'})}catch{}const record=cached.items.find(entry=>entry.id===id);if(record&&!record.readAt){record.readAt=new Date().toISOString();cached.unread=Math.max(0,cached.unread-1)}updateBadge();close();navigate(route)}))}
function navigate(route){if(!route)return;const nav=[...document.querySelectorAll('#sidebarNav .nav-item,#sidebarNav button')].find(item=>String(item.textContent||'').includes(route));if(nav){nav.click();return}try{window.renderModule?.(window.roles?.caregiver,['home',route])}catch{}}
async function refresh(){try{const result=await api('/api/notifications?limit=30');cached={items:result.data||[],unread:Number(result.unread||0)};updateBadge();if(!ensurePanel().classList.contains('hidden'))renderPanel()}catch{}}
function open(){const panel=ensurePanel();renderPanel();panel.classList.remove('hidden');panel.setAttribute('aria-hidden','false')}
function close(){const panel=$('#serverNotificationPanel');panel?.classList.add('hidden');panel?.setAttribute('aria-hidden','true')}
function capture(event){const target=event.target?.closest?.('.round-btn.notification');if(!target)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const panel=ensurePanel();panel.classList.contains('hidden')?open():close()}
function boot(){document.addEventListener('click',capture,true);document.addEventListener('click',event=>{if(!event.target.closest('#serverNotificationPanel')&&!event.target.closest('.round-btn.notification'))close()});void refresh();timer=setInterval(refresh,60000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
