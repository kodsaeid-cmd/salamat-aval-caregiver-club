(()=>{
'use strict';
if(window.__salamatAccessControlRuntimeV2)return;
window.__salamatAccessControlRuntimeV2=true;
// The superseded runtime must no-op even if a stale script tag survives in cache.
window.__salamatAccessControlRuntimeV1=true;

const VERSION='2.0.0';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const normalize=value=>String(value||'').replace(/[۰-۹0-9]+/g,'').replace(/\s+/g,' ').trim();
const roleLabels={ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
const statusLabels={ACTIVE:'فعال',APPROVED:'فعال',PENDING:'در انتظار تأیید',SUSPENDED:'تعلیق‌شده',INACTIVE:'غیرفعال'};
const actionLabels={view:'مشاهده',create:'ثبت',update:'تغییر',delete:'حذف'};
const moduleLabels={
 'staff.dashboard':'داشبورد مدیریتی','staff.users':'کاربران و دسترسی‌ها','staff.caregivers':'پرونده مراقبین',
 'staff.contracts':'قراردادها','staff.payroll':'حقوق و پرداخت','staff.financial_credits':'اعتبارات مالی',
 'staff.training':'بانک آموزش','staff.evaluations':'ارزیابی و پروانه','staff.support':'پشتیبانی',
 'staff.settings':'تنظیمات و لاگ','caregiver.dashboard':'داشبورد','caregiver.scorecard':'کارنامه ارزیابی',
 'caregiver.wallet':'کیف پول و اعتبارات','caregiver.payroll':'حقوق و پرداخت','caregiver.training':'آموزش‌ها',
 'caregiver.support':'پشتیبانی','caregiver.calendar':'تقویم کاری',
};
const aliases={...Object.fromEntries(Object.entries(moduleLabels).map(([key,label])=>[label,key])),'مدیریت کاربران':'staff.users'};
const state={access:null,config:null,accounts:[],pagination:null,page:1,query:'',selectedUserId:'',tab:'accounts',rolePolicy:'RECRUITER',loadingAccess:false,loadingAccounts:false};

async function api(path,options={}){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
 const headers=new Headers(options.headers||{});if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
 try{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers,signal:controller.signal});
  const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
 }catch(error){if(error?.name==='AbortError')throw new Error('پاسخ سرور بیش از حد طول کشید. دوباره تلاش کنید.');throw error}
 finally{clearTimeout(timeout)}
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||state.access?.user||null}
function isAdmin(){return String(currentUser()?.actualRole||currentUser()?.role||state.access?.user?.role||'').toUpperCase()==='ADMIN'}
function initials(name){return String(name||'ک').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'ک'}
function moduleAccess(key){return state.access?.allModules?.find(item=>item.key===key)?.actions||{view:false,create:false,update:false,delete:false}}
function can(key,action='view'){return Boolean(moduleAccess(key)?.[action])}
function navKey(button){return button?.dataset.panelModuleKey||button?.dataset.accessModule||aliases[normalize(button?.textContent)]||''}
function hideRoleChoice(){
 $('.role-section')?.setAttribute('aria-hidden','true');
 const heading=$('.login-heading p');if(heading)heading.textContent='با شماره همراه و کد یک‌بارمصرف یا نام کاربری و رمز عبور وارد شوید؛ سطح دسترسی از حساب شما خوانده می‌شود.';
 const label=$('#emailFields label');if(label)label.textContent='نام کاربری یا ایمیل سازمانی';
 const identifier=$('#emailFields input[type="email"],#backendIdentifierInput');if(identifier){identifier.type='text';identifier.placeholder='نام کاربری یا ایمیل سازمانی';identifier.autocomplete='username'}
 const password=$('#emailFields input[type="password"]');if(password)password.autocomplete='current-password';
}
function addStyles(){
 if($('#salamatAccessControlStylesV2'))return;
 const style=document.createElement('style');style.id='salamatAccessControlStylesV2';style.textContent=`
.ac2-root{direction:rtl;display:grid;gap:15px}.ac2-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.ac2-toolbar h2{margin:0;font-size:21px}.ac2-toolbar p{margin:6px 0 0;color:#718078;font-size:10px}.ac2-actions,.ac2-tabs{display:flex;gap:7px;flex-wrap:wrap}.ac2-btn{border:0;border-radius:11px;padding:10px 13px;background:#edf8f2;color:#087747;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.ac2-btn.primary,.ac2-btn.active{background:#078848;color:#fff}.ac2-btn.danger{background:#ffe9ec;color:#ad2940}.ac2-btn:disabled{opacity:.45;pointer-events:none}.ac2-card{background:#fff;border:1px solid #dce8e2;border-radius:19px;box-shadow:0 10px 28px rgba(22,70,46,.04);overflow:hidden}.ac2-head{padding:14px 16px;border-bottom:1px solid #eaf0ed}.ac2-head h3{margin:0;font-size:14px}.ac2-head p{margin:5px 0 0;color:#7a8981;font-size:8px}.ac2-body{padding:14px}.ac2-grid{display:grid;grid-template-columns:minmax(330px,.75fr) minmax(0,1.25fr);gap:12px;align-items:start}.ac2-list{display:grid;gap:8px;max-height:620px;overflow:auto}.ac2-user{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;padding:10px;border:1px solid #e0eae5;border-radius:14px;background:#fff;text-align:right;cursor:pointer}.ac2-user.active,.ac2-user:hover{border-color:#0b9254;background:#f0faf5}.ac2-avatar{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#dff3e8;color:#087a45;font-weight:900}.ac2-user strong{display:block;font-size:10px}.ac2-user small{display:block;margin-top:4px;color:#7a8981;font-size:8px;line-height:1.7}.ac2-badges{display:grid;gap:4px;justify-items:end}.ac2-badge{padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:7px;font-weight:900}.ac2-badge.warn{background:#fff1da;color:#8d6108}.ac2-badge.danger{background:#ffe9ec;color:#ad2940}.ac2-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-bottom:10px}.ac2-input,.ac2-select,.ac2-textarea{width:100%;box-sizing:border-box;border:1px solid #d7e3dd;border-radius:11px;padding:10px;font:inherit;font-size:9px;background:#fff;outline:none}.ac2-textarea{min-height:75px}.ac2-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ac2-field{display:grid;gap:5px}.ac2-field.wide{grid-column:1/-1}.ac2-field span{font-size:8px;font-weight:900;color:#40564a}.ac2-note{padding:10px 11px;border-radius:11px;background:#f3f9f6;color:#607269;font-size:8px;line-height:1.8}.ac2-empty,.ac2-loading,.ac2-error{padding:36px;text-align:center;border:1px dashed #cfddd6;border-radius:15px;color:#6d7b74;background:#fbfdfc}.ac2-error{border-color:#f0cbd1;background:#fff4f5;color:#ad2940}.ac2-footer{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:10px;color:#6d7b74;font-size:8px}.ac2-matrix{grid-column:1/-1;border:1px solid #e0e9e4;border-radius:14px;overflow:auto}.ac2-matrix-head,.ac2-matrix-row{display:grid;grid-template-columns:minmax(210px,1fr) repeat(4,68px);min-width:590px;align-items:center}.ac2-matrix-head{background:#f4f9f6;font-size:8px;font-weight:900}.ac2-matrix-head>*{padding:9px;text-align:center}.ac2-matrix-head>*:first-child{text-align:right}.ac2-matrix-row{border-top:1px solid #edf2ef}.ac2-matrix-row>span{padding:9px}.ac2-matrix-row strong{display:block;font-size:9px}.ac2-matrix-row small{display:block;margin-top:3px;color:#7c8a83;font-size:7px}.ac2-check{display:grid;place-items:center;padding:9px}.ac2-check input{width:17px;height:17px;accent-color:#078848}.ac2-policy{display:grid;gap:12px}.ac2-policy-top{display:grid;grid-template-columns:minmax(220px,320px) auto;gap:8px;align-items:end}@media(max-width:950px){.ac2-grid{grid-template-columns:1fr}.ac2-list{max-height:360px}}@media(max-width:650px){.ac2-form{grid-template-columns:1fr}.ac2-field.wide{grid-column:auto}.ac2-policy-top{grid-template-columns:1fr}.ac2-user{grid-template-columns:40px minmax(0,1fr)}.ac2-badges{grid-column:1/-1;display:flex}}
 `;document.head.appendChild(style);
}
function setPage(title,subtitle,html){
 if($('#pageTitle'))$('#pageTitle').textContent=title;if($('#pageSubtitle'))$('#pageSubtitle').textContent=subtitle;
 if($('#content'))$('#content').innerHTML=`<section class="module-page ac2-root">${html}</section>`;
 try{window.hydrateIcons?.($('#content'))}catch{}
}
function statusOptions(selected='ACTIVE'){return ['ACTIVE','PENDING','SUSPENDED','INACTIVE'].map(key=>`<option value="${key}" ${key===String(selected).toUpperCase()?'selected':''}>${statusLabels[key]}</option>`).join('')}
function roleOptions(selected='CAREGIVER',limited=false){
 const roles=state.config?.roles||Object.entries(roleLabels).map(([key,label])=>({key,label}));
 return roles.filter(role=>!limited||role.key==='CAREGIVER').map(role=>`<option value="${esc(role.key)}" ${role.key===selected?'selected':''}>${esc(role.label||roleLabels[role.key]||role.key)}</option>`).join('');
}
function moduleRows(panel='STAFF',source=[],editable=true){
 const modules=(state.config?.modules||state.access?.allModules||[]).filter(module=>module.panel===panel&&module.key!=='staff.reports');
 const map=new Map((source||[]).map(row=>[row.moduleKey||row.key,row]));
 return modules.map(module=>{const row=map.get(module.key)||module;const actions=row.actions||{view:Boolean(row.canView),create:Boolean(row.canCreate),update:Boolean(row.canUpdate),delete:Boolean(row.canDelete)};return `<div class="ac2-matrix-row" data-ac2-module="${esc(module.key)}"><span><strong>${esc(moduleLabels[module.key]||module.label)}</strong><small>${esc(module.description||'')}</small></span>${['view','create','update','delete'].map(action=>`<label class="ac2-check"><input type="checkbox" data-ac2-action="${action}" ${actions[action]?'checked':''} ${editable?'':'disabled'}></label>`).join('')}</div>`}).join('');
}
function matrix(panel,source,editable=true){return `<div class="ac2-matrix"><div class="ac2-matrix-head"><span>ماژول</span>${['view','create','update','delete'].map(action=>`<span>${actionLabels[action]}</span>`).join('')}</div>${moduleRows(panel,source,editable)}</div>`}
function collectMatrix(root){return $$('[data-ac2-module]',root).map(row=>({moduleKey:row.dataset.ac2Module,...Object.fromEntries($$('[data-ac2-action]',row).map(input=>[input.dataset.ac2Action,input.checked]))}))}
function roleMatrix(role){return (state.config?.rolePermissions||[]).filter(row=>row.role===role).map(row=>({moduleKey:row.moduleKey,view:Boolean(row.canView),create:Boolean(row.canCreate),update:Boolean(row.canUpdate),delete:Boolean(row.canDelete)}))}
function tabs(){return `<div class="ac2-tabs"><button class="ac2-btn ${state.tab==='accounts'?'active':''}" data-ac2-tab="accounts">حساب‌های کاربری</button>${isAdmin()?`<button class="ac2-btn ${state.tab==='roles'?'active':''}" data-ac2-tab="roles">پیش‌فرض نقش‌ها</button>`:''}</div>`}
function renderShell(){
 setPage('کاربران و دسترسی‌ها','مدیریت حساب، نقش و مجوز ماژول‌ها از دیتابیس',`<header class="ac2-toolbar"><div><h2>مدیریت کاربران و دسترسی‌ها</h2><p>این صفحه رویدادمحور است و هیچ بازنویسی دوره‌ای روی منوی سامانه انجام نمی‌دهد.</p></div><div class="ac2-actions">${tabs()}${state.tab==='accounts'&&can('staff.users','create')?'<button class="ac2-btn primary" data-ac2-create>ایجاد حساب جدید</button>':''}</div></header><div id="ac2Workspace" class="ac2-loading">در حال دریافت اطلاعات...</div>`);
 if(state.tab==='roles')void renderRoles();else void loadAccounts();
}
async function loadAccounts(page=state.page,query=state.query){
 if(state.loadingAccounts)return;state.loadingAccounts=true;state.page=page;state.query=query;
 const workspace=$('#ac2Workspace');if(workspace){workspace.className='ac2-loading';workspace.textContent='در حال دریافت حساب‌های کاربری...'}
 try{const params=new URLSearchParams({page:String(page)});if(query)params.set('q',query);const payload=await api(`/api/users?${params}`);state.accounts=Array.isArray(payload.data)?payload.data:[];state.pagination=payload.pagination||{page,totalPages:1,total:state.accounts.length,hasPrevious:false,hasNext:false};renderAccounts()}
 catch(error){if(workspace){workspace.className='ac2-error';workspace.textContent=error.message}}
 finally{state.loadingAccounts=false}
}
function badges(user){const status=String(user.status||'').toUpperCase();const tone=status==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(status)?'danger':'';return `<span class="ac2-badge">${esc(roleLabels[String(user.role||'').toUpperCase()]||user.role||'—')}</span><span class="ac2-badge ${tone}">${esc(statusLabels[status]||status||'—')}</span>`}
function renderAccounts(){
 const workspace=$('#ac2Workspace');if(!workspace)return;const p=state.pagination||{};workspace.className='ac2-grid';
 workspace.innerHTML=`<article class="ac2-card"><header class="ac2-head"><h3>فهرست حساب‌ها</h3><p>نام، موبایل، نام کاربری یا کد ملی</p></header><div class="ac2-body"><form class="ac2-search" id="ac2Search"><input class="ac2-input" id="ac2Query" value="${esc(state.query)}" placeholder="جست‌وجوی حساب"><button class="ac2-btn primary">جست‌وجو</button></form><div class="ac2-list">${state.accounts.map(user=>`<button class="ac2-user ${user.id===state.selectedUserId?'active':''}" type="button" data-ac2-user="${esc(user.id)}"><span class="ac2-avatar">${esc(initials(user.fullName||user.name))}</span><span><strong>${esc(user.fullName||user.name||'بدون نام')}</strong><small dir="ltr">${esc(user.username||'بدون نام کاربری')}<br>${esc(user.mobile||'بدون موبایل')}</small></span><span class="ac2-badges">${badges(user)}</span></button>`).join('')||'<div class="ac2-empty">حسابی پیدا نشد.</div>'}</div><footer class="ac2-footer"><button class="ac2-btn" data-ac2-prev ${p.hasPrevious?'':'disabled'}>قبلی</button><span>صفحه ${fa(p.page||1)} از ${fa(p.totalPages||1)} • ${fa(p.total||state.accounts.length)} حساب</span><button class="ac2-btn" data-ac2-next ${p.hasNext?'':'disabled'}>بعدی</button></footer></div></article><article class="ac2-card" id="ac2Editor"><header class="ac2-head"><h3>تنظیمات حساب</h3><p>یک حساب را انتخاب کنید یا حساب جدید بسازید.</p></header><div class="ac2-body"><div class="ac2-empty">حسابی انتخاب نشده است.</div></div></article>`;
 if(state.selectedUserId)void openUser(state.selectedUserId);
}
function accountForm(user={},mode='edit',permissions=[]){
 const admin=isAdmin(),limited=!admin,panel=String(user.role||'CAREGIVER').toUpperCase()==='CAREGIVER'?'CAREGIVER':'STAFF';
 return `<form class="ac2-form" id="ac2AccountForm" data-mode="${mode}" data-user-id="${esc(user.id||'')}"><label class="ac2-field"><span>نام و نام خانوادگی</span><input class="ac2-input" name="fullName" value="${esc(user.fullName||user.name||'')}" required></label><label class="ac2-field"><span>شماره همراه</span><input class="ac2-input" name="mobile" dir="ltr" value="${esc(user.mobile||'')}"></label><label class="ac2-field"><span>نام کاربری یا ایمیل</span><input class="ac2-input" name="username" dir="ltr" value="${esc(user.username||'')}" ${mode==='edit'?'readonly':''} required></label><label class="ac2-field"><span>${mode==='create'?'رمز عبور':'رمز عبور جدید (اختیاری)'}</span><input class="ac2-input" name="password" type="password" minlength="8" ${mode==='create'?'required':''}></label><label class="ac2-field"><span>نقش</span><select class="ac2-select" name="role" ${limited&&mode==='edit'?'disabled':''}>${roleOptions(String(user.role||'CAREGIVER').toUpperCase(),limited)}</select></label><label class="ac2-field"><span>وضعیت</span><select class="ac2-select" name="status">${statusOptions(user.status||'ACTIVE')}</select></label><div class="ac2-field wide"><span>دسترسی ماژول‌ها</span><div class="ac2-note">${admin?'مجوزهای این حساب مستقل از پیش‌فرض نقش قابل تنظیم هستند.':'مجوزها بر اساس سیاست نقش مدیر سامانه تعیین می‌شوند.'}</div></div>${admin?matrix(panel,permissions,true):''}<div class="ac2-actions ac2-field wide"><button class="ac2-btn primary" type="submit">${mode==='create'?'ساخت حساب':'ذخیره تغییرات'}</button>${mode==='edit'&&can('staff.users','delete')?'<button class="ac2-btn danger" type="button" data-ac2-delete>حذف حساب</button>':''}</div></form>`;
}
function createAccount(){state.selectedUserId='';const editor=$('#ac2Editor');if(editor)editor.innerHTML=`<header class="ac2-head"><h3>ایجاد حساب جدید</h3><p>حساب و مجوزها مستقیماً در دیتابیس ثبت می‌شوند.</p></header><div class="ac2-body">${accountForm({role:'CAREGIVER',status:'ACTIVE'},'create',isAdmin()?roleMatrix('CAREGIVER'):[])}</div>`}
async function openUser(id){
 state.selectedUserId=id;$$('[data-ac2-user]').forEach(button=>button.classList.toggle('active',button.dataset.ac2User===id));const editor=$('#ac2Editor');if(!editor)return;editor.innerHTML='<header class="ac2-head"><h3>تنظیمات حساب</h3></header><div class="ac2-body"><div class="ac2-loading">در حال دریافت دسترسی‌ها...</div></div>';
 try{let user=state.accounts.find(item=>item.id===id)||{},permissions=[];if(isAdmin()){const payload=await api(`/api/admin/access/users/${encodeURIComponent(id)}`);user=payload.data?.user||user;permissions=(payload.data?.effective||[]).filter(module=>module.panel===(String(user.role).toUpperCase()==='CAREGIVER'?'CAREGIVER':'STAFF'))}editor.innerHTML=`<header class="ac2-head"><h3>${esc(user.fullName||'تنظیمات حساب')}</h3><p>${esc(roleLabels[String(user.role||'').toUpperCase()]||user.role||'')}</p></header><div class="ac2-body">${accountForm(user,'edit',permissions)}</div>`}
 catch(error){editor.innerHTML=`<header class="ac2-head"><h3>خطا</h3></header><div class="ac2-body"><div class="ac2-error">${esc(error.message)}</div></div>`}
}
async function saveAccount(form){
 const data=new FormData(form),mode=form.dataset.mode,id=form.dataset.userId,role=String(data.get('role')||'CAREGIVER').toUpperCase();const payload={fullName:data.get('fullName'),mobile:data.get('mobile'),username:data.get('username'),password:data.get('password'),role,status:data.get('status')};if(mode==='edit'&&!payload.password)delete payload.password;const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
 try{let userId=id;if(mode==='create'){const created=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});userId=created.data.id}else await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});if(isAdmin())await api(`/api/admin/access/users/${encodeURIComponent(userId)}`,{method:'PUT',body:JSON.stringify({role,permissions:collectMatrix(form)})});notify('حساب ذخیره شد','اطلاعات و مجوزها در دیتابیس ثبت شدند.');state.selectedUserId=userId;await loadAccounts(1,state.query)}
 catch(error){notify('ذخیره حساب انجام نشد',error.detail?`${error.message} — ${error.detail}`:error.message)}finally{if(submit)submit.disabled=false}
}
async function deleteAccount(form){const id=form.dataset.userId;if(!id||!confirm('این حساب حذف شود؟'))return;try{await api(`/api/users/${encodeURIComponent(id)}`,{method:'DELETE'});state.selectedUserId='';notify('حساب حذف شد','حساب از دیتابیس حذف شد.');await loadAccounts(1,state.query)}catch(error){notify('حذف انجام نشد',error.message)}}
async function ensureConfig(){if(state.config)return state.config;const payload=await api('/api/admin/access/config');state.config=payload.data;return state.config}
async function renderRoles(){
 const workspace=$('#ac2Workspace');if(!workspace)return;workspace.className='ac2-loading';workspace.textContent='در حال دریافت سیاست نقش‌ها...';
 try{await ensureConfig();workspace.className='ac2-card';workspace.innerHTML=`<header class="ac2-head"><h3>پیش‌فرض دسترسی نقش‌ها</h3><p>مجوز مشاهده، ثبت، تغییر و حذف برای هر نقش.</p></header><div class="ac2-body ac2-policy"><div class="ac2-policy-top"><label class="ac2-field"><span>نقش سازمانی</span><select class="ac2-select" id="ac2RolePolicy">${roleOptions(state.rolePolicy,false)}</select></label><button class="ac2-btn primary" data-ac2-save-role>ذخیره سیاست نقش</button></div><div id="ac2RoleMatrix">${matrix(state.rolePolicy==='CAREGIVER'?'CAREGIVER':'STAFF',roleMatrix(state.rolePolicy),true)}</div></div>`}
 catch(error){workspace.className='ac2-error';workspace.textContent=error.message}
}
async function saveRole(){const root=$('#ac2RoleMatrix');if(!root)return;try{await api(`/api/admin/access/roles/${encodeURIComponent(state.rolePolicy)}`,{method:'PUT',body:JSON.stringify({permissions:collectMatrix(root)})});state.config=null;await ensureConfig();notify('سیاست نقش ذخیره شد','مجوزهای پیش‌فرض به‌روزرسانی شدند.');await loadAccess(true);await renderRoles()}catch(error){notify('ذخیره سیاست انجام نشد',error.message)}}
async function loadAccess(force=false){
 if(state.loadingAccess&&!force)return;state.loadingAccess=true;
 try{const payload=await api('/api/access/me');state.access=payload.data||null;hideRoleChoice();window.dispatchEvent(new CustomEvent('salamat-access-ready',{detail:state.access}))}
 catch(error){if(error.status!==401)console.error('Access Control v2 failed to load',error)}finally{state.loadingAccess=false}
}
function openUsers(){state.tab='accounts';renderShell()}
function captureClick(event){
 const nav=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');if(nav&&state.access?.panel==='STAFF'&&navKey(nav)==='staff.users'){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openUsers();$$('#sidebarNav button').forEach(button=>button.classList.toggle('active',button===nav));return}
 const tab=event.target?.closest?.('[data-ac2-tab]');if(tab){event.preventDefault();state.tab=tab.dataset.ac2Tab;renderShell();return}
 if(event.target?.closest?.('[data-ac2-create]')){event.preventDefault();createAccount();return}
 const user=event.target?.closest?.('[data-ac2-user]');if(user){event.preventDefault();void openUser(user.dataset.ac2User);return}
 if(event.target?.closest?.('[data-ac2-prev]')){event.preventDefault();if(state.pagination?.hasPrevious)void loadAccounts(state.page-1,state.query);return}
 if(event.target?.closest?.('[data-ac2-next]')){event.preventDefault();if(state.pagination?.hasNext)void loadAccounts(state.page+1,state.query);return}
 if(event.target?.closest?.('[data-ac2-delete]')){event.preventDefault();const form=$('#ac2AccountForm');if(form)void deleteAccount(form);return}
 if(event.target?.closest?.('[data-ac2-save-role]')){event.preventDefault();void saveRole()}
}
function captureSubmit(event){if(event.target?.id==='ac2Search'){event.preventDefault();state.query=String($('#ac2Query')?.value||'').trim();void loadAccounts(1,state.query);return}if(event.target?.id==='ac2AccountForm'){event.preventDefault();void saveAccount(event.target)}}
function captureChange(event){if(event.target?.id==='ac2RolePolicy'){state.rolePolicy=String(event.target.value||'RECRUITER');const root=$('#ac2RoleMatrix');if(root)root.innerHTML=matrix(state.rolePolicy==='CAREGIVER'?'CAREGIVER':'STAFF',roleMatrix(state.rolePolicy),true);return}if(event.target?.name==='role'&&event.target.closest('#ac2AccountForm')&&isAdmin()){const form=event.target.closest('#ac2AccountForm'),role=String(event.target.value||'CAREGIVER'),old=$('.ac2-matrix',form);if(old)old.outerHTML=matrix(role==='CAREGIVER'?'CAREGIVER':'STAFF',roleMatrix(role),true)}}
function boot(){
 addStyles();hideRoleChoice();document.addEventListener('click',captureClick,true);document.addEventListener('submit',captureSubmit,true);document.addEventListener('change',captureChange,true);
 window.addEventListener('salamat-authenticated',()=>void loadAccess(true));window.addEventListener('salamat-access-changed',()=>void loadAccess(true));window.addEventListener('salamat-shell-ready',hideRoleChoice);window.addEventListener('pageshow',()=>void loadAccess(false));
 window.SalamatAccessControl={version:VERSION,reload:()=>loadAccess(true),openUsers,can,get access(){return state.access}};void loadAccess(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
