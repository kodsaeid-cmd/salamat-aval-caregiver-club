import {applyJobAdWeekdayScore,DEFAULT_JOB_AD_WEEKDAYS,JOB_AD_WEEKDAYS,jobAdWeekdayScoreFactor,jobAdWeekdaysOrDefault,normalizeJobAdWeekdays} from "./job-ad-weekday-policy-v1";

const TARGET_FORM='form.ja-admin-editor,form.maj-v4-form';
type Rule={label:string;normal:number;temporary:number};
const RULES:Record<string,Record<string,Rule>>={
 ELDERLY:{HEALTHY:{label:"سالم",normal:80,temporary:3},WALKER:{label:"واکری",normal:90,temporary:4},DIAPER:{label:"پوشکی",normal:130,temporary:8},BEDPAN:{label:"لگنی",normal:150,temporary:10},GAVAGE:{label:"گاواژ",normal:160,temporary:11},PARKINSON:{label:"پارکینسون",normal:170,temporary:12},ALZHEIMER:{label:"آلزایمر",normal:200,temporary:15}},
 CHILD:{MOTHER_ASSISTANT:{label:"مادریار",normal:120,temporary:7},CHILD_CARE:{label:"کودکیار",normal:140,temporary:9}},
 HOUSEKEEPING:{HOUSEHOLD:{label:"امور منزل",normal:110,temporary:6}},
};
const fa=(value:number)=>Number(value||0).toLocaleString("fa-IR",{maximumFractionDigits:1});
const digits=(value:unknown)=>String(value??"").replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^0-9]/g,"");
let lastDetailWeekdays=[...DEFAULT_JOB_AD_WEEKDAYS] as string[];

function injectStyle(){if(document.getElementById("sal-job-weekdays-style"))return;const style=document.createElement("style");style.id="sal-job-weekdays-style";style.textContent=`
.sal-job-weekdays{grid-column:1/-1;border:1px solid #d7e7df;border-radius:17px;padding:13px 14px;background:#fbfdfc;display:grid;gap:9px}.sal-job-weekdays-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.sal-job-weekdays-head strong{font-size:11px;color:#27483a}.sal-job-weekdays-head small{font-size:8.5px;color:#718178;line-height:1.8;text-align:left}.sal-job-weekday-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.sal-job-weekday{position:relative;min-width:0}.sal-job-weekday input{position:absolute;opacity:0;pointer-events:none}.sal-job-weekday span{min-height:38px;border:1px solid #dce6e1;border-radius:11px;background:#fff;color:#52665b;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;cursor:pointer;transition:.15s ease}.sal-job-weekday input:checked+span{border-color:#168c4b;background:#eaf7f0;color:#087443;box-shadow:inset 0 0 0 1px #168c4b}.sal-job-weekdays-note{font-size:8.8px;color:#6e7e75;line-height:1.9}.sal-job-weekdays-note b{color:#087443}.sal-job-weekdays.invalid{border-color:#df6d6d;background:#fff8f8}.sal-job-weekdays.invalid .sal-job-weekdays-note{color:#b42323}
@media(max-width:899px){.sal-job-weekdays{padding:12px;border-radius:15px}.sal-job-weekday-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.sal-job-weekday span{min-height:40px;font-size:9.5px}.sal-job-weekdays-head{display:grid}.sal-job-weekdays-head small{text-align:right}}
`;document.head.appendChild(style)}

function automaticBase(form:HTMLFormElement){
 const type=String(form.querySelector<HTMLSelectElement>('select[name="contractType"]')?.value||"").toUpperCase(),shift=String(form.querySelector<HTMLSelectElement>('select[name="shiftType"]')?.value||"").toUpperCase(),duration=Math.max(0,Number(digits(form.querySelector<HTMLInputElement>('[name="durationDays"]')?.value||""))||0);
 if(!duration)return null;
 if(type==="PATIENT"){const points=Math.max(1,Math.round(130*duration/180));return{points,basis:180,base:130,label:"بیمار"}}
 const condition=String(form.querySelector<HTMLSelectElement>('[data-sal-job-condition]')?.value||form.querySelector<HTMLSelectElement>('select[name="recipientCondition"]')?.value||"").toUpperCase(),rule=RULES[type]?.[condition];if(!rule)return null;
 const temporary=shift==="TEMPORARY",basis=temporary?10:180,base=temporary?rule.temporary:rule.normal,points=Math.max(1,Math.round(base*duration/basis));return{points,basis,base,label:rule.label};
}
function selectedWeekdays(form:HTMLFormElement){return normalizeJobAdWeekdays([...form.querySelectorAll<HTMLInputElement>('input[data-sal-job-weekday]:checked')].map(input=>input.value))}
function activeForm(){return [...document.querySelectorAll<HTMLFormElement>(TARGET_FORM)].find(form=>form.offsetParent!==null)||document.querySelector<HTMLFormElement>(TARGET_FORM)}
function initialFor(form:HTMLFormElement){return form.querySelector<HTMLInputElement>('input[name="publishNow"]')?[...DEFAULT_JOB_AD_WEEKDAYS]:jobAdWeekdaysOrDefault(lastDetailWeekdays)}

function ensureWeekdayField(form:HTMLFormElement){
 if(form.querySelector('[data-sal-job-weekdays]'))return;
 injectStyle();const selected=new Set(initialFor(form));
 const box=document.createElement("div");box.className="sal-job-weekdays";box.setAttribute("data-sal-job-weekdays","1");
 box.innerHTML=`<div class="sal-job-weekdays-head"><strong>روزهای کاری هفته</strong><small>مبنای امتیاز کامل: شنبه تا پنجشنبه</small></div><div class="sal-job-weekday-grid">${JOB_AD_WEEKDAYS.map(day=>`<label class="sal-job-weekday"><input type="checkbox" name="workWeekdays" data-sal-job-weekday value="${day.key}" ${selected.has(day.key)?"checked":""}><span>${day.label}</span></label>`).join("")}</div><div class="sal-job-weekdays-note" data-sal-job-weekdays-note>جمعه قابل انتخاب است اما امتیاز را بالاتر از سقف ۶ روزه نمی‌برد.</div>`;
 const duration=form.querySelector<HTMLInputElement>('[name="durationDays"]'),anchor=duration?.closest("label"),grid=form.querySelector(".ja-form-grid,.ma-form,.maj-v4-form")||form;
 if(anchor)anchor.insertAdjacentElement("afterend",box);else grid.appendChild(box);
 box.addEventListener("change",()=>schedule(form));
}

function refresh(form:HTMLFormElement){
 ensureWeekdayField(form);const days=selectedWeekdays(form),box=form.querySelector<HTMLElement>('[data-sal-job-weekdays]'),note=form.querySelector<HTMLElement>('[data-sal-job-weekdays-note]'),card=form.querySelector<HTMLElement>('[data-sal-job-points-card]'),hidden=form.querySelector<HTMLInputElement>('[data-sal-job-points-hidden]');
 if(!box)return;if(!days.length){box.classList.add("invalid");if(note)note.textContent="حداقل یک روز کاری را انتخاب کنید.";if(hidden)hidden.value="0";if(card){card.dataset.ready="0";const strong=card.querySelector<HTMLElement>("strong"),small=card.querySelector<HTMLElement>("small");if(strong)strong.textContent="روز کاری انتخاب نشده";if(small)small.textContent="برای محاسبه امتیاز حداقل یک روز هفته را انتخاب کنید."}return}
 box.classList.remove("invalid");const factor=jobAdWeekdayScoreFactor(days),effectiveDays=6-(6-Math.min(6,days.length))/2;if(note)note.innerHTML=`${fa(days.length)} روز انتخاب شده • ضریب امتیاز <b>${fa(factor*100)}٪</b> • معادل ${fa(effectiveDays)} روز از مبنای ۶ روزه`;
 const automatic=automaticBase(form);if(!automatic||!card||!hidden)return;const autoAdjusted=applyJobAdWeekdayScore(automatic.points,days),specialToggle=form.querySelector<HTMLInputElement>('[data-sal-job-special-toggle]'),specialInput=form.querySelector<HTMLInputElement>('[data-sal-job-special-value]'),specialOn=Boolean(specialToggle?.checked&&Number(specialInput?.value||0)>0),finalPoints=specialOn?Math.trunc(Number(specialInput?.value||0)):autoAdjusted;
 hidden.value=String(finalPoints);card.dataset.ready=finalPoints>0?"1":"0";card.dataset.points=String(finalPoints);const strong=card.querySelector<HTMLElement>("strong"),small=card.querySelector<HTMLElement>("small");if(strong)strong.textContent=`${fa(finalPoints)} امتیاز`;if(small)small.textContent=specialOn?`امتیاز ویژه مدیر سامانه فعال است؛ امتیاز خودکار با ${fa(days.length)} روز کاری ${fa(autoAdjusted)} امتیاز است.`:`${automatic.label} • امتیاز پایه فعلی ${fa(automatic.points)} • ${fa(days.length)} روز هفته • ضریب ${fa(factor*100)}٪ • امتیاز نهایی ${fa(autoAdjusted)}`;
}

const pending=new WeakMap<HTMLFormElement,number>();
function schedule(form:HTMLFormElement){const old=pending.get(form);if(old)cancelAnimationFrame(old);const one=requestAnimationFrame(()=>{const two=requestAnimationFrame(()=>{const three=requestAnimationFrame(()=>{pending.delete(form);refresh(form)});pending.set(form,three)});pending.set(form,two)});pending.set(form,one)}
function scan(){document.querySelectorAll<HTMLFormElement>(TARGET_FORM).forEach(form=>{ensureWeekdayField(form);schedule(form)})}

document.addEventListener("input",event=>{const form=(event.target as HTMLElement|null)?.closest?.(TARGET_FORM) as HTMLFormElement|null;if(form)schedule(form)},true);
document.addEventListener("change",event=>{const form=(event.target as HTMLElement|null)?.closest?.(TARGET_FORM) as HTMLFormElement|null;if(form)schedule(form)},true);
scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});

const nativeFetch=window.fetch.bind(window);
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const rawUrl=typeof input==="string"?input:input instanceof URL?input.toString():input.url,url=new URL(rawUrl,location.origin),method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();
 if((method==="POST"||method==="PATCH")&&url.origin===location.origin&&(/^\/api\/staff\/job-ads(?:\/[^/]+)?$/).test(url.pathname)){
  try{const raw=typeof init?.body==="string"?init.body:input instanceof Request?await input.clone().text():"",body=raw?JSON.parse(raw):null,form=activeForm();if(body&&form){const days=selectedWeekdays(form);body.workWeekdays=days;const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set("content-type","application/json");init={...init,headers,body:JSON.stringify(body)}}}catch{}
 }
 const response=await nativeFetch(input as any,init);
 if(method==="GET"&&url.origin===location.origin&&/^\/api\/staff\/job-ads\/[^/]+$/.test(url.pathname)&&response.ok){
  try{const payload:any=await response.clone().json();const days=normalizeJobAdWeekdays(payload?.data?.ad?.workWeekdays);if(days.length)lastDetailWeekdays=days}catch{}
 }
 return response;
};

export {};
