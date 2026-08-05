(()=>{
'use strict';
if(window.__salamatStaffSupportDirectRuntimeV3)return;
window.__salamatStaffSupportDirectRuntimeV3=true;
window.__salamatStaffSupportDirectRuntimeV2=true;
window.__salamatStaffSupportRuntimeV1=true;

const VERSION='3.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const dateFa=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return String(value)}};
const state={threads:[],messages:[],activeId:'',filter:'CASE',recording:null,chunks:[],loading:false,active:false,poll:0,identityVisible:false};

async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
 const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;throw error}return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function status(value){return ({OPEN:'باز و نیازمند پاسخ',PENDING:'در انتظار پاسخ مراقب',RESOLVED:'حل‌شده',CLOSED:'بسته'}[String(value||'').toUpperCase()]||value||'—')}
function setPage(html){
 const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
 if(title)title.textContent='پشتیبانی و امنیت';
 if(subtitle)subtitle.textContent='پشتیبانی پرونده و پشتیبانی فوری و امنیتی مراقبین';
 if(content)content.innerHTML=`<section class="module-page sts3-root" data-support-unity-version="${VERSION}">${html}</section>`;
 try{window.hydrateIcons?.(content)}catch{}
}
function empty(title,text){return `<div class="sts3-empty"><strong>${esc(title)}</strong><small>${esc(text)}</small></div>`}
function loading(){return '<div class="sts3-empty"><span class="sts3-spinner"></span><strong>در حال دریافت گفت‌وگوهای پشتیبانی...</strong></div>'}
function addStyles(){
 if($('#staffSupportDirectStylesV3'))return;
 const style=document.createElement('style');style.id='staffSupportDirectStylesV3';style.textContent=`
.sts3-root{direction:rtl;display:grid;gap:14px}.sts3-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sts3-head h2{margin:0;font-size:20px}.sts3-head p{margin:6px 0 0;color:#74847c;font-size:9px}.sts3-tabs{display:grid;grid-template-columns:repeat(2,minmax(190px,1fr));gap:8px}.sts3-tab{border:1px solid #dce8e2;border-radius:16px;padding:13px 15px;background:#fff;color:#446055;text-align:right;font:inherit;cursor:pointer}.sts3-tab strong{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px}.sts3-tab small{display:block;margin-top:6px;color:#7a8981;font-size:8px}.sts3-tab.active{border-color:#078848;background:#eff9f4;color:#087747}.sts3-tab.urgent.active{border-color:#c83850;background:#fff1f3;color:#a72a40}.sts3-count{min-width:24px;height:24px;display:inline-grid;place-items:center;border-radius:999px;background:#078848;color:#fff;font-size:8px}.sts3-tab.urgent .sts3-count{background:#bd3048}.sts3-layout{display:grid;grid-template-columns:minmax(300px,.72fr) minmax(0,1.28fr);gap:13px;align-items:stretch}.sts3-card{background:#fff;border:1px solid #dce8e2;border-radius:21px;overflow:hidden;box-shadow:0 10px 28px rgba(20,70,45,.04)}.sts3-card-head{padding:15px 17px;border-bottom:1px solid #e9f0ec;display:flex;align-items:center;justify-content:space-between;gap:10px}.sts3-card-head h3{margin:0;font-size:13px}.sts3-card-head p{margin:5px 0 0;color:#7b8982;font-size:8px}.sts3-queue{padding:11px;display:grid;gap:8px;max-height:650px;overflow:auto}.sts3-thread{width:100%;border:1px solid #e0eae5;border-radius:15px;background:#fff;padding:12px;text-align:right;cursor:pointer;position:relative}.sts3-thread.active{border-color:#0a9253;background:#f0faf5}.sts3-thread.urgent{border-color:#efcbd2}.sts3-thread.urgent.active{border-color:#c4324a;background:#fff3f5}.sts3-thread header{display:flex;align-items:center;justify-content:space-between;gap:8px}.sts3-thread strong{font-size:10px}.sts3-thread small{display:block;margin-top:6px;color:#74847c;font-size:8px;line-height:1.75}.sts3-unread{min-width:23px;height:23px;display:inline-grid;place-items:center;border-radius:999px;background:#078848;color:#fff;font-size:8px}.sts3-thread.urgent .sts3-unread{background:#bd3048}.sts3-preview{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sts3-chat{display:grid;grid-template-rows:auto minmax(320px,1fr) auto;min-height:650px}.sts3-messages{padding:15px;background:#f7faf8;overflow:auto;display:grid;align-content:start;gap:9px}.sts3-message{max-width:78%;justify-self:start;padding:11px 13px;border:1px solid #e0e9e4;border-radius:16px 16px 16px 5px;background:#fff}.sts3-message.mine{justify-self:end;background:#e8f7ef;border-color:#cce9d9;border-radius:16px 16px 5px 16px}.sts3-message p{margin:0;font-size:9px;line-height:1.95;white-space:pre-wrap}.sts3-message small{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;color:#7d8c84;font-size:7px}.sts3-message audio{width:min(290px,100%);height:38px}.sts3-role{display:inline-flex;padding:2px 6px;border-radius:999px;background:#edf4f0;color:#4e665a}.sts3-compose{padding:11px;border-top:1px solid #e7efeb;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px}.sts3-input,.sts3-select{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;padding:11px;background:#fff;font:inherit;font-size:9px}.sts3-btn{border:0;border-radius:12px;padding:10px 14px;background:#edf8f2;color:#087747;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.sts3-btn.primary{background:#078848;color:#fff}.sts3-btn:disabled{opacity:.45;pointer-events:none}.sts3-recording{background:#ffe8ec!important;color:#ae2940!important}.sts3-empty{min-height:220px;display:grid;place-items:center;align-content:center;gap:8px;text-align:center;color:#65776d}.sts3-empty strong{font-size:11px}.sts3-empty small{font-size:8px;line-height:1.85;max-width:430px}.sts3-spinner{width:27px;height:27px;border:3px solid #dcece4;border-top-color:#078848;border-radius:50%;animation:sts3Spin .8s linear infinite}@keyframes sts3Spin{to{transform:rotate(360deg)}}@media(max-width:950px){.sts3-layout{grid-template-columns:1fr}.sts3-chat{min-height:560px}}@media(max-width:650px){.sts3-tabs{grid-template-columns:1fr}.sts3-compose{grid-template-columns:auto minmax(0,1fr)}.sts3-compose .send{grid-column:1/-1}.sts3-message{max-width:92%}}
`;(document.head||document.documentElement).appendChild(style);
}
function visibleThreads(){return state.threads.filter(thread=>thread.category===state.filter)}
function counts(category){return state.threads.filter(x=>x.category===category).reduce((sum,x)=>sum+Number(x.unreadCount||0),0)}
function queueMarkup(){
 const rows=visibleThreads();
 return rows.length?rows.map(thread=>`<button class="sts3-thread ${thread.id===state.activeId?'active':''} ${thread.category==='URGENT_SECURITY'?'urgent':''}" data-sts3-thread="${esc(thread.id)}"><header><strong>${esc(thread.caregiverName||'مراقب')}</strong>${Number(thread.unreadCount||0)>0?`<span class="sts3-unread">${Number(thread.unreadCount).toLocaleString('fa-IR')}</span>`:''}</header><small>${esc(thread.membershipCode||'بدون کد عضویت')} • ${status(thread.status)}</small><small class="sts3-preview">${esc(thread.lastMessagePreview||thread.subject||'گفت‌وگوی جدید')}</small><small>${dateFa(thread.lastMessageAt||thread.updatedAt)}</small></button>`).join(''):empty('گفت‌وگویی در این بخش نیست',state.filter==='CASE'?'پیام‌های پشتیبانی پرونده مراقبین اینجا نمایش داده می‌شوند.':'پیام‌های فوری و امنیتی مراقبین اینجا نمایش داده می‌شوند.');
}
function messageMarkup(message){
 const identity=message.responderIdentityVisible?`<span class="sts3-role">${esc(message.senderRoleLabel||'')}</span>`:'';
 return `<div class="sts3-message ${message.isMine?'mine':''}">${message.messageType==='VOICE'?`<audio controls preload="none" src="/api/files/${encodeURIComponent(message.storedFileId)}/download"></audio>`:`<p>${esc(message.textContent||'')}</p>`}<small><span>${esc(message.senderDisplayName||message.senderName||'کاربر')}</span>${identity}<span>${dateFa(message.createdAt)}</span></small></div>`;
}
function chatMarkup(){
 const thread=state.threads.find(item=>item.id===state.activeId);
 if(!thread)return empty('یک مراقب را انتخاب کنید','با کلیک روی نام مراقب، تاریخچه گفت‌وگو باز می‌شود.');
 const messages=state.messages.length?state.messages.map(messageMarkup).join(''):empty('هنوز پیامی ثبت نشده','پاسخ متنی یا صوتی خود را ارسال کنید.');
 return `<header class="sts3-card-head"><div><h3>${esc(thread.caregiverName)} • ${esc(thread.subject)}</h3><p>${thread.category==='URGENT_SECURITY'?'پشتیبانی فوری و امنیتی':'پشتیبانی پرونده'} • ${esc(thread.familyName||thread.contractNumber||'بدون قرارداد')}</p></div><select class="sts3-select" style="width:auto" data-sts3-status><option value="OPEN" ${thread.status==='OPEN'?'selected':''}>باز</option><option value="PENDING" ${thread.status==='PENDING'?'selected':''}>در انتظار مراقب</option><option value="RESOLVED" ${thread.status==='RESOLVED'?'selected':''}>حل‌شده</option><option value="CLOSED" ${thread.status==='CLOSED'?'selected':''}>بسته</option></select></header><div class="sts3-messages" id="sts3Messages">${messages}</div><form class="sts3-compose" id="sts3MessageForm"><button class="sts3-btn" type="button" data-sts3-record>● ضبط وویس</button><input class="sts3-input" name="text" autocomplete="off" placeholder="پاسخ خود را بنویسید..."><button class="sts3-btn primary send" type="submit">ارسال</button></form>`;
}
function shell(){
 const caseUnread=counts('CASE'),urgentUnread=counts('URGENT_SECURITY');
 return `<header class="sts3-head"><div><h2>مرکز گفت‌وگوی پشتیبانی مراقبین</h2><p>تمام پیام‌های مراقبین از یک منبع داده واحد دریافت می‌شوند.</p></div>${state.identityVisible?'<span class="sts3-role">نمایش نام پاسخ‌دهندگان برای مدیر سامانه فعال است</span>':''}</header><nav class="sts3-tabs"><button class="sts3-tab ${state.filter==='CASE'?'active':''}" data-sts3-filter="CASE"><strong><span>پشتیبانی پرونده</span><span class="sts3-count">${caseUnread.toLocaleString('fa-IR')}</span></strong><small>قرارداد، برنامه کاری، خانواده و مسائل جاری پرونده</small></button><button class="sts3-tab urgent ${state.filter==='URGENT_SECURITY'?'active':''}" data-sts3-filter="URGENT_SECURITY"><strong><span>پشتیبانی فوری و امنیتی</span><span class="sts3-count">${urgentUnread.toLocaleString('fa-IR')}</span></strong><small>خطر، فوریت و گزارش‌های امنیتی مراقب</small></button></nav><section class="sts3-layout"><aside class="sts3-card"><header class="sts3-card-head"><div><h3>مراقبین</h3><p>گفت‌وگوهای خوانده‌نشده در ابتدای فهرست قرار دارند.</p></div></header><div class="sts3-queue">${queueMarkup()}</div></aside><article class="sts3-card sts3-chat">${chatMarkup()}</article></section>`;
}
function render(){setPage(shell());requestAnimationFrame(()=>{const box=$('#sts3Messages');if(box)box.scrollTop=box.scrollHeight})}
async function loadMessages(renderAfter=true){
 if(!state.activeId)return;
 const payload=await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}/messages`);
 state.messages=payload.data?.messages||[];state.identityVisible=Boolean(payload.data?.canViewResponderIdentity);
 const thread=state.threads.find(item=>item.id===state.activeId);if(thread)thread.unreadCount=0;
 window.dispatchEvent(new CustomEvent('salamat-support-thread-read',{detail:{threadId:state.activeId}}));
 window.dispatchEvent(new CustomEvent('salamat-notifications-refresh'));
 if(renderAfter)render();
}
async function load(openFirst=true,requestedId=''){
 if(state.loading)return;state.loading=true;state.active=true;setPage(loading());
 try{
  const payload=await api('/api/caregiver/platform/support/threads');
  state.threads=payload.data?.threads||[];state.identityVisible=Boolean(payload.data?.canViewResponderIdentity);
  if(requestedId&&state.threads.some(item=>item.id===requestedId)){state.activeId=requestedId;state.filter=state.threads.find(item=>item.id===requestedId)?.category||state.filter}
  if(state.activeId&&!state.threads.some(item=>item.id===state.activeId)){state.activeId='';state.messages=[]}
  if(openFirst&&!state.activeId){const first=visibleThreads()[0]||state.threads[0];if(first){state.activeId=first.id;state.filter=first.category}}
  if(state.activeId)await loadMessages(false);
  render();startPolling();
 }catch(error){setPage(empty('پشتیبانی بارگذاری نشد',error.message))}finally{state.loading=false}
}
async function refreshQuiet(){
 if(!state.active||document.hidden)return;
 try{
  const payload=await api('/api/caregiver/platform/support/threads');
  state.threads=payload.data?.threads||[];state.identityVisible=Boolean(payload.data?.canViewResponderIdentity);
  if(state.activeId&&state.threads.some(item=>item.id===state.activeId))await loadMessages(false);
  render();
 }catch{}
}
function startPolling(){clearInterval(state.poll);state.poll=setInterval(refreshQuiet,20000)}
async function uploadVoice(blob,caregiverId){
 const form=new FormData(),extension=blob.type.includes('ogg')?'ogg':'webm';
 form.append('file',new File([blob],`support-voice-${Date.now()}.${extension}`,{type:blob.type||'audio/webm'}));form.append('category','support');form.append('caregiverId',caregiverId);
 const response=await fetch('/api/files',{method:'POST',body:form,credentials:'same-origin',cache:'no-store'});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||'بارگذاری وویس انجام نشد.');return payload.data.id;
}
async function toggleRecording(button){
 if(state.recording){state.recording.stop();button.disabled=true;return}
 const thread=state.threads.find(item=>item.id===state.activeId);if(!thread)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('ضبط صدا پشتیبانی نمی‌شود','مرورگر یا دسترسی میکروفون آماده نیست.');return}
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});const type=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';state.chunks=[];state.recording=new MediaRecorder(stream,{mimeType:type});
  state.recording.ondataavailable=event=>{if(event.data.size)state.chunks.push(event.data)};
  state.recording.onstop=async()=>{const recorder=state.recording;state.recording=null;stream.getTracks().forEach(track=>track.stop());button.classList.remove('sts3-recording');button.textContent='● ضبط وویس';try{const fileId=await uploadVoice(new Blob(state.chunks,{type:recorder?.mimeType||'audio/webm'}),thread.caregiverId);await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}/messages`,{method:'POST',body:JSON.stringify({storedFileId:fileId})});notify('وویس ارسال شد','پیام صوتی برای مراقب ثبت شد.');await load(true,state.activeId)}catch(error){notify('ارسال وویس انجام نشد',error.message)}finally{button.disabled=false}};
  state.recording.start();button.classList.add('sts3-recording');button.textContent='■ پایان ضبط';
 }catch(error){notify('دسترسی میکروفون داده نشد',error.message||'مجوز میکروفون را فعال کنید.')}
}
async function click(event){
 const filter=event.target?.closest?.('[data-sts3-filter]');if(filter){event.preventDefault();state.filter=filter.dataset.sts3Filter;const first=visibleThreads()[0];state.activeId=first?.id||'';state.messages=[];if(first)await loadMessages(false);render();return}
 const thread=event.target?.closest?.('[data-sts3-thread]');if(thread){event.preventDefault();state.activeId=thread.dataset.sts3Thread;await loadMessages(true);return}
 const record=event.target?.closest?.('[data-sts3-record]');if(record){event.preventDefault();void toggleRecording(record)}
}
async function submit(event){
 if(event.target?.id!=='sts3MessageForm')return;event.preventDefault();const input=$('[name="text"]',event.target),text=String(input?.value||'').trim();if(!text)return;
 try{await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}/messages`,{method:'POST',body:JSON.stringify({text})});if(input)input.value='';await load(true,state.activeId)}catch(error){notify('ارسال پیام انجام نشد',error.message)}
}
async function change(event){
 if(!event.target?.matches?.('[data-sts3-status]'))return;
 try{await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}`,{method:'PATCH',body:JSON.stringify({status:event.target.value})});await load(true,state.activeId)}catch(error){notify('تغییر وضعیت انجام نشد',error.message)}
}
function open(threadId=''){addStyles();return load(true,threadId)}
function deactivate(){state.active=false;clearInterval(state.poll);state.poll=0}

document.addEventListener('click',click,true);document.addEventListener('submit',submit,true);document.addEventListener('change',change,true);
window.addEventListener('salamat-authenticated',()=>{if(state.active)void refreshQuiet()});window.addEventListener('pageshow',()=>{if(state.active)void refreshQuiet()});
window.SalamatStaffSupport={version:VERSION,open,reload:()=>load(false,state.activeId),deactivate,direct:true,canonical:true};
window.dispatchEvent(new CustomEvent('salamat-staff-support-ready',{detail:{version:VERSION,canonical:true}}));
})();
