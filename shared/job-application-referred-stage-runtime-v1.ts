const FLAG="__salamatJobApplicationReferredStageRuntimeV1";
const REFERRED_STATUS="REFERRED_TO_CONSULTANT";
const REFERRED_LABEL="معرفی شده به مشاور پرونده";
const target=window as typeof window&Record<string,unknown>;

type CanonicalApplication={id:string;status:string};

if(!target[FLAG]){
 target[FLAG]=true;
 const nativeFetch=window.fetch.bind(window);
 let visibleApplications:CanonicalApplication[]=[];
 let rewriteApplicationId="";
 let rewriteExpiresAt=0;

 function statusOf(value:unknown){return String(value||"").trim().toUpperCase()}
 function applicationPatch(url:URL){
  const match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
  return match?{adId:decodeURIComponent(match[1]),applicationId:decodeURIComponent(match[2])}:null;
 }
 function detailAdId(url:URL){
  const match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)$/);
  return match?decodeURIComponent(match[1]):"";
 }
 function rewriteBody(body:BodyInit|null|undefined,applicationId:string){
  if(applicationId!==rewriteApplicationId||Date.now()>rewriteExpiresAt||typeof body!=="string")return body;
  try{
   const parsed=JSON.parse(body);
   if(statusOf(parsed?.status)!=="TRIAL_DISPATCH")return body;
   rewriteApplicationId="";rewriteExpiresAt=0;
   return JSON.stringify({...parsed,status:REFERRED_STATUS});
  }catch{return body}
 }
 async function canonicalStatuses(adId:string){
  try{
   const response=await nativeFetch(`/api/staff/job-ads/${encodeURIComponent(adId)}/application-lifecycle`,{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)return new Map<string,string>();
   const payload:any=await response.json().catch(()=>null);
   return new Map<string,string>((payload?.data?.applications||[]).map((item:any)=>[String(item.id),statusOf(item.status)]));
  }catch{return new Map<string,string>()}
 }
 function setStatusButtonState(button:HTMLButtonElement|null|undefined,active:boolean,targetLabel:string){
  if(!button)return;
  button.classList.add("ja-status-choice");
  button.classList.toggle("active",active);
  button.setAttribute("aria-pressed",String(active));
  button.title=active?`وضعیت فعلی: ${targetLabel}`:`برای تغییر وضعیت به «${targetLabel}» کلیک کنید`;
 }
 function enhanceApplicantRows(){
  const rows=Array.from(document.querySelectorAll<HTMLElement>(".ja-app-list>article"));
  if(!rows.length||!visibleApplications.length)return;
  rows.forEach((row,index)=>{
   const application=visibleApplications[index];if(!application)return;
   const state=row.querySelector<HTMLElement>(".ja-app-state b");
   if(state&&application.status===REFERRED_STATUS)state.textContent=REFERRED_LABEL;
   const actions=row.querySelector<HTMLElement>(".ja-status-actions");
   const trial=actions?.querySelector<HTMLButtonElement>("button.trial");
   if(!actions||!trial)return;
   const pending=actions.querySelector<HTMLButtonElement>("button:not(.trial):not(.reject):not(.contract):not(.ja-referred)");
   const reject=actions.querySelector<HTMLButtonElement>("button.reject");
   const contract=actions.querySelector<HTMLButtonElement>("button.contract");
   let referred=actions.querySelector<HTMLButtonElement>("button.ja-referred");
   if(!referred){
    referred=document.createElement("button");
    referred.type="button";
    referred.className="ja-referred";
    referred.textContent="معرفی به مشاور پرونده";
    referred.addEventListener("click",event=>{
     event.preventDefault();event.stopPropagation();
     rewriteApplicationId=application.id;
     rewriteExpiresAt=Date.now()+2000;
     trial.click();
    });
    actions.insertBefore(referred,trial);
   }
   setStatusButtonState(pending,application.status==="PENDING_CONSULTANT","در انتظار تأیید");
   setStatusButtonState(referred,application.status===REFERRED_STATUS,"معرفی شده به مشاور پرونده");
   setStatusButtonState(trial,application.status==="TRIAL_DISPATCH","اعزام آزمایشی");
   setStatusButtonState(reject,application.status==="REJECTED","رد شده");
   setStatusButtonState(contract,application.status==="IN_CONTRACT","در قرارداد");
  });
 }
 function enhanceFilter(){
  const select=document.querySelector<HTMLSelectElement>('select[aria-label="فیلتر وضعیت متقاضی پرونده"]');
  if(!select||select.querySelector('option[value="REFERRED"]'))return;
  const option=document.createElement("option");
  option.value="REFERRED";option.textContent="متقاضی معرفی شده";
  const dispatch=select.querySelector('option[value="DISPATCH"]');
  select.insertBefore(option,dispatch||null);
 }
 function enhance(){enhanceFilter();enhanceApplicantRows()}

 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  let url:URL;try{url=new URL(input instanceof Request?input.url:String(input),location.origin)}catch{return nativeFetch(input,init)}
  const method=String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();
  const patch=applicationPatch(url);
  let actualInit=init;
  if(patch&&method==="PATCH"&&patch.applicationId===rewriteApplicationId&&Date.now()<=rewriteExpiresAt){
   const sourceBody=init?.body??(input instanceof Request?await input.clone().text():undefined);
   const nextBody=rewriteBody(sourceBody,patch.applicationId);
   if(nextBody!==sourceBody){
    actualInit={...init,method:"PATCH",body:nextBody};
    if(input instanceof Request){
     const headers=new Headers(input.headers);if(!headers.has("content-type"))headers.set("content-type","application/json");
     input=new Request(input.url,{method:"PATCH",headers,body:nextBody,credentials:input.credentials,cache:input.cache,redirect:input.redirect,referrer:input.referrer,referrerPolicy:input.referrerPolicy,integrity:input.integrity,keepalive:input.keepalive,mode:input.mode,signal:input.signal});
     actualInit=undefined;
    }
   }
  }
  const response=await nativeFetch(input,actualInit);
  const adId=method==="GET"&&response.ok?detailAdId(url):"";
  if(!adId)return response;
  const payload:any=await response.clone().json().catch(()=>null);
  if(!Array.isArray(payload?.data?.applications))return response;
  const canonical=await canonicalStatuses(adId);
  payload.data.applications=payload.data.applications.map((application:any)=>{
   const status=canonical.get(String(application.id));
   return status?{...application,status}:application;
  });
  visibleApplications=payload.data.applications.map((application:any)=>({id:String(application.id),status:statusOf(application.status)}));
  queueMicrotask(enhance);
  const headers=new Headers(response.headers);headers.delete("content-length");
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
 }) as typeof window.fetch;

 const observer=new MutationObserver(()=>enhance());
 observer.observe(document.documentElement,{childList:true,subtree:true});
 queueMicrotask(enhance);
}

export const JOB_APPLICATION_REFERRED_STAGE_RUNTIME_VERSION="1.1.0";
