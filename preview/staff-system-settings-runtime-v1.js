(()=>{
'use strict';
if(window.__salamatStaffSystemSettingsRuntimeV1)return;
window.__salamatStaffSystemSettingsRuntimeV1=true;

const VERSION='1.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const pdate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return String(value)}};
const state={access:null,settings:null,logs:null,tab:'settings',query:'',action:'',page:1,loading:false};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;throw error}
  return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function moduleAccess(){return state.access?.allModules?.find(module=>module.key==='staff.settings')?.actions||{}}
function can(action){return Boolean(moduleAccess()[action])}
function setPage(html){
  const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
  if(title)title.textContent='تنظیمات و لاگ';
  if(subtitle)subtitle.textContent='تنظیمات عملیاتی ذخیره‌شده و رخدادهای واقعی حسابرسی سامانه';
  if(content)content.innerHTML=`<section class="module-page sss-root">${html}</section>`;
}
function addStyles(){
  if($('#staffSystemSettingsStylesV1'))return;
  const style=document.createElement('style');style.id='staffSystemSettingsStylesV1';style.textContent=`
.sss-root{direction:rtl;display:grid;gap:14px}.sss-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.sss-head h2{margin:0;font-size:21px}.sss-head p{margin:6px 0 0;color:#728078;font-size:10px}.sss-tabs,.sss-actions{display:flex;gap:7px;flex-wrap:wrap}.sss-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.sss-btn.primary,.sss-btn.active{background:#078848;color:#fff}.sss-btn:disabled{opacity:.45;pointer-events:none}.sss-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 10px 28px rgba(22,70,46,.04);overflow:hidden}.sss-card-head{padding:14px 16px;border-bottom:1px solid #eaf0ed;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.sss-card-head h3{margin:0;font-size:14px}.sss-card-head p{margin:5px 0 0;color:#7a8981;font-size:8px}.sss-card-body{padding:14px}.sss-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sss-field{display:grid;gap:5px}.sss-field.wide{grid-column:1/-1}.sss-field span{font-size:8px;font-weight:900;color:#40564a}.sss-input{width:100%;box-sizing:border-box;border:1px solid #d7e3dd;border-radius:11px;padding:10px;font:inherit;font-size:9px;outline:none}.sss-note{padding:11px 12px;border-radius:12px;background:#f3f9f6;color:#607269;font-size:8px;line-height:1.9}.sss-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 220px auto;gap:8px}.sss-list{display:grid;gap:8px}.sss-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px;border:1px solid #e0eae5;border-radius:14px}.sss-row strong{display:block;font-size:10px}.sss-row small{display:block;margin-top:5px;color:#7a8981;font-size:8px;line-height:1.8}.sss-code{margin-top:7px;padding:8px;border-radius:10px;background:#f5f8f6;color:#42574c;font:7px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto;direction:ltr;text-align:left}.sss-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:7px;font-weight:900}.sss-empty{padding:36px;text-align:center;border:1px dashed #cfddd6;border-radius:16px;color:#6d7b74;background:#fbfdfc}.sss-pagination{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;color:#6d7b74;font-size:8px}@media(max-width:800px){.sss-form{grid-template-columns:1fr}.sss-field.wide{grid-column:auto}.sss-toolbar{grid-template-columns:1fr}.sss-row{grid-template-columns:1fr}}
`;document.head.appendChild(style);
}
function applySettings(settings){
  if(!settings)return;
  const brand=$('.sidebar-brand strong');if(brand)brand.textContent=settings.systemName||'باشگاه مراقبین';
  const help=$('.sidebar-help');if(help){const strong=help.querySelector('strong'),small=help.querySelector('small'),link=help.querySelector('a');if(strong)strong.textContent=settings.supportAvailability||'پشتیبانی';if(small)small.textContent=settings.supportDescription||'';if(link){link.textContent=settings.supportPhone||'1527';link.href=`tel:${String(settings.supportPhone||'1527').replace(/\s+/g,'')}`}}
  document.title=settings.systemName||document.title;
}
function tabs(){return `<div class="sss-tabs"><button class="sss-btn ${state.tab==='settings'?'active':''}" data-sss-tab="settings">تنظیمات سامانه</button><button class="sss-btn ${state.tab==='logs'?'active':''}" data-sss-tab="logs">لاگ فعالیت‌ها</button></div>`}
function settingsMarkup(){
  const s=state.settings?.settings||{};
  return `<article class="sss-card"><header class="sss-card-head"><div><h3>تنظیمات عملیاتی رابط سامانه</h3><p>این مقادیر در دیتابیس ذخیره می‌شوند و بلافاصله روی پنل اعمال می‌شوند.</p></div><span class="sss-badge">نسخه ${esc(state.settings?.version||VERSION)}</span></header><div class="sss-card-body"><form class="sss-form" id="sssSettingsForm"><label class="sss-field"><span>نام سامانه</span><input class="sss-input" name="systemName" value="${esc(s.systemName||'')}"></label><label class="sss-field"><span>نام سازمان</span><input class="sss-input" name="organizationName" value="${esc(s.organizationName||'')}"></label><label class="sss-field"><span>شماره پشتیبانی</span><input class="sss-input" name="supportPhone" value="${esc(s.supportPhone||'')}"></label><label class="sss-field"><span>عنوان دسترسی پشتیبانی</span><input class="sss-input" name="supportAvailability" value="${esc(s.supportAvailability||'')}"></label><label class="sss-field wide"><span>توضیح پشتیبانی</span><input class="sss-input" name="supportDescription" value="${esc(s.supportDescription||'')}"></label><div class="sss-note wide">آخرین به‌روزرسانی: ${pdate(state.settings?.updatedAt)}. هر تغییر با نام مدیر، زمان و IP در لاگ حسابرسی ثبت می‌شود.</div><button class="sss-btn primary" type="submit" ${!can('update')?'disabled':''}>ذخیره تنظیمات</button></form></div></article>`;
}
function logsMarkup(){
  const data=state.logs||{},rows=data.logs||[],p=data.pagination||{page:1,pages:1,total:0},actions=data.actions||[];
  return `<article class="sss-card"><header class="sss-card-head"><div><h3>رخدادهای واقعی حسابرسی</h3><p>عملیات ثبت، تغییر دسترسی، پرداخت، آموزش، ارزیابی و تنظیمات.</p></div><button class="sss-btn" data-sss-refresh>به‌روزرسانی</button></header><div class="sss-card-body"><form class="sss-toolbar" id="sssLogFilter"><input class="sss-input" name="q" value="${esc(state.query)}" placeholder="جست‌وجوی کاربر، عملیات، موجودیت یا IP"><select class="sss-input" name="action"><option value="">همه عملیات‌ها</option>${actions.map(item=>`<option value="${esc(item.action)}" ${state.action===item.action?'selected':''}>${esc(item.action)} (${fa(item.count)})</option>`).join('')}</select><button class="sss-btn" type="submit">اعمال فیلتر</button></form><div class="sss-list" style="margin-top:12px">${rows.length?rows.map(item=>`<div class="sss-row"><div><strong>${esc(item.action)} • ${esc(item.entityType)}</strong><small>${esc(item.actorName||'سیستم')} ${item.actorRole?`(${esc(item.actorRole)})`:''} • ${pdate(item.createdAt)}<br>شناسه: ${esc(item.entityId||'—')} • IP: ${esc(item.ipAddress||'—')}</small>${item.after?`<div class="sss-code">${esc(JSON.stringify(item.after,null,2))}</div>`:''}</div><span class="sss-badge">${esc(item.actorRole||'SYSTEM')}</span></div>`).join(''):'<div class="sss-empty">لاگی مطابق فیلتر پیدا نشد.</div>'}</div><div class="sss-pagination"><span>${fa(p.total||0)} رخداد • صفحه ${fa(p.page||1)} از ${fa(p.pages||1)}</span><div class="sss-actions"><button class="sss-btn" data-sss-page="${Math.max(1,(p.page||1)-1)}" ${(p.page||1)<=1?'disabled':''}>قبلی</button><button class="sss-btn" data-sss-page="${Math.min(p.pages||1,(p.page||1)+1)}" ${(p.page||1)>=(p.pages||1)?'disabled':''}>بعدی</button></div></div></div></article>`;
}
function render(){setPage(`<header class="sss-head"><div><h2>تنظیمات و لاگ سامانه</h2><p>این بخش دیگر نمایشی نیست؛ تنظیمات ذخیره و لاگ‌ها مستقیماً از سرور خوانده می‌شوند.</p></div>${tabs()}</header>${state.tab==='logs'?logsMarkup():settingsMarkup()}`)}
async function loadLogs(){const payload=await api(`/api/staff/audit-logs?page=${state.page}&q=${encodeURIComponent(state.query)}&action=${encodeURIComponent(state.action)}`);state.logs=payload.data||{};}
async function load(){
  if(state.loading)return;state.loading=true;setPage('<div class="sss-empty">در حال دریافت تنظیمات و لاگ‌ها...</div>');
  try{
    const [accessPayload,settingsPayload]=await Promise.all([api('/api/access/me'),api('/api/staff/system-settings')]);
    state.access=accessPayload.data||null;state.settings=settingsPayload.data||{};applySettings(state.settings.settings);if(state.tab==='logs')await loadLogs();render();
  }catch(error){setPage(`<div class="sss-empty">${esc(error.message)}</div>`)}finally{state.loading=false}
}
async function click(event){
  const tab=event.target?.closest?.('[data-sss-tab]');if(tab){event.preventDefault();state.tab=tab.dataset.sssTab;if(state.tab==='logs'&&!state.logs){setPage('<div class="sss-empty">در حال دریافت لاگ‌ها...</div>');try{await loadLogs();render()}catch(error){notify('لاگ‌ها دریافت نشد',error.message)}}else render();return}
  if(event.target?.closest?.('[data-sss-refresh]')){event.preventDefault();try{await loadLogs();render();notify('به‌روزرسانی شد','آخرین رخدادها دریافت شدند.')}catch(error){notify('به‌روزرسانی انجام نشد',error.message)}return}
  const page=event.target?.closest?.('[data-sss-page]');if(page){event.preventDefault();state.page=Number(page.dataset.sssPage||1);try{await loadLogs();render()}catch(error){notify('صفحه دریافت نشد',error.message)}}
}
async function submit(event){
  if(event.target?.id==='sssLogFilter'){event.preventDefault();const data=Object.fromEntries(new FormData(event.target));state.query=String(data.q||'');state.action=String(data.action||'');state.page=1;try{await loadLogs();render()}catch(error){notify('فیلتر اعمال نشد',error.message)}return}
  if(event.target?.id!=='sssSettingsForm')return;
  event.preventDefault();const settings=Object.fromEntries(new FormData(event.target));
  try{const payload=await api('/api/staff/system-settings',{method:'PUT',body:JSON.stringify({settings})});state.settings=payload.data||{};applySettings(state.settings.settings);render();notify('تنظیمات ذخیره شد','تغییرات روی پنل اعمال و در لاگ ثبت شد.')}catch(error){notify('ذخیره انجام نشد',error.message)}
}
function boot(){addStyles();document.addEventListener('click',event=>void click(event),true);document.addEventListener('submit',event=>void submit(event),true);window.SalamatSystemTools={version:VERSION,open:load,reload:load,apply:applySettings}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
