import {requireAccess} from "./access-control";
import {createCaregiverAccount} from "./caregiver-accounts";
import {routeCaregiverNotifications} from "./caregiver-notifications-v1";
import {routeContractProgressEngine} from "./contract-progress-engine-v1";
import {ensureReferralCodeV4} from "./referral-rewards-v4";
import {type Env,fail,getUser,json,readBody,str} from "./lib";

const ROLLOUT_AT="2026-08-09T18:40:00.000Z";
const fa=(value:unknown)=>Number(value||0).toLocaleString("fa-IR");
const starsFromScore=(value:unknown)=>{const n=Number(value);if(!Number.isFinite(n))return 0;if(n>=90)return 5;if(n>=80)return 4;if(n>=70)return 3;if(n>=60)return 2;return 1};
const contractFa:Record<string,string>={ELDERLY:"سالمند",CHILD:"کودک",PATIENT:"بیمار",HOUSEKEEPING:"خدماتی"};
const shiftFa:Record<string,string>={DAY:"روزانه",NIGHT:"شبانه",LIVE_IN:"شبانه‌روزی",TEMPORARY:"مقطعی"};

export async function routeAdminCaregiverPresetV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(url.pathname!=="/api/users"||request.method.toUpperCase()!=="POST")return null;
 const body=await readBody(request.clone());if(str(body?.role).toUpperCase()!=="CAREGIVER")return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.users","create");if(denied)return denied;
 const response=await createCaregiverAccount(request,env,actor);if(!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null),caregiverId=String(payload?.data?.caregiver?.id||"");
 if(caregiverId){const referralCode=await ensureReferralCodeV4(env,caregiverId);payload.data.caregiver.referralCode=referralCode;payload.data.preset="FRESH_CAREGIVER";return json(payload,response.status)}
 return response;
}

export async function routeJobAdCaregiverVisibilityV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 const caregiverList=path==="/api/caregiver/job-ads"&&method==="GET";
 const caregiverDetail=/^\/api\/caregiver\/job-ads\/[^/]+$/.test(path)&&method==="GET";
 const staffDetail=/^\/api\/staff\/job-ads\/[^/]+$/.test(path)&&method==="GET";
 if(!caregiverList&&!caregiverDetail&&!staffDetail)return null;
 const response=await routeContractProgressEngine(request,env);if(!response||!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 if(caregiverList&&Array.isArray(payload.data.ads))payload.data.ads=payload.data.ads.filter((ad:any)=>String(ad?.myApplication?.status||"").toUpperCase()!=="REJECTED");
 if(caregiverDetail&&String(payload.data?.myApplication?.status||"").toUpperCase()==="REJECTED")return fail("این آگهی به دلیل عدم تطابق مهارت‌ها برای شما منقضی شده است.",410,"job_ad_rejected_for_caregiver");
 if(staffDetail&&Array.isArray(payload.data.applications))payload.data.applications=payload.data.applications.map((app:any)=>({...app,evaluationStars:starsFromScore(app.evaluationScore)}));
 return json(payload,response.status);
}

async function notificationContext(env:Env,caregiverId:string){
 const [contracts,rejected,read]=await Promise.all([
  env.DB.prepare(`SELECT started_at AS startedAt,ended_at AS endedAt,status FROM caregiver_job_contracts WHERE caregiver_id=? ORDER BY started_at DESC LIMIT 80`).bind(caregiverId).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare(`SELECT ap.id,ap.updated_at AS eventAt,a.id AS adId,a.contract_type AS contractType,a.shift_type AS shiftType,a.city,a.region
    FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id
    WHERE ap.caregiver_id=? AND ap.status='REJECTED' ORDER BY ap.updated_at DESC LIMIT 50`).bind(caregiverId).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare("SELECT last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key='jobs' LIMIT 1").bind(caregiverId).first<any>().catch(()=>null),
 ]);
 return {contracts:contracts.results||[],rejected:rejected.results||[],lastSeenAt:String(read?.lastSeenAt||ROLLOUT_AT)};
}
function duringContract(at:string,contracts:any[]){const time=Date.parse(at);if(!Number.isFinite(time))return false;return contracts.some(c=>{const start=Date.parse(String(c.startedAt||"")),end=c.endedAt?Date.parse(String(c.endedAt)):Date.now();return Number.isFinite(start)&&time>=start&&time<=end})}
function rejectedTitle(x:any){return `${contractFa[String(x.contractType||"").toUpperCase()]||"آگهی مراقبت"} • ${shiftFa[String(x.shiftType||"").toUpperCase()]||"شیفت مراقبت"} • ${str(x.city)||"—"}${x.region?` / ${str(x.region)}`:""}`}

export async function routeCaregiverNotificationsUnityV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(!url.pathname.startsWith("/api/caregiver/notifications"))return null;
 const response=await routeCaregiverNotifications(request,env);if(!response||!response.ok||request.method.toUpperCase()!=="GET"||url.pathname!=="/api/caregiver/notifications")return response;
 const actor=await getUser(request,env);if(!actor?.caregiverId)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data?.items)return response;
 const ctx=await notificationContext(env,actor.caregiverId);
 const base=(payload.data.items as any[]).filter(item=>String(item.kind)!=="JOB_AD"||!duringContract(String(item.createdAt||""),ctx.contracts));
 const rejected=ctx.rejected.map((x:any)=>({
  id:`job-rejected:${x.id}:${x.eventAt}`,moduleKey:"jobs",kind:"JOB_AD_REJECTED",title:"این آگهی برای شما منقضی شد",
  body:`به دلیل عدم تطابق مهارت‌های ثبت‌شده شما با پرونده «${rejectedTitle(x)}»، درخواست شما رد شد و این آگهی دیگر در بانک آگهی شما نمایش داده نمی‌شود.`,
  createdAt:x.eventAt,route:"jobs",status:"REJECTED",unread:String(x.eventAt)>ctx.lastSeenAt,
 }));
 const merged=[...base,...rejected].filter(x=>x.createdAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,120);
 const unreadByModule:Record<string,number>={};for(const item of merged)if(item.unread)unreadByModule[item.moduleKey]=(unreadByModule[item.moduleKey]||0)+1;
 payload.data.items=merged;payload.data.unreadByModule=unreadByModule;payload.data.unreadTotal=Object.values(unreadByModule).reduce((a,b)=>a+b,0);
 return json(payload,response.status);
}

export async function rewriteSalesSupervisorAccessV1(request:Request,response:Response){
 if(!response.ok)return response;const path=new URL(request.url).pathname;if(!["/api/admin/access/config","/api/access/me"].includes(path))return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload)return response;
 if(path==="/api/admin/access/config"){
  const data=payload.data||payload;const roles=Array.isArray(data.roles)?data.roles:[];
  if(!roles.some((r:any)=>String(r.key).toUpperCase()==="SALES_SUPERVISOR"))roles.push({key:"SALES_SUPERVISOR",label:"سوپروایزر فروش",panel:"STAFF"});
  data.roles=roles;
  const permissions=Array.isArray(data.rolePermissions)?data.rolePermissions:[];
  const has=permissions.some((r:any)=>String(r.role||"").toUpperCase()==="SALES_SUPERVISOR");
  if(!has)for(const module of (data.modules||[]).filter((m:any)=>m.panel==="STAFF"))permissions.push({role:"SALES_SUPERVISOR",moduleKey:module.key,actions:{view:module.key==="staff.dashboard"||module.key==="staff.job_ads"||module.key==="staff.caregivers",create:module.key==="staff.job_ads",update:module.key==="staff.job_ads",delete:false}});
  data.rolePermissions=permissions;
 }
 if(path==="/api/access/me"){const user=payload.data?.user||payload.user;if(String(user?.role||"").toUpperCase()==="SALES_SUPERVISOR")user.roleLabel="سوپروایزر فروش"}
 return json(payload,response.status);
}
