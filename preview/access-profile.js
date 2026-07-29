(()=>{
'use strict';
const AUTH_KEY='salamatAvalAccessControlV1';
const EVAL_KEY='salamatAvalEvaluationSystemV13';
const SESSION_KEY='salamatAvalSessionV1';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid=p=>`${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const roleName={admin:'مدیر سامانه',caregiver:'مراقب',recruiter:'کارشناس جذب',hr:'منابع انسانی'};
const seed=()=>({users:[
 {id:'SYS-ADMIN',name:'مدیر سامانه',username:'admin',password:'admin',email:'admin@salamataval.ir',mobile:'',role:'admin',status:'approved',createdAt:'حساب اولیه سامانه'},
 {id:'USR-CARE-001',name:'مریم حسینی',username:'maryam',password:'123456',email:'maryam@salamataval.ir',mobile:'09128668837',role:'caregiver',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-REC-001',name:'مهدی رضایی',username:'recruiter',password:'123456',email:'recruitment@salamataval.ir',mobile:'09120000001',role:'recruiter',status:'pending',createdAt:'نمونه اولیه'},
 {id:'USR-HR-001',name:'سارا محمدی',username:'hr',password:'123456',email:'hr@salamataval.ir',mobile:'09120000002',role:'hr',status:'pending',createdAt:'نمونه اولیه'}
],audit:[]});
function loadAuth(){try{const x=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');if(x?.users?.length)return x}catch{}const x=seed();localStorage.setItem(AUTH_KEY,JSON.stringify(x));return x}
function saveAuth(x,action,detail=''){x.audit=x.audit||[];x.audit.unshift({at:new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date()),action,detail});x.audit=x.audit.slice(0,200);localStorage.setItem(AUTH_KEY,JSON.stringify(x))}
function notify(title,text){try{toast(title,text)}catch{alert(`${title}\n${text}`)}}
function normalizeMobile(v){return String(v||'').replace(/\D/g,'').replace(/^98(?=9)/,'0')}
function activeMethod(){return $('#methodTabs button.active')?.dataset.method||'mobile'}
function role(){try{return selectedRole||'caregiver'}catch{return 'caregiver'}}
function adaptLogin(){
 const r=role(),emailBox=$('#emailFields'),emailInput=emailBox?.querySelector('input'),password=emailBox?.querySelector('input[type="password"]'),label=emailBox?.querySelector('label');
 if(r==='admin'){
   $('#methodTabs [data-method="email"]')?.click();
   if(emailInput){emailInput.type='text';emailInput.value='admin';emailInput.placeholder='نام کاربری مدیر سامانه'}
   if(password){password.value='admin'}
   if(label)label.textContent='نام کاربری';
   let note=$('#adminCredentialNote');
   if(!note){note=document.createElement('div');note.id='adminCredentialNote';note.className='auth-admin-note';note.innerHTML='<strong>حساب مدیر اولیه</strong><span>نام کاربری: admin &nbsp;•&nbsp; رمز عبور: admin</span>';emailBox?.appendChild(note)}
 }else{
   $('#adminCredentialNote')?.remove();
   if(emailInput){emailInput.type='email';emailInput.value='';emailInput.placeholder='name@salamataval.ir'}
   if(password)password.value='';
   if(label)label.textContent='ایمیل سازمانی';
 }
}
function findLoginUser(){
 const data=loadAuth(),r=role(),method=activeMethod();
 if(method==='mobile'){
  const mobile=normalizeMobile($('#mobileInput')?.value);
  return data.users.find(u=>u.role===r&&normalizeMobile(u.mobile)===mobile);
 }
 const fields=$('#emailFields')?.querySelectorAll('input')||[];
 const id=String(fields[0]?.value||'').trim().toLowerCase(),password=String(fields[1]?.value||'');
 return data.users.find(u=>u.role===r&&[u.username,u.email].filter(Boolean).map(x=>x.toLowerCase()).includes(id)&&u.password===password);
}
function gateLogin(e){
 const r=role(),method=activeMethod(),user=findLoginUser();
 if(!user){e.preventDefault();e.stopImmediatePropagation();notify('ورود غیرمجاز',r==='admin'?'نام کاربری یا رمز عبور مدیر صحیح نیست.':'برای این مشخصات، حسابی با نقش انتخاب‌شده وجود ندارد.');return}
 if(user.status!=='approved'){e.preventDefault();e.stopImmediatePropagation();notify(user.status==='suspended'?'حساب مسدود است':'حساب در انتظار تأیید است',user.status==='suspended'?'مدیر سامانه دسترسی این حساب را متوقف کرده است.':'تا زمانی که مدیر سامانه حساب را تأیید نکند امکان ورود وجود ندارد.');return}
 if(method==='mobile'&&r!=='admin'&&!/^\d{6}$/.test(String($('#otpInput')?.value||''))){e.preventDefault();e.stopImmediatePropagation();notify('کد تأیید ناقص است','کد شش‌رقمی ارسال‌شده را وارد کنید.');return}
 localStorage.setItem(SESSION_KEY,JSON.stringify({userId:user.id,role:user.role,name:user.name,at:Date.now()}));
}
function installGate(){$('#loginForm')?.addEventListener('submit',gateLogin,true);$$('#roleOptions .role-option').forEach(b=>b.addEventListener('click',()=>setTimeout(adaptLogin,0)));adaptLogin()}
function evalState(){try{return JSON.parse(localStorage.getItem(EVAL_KEY)||'{}')}catch{return {}}}
function saveEval(s){localStorage.setItem(EVAL_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('salamat-evaluation-changed'))}
function currentCaregiver(s=evalState()){let id='';try{id=JSON.parse(localStorage.getItem('salamatAvalEvaluationUIV13')||'{}').caregiverId||''}catch{}return s.caregivers?.find(x=>x.id===id)||s.caregivers?.[0]}
function photoOf(c){return c?.profile?.photo||''}
function photoHtml(c,cls='care-photo'){return photoOf(c)?`<img class="${cls}" src="${photoOf(c)}" alt="تصویر ${esc(c.name)}">`:`<span class="${cls} care-photo-placeholder">${esc((c?.name||'مراقب').split(' ').map(x=>x[0]).join('').slice(0,2))}</span>`}
function setPage(title,subtitle,html){$('#pageTitle').textContent=title;$('#pageSubtitle').textContent=subtitle;$('#content').innerHTML=`<section class="module-page ap-module">${html}</section>`;try{hydrateIcons($('#content'))}catch{}bindPage()}
function profilePage(){
 const s=evalState(),c=currentCaregiver(s);if(!c)return setPage('پروفایل مراقب','اطلاعات هویتی و حرفه‌ای','<div class="ev-empty">پروفایل مراقب پیدا نشد.</div>');
 const p=c.profile||{};
 setPage('پروفایل من','اطلاعات هویتی، تماس و تصویر پروفایل',`
 <section class="ap-profile-head"><div class="ap-photo-wrap">${photoHtml(c,'ap-profile-photo')}<label class="ap-photo-upload">تغییر تصویر<input id="carePhoto" type="file" accept="image/*"></label></div><div><span>${esc(c.id)}</span><h2>${esc(c.name)}</h2><p>${esc(c.serviceGroup||'—')} • ${esc(c.fileStatus||'وضعیت پرونده ثبت نشده')}</p></div></section>
 <form class="surface ev-form ap-profile-form" id="careProfileForm">
  <label>نام و نام خانوادگی<input name="name" required value="${esc(c.name||'')}"></label>
  <label>شماره همراه<input name="phone" required value="${esc(c.phone||'')}"></label>
  <label>کد ملی<input name="nationalId" value="${esc(c.nationalId||'')}"></label>
  <label>تاریخ تولد<input name="birthDate" value="${esc(p.birthDate||'')}" placeholder="۱۴۰۵/۰۱/۰۱"></label>
  <label>شهر محل سکونت<input name="city" value="${esc(p.city||'')}"></label>
  <label>تماس اضطراری<input name="emergencyContact" value="${esc(p.emergencyContact||'')}"></label>
  <label>شماره شبا / حساب<input name="bank" value="${esc(p.bank||c.bank||'')}"></label>
  <label>مهارت‌ها<input name="skills" value="${esc(p.skills||'')}"></label>
  <label class="wide">نشانی<textarea name="address" rows="2">${esc(p.address||'')}</textarea></label>
  <label class="wide">درباره من و سوابق حرفه‌ای<textarea name="bio" rows="4">${esc(p.bio||c.workHistory||'')}</textarea></label>
  <button class="btn primary wide">ذخیره پروفایل</button>
 </form>`)
}
function compressPhoto(file,done){const img=new Image(),reader=new FileReader();reader.onload=()=>{img.onload=()=>{const max=640,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);done(canvas.toDataURL('image/jpeg',.86))};img.src=reader.result};reader.readAsDataURL(file)}
function rankLicensePage(){
 const s=evalState(),c=currentCaregiver(s);if(!c)return;
 const rank=c.rank||{},lic=c.license||{},periods=(s.periods||[]).filter(x=>x.caregiverId===c.id),last=[...periods].reverse().find(x=>x.status==='نهایی');
 const cpd=(s.training||[]).filter(x=>x.caregiverId===c.id&&x.status==='تأییدشده').reduce((a,b)=>a+Number(b.credit||0),0);
 const workshops=(s.training||[]).filter(x=>x.caregiverId===c.id&&x.status==='تأییدشده'&&x.code==='CPD-01').length;
 const serious=(s.complaints||[]).some(x=>x.caregiverId===c.id&&['S-3','S-4'].includes(x.severity)&&x.status!=='مختومه');
 const corrective=(s.correctiveActions||[]).filter(x=>x.caregiverId===c.id&&x.status!=='بسته').length;
 const checks=[['کارنامه نهایی',!!last,last?`${fa(last.finalScore)} از ۱۰۰`:'دوره نهایی وجود ندارد'],['حداقل ۷۵ اعتبار CPD',cpd>=75,`${fa(cpd)} از ۷۵`],['حداقل ۵ کارگاه',workshops>=5,`${fa(workshops)} کارگاه`],['نداشتن تخلف مؤثر',!serious,serious?'پرونده شدید باز وجود دارد':'فاقد پرونده شدید باز'],['بسته‌شدن اقدامات اصلاحی',corrective===0,`${fa(corrective)} اقدام باز`]];
 const ranks=[['R-1','ممتاز',5],['R-2','ارشد',4],['R-3','حرفه‌ای',3],['R-4','پایه',2],['R-5','مشروط',1]];
 setPage('رتبه و پروانه','وضعیت حرفه‌ای، ستاره‌ها و صلاحیت اعزام',`
 <section class="ap-rank-head"><div class="ap-person">${photoHtml(c,'ap-score-photo')}<div><span>${esc(c.id)}</span><h2>${esc(c.name)}</h2><p>${esc(c.serviceGroup||'—')}</p></div></div><div class="ap-rank-current"><small>رتبه فعلی</small><strong>${rank.code?`${esc(rank.code)} • ${esc(rank.title)}`:'در انتظار تصمیم رسمی'}</strong><div class="ap-stars">${[1,2,3,4,5].map(i=>`<i class="${i<=Number(rank.stars||0)?'on':''}">★</i>`).join('')}</div></div></section>
 <section class="ap-rank-grid">
  <article class="surface"><div class="surface-head"><div><h3>رتبه حرفه‌ای</h3><p>رتبه مستقل از کارنامه دوره‌ای نمایش داده می‌شود.</p></div></div>
   <div class="ap-rank-facts"><div><small>PRI</small><strong>${rank.pri==null?'—':fa(rank.pri)}</strong></div><div><small>شروع اعتبار</small><strong>${esc(rank.validFrom||'—')}</strong></div><div><small>پایان اعتبار</small><strong>${esc(rank.validTo||'—')}</strong></div><div><small>مرجع تصمیم</small><strong>${esc(rank.decisionRef||'—')}</strong></div></div>
   <div class="ap-rank-ladder">${ranks.map(x=>`<div class="${rank.code===x[0]?'active':''}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${'★'.repeat(x[2])}</small></div>`).join('')}</div>
  </article>
  <article class="surface"><div class="surface-head"><div><h3>پروانه صلاحیت حرفه‌ای</h3><p>وضعیت صدور، تمدید یا محدودیت اعزام</p></div><span class="ev-badge ${lic.status==='فعال'?'good':'warn'}">${esc(lic.status||'ثبت نشده')}</span></div>
   <div class="ap-license-card"><div><small>شماره پروانه</small><strong>${esc(lic.number||'—')}</strong></div><div><small>تاریخ صدور</small><strong>${esc(lic.issuedAt||'—')}</strong></div><div><small>تاریخ انقضا</small><strong>${esc(lic.expiresAt||'—')}</strong></div><div><small>مرجع تصمیم</small><strong>${esc(lic.decisionRef||'—')}</strong></div></div>
   <div class="ev-checklist">${checks.map(x=>`<div><span class="${x[1]?'ok':'no'}">${x[1]?'✓':'!'}</span><div><strong>${x[0]}</strong><small>${x[2]}</small></div></div>`).join('')}</div>
  </article>
 </section>`)
}
function decorateScorecard(){const s=evalState(),c=currentCaregiver(s),head=$('.ev-page-head');if(!c||!head||head.querySelector('.ap-score-person'))return;const wrap=document.createElement('div');wrap.className='ap-score-person';wrap.innerHTML=`${photoHtml(c,'ap-score-photo')}<div><small>تصویر پرونده حرفه‌ای</small><strong>${esc(c.name)}</strong><span>${esc(c.id)}</span></div>`;head.prepend(wrap)}
function accessAdminPage(){
 const data=loadAuth();
 setPage('تأیید دسترسی کاربران','فقط حساب‌های تأییدشده اجازه ورود دارند',`
 <section class="ap-access-hero"><div><span>کنترل دسترسی مرکزی</span><h2>تأیید و مدیریت حساب کاربران</h2><p>حساب مدیر اولیه همیشه فعال است. همه حساب‌های دیگر پیش از ورود باید توسط مدیر تأیید شوند.</p></div><div><strong>${fa(data.users.filter(x=>x.status==='pending').length)}</strong><small>در انتظار تأیید</small></div></section>
 <section class="ap-access-grid">
  <article class="surface"><div class="surface-head"><div><h3>ایجاد حساب جدید</h3><p>حساب جدید به‌صورت پیش‌فرض در انتظار تأیید است.</p></div></div>
   <form class="ev-form" id="newAccessUser">
    <label>نام و نام خانوادگی<input name="name" required></label><label>نقش<select name="role"><option value="caregiver">مراقب</option><option value="recruiter">کارشناس جذب</option><option value="hr">منابع انسانی</option><option value="admin">مدیر موازی</option></select></label>
    <label>نام کاربری<input name="username" required></label><label>رمز عبور<input name="password" required></label>
    <label>ایمیل سازمانی<input name="email" type="email"></label><label>شماره همراه<input name="mobile"></label>
    <button class="btn primary wide">ایجاد حساب در انتظار تأیید</button>
   </form>
  </article>
  <article class="surface"><div class="surface-head"><div><h3>سیاست ورود</h3><p>هر ورود با نقش و وضعیت حساب کنترل می‌شود.</p></div></div><div class="ap-policy-list"><div>✓ نقش انتخابی باید با نقش حساب یکسان باشد.</div><div>✓ وضعیت حساب باید «تأییدشده» باشد.</div><div>✓ حساب تعلیق‌شده امکان ورود ندارد.</div><div>✓ حساب مدیر اولیه با admin / admin فعال است.</div></div></article>
 </section>
 <article class="surface table-wrap"><div class="surface-head"><div><h3>فهرست حساب‌ها</h3><p>تأیید، تعلیق یا بازگردانی دسترسی</p></div></div>
 <table class="data-table"><thead><tr><th>کاربر</th><th>نقش</th><th>شناسه ورود</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${data.users.map(u=>`<tr><td><strong>${esc(u.name)}</strong><small class="ev-cell-note">${esc(u.id)}</small></td><td>${roleName[u.role]||u.role}</td><td>${esc(u.username||u.email||u.mobile||'—')}</td><td><span class="ev-badge ${u.status==='approved'?'good':u.status==='suspended'?'bad':'warn'}">${u.status==='approved'?'تأییدشده':u.status==='suspended'?'تعلیق‌شده':'در انتظار تأیید'}</span></td><td>${u.id==='SYS-ADMIN'?'<span>حساب اصلی</span>':`<button class="cp-link-btn" data-access="${u.id}:approved">تأیید</button><button class="cp-link-btn danger" data-access="${u.id}:suspended">تعلیق</button><button class="cp-link-btn" data-access="${u.id}:pending">انتظار</button>`}</td></tr>`).join('')}</tbody></table></article>`)
}
function bindPage(){
 $('#careProfileForm')?.addEventListener('submit',e=>{e.preventDefault();const s=evalState(),c=currentCaregiver(s),f=new FormData(e.currentTarget);c.name=String(f.get('name'));c.phone=String(f.get('phone'));c.nationalId=String(f.get('nationalId'));c.profile={...(c.profile||{}),birthDate:String(f.get('birthDate')),city:String(f.get('city')),emergencyContact:String(f.get('emergencyContact')),bank:String(f.get('bank')),skills:String(f.get('skills')),address:String(f.get('address')),bio:String(f.get('bio'))};saveEval(s);syncProfileUI(c);notify('پروفایل ذخیره شد','اطلاعات مراقب در پرونده حرفه‌ای به‌روزرسانی شد.')});
 $('#carePhoto')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;compressPhoto(file,data=>{const s=evalState(),c=currentCaregiver(s);c.profile={...(c.profile||{}),photo:data};saveEval(s);profilePage();syncProfileUI(c);notify('تصویر ثبت شد','عکس در پروفایل و کارنامه حرفه‌ای نمایش داده می‌شود.')})});
 $('#newAccessUser')?.addEventListener('submit',e=>{e.preventDefault();const data=loadAuth(),f=new FormData(e.currentTarget),username=String(f.get('username')).trim();if(data.users.some(x=>x.username===username)){notify('نام کاربری تکراری است','شناسه دیگری انتخاب کنید.');return}data.users.push({id:uid('USR'),name:String(f.get('name')),role:String(f.get('role')),username,password:String(f.get('password')),email:String(f.get('email')),mobile:String(f.get('mobile')),status:'pending',createdAt:new Date().toISOString()});saveAuth(data,'ایجاد حساب',username);accessAdminPage();notify('حساب ایجاد شد','برای ورود باید وضعیت حساب را تأیید کنید.')});
 $$('[data-access]').forEach(b=>b.onclick=()=>{const [id,status]=b.dataset.access.split(':'),data=loadAuth(),u=data.users.find(x=>x.id===id);if(!u)return;u.status=status;saveAuth(data,'تغییر وضعیت حساب',`${u.username} • ${status}`);accessAdminPage();notify('وضعیت تغییر کرد',`دسترسی ${u.name} به‌روزرسانی شد.`)})
}
function syncProfileUI(c){if(!c)return;['sidebarName','topName'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=c.name});const initials=c.name.split(' ').map(x=>x[0]).join('').slice(0,2);['sidebarAvatar','topAvatar'].forEach(id=>{const el=document.getElementById(id);if(!el)return;if(photoOf(c)){el.innerHTML=`<img src="${photoOf(c)}" alt="${esc(c.name)}">`;el.classList.add('has-photo')}else el.textContent=initials})}
function patchApp(){
 if(window.__accessProfilePatched)return;window.__accessProfilePatched=true;
 if(roles?.caregiver&&!roles.caregiver.nav.some(x=>x[1]==='پروفایل من'))roles.caregiver.nav.splice(1,0,['account','پروفایل من']);
 if(roles?.admin&&!roles.admin.nav.some(x=>x[1]==='تأیید دسترسی کاربران'))roles.admin.nav.splice(1,0,['shield','تأیید دسترسی کاربران']);
 const previousModule=renderModule,previousDashboard=renderDashboard;
 renderDashboard=function(r){const out=previousDashboard(r);if(r===roles.caregiver||role()==='caregiver')setTimeout(()=>{syncProfileUI(currentCaregiver());decorateScorecard()},0);return out};
 renderModule=function(r,n){const label=n?.[1]||'';if((r===roles.caregiver||role()==='caregiver')&&label==='پروفایل من')return profilePage();if((r===roles.caregiver||role()==='caregiver')&&label==='رتبه و پروانه')return rankLicensePage();if((r===roles.admin||role()==='admin')&&label==='تأیید دسترسی کاربران')return accessAdminPage();const out=previousModule(r,n);if((r===roles.caregiver||role()==='caregiver')&&label==='کارنامه حرفه‌ای')setTimeout(decorateScorecard,0);return out};
 window.addEventListener('salamat-evaluation-changed',()=>setTimeout(()=>syncProfileUI(currentCaregiver()),20));
}
function boot(){if(typeof roles==='undefined'||typeof renderModule!=='function'||!window.__evaluationGovernanceReady)return setTimeout(boot,100);patchApp()}
installGate();boot();
})();