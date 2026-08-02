(()=>{
'use strict';
if(window.__salamatEvaluationJalaliCalendarV1)return;
window.__salamatEvaluationJalaliCalendarV1=true;

const MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const WEEKDAYS=['ش','ی','د','س','چ','پ','ج'];
const BREAKS=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
const FA_DIGITS='۰۱۲۳۴۵۶۷۸۹';
let active=null;
let observer=null;
let observerTimer=0;

const div=(a,b)=>~~(a/b);
const mod=(a,b)=>a-~~(a/b)*b;
const fa=value=>String(value??'').replace(/\d/g,digit=>FA_DIGITS[Number(digit)]);
const pad=value=>String(value).padStart(2,'0');

function jalCal(jy,withoutLeap=false){
  const bl=BREAKS.length;
  const gy=jy+621;
  let leapJ=-14;
  let jp=BREAKS[0];
  let jm=0;
  let jump=0;
  let leap=0;
  let n=0;
  if(jy<jp||jy>=BREAKS[bl-1])throw new Error('Invalid Jalaali year');
  for(let i=1;i<bl;i+=1){
    jm=BREAKS[i];
    jump=jm-jp;
    if(jy<jm)break;
    leapJ+=div(jump,33)*8+div(mod(jump,33),4);
    jp=jm;
  }
  n=jy-jp;
  leapJ+=div(n,33)*8+div(mod(n,33)+3,4);
  if(mod(jump,33)===4&&jump-n===4)leapJ+=1;
  const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;
  const march=20+leapJ-leapG;
  if(withoutLeap)return {gy,march};
  if(jump-n<6)n=n-jump+div(jump+4,33)*33;
  leap=mod(mod(n+1,33)-1,4);
  if(leap===-1)leap=4;
  return {leap,gy,march};
}
function g2d(gy,gm,gd){
  let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;
  d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;
  return d;
}
function d2g(jdn){
  let j=4*jdn+139361631;
  j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;
  const i=div(mod(j,1461),4)*5+308;
  const gd=div(mod(i,153),5)+1;
  const gm=mod(div(i,153),12)+1;
  const gy=div(j,1461)-100100+div(8-gm,6);
  return {gy,gm,gd};
}
function j2d(jy,jm,jd){
  const r=jalCal(jy,true);
  return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1;
}
function d2j(jdn){
  const g=d2g(jdn);
  let jy=g.gy-621;
  const r=jalCal(jy,false);
  const jdn1f=g2d(g.gy,3,r.march);
  let k=jdn-jdn1f;
  let jm;
  let jd;
  if(k>=0){
    if(k<=185){jm=1+div(k,31);jd=mod(k,31)+1;return {jy,jm,jd}}
    k-=186;
  }else{
    jy-=1;
    k+=179;
    if(r.leap===1)k+=1;
  }
  jm=7+div(k,30);
  jd=mod(k,30)+1;
  return {jy,jm,jd};
}
function toJalaali(gy,gm,gd){return d2j(g2d(gy,gm,gd))}
function toGregorian(jy,jm,jd){return d2g(j2d(jy,jm,jd))}
function monthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return jalCal(jy).leap===0?30:29}
function isoToJalali(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return null;
  return toJalaali(Number(match[1]),Number(match[2]),Number(match[3]));
}
function jalaliToIso(jy,jm,jd){
  const g=toGregorian(jy,jm,jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
function todayJalali(){const now=new Date();return toJalaali(now.getFullYear(),now.getMonth()+1,now.getDate())}
function labelFor(value){
  const j=isoToJalali(value);
  if(!j)return 'انتخاب تاریخ شمسی';
  return `${fa(j.jy)}/${fa(pad(j.jm))}/${fa(pad(j.jd))}`;
}
function longLabel(value){
  const j=isoToJalali(value);
  if(!j)return 'تاریخی انتخاب نشده است';
  const g=toGregorian(j.jy,j.jm,j.jd);
  const date=new Date(g.gy,g.gm-1,g.gd);
  const weekday=new Intl.DateTimeFormat('fa-IR',{weekday:'long'}).format(date);
  return `${weekday}، ${fa(j.jd)} ${MONTHS[j.jm-1]} ${fa(j.jy)}`;
}

function addStyles(){
  if(document.getElementById('salamatJalaliCalendarStyles'))return;
  const style=document.createElement('style');
  style.id='salamatJalaliCalendarStyles';
  style.textContent=`
.sev4-date-box{display:block!important}.sev4-date-box>.sev4-input[type="hidden"],.sev4-date-box>[data-sev4-picker]{display:none!important}
.sjal-trigger{width:100%;min-height:54px;padding:9px 13px;border:1px solid #d8e4de;border-radius:13px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:right;color:#263a30;font:inherit;cursor:pointer;transition:.16s ease}
.sjal-trigger:hover,.sjal-trigger[aria-expanded="true"]{border-color:#15945a;box-shadow:0 0 0 3px #e0f5e9}.sjal-trigger-text{display:grid;gap:3px}.sjal-trigger-text strong{font-size:11px}.sjal-trigger-text small{font-size:8px;color:#7a8981}.sjal-trigger-icon{width:34px;height:34px;border-radius:10px;background:#e8f6ee;color:#087a45;display:grid;place-items:center;font-size:16px;font-weight:900}
.sjal-popover{position:fixed;z-index:2147483000;width:min(330px,calc(100vw - 24px));padding:12px;border:1px solid #d7e6de;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(22,69,45,.22);direction:rtl}
.sjal-popover[hidden]{display:none!important}.sjal-head{display:grid;grid-template-columns:38px 1fr 38px;gap:8px;align-items:center;margin-bottom:10px}.sjal-head button{height:36px;border:0;border-radius:10px;background:#edf8f2;color:#08743f;font-size:17px}.sjal-title{text-align:center}.sjal-title strong{display:block;font-size:12px}.sjal-title small{display:block;margin-top:2px;color:#7a8981;font-size:8px}.sjal-week,.sjal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.sjal-week{margin-bottom:5px}.sjal-week span{text-align:center;color:#829087;font-size:8px;font-weight:900}.sjal-day{height:36px;border:0;border-radius:10px;background:transparent;color:#2e4338;font-size:9px;font-weight:800}.sjal-day:hover{background:#edf8f2;color:#08743f}.sjal-day.today{box-shadow:inset 0 0 0 1px #79b998}.sjal-day.selected{background:#087a45!important;color:#fff!important;box-shadow:0 7px 16px rgba(8,122,69,.2)}.sjal-day.blank{visibility:hidden}.sjal-foot{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #edf2ef}.sjal-foot button{border:0;border-radius:10px;padding:8px 11px;background:#f4f8f6;color:#53665c;font:inherit;font-size:8px;font-weight:900}.sjal-foot button.primary{background:#e6f5ec;color:#08743f}
@media(max-width:520px){.sjal-popover{width:calc(100vw - 20px)}.sjal-day{height:34px}}
`;
  (document.head||document.documentElement).appendChild(style);
}

function calendar(){
  let node=document.getElementById('salamatJalaliCalendar');
  if(node)return node;
  node=document.createElement('section');
  node.id='salamatJalaliCalendar';
  node.className='sjal-popover';
  node.hidden=true;
  node.setAttribute('role','dialog');
  node.setAttribute('aria-label','تقویم شمسی');
  document.body.appendChild(node);
  return node;
}
function positionCalendar(){
  if(!active)return;
  const pop=calendar();
  const rect=active.trigger.getBoundingClientRect();
  const width=Math.min(330,window.innerWidth-24);
  let right=Math.max(12,window.innerWidth-rect.right);
  if(right+width>window.innerWidth-12)right=12;
  pop.style.width=`${width}px`;
  pop.style.right=`${right}px`;
  pop.style.left='auto';
  pop.style.top='0px';
  const estimated=390;
  const below=window.innerHeight-rect.bottom;
  const top=below>=estimated+12?rect.bottom+8:Math.max(8,rect.top-estimated-8);
  pop.style.top=`${top}px`;
}
function closeCalendar(){
  if(!active)return;
  active.trigger.setAttribute('aria-expanded','false');
  calendar().hidden=true;
  active=null;
}
function shiftMonth(delta){
  if(!active)return;
  let month=active.viewMonth+delta;
  let year=active.viewYear;
  if(month<1){month=12;year-=1}
  if(month>12){month=1;year+=1}
  active.viewYear=year;active.viewMonth=month;renderCalendar();
}
function selectIso(value){
  if(!active)return;
  const {input,trigger}=active;
  input.value=value;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  updateTrigger(input,trigger);
  closeCalendar();
}
function renderCalendar(){
  if(!active)return;
  const pop=calendar();
  const {viewYear,viewMonth,input}=active;
  const first=toGregorian(viewYear,viewMonth,1);
  const weekIndex=(new Date(first.gy,first.gm-1,first.gd).getDay()+1)%7;
  const length=monthLength(viewYear,viewMonth);
  const selected=isoToJalali(input.value);
  const today=todayJalali();
  const cells=[];
  for(let i=0;i<weekIndex;i+=1)cells.push('<span class="sjal-day blank"></span>');
  for(let day=1;day<=length;day+=1){
    const isSelected=selected&&selected.jy===viewYear&&selected.jm===viewMonth&&selected.jd===day;
    const isToday=today.jy===viewYear&&today.jm===viewMonth&&today.jd===day;
    cells.push(`<button type="button" class="sjal-day${isSelected?' selected':''}${isToday?' today':''}" data-sjal-day="${day}">${fa(day)}</button>`);
  }
  pop.innerHTML=`<div class="sjal-head"><button type="button" data-sjal-next aria-label="ماه بعد">‹</button><div class="sjal-title"><strong>${MONTHS[viewMonth-1]} ${fa(viewYear)}</strong><small>تقویم رسمی هجری شمسی</small></div><button type="button" data-sjal-prev aria-label="ماه قبل">›</button></div><div class="sjal-week">${WEEKDAYS.map(day=>`<span>${day}</span>`).join('')}</div><div class="sjal-grid">${cells.join('')}</div><div class="sjal-foot"><button type="button" data-sjal-close>بستن</button><button type="button" class="primary" data-sjal-today>امروز</button></div>`;
  positionCalendar();
}
function openCalendar(input,trigger){
  const chosen=isoToJalali(input.value)||todayJalali();
  if(active&&active.input===input){closeCalendar();return}
  closeCalendar();
  active={input,trigger,viewYear:chosen.jy,viewMonth:chosen.jm};
  trigger.setAttribute('aria-expanded','true');
  const pop=calendar();
  pop.hidden=false;
  renderCalendar();
}
function updateTrigger(input,trigger){
  const strong=trigger.querySelector('strong');
  const small=trigger.querySelector('small');
  if(strong)strong.textContent=labelFor(input.value);
  if(small)small.textContent=longLabel(input.value);
}
function enhanceInput(input){
  if(!input||input.dataset.jalaliEnhanced==='1')return;
  input.dataset.jalaliEnhanced='1';
  input.type='hidden';
  const oldButton=input.parentElement?.querySelector('[data-sev4-picker]');
  if(oldButton)oldButton.hidden=true;
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='sjal-trigger';
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span class="sjal-trigger-text"><strong></strong><small></small></span><span class="sjal-trigger-icon">▣</span>';
  input.parentElement?.insertBefore(trigger,input);
  updateTrigger(input,trigger);
  trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openCalendar(input,trigger)});
}
function enhanceModal(){
  addStyles();
  enhanceInput(document.getElementById('sev4StartDate'));
  enhanceInput(document.getElementById('sev4EndDate'));
}
function stopWatching(){
  observer?.disconnect();observer=null;clearTimeout(observerTimer);observerTimer=0;
}
function watchModal(){
  stopWatching();
  const target=document.getElementById('content')||document.body;
  observer=new MutationObserver(()=>{
    if(document.getElementById('sev4PeriodModal'))enhanceModal();
    else if(!document.getElementById('sev4NewPeriod')){closeCalendar();stopWatching()}
  });
  observer.observe(target,{childList:true,subtree:true});
  observerTimer=setTimeout(stopWatching,15000);
  requestAnimationFrame(enhanceModal);
}

addStyles();
document.addEventListener('click',event=>{
  const pop=calendar();
  const day=event.target?.closest?.('[data-sjal-day]');
  if(day&&active){event.preventDefault();event.stopPropagation();selectIso(jalaliToIso(active.viewYear,active.viewMonth,Number(day.dataset.sjalDay)));return}
  if(event.target?.closest?.('[data-sjal-prev]')){event.preventDefault();event.stopPropagation();shiftMonth(-1);return}
  if(event.target?.closest?.('[data-sjal-next]')){event.preventDefault();event.stopPropagation();shiftMonth(1);return}
  if(event.target?.closest?.('[data-sjal-today]')){event.preventDefault();event.stopPropagation();const today=todayJalali();selectIso(jalaliToIso(today.jy,today.jm,today.jd));return}
  if(event.target?.closest?.('[data-sjal-close]')){event.preventDefault();event.stopPropagation();closeCalendar();return}
  if(event.target?.closest?.('#sev4NewPeriod')){watchModal();setTimeout(enhanceModal,0);return}
  if(event.target?.closest?.('#sev4ClosePeriod,#sev4CancelPeriod')||event.target?.id==='sev4PeriodModal'){closeCalendar();stopWatching();return}
  if(active&&!pop.contains(event.target)&&!active.trigger.contains(event.target))closeCalendar();
},true);
document.addEventListener('submit',event=>{if(event.target?.id==='sev4PeriodForm')watchModal()},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCalendar()},true);
window.addEventListener('resize',positionCalendar);
window.addEventListener('scroll',positionCalendar,true);

window.SalamatJalaliCalendar={enhance:enhanceModal,open:openCalendar,close:closeCalendar,toJalaali,toGregorian,jalaliToIso,isoToJalali};
})();
