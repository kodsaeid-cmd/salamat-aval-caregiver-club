const TARGET_FORM='form.ja-admin-editor,form.maj-v4-form';
const GENDERS=[{value:'FEMALE',label:'زن'},{value:'MALE',label:'مرد'}] as const;
let lastDetailGender='';

function normalized(value:unknown){const raw=String(value??'').trim().toUpperCase();if(raw==='FEMALE'||raw==='WOMAN'||raw==='زن')return'FEMALE';if(raw==='MALE'||raw==='MAN'||raw==='مرد')return'MALE';return''}
function activeForm(){return [...document.querySelectorAll<HTMLFormElement>(TARGET_FORM)].find(form=>form.offsetParent!==null)||document.querySelector<HTMLFormElement>(TARGET_FORM)}
function selectedGender(form:HTMLFormElement){return normalized(form.querySelector<HTMLInputElement>('input[name="caregiverGender"]:checked')?.value)}
function isCreate(form:HTMLFormElement){return Boolean(form.querySelector<HTMLInputElement>('input[name="publishNow"]'))}

function injectStyle(){if(document.getElementById('sal-job-gender-style'))return;const style=document.createElement('style');style.id='sal-job-gender-style';style.textContent=`
.sal-job-gender{grid-column:1/-1;border:1px solid #d7e7df;border-radius:17px;padding:13px 14px;background:#fbfdfc;display:grid;gap:10px}.sal-job-gender-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.sal-job-gender-head strong{font-size:11px;color:#27483a}.sal-job-gender-head small{font-size:8.5px;color:#718178}.sal-job-gender-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sal-job-gender-option{position:relative}.sal-job-gender-option input{position:absolute;opacity:0;pointer-events:none}.sal-job-gender-option span{min-height:43px;border:1px solid #dce6e1;border-radius:12px;background:#fff;color:#52665b;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-weight:950;cursor:pointer;transition:.15s ease}.sal-job-gender-option span:before{content:'○';font-size:13px;color:#9aaba2}.sal-job-gender-option input:checked+span{border-color:#168c4b;background:#eaf7f0;color:#087443;box-shadow:inset 0 0 0 1px #168c4b}.sal-job-gender-option input:checked+span:before{content:'●';color:#168c4b}.sal-job-gender-note{font-size:8.5px;line-height:1.8;color:#728279}.sal-job-gender.invalid{border-color:#df6d6d;background:#fff8f8}.sal-job-gender.invalid .sal-job-gender-note{color:#b42323;font-weight:850}
@media(max-width:899px){.sal-job-gender{padding:12px;border-radius:15px}.sal-job-gender-option span{min-height:42px;font-size:10px}.sal-job-gender-head{align-items:flex-start}.sal-job-gender-head small{text-align:left}}
`;document.head.appendChild(style)}

function initialGender(form:HTMLFormElement){if(isCreate(form))return'';return normalized(lastDetailGender)}
function refresh(form:HTMLFormElement){const box=form.querySelector<HTMLElement>('[data-sal-job-gender]'),note=form.querySelector<HTMLElement>('[data-sal-job-gender-note]'),gender=selectedGender(form);if(!box)return;box.classList.toggle('invalid',isCreate(form)&&!gender);if(note)note.textContent=gender?`مراقب موردنیاز این آگهی: ${gender==='FEMALE'?'زن':'مرد'}`:'برای آگهی جدید، انتخاب جنسیت مراقب موردنیاز الزامی است.'}
function ensureGenderField(form:HTMLFormElement){if(form.querySelector('[data-sal-job-gender]')){refresh(form);return}injectStyle();const initial=initialGender(form),box=document.createElement('div');box.className='sal-job-gender';box.setAttribute('data-sal-job-gender','1');box.innerHTML=`<div class="sal-job-gender-head"><strong>جنسیت مراقب موردنیاز</strong><small>یکی را انتخاب کنید</small></div><div class="sal-job-gender-options">${GENDERS.map(g=>`<label class="sal-job-gender-option"><input type="radio" name="caregiverGender" value="${g.value}" ${initial===g.value?'checked':''} ${isCreate(form)?'required':''}><span>${g.label}</span></label>`).join('')}</div><div class="sal-job-gender-note" data-sal-job-gender-note></div>`;const weekdays=form.querySelector('[data-sal-job-weekdays]'),description=form.querySelector('textarea[name="description"]')?.closest('label'),grid=form.querySelector('.ja-form-grid,.ma-form,.maj-v4-form')||form;if(weekdays)weekdays.insertAdjacentElement('afterend',box);else if(description)description.insertAdjacentElement('beforebegin',box);else grid.appendChild(box);box.addEventListener('change',()=>refresh(form));refresh(form)}
function scan(){document.querySelectorAll<HTMLFormElement>(TARGET_FORM).forEach(ensureGenderField)}
scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});

const nativeFetch=window.fetch.bind(window);
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const rawUrl=typeof input==='string'?input:input instanceof URL?input.toString():input.url,url=new URL(rawUrl,location.origin),method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if((method==='POST'||method==='PATCH')&&url.origin===location.origin&&(/^\/api\/staff\/job-ads(?:\/[^/]+)?$/).test(url.pathname)){
  try{const raw=typeof init?.body==='string'?init.body:input instanceof Request?await input.clone().text():'',body=raw?JSON.parse(raw):null,form=activeForm();if(body&&form){const gender=selectedGender(form);if(gender)body.caregiverGender=gender;const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('content-type','application/json');init={...init,headers,body:JSON.stringify(body)}}}catch{}
 }
 const response=await nativeFetch(input as any,init);
 if(method==='GET'&&url.origin===location.origin&&/^\/api\/staff\/job-ads\/[^/]+$/.test(url.pathname)&&response.ok){try{const payload:any=await response.clone().json();lastDetailGender=normalized(payload?.data?.ad?.caregiverGender);queueMicrotask(scan)}catch{}}
 return response;
};

export {};
