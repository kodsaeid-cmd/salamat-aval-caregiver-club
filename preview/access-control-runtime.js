(()=>{
'use strict';

if(window.__salamatAccessControlRuntimeV1)return;
window.__salamatAccessControlRuntimeV1=true;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fa=value=>Number(value||0).toLocaleString('fa-IR');
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
const roleLabels={ADMIN:'مدیر سامانه',CAREGIVER:'مراقب',RECRUITER:'کارشناس جذب',HR:'منابع انسانی',SUPPORT:'پشتیبان',EVALUATOR:'ارزیاب',EDUCATION:'کارشناس آموزش',OPERATIONS:'مدیر عملیات'};
const statusLabels={ACTIVE:'فعال',APPROVED:'فعال',PENDING:'در انتظار تأیید',SUSPENDED:'تعلیق‌شده',INACTIVE:'غیرفعال'};
const actionLabels={view:'مشاهده',create:'ثبت',update:'تغییر',delete:'حذف'};
const staffLabels={
  'staff.dashboard':'داشبورد مدیریتی',
  'staff.users':'کاربران و دسترسی‌ها',
  'staff.caregivers':'پرونده مراقبین',
  'staff.contracts':'قراردادها',
  'staff.payroll':'حقوق و پرداخت',
  'staff.training':'بانک آموزش',
  'staff.evaluations':'ارزیابی و پروانه',
  'staff.support':'پشتیبانی و امنیت',
  'staff.reports':'گزارش‌ها',
  'staff.settings':'تنظیمات و لاگ',
};
const labelAliases={
  'داشبورد':'staff.dashboard','داشبورد مدیریتی':'staff.dashboard','پنل مدیر سامانه':'staff.dashboard',
  'مدیریت کاربران':'staff.users','ایجاد حساب':'staff.users','نقش‌ها و دسترسی‌ها':'staff.users','کاربران و دسترسی‌ها':'staff.users',
  'مراقبین':'staff.caregivers','پرونده مراقبین':'staff.caregivers','پرونده حرفه‌ای مراقبین':'staff.caregivers',
  'قراردادها':'staff.contracts','تقویم مراقبین':'staff.contracts','مرخصی‌ها':'staff.contracts','جایگزینی شیفت':'staff.contracts',
  'حقوق و دستمزد':'staff.payroll','حقوق و پرداخت':'staff.payroll',
  'آموزش':'staff.training','بانک آموزش':'staff.training','تخصیص آموزش':'staff.training',
  'پایش و امتیازات':'staff.evaluations','ارزیابی و پروانه':'staff.evaluations','میزکار ارزیابی':'staff.evaluations',
  'پشتیبانی و امنیت':'staff.support','پشتیبانی':'staff.support',
  'گزارش‌ها':'staff.reports','گزارش منابع انسانی':'staff.reports',
  'تنظیمات سامانه':'staff.settings','تنظیمات و لاگ':'staff.settings',
};
const state={access:null,config:null,page:1,query:'',pagination:null,accounts:[],selectedUserId:'',tab:'accounts',loading:false,navSignature:'',rolePolicy:'RECRUITER',timer:null};

async function api(path,options={}){
  const headers=new Headers(options.headers||{});
  if(typeof options.body==='string'&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});
  const text=await response.text();let payload={};
  try{payload=text?JSON.parse(text):{}}catch{payload={detail:text}}
  if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}
  return payload;
}
function notify(title,text){try{window.toast?.(title,text)}catch{}if(!window.toast)console.info(title,text)}
function initials(name){return String(name||'ک').trim().split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2)||'ک'}
function currentUser(){return window.SalamatBackend?.getCurrentUser?.()||state.access?.user||null}
function isAdmin(){return String(currentUser()?.actualRole||currentUser()?.role||state.access?.user?.role||'').toUpperCase()==='ADMIN'}
function moduleAccess(key){return state.access?.allModules?.find(item=>item.key===key)?.actions||{view:false,create:false,update:false,delete:false}}
function can(key,action='view'){return Boolean(moduleAccess(key)?.[action])}

function addStyles(){
  if($('#salamatAccessControlStyles'))return;
  const style=document.createElement('style');style.id='salamatAccessControlStyles';style.textContent=`
  .role-section,#roleOptions{display:none!important}.acx-root{direction:rtl;display:grid;gap:16px}.acx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.acx-toolbar h2{margin:0;font-size:21px}.acx-toolbar p{margin:6px 0 0;color:#75847c;font-size:10px}.acx-actions,.acx-tabs{display:flex;gap:8px;flex-wrap:wrap}.acx-btn{border:0;border-radius:12px;padding:11px 15px;background:#edf8f2;color:#087747;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.acx-btn.primary{background:#078848;color:#fff}.acx-btn.danger{background:#ffe9ec;color:#b0293c}.acx-btn:disabled{opacity:.5;cursor:not-allowed}.acx-tabs .active{background:#0b874b;color:#fff}.acx-grid{display:grid;grid-template-columns:minmax(340px,.72fr) minmax(0,1.28fr);gap:14px;align-items:start}.acx-card{background:#fff;border:1px solid #dce8e2;border-radius:22px;overflow:hidden;box-shadow:0 12px 38px rgba(24,75,50,.045)}.acx-head{padding:17px 18px;border-bottom:1px solid #e9f0ec}.acx-head h3{margin:0;font-size:15px}.acx-head p{margin:6px 0 0;color:#7a8881;font-size:9px}.acx-body{padding:16px}.acx-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:12px}.acx-input,.acx-select{width:100%;box-sizing:border-box;border:1px solid #d8e4de;border-radius:12px;background:#fff;padding:11px 12px;font:inherit;font-size:10px;outline:none}.acx-input:focus,.acx-select:focus{border-color:#149257;box-shadow:0 0 0 3px #e0f5e9}.acx-list{display:grid;gap:8px;max-height:660px;overflow:auto;padding:2px}.acx-user{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;border:1px solid #e0e9e4;border-radius:15px;background:#fff;padding:10px;text-align:right;cursor:pointer}.acx-user:hover,.acx-user.active{border-color:#0d9857;background:#f2fbf6}.acx-avatar{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;overflow:hidden;background:#dff3e8;color:#087a45;font-weight:900}.acx-user strong{display:block;font-size:11px}.acx-user small{display:block;margin-top:4px;color:#78877f;font-size:8px;line-height:1.7}.acx-badges{display:grid;gap:4px;justify-items:end}.acx-badge{padding:5px 8px;border-radius:999px;background:#edf8f2;color:#087747;font-size:8px;font-weight:900;white-space:nowrap}.acx-badge.warn{background:#fff1d8;color:#946000}.acx-badge.danger{background:#ffe8eb;color:#ae2638}.acx-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #edf2ef;color:#718078;font-size:9px}.acx-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.acx-field{display:grid;gap:6px}.acx-field span{font-size:9px;font-weight:900;color:#3b5246}.acx-field.wide{grid-column:1/-1}.acx-note{padding:11px 12px;border-radius:12px;background:#f5faf7;color:#63756b;font-size:9px;line-height:1.9}.acx-matrix{grid-column:1/-1;border:1px solid #e0e9e4;border-radius:16px;overflow:hidden}.acx-matrix-head,.acx-matrix-row{display:grid;grid-template-columns:minmax(190px,1fr) repeat(4,74px);align-items:center}.acx-matrix-head{background:#f4f9f6;color:#52675c;font-size:8px;font-weight:900}.acx-matrix-head>*{padding:10px;text-align:center}.acx-matrix-head>*:first-child{text-align:right}.acx-matrix-row{border-top:1px solid #edf2ef}.acx-matrix-row>span{padding:10px}.acx-matrix-row strong{display:block;font-size:9px}.acx-matrix-row small{display:block;margin-top:4px;color:#7c8a83;font-size:7px}.acx-check{display:grid;place-items:center;padding:10px}.acx-check input{width:17px;height:17px;accent-color:#078848}.acx-empty,.acx-loading{padding:42px;text-align:center;border:1px dashed #d0dfd7;border-radius:17px;color:#718078;background:#fbfdfc}.acx-policy{display:grid;gap:14px}.acx-policy-top{display:grid;grid-template-columns:minmax(220px,320px) auto;gap:10px;align-items:end}.acx-error{padding:10px 12px;border-radius:11px;background:#fff0f1;color:#ad2638;font-size:9px;font-weight:900;margin-bottom:10px}
  @media(max-width:1050px){.acx-grid{grid-template-columns:1fr}.acx-list{max-height:380px}}@media(max-width:720px){.acx-form{grid-template-columns:1fr}.acx-field.wide{grid-column:auto}.acx-matrix{overflow:auto}.acx-matrix-head,.acx-matrix-row{min-width:620px}.acx-policy-top{grid-template-columns:1fr}.acx-user{grid-template-columns:42px minmax(0,1fr)}.acx-badges{grid-column:1/-1;display:flex;justify-items:start}}
  `;document.head.appendChild(style);
}

function roleOptions(selected='CAREGIVER',limited=false){
  const roles=(state.config?.roles||Object.entries(roleLabels).map(([key,label])=>({key,label})));
  return roles.filter(role=>!limited||role.key==='CAREGIVER').map(role=>`<option value="${esc(role.key)}" ${role.key===selected?'selected':''}>${esc(role.label||roleLabels[role.key]||role.key)}</option>`).join('');
}
function statusOptions(selected='ACTIVE'){return ['ACTIVE','PENDING','SUSPENDED','INACTIVE'].map(key=>`<option value="${key}" ${key===String(selected).toUpperCase()?'selected':''}>${statusLabels[key]}</option>`).join('')}
function moduleRows(panel='STAFF',source=[],editable=true){
  const modules=(state.config?.modules||state.access?.allModules||[]).filter(module=>module.panel===panel);
  const map=new Map((source||[]).map(row=>[row.moduleKey||row.key,row]));
  return modules.map(module=>{
    const row=map.get(module.key)||module;
    const actions=row.actions||{view:Boolean(row.canView),create:Boolean(row.canCreate),update:Boolean(row.canUpdate),delete:Boolean(row.canDelete)};
    return `<div class="acx-matrix-row" data-acx-module="${esc(module.key)}"><span><strong>${esc(module.label)}</strong><small>${esc(module.description||'')}</small></span>${['view','create','update','delete'].map(action=>`<label class="acx-check"><input type="checkbox" data-acx-action="${action}" ${actions[action]?'checked':''} ${editable?'':'disabled'}></label>`).join('')}</div>`;
  }).join('');
}
function matrixMarkup(panel,source,editable=true){return `<div class="acx-matrix"><div class="acx-matrix-head"><span>ماژول</span>${['view','create','update','delete'].map(action=>`<span>${actionLabels[action]}</span>`).join('')}</div>${moduleRows(panel,source,editable)}</div>`}
function collectMatrix(root){return $$('[data-acx-module]',root).map(row=>({moduleKey:row.dataset.acxModule,...Object.fromEntries($$('[data-acx-action]',row).map(input=>[input.dataset.acxAction,input.checked]))}))}
function roleMatrix(role){
  const rows=(state.config?.rolePermissions||[]).filter(row=>row.role===role);
  return rows.map(row=>({moduleKey:row.moduleKey,view:Boolean(row.canView),create:Boolean(row.canCreate),update:Boolean(row.canUpdate),delete:Boolean(row.canDelete)}));
}

function hideRoleChoice(){
  $('.role-section')?.setAttribute('aria-hidden','true');
  const heading=$('.login-heading p');if(heading)heading.textContent='با شماره همراه و کد یک‌بارمصرف یا نام کاربری و رمز عبور وارد شوید؛ سطح دسترسی به‌صورت خودکار از حساب شما خوانده می‌شود.';
  const emailLabel=$('#emailFields label');if(emailLabel)emailLabel.textContent='نام کاربری یا ایمیل سازمانی';
  const identifier=$('#emailFields input[type="email"],#backendIdentifierInput');if(identifier){identifier.type='text';identifier.placeholder='نام کاربری یا ایمیل سازمانی';identifier.autocomplete='username'}
  const password=$('#emailFields input[type="password"]');if(password)password.autocomplete='current-password';
  // Initial setup still needs the hidden admin selection expected by the legacy bootstrap.
  if($('#setupKeyWrap')&&!$('#setupKeyWrap').hidden)$('#roleOptions [data-role="admin"]')?.click();
}

function allowedStaffModules(){return (state.access?.modules||[]).filter(module=>module.panel==='STAFF')}
function staffModel(){
  const base=window.roles?.admin||{};const user=state.access?.user||currentUser()||{};
  const modules=allowedStaffModules();
  return {...base,name:user.fullName||base.name,initials:initials(user.fullName),role:user.roleLabel||roleLabels[user.role]||base.role,title:`پنل ${user.roleLabel||roleLabels[user.role]||'سازمانی'}`,subtitle:'دسترسی‌ها مستقیماً از نقش و مجوزهای ثبت‌شده در دیتابیس خوانده می‌شوند.',nav:modules.map(module=>[module.icon,staffLabels[module.key]||module.label])};
}
function navSignature(){return allowedStaffModules().map(module=>module.key).join('|')}
function applyStaffNavigation(force=false){
  if(state.access?.panel!=='STAFF'||!window.renderNav||!window.roles?.admin)return;
  const signature=navSignature();const nav=$('#sidebarNav');
  const currentLabels=normalize(nav?.textContent);
  const expected=allowedStaffModules().map(module=>staffLabels[module.key]||module.label);
  const complete=expected.every(label=>currentLabels.includes(label));
  if(!force&&state.navSignature===signature&&complete)return;
  const activeKey=moduleKeyFromLabel(normalize($('#sidebarNav .active')?.textContent||$('#pageTitle')?.textContent));
  const model=staffModel();window.SalamatAccessModel=model;window.renderNav(model);state.navSignature=signature;
  const buttons=$$('#sidebarNav .nav-item,#sidebarNav button');
  buttons.forEach(button=>{const key=moduleKeyFromLabel(normalize(button.textContent));if(key)button.dataset.accessModule=key});
  const active=buttons.find(button=>button.dataset.accessModule===activeKey)||buttons[0];
  if(active&&activeKey&&can(activeKey,'view'))active.classList.add('active');
}
function moduleKeyFromLabel(label){
  const clean=normalize(label).replace(/[۰-۹0-9]+/g,'').trim();
  if(labelAliases[clean])return labelAliases[clean];
  const direct=Object.entries(staffLabels).find(([,value])=>clean.includes(value)||value.includes(clean));
  return direct?.[0]||'';
}

function setPage(title,subtitle,html){
  if($('#pageTitle'))$('#pageTitle').textContent=title;
  if($('#pageSubtitle'))$('#pageSubtitle').textContent=subtitle;
  if($('#content'))$('#content').innerHTML=`<section class="module-page acx-root">${html}</section>`;
  try{window.hydrateIcons?.($('#content'))}catch{}
}
function tabsMarkup(){return `<div class="acx-tabs"><button class="acx-btn ${state.tab==='accounts'?'active':''}" data-acx-tab="accounts">حساب‌های کاربری</button>${isAdmin()?`<button class="acx-btn ${state.tab==='roles'?'active':''}" data-acx-tab="roles">پیش‌فرض نقش‌ها</button>`:''}</div>`}
function renderShell(){
  const create=can('staff.users','create');
  setPage('کاربران و دسترسی‌ها','مدیریت حساب، نقش و مجوز ماژول‌ها از دیتابیس',`<header class="acx-toolbar"><div><h2>مدیریت هویت و دسترسی</h2><p>هر کاربر بدون انتخاب دستی پنل وارد می‌شود و نقش و مجوزهایش از سرور تعیین می‌شود.</p></div><div class="acx-actions">${tabsMarkup()}${create&&state.tab==='accounts'?'<button class="acx-btn primary" data-acx-create>ایجاد حساب جدید</button>':''}</div></header><div id="acxWorkspace" class="acx-loading">در حال دریافت اطلاعات...</div>`);
  if(state.tab==='roles')void renderRolePolicies();else void loadAccounts();
}

async function loadAccounts(page=state.page,query=state.query){
  state.page=page;state.query=query;state.loading=true;
  const workspace=$('#acxWorkspace');if(workspace)workspace.className='acx-loading',workspace.textContent='در حال دریافت حساب‌های کاربری...';
  try{
    const params=new URLSearchParams({page:String(page)});if(query)params.set('q',query);
    const payload=await api(`/api/users?${params}`);state.accounts=Array.isArray(payload.data)?payload.data:[];state.pagination=payload.pagination||{page,totalPages:1,total:state.accounts.length,hasPrevious:false,hasNext:false};
    renderAccounts();
  }catch(error){if(workspace){workspace.className='acx-error';workspace.textContent=error.message}}
  finally{state.loading=false}
}
function userBadges(user){const status=String(user.status||'').toUpperCase();const tone=status==='PENDING'?'warn':['SUSPENDED','INACTIVE'].includes(status)?'danger':'';return `<span class="acx-badge">${esc(roleLabels[String(user.role||'').toUpperCase()]||user.role||'—')}</span><span class="acx-badge ${tone}">${esc(statusLabels[status]||status||'—')}</span>`}
function renderAccounts(){
  const workspace=$('#acxWorkspace');if(!workspace)return;workspace.className='acx-grid';
  const p=state.pagination||{};
  workspace.innerHTML=`<section class="acx-card"><header class="acx-head"><h3>فهرست حساب‌ها</h3><p>جست‌وجو با نام، موبایل، نام کاربری یا کد ملی</p></header><div class="acx-body"><form class="acx-search" id="acxSearchForm"><input class="acx-input" id="acxSearchInput" value="${esc(state.query)}" placeholder="جست‌وجوی حساب کاربری"><button class="acx-btn primary" type="submit">جست‌وجو</button></form><div class="acx-list">${state.accounts.map(user=>`<button class="acx-user ${user.id===state.selectedUserId?'active':''}" type="button" data-acx-user="${esc(user.id)}"><span class="acx-avatar">${esc(initials(user.fullName||user.name))}</span><span><strong>${esc(user.fullName||user.name||'بدون نام')}</strong><small dir="ltr">${esc(user.username||'بدون نام کاربری')}<br>${esc(user.mobile||'بدون موبایل')}</small></span><span class="acx-badges">${userBadges(user)}</span></button>`).join('')||'<div class="acx-empty">حسابی پیدا نشد.</div>'}</div><footer class="acx-footer"><button class="acx-btn" data-acx-prev ${p.hasPrevious?'':'disabled'}>صفحه قبل</button><span>صفحه ${fa(p.page||1)} از ${fa(p.totalPages||1)} • ${fa(p.total||state.accounts.length)} حساب</span><button class="acx-btn" data-acx-next ${p.hasNext?'':'disabled'}>صفحه بعد</button></footer></div></section><section class="acx-card" id="acxEditor"><header class="acx-head"><h3>تنظیمات حساب</h3><p>یک حساب را انتخاب کنید یا حساب جدید بسازید.</p></header><div class="acx-body"><div class="acx-empty">حسابی انتخاب نشده است.</div></div></section>`;
  if(state.selectedUserId)void openUser(state.selectedUserId);
}

function basicAccountForm(user={},mode='edit',permissions=[]){
  const admin=isAdmin();const limited=!admin;const panel=String(user.role||'CAREGIVER').toUpperCase()==='CAREGIVER'?'CAREGIVER':'STAFF';
  return `<form class="acx-form" id="acxAccountForm" data-mode="${mode}" data-user-id="${esc(user.id||'')}"><label class="acx-field"><span>نام و نام خانوادگی</span><input class="acx-input" name="fullName" value="${esc(user.fullName||user.name||'')}" required></label><label class="acx-field"><span>شماره همراه</span><input class="acx-input" name="mobile" dir="ltr" value="${esc(user.mobile||'')}" placeholder="09128668837"></label><label class="acx-field"><span>نام کاربری یا ایمیل</span><input class="acx-input" name="username" dir="ltr" value="${esc(user.username||'')}" ${mode==='edit'?'readonly':''} required></label><label class="acx-field"><span>${mode==='create'?'رمز عبور':'رمز عبور جدید (اختیاری)'}</span><input class="acx-input" name="password" type="password" minlength="8" ${mode==='create'?'required':''}></label><label class="acx-field"><span>نقش</span><select class="acx-select" name="role" ${limited&&mode==='edit'?'disabled':''}>${roleOptions(String(user.role||'CAREGIVER').toUpperCase(),limited)}</select></label><label class="acx-field"><span>وضعیت حساب</span><select class="acx-select" name="status">${statusOptions(user.status||'ACTIVE')}</select></label><div class="acx-field wide"><span>دسترسی به ماژول‌ها</span><div class="acx-note">${admin?'مجوزهای زیر برای همین کاربر ثبت می‌شوند و می‌توانند با پیش‌فرض نقش متفاوت باشند.':'سطح دسترسی این حساب بر اساس نقش و سیاست مدیر سامانه تعیین می‌شود.'}</div></div>${admin?matrixMarkup(panel,permissions,true):''}<div class="acx-actions acx-field wide"><button class="acx-btn primary" type="submit">${mode==='create'?'ساخت حساب و ثبت دسترسی':'ذخیره تغییرات'}</button>${mode==='edit'&&can('staff.users','delete')?'<button class="acx-btn danger" type="button" data-acx-delete>حذف حساب</button>':''}</div></form>`;
}
function showCreate(){state.selectedUserId='';const editor=$('#acxEditor');if(!editor)return;const defaults=isAdmin()?roleMatrix('CAREGIVER'):[];editor.innerHTML=`<header class="acx-head"><h3>ایجاد حساب جدید</h3><p>حساب مستقیماً در دیتابیس ساخته می‌شود؛ نقش از خود حساب خوانده خواهد شد.</p></header><div class="acx-body">${basicAccountForm({role:'CAREGIVER',status:'ACTIVE'},'create',defaults)}</div>`}
async function openUser(userId){
  state.selectedUserId=userId;$$('[data-acx-user]').forEach(button=>button.classList.toggle('active',button.dataset.acxUser===userId));
  const editor=$('#acxEditor');if(!editor)return;editor.innerHTML='<header class="acx-head"><h3>تنظیمات حساب</h3></header><div class="acx-body"><div class="acx-loading">در حال دریافت دسترسی‌های حساب...</div></div>';
  try{
    let user=state.accounts.find(item=>item.id===userId)||{};let permissions=[];
    if(isAdmin()){
      const payload=await api(`/api/admin/access/users/${encodeURIComponent(userId)}`);user=payload.data.user||user;permissions=(payload.data.effective||[]).filter(module=>module.panel===(String(user.role).toUpperCase()==='CAREGIVER'?'CAREGIVER':'STAFF'));
    }
    editor.innerHTML=`<header class="acx-head"><h3>${esc(user.fullName||'تنظیمات حساب')}</h3><p>${esc(roleLabels[String(user.role||'').toUpperCase()]||user.role||'')}</p></header><div class="acx-body">${basicAccountForm(user,'edit',permissions)}</div>`;
  }catch(error){editor.innerHTML=`<header class="acx-head"><h3>خطا</h3></header><div class="acx-body"><div class="acx-error">${esc(error.message)}</div></div>`}
}
async function saveAccount(form){
  const data=new FormData(form);const mode=form.dataset.mode;const id=form.dataset.userId;const role=String(data.get('role')||'CAREGIVER').toUpperCase();
  const payload={fullName:data.get('fullName'),mobile:data.get('mobile'),username:data.get('username'),password:data.get('password'),role,status:data.get('status')};
  if(mode==='edit'&&!payload.password)delete payload.password;
  const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{
    let userId=id;
    if(mode==='create'){
      const created=await api('/api/users',{method:'POST',body:JSON.stringify(payload)});userId=created.data.id;
    }else{
      await api(`/api/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});
    }
    if(isAdmin()){
      const permissions=collectMatrix(form);
      await api(`/api/admin/access/users/${encodeURIComponent(userId)}`,{method:'PUT',body:JSON.stringify({role,permissions})});
    }
    notify('حساب ذخیره شد','نقش و دسترسی‌های کاربر در دیتابیس ثبت شد.');state.selectedUserId=userId;await loadAccounts(1,state.query);
  }catch(error){notify('ذخیره حساب انجام نشد',error.detail?`${error.message} — ${error.detail}`:error.message)}finally{if(button)button.disabled=false}
}
async function deleteAccount(form){const id=form.dataset.userId;if(!id||!confirm('این حساب برای همیشه حذف شود؟'))return;try{await api(`/api/users/${encodeURIComponent(id)}`,{method:'DELETE'});state.selectedUserId='';notify('حساب حذف شد','حساب از دیتابیس حذف شد.');await loadAccounts(1,state.query)}catch(error){notify('حذف انجام نشد',error.message)}}

async function ensureConfig(){if(state.config)return state.config;const payload=await api('/api/admin/access/config');state.config=payload.data;return state.config}
async function renderRolePolicies(){
  const workspace=$('#acxWorkspace');if(!workspace)return;workspace.className='acx-loading';workspace.textContent='در حال دریافت سیاست نقش‌ها...';
  try{await ensureConfig();workspace.className='acx-card';workspace.innerHTML=`<header class="acx-head"><h3>پیش‌فرض دسترسی نقش‌ها</h3><p>هر نقش از ماژول‌های اصلی مدیر سامانه اختیار مشاهده، ثبت، تغییر یا حذف می‌گیرد.</p></header><div class="acx-body acx-policy"><div class="acx-policy-top"><label class="acx-field"><span>نقش سازمانی</span><select class="acx-select" id="acxPolicyRole">${roleOptions(state.rolePolicy,false)}</select></label><button class="acx-btn primary" data-acx-save-role>ذخیره سیاست نقش</button></div><div id="acxRoleMatrix">${matrixMarkup(state.rolePolicy==='CAREGIVER'?'CAREGIVER':'STAFF',roleMatrix(state.rolePolicy),true)}</div></div>`}catch(error){workspace.className='acx-error';workspace.textContent=error.message}
}
async function saveRolePolicy(){const root=$('#acxRoleMatrix');if(!root)return;const button=$('[data-acx-save-role]');if(button)button.disabled=true;try{await api(`/api/admin/access/roles/${encodeURIComponent(state.rolePolicy)}`,{method:'PUT',body:JSON.stringify({permissions:collectMatrix(root)})});state.config=null;await ensureConfig();notify('سیاست نقش ذخیره شد','مجوزهای پیش‌فرض نقش در دیتابیس به‌روزرسانی شد.');await loadAccess(true);await renderRolePolicies()}catch(error){notify('ذخیره سیاست انجام نشد',error.message)}finally{if(button)button.disabled=false}}

function captureClick(event){
  const nav=event.target?.closest?.('#sidebarNav .nav-item,#sidebarNav button');
  if(nav&&state.access?.panel==='STAFF'){
    const key=nav.dataset.accessModule||moduleKeyFromLabel(normalize(nav.textContent));
    if(key==='staff.users'){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();state.tab='accounts';renderShell();$$('#sidebarNav .nav-item,#sidebarNav button').forEach(button=>button.classList.toggle('active',button===nav));return;
    }
    if(key&&!can(key,'view')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();notify('دسترسی محدود است','این ماژول برای حساب شما فعال نشده است.');return}
  }
  const tab=event.target?.closest?.('[data-acx-tab]');if(tab){event.preventDefault();state.tab=tab.dataset.acxTab;renderShell();return}
  if(event.target?.closest?.('[data-acx-create]')){event.preventDefault();showCreate();return}
  const user=event.target?.closest?.('[data-acx-user]');if(user){event.preventDefault();void openUser(user.dataset.acxUser);return}
  if(event.target?.closest?.('[data-acx-prev]')){event.preventDefault();if(state.pagination?.hasPrevious)void loadAccounts(state.page-1,state.query);return}
  if(event.target?.closest?.('[data-acx-next]')){event.preventDefault();if(state.pagination?.hasNext)void loadAccounts(state.page+1,state.query);return}
  if(event.target?.closest?.('[data-acx-delete]')){event.preventDefault();const form=$('#acxAccountForm');if(form)void deleteAccount(form);return}
  if(event.target?.closest?.('[data-acx-save-role]')){event.preventDefault();void saveRolePolicy()}
}
function captureSubmit(event){
  if(event.target?.id==='acxSearchForm'){event.preventDefault();state.query=String($('#acxSearchInput')?.value||'').trim();void loadAccounts(1,state.query);return}
  if(event.target?.id==='acxAccountForm'){event.preventDefault();void saveAccount(event.target)}
}
function captureChange(event){
  if(event.target?.id==='acxPolicyRole'){state.rolePolicy=String(event.target.value||'RECRUITER');const root=$('#acxRoleMatrix');if(root)root.innerHTML=matrixMarkup(state.rolePolicy==='CAREGIVER'?'CAREGIVER':'STAFF',roleMatrix(state.rolePolicy),true);return}
  if(event.target?.name==='role'&&event.target.closest('#acxAccountForm')&&isAdmin()){
    const form=event.target.closest('#acxAccountForm');const role=String(event.target.value||'CAREGIVER');const matrix=$('.acx-matrix',form);if(matrix)matrix.outerHTML=matrixMarkup(role==='CAREGIVER'?'CAREGIVER':'STAFF',roleMatrix(role),true);
  }
}

async function loadAccess(force=false){
  if(state.loading&&!force)return;state.loading=true;
  try{const payload=await api('/api/access/me');state.access=payload.data;hideRoleChoice();if(state.access.panel==='STAFF')applyStaffNavigation(true);window.dispatchEvent(new CustomEvent('salamat-access-ready',{detail:state.access}))}catch(error){if(error.status!==401)console.error('Access load failed',error)}finally{state.loading=false}
}
function inspect(){hideRoleChoice();if(!window.SalamatBackend?.getCurrentUser?.())return;if(!state.access){void loadAccess();return}if(state.access.panel==='STAFF')applyStaffNavigation()}
function boot(){
  addStyles();hideRoleChoice();
  window.addEventListener('click',captureClick,true);document.addEventListener('submit',captureSubmit,true);document.addEventListener('change',captureChange,true);
  new MutationObserver(()=>{clearTimeout(state.timer);state.timer=setTimeout(inspect,25)}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(inspect,900);
  window.SalamatAccessControl={reload:()=>loadAccess(true),openUsers:()=>{state.tab='accounts';renderShell()},can};
  inspect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
