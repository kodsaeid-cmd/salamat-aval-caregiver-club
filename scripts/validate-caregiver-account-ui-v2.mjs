import fs from 'node:fs';

const ui=fs.readFileSync('worker/caregiver-account-ui-v2.ts','utf8');
const outer=fs.readFileSync('worker/index-desktop-react-v1.ts','utf8');
const expect=(condition,message)=>{if(!condition)throw new Error(`Caregiver account UI v2 validation failed: ${message}`)};
const has=(source,needle,message)=>expect(source.includes(needle),message);

has(ui,'[data-method="mobile"]','mobile/OTP login tab selector is missing');
has(ui,'cau2-otp-disabled','OTP fields are not disabled in the login UI');
has(ui,'ورود با نام کاربری و رمز عبور','credential login label is missing');
has(ui,"identifier.type='text'",'identifier is still constrained to email input');
has(ui,"placeholder='شماره موبایل یا نام کاربری'",'identifier hint is missing');
has(ui,"fetch('/api/auth/login'",'classic login is not owned by canonical auth API');
has(ui,"payload?.error==='account_pending_approval'",'pending approval page is not tied to canonical error code');
has(ui,'حساب شما در انتظار تأیید مدیرسامانه است','pending approval copy is missing');
has(ui,"for(const name of ['email','password','confirmPassword'])",'obsolete signup credential fields are not removed');
has(ui,"national.required=true",'national ID is not required for initial password');
has(ui,"fetch('/api/public/caregivers/register'",'signup is not owned by canonical registration API');
has(ui,'نام کاربری اولیه شما همان شماره موبایل','signup credential explanation is missing');
has(ui,'تا پیش از تأیید، حتی با واردکردن صحیح شماره موبایل و کد ملی امکان ورود به پنل وجود ندارد.','pre-approval login restriction is not visible in signup');
has(ui,"document.addEventListener('submit'",'capture-phase login/signup ownership is missing');
has(ui,"event.stopImmediatePropagation()",'legacy demo form handlers are not blocked');
has(outer,'routeCaregiverAccountUiV2(request,env)','production worker does not serve account UI v2');
has(outer,'caregiver-account-ui-v2.js?v=2.0.0','account UI v2 is not injected into the public login page');
has(outer,'x-salamat-caregiver-account-ui","2.0.0"','production UI marker was not bumped');

console.log('Caregiver account UI v2 contract passed.');
