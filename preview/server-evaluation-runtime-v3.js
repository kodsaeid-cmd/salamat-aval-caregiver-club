(()=>{
'use strict';
if(window.__salamatServerEvaluationRuntimeV3)return;
window.__salamatServerEvaluationRuntimeV3=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const DIGITS={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
const normalize=value=>String(value||'').replace(/[۰-۹٠-٩]/g,char=>DIGITS[char]||char).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const queryValue=value=>normalize(value).slice(0,120);
const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const SCORE_LABELS={1:'نامطلوب',2:'ضعیف',3:'قابل قبول',4:'خوب',5:'عالی'};
const ROLE_LABELS={ADMIN:'مدیر سامانه',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات',CAREGIVER:'مراقب'};

const state={
  opened:false,
  permissions:{view:false,create:false,update:false,delete:false},
  page:1,
  query:'',
  pagination:{page:1,pageSize:50,total:0,totalPages:1,hasPrevious:false,hasNext:false},
  caregivers:[],
  selectedCaregiverId:'',
  selectedEvaluationId:'',
  evaluation:null,
  periods:[],
  directoryLoading:false,
  evaluationLoading:false,
  saving:false,
  error:'',
  openIndicator:'Q-01',
  searchTimer:null,
  requestSequence:0,
  directoryAbort:null,
  evaluationAbort:null,
  draft:new Map(),
  restoreSearchFocus:false,
};

function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function initials(name){return String(name||'م').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'م'}
function selectedCaregiver(){return state.caregivers.find(item=>String(item.id)===String(state.selectedCaregiverId))||null}
function percentWidth(value){return value==null?0:Math.max(0,Math.min(100,Number(value)))}
function periodStatus(period){return period?.status==='FINAL'?'نهایی‌شده':'پیش‌نویس'}
function formatDate(value){if(!value)return '';try{return new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return String(value)}}
function currentRole(){try{const user=window.SalamatBackend?.getCurrentUser?.()||{};return String(user.actualRole||user.role||'').toUpperCase()}catch{return ''}}
function isAdmin(){return currentRole()==='ADMIN'}
function can(action){return Boolean(state.permissions[action])}
function root(){return $('.sev3-root')}

async function request(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}
function errorText(error){return [error?.message||'عملیات انجام نشد',error?.code?`کد: ${error.code}`:'',error?.detail?String(error.detail).slice(0,350):''].filter(Boolean).join(' — ')}

async function loadPermissions(){
  if(window.SalamatAccessControl?.can){
    state.permissions={
      view:Boolean(window.SalamatAccessControl.can('staff.evaluations','view')),
      create:Boolean(window.SalamatAccessControl.can('staff.evaluations','create')),
      update:Boolean(window.SalamatAccessControl.can('staff.evaluations','update')),
      delete:Boolean(window.SalamatAccessControl.can('staff.evaluations','delete')),
    };
    return state.permissions;
  }
  const payload=await request('/api/access/me');
  const module=payload?.data?.allModules?.find(item=>item.key==='staff.evaluations');
  state.permissions={view:Boolean(module?.actions?.view),create:Boolean(module?.actions?.create),update:Boolean(module?.actions?.update),delete:Boolean(module?.actions?.delete)};
  return state.permissions;
}

function addStyles(){
  if($('#serverEvaluationStylesV3'))return;
  const style=document.createElement('style');style.id='serverEvaluationStylesV3';style.textContent=`
.sev3-root{direction:rtl;display:block}.sev3-loading,.sev3-empty{padding:42px;text-align:center;border:1px dashed #cfe0d7;border-radius:20px;background:#fbfdfc;color:#697970}.sev3-layout{display:grid;grid-template-columns:minmax(320px,.72fr) minmax(0,1.65fr);gap:16px;align-items:start}.sev3-panel{min-width:0;background:#fff;border:1px solid #dce8e2;border-radius:22px;overflow:hidden;box-shadow:0 12px 38px rgba(24,75,50,.045)}.sev3-head{padding:18px 20px;border-bottom:1px solid #edf2ef}.sev3-head h3{margin:0;font-size:15px}.sev3-head p{margin:6px 0 0;color:#7b8a82;font-size:10px;line-height:1.8}.sev3-body{padding:18px}.sev3-search-form{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-bottom:10px}.sev3-search{min-width:0;border:1px solid #d8e4de;border-radius:13px;background:#fff;padding:12px 13px;font:inherit;outline:none}.sev3-search:focus{border-color:#139357;box-shadow:0 0 0 3px #e0f5e9}.sev3-btn{border:0;border-radius:12px;padding:10px 14px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.sev3-btn.primary{background:#078848;color:#fff}.sev3-btn.soft{background:#edf8f2;color:#08743f}.sev3-btn.warn{background:#fff0d6;color:#945d00}.sev3-btn:disabled{opacity:.52;cursor:not-allowed}.sev3-meta{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:12px;color:#78877f;font-size:9px}.sev3-error{padding:10px 12px;margin-bottom:10px;border-radius:11px;background:#fff0f1;color:#ad2638;font-size:9px;font-weight:900;line-height:1.8}.sev3-list{display:grid;gap:8px;max-height:690px;overflow:auto;padding:3px}.sev3-care{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;border:1px solid #e0e9e4;border-radius:15px;background:#fff;padding:10px;text-align:right;cursor:pointer}.sev3-care:hover{border-color:#a8d9c0}.sev3-care.active{border-color:#0d9857;background:#f0faf5;box-shadow:0 0 0 2px #e2f5ea}.sev3-care strong{display:block;font-size:12px;color:#22372e}.sev3-care small{display:block;margin-top:4px;color:#78877f;font-size:9px;line-height:1.7}.sev3-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#08743f;font-size:9px;font-weight:900;white-space:nowrap}.sev3-badge.warn{background:#fff2dc;color:#966100}.sev3-badge.good{background:#e4f7ec;color:#087743}.sev3-avatar{display:grid;place-items:center;overflow:hidden;background:#dff3e8;color:#087a45;font-weight:900;border-radius:14px}.sev3-avatar img{width:100%;height:100%;object-fit:cover}.sev3-avatar-md{width:46px;height:46px}.sev3-avatar-lg{width:82px;height:82px;border-radius:22px;font-size:24px}.sev3-pagination{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #edf2ef}.sev3-page-actions{display:flex;gap:6px}.sev3-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.sev3-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.sev3-select{max-width:320px;border:1px solid #d8e4de;border-radius:13px;background:#fff;padding:11px 13px;font:inherit;outline:none}.sev3-profile{display:flex;align-items:center;gap:14px}.sev3-profile h2{margin:0;font-size:20px}.sev3-profile p{margin:6px 0 0;color:#74827b;font-size:10px}.sev3-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.sev3-kpi{border:1px solid #dfe9e4;border-radius:16px;background:#fbfdfc;padding:14px}.sev3-kpi small{display:block;color:#74837b;font-size:9px}.sev3-kpi strong{display:block;margin-top:7px;font-size:20px;color:#087a45}.sev3-kpi span{display:block;margin-top:4px;color:#819087;font-size:9px}.sev3-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:11px;border-radius:14px;background:#f7faf8;margin-bottom:14px}.sev3-scale div{text-align:center;font-size:9px;color:#68786f}.sev3-scale b{display:block;color:#087a45;font-size:14px;margin-bottom:3px}.sev3-indicators{display:grid;gap:10px}.sev3-indicator{border:1px solid #dce8e2;border-radius:18px;background:#fff;overflow:hidden}.sev3-indicator-head{display:grid;grid-template-columns:minmax(0,1fr) 210px auto;gap:15px;align-items:center;width:100%;border:0;background:#fff;padding:16px;text-align:right;cursor:pointer}.sev3-indicator-head:hover{background:#fbfdfc}.sev3-indicator-title b{display:inline-flex;margin-left:8px;color:#078848}.sev3-indicator-title strong{font-size:13px}.sev3-indicator-title small{display:block;margin-top:6px;color:#7a8981;font-size:9px}.sev3-progress{height:8px;border-radius:999px;background:#e6eeea;overflow:hidden}.sev3-progress i{display:block;height:100%;border-radius:999px;background:#12975a}.sev3-score{text-align:center}.sev3-score strong{display:block;color:#087a45;font-size:20px}.sev3-score small{display:block;color:#7e8d85;font-size:9px}.sev3-indicator-body{display:none;padding:0 16px 16px;border-top:1px solid #edf2ef}.sev3-indicator.open .sev3-indicator-body{display:block}.sev3-criterion{display:grid;grid-template-columns:minmax(220px,1fr) minmax(320px,1.35fr);gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid #edf2ef}.sev3-criterion:last-of-type{border-bottom:0}.sev3-criterion-title strong{display:block;font-size:11px}.sev3-criterion-title small{display:block;margin-top:5px;color:#7d8b84;font-size:9px;line-height:1.7}.sev3-audit{margin-top:6px;padding:6px 8px;border-radius:9px;background:#f2f7f4;color:#53675c;font-size:8px;line-height:1.8}.sev3-score-options{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.sev3-score-option{position:relative}.sev3-score-option input{position:absolute;opacity:0;pointer-events:none}.sev3-score-option span{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;border:1px solid #dce7e1;border-radius:11px;background:#fff;color:#596b61;font-size:8px;cursor:pointer}.sev3-score-option span b{font-size:14px;color:#34493e;margin-bottom:2px}.sev3-score-option input:checked+span{border-color:#078848;background:#eaf8f0;color:#087343;box-shadow:0 0 0 2px #d9f3e5}.sev3-score-option input:disabled+span{cursor:not-allowed;opacity:.7}.sev3-note{width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #e0e8e4;border-radius:10px;padding:8px 10px;font:inherit;font-size:9px;outline:none}.sev3-note:focus{border-color:#15945a}.sev3-indicator-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;padding-top:13px;border-top:1px solid #edf2ef}.sev3-hint{color:#74837b;font-size:9px;line-height:1.8}.sev3-final{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding:18px;border:1px solid #cfe4d9;border-radius:18px;background:#f8fcfa}.sev3-final h3{margin:0;font-size:14px}.sev3-final p{margin:6px 0 0;color:#75847c;font-size:10px;line-height:1.8}.sev3-readonly{padding:10px 12px;margin-bottom:12px;border-radius:12px;background:#f5f8f6;color:#607168;font-size:9px;line-height:1.8}
@media(max-width:1150px){.sev3-layout{grid-template-columns:1fr}.sev3-list{max-height:380px}.sev3-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:740px){.sev3-search-form{grid-template-columns:1fr 1fr}.sev3-search{grid-column:1/-1}.sev3-toolbar{align-items:stretch;flex-direction:column}.sev3-actions{width:100%}.sev3-select{width:100%;max-width:none}.sev3-kpis,.sev3-scale{grid-template-columns:1fr}.sev3-indicator-head{grid-template-columns:1fr}.sev3-criterion{grid-template-columns:1fr}.sev3-score-options{grid-template-columns:repeat(5,minmax(48px,1fr))}}
`;
  document.head.appendChild(style);
}

function avatar(item,size='md'){
  const cls=`sev3-avatar sev3-avatar-${size}`;
  return item?.avatarUrl
    ? `<span class="${cls}"><img src="${esc(item.avatarUrl)}${item.avatarUrl.includes('?')?'&':'?'}v=${encodeURIComponent(item.avatarId||'1')}" alt="${esc(item.fullName||'مراقب')}"></span>`
    : `<span class="${cls}">${esc(initials(item?.fullName))}</span>`;
}
function setPage(title,subtitle,html){
  const titleEl=$('#pageTitle'),subtitleEl=$('#pageSubtitle'),content=$('#content');
  if(titleEl)titleEl.textContent=title;
  if(subtitleEl)subtitleEl.textContent=subtitle;
  if(content)content.innerHTML=`<section class="module-page sev3-root">${html}</section>`;
  try{window.hydrateIcons?.(content)}catch{}
}
function draftFor(criterion){return state.draft.get(criterion.code)||{score:criterion.score??null,note:criterion.note||'',updatedAt:criterion.updatedAt||null,scoredBy:criterion.scoredBy||null}}
function resetDraft(){
  state.draft=new Map();
  for(const indicator of state.evaluation?.indicators||[]){
    for(const criterion of indicator.criteria||[]){
      state.draft.set(criterion.code,{score:criterion.score??null,note:criterion.note||'',updatedAt:criterion.updatedAt||null,scoredBy:criterion.scoredBy||null});
    }
  }
}
function preserveDraftForUnsaved(previous,savedCodes){
  const next=new Map(state.draft);
  for(const [code,value] of previous.entries())if(!savedCodes.has(code))next.set(code,value);
  state.draft=next;
}
function directoryEndpoint(){
  const url=new URL('/api/admin/caregivers-page',location.origin);
  url.searchParams.set('page',String(state.page));
  const q=queryValue(state.query);if(q)url.searchParams.set('q',q);
  return `${url.pathname}${url.search}`;
}
function evaluationEndpoint(caregiverId,evaluationId=''){
  const params=new URLSearchParams({caregiverId:String(caregiverId)});if(evaluationId)params.set('evaluationId',String(evaluationId));
  return `/api/evaluations?${params}`;
}
function focusSearch(){
  if(!state.restoreSearchFocus)return;
  state.restoreSearchFocus=false;
  requestAnimationFrame(()=>{const input=$('#sev3CareSearch');input?.focus();try{input?.setSelectionRange(input.value.length,input.value.length)}catch{}});
}

async function loadDirectory({page=1,query=state.query,keepSelection=false,focus=false}={}){
  if(!state.opened||!can('view'))return;
  state.directoryAbort?.abort();state.directoryAbort=new AbortController();
  const sequence=++state.requestSequence;
  state.page=Math.max(1,Number(page)||1);state.query=String(query||'');state.directoryLoading=true;state.error='';state.restoreSearchFocus=focus;
  render();
  try{
    const payload=await request(directoryEndpoint(),{signal:state.directoryAbort.signal});
    if(!state.opened||sequence!==state.requestSequence)return;
    const data=payload?.data||{};
    state.caregivers=Array.isArray(data.items)?data.items:[];
    state.pagination={page:1,pageSize:50,total:0,totalPages:1,hasPrevious:false,hasNext:false,...(data.pagination||{})};
    state.page=Number(state.pagination.page||1);
    if(!keepSelection||!state.caregivers.some(item=>String(item.id)===String(state.selectedCaregiverId)))state.selectedCaregiverId=state.caregivers[0]?.id||'';
    state.directoryLoading=false;state.selectedEvaluationId='';
    if(state.selectedCaregiverId)await loadEvaluation(state.selectedCaregiverId,'',{renderBefore:false});
    else{state.evaluation=null;state.periods=[];state.draft=new Map();render();focusSearch()}
  }catch(error){
    if(error?.name==='AbortError'||sequence!==state.requestSequence)return;
    state.directoryLoading=false;state.error=errorText(error);state.caregivers=[];state.evaluation=null;state.periods=[];state.draft=new Map();render();focusSearch();
  }
}
async function loadEvaluation(caregiverId,evaluationId='',options={renderBefore:true}){
  if(!state.opened)return;
  state.evaluationAbort?.abort();state.evaluationAbort=new AbortController();
  state.selectedCaregiverId=String(caregiverId||'');state.selectedEvaluationId=String(evaluationId||'');state.evaluationLoading=true;state.error='';
  if(options.renderBefore)render();
  try{
    const payload=await request(evaluationEndpoint(state.selectedCaregiverId,state.selectedEvaluationId),{signal:state.evaluationAbort.signal});
    if(!state.opened)return;
    const data=payload?.data||{};state.periods=Array.isArray(data.periods)?data.periods:[];state.evaluation=data.evaluation||null;state.selectedEvaluationId=state.evaluation?.id||'';state.evaluationLoading=false;resetDraft();render();focusSearch();
  }catch(error){
    if(error?.name==='AbortError')return;
    state.evaluationLoading=false;state.error=errorText(error);state.evaluation=null;state.periods=[];state.draft=new Map();render();focusSearch();
  }
}

function caregiverRows(){
  if(state.directoryLoading&&!state.caregivers.length)return '<div class="sev3-loading">در حال جست‌وجو در پرونده‌های مراقبین...</div>';
  if(!state.caregivers.length)return `<div class="sev3-empty">${state.query?'نتیجه‌ای برای این جست‌وجو پیدا نشد.':'پرونده مراقبی وجود ندارد.'}</div>`;
  return state.caregivers.map(item=>`<button type="button" class="sev3-care ${String(item.id)===String(state.selectedCaregiverId)?'active':''}" data-sev3-caregiver="${esc(item.id)}">${avatar(item)}<span><strong>${esc(item.fullName)}</strong><small>${esc(item.membershipCode||item.id)}<br>${esc(item.mobile||'شماره ثبت نشده')}</small></span><i class="sev3-badge ${item.hasAccount?'good':'warn'}">${item.hasAccount?'حساب متصل':'بدون حساب'}</i></button>`).join('');
}
function scaleMarkup(){return `<div class="sev3-scale">${Object.entries(SCORE_LABELS).map(([score,label])=>`<div><b>${fa(score)}</b>${label}</div>`).join('')}</div>`}
function criterionAudit(criterion){
  if(!isAdmin()||!criterion.scoredBy)return '';
  const scored=criterion.scoredBy;const role=ROLE_LABELS[String(scored.role||'').toUpperCase()]||scored.role||'کاربر سازمانی';
  return `<div class="sev3-audit"><strong>ثبت‌کننده امتیاز:</strong> ${esc(scored.fullName||'کاربر سازمانی')} • ${esc(role)}${scored.updatedAt?`<br><span>${esc(formatDate(scored.updatedAt))}</span>`:''}</div>`;
}
function scoreOptions(criterion,locked){
  const draft=draftFor(criterion);const disabled=locked||!can('update')||state.saving;
  return `<div><div class="sev3-score-options">${Object.entries(SCORE_LABELS).map(([score,label])=>`<label class="sev3-score-option"><input type="radio" name="${esc(criterion.code)}" data-sev3-score="${esc(criterion.code)}" value="${score}" ${Number(draft.score)===Number(score)?'checked':''} ${disabled?'disabled':''}><span><b>${fa(score)}</b>${label}</span></label>`).join('')}</div><input class="sev3-note" data-sev3-note="${esc(criterion.code)}" value="${esc(draft.note||'')}" placeholder="یادداشت یا مرجع مشاهده‌شده" ${disabled?'disabled':''}></div>`;
}
function indicatorMarkup(indicator,locked){
  const draftValues=indicator.criteria.map(item=>draftFor(item).score).filter(value=>Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=5).map(Number);
  const live=draftValues.length?Math.round(draftValues.reduce((a,b)=>a+b,0)/draftValues.length*200)/10:null;
  return `<article class="sev3-indicator ${indicator.code===state.openIndicator?'open':''}" data-sev3-indicator="${esc(indicator.code)}"><button class="sev3-indicator-head" type="button" data-sev3-toggle="${esc(indicator.code)}"><span class="sev3-indicator-title"><b>${esc(indicator.code)}</b><strong>${esc(indicator.title)}</strong><small>منبع ارزیابی: ${esc(indicator.sources)}</small></span><span><span class="sev3-progress"><i style="width:${percentWidth(live)}%"></i></span><small style="display:block;margin-top:6px;color:#7c8a83;font-size:9px">${fa(draftValues.length)} از ${fa(indicator.criteria.length)} معیار امتیازدهی شده</small></span><span class="sev3-score"><strong>${live==null?'—':fa(live)}</strong><small>امتیاز شاخص از ۱۰۰</small></span></button><div class="sev3-indicator-body">${indicator.criteria.map((criterion,index)=>{const draft=draftFor(criterion);return `<div class="sev3-criterion" data-sev3-criterion="${esc(criterion.code)}"><span class="sev3-criterion-title"><strong>${fa(index+1)}. ${esc(criterion.title)}</strong><small>${draft.updatedAt?`آخرین ثبت: ${esc(formatDate(draft.updatedAt))}`:'هنوز امتیازی ثبت نشده است'}</small>${criterionAudit(draft)}</span>${scoreOptions(criterion,locked)}</div>`}).join('')}<div class="sev3-indicator-footer"><span class="sev3-hint">میانگین امتیازهای ۱ تا ۵ × ۲۰؛ هویت ثبت‌کننده فقط برای مدیر سامانه نمایش داده می‌شود.</span>${locked?'<span class="sev3-badge good">ارزیابی قفل شده</span>':can('update')?`<button class="sev3-btn primary" type="button" data-sev3-save="${esc(indicator.code)}" ${state.saving?'disabled':''}>ذخیره امتیازات شاخص</button>`:'<span class="sev3-badge">فقط مشاهده</span>'}</div></div></article>`;
}
function evaluationPanel(){
  const caregiver=selectedCaregiver();if(!caregiver)return '<div class="sev3-empty">ابتدا یک مراقب را از فهرست انتخاب کنید.</div>';
  if(state.evaluationLoading)return '<div class="sev3-loading">در حال دریافت دوره‌های ارزیابی...</div>';
  const evaluation=state.evaluation;
  if(!evaluation)return `<div class="sev3-toolbar"><div class="sev3-profile">${avatar(caregiver,'lg')}<div><h2>${esc(caregiver.fullName)}</h2><p>${esc(caregiver.membershipCode||caregiver.id)} • ${esc(caregiver.primaryType||'گروه خدمتی ثبت نشده')}</p></div></div>${can('create')?'<button class="sev3-btn primary" type="button" id="sev3NewPeriod">ایجاد دوره ارزیابی</button>':''}</div><div class="sev3-empty">برای این مراقب هنوز دوره ارزیابی ایجاد نشده است.${can('create')?' با دکمه بالا دوره جدید بسازید.':''}</div>`;
  const locked=evaluation.status==='FINAL';
  const values=[...state.draft.values()].map(item=>Number(item.score)).filter(value=>value>=1&&value<=5);const completed=(evaluation.indicators||[]).filter(indicator=>indicator.criteria.every(item=>{const score=Number(draftFor(item).score);return score>=1&&score<=5})).length;const overall=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*200)/10:null;
  return `<div class="sev3-toolbar"><div class="sev3-profile">${avatar(caregiver,'lg')}<div><h2>${esc(caregiver.fullName)}</h2><p>${esc(caregiver.membershipCode||caregiver.id)} • ${esc(caregiver.primaryType||'گروه خدمتی ثبت نشده')}</p></div></div><div class="sev3-actions"><select class="sev3-select" id="sev3PeriodSelect">${state.periods.map(period=>`<option value="${esc(period.id)}" ${String(period.id)===String(evaluation.id)?'selected':''}>${esc(period.title)} • ${periodStatus(period)}</option>`).join('')}</select>${can('create')?'<button class="sev3-btn soft" type="button" id="sev3NewPeriod">دوره جدید</button>':''}</div></div>${!can('update')&&!locked?'<div class="sev3-readonly">این حساب اختیار مشاهده دارد، اما اجازه ثبت یا تغییر امتیازها برای آن فعال نشده است.</div>':''}<div class="sev3-kpis"><article class="sev3-kpi"><small>معیارهای امتیازدهی‌شده</small><strong>${fa(values.length)} / ${fa(evaluation.totalCriteria)}</strong><span>در دوره جاری</span></article><article class="sev3-kpi"><small>شاخص‌های کامل</small><strong>${fa(completed)} / ۸</strong><span>هر شاخص پس از تکمیل همه معیارها</span></article><article class="sev3-kpi"><small>امتیاز لحظه‌ای</small><strong>${overall==null?'—':fa(overall)}</strong><span>بر اساس امتیازهای روی فرم</span></article><article class="sev3-kpi"><small>وضعیت دوره</small><strong style="font-size:16px">${periodStatus(evaluation)}</strong><span>${esc(evaluation.title)}</span></article></div>${scaleMarkup()}<div class="sev3-indicators">${evaluation.indicators.map(indicator=>indicatorMarkup(indicator,locked)).join('')}</div><div class="sev3-final"><div><h3>ذخیره و نهایی‌سازی ارزیابی</h3><p>پس از نهایی‌سازی، امتیاز در پرونده و کارنامه مراقب ثبت و دوره قفل می‌شود.</p></div>${locked?`<span class="sev3-badge good">امتیاز نهایی: ${fa(evaluation.finalScore)}</span>`:can('update')?`<button class="sev3-btn primary" type="button" id="sev3Finalize" ${state.saving?'disabled':''}>ذخیره همه و ثبت نهایی ارزیابی</button>`:'<span class="sev3-badge">فقط مشاهده</span>'}</div>`;
}
function render(){
  if(!state.opened)return;
  const p=state.pagination;
  setPage('ارزیابی و پروانه','مدیریت دوره‌های ارزیابی بر اساس سطح دسترسی ثبت‌شده در حساب',`<div class="sev3-layout"><aside class="sev3-panel"><div class="sev3-head"><h3>فهرست مراقبین</h3><p>نام، موبایل، کد ملی یا شماره پرونده را جست‌وجو کنید.</p></div><div class="sev3-body"><form class="sev3-search-form" id="sev3SearchForm"><input class="sev3-search" id="sev3CareSearch" value="${esc(state.query)}" autocomplete="off" placeholder="جست‌وجوی نام، موبایل، کد ملی یا کد پرونده"><button class="sev3-btn primary" type="submit" ${state.directoryLoading?'disabled':''}>${state.directoryLoading?'در حال جست‌وجو...':'جست‌وجو'}</button><button class="sev3-btn soft" type="button" id="sev3ClearSearch" ${state.directoryLoading?'disabled':''}>پاک‌کردن</button></form>${state.error?`<div class="sev3-error">${esc(state.error)}</div>`:''}<div class="sev3-meta"><span>${fa(p.total)} پرونده یافت شد</span><span>صفحه ${fa(p.page)} از ${fa(p.totalPages)}</span></div><div class="sev3-list">${caregiverRows()}</div><div class="sev3-pagination"><span>${fa(state.caregivers.length)} مورد در این صفحه</span><div class="sev3-page-actions"><button class="sev3-btn soft" type="button" id="sev3Prev" ${p.hasPrevious&&!state.directoryLoading?'':'disabled'}>صفحه قبل</button><button class="sev3-btn soft" type="button" id="sev3Next" ${p.hasNext&&!state.directoryLoading?'':'disabled'}>صفحه بعد</button></div></div></div></aside><main class="sev3-panel"><div class="sev3-head"><h3>فرم ارزیابی حرفه‌ای</h3><p>${isAdmin()?'نام ثبت‌کننده هر معیار فقط در این نمای مدیریتی قابل مشاهده است.':'اطلاعات هویتی ثبت‌کنندگان امتیاز در این سطح دسترسی نمایش داده نمی‌شود.'}</p></div><div class="sev3-body">${evaluationPanel()}</div></main></div>`);
}

function updateDraftFromInput(target){
  const code=target.dataset.sev3Score||target.dataset.sev3Note;if(!code)return;
  const current=state.draft.get(code)||{score:null,note:'',updatedAt:null,scoredBy:null};
  if(target.dataset.sev3Score)current.score=Number(target.value);
  if(target.dataset.sev3Note)current.note=String(target.value||'');
  state.draft.set(code,current);
}
function recalcDom(){
  for(const card of $$('.sev3-indicator')){
    const values=$$('input[data-sev3-score]:checked',card).map(input=>Number(input.value)).filter(value=>value>=1&&value<=5);
    const score=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*200)/10:null;
    const scoreEl=$('.sev3-score strong',card);if(scoreEl)scoreEl.textContent=score==null?'—':fa(score);
    const progress=$('.sev3-progress i',card);if(progress)progress.style.width=`${percentWidth(score)}%`;
  }
  const all=[...state.draft.values()].map(item=>Number(item.score)).filter(value=>value>=1&&value<=5);
  const completed=(state.evaluation?.indicators||[]).filter(indicator=>indicator.criteria.every(item=>{const value=Number(draftFor(item).score);return value>=1&&value<=5})).length;
  const kpis=$$('.sev3-kpis .sev3-kpi strong');if(kpis[0])kpis[0].textContent=`${fa(all.length)} / ${fa(state.evaluation?.totalCriteria||0)}`;if(kpis[1])kpis[1].textContent=`${fa(completed)} / ۸`;if(kpis[2])kpis[2].textContent=all.length?fa(Math.round(all.reduce((a,b)=>a+b,0)/all.length*200)/10):'—';
}
function indicatorScores(indicator){return indicator.criteria.map(criterion=>{const draft=draftFor(criterion);const score=Number(draft.score);if(!Number.isInteger(score)||score<1||score>5)return null;return {criterionCode:criterion.code,score,note:String(draft.note||'').trim()}}).filter(Boolean)}
async function saveIndicator(code,{silent=false}={}){
  if(!can('update'))throw new Error('این حساب اجازه تغییر امتیازها را ندارد.');
  const evaluation=state.evaluation;const indicator=evaluation?.indicators?.find(item=>item.code===code);if(!evaluation||!indicator)return null;
  const scores=indicatorScores(indicator);if(!scores.length)throw new Error('حداقل یک معیار را امتیازدهی کنید.');
  const previous=new Map(state.draft);const savedCodes=new Set(scores.map(item=>item.criterionCode));
  const payload=await request(`/api/evaluations/${encodeURIComponent(evaluation.id)}/indicators/${encodeURIComponent(code)}`,{method:'PUT',body:JSON.stringify({scores})});
  const data=payload?.data||{};state.evaluation=data.evaluation||state.evaluation;state.periods=Array.isArray(data.periods)?data.periods:state.periods;resetDraft();preserveDraftForUnsaved(previous,savedCodes);
  if(!silent){render();notify('امتیازها ذخیره شد',`${code} در دیتابیس ثبت شد.`)}
  return payload;
}
async function finalizeEvaluation(){
  if(!can('update')||!state.evaluation)return;
  const incomplete=[];for(const indicator of state.evaluation.indicators)for(const criterion of indicator.criteria){const score=Number(draftFor(criterion).score);if(!Number.isInteger(score)||score<1||score>5)incomplete.push({indicator:indicator.code,criterion:criterion.code})}
  if(incomplete.length){state.openIndicator=incomplete[0].indicator;render();notify('ارزیابی ناقص است',`${fa(incomplete.length)} معیار هنوز امتیاز ندارد.`);return}
  if(!confirm('تمام امتیازها ذخیره و دوره نهایی می‌شود. ادامه می‌دهید؟'))return;
  state.saving=true;render();
  try{
    for(const indicator of state.evaluation.indicators)await saveIndicator(indicator.code,{silent:true});
    const payload=await request(`/api/evaluations/${encodeURIComponent(state.evaluation.id)}/finalize`,{method:'POST'});const data=payload?.data||{};state.evaluation=data.evaluation||state.evaluation;state.periods=Array.isArray(data.periods)?data.periods:state.periods;resetDraft();state.saving=false;render();window.dispatchEvent(new CustomEvent('salamat-evaluation-changed',{detail:{caregiverId:state.selectedCaregiverId,evaluationId:state.evaluation.id,finalized:true,source:'server-evaluation-runtime-v3'}}));window.dispatchEvent(new CustomEvent('salamat-server-directory-refresh'));notify('ارزیابی نهایی شد','امتیاز نهایی در پرونده و کارنامه مراقب ثبت شد.');
  }catch(error){state.saving=false;state.error=errorText(error);render();notify('نهایی‌سازی انجام نشد',state.error)}
}
async function createPeriod(){
  if(!can('create')||!state.selectedCaregiverId)return;
  const title=prompt('عنوان دوره ارزیابی را وارد کنید:','دوره ارزیابی جدید');if(!title)return;
  const startDate=prompt('تاریخ شروع دوره:','')||'';const endDate=prompt('تاریخ پایان دوره:','')||'';
  state.saving=true;render();
  try{const payload=await request('/api/evaluations',{method:'POST',body:JSON.stringify({caregiverId:state.selectedCaregiverId,title,startDate,endDate})});const data=payload?.data||{};state.evaluation=data.evaluation||null;state.periods=Array.isArray(data.periods)?data.periods:[];state.selectedEvaluationId=state.evaluation?.id||'';resetDraft();state.saving=false;render();notify('دوره ایجاد شد','فرم ارزیابی جدید آماده است.')}catch(error){state.saving=false;state.error=errorText(error);render();notify('ایجاد دوره انجام نشد',state.error)}
}

function stop(event){event.preventDefault();event.stopPropagation()}
function captureSubmit(event){if(!state.opened||event.target?.id!=='sev3SearchForm')return;stop(event);clearTimeout(state.searchTimer);const input=$('#sev3CareSearch');void loadDirectory({page:1,query:input?.value||'',focus:true})}
function captureInput(event){if(!state.opened||!root())return;if(event.target?.dataset?.sev3Note){updateDraftFromInput(event.target);return}if(event.target?.id!=='sev3CareSearch')return;state.query=String(event.target.value||'');clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>void loadDirectory({page:1,query:state.query,focus:true}),380)}
function captureChange(event){if(!state.opened||!root())return;if(event.target?.dataset?.sev3Score){updateDraftFromInput(event.target);recalcDom();return}if(event.target?.id==='sev3PeriodSelect'){void loadEvaluation(state.selectedCaregiverId,event.target.value)}}
function captureClick(event){
  if(!state.opened||!root())return;
  const caregiver=event.target?.closest?.('[data-sev3-caregiver]');if(caregiver){stop(event);void loadEvaluation(caregiver.dataset.sev3Caregiver);return}
  const toggle=event.target?.closest?.('[data-sev3-toggle]');if(toggle){stop(event);state.openIndicator=toggle.dataset.sev3Toggle;$$('.sev3-indicator').forEach(card=>card.classList.toggle('open',card.dataset.sev3Indicator===state.openIndicator));return}
  const save=event.target?.closest?.('[data-sev3-save]');if(save){stop(event);state.saving=true;save.disabled=true;void saveIndicator(save.dataset.sev3Save).catch(error=>{state.error=errorText(error);render();notify('ذخیره انجام نشد',state.error)}).finally(()=>{state.saving=false});return}
  if(event.target?.closest?.('#sev3NewPeriod')){stop(event);void createPeriod();return}
  if(event.target?.closest?.('#sev3Finalize')){stop(event);void finalizeEvaluation();return}
  if(event.target?.closest?.('#sev3ClearSearch')){stop(event);clearTimeout(state.searchTimer);state.query='';void loadDirectory({page:1,query:'',focus:true});return}
  if(event.target?.closest?.('#sev3Prev')&&!event.target.closest('#sev3Prev').disabled){stop(event);void loadDirectory({page:state.page-1,query:state.query,keepSelection:true});return}
  if(event.target?.closest?.('#sev3Next')&&!event.target.closest('#sev3Next').disabled){stop(event);void loadDirectory({page:state.page+1,query:state.query,keepSelection:true})}
}

document.addEventListener('submit',captureSubmit,true);
document.addEventListener('input',captureInput,true);
document.addEventListener('change',captureChange,true);
document.addEventListener('click',captureClick,true);

async function open(){
  addStyles();await loadPermissions();
  if(!can('view')){notify('دسترسی محدود است','ماژول ارزیابی و پروانه برای این حساب فعال نشده است.');return}
  state.opened=true;state.page=1;state.query='';state.error='';state.selectedEvaluationId='';state.evaluation=null;state.periods=[];state.draft=new Map();await loadDirectory({page:1,query:''});
}
function close(){state.opened=false;clearTimeout(state.searchTimer);state.directoryAbort?.abort();state.evaluationAbort?.abort();state.saving=false}
function refresh(){if(!state.opened)return Promise.resolve();return loadDirectory({page:state.page,query:state.query,keepSelection:true})}

window.SalamatEvaluationModuleV3={open,close,refresh,state};
})();
