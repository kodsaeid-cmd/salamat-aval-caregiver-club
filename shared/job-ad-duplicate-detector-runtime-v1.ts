const DUP_FORM_SELECTOR='form.ja-admin-editor,form.maj-v4-form';
const DUP_PANEL_CLASS='jad-duplicate-detector-v1';
const DUP_MATCH_THRESHOLD=40;
const DUP_DEBOUNCE_MS=550;
const CACHE_TTL_MS=120000;

type JobAdRow=Record<string,any>;
type MatchRow={ad:JobAdRow;score:number};
type FormState={panel:HTMLElement;timer:number|null;serial:number;matches:MatchRow[];lastConsultantId:string};
type CacheEntry={at:number;ads:JobAdRow[]};

const states=new WeakMap<HTMLFormElement,FormState>();
const consultantCache=new Map<string,CacheEntry>();

function normalizeDigits(value:string){
 return value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}
function normalizeText(value:unknown){
 return normalizeDigits(String(value??''))
  .replace(/ي/g,'ی').replace(/ك/g,'ک')
  .toLowerCase().replace(/[\u200c\u200f\u202a-\u202e]/g,' ')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
function toNumber(value:unknown){
 const clean=normalizeDigits(String(value??'')).replace(/[,٬،\s]/g,'').replace(/[^0-9.-]/g,'');
 const n=Number(clean);return Number.isFinite(n)?n:0;
}
function textSimilarity(a:unknown,b:unknown){
 const x=normalizeText(a),y=normalizeText(b);if(!x||!y)return 0;if(x===y)return 1;
 const xs=new Set(x.split(' ').filter(Boolean)),ys=new Set(y.split(' ').filter(Boolean));
 let inter=0;xs.forEach(t=>{if(ys.has(t))inter+=1});
 const union=new Set([...xs,...ys]).size||1;const jac=inter/union;
 const contain=x.length>=4&&y.length>=4&&(x.includes(y)||y.includes(x))?0.84:0;
 return Math.max(jac,contain);
}
function exactSimilarity(a:unknown,b:unknown){const x=normalizeText(a),y=normalizeText(b);return x&&y&&x===y?1:0}
function numericSimilarity(a:unknown,b:unknown){
 const x=toNumber(a),y=toNumber(b);if(x<=0||y<=0)return 0;return Math.max(0,1-Math.abs(x-y)/Math.max(x,y));
}
function fieldValue(form:HTMLFormElement,name:string){return new FormData(form).get(name)}
function hasMeaningfulDraft(form:HTMLFormElement){
 return ['customerFullName','city','region','description'].some(name=>normalizeText(fieldValue(form,name)).length>=2);
}
function scoreAd(form:HTMLFormElement,ad:JobAdRow){
 const specs:Array<{name:string;adKey:string;weight:number;kind:'text'|'exact'|'number'}>=[
  {name:'customerFullName',adKey:'customerFullName',weight:20,kind:'text'},
  {name:'city',adKey:'city',weight:10,kind:'text'},
  {name:'region',adKey:'region',weight:12,kind:'text'},
  {name:'contractType',adKey:'contractType',weight:14,kind:'exact'},
  {name:'shiftType',adKey:'shiftType',weight:12,kind:'exact'},
  {name:'recipientCondition',adKey:'recipientCondition',weight:8,kind:'exact'},
  {name:'caregiverSalaryRial',adKey:'caregiverSalaryRial',weight:7,kind:'number'},
  {name:'durationDays',adKey:'durationDays',weight:6,kind:'number'},
  {name:'description',adKey:'description',weight:11,kind:'text'},
 ];
 let weighted=0,total=0;
 for(const spec of specs){
  const draft=fieldValue(form,spec.name);const present=spec.kind==='number'?toNumber(draft)>0:normalizeText(draft).length>0;
  if(!present)continue;total+=spec.weight;
  const candidate=ad?.[spec.adKey];
  const sim=spec.kind==='number'?numericSimilarity(draft,candidate):spec.kind==='exact'?exactSimilarity(draft,candidate):textSimilarity(draft,candidate);
  weighted+=spec.weight*sim;
 }
 return total?Math.round((weighted/total)*100):0;
}
function faNum(value:number){return value.toLocaleString('fa-IR')}
function statusLabel(value:unknown){
 const map:Record<string,string>={DRAFT:'در حال بررسی',PUBLISHED:'فعال',CLOSED:'منقضی',CONTRACT:'قرارداد'};
 const key=String(value??'').toUpperCase();return map[key]||String(value??'—');
}
function contractLabel(value:unknown){
 const map:Record<string,string>={ELDERLY:'سالمند',CHILD:'کودک',PATIENT:'بیمار',HOUSEKEEPING:'خدماتی'};return map[String(value??'')]||String(value??'—');
}
function shiftLabel(value:unknown){
 const map:Record<string,string>={DAY:'روزانه',NIGHT:'شبانه',LIVE_IN:'شبانه‌روزی',TEMPORARY:'مقطعی'};return map[String(value??'')]||String(value??'—');
}
function make(tag:string,className?:string,text?:string){
 const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;
}
function ensureStyle(){
 if(document.getElementById('jad-duplicate-detector-style-v1'))return;
 const style=document.createElement('style');style.id='jad-duplicate-detector-style-v1';style.textContent=`
 .${DUP_PANEL_CLASS}{grid-column:1/-1;direction:rtl;border:1px solid #dbe8e1;border-radius:18px;background:#f8fcfa;padding:14px 16px;margin:4px 0 8px;box-sizing:border-box;color:#173d2d;box-shadow:0 8px 24px rgba(20,77,50,.05)}
 .${DUP_PANEL_CLASS}.is-warning{border-color:#f2c7a5;background:#fffaf5}.jad-dup-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.jad-dup-title{display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px}.jad-dup-pulse{width:9px;height:9px;border-radius:50%;background:#16834b;box-shadow:0 0 0 5px rgba(22,131,75,.10);flex:0 0 auto}.is-warning .jad-dup-pulse{background:#e86b2a;box-shadow:0 0 0 5px rgba(232,107,42,.11)}
 .jad-dup-summary{margin-top:7px;color:#66776f;font-size:12px;line-height:1.9}.jad-dup-score{font-size:18px;font-weight:950;color:#b84d18}.jad-dup-actions{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}.jad-dup-btn{appearance:none;border:0;border-radius:12px;background:#167b46;color:#fff;padding:9px 14px;font:inherit;font-weight:850;cursor:pointer}.jad-dup-btn.secondary{background:#edf5f0;color:#17673f}.jad-dup-btn:disabled{opacity:.55;cursor:default}
 .jad-dup-modal{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl}.jad-dup-backdrop{position:absolute;inset:0;background:rgba(15,35,26,.44)}.jad-dup-dialog{position:relative;z-index:1;width:min(940px,96vw);max-height:min(82vh,760px);overflow:hidden;background:#fff;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.22);display:flex;flex-direction:column}.jad-dup-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e6eee9}.jad-dup-dialog-head h3{margin:0;font-size:17px;color:#173d2d}.jad-dup-close{width:38px;height:38px;border:0;border-radius:12px;background:#eef5f1;color:#17673f;font-size:25px;line-height:1;cursor:pointer}.jad-dup-list{padding:14px;overflow:auto;-webkit-overflow-scrolling:touch}.jad-dup-row{display:grid;grid-template-columns:90px minmax(150px,1.5fr) minmax(125px,1fr) minmax(125px,1fr) minmax(110px,.8fr);gap:10px;align-items:center;border:1px solid #e2ebe6;border-radius:15px;padding:12px;margin-bottom:10px;background:#fff}.jad-dup-percent{font-size:20px;font-weight:950;color:#b84d18}.jad-dup-main strong{display:block;color:#173d2d;font-size:13px}.jad-dup-main small,.jad-dup-cell small{display:block;color:#75827c;font-size:11px;margin-top:4px}.jad-dup-cell{font-size:12px;color:#344f42}.jad-dup-desc{grid-column:1/-1;color:#687a71;font-size:11px;border-top:1px dashed #e5ece8;padding-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.jad-dup-footnote{padding:0 18px 15px;color:#738078;font-size:11px}
 @media(max-width:680px){.${DUP_PANEL_CLASS}{border-radius:16px;padding:13px;margin:6px 0}.jad-dup-modal{padding:0;align-items:flex-end}.jad-dup-dialog{width:100%;max-height:82vh;border-radius:22px 22px 0 0}.jad-dup-list{padding:10px}.jad-dup-row{grid-template-columns:70px 1fr 1fr;gap:8px}.jad-dup-main{grid-column:2/-1}.jad-dup-desc{grid-column:1/-1}.jad-dup-cell{font-size:11px}}
 `;document.head.appendChild(style);
}
function xhrJson(url:string):Promise<any>{
 return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET',url,true);xhr.withCredentials=true;xhr.setRequestHeader('Accept','application/json');xhr.onload=()=>{let payload:any={};try{payload=xhr.responseText?JSON.parse(xhr.responseText):{}}catch{payload={}}if(xhr.status>=200&&xhr.status<300)resolve(payload);else reject(new Error(payload?.message||`خطای ${xhr.status}`))};xhr.onerror=()=>reject(new Error('ارتباط با سرور برقرار نشد.'));xhr.send()});
}
async function loadConsultantAds(consultantId:string){
 const cached=consultantCache.get(consultantId);if(cached&&Date.now()-cached.at<CACHE_TTL_MS)return cached.ads;
 const params=(page:number)=>`/api/staff/job-ads?consultantId=${encodeURIComponent(consultantId)}&page=${page}&_duplicateCheck=1`;
 const first=await xhrJson(params(1));const ads:JobAdRow[]=[...(first?.data?.ads||[])];
 const totalPages=Math.max(1,Number(first?.data?.pagination?.totalPages||1));
 for(let page=2;page<=totalPages;page+=1){const p=await xhrJson(params(page));ads.push(...(p?.data?.ads||[]))}
 consultantCache.set(consultantId,{at:Date.now(),ads});return ads;
}
function setPanel(state:FormState,mode:'idle'|'checking'|'none'|'error'|'matches',message?:string){
 const panel=state.panel;panel.classList.toggle('is-warning',mode==='matches');panel.replaceChildren();
 const head=make('div','jad-dup-head');const title=make('div','jad-dup-title');title.append(make('span','jad-dup-pulse'),document.createTextNode('تشخیص آگهی تکراری'));head.append(title);panel.append(head);
 const summary=make('div','jad-dup-summary');
 if(mode==='idle')summary.textContent=message||'مشاور پرونده را انتخاب و اطلاعات آگهی را وارد کنید؛ شباهت به آگهی‌های قبلی همان مشاور به‌صورت زنده بررسی می‌شود.';
 if(mode==='checking')summary.textContent='در حال بررسی آگهی‌های همین مشاور فروش...';
 if(mode==='none')summary.textContent='مورد مشابه قابل توجهی در آگهی‌های همین مشاور فروش پیدا نشد.';
 if(mode==='error')summary.textContent=message||'بررسی شباهت فعلاً انجام نشد. با تغییر یکی از فیلدها دوباره تلاش می‌شود.';
 if(mode==='matches'){
  const top=state.matches[0]?.score||0;summary.append(make('span','jad-dup-score',`${faNum(top)}٪ مشابه`),document.createTextNode(` • ${faNum(state.matches.length)} آگهی دیگر از همین مشاور فروش`));
 }
 panel.append(summary);
 if(mode==='matches'){
  const actions=make('div','jad-dup-actions');const view=make('button','jad-dup-btn','مشاهده آگهی‌های مشابه') as HTMLButtonElement;view.type='button';view.addEventListener('click',()=>openMatchesModal(state.matches));actions.append(view);panel.append(actions);
 }
}
function openMatchesModal(matches:MatchRow[]){
 if(!matches.length)return;document.querySelector('.jad-dup-modal')?.remove();const oldOverflow=document.body.style.overflow;
 const root=make('div','jad-dup-modal');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
 const backdrop=make('div','jad-dup-backdrop');const dialog=make('section','jad-dup-dialog');const head=make('header','jad-dup-dialog-head');const heading=make('h3','',`آگهی‌های مشابه (${faNum(matches.length)})`);const close=make('button','jad-dup-close','×') as HTMLButtonElement;close.type='button';close.setAttribute('aria-label','بستن');head.append(heading,close);dialog.append(head);
 const list=make('div','jad-dup-list');
 for(const match of matches){const ad=match.ad,row=make('article','jad-dup-row');row.append(make('div','jad-dup-percent',`${faNum(match.score)}٪`));const main=make('div','jad-dup-main');main.append(make('strong','',String(ad.customerFullName||'آگهی مراقبت')),make('small','',`مشاور: ${String(ad.salesConsultantName||'—')}`));row.append(main);
  const location=make('div','jad-dup-cell',`${String(ad.city||'—')} • ${String(ad.region||'—')}`);location.append(make('small','',statusLabel(ad.status)));row.append(location);
  const service=make('div','jad-dup-cell',`${contractLabel(ad.contractType)} • ${shiftLabel(ad.shiftType)}`);service.append(make('small','',`${faNum(toNumber(ad.durationDays))} روز`));row.append(service);
  const salary=make('div','jad-dup-cell',`${toNumber(ad.caregiverSalaryRial).toLocaleString('fa-IR')} ریال`);salary.append(make('small','',`کد: ${String(ad.id||'—')}`));row.append(salary);
  const desc=make('div','jad-dup-desc',String(ad.description||'بدون شرح'));row.append(desc);list.append(row)}
 dialog.append(list,make('div','jad-dup-footnote','این مقایسه فقط برای کمک به تصمیم مدیر است و مانع ایجاد یا انتشار آگهی نمی‌شود. فرم آگهی جدید در پس‌زمینه بدون تغییر باقی می‌ماند.'));root.append(backdrop,dialog);document.body.append(root);document.body.style.overflow='hidden';
 const esc=(event:KeyboardEvent)=>{if(event.key==='Escape')finish()};const finish=()=>{document.removeEventListener('keydown',esc);root.remove();document.body.style.overflow=oldOverflow};close.addEventListener('click',finish);backdrop.addEventListener('click',finish);document.addEventListener('keydown',esc);close.focus();
}
async function runCheck(form:HTMLFormElement,state:FormState){
 if(!document.contains(form))return;const consultantId=normalizeText(fieldValue(form,'salesConsultantUserId'));
 if(!consultantId){state.matches=[];setPanel(state,'idle','ابتدا مشاور پرونده را انتخاب کنید تا آگهی فقط با سوابق همان مشاور مقایسه شود.');return}
 if(!hasMeaningfulDraft(form)){state.matches=[];setPanel(state,'idle','برای شروع بررسی، نام مشترک، شهر، منطقه یا شرح آگهی را وارد کنید.');return}
 const serial=++state.serial;state.lastConsultantId=consultantId;setPanel(state,'checking');
 try{const ads=await loadConsultantAds(consultantId);if(serial!==state.serial||!document.contains(form))return;
  const matches=ads.map(ad=>({ad,score:scoreAd(form,ad)})).filter(x=>x.score>=DUP_MATCH_THRESHOLD).sort((a,b)=>b.score-a.score).slice(0,8);state.matches=matches;setPanel(state,matches.length?'matches':'none');
 }catch(error:any){if(serial!==state.serial)return;state.matches=[];setPanel(state,'error',error?.message?`بررسی شباهت انجام نشد: ${error.message}`:undefined)}
}
function schedule(form:HTMLFormElement,state:FormState){if(state.timer!==null)window.clearTimeout(state.timer);state.timer=window.setTimeout(()=>{state.timer=null;void runCheck(form,state)},DUP_DEBOUNCE_MS)}
function install(form:HTMLFormElement){
 if(states.has(form)||!form.querySelector('input[name="publishNow"]'))return;ensureStyle();const panel=make('section',DUP_PANEL_CLASS);panel.setAttribute('aria-live','polite');
 const description=form.querySelector('[name="description"]') as HTMLElement|null;const host=description?.closest('label')||null;if(host?.parentElement)host.insertAdjacentElement('afterend',panel);else form.append(panel);
 const state:FormState={panel,timer:null,serial:0,matches:[],lastConsultantId:''};states.set(form,state);setPanel(state,'idle');const onChange=()=>schedule(form,state);form.addEventListener('input',onChange);form.addEventListener('change',onChange);schedule(form,state);
}
function scan(){document.querySelectorAll<HTMLFormElement>(DUP_FORM_SELECTOR).forEach(install)}
if(typeof window!=='undefined'&&typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true})}

export {};
