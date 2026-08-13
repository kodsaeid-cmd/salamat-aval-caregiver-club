const TARGET_FORM='form.ja-admin-editor,form.maj-v4-form';
const fa=(value:number)=>Number(value||0).toLocaleString('fa-IR');
const digits=(value:unknown)=>String(value??'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g,'');
const patientPoints=(duration:unknown)=>Math.max(1,Math.round(130*Math.max(1,Number(digits(duration))||1)/180));
const setText=(node:HTMLElement|null,value:string)=>{if(node&&node.textContent!==value)node.textContent=value};

function visiblePatientForm(){return [...document.querySelectorAll<HTMLFormElement>(TARGET_FORM)].find(form=>form.offsetParent!==null&&form.querySelector<HTMLSelectElement>('select[name="contractType"]')?.value==='PATIENT')||null}
function patchPatientForm(form:HTMLFormElement){
 const type=form.querySelector<HTMLSelectElement>('select[name="contractType"]');if(type?.value!=='PATIENT')return;
 const duration=form.querySelector<HTMLInputElement>('[name="durationDays"]'),condition=form.querySelector<HTMLSelectElement>('[data-sal-job-condition]');
 if(condition){
  if(condition.options.length!==1||condition.options[0]?.value!=='PATIENT'){condition.innerHTML='';const option=document.createElement('option');option.value='PATIENT';option.textContent='بیمار';condition.appendChild(option)}
  condition.value='PATIENT';condition.disabled=true;
 }
 setText(form.querySelector<HTMLElement>('.sal-job-condition-help'),'برای قرارداد بیمار، شرایط خدمت‌گیرنده ثابت «بیمار» است و انتخاب جداگانه‌ای ندارد.');
 const auto=patientPoints(duration?.value),specialToggle=form.querySelector<HTMLInputElement>('[data-sal-job-special-toggle]'),specialInput=form.querySelector<HTMLInputElement>('[data-sal-job-special-value]'),specialOn=Boolean(specialToggle?.checked&&Number(specialInput?.value||0)>0),finalPoints=specialOn?Math.trunc(Number(specialInput?.value||0)):auto;
 const hidden=form.querySelector<HTMLInputElement>('[data-sal-job-points-hidden]');if(hidden&&hidden.value!==String(finalPoints))hidden.value=String(finalPoints);
 const card=form.querySelector<HTMLElement>('[data-sal-job-points-card]');if(card){card.dataset.ready='1';card.dataset.points=String(finalPoints);const title=card.querySelector<HTMLElement>('strong'),small=card.querySelector<HTMLElement>('small');setText(title,`${fa(finalPoints)} امتیاز`);setText(small,specialOn?`امتیاز ویژه مدیر سامانه فعال است؛ امتیاز خودکار بیمار ${fa(auto)} امتیاز است.`:`بیمار • پایه ${fa(130)} امتیاز برای ${fa(180)} روز • مدت فعلی ${fa(Number(digits(duration?.value||'0')))} روز`);}
}
function scan(){document.querySelectorAll<HTMLFormElement>(TARGET_FORM).forEach(patchPatientForm)}
let scheduled=false;
function afterRuntime(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{scheduled=false;scan()}))}

document.addEventListener('input',afterRuntime,true);document.addEventListener('change',afterRuntime,true);
scan();new MutationObserver(afterRuntime).observe(document.documentElement,{childList:true,subtree:true});

const nativeFetch=window.fetch.bind(window);
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url,method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if((method==='POST'||method==='PATCH')&&/\/api\/staff\/job-ads(?:\/[^/]+)?(?:\?.*)?$/.test(url)){
  try{
   const raw=typeof init?.body==='string'?init.body:input instanceof Request?await input.clone().text():'',body=raw?JSON.parse(raw):null;
   if(body&&String(body.contractType||'').toUpperCase()==='PATIENT'){
    const form=visiblePatientForm(),specialToggle=form?.querySelector<HTMLInputElement>('[data-sal-job-special-toggle]'),specialInput=form?.querySelector<HTMLInputElement>('[data-sal-job-special-value]'),specialOn=Boolean(specialToggle?.checked&&Number(specialInput?.value||0)>0),auto=patientPoints(body.durationDays);
    const next={...body,recipientCondition:'PATIENT',contractPoints:auto,specialPointsEnabled:specialOn,specialContractPoints:specialOn?Math.trunc(Number(specialInput?.value||0)):0};
    const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('content-type','application/json');init={...init,headers,body:JSON.stringify(next)};
   }
  }catch{}
 }
 return nativeFetch(input as any,init);
};

export {};
