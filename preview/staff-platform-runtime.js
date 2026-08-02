(()=>{
'use strict';
if(window.__salamatStaffPlatformRuntimeV2)return;
window.__salamatStaffPlatformRuntimeV2=true;

/* Retire role-specific recruiter patches. The unified staff shell owns navigation. */
window.__salamatRecruiterLiveRuntimeLoaderV5=true;
window.__salamatRecruiterServerRuntimeV2=true;
window.__salamatEvaluationDirectoryPaginationFixV4=true;
window.__salamatAccessControlRuntimeV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
const CACHE_TTL=30_000;
const roleLabels={ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
const statusLabels={ACTIVE:'فعال',APPROVED:'فعال',PENDING:'در انتظار تأیید',SUSPENDED:'تعلیق‌شده',INACTIVE:'غیرفعال'};
const actionLabels={view:'مشاهده',create:'ثبت',update:'تغییر',delete:'حذف'};
const state={access:null,model:null,activeKey:'',loading:null,config:null,users:[],page:1,query:'',pagination:null,selectedUserId:'',usersAbort:null};

function currentUser(){try{return window.SalamatBackend?.getCurrentUser?.()||null}catch{return null}}
function isAdmin(){return String(state.access?.user?.role||currentUser()?.actualRole||currentUser()?.role||'').toUpperCase()==='ADMIN'}
function moduleByKey(key){return state.access?.allModules?.find(module=>module.key===key)||null}
function can(key,action='view'){return Boolean(moduleByKey(key)?.actions?.[action])}
function staffModules(){return (state.access?.modules||[]).filter(module=>module.panel==='STAFF'&&module.actions?.view)}
function initials(name){return String(name||'ک').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'ک'}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function accessCacheKey(){const id=currentUser()?.id||state.access?.user?.id;return id?`salamatAccessSnapshotV2:${id}`:''}
function clearAccessCache(){for(let i=sessionStorage.length-1;i>=0;i-=1){const key=sessionStorage.key(i);if(key?.startsWith('salamatAccessSnapshotV2:'))sessionStorage.removeItem(key)}}

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}

function addStyles(){
  if($('#staffPlatformStylesV2'))return;
  const style=document.createElement('style');style.id='staffPlatformStylesV2';style.textContent=`
.role-section,#roleOptions{display:none!important}.staff-shell-loading{min-height:260px;display:grid;place-items:center;border:1px dashed #cee0d6;border-radius:22px;background:#fbfdfc;color:#6d7d74;font-size:12px;font-weight:800}.spx-root{direction:rtl;display:grid;gap:15px}.spx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.spx-toolbar h2{margin:0;font-size:20px}.spx-toolbar p{margin:6px 0 0;color:#78877f;font-size:10px}.spx-actions{display:flex;gap:8px;flex-wrap:wrap}.spx-btn{border:0;border-radius:12px;padding:10px 14px;background:#edf8f2;color:#087747;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.spx-btn.primary{background:#078848;color:#fff}.spx-btn.danger{background:#ffe8ec;color:#b1283d}.spx-btn:disabled{opacity:.45;cursor:not-allowed}.spx-grid{display:grid;grid-template-columns:minmax(330px,.72fr) minmax(0,1.28fr);gap:14px;align-items:start}.spx-card{background:#fff;border:1px solid #dce8e2;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(22,72,48,.045)}.spx-head{padding:16px 18px;border-bottom:1px solid #eaf0ed}.spx-head h3{margin:0;font-size:15px}.spx-head p{margin:6px 0 0;color:#7b8982;font-size:9px}.spx-body{padding:15px}.spx-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:11px}.spx-input,.spx-select{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;background:#fff;padding:11px 12px;font:inherit;font-size:10px;outline:none}.spx-input:focus,.spx-select:focus{border-color:#149257;box-shadow:0 0 0 3px #e0f5e9}.spx-list{display:grid;gap:8px;max-height:620px;overflow:auto}.spx-user{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;border:1px solid #e0e9e4;border-radius:15px;background:#fff;padding:9px;text-align:right;cursor:pointer}.spx-user:hover,.spx-user.active{border-color:#0d9857;background:#f2fbf6}.spx-avatar{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#dff3e8;color:#087a45;font-weight:900}.spx-user strong{display:block;font-size:10px}.spx-user small{display:block;margin-top:4px;color:#78877f;font-size:8px;line-height:1.7}.spx-badges{display:grid;gap:4px;justify-items:end}.spx-badge{padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900;white-space:nowrap}.spx-badge.warn{background:#fff1d8;color:#946000}.spx-badge.danger{background:#ffe8eb;color:#ae2638}.spx-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:11px;padding-top:11px;border-top:1px solid #edf2ef;color:#718078;font-size:9px}.spx-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.spx-field{display:grid;gap:6px}.spx-field>span{font-size:9px;font-weight:900;color:#3b5246}.spx-field.wide{grid-column:1/-1}.spx-note{padding:10px 12px;border-radius:12px;background:#f5faf7;color:#63756b;font-size:9px;line-height:1.9}.spx-matrix{grid-column:1/-1;border:1px solid #e0e9e4;border-radius:16px;overflow:hidden}.spx-matrix-head,.spx-matrix-row{display:grid;grid-template-columns:minmax(180px,1fr) repeat(4,70px);align-items:center}.spx-matrix-head{background:#f4f9f6;color:#52675c;font-size:8px;font-weight:900}.spx-matrix-head>*{padding:9px;text-align:center}.spx-matrix-head>*:first-child{text-align:right}.spx-matrix-row{border-top:1px solid #edf2ef}.spx-matrix-row>span{padding:9px}.spx-matrix-row strong{display:block;font-size:9px}.spx-matrix-row small{display:block;margin-top:4px;color:#7c8a83;font-size:7px}.spx-check{display:grid;place-items:center;padding:9px}.spx-check input{width:17px;height:17px;accent-color:#078848}.spx-empty,.spx-loading{padding:38px;text-align:center;border:1px dashed #d0dfd7;border-radius:17px;color:#718078;background:#fbfdfc}.spx-dashboard{display:grid;gap:15px}.spx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.spx-kpi{background:#fff;border:1px solid #dce8e2;border-radius:19px;padding:16px}.spx-kpi small{display:block;color:#75847c;font-size:9px}.spx-kpi strong{display:block;margin-top:8px;font-size:22px;color:#0a7544}.spx-modules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.spx-module{border:1px solid #dce8e2;border-radius:17px;background:#fff;padding:15px;text-align:right;cursor:pointer}.spx-module:hover{border-color:#139258;background:#f5fcf8}.spx-module strong{display:block;font-size:11px}.spx-module small{display:block;margin-top:6px;color:#78877f;font-size:8px;line-height:1.8}@media(max-width:1050px){.spx-grid{grid-template-columns:1fr}.spx-kpis{grid-template-columns:repeat(2,1fr)}.spx-modules{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.spx-form{grid-template-columns:1fr}.spx-field.wide{grid-column:auto}.spx-matrix{overflow:auto}.spx-matrix-head,.spx-matrix-row{min-width:600px}.spx-user{grid-template-columns:42px minmax(0,1fr)}.spx-badges{grid-column:1/-1;display:flex}.spx-kpis,.spx-modules{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

function hideRoleChoice(){
  $('.role-section')?.setAttribute('aria-hidden','true');
  const label=$('#emailFields label');if(label)label.textContent='نام کاربری یا ایمیل سازمانی';
  const identifier=$('#emailFields #backendIdentifierInput,#emailFields input[autocomplete="username"],#emailFields input[type="email"],#emailFields input[type="text"]');
  if(identifier){identifier.type='text';identifier.placeholder='نام کاربری یا ایمیل سازمانی';identifier.autocomplete='username'}
}

function buildModel(){
  const base=window.roles?.admin||{};const user=state.access.user;const modules=staffModules();
  return {...base,name:user.fullName||base.name,initials:initials(user.fullName),role:user.roleLabel||roleLabels[user.role]||'کاربر سازمانی',title:`پنل ${user.roleLabel||roleLabels[user.role]||'سازمانی'}`,subtitle:'ماژول‌ها بر اساس دسترسی ثبت‌شده در حساب شما نمایش داده می‌شوند.',nav:modules.map(module=>[module.icon,module.label])};
}
function updateIdentity(){
  const user=state.access?.user;if(!user)return;
  const name=user.fullName||'کاربر سازمانی';const role=user.roleLabel||roleLabels[user.role]||'کاربر سازمانی';const avatar=initials(name);
  [['#sidebarName',name],['#topName',name],['#sidebarRole',role],['#topRole',role],['#sidebarAvatar',avatar],['#topAvatar',avatar]].forEach(([selector,value])=>{const node=$(selector);if(node)node.textContent=value});
}
function tagNavigation(){
  const modules=staffModules();const buttons=$$('#sidebarNav .nav-item,#sidebarNav button');
  buttons.forEach((button,index)=>{const module=modules[index]||modules.find(item=>normalize(button.textContent).includes(item.label));if(module)button.dataset.staffModuleKey=module.key});
}
function applyStaffShell(open=true){
  if(!state.access||state.access.panel!=='STAFF'||!window.renderNav||!window.roles?.admin)return false;
  state.model=buildModel();window.SalamatAccessModel=state.model;window.renderNav(state.model);tagNavigation();updateIdentity();
  if(open){const preferred=staffModules().find(module=>module.key==='staff.dashboard')||staffModules()[0];if(preferred)openModule(preferred.key)}
  return true;
}
function setPage(title,subtitle,html){
  const pageTitle=$('#pageTitle'),pageSubtitle=$('#pageSubtitle'),content=$('#content');
  if(pageTitle)pageTitle.textContent=title;if(pageSubtitle)pageSubtitle.textContent=subtitle;if(content)content.innerHTML=html;
  try{window.hydrateIcons?.(content)}catch{}
}

async function renderDashboard(){
  const modules=staffModules();const permissionCount=modules.reduce((sum,module)=>sum+Object.values(module.actions||{}).filter(Boolean).length,0);
  state.activeKey='staff.dashboard';
  setPage('داشبورد مدیریتی',`نمای سازمانی ${state.access.user.roleLabel||''}`,`<section class="module-page spx-root"><div class="spx-dashboard"><div class="spx-kpis"><div class="spx-kpi"><small>ماژول‌های فعال</small><strong>${fa(modules.length)}</strong></div><div class="spx-kpi"><small>اختیارات فعال</small><strong>${fa(permissionCount)}</strong></div><div class="spx-kpi"><small>نقش سازمانی</small><strong style="font-size:15px">${esc(state.access.user.roleLabel||roleLabels[state.access.user.role])}</strong></div><div class="spx-kpi" id="spxCaregiverCount"><small>پرونده‌های قابل مشاهده</small><strong>—</strong></div></div><section class="spx-card"><header class="spx-head"><h3>ماژول‌های در دسترس</h3><p>فقط ماژول‌هایی که اختیار مشاهده آن‌ها فعال است نمایش داده می‌شوند.</p></header><div class="spx-body"><div class="spx-modules">${modules.filter(module=>module.key!=='staff.dashboard').map(module=>`<button class="spx-module" type="button" data-spx-open="${esc(module.key)}"><strong>${esc(module.label)}</strong><small>${esc(module.description||'')}</small></button>`).join('')||'<div class="spx-empty">ماژول دیگری برای این حساب فعال نشده است.</div>'}</div></div></section></div></section>`);
  if(can('staff.caregivers','view')){
    try{const payload=await api('/api/admin/directory?page=1&includeCounts=1');const count=payload?.data?.counts?.caregiverProfiles??payload?.data?.pagination?.total;const node=$('#spxCaregiverCount strong');if(node)node.textContent=count==null?'—':fa(count)}catch{}
  }
}
function openModule(key){
  if(!can(key,'view')){notify('دسترسی محدود است','این ماژول برای حساب شما فعال نشده است.');return}
  const module=moduleByKey(key);if(!module)return;
  state.activeKey=key;$$('#sidebarNav [data-staff-module-key]').forEach(button=>button.classList.toggle('active',button.dataset.staffModuleKey===key));
  if(key==='staff.dashboard'){void renderDashboard();return}
  if(key==='staff.users'){renderUsersShell();return}
  if(typeof window.renderModule==='function'){
    window.renderModule(state.model||buildModel(),[module.icon,module.label]);
    const title=$('#pageTitle'),subtitle=$('#pageSubtitle');if(title)title.textContent=module.label;if(subtitle)subtitle.textContent=module.description||'';
  }else setPage(module.label,module.description||'','<section class="module-page"><div class="spx-loading">در حال آماده‌سازی ماژول...</div></section>');
}

function userStatusBadge(user){const status=String(user.status||'').toUpperCase();const tone=status==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(status)?'danger':'';return `<span class="spx-badge">${esc(roleLabels[String(user.role||'').toUpperCase()]||user.role||'—')}</span><span class="spx-badge ${tone}">${esc(statusLabels[status]||status||'—')}</span>`}
function renderUsersShell(){
  state.activeKey='staff.users';
  setPage('کاربران و دسترسی‌ها','مدیریت حساب، نقش و مجوزهای ماژولی از دیتابیس',`<section class="module-page spx-root"><header class="spx-toolbar"><div><h2>مدیریت کاربران و دسترسی‌ها</h2><p>ساخت حساب و تخصیص نقش و ماژول مستقیماً در دیتابیس انجام می‌شود.</p></div><div class="spx-actions">${can('staff.users','create')?'<button class="spx-btn primary" data-spx-create-user>ایجاد حساب جدید</button>':''}</div></header><div id="spxUsersWorkspace" class="spx-loading">در حال دریافت حساب‌های کاربری...</div></section>`);
  void loadUsers(1,state.query);
}
async function loadUsers(page=1,query=''){
  state.page=page;state.query=query;state.usersAbort?.abort();state.usersAbort=new AbortController();
  const workspace=$('#spxUsersWorkspace');if(workspace){workspace.className='spx-loading';workspace.textContent='در حال دریافت حساب‌های کاربری...'}
  try{
    const params=new URLSearchParams({page:String(page)});if(query)params.set('q',query);
    const payload=await api(`/api/users?${params}`,{signal:state.usersAbort.signal});state.users=Array.isArray(payload.data)?payload.data:[];state.pagination=payload.pagination||{page,totalPages:1,total:state.users.length,hasPrevious:false,hasNext:false};renderUsersList();
  }catch(error){if(error.name!=='AbortError'&&workspace){workspace.className='spx-empty';workspace.textContent=error.message}}
}
function renderUsersList(){
  const workspace=$('#spxUsersWorkspace');if(!workspace)return;const p=state.pagination||{};workspace.className='spx-grid';
  workspace.innerHTML=`<section class="spx-card"><header class="spx-head"><h3>فهرست حساب‌ها</h3><p>جست‌وجو با نام، موبایل، نام کاربری یا کد ملی</p></header><div class="spx-body"><form class="spx-search" id="spxUserSearch"><input class="spx-input" id="spxUserQuery" value="${esc(state.query)}" placeholder="جست‌وجوی حساب"><button class="spx-btn primary" type="submit">جست‌وجو</button></form><div class="spx-list">${state.users.map(user=>`<button class="spx-user ${user.id===state.selectedUserId?'active':''}" type="button" data-spx-user="${esc(user.id)}"><span class="spx-avatar">${esc(initials(user.fullName||user.name))}</span><span><strong>${esc(user.fullName||user.name||'بدون نام')}</strong><small dir="ltr">${esc(user.username||'بدون نام کاربری')}<br>${esc(user.mobile||'بدون موبایل')}</small></span><span class="spx-badges">${userStatusBadge(user)}</span></button>`).join('')||'<div class="spx-empty">حسابی پیدا نشد.</div>'}</div><footer class="spx-footer"><button class="spx-btn" data-spx-prev ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><span>صفحه ${fa(p.page||1)} از ${fa(p.totalPages||1)} • ${fa(p.total||state.users.length)} حساب</span><button class="spx-btn" data-spx-next ${p.hasNext?'':'disabled'}>صفحه بعد</button></footer></div></section><section class="spx-card" id="spxUserEditor"><header class="spx-head"><h3>تنظیمات حساب</h3><p>یک حساب را انتخاب کنید یا حساب جدید بسازید.</p></header><div class="spx-body"><div class="spx-empty">حسابی انتخاب نشده است.</div></div></section>`;
}
async function ensureConfig(){if(state.config)return state.config;const payload=await api('/api/admin/access/config');state.config=payload.data;return state.config}
function roleOptions(selected='CAREGIVER',limited=!isAdmin()){
  const roles=state.config?.roles||Object.entries(roleLabels).map(([key,label])=>({key,label}));
  return roles.filter(role=>!limited||role.key==='CAREGIVER').map(role=>`<option value="${esc(role.key)}" ${role.key===selected?'selected':''}>${esc(role.label||roleLabels[role.key]||role.key)}</option>`).join('');
}
function statusOptions(selected='ACTIVE'){return ['ACTIVE','PENDING','SUSPENDED','INACTIVE'].map(status=>`<option value="${status}" ${status===String(selected).toUpperCase()?'selected':''}>${statusLabels[status]}</option>`).join('')}
function roleDefaults(role){return (state.config?.rolePermissions||[]).filter(row=>row.role===role)}
function matrixMarkup(role,source=[]){
  const panel=role==='CAREGIVER'?'CAREGIVER':'STAFF';const modules=(state.config?.modules||state.access.allModules||[]).filter(module=>module.panel===panel);const map=new Map(source.map(row=>[row.moduleKey||row.key,row]));
  return `<div class="spx-matrix"><div class="spx-matrix-head"><span>ماژول</span>${['view','create','update','delete'].map(action=>`<span>${actionLabels[action]}</span>`).join('')}</div>${modules.map(module=>{const row=map.get(module.key)||{};const actions=row.actions||{view:Boolean(row.canView),create:Boolean(row.canCreate),update:Boolean(row.canUpdate),delete:Boolean(row.canDelete)};return `<div class="spx-matrix-row" data-spx-module="${esc(module.key)}"><span><strong>${esc(module.label)}</strong><small>${esc(module.description||'')}</small></span>${['view','create','update','delete'].map(action=>`<label class="spx-check"><input type="checkbox" data-spx-action="${action}" ${actions[action]?'checked':''}></label>`).join('')}</div>`}).join('')}</div>`;
}
function collectMatrix(form){return $$('[data-spx-module]',form).map(row=>({moduleKey:row.dataset.spxModule,...Object.fromEntries($$('[data-spx-action]',row).map(input=>[input.dataset.spxAction,input.checked]))}))}
function accountForm(user={},mode='edit',permissions=[]){const role=String(user.role||'CAREGIVER').toUpperCase();return `<form class="spx-form" id="spxAccountForm" data-mode="${mode}" data-user-id="${esc(user.id||'')}"><label class="spx-field"><span>نام و نام خانوادگی</span><input class="spx-input" name="fullName" value="${esc(user.fullName||user.name||'')}" required></label><label class="spx-field"><span>شماره همراه</span><input class="spx-input" name="mobile" dir="ltr" value="${esc(user.mobile||'')}" placeholder="09128668837"></label><label class="spx-field"><span>نام کاربری یا ایمیل</span><input class="spx-input" name="username" dir="ltr" value="${esc(user.username||'')}" ${mode==='edit'?'readonly':''} required></label><label class="spx-field"><span>${mode==='create'?'رمز عبور':'رمز عبور جدید (اختیاری)'}</span><input class="spx-input" name="password" type="password" minlength="8" ${mode==='create'?'required':''}></label><label class="spx-field"><span>نقش</span><select class="spx-select" name="role" ${!isAdmin()?'disabled':''}>${roleOptions(role)}</select></label><label class="spx-field"><span>وضعیت حساب</span><select class="spx-select" name="status">${statusOptions(user.status||'ACTIVE')}</select></label><div class="spx-field wide"><span>دسترسی ماژولی</span><div class="spx-note">${isAdmin()?'هر ماژول فقط در صورت داشتن اختیار مشاهده در منوی کاربر نمایش داده می‌شود.':'نقش و دسترسی سازمانی فقط توسط مدیر سامانه تنظیم می‌شود.'}</div></div>${isAdmin()?matrixMarkup(role,permissions):''}<div class="spx-actions spx-field wide"><button class="spx-btn primary" type="submit">${mode==='create'?'ساخت حساب و ثبت دسترسی':'ذخیره تغییرات'}</button>${mode==='edit'&&can('staff.users','delete')?'<button class="spx-btn danger" type="button" data-spx-delete-user>حذف حساب</button>':''}</div></form>`}
async function createUserForm(){
  if(isAdmin())await ensureConfig();const editor=$('#spxUserEditor');if(!editor)return;const role='CAREGIVER';editor.innerHTML=`<header class="spx-head"><h3>ایجاد حساب جدید</h3><p>حساب و دسترسی‌ها مستقیماً در دیتابیس ثبت می‌شوند.</p></header><div class="spx-body">${accountForm({role,status:'ACTIVE'},'create',isAdmin()?roleDefaults(role):[])}</div>`;
}
async function openUser(userId){
  state.selectedUserId=userId;$$('[data-spx-user]').forEach(button=>button.classList.toggle('active',button.dataset.spxUser===userId));const editor=$('#spxUserEditor');if(!editor)return;editor.innerHTML='<header class="spx-head"><h3>تنظیمات حساب</h3></header><div class="spx-body"><div class="spx-loading">در حال دریافت دسترسی حساب...</div></div>';
  try{let user=state.users.find(item=>item.id===userId)||{};let permissions=[];if(isAdmin()){await ensureConfig();const payload=await api(`/api/admin/access/users/${encodeURIComponent(userId)}`);user=payload.data.user||user;permissions=payload.data.effective||[]}editor.innerHTML=`<header class="spx-head"><h3>${esc(user.fullName||'تنظیمات حساب')}</h3><p>${esc(roleLabels[String(user.role||'').toUpperCase()]||user.role||'')}</p></header><div class="spx-body">${accountForm(user,'edit',permissions)}</div>`}catch(error){editor.innerHTML=`<header class="spx-head"><h3>خطا</h3></header><div class="spx-body"><div class="spx-empty">${esc(error.message)}</div></div>`}
}
async function saveAccount(form){
  const data=new FormData(form);const mode=form.dataset.mode;const id=form.dataset.userId;const role=isAdmin()?String(data.get('role')||'CAREGIVER').toUpperCase():'CAREGIVER';const payload={fullName:data.get('fullName'),mobile:data.get('mobile'),username:data.get('username'),password:data.get('password'),role,status:data.get('status')};if(mode==='edit'&&!payload.password)delete payload.password;const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
  try{let userId=id;if(mode==='create'){const created=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});userId=created.data.id}else await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});if(isAdmin()){await api(`/api/admin/access/users/${encodeURIComponent(userId)}`,{method:'PUT',body:JSON.stringify({role,permissions:collectMatrix(form)})});clearAccessCache()}notify('حساب ذخیره شد','نقش و دسترسی‌های کاربر در دیتابیس ثبت شد.');state.selectedUserId=userId;await loadUsers(1,state.query)}catch(error){notify('ذخیره حساب انجام نشد',error.detail?`${error.message} — ${error.detail}`:error.message)}finally{if(submit)submit.disabled=false}
}
async function deleteAccount(form){const id=form.dataset.userId;if(!id||!confirm('این حساب برای همیشه حذف شود؟'))return;try{await api(`/api/users/${encodeURIComponent(id)}`,{method:'DELETE'});state.selectedUserId='';notify('حساب حذف شد','حساب از دیتابیس حذف شد.');await loadUsers(1,state.query)}catch(error){notify('حذف انجام نشد',error.message)}}

function captureClick(event){
  const nav=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(nav&&state.access?.panel==='STAFF'){
    const key=nav.dataset.staffModuleKey;if(key){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openModule(key);$('#sidebar')?.classList.remove('open');return}
  }
  const open=event.target?.closest?.('[data-spx-open]');if(open){event.preventDefault();openModule(open.dataset.spxOpen);return}
  if(event.target?.closest?.('[data-spx-create-user]')){event.preventDefault();void createUserForm();return}
  const user=event.target?.closest?.('[data-spx-user]');if(user){event.preventDefault();void openUser(user.dataset.spxUser);return}
  if(event.target?.closest?.('[data-spx-prev]')&&!event.target.closest('[data-spx-prev]').disabled){event.preventDefault();void loadUsers(state.page-1,state.query);return}
  if(event.target?.closest?.('[data-spx-next]')&&!event.target.closest('[data-spx-next]').disabled){event.preventDefault();void loadUsers(state.page+1,state.query);return}
  if(event.target?.closest?.('[data-spx-delete-user]')){event.preventDefault();const form=$('#spxAccountForm');if(form)void deleteAccount(form)}
}
function captureSubmit(event){
  if(event.target?.id==='spxUserSearch'){event.preventDefault();void loadUsers(1,String($('#spxUserQuery')?.value||'').trim());return}
  if(event.target?.id==='spxAccountForm'){event.preventDefault();void saveAccount(event.target)}
}
function captureChange(event){
  if(event.target?.name==='role'&&event.target.closest('#spxAccountForm')&&isAdmin()){
    const role=String(event.target.value||'CAREGIVER');const matrix=$('.spx-matrix',event.target.closest('form'));if(matrix)matrix.outerHTML=matrixMarkup(role,roleDefaults(role));
  }
}

async function loadAccess(force=false){
  if(state.loading&&!force)return state.loading;
  state.loading=(async()=>{
    hideRoleChoice();const key=accessCacheKey();
    if(!force&&key){try{const cached=JSON.parse(sessionStorage.getItem(key)||'null');if(cached&&Date.now()-cached.savedAt<CACHE_TTL){state.access=cached.data;if(state.access.panel==='STAFF')scheduleApply();return state.access}}catch{}}
    try{const payload=await api('/api/access/me');state.access=payload.data;const cacheKey=`salamatAccessSnapshotV2:${state.access.user.id}`;sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),data:state.access}));if(state.access.panel==='STAFF')scheduleApply();return state.access}catch(error){if(error.status!==401)console.error('Access load failed',error);return null}
  })().finally(()=>{state.loading=null});return state.loading;
}
function scheduleApply(){let attempts=0;const run=()=>{attempts+=1;if(applyStaffShell(true))return;if(attempts<120)requestAnimationFrame(run)};requestAnimationFrame(run)}
function boot(){
  addStyles();hideRoleChoice();window.addEventListener('click',captureClick,true);document.addEventListener('submit',captureSubmit,true);document.addEventListener('change',captureChange,true);
  window.addEventListener('salamat-authenticated',()=>void loadAccess(true));window.addEventListener('pageshow',()=>{if(state.access?.panel==='STAFF')applyStaffShell(false)});
  window.SalamatAccessControl={reload:()=>{clearAccessCache();return loadAccess(true)},openUsers:()=>openModule('staff.users'),can,openModule};
  void loadAccess(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
