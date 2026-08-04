(()=>{
'use strict';
if(window.__salamatStaffSupportDirectRuntimeV2)return;
window.__salamatStaffSupportDirectRuntimeV2=true;

const VERSION='2.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const faDate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return String(value)}};
const state={threads:[],messages:[],activeId:'',filter:'ALL',recording:null,chunks:[],loading:false};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;throw error}
  return payload;
}
function currentUser(){try{return window.SalamatBackend?.getCurrentUser?.()||null}catch{return null}}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function status(value){return ({OPEN:'باز',PENDING:'در انتظار پاسخ',RESOLVED:'حل‌شده',CLOSED:'بسته'}[String(value||'').toUpperCase()]||value||'—')}
function setPage(html){
  const title=$('#pageTitle'),subtitle=$('#pageSubtitle'),content=$('#content');
  if(title)title.textContent='پشتیبانی';
  if(subtitle)subtitle.textContent='پشتیبانی پرونده و صف فوری و امنیتی مراقبین';
  if(content)content.innerHTML=`<section class="module-page sts2-root">${html}</section>`;
}
function empty(title,text){return `<div class="sts2-empty"><strong>${esc(title)}</strong><small>${esc(text)}</small></div>`}
function loading(){return '<div class="sts2-empty"><span class="sts2-spinner"></span><strong>در حال دریافت صف پشتیبانی...</strong></div>'}
function addStyles(){
  if($('#staffSupportDirectStylesV2'))return;
  const style=document.createElement('style');style.id='staffSupportDirectStylesV2';style.textContent=`
.sts2-root{direction:rtl;display:grid;gap:12px}.sts2-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.sts2-head h2{margin:0;font-size:20px}.sts2-head p{margin:6px 0 0;color:#78877f;font-size:9px}.sts2-filters,.sts2-actions{display:flex;gap:7px;flex-wrap:wrap}.sts2-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:8px;font-weight:900;cursor:pointer}.sts2-btn.active,.sts2-btn.primary{background:#078848;color:#fff}.sts2-btn:disabled{opacity:.45;pointer-events:none}.sts2-layout{display:grid;grid-template-columns:minmax(280px,.7fr) minmax(0,1.3fr);gap:12px;align-items:stretch}.sts2-card{background:#fff;border:1px solid #dce8e2;border-radius:20px;overflow:hidden;box-shadow:0 10px 28px rgba(20,70,45,.04)}.sts2-card-head{padding:14px 16px;border-bottom:1px solid #eaf0ed;display:flex;align-items:center;justify-content:space-between;gap:10px}.sts2-card-head h3{margin:0;font-size:13px}.sts2-card-head p{margin:5px 0 0;color:#7b8982;font-size:8px}.sts2-queue{padding:12px;display:grid;gap:7px;max-height:650px;overflow:auto}.sts2-thread{width:100%;border:1px solid #e0eae5;border-radius:14px;background:#fff;padding:11px;text-align:right;cursor:pointer}.sts2-thread.active{border-color:#0a9253;background:#f0faf5}.sts2-thread.urgent{border-color:#f0c9d1;background:#fff8f9}.sts2-thread header{display:flex;justify-content:space-between;gap:8px}.sts2-thread strong{font-size:9px}.sts2-thread small{display:block;margin-top:5px;color:#7b8982;font-size:7px;line-height:1.75}.sts2-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:7px;font-weight:900}.sts2-badge.urgent{background:#ffe8ec;color:#ad2940}.sts2-chat{display:grid;grid-template-rows:auto minmax(300px,1fr) auto;min-height:650px}.sts2-messages{padding:14px;background:#f7faf8;overflow:auto;display:grid;align-content:start;gap:8px}.sts2-message{max-width:78%;justify-self:start;padding:10px 12px;border:1px solid #e0e9e4;border-radius:15px 15px 15px 4px;background:#fff}.sts2-message.mine{justify-self:end;background:#e8f7ef;border-color:#cce9d9;border-radius:15px 15px 4px 15px}.sts2-message p{margin:0;font-size:9px;line-height:1.9}.sts2-message small{display:block;margin-top:5px;color:#829087;font-size:7px}.sts2-message audio{width:min(280px,100%);height:36px}.sts2-compose{padding:10px;border-top:1px solid #e7efeb;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px}.sts2-input,.sts2-select{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:11px;padding:10px;background:#fff;font:inherit;font-size:8px}.sts2-recording{background:#ffe8ec!important;color:#ae2940!important}.sts2-empty{min-height:200px;display:grid;place-items:center;align-content:center;gap:8px;text-align:center;color:#65776d}.sts2-empty strong{font-size:10px}.sts2-empty small{font-size:8px;line-height:1.8;max-width:430px}.sts2-spinner{width:26px;height:26px;border:3px solid #dcece4;border-top-color:#078848;border-radius:50%;animation:sts2Spin .8s linear infinite}@keyframes sts2Spin{to{transform:rotate(360deg)}}@media(max-width:950px){.sts2-layout{grid-template-columns:1fr}.sts2-chat{min-height:560px}}@media(max-width:600px){.sts2-compose{grid-template-columns:auto minmax(0,1fr)}.sts2-compose .send{grid-column:1/-1}.sts2-message{max-width:90%}}
`;(document.head||document.documentElement).appendChild(style);
}
function filtered(){return state.threads.filter(thread=>state.filter==='ALL'||thread.category===state.filter)}
function queueMarkup(){
  const rows=filtered();
  return rows.length?rows.map(thread=>`<button class="sts2-thread ${thread.id===state.activeId?'active':''} ${thread.category==='URGENT_SECURITY'?'urgent':''}" data-sts2-thread="${esc(thread.id)}"><header><strong>${esc(thread.caregiverName)}</strong><span class="sts2-badge ${thread.category==='URGENT_SECURITY'?'urgent':''}">${thread.category==='URGENT_SECURITY'?'فوری':'پرونده'}</span></header><small>${esc(thread.subject)}<br>${esc(thread.membershipCode||'')} • ${esc(thread.familyName||thread.contractNumber||'بدون قرارداد')}<br>${status(thread.status)} • ${faDate(thread.updatedAt)}</small></button>`).join(''):empty('صف خالی است','گفت‌وگویی با این فیلتر وجود ندارد.');
}
function chatMarkup(){
  const thread=state.threads.find(item=>item.id===state.activeId),user=currentUser();
  if(!thread)return empty('گفت‌وگویی انتخاب نشده','از صف گفت‌وگوها یک مورد را انتخاب کنید.');
  const messages=state.messages.length?state.messages.map(message=>`<div class="sts2-message ${message.senderUserId===user?.id?'mine':''}">${message.messageType==='VOICE'?`<audio controls preload="none" src="/api/files/${encodeURIComponent(message.storedFileId)}/download"></audio>`:`<p>${esc(message.textContent)}</p>`}<small>${esc(message.senderName||'کاربر')} • ${faDate(message.createdAt)}</small></div>`).join(''):empty('هنوز پیامی نیست','پاسخ متنی یا صوتی خود را ارسال کنید.');
  return `<header class="sts2-card-head"><div><h3>${esc(thread.caregiverName)} • ${esc(thread.subject)}</h3><p>${thread.category==='URGENT_SECURITY'?'پشتیبانی فوری و امنیتی':'پشتیبانی پرونده'} • ${esc(thread.familyName||thread.contractNumber||'بدون قرارداد')}</p></div><select class="sts2-select" style="width:auto" data-sts2-status><option value="OPEN" ${thread.status==='OPEN'?'selected':''}>باز</option><option value="PENDING" ${thread.status==='PENDING'?'selected':''}>در انتظار</option><option value="RESOLVED" ${thread.status==='RESOLVED'?'selected':''}>حل‌شده</option><option value="CLOSED" ${thread.status==='CLOSED'?'selected':''}>بسته</option></select></header><div class="sts2-messages" id="sts2Messages">${messages}</div><form class="sts2-compose" id="sts2MessageForm"><button class="sts2-btn" type="button" data-sts2-record>● وویس</button><input class="sts2-input" name="text" placeholder="پاسخ خود را بنویسید..."><button class="sts2-btn primary send">ارسال</button></form>`;
}
function shell(){
  const urgent=state.threads.filter(x=>x.category==='URGENT_SECURITY'&&['OPEN','PENDING'].includes(x.status)).length;
  return `<header class="sts2-head"><div><h2>پشتیبانی مراقبین</h2><p>گفت‌وگوهای پرونده و درخواست‌های فوری و امنیتی در یک صف یکپارچه</p></div><nav class="sts2-filters"><button class="sts2-btn ${state.filter==='ALL'?'active':''}" data-sts2-filter="ALL">همه</button><button class="sts2-btn ${state.filter==='CASE'?'active':''}" data-sts2-filter="CASE">پشتیبانی پرونده</button><button class="sts2-btn ${state.filter==='URGENT_SECURITY'?'active':''}" data-sts2-filter="URGENT_SECURITY">فوری و امنیتی (${urgent.toLocaleString('fa-IR')})</button></nav></header><section class="sts2-layout"><aside class="sts2-card"><header class="sts2-card-head"><div><h3>صف گفت‌وگوها</h3><p>اولویت بحرانی در بالای صف قرار می‌گیرد.</p></div></header><div class="sts2-queue">${queueMarkup()}</div></aside><article class="sts2-card sts2-chat">${chatMarkup()}</article></section>`;
}
function render(){setPage(shell());requestAnimationFrame(()=>{const box=$('#sts2Messages');if(box)box.scrollTop=box.scrollHeight})}
async function load(openFirst=true){
  if(state.loading)return;state.loading=true;setPage(loading());
  try{
    const payload=await api('/api/caregiver/platform/support/threads');
    state.threads=payload.data?.threads||[];
    if(openFirst&&!state.activeId&&state.threads[0])state.activeId=state.threads[0].id;
    if(state.activeId&&!state.threads.some(item=>item.id===state.activeId)){state.activeId='';state.messages=[]}
    if(state.activeId)await loadMessages(false);
    render();
  }catch(error){setPage(empty('پشتیبانی بارگذاری نشد',error.message))}finally{state.loading=false}
}
async function loadMessages(renderAfter=true){
  if(!state.activeId)return;
  const payload=await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}/messages`);
  state.messages=payload.data?.messages||[];
  if(renderAfter)render();
}
async function uploadVoice(blob,caregiverId){
  const form=new FormData(),extension=blob.type.includes('ogg')?'ogg':'webm';
  form.append('file',new File([blob],`staff-support-${Date.now()}.${extension}`,{type:blob.type||'audio/webm'}));
  form.append('category','support');form.append('caregiverId',caregiverId);
  const response=await fetch('/api/files',{method:'POST',body:form,credentials:'same-origin',cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.message||'بارگذاری وویس انجام نشد.');
  return payload.data.id;
}
async function toggleRecording(button){
  if(state.recording){state.recording.stop();button.disabled=true;return}
  const thread=state.threads.find(item=>item.id===state.activeId);if(!thread)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('ضبط صدا پشتیبانی نمی‌شود','مرورگر یا دسترسی میکروفون آماده نیست.');return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const type=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
    state.chunks=[];state.recording=new MediaRecorder(stream,{mimeType:type});
    state.recording.ondataavailable=event=>{if(event.data.size)state.chunks.push(event.data)};
    state.recording.onstop=async()=>{
      const recorder=state.recording;state.recording=null;stream.getTracks().forEach(track=>track.stop());button.classList.remove('sts2-recording');button.textContent='● وویس';
      try{
        const fileId=await uploadVoice(new Blob(state.chunks,{type:recorder?.mimeType||'audio/webm'}),thread.caregiverId);
        await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}/messages`,{method:'POST',body:JSON.stringify({storedFileId:fileId})});
        notify('وویس ارسال شد','پیام صوتی در گفت‌وگو ثبت شد.');await loadMessages(true);
      }catch(error){notify('ارسال وویس انجام نشد',error.message)}finally{button.disabled=false}
    };
    state.recording.start();button.classList.add('sts2-recording');button.textContent='■ پایان ضبط';
  }catch(error){notify('دسترسی میکروفون داده نشد',error.message||'مجوز میکروفون را فعال کنید.')}
}
async function click(event){
  const filter=event.target?.closest?.('[data-sts2-filter]');
  if(filter){event.preventDefault();state.filter=filter.dataset.sts2Filter;const rows=filtered();if(state.activeId&&!rows.some(item=>item.id===state.activeId)){state.activeId=rows[0]?.id||'';state.messages=[];if(state.activeId)await loadMessages(false)}render();return}
  const thread=event.target?.closest?.('[data-sts2-thread]');
  if(thread){event.preventDefault();state.activeId=thread.dataset.sts2Thread;await loadMessages(true);return}
  const record=event.target?.closest?.('[data-sts2-record]');
  if(record){event.preventDefault();await toggleRecording(record)}
}
async function submit(event){
  if(event.target?.id!=='sts2MessageForm')return;
  event.preventDefault();const input=$('[name="text"]',event.target),text=String(input?.value||'').trim();if(!text)return;
  try{await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}/messages`,{method:'POST',body:JSON.stringify({text})});if(input)input.value='';await loadMessages(true)}catch(error){notify('ارسال پیام انجام نشد',error.message)}
}
async function change(event){
  if(!event.target?.matches?.('[data-sts2-status]')||!state.activeId)return;
  try{await api(`/api/caregiver/platform/support/threads/${encodeURIComponent(state.activeId)}`,{method:'PATCH',body:JSON.stringify({status:event.target.value})});notify('وضعیت به‌روزرسانی شد','گفت‌وگو در صف جدید قرار گرفت.');await load(false)}catch(error){notify('تغییر وضعیت انجام نشد',error.message)}
}
function boot(){
  addStyles();
  document.addEventListener('click',event=>void click(event),true);
  document.addEventListener('submit',event=>void submit(event),true);
  document.addEventListener('change',event=>void change(event),true);
  window.SalamatStaffSupport={version:VERSION,open:load,reload:load,direct:true};
  window.dispatchEvent(new CustomEvent('salamat-staff-support-ready',{detail:{version:VERSION,direct:true}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
