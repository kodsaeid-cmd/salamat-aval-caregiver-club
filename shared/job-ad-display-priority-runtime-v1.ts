const TARGET_FORM='form.ja-admin-editor,form.maj-v4-form';
const DEFAULT_PRIORITY=50;
let lastDetailPriority=DEFAULT_PRIORITY;

function clampPriority(value:unknown){const n=Math.trunc(Number(value));return Number.isFinite(n)?Math.max(1,Math.min(100,n)):DEFAULT_PRIORITY}
function activeForm(){return [...document.querySelectorAll<HTMLFormElement>(TARGET_FORM)].find(form=>form.offsetParent!==null)||document.querySelector<HTMLFormElement>(TARGET_FORM)}
function currentPriority(form:HTMLFormElement){return clampPriority(form.querySelector<HTMLInputElement>('input[name="caregiverDisplayPriority"]')?.value)}
function isCreate(form:HTMLFormElement){return Boolean(form.querySelector<HTMLInputElement>('input[name="publishNow"]'))}

function injectStyle(){if(document.getElementById('sal-job-display-priority-style'))return;const style=document.createElement('style');style.id='sal-job-display-priority-style';style.textContent=`
.sal-job-display-priority{grid-column:1/-1;border:1px solid #d7e7df;border-radius:17px;padding:13px 14px;background:#fbfdfc;display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:9px 14px;align-items:end}.sal-job-display-priority>span{font-size:11px;font-weight:950;color:#27483a}.sal-job-display-priority input{width:100%;min-height:43px;border:1px solid #cadbd2;border-radius:12px;padding:8px 12px;background:#fff;color:#173d2d;font-size:12px;font-weight:900;text-align:center}.sal-job-display-priority small{grid-column:1/-1;color:#718178;font-size:8.5px;line-height:1.8}.sal-job-display-priority b{color:#087443}@media(max-width:899px){.sal-job-display-priority{grid-template-columns:1fr 104px;padding:12px;border-radius:15px}.sal-job-display-priority input{min-height:42px}}
`;document.head.appendChild(style)}

function ensurePriorityField(form:HTMLFormElement){if(form.querySelector('[data-sal-job-display-priority]'))return;injectStyle();const label=document.createElement('label');label.className='sal-job-display-priority';label.setAttribute('data-sal-job-display-priority','1');const initial=isCreate(form)?DEFAULT_PRIORITY:lastDetailPriority;label.innerHTML=`<span>اولویت نمایش برای مراقبین</span><input type="number" name="caregiverDisplayPriority" min="1" max="100" step="1" value="${clampPriority(initial)}" required><small>عدد <b>۱۰۰</b> زودتر و عدد <b>۱</b> دیرتر نمایش داده می‌شود. این مقدار فقط ابزار داخلی مدیر سامانه است و برای مراقب ارسال یا نمایش داده نمی‌شود.</small>`;const gender=form.querySelector('[data-sal-job-gender]'),weekdays=form.querySelector('[data-sal-job-weekdays]'),description=form.querySelector('textarea[name="description"]')?.closest('label'),grid=form.querySelector('.ja-form-grid,.ma-form,.maj-v4-form')||form;if(gender)gender.insertAdjacentElement('afterend',label);else if(weekdays)weekdays.insertAdjacentElement('afterend',label);else if(description)description.insertAdjacentElement('beforebegin',label);else grid.appendChild(label)}
function scan(){document.querySelectorAll<HTMLFormElement>(TARGET_FORM).forEach(ensurePriorityField)}
scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});

const nativeFetch=window.fetch.bind(window);
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const rawUrl=typeof input==='string'?input:input instanceof URL?input.toString():input.url,url=new URL(rawUrl,location.origin),method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if((method==='POST'||method==='PATCH')&&url.origin===location.origin&&(/^\/api\/staff\/job-ads(?:\/[^/]+)?$/).test(url.pathname)){
  try{const raw=typeof init?.body==='string'?init.body:input instanceof Request?await input.clone().text():'',body=raw?JSON.parse(raw):null,form=activeForm();if(body&&form){body.caregiverDisplayPriority=currentPriority(form);const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('content-type','application/json');init={...init,headers,body:JSON.stringify(body)}}}catch{}
 }
 const response=await nativeFetch(input as any,init);
 if(method==='GET'&&url.origin===location.origin&&/^\/api\/staff\/job-ads\/[^/]+$/.test(url.pathname)&&response.ok){try{const payload:any=await response.clone().json();lastDetailPriority=clampPriority(payload?.data?.ad?.caregiverDisplayPriority);queueMicrotask(scan)}catch{}}
 return response;
};

export {};
