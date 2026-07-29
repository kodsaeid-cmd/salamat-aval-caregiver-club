const digits = new Intl.NumberFormat('fa-IR');
const views = {
  dashboard:['داشبورد مدیریت باشگاه','نمای کلی عضویت، جذب و کیفیت حرفه‌ای مراقبین'],
  users:['مدیریت کاربران و نقش‌ها','ایجاد کاربران سازمانی و کنترل دسترسی‌ها'],
  caregivers:['پروفایل مراقبین','هویت حرفه‌ای، رتبه، صلاحیت و سوابق اعضای باشگاه'],
  recruitment:['جذب و استخدام','ثبت پروفایل اولیه مراقب توسط کاربر جذب'],
  evaluations:['ارزیابی و پایش','تبدیل رویدادهای حرفه‌ای به کارنامه و مسیر رشد'],
  education:['آموزش و بازآموزی','مدیریت دوره‌ها، آزمون‌ها و اعتبار آموزشی'],
  support:['پشتیبانی باشگاه','ارتباط ساختاریافته با مراقبین و واحدهای سازمان'],
  reports:['گزارش‌های مدیریتی','تصمیم‌گیری داده‌محور در شبکه مراقبین']
};

const users = [
  {name:'علی محمدی',username:'ali.mohammadi',role:'ادمین سیستم',status:'فعال',last:'امروز، ۱۲:۴۵',avatar:'ع‌م',tone:'a1'},
  {name:'سارا احمدی',username:'s.ahmadi',role:'مدیر عملیات',status:'فعال',last:'امروز، ۱۱:۳۰',avatar:'س‌ا',tone:'a3'},
  {name:'مهدی رضایی',username:'m.rezaei',role:'کاربر جذب',status:'فعال',last:'امروز، ۱۰:۰۵',avatar:'م‌ر',tone:'a2'},
  {name:'ناهید کریمی',username:'n.karimi',role:'پشتیبان',status:'غیرفعال',last:'سه روز قبل',avatar:'ن‌ک',tone:'a1'},
  {name:'زهرا عباسی',username:'z.abbasi',role:'ارزیاب',status:'فعال',last:'دیروز، ۱۷:۲۰',avatar:'ز‌ع',tone:'a3'}
];

const caregivers = [
  {name:'مریم حسینی',code:'SA-1405-1028',rank:'حرفه‌ای',rankClass:'pro',score:84,satisfaction:'۹۲٪',cases:27,tags:['مراقب سالمند','آلزایمر','شبانه‌روزی'],avatar:'م‌ح',tone:'a1',status:'فعال'},
  {name:'سمیرا محمدی',code:'SA-1405-0840',rank:'ارشد',rankClass:'senior',score:91,satisfaction:'۹۶٪',cases:41,tags:['مراقب بیمار','کنترل علائم حیاتی','تزریقات'],avatar:'س‌م',tone:'a3',status:'فعال'},
  {name:'رضا کریمی',code:'SA-1405-0914',rank:'پایه',rankClass:'base',score:68,satisfaction:'۷۴٪',cases:9,tags:['مراقب سالمند','شیفت روز'],avatar:'ر‌ک',tone:'a2',status:'نیازمند پیگیری'},
  {name:'فاطمه احمدی',code:'SA-1405-1287',rank:'در حال بررسی',rankClass:'base',score:'—',satisfaction:'—',cases:0,tags:['مراقب کودک','کمک‌های اولیه'],avatar:'ف‌ا',tone:'a1',status:'بررسی اولیه'},
  {name:'نرگس رضایی',code:'SA-1405-0762',rank:'ممتاز',rankClass:'senior',score:96,satisfaction:'۹۹٪',cases:64,tags:['VIP','آلزایمر','شبانه‌روزی'],avatar:'ن‌ر',tone:'a3',status:'فعال'},
  {name:'محمد صادقی',code:'SA-1405-1113',rank:'حرفه‌ای',rankClass:'pro',score:82,satisfaction:'۸۹٪',cases:18,tags:['مراقب بیمار','مراقبت از زخم'],avatar:'م‌ص',tone:'a2',status:'فعال'}
];

function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.remove('active'));
  const target=document.getElementById(`view-${name}`);
  if(!target)return;
  target.classList.add('active');
  document.querySelector(`.nav-item[data-view="${name}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent=views[name][0];
  document.getElementById('pageSubtitle').textContent=views[name][1];
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  history.replaceState(null,'',`#${name}`);
}

document.getElementById('nav').addEventListener('click',e=>{
  const item=e.target.closest('[data-view]');
  if(item)showView(item.dataset.view);
});
document.addEventListener('click',e=>{
  const jump=e.target.closest('[data-jump]');
  if(jump)showView(jump.dataset.jump);
});
document.getElementById('mobileMenu').onclick=()=>document.getElementById('sidebar').classList.toggle('open');

function renderUsers(){
  document.getElementById('usersTable').innerHTML=users.map((u,i)=>`<tr><td><div class="person"><span class="avatar ${u.tone}">${u.avatar}</span><div><strong>${u.name}</strong><small>${u.role}</small></div></div></td><td dir="ltr">${u.username}</td><td><span class="rank ${u.role.includes('ادمین')?'base':u.role.includes('جذب')?'senior':'pro'}">${u.role}</span></td><td><span class="status-pill ${u.status==='فعال'?'':'warning'}">${u.status}</span></td><td>${u.last}</td><td><button class="link">ویرایش</button> <button class="link">⋮</button></td></tr>`).join('');
}

function renderCaregivers(filter=''){
  const q=filter.trim().toLowerCase();
  const list=caregivers.filter(c=>[c.name,c.code,c.tags.join(' ')].join(' ').toLowerCase().includes(q));
  document.getElementById('caregiverGrid').innerHTML=list.map(c=>`<article class="caregiver-card"><div class="caregiver-top"><span class="avatar xl ${c.tone}">${c.avatar}</span><div><h3>${c.name}</h3><p>${c.code}</p></div><span class="rank ${c.rankClass}">${c.rank}</span></div><div class="meta"><div><strong>${c.score}</strong><span>امتیاز</span></div><div><strong>${c.satisfaction}</strong><span>رضایت</span></div><div><strong>${digits.format(c.cases)}</strong><span>پرونده موفق</span></div></div><div class="tags">${c.tags.map(t=>`<span>${t}</span>`).join('')}</div><div class="caregiver-actions"><span class="status-dot">${c.status}</span><button class="link profile-open">پروفایل ۳۶۰° ←</button></div></article>`).join('') || '<article class="card" style="padding:30px;text-align:center;grid-column:1/-1">مراقبی با این عبارت پیدا نشد.</article>';
  bindProfileButtons();
}

const drawer=document.getElementById('userDrawer');
const overlay=document.getElementById('drawerOverlay');
function openDrawer(){drawer.classList.add('open');overlay.classList.add('open')}
function closeDrawer(){drawer.classList.remove('open');overlay.classList.remove('open')}
document.getElementById('openUserDrawer').onclick=openDrawer;
document.getElementById('closeDrawer').onclick=closeDrawer;
overlay.onclick=closeDrawer;

document.getElementById('userForm').addEventListener('submit',e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const name=String(fd.get('name'));
  const role=String(fd.get('role'));
  users.unshift({name,username:String(fd.get('username')),role,status:'فعال',last:'همین حالا',avatar:name.split(' ').map(x=>x[0]).join('').slice(0,2),tone:'a1'});
  renderUsers();closeDrawer();e.currentTarget.reset();showToast('کاربر ایجاد شد',`${name} با نقش «${role}» به سامانه اضافه شد.`);
});

document.getElementById('caregiverForm').addEventListener('submit',e=>{
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const name=String(fd.get('fullName'));
  const code=`SA-1405-${String(1288+caregivers.length).padStart(4,'0')}`;
  caregivers.unshift({name,code,rank:'در حال بررسی',rankClass:'base',score:'—',satisfaction:'—',cases:0,tags:[String(fd.get('type')),String(fd.get('area')||'محدوده ثبت‌شده')],avatar:name.split(' ').map(x=>x[0]).join('').slice(0,2),tone:'a1',status:'بررسی اولیه'});
  renderCaregivers();e.currentTarget.reset();showToast('پروفایل مراقب ثبت شد',`${name} با کد عضویت ${code} برای بررسی اولیه ارسال شد.`);setTimeout(()=>showView('caregivers'),800);
});

document.querySelectorAll('.selectable').forEach(group=>group.addEventListener('click',e=>{
  const btn=e.target.closest('button');if(btn)btn.classList.toggle('selected');
}));

document.getElementById('caregiverSearch').addEventListener('input',e=>renderCaregivers(e.target.value));
document.getElementById('globalSearch').addEventListener('keydown',e=>{
  if(e.key==='Enter'){showView('caregivers');document.getElementById('caregiverSearch').value=e.target.value;renderCaregivers(e.target.value)}
});

const profileModal=document.getElementById('profileModal');
function bindProfileButtons(){document.querySelectorAll('.profile-open').forEach(b=>b.onclick=()=>profileModal.classList.add('open'))}
document.getElementById('closeProfile').onclick=()=>profileModal.classList.remove('open');
profileModal.addEventListener('click',e=>{if(e.target===profileModal)profileModal.classList.remove('open')});

document.querySelectorAll('.profile-tabs button').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.profile-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showToast('بخش نمایشی',`تب «${btn.textContent}» در نسخه بعدی به داده واقعی متصل می‌شود.`)});

let toastTimer;
function showToast(title,text){
  const toast=document.getElementById('toast');
  document.getElementById('toastTitle').textContent=title;
  document.getElementById('toastText').textContent=text;
  toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3500);
}

document.querySelectorAll('.upload input').forEach(input=>input.addEventListener('change',()=>{
  if(input.files?.[0]){const label=input.closest('.upload');label.querySelector('span').textContent=input.files[0].name;label.style.borderColor='#16814a';label.style.background='#eef8f2'}
}));

renderUsers();renderCaregivers();bindProfileButtons();
const initial=location.hash.replace('#','');if(views[initial])showView(initial);
setTimeout(()=>showToast('پیش‌نمایش زنده آماده است','منوها، فرم ثبت مراقب، مدیریت کاربران و پروفایل ۳۶۰ درجه قابل کلیک هستند.'),700);