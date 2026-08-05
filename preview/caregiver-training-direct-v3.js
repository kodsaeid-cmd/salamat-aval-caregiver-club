(()=>{
'use strict';
if(window.__salamatCaregiverTrainingDirectV3)return;
window.__salamatCaregiverTrainingDirectV3=true;

const VERSION='3.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const state={assignments:[],activeSession:null,opening:false};

async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
 const raw=await response.text();let payload={};
 try{payload=raw?JSON.parse(raw):{}}catch{payload={detail:raw}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;throw error}
 return payload;
}
function notify(title,message){try{window.toast?.(title,message)}catch{}if(!window.toast)console.info(title,message)}
function setPage(title,subtitle,html){
 const titleNode=$('#pageTitle'),subtitleNode=$('#pageSubtitle'),content=$('#content');
 if(titleNode)titleNode.textContent=title;if(subtitleNode)subtitleNode.textContent=subtitle;
 if(content)content.innerHTML=`<section class="module-page cgt3-root" data-caregiver-training-version="${VERSION}">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
 window.SalamatMobileApp?.sync?.();
}
function secondsLabel(value){
 const total=Math.max(0,Math.floor(Number(value||0))),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
 if(hours)return `${fa(hours)} ساعت و ${fa(minutes)} دقیقه`;
 if(minutes)return `${fa(minutes)} دقیقه و ${fa(seconds)} ثانیه`;
 return `${fa(seconds)} ثانیه`;
}
function dateLabel(value){if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return String(value)}}
function statusLabel(value){return ({ASSIGNED:'تخصیص‌یافته',IN_PROGRESS:'در حال مشاهده',COMPLETED:'تکمیل‌شده',CANCELLED:'لغوشده'})[String(value||'').toUpperCase()]||String(value||'—')}
function loading(text='در حال دریافت آموزش‌های شما...'){return `<div class="cgt3-state"><span class="cgt3-spinner"></span><strong>${esc(text)}</strong></div>`}
function errorMarkup(text){return `<div class="cgt3-state error"><strong>بانک آموزش باز نشد</strong><small>${esc(text)}</small><button type="button" class="cgt3-btn primary" data-cgt3-retry>تلاش دوباره</button></div>`}
function contentUrl(item){return String(item?.contentUrl||item?.content_url||item?.downloadUrl||item?.fileUrl||'').trim()}
function safeUrl(value){try{const url=new URL(String(value||''),location.origin);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}}
function contentKind(item,url){
 const type=String(item?.contentType||item?.mimeType||'').toLowerCase(),path=new URL(url).pathname.toLowerCase();
 if(type.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/.test(path))return 'video';
 if(type.startsWith('audio/')||/\.(mp3|m4a|wav|ogg|aac)$/.test(path))return 'audio';
 if(type.startsWith('image/')||/\.(jpg|jpeg|png|webp|gif|svg)$/.test(path))return 'image';
 if(type==='application/pdf'||/\.pdf$/.test(path))return 'document';
 return 'document';
}
function viewer(item){
 const raw=contentUrl(item),url=safeUrl(raw);
 if(!url)return `<div class="cgt3-state warning"><strong>فایل این آموزش هنوز در بانک آموزش ثبت نشده است.</strong><small>عنوان و تخصیص قابل مشاهده است؛ واحد آموزش باید فایل یا لینک محتوا را به همین آموزش متصل کند.</small></div>`;
 const safe=esc(url),kind=contentKind(item,url),title=esc(item.title||'محتوای آموزش');
 if(kind==='video')return `<video controls playsinline preload="metadata" src="${safe}">مرورگر شما پخش ویدئو را پشتیبانی نمی‌کند.</video>`;
 if(kind==='audio')return `<div class="cgt3-audio"><strong>${title}</strong><audio controls preload="metadata" src="${safe}"></audio></div>`;
 if(kind==='image')return `<div class="cgt3-image"><img src="${safe}" alt="${title}"></div>`;
 return `<iframe src="${safe}" title="${title}" loading="eager" referrerpolicy="same-origin"></iframe><a class="cgt3-open-external" href="${safe}" target="_blank" rel="noopener">بازکردن محتوا در صفحه جدا</a>`;
}
function sessionKey(){if(crypto?.randomUUID)return crypto.randomUUID();const values=new Uint32Array(4);crypto.getRandomValues(values);return [...values].map(value=>value.toString(36)).join('-')}
function addStyles(){
 if($('#caregiverTrainingDirectV3Styles'))return;
 const style=document.createElement('style');style.id='caregiverTrainingDirectV3Styles';style.textContent=`
.cgt3-root{direction:rtl;display:grid;gap:14px;min-width:0}.cgt3-state{min-height:220px;display:grid;place-items:center;align-content:center;gap:10px;text-align:center;padding:24px;border:1px dashed #cfe0d7;border-radius:20px;background:#fbfdfc;color:#64776c}.cgt3-state.error{border-color:#efcfd5;background:#fff8f8;color:#9b3244}.cgt3-state.warning{min-height:360px;background:#fffaf0;border-color:#ead9b3;color:#7b5a13}.cgt3-state strong{font-size:13px}.cgt3-state small{max-width:600px;font-size:10px;line-height:2}.cgt3-spinner{width:32px;height:32px;border:3px solid #dcece4;border-top-color:#078848;border-radius:50%;animation:cgt3spin .8s linear infinite}@keyframes cgt3spin{to{transform:rotate(360deg)}}
.cgt3-head{padding:24px;border-radius:25px;background:linear-gradient(135deg,#087a45,#075b38);color:#fff}.cgt3-head h2{margin:8px 0 6px;color:#fff;font-size:24px}.cgt3-head p{margin:0;color:rgba(255,255,255,.84);font-size:10px;line-height:2}.cgt3-eyebrow{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:8px;font-weight:900}.cgt3-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.cgt3-kpi,.cgt3-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 9px 26px rgba(20,70,45,.05)}.cgt3-kpi{padding:15px}.cgt3-kpi small{display:block;color:#74847c;font-size:8px}.cgt3-kpi strong{display:block;margin-top:7px;color:#087a45;font-size:18px}.cgt3-kpi span{display:block;margin-top:5px;color:#7c8982;font-size:8px}.cgt3-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.cgt3-card{padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0}.cgt3-card header{display:flex;justify-content:space-between;gap:9px}.cgt3-card h3{margin:5px 0 0;font-size:14px;line-height:1.8}.cgt3-card p{margin:0;color:#718078;font-size:9px;line-height:1.9;min-height:45px}.cgt3-badge{height:max-content;display:inline-flex;padding:5px 8px;border-radius:999px;background:#eaf7f0;color:#087847;font-size:8px;font-weight:900;white-space:nowrap}.cgt3-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.cgt3-meta div{padding:9px;border-radius:11px;background:#f5f8f6;min-width:0}.cgt3-meta small{display:block;color:#7a8881;font-size:7px}.cgt3-meta b{display:block;margin-top:4px;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cgt3-progress{height:7px;border-radius:999px;background:#e9f0ec;overflow:hidden}.cgt3-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#078848,#54bd81)}.cgt3-btn{border:0;border-radius:11px;padding:11px 13px;font:inherit;font-size:10px;font-weight:900;cursor:pointer;touch-action:manipulation}.cgt3-btn.primary{background:#078848;color:#fff}.cgt3-btn.outline{background:#fff;color:#087847;border:1px solid #cfe0d7}.cgt3-btn:disabled{opacity:.5;cursor:wait}.cgt3-card footer{display:flex;align-items:center;gap:8px;margin-top:auto}.cgt3-card footer .cgt3-btn{flex:1}.cgt3-course{display:grid;gap:13px;min-width:0}.cgt3-course-head{display:flex;justify-content:space-between;gap:16px;padding:18px;border:1px solid #dce8e2;border-radius:20px;background:#fff}.cgt3-course-head h2{margin:9px 0 6px;font-size:21px}.cgt3-course-head p{margin:0;color:#718078;font-size:9px;line-height:1.9}.cgt3-live{min-width:190px;padding:13px;border-radius:15px;background:#edf8f2;text-align:center}.cgt3-live small{display:block;color:#60756a;font-size:8px}.cgt3-live strong{display:block;margin-top:7px;color:#087847;font-size:17px}.cgt3-viewer{position:relative;min-height:540px;border:1px solid #dce8e2;border-radius:20px;background:#fff;overflow:hidden}.cgt3-viewer iframe,.cgt3-viewer video{display:block;width:100%;height:540px;border:0;background:#f7faf8}.cgt3-viewer video{object-fit:contain;background:#111}.cgt3-audio{min-height:300px;display:grid;align-content:center;gap:20px;padding:30px;text-align:center}.cgt3-audio audio{display:block;width:min(720px,100%);margin:auto}.cgt3-image{min-height:420px;display:grid;place-items:center;padding:14px}.cgt3-image img{max-width:100%;max-height:680px;object-fit:contain}.cgt3-open-external{position:absolute;left:12px;bottom:12px;padding:8px 11px;border-radius:10px;background:rgba(7,136,72,.92);color:#fff;text-decoration:none;font-size:9px;font-weight:900}.cgt3-actions{display:flex;justify-content:flex-end;gap:8px}
@media(max-width:1050px){.cgt3-grid,.cgt3-summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:680px){.cgt3-root{gap:10px}.cgt3-grid,.cgt3-summary{grid-template-columns:1fr}.cgt3-head{padding:19px 16px;border-radius:21px}.cgt3-head h2{font-size:20px}.cgt3-card{padding:14px}.cgt3-course-head{padding:14px;flex-direction:column}.cgt3-live{min-width:0}.cgt3-viewer{min-height:calc(100dvh - 260px);border-radius:16px}.cgt3-viewer iframe,.cgt3-viewer video{height:calc(100dvh - 260px);min-height:390px}.cgt3-actions{position:sticky;bottom:calc(78px + env(safe-area-inset-bottom));z-index:4;padding:9px;border:1px solid #dfe9e4;border-radius:15px;background:rgba(255,255,255,.96);box-shadow:0 8px 28px rgba(20,70,45,.12)}.cgt3-actions .cgt3-btn{flex:1}.cgt3-open-external{position:static;display:block;margin:10px;text-align:center}}
`;(document.head||document.documentElement).appendChild(style)
}
async function closeSession(){
 const active=state.activeSession;state.activeSession=null;if(!active)return;clearInterval(active.timer);
 try{await api(`/api/training/sessions/${encodeURIComponent(active.id)}/close`,{method:'POST',body:'{}'})}catch{}
}
function beaconClose(){const active=state.activeSession;if(!active)return;try{navigator.sendBeacon(`/api/training/sessions/${encodeURIComponent(active.id)}/close`,new Blob(['{}'],{type:'application/json'}))}catch{}}
async function openList(){
 addStyles();await closeSession();setPage('بانک آموزش','آموزش‌های تخصیص‌یافته به پرونده شما',loading());
 try{
  const payload=await api('/api/training/my'),data=payload.data||{},summary=data.summary||{};
  state.assignments=Array.isArray(data.assignments)?data.assignments:[];
  const cards=state.assignments.map(item=>`<article class="cgt3-card"><header><div><span class="cgt3-badge">${esc(item.category||'آموزش سازمانی')}</span><h3>${esc(item.title||'آموزش بدون عنوان')}</h3></div><span class="cgt3-badge">${esc(statusLabel(item.status))}</span></header><p>${esc(item.description||'توضیحی برای این آموزش ثبت نشده است.')}</p><div class="cgt3-meta"><div><small>تخصیص‌دهنده</small><b>${esc(item.assignedByName||'سامانه سلامت اول')}</b></div><div><small>زمان اسمی</small><b>${fa(item.durationMinutes||0)} دقیقه</b></div><div><small>دفعات مشاهده</small><b>${fa(item.openCount||0)} بار</b></div><div><small>زمان مشاهده فعال</small><b>${esc(secondsLabel(item.totalViewSeconds||0))}</b></div></div><div class="cgt3-progress"><i style="width:${Math.max(0,Math.min(100,Number(item.progress||0)))}%"></i></div><footer><button type="button" class="cgt3-btn primary" data-cgt3-open="${esc(item.enrollmentId)}">مشاهده آموزش</button>${item.mandatory?'<span class="cgt3-badge">الزامی</span>':''}</footer></article>`).join('');
  setPage('بانک آموزش','مشاهده محتوای تخصیص‌یافته و ثبت پیشرفت',`<section class="cgt3-head"><span class="cgt3-eyebrow">باشگاه مراقبین سلامت اول</span><h2>آموزش‌های من</h2><p>هر آموزش تخصیص‌یافته دارای دکمه «مشاهده آموزش» است و زمان مشاهده فعال مستقیماً در پرونده حرفه‌ای شما ثبت می‌شود.</p></section><section class="cgt3-summary"><article class="cgt3-kpi"><small>کل آموزش‌ها</small><strong>${fa(summary.assigned??state.assignments.length)}</strong><span>تخصیص رسمی</span></article><article class="cgt3-kpi"><small>بازشده</small><strong>${fa(summary.opened||0)}</strong><span>حداقل یک مشاهده</span></article><article class="cgt3-kpi"><small>تکمیل‌شده</small><strong>${fa(summary.completed||0)}</strong><span>ثبت در پرونده</span></article><article class="cgt3-kpi"><small>زمان مشاهده</small><strong>${esc(secondsLabel(summary.totalViewSeconds||0))}</strong><span>زمان فعال</span></article></section>${cards?`<section class="cgt3-grid">${cards}</section>`:'<div class="cgt3-state"><strong>هنوز آموزشی برای شما تخصیص داده نشده است.</strong><small>پس از تخصیص از سوی بانک آموزش، کارت آموزش و دکمه مشاهده در همین صفحه ظاهر می‌شود.</small></div>'}`);
 }catch(error){setPage('بانک آموزش','خطا در دریافت آموزش‌ها',errorMarkup(error.message||String(error)))}
}
async function openCourse(item){
 if(!item||state.opening)return;state.opening=true;await closeSession();setPage(item.title||'آموزش','در حال آماده‌سازی محتوای آموزشی',loading('در حال بازکردن آموزش...'));
 try{
  const payload=await api(`/api/training/enrollments/${encodeURIComponent(item.enrollmentId)}/open`,{method:'POST',body:JSON.stringify({clientSessionKey:sessionKey()})});
  const sessionId=payload.data?.sessionId,assignment={...item,...(payload.data?.assignment||{})};
  if(!sessionId)throw new Error('نشست مشاهده آموزش ایجاد نشد.');
  let viewed=Number(assignment.totalViewSeconds||0);
  setPage(assignment.title||'آموزش','مشاهده محتوا و ثبت زمان فعال',`<section class="cgt3-course"><header class="cgt3-course-head"><div><button type="button" class="cgt3-btn outline" data-cgt3-back>بازگشت به آموزش‌ها</button><h2>${esc(assignment.title||'آموزش')}</h2><p>${esc(assignment.description||'')}</p><p>تخصیص توسط <b>${esc(assignment.assignedByName||'سامانه سلامت اول')}</b> در ${esc(dateLabel(assignment.assignedAt))}</p></div><aside class="cgt3-live"><small>زمان مشاهده فعال</small><strong data-cgt3-live>${esc(secondsLabel(viewed))}</strong><small>${fa(Number(assignment.openCount||0))} بار بازشده</small></aside></header><div class="cgt3-viewer">${viewer(assignment)}</div><footer class="cgt3-actions"><button type="button" class="cgt3-btn outline" data-cgt3-back>بازگشت</button><button type="button" class="cgt3-btn primary" data-cgt3-complete="${esc(assignment.enrollmentId)}">تأیید تکمیل آموزش</button></footer></section>`);
  const heartbeat=async()=>{if(document.visibilityState!=='visible')return;try{const result=await api(`/api/training/sessions/${encodeURIComponent(sessionId)}/heartbeat`,{method:'POST',body:'{}'});viewed=Number(assignment.totalViewSeconds||0)+Number(result.data?.durationSeconds||0);const target=$('[data-cgt3-live]');if(target)target.textContent=secondsLabel(viewed)}catch{}};
  state.activeSession={id:sessionId,timer:setInterval(heartbeat,15000)};
  window.dispatchEvent(new CustomEvent('salamat-caregiver-training-opened',{detail:{enrollmentId:assignment.enrollmentId,version:VERSION}}));
 }catch(error){setPage(item.title||'آموزش','خطا در بازکردن آموزش',errorMarkup(error.message||String(error)))}finally{state.opening=false}
}
function onClick(event){
 if(event.target?.closest?.('[data-cgt3-retry]')){event.preventDefault();void openList();return}
 if(event.target?.closest?.('[data-cgt3-back]')){event.preventDefault();void openList();return}
 const open=event.target?.closest?.('[data-cgt3-open]');if(open){event.preventDefault();event.stopPropagation();const item=state.assignments.find(entry=>String(entry.enrollmentId)===String(open.dataset.cgt3Open));void openCourse(item);return}
 const complete=event.target?.closest?.('[data-cgt3-complete]');if(complete){event.preventDefault();complete.disabled=true;void api(`/api/training/enrollments/${encodeURIComponent(complete.dataset.cgt3Complete)}/complete`,{method:'POST',body:'{}'}).then(()=>{notify('آموزش تکمیل شد','وضعیت تکمیل در پرونده شما ثبت شد.');return openList()}).catch(error=>{complete.disabled=false;notify('ثبت تکمیل انجام نشد',error.message)})}
}
function boot(){
 addStyles();document.addEventListener('click',onClick,true);window.addEventListener('pagehide',beaconClose);
 const runtime={version:VERSION,open:openList,reload:openList,close:closeSession,openCourse};
 window.SalamatCaregiverTrainingV3=runtime;
 window.SalamatCaregiverTrainingV2=runtime;
 window.dispatchEvent(new CustomEvent('salamat-caregiver-training-ready',{detail:{version:VERSION}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
