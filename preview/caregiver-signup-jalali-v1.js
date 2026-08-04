(()=>{
'use strict';
if(window.__salamatCaregiverSignupJalaliV1)return;
window.__salamatCaregiverSignupJalaliV1=true;

const MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const WEEKDAYS=['ش','ی','د','س','چ','پ','ج'];
const BREAKS=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
const FA='۰۱۲۳۴۵۶۷۸۹';
const $=(selector,root=document)=>root.querySelector(selector);
const fa=value=>String(value??'').replace(/\d/g,digit=>FA[Number(digit)]);
const pad=value=>String(value).padStart(2,'0');
const div=(a,b)=>~~(a/b);
const mod=(a,b)=>a-~~(a/b)*b;
let active=null;

function jalCal(jy,withoutLeap=false){
  const bl=BREAKS.length,gy=jy+621;let leapJ=-14,jp=BREAKS[0],jm=0,jump=0,leap=0,n=0;
  if(jy<jp||jy>=BREAKS[bl-1])throw new Error('Invalid Jalaali year');
  for(let i=1;i<bl;i+=1){jm=BREAKS[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}
  n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ+=1;
  const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;const march=20+leapJ-leapG;
  if(withoutLeap)return {gy,march};if(jump-n<6)n=n-jump+div(jump+4,33)*33;leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return {leap,gy,march};
}
function g2d(gy,gm,gd){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
function d2g(jdn){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308;return {gd:div(mod(i,153),5)+1,gm:mod(div(i,153),12)+1,gy:div(j,1461)-100100+div(8-mod(div(i,153),12)-1,6)}}
function j2d(jy,jm,jd){const r=jalCal(jy,true);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1}
function d2j(jdn){const g=d2g(jdn);let jy=g.gy-621;const r=jalCal(jy,false),jdn1f=g2d(g.gy,3,r.march);let k=jdn-jdn1f,jm,jd;if(k>=0){if(k<=185){jm=1+div(k,31);jd=mod(k,31)+1;return {jy,jm,jd}}k-=186}else{jy-=1;k+=179;if(r.leap===1)k+=1}jm=7+div(k,30);jd=mod(k,30)+1;return {jy,jm,jd}}
function toJalaali(gy,gm,gd){return d2j(g2d(gy,gm,gd))}
function toGregorian(jy,jm,jd){return d2g(j2d(jy,jm,jd))}
function monthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return jalCal(jy).leap===0?30:29}
function todayJ(){const d=new Date();return toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate())}
function isoToJ(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?toJalaali(+m[1],+m[2],+m[3]):null}
function jToIso(jy,jm,jd){const g=toGregorian(jy,jm,jd);return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`}
function label(value){const j=isoToJ(value);return j?`${fa(j.jy)}/${fa(pad(j.jm))}/${fa(pad(j.jd))}`:'انتخاب تاریخ تولد'}
function longLabel(value){const j=isoToJ(value);return j?`${fa(j.jd)} ${MONTHS[j.jm-1]} ${fa(j.jy)}`:'تقویم رسمی هجری شمسی'}

function addStyles(){
  if($('#caregiverBirthCalendarStyles'))return;
  const style=document.createElement('style');style.id='caregiverBirthCalendarStyles';style.textContent=`
.cbr-hidden{display:none!important}.cbr-trigger{width:100%;min-height:48px;border:1px solid #d9e5df;border-radius:13px;background:#fff;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:right;font:inherit;cursor:pointer}.cbr-trigger:hover,.cbr-trigger[aria-expanded="true"]{border-color:#118a51;box-shadow:0 0 0 3px #e4f5ec}.cbr-trigger strong{display:block;font-size:11px;color:#20382c}.cbr-trigger small{display:block;margin-top:3px;font-size:8px;color:#7b8982}.cbr-trigger i{font-style:normal;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#e8f6ee;color:#087a45;font-size:16px}.cbr-popover{position:fixed;z-index:2147483500;width:min(350px,calc(100vw - 24px));padding:13px;border:1px solid #d6e5dd;border-radius:19px;background:#fff;box-shadow:0 25px 75px rgba(20,63,42,.25);direction:rtl}.cbr-popover[hidden]{display:none!important}.cbr-selects{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:7px;margin-bottom:10px}.cbr-selects select{width:100%;border:1px solid #dce7e1;border-radius:10px;padding:9px 7px;background:#fff;font:inherit;font-size:9px}.cbr-week,.cbr-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.cbr-week span{text-align:center;font-size:8px;color:#84918a;font-weight:900;padding:4px}.cbr-day{height:36px;border:0;border-radius:10px;background:transparent;font:inherit;font-size:9px;font-weight:900;color:#31483c}.cbr-day:hover{background:#edf8f2;color:#087a45}.cbr-day.selected{background:#087a45;color:#fff}.cbr-day.blank{visibility:hidden}.cbr-actions{display:flex;justify-content:space-between;gap:7px;border-top:1px solid #edf2ef;margin-top:10px;padding-top:10px}.cbr-actions button{border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:8px;font-weight:900;background:#f2f7f4;color:#596b61}.cbr-actions .primary{background:#087a45;color:#fff}.caregiver-signup-submit[aria-busy="true"]{opacity:.65;pointer-events:none}
`;(document.head||document.documentElement).appendChild(style);
}
function popover(){let node=$('#caregiverBirthCalendar');if(node)return node;node=document.createElement('section');node.id='caregiverBirthCalendar';node.className='cbr-popover';node.hidden=true;node.setAttribute('role','dialog');node.setAttribute('aria-label','انتخاب تاریخ تولد شمسی');document.body.appendChild(node);return node}
function position(){if(!active)return;const pop=popover(),rect=active.trigger.getBoundingClientRect(),width=Math.min(350,window.innerWidth-24);let right=Math.max(12,window.innerWidth-rect.right);if(right+width>window.innerWidth-12)right=12;pop.style.width=`${width}px`;pop.style.right=`${right}px`;pop.style.left='auto';const top=window.innerHeight-rect.bottom>430?rect.bottom+8:Math.max(8,rect.top-430);pop.style.top=`${top}px`}
function close(){if(!active)return;active.trigger.setAttribute('aria-expanded','false');popover().hidden=true;active=null}
function setValue(jy,jm,jd){if(!active)return;active.input.value=jToIso(jy,jm,jd);active.input.dispatchEvent(new Event('change',{bubbles:true}));updateTrigger(active.input,active.trigger);close()}
function render(){if(!active)return;const {year,month,input}=active,pop=popover(),selected=isoToJ(input.value);const first=toGregorian(year,month,1),offset=(new Date(first.gy,first.gm-1,first.gd).getDay()+1)%7,length=monthLength(year,month),today=todayJ();const years=[];for(let y=today.jy-80;y<=today.jy-14;y+=1)years.push(`<option value="${y}" ${y===year?'selected':''}>${fa(y)}</option>`);const months=MONTHS.map((name,index)=>`<option value="${index+1}" ${index+1===month?'selected':''}>${name}</option>`);const days=[];for(let i=0;i<offset;i+=1)days.push('<span class="cbr-day blank"></span>');for(let day=1;day<=length;day+=1){const isSelected=selected&&selected.jy===year&&selected.jm===month&&selected.jd===day;days.push(`<button type="button" class="cbr-day${isSelected?' selected':''}" data-cbr-day="${day}">${fa(day)}</button>`)}pop.innerHTML=`<div class="cbr-selects"><select data-cbr-year aria-label="سال">${years.join('')}</select><select data-cbr-month aria-label="ماه">${months.join('')}</select><select data-cbr-day-select aria-label="روز">${Array.from({length},(_,i)=>`<option value="${i+1}" ${selected&&selected.jy===year&&selected.jm===month&&selected.jd===i+1?'selected':''}>${fa(i+1)}</option>`).join('')}</select></div><div class="cbr-week">${WEEKDAYS.map(x=>`<span>${x}</span>`).join('')}</div><div class="cbr-grid">${days.join('')}</div><div class="cbr-actions"><button type="button" data-cbr-close>بستن</button><button type="button" class="primary" data-cbr-confirm>انتخاب تاریخ</button></div>`;position()}
function open(input,trigger){close();const selected=isoToJ(input.value)||{jy:todayJ().jy-30,jm:1,jd:1};active={input,trigger,year:selected.jy,month:selected.jm};trigger.setAttribute('aria-expanded','true');popover().hidden=false;render()}
function updateTrigger(input,trigger){$('strong',trigger).textContent=label(input.value);$('small',trigger).textContent=longLabel(input.value)}
function enhance(){const input=$('#caregiverSignupForm input[name="birthDate"]');if(!input||input.dataset.cbr==='1')return;input.dataset.cbr='1';input.type='hidden';input.classList.add('cbr-hidden');const trigger=document.createElement('button');trigger.type='button';trigger.className='cbr-trigger';trigger.setAttribute('aria-expanded','false');trigger.innerHTML='<span><strong></strong><small></small></span><i>▣</i>';input.parentElement?.appendChild(trigger);updateTrigger(input,trigger);trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(input,trigger)})}

function formError(message){const box=$('#caregiverSignupError');if(box){box.textContent=message;box.classList.add('show')}else alert(message)}
function clearError(){const box=$('#caregiverSignupError');if(box){box.textContent='';box.classList.remove('show')}}
const digits=value=>String(value||'').replace(/[۰-۹]/g,c=>String(FA.indexOf(c))).replace(/\D/g,'');
async function api(path,options={}){const headers=new Headers(options.headers||{});headers.set('content-type','application/json');const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`);error.code=payload.error;throw error}return payload}
async function submit(event){
  if(event.target?.id!=='caregiverSignupForm')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();clearError();
  const form=event.target,data=new FormData(form),mobile=digits(data.get('mobile')),nationalId=digits(data.get('nationalId')),password=String(data.get('password')||''),confirm=String(data.get('confirmPassword')||''),birthDate=String(data.get('birthDate')||'');
  const payload={fullName:String(data.get('name')||'').trim(),mobile,nationalId,username:String(data.get('email')||'').trim().toLowerCase(),email:String(data.get('email')||'').trim().toLowerCase(),serviceGroup:String(data.get('serviceGroup')||''),city:String(data.get('city')||'').trim(),birthDate,skills:String(data.get('skills')||'').trim(),password,address:String(data.get('address')||'').trim(),bio:String(data.get('bio')||'').trim()};
  if(payload.fullName.length<3)return formError('نام و نام خانوادگی را کامل وارد کنید.');
  if(!/^09\d{9}$/.test(mobile))return formError('شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.');
  if(nationalId&&!/^\d{10}$/.test(nationalId))return formError('کد ملی باید ۱۰ رقم باشد.');
  if(!birthDate)return formError('تاریخ تولد را از تقویم شمسی انتخاب کنید.');
  if(password.length<8)return formError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
  if(password!==confirm)return formError('تکرار رمز عبور با رمز عبور یکسان نیست.');
  if(data.get('consent')!=='on')return formError('برای ارسال درخواست باید صحت اطلاعات را تأیید کنید.');
  const button=$('.caregiver-signup-submit',form);if(button){button.setAttribute('aria-busy','true');button.disabled=true}
  try{
    const result=await api('/api/public/caregivers/register',{method:'POST',body:JSON.stringify(payload)});form.reset();const birth=$('input[name="birthDate"]',form);if(birth)birth.value='';const trigger=$('.cbr-trigger',birth?.parentElement||document);if(birth&&trigger)updateTrigger(birth,trigger);$('#caregiverSignupFormWrap')?.classList.add('hidden');$('#caregiverSignupSuccess')?.classList.remove('hidden');const request=$('#caregiverSignupRequest');if(request)request.innerHTML=`<strong>کد درخواست عضویت: ${result.data.requestCode}</strong><br><span>شناسه پرونده حرفه‌ای: ${result.data.membershipCode||result.data.caregiverId}</span>`;window.toast?.('درخواست عضویت ثبت شد','پرونده شما در انتظار تأیید مدیر سامانه است.');
  }catch(error){formError(error.message||'ثبت‌نام انجام نشد.')}finally{if(button){button.removeAttribute('aria-busy');button.disabled=false}}
}

function boot(){addStyles();enhance();document.addEventListener('submit',submit,true);document.addEventListener('click',event=>{const pop=popover();if(active&&!pop.contains(event.target)&&!active.trigger.contains(event.target))close();const day=event.target?.closest?.('[data-cbr-day]');if(day&&active){event.preventDefault();setValue(active.year,active.month,Number(day.dataset.cbrDay));return}if(event.target?.closest?.('[data-cbr-close]')){event.preventDefault();close();return}if(event.target?.closest?.('[data-cbr-confirm]')&&active){event.preventDefault();const daySelect=$('[data-cbr-day-select]',pop);setValue(active.year,active.month,Number(daySelect?.value||1));return}},true);document.addEventListener('change',event=>{if(!active)return;if(event.target?.matches?.('[data-cbr-year]')){active.year=Number(event.target.value);render()}else if(event.target?.matches?.('[data-cbr-month]')){active.month=Number(event.target.value);render()}},true);window.addEventListener('resize',position);window.addEventListener('scroll',position,true);new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
