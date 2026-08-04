(()=>{
'use strict';
if(window.__salamatCaregiverTrainingDirectV2)return;
window.__salamatCaregiverTrainingDirectV2=true;

const VERSION='2.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
let session=null;
let currentItems=[];

async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
 const text=await response.text();let payload={};
 try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}
 return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function setPage(title,subtitle,html){
 const pageTitle=$('#pageTitle'),pageSubtitle=$('#pageSubtitle'),content=$('#content');
 if(pageTitle)pageTitle.textContent=title;
 if(pageSubtitle)pageSubtitle.textContent=subtitle;
 if(content)content.innerHTML=`<section class="module-page cgt2-root">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
}
function fmtSeconds(value){
 const seconds=Math.max(0,Math.floor(Number(value||0))),hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),rest=seconds%60;
 if(hours)return `${fa(hours)} ساعت و ${fa(minutes)} دقیقه`;
 if(minutes)return `${fa(minutes)} دقیقه و ${fa(rest)} ثانیه`;
 return `${fa(rest)} ثانیه`;
}
function fmtDate(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return String(value)}}
function statusLabel(value){return ({ASSIGNED:'ارسال‌شده',IN_PROGRESS:'در حال مشاهده',COMPLETED:'تکمیل‌شده',CANCELLED:'لغوشده'})[String(value||'').toUpperCase()]||String(value||'—')}
function loading(text='در حال دریافت آموزش‌های تخصیص‌یافته...'){return `<div class="cgt2-loading"><span></span><strong>${esc(text)}</strong></div>`}
function errorBox(text){return `<div class="cgt2-error"><strong>دریافت آموزش انجام نشد</strong><small>${esc(text)}</small><button class="cgt2-btn primary" data-cgt2-retry>تلاش مجدد</button></div>`}
function safeUrl(value){
 try{
  const url=new URL(String(value||''),window.location.origin);
  if(!['http:','https:'].includes(url.protocol))return '';
  return url.href;
 }catch{return ''}
}
function viewer(item){
 const url=safeUrl(item.contentUrl);
 if(!url)return '<div class="cgt2-empty"><strong>محتوای آموزش هنوز بارگذاری نشده است.</strong><small>برای پیگیری با واحد آموزش تماس بگیرید.</small></div>';
 const safe=esc(url),path=new URL(url).pathname.toLowerCase();
 if(/\.(mp4|webm|mov)$/.test(path))return `<video controls preload="metadata" src="${safe}"></video>`;
 if(/\.(mp3|m4a|wav|ogg)$/.test(path))return `<audio controls preload="metadata" src="${safe}"></audio>`;
 return `<iframe src="${safe}" title="${esc(item.title||'محتوای آموزش')}" loading="eager" referrerpolicy="same-origin"></iframe>`;
}
function addStyles(){
 if($('#caregiverTrainingDirectV2Styles'))return;
 const style=document.createElement('style');style.id='caregiverTrainingDirectV2Styles';style.textContent=`
.cgt2-root{direction:rtl;display:grid;gap:14px}.cgt2-loading,.cgt2-error,.cgt2-empty{min-height:220px;border:1px dashed #cfe0d7;border-radius:20px;background:#fbfdfc;display:grid;place-items:center;align-content:center;gap:9px;text-align:center;color:#64776c;padding:22px}.cgt2-loading span{width:30px;height:30px;border:3px solid #dcece4;border-top-color:#078848;border-radius:50%;animation:cgt2spin .8s linear infinite}.cgt2-loading strong,.cgt2-error strong,.cgt2-empty strong{font-size:12px}.cgt2-error small,.cgt2-empty small{font-size:9px;line-height:1.9}.cgt2-error{background:#fff8f8;border-color:#efcfd5;color:#9b3244}@keyframes cgt2spin{to{transform:rotate(360deg)}}.cgt2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px;border-radius:24px;background:linear-gradient(135deg,#087a45,#075b38);color:#fff}.cgt2-head h2{margin:8px 0 4px;color:#fff;font-size:22px}.cgt2-head p{margin:0;color:rgba(255,255,255,.82);font-size:9px;line-height:1.9}.cgt2-eyebrow{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:8px;font-weight:900}.cgt2-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.cgt2-kpi,.cgt2-card{background:#fff;border:1px solid #dce8e2;border-radius:18px;box-shadow:0 9px 26px rgba(20,70,45,.04)}.cgt2-kpi{padding:15px}.cgt2-kpi small{display:block;color:#74847c;font-size:8px}.cgt2-kpi strong{display:block;margin-top:7px;color:#087a45;font-size:19px}.cgt2-kpi span{display:block;margin-top:5px;color:#7c8982;font-size:8px}.cgt2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.cgt2-card{padding:15px;display:flex;flex-direction:column;gap:10px}.cgt2-card header{display:flex;justify-content:space-between;gap:10px}.cgt2-card h3{margin:5px 0 0;font-size:13px;line-height:1.7}.cgt2-card p{margin:0;color:#718078;font-size:8px;line-height:1.9;min-height:45px}.cgt2-badge{height:max-content;display:inline-flex;padding:5px 8px;border-radius:999px;background:#eaf7f0;color:#087847;font-size:7px;font-weight:900;white-space:nowrap}.cgt2-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.cgt2-meta div{padding:9px;border-radius:11px;background:#f5f8f6}.cgt2-meta small{display:block;color:#7a8881;font-size:7px}.cgt2-meta b{display:block;margin-top:4px;font-size:8px}.cgt2-progress{height:7px;border-radius:999px;background:#e9f0ec;overflow:hidden}.cgt2-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#078848,#54bd81)}.cgt2-btn{border:0;border-radius:11px;padding:10px 13px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.cgt2-btn.primary{background:#078848;color:#fff}.cgt2-btn.outline{background:#fff;color:#087847;border:1px solid #cfe0d7}.cgt2-btn:disabled{opacity:.55;cursor:wait}.cgt2-card footer{display:flex;gap:8px;align-items:center;margin-top:auto}.cgt2-card footer .cgt2-btn{flex:1}.cgt2-course{display:grid;gap:13px}.cgt2-course-head{display:flex;justify-content:space-between;gap:16px;padding:18px;border:1px solid #dce8e2;border-radius:20px;background:#fff}.cgt2-course-head h2{margin:8px 0 5px;font-size:21px}.cgt2-course-head p{margin:0;color:#718078;font-size:9px;line-height:1.9}.cgt2-live{min-width:190px;padding:13px;border-radius:15px;background:#edf8f2;text-align:center}.cgt2-live small{display:block;color:#60756a;font-size:8px}.cgt2-live strong{display:block;margin-top:7px;color:#087847;font-size:17px}.cgt2-viewer{min-height:540px;border:1px solid #dce8e2;border-radius:20px;background:#fff;overflow:hidden}.cgt2-viewer iframe,.cgt2-viewer video{display:block;width:100%;height:540px;border:0;background:#f7faf8}.cgt2-viewer audio{display:block;width:calc(100% - 42px);margin:50px auto}.cgt2-actions{display:flex;justify-content:flex-end;gap:8px}@media(max-width:1050px){.cgt2-grid{grid-template-columns:repeat(2,1fr)}.cgt2-summary{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.cgt2-grid,.cgt2-summary{grid-template-columns:1fr}.cgt2-head,.cgt2-course-head{flex-direction:column}.cgt2-live{min-width:0}.cgt2-viewer,.cgt2-viewer iframe,.cgt2-viewer video{height:430px;min-height:430px}}
`;(document.head||document.documentElement).appendChild(style)
}
async function closeSession(){
 const active=session;session=null;
 if(!active)return;
 clearInterval(active.timer);
 try{await api(`/api/training/sessions/${encodeURIComponent(active.id)}/close`,{method:'POST',body:'{}'})}catch{}
}
function beaconClose(){
 if(!session)return;
 try{navigator.sendBeacon(`/api/training/sessions/${encodeURIComponent(session.id)}/close`,new Blob(['{}'],{type:'application/json'}))}catch{}
}
async function openList(){
 addStyles();await closeSession();setPage('آموزش‌های من','آموزش‌های واقعی تخصیص‌یافته از بانک آموزش',loading());
 try{
  const payload=await api('/api/training/my'),data=payload.data||{},items=Array.isArray(data.assignments)?data.assignments:[],summary=data.summary||{};
  currentItems=items;
  const cards=items.map(item=>`<article class="cgt2-card"><header><div><span class="cgt2-eyebrow" style="background:#eaf7f0;color:#087847">${esc(item.category||'آموزش سازمانی')}</span><h3>${esc(item.title||'آموزش بدون عنوان')}</h3></div><span class="cgt2-badge">${esc(statusLabel(item.status))}</span></header><p>${esc(item.description||'توضیحی برای این آموزش ثبت نشده است.')}</p><div class="cgt2-meta"><div><small>تخصیص‌دهنده</small><b>${esc(item.assignedByName||'—')}</b></div><div><small>زمان اسمی</small><b>${fa(item.durationMinutes||0)} دقیقه</b></div><div><small>دفعات مشاهده</small><b>${fa(item.openCount||0)} بار</b></div><div><small>زمان مشاهده فعال</small><b>${esc(fmtSeconds(item.totalViewSeconds||0))}</b></div></div><div class="cgt2-progress"><i style="width:${Math.max(0,Math.min(100,Number(item.progress||0)))}%"></i></div><footer><button class="cgt2-btn primary" data-cgt2-open="${esc(item.enrollmentId)}">مشاهده آموزش</button>${item.mandatory?'<span class="cgt2-badge">الزامی</span>':''}</footer></article>`).join('');
  setPage('آموزش‌های من','فقط محتوای تخصیص‌یافته به پرونده شما',`<section class="cgt2-head"><div><span class="cgt2-eyebrow">باشگاه مراقبین سلامت اول</span><h2>آموزش‌های من</h2><p>محتوا از بانک آموزش سازمان دریافت می‌شود و زمان مشاهده فعال در پرونده شما ثبت خواهد شد.</p></div></section><section class="cgt2-summary"><article class="cgt2-kpi"><small>کل آموزش‌ها</small><strong>${fa(summary.assigned||items.length)}</strong><span>تخصیص رسمی</span></article><article class="cgt2-kpi"><small>بازشده</small><strong>${fa(summary.opened||0)}</strong><span>حداقل یک مشاهده</span></article><article class="cgt2-kpi"><small>تکمیل‌شده</small><strong>${fa(summary.completed||0)}</strong><span>ثبت در پرونده</span></article><article class="cgt2-kpi"><small>زمان مشاهده</small><strong>${esc(fmtSeconds(summary.totalViewSeconds||0))}</strong><span>زمان فعال</span></article></section>${cards?`<section class="cgt2-grid">${cards}</section>`:'<div class="cgt2-empty"><strong>هنوز آموزشی برای شما تخصیص داده نشده است.</strong><small>پس از تخصیص توسط واحد آموزش، جذب یا منابع انسانی، محتوا در همین صفحه نمایش داده می‌شود.</small></div>'}`);
 }catch(error){setPage('آموزش‌های من','خطا در دریافت آموزش‌ها',errorBox(error.message||String(error)))}
}
async function openCourse(item){
 if(!item)return;await closeSession();setPage(item.title||'آموزش','در حال آماده‌سازی محتوای آموزشی',loading('در حال بازکردن آموزش...'));
 try{
  const clientSessionKey=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload=await api(`/api/training/enrollments/${encodeURIComponent(item.enrollmentId)}/open`,{method:'POST',body:JSON.stringify({clientSessionKey})});
  const sessionId=payload.data?.sessionId;if(!sessionId)throw new Error('نشست مشاهده آموزش ایجاد نشد.');
  let viewed=Number(item.totalViewSeconds||0);
  setPage(item.title||'آموزش','مشاهده محتوا و ثبت زمان فعال',`<section class="cgt2-course"><header class="cgt2-course-head"><div><button class="cgt2-btn outline" data-cgt2-back>بازگشت به آموزش‌ها</button><span class="cgt2-eyebrow" style="margin-right:8px;background:#eaf7f0;color:#087847">${esc(item.category||'آموزش سازمانی')}</span><h2>${esc(item.title||'آموزش')}</h2><p>${esc(item.description||'')}</p><p>تخصیص توسط <b>${esc(item.assignedByName||'—')}</b> در ${esc(fmtDate(item.assignedAt))}</p></div><aside class="cgt2-live"><small>زمان مشاهده فعال</small><strong data-cgt2-live>${esc(fmtSeconds(viewed))}</strong><small>${fa(Number(item.openCount||0)+1)} بار بازشده</small></aside></header><div class="cgt2-viewer">${viewer(item)}</div><footer class="cgt2-actions"><button class="cgt2-btn outline" data-cgt2-back>بازگشت</button><button class="cgt2-btn primary" data-cgt2-complete="${esc(item.enrollmentId)}">تأیید تکمیل آموزش</button></footer></section>`);
  const heartbeat=async()=>{
   if(document.visibilityState!=='visible'||!document.hasFocus())return;
   try{const result=await api(`/api/training/sessions/${encodeURIComponent(sessionId)}/heartbeat`,{method:'POST',body:'{}'});viewed=Number(item.totalViewSeconds||0)+Number(result.data?.durationSeconds||0);const target=$('[data-cgt2-live]');if(target)target.textContent=fmtSeconds(viewed)}catch{}
  };
  session={id:sessionId,timer:setInterval(heartbeat,15000)};
 }catch(error){setPage(item.title||'آموزش','خطا در بازکردن آموزش',errorBox(error.message||String(error)))}
}
function onClick(event){
 const retry=event.target?.closest?.('[data-cgt2-retry]');if(retry){event.preventDefault();void openList();return}
 const back=event.target?.closest?.('[data-cgt2-back]');if(back){event.preventDefault();void openList();return}
 const open=event.target?.closest?.('[data-cgt2-open]');if(open){event.preventDefault();const item=currentItems.find(row=>String(row.enrollmentId)===String(open.dataset.cgt2Open));void openCourse(item);return}
 const complete=event.target?.closest?.('[data-cgt2-complete]');if(complete){event.preventDefault();complete.disabled=true;void api(`/api/training/enrollments/${encodeURIComponent(complete.dataset.cgt2Complete)}/complete`,{method:'POST',body:'{}'}).then(()=>{notify('آموزش تکمیل شد','وضعیت آموزش در پرونده شما ثبت شد.');return openList()}).catch(error=>{complete.disabled=false;notify('ثبت تکمیل انجام نشد',error.message)})}
}
function boot(){addStyles();document.addEventListener('click',onClick,true);window.addEventListener('pagehide',beaconClose);window.SalamatCaregiverTrainingV2={version:VERSION,open:openList,reload:openList,close:closeSession}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
