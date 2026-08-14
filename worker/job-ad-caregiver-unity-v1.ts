import {requireAccess} from "./access-control";
import {createCaregiverAccount} from "./caregiver-accounts";
import {routeCaregiverNotifications} from "./caregiver-notifications-v1";
import {routeContractProgressEngine} from "./contract-progress-engine-v1";
import {ensureReferralCodeV4} from "./referral-rewards-v4";
import {type Env,fail,getUser,json,readBody,str} from "./lib";

const ROLLOUT_AT="2026-08-09T18:40:00.000Z";
const starsFromScore=(value:unknown)=>{const n=Number(value);if(!Number.isFinite(n))return 0;if(n>=90)return 5;if(n>=80)return 4;if(n>=70)return 3;if(n>=60)return 2;return 1};
const contractFa:Record<string,string>={ELDERLY:"سالمند",CHILD:"کودک",PATIENT:"بیمار",HOUSEKEEPING:"خدماتی"};
const shiftFa:Record<string,string>={DAY:"روزانه",NIGHT:"شبانه",LIVE_IN:"شبانه‌روزی",TEMPORARY:"مقطعی"};
function canonicalTrainingCategory(value:unknown){const raw=str(value).replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ").trim();if(["باشگاه مراقبین سلامت اول","باشگاه مراقبین","باشگاه","عمومی","آموزش سازمانی"].includes(raw))return"باشگاه مراقبین سلامت اول";if(["پیش از اعزام","پیش‌از اعزام","مصاحبه","اعزام آزمایشی"].includes(raw))return"پیش از اعزام";if(/حین اعزام/.test(raw))return"آموزش‌های حین اعزام";if(/بازآموز|در قرارداد/.test(raw))return"بازآموزی‌های در قرارداد";if(/تخصص/.test(raw))return"آموزش‌های تخصصی";return"باشگاه مراقبین سلامت اول"}

export async function routeAdminCaregiverPresetV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(url.pathname!=="/api/users"||request.method.toUpperCase()!=="POST")return null;
 const body=await readBody(request.clone());if(str(body?.role).toUpperCase()!=="CAREGIVER")return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.users","create");if(denied)return denied;
 const response=await createCaregiverAccount(request,env,actor);if(!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null),caregiverId=String(payload?.data?.caregiver?.id||""),user=payload?.data?.user||{};
 if(caregiverId){
  const referralCode=await ensureReferralCodeV4(env,caregiverId);
  payload.data={...payload.data,id:user.id,userId:user.id,fullName:user.fullName,username:user.username,mobile:user.mobile,role:"CAREGIVER",status:user.status,preset:"FRESH_CAREGIVER",caregiver:{...payload.data.caregiver,referralCode}};
  return json(payload,response.status);
 }
 return response;
}

async function rejectedAdIds(env:Env,caregiverId:string){
 const rows=await env.DB.prepare("SELECT ad_id AS adId FROM care_job_applications WHERE caregiver_id=? AND status='REJECTED'").bind(caregiverId).all<{adId:string}>();
 return new Set((rows.results||[]).map(x=>String(x.adId)));
}

async function activeContractByAd(env:Env,adIds:string[]){
 const unique=[...new Set(adIds.filter(Boolean))].slice(0,250);if(!unique.length)return new Map<string,any>();
 const marks=unique.map(()=>"?").join(",");
 const rows=await env.DB.prepare(`SELECT id,ad_id AS adId,application_id AS applicationId,caregiver_id AS caregiverId,started_at AS startedAt,scheduled_end_at AS endsAt FROM caregiver_job_contracts WHERE status='ACTIVE' AND ad_id IN (${marks}) ORDER BY started_at DESC`).bind(...unique).all<any>();
 const map=new Map<string,any>();for(const row of rows.results||[])if(!map.has(String(row.adId)))map.set(String(row.adId),row);return map;
}
function decorateContractAd(ad:any,active:Map<string,any>){if(!ad?.id)return ad;const contract=active.get(String(ad.id));return contract?{...ad,hasActiveContract:true,lifecycleStatus:"CONTRACT",activeContractId:contract.id,contractApplicationId:contract.applicationId,contractCaregiverId:contract.caregiverId,contractStartedAt:contract.startedAt,contractEndsAt:contract.endsAt}:{...ad,hasActiveContract:false,lifecycleStatus:null}}

export async function routeJobAdCaregiverVisibilityV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),path=url.pathname;
 const caregiverList=path==="/api/caregiver/job-ads"&&method==="GET";
 const caregiverDetailMatch=path.match(/^\/api\/caregiver\/job-ads\/([^/]+)$/),caregiverDetail=Boolean(caregiverDetailMatch&&method==="GET");
 const staffList=path==="/api/staff/job-ads"&&method==="GET";
 const staffDetail=/^\/api\/staff\/job-ads\/[^/]+$/.test(path)&&method==="GET";
 if(!caregiverList&&!caregiverDetail&&!staffList&&!staffDetail)return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const response=await routeContractProgressEngine(request,env);if(!response||!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 if((caregiverList||caregiverDetail)&&actor.role.toUpperCase()==="CAREGIVER"&&actor.caregiverId){
  const rejected=await rejectedAdIds(env,actor.caregiverId);
  if(caregiverList&&Array.isArray(payload.data.ads))payload.data.ads=payload.data.ads.filter((ad:any)=>!rejected.has(String(ad?.id)));
  if(caregiverDetail&&caregiverDetailMatch&&rejected.has(decodeURIComponent(caregiverDetailMatch[1])))return fail("این آگهی به دلیل عدم تطابق مهارت‌ها برای شما منقضی شده است.",410,"job_ad_rejected_for_caregiver");
 }
 if(staffList||staffDetail){
  const ids:string[]=[];if(Array.isArray(payload.data.ads))for(const ad of payload.data.ads)if(ad?.id)ids.push(String(ad.id));if(payload.data.ad?.id)ids.push(String(payload.data.ad.id));
  const active=await activeContractByAd(env,ids);
  if(Array.isArray(payload.data.ads))payload.data.ads=payload.data.ads.map((ad:any)=>decorateContractAd(ad,active));
  if(payload.data.ad?.id)payload.data.ad=decorateContractAd(payload.data.ad,active);
 }
 if(staffDetail&&Array.isArray(payload.data.applications))payload.data.applications=payload.data.applications.map((app:any)=>({...app,evaluationStars:starsFromScore(app.evaluationScore)}));
 return json(payload,response.status);
}

async function notificationContext(env:Env,caregiverId:string){
 const [contracts,rejected,read,training,trainingRead]=await Promise.all([
  env.DB.prepare(`SELECT started_at AS startedAt,ended_at AS endedAt,status FROM caregiver_job_contracts WHERE caregiver_id=? ORDER BY started_at DESC LIMIT 80`).bind(caregiverId).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare(`SELECT ap.id,ap.updated_at AS eventAt,a.id AS adId,a.contract_type AS contractType,a.shift_type AS shiftType,a.city,a.region
    FROM care_job_applications ap JOIN care_job_ads a ON a.id=ap.ad_id
    WHERE ap.caregiver_id=? AND ap.status='REJECTED' ORDER BY ap.updated_at DESC LIMIT 50`).bind(caregiverId).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare("SELECT last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key='jobs' LIMIT 1").bind(caregiverId).first<any>().catch(()=>null),
  env.DB.prepare(`SELECT e.id AS enrollmentId,e.assigned_at AS assignedAt,c.title,c.category,m.assignment_note AS assignmentNote
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    LEFT JOIN training_assignment_meta m ON m.enrollment_id=e.id
    WHERE e.caregiver_id=? AND UPPER(COALESCE(e.status,''))<>'CANCELLED' AND UPPER(COALESCE(c.status,'ACTIVE'))='ACTIVE'
    ORDER BY e.assigned_at DESC LIMIT 60`).bind(caregiverId).all<any>().catch(()=>({results:[]} as any)),
  env.DB.prepare("SELECT last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key='training' LIMIT 1").bind(caregiverId).first<any>().catch(()=>null),
 ]);
 return {contracts:contracts.results||[],rejected:rejected.results||[],training:training.results||[],lastSeenAt:String(read?.lastSeenAt||ROLLOUT_AT),trainingLastSeenAt:String(trainingRead?.lastSeenAt||ROLLOUT_AT)};
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
 const training=ctx.training.map((x:any)=>({
  id:`training:${x.enrollmentId}:${x.assignedAt}`,moduleKey:"training",kind:"TRAINING_ASSIGNED",title:"آموزش جدید برای شما ارسال شد",
  body:`${str(x.title)||"آموزش جدید"} • ${canonicalTrainingCategory(x.category)}${x.assignmentNote?` • ${str(x.assignmentNote)}`:""}`,
  createdAt:x.assignedAt,route:"training",status:"ASSIGNED",unread:String(x.assignedAt)>ctx.trainingLastSeenAt,
 }));
 const merged=[...base,...rejected,...training].filter(x=>x.createdAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,160);
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
  if(!has)for(const module of (data.modules||[]).filter((m:any)=>m.panel==="STAFF")){
    const job=module.key==="staff.job_ads",view=module.key==="staff.dashboard"||job||module.key==="staff.caregivers";
    permissions.push({role:"SALES_SUPERVISOR",moduleKey:module.key,canView:view?1:0,canCreate:job?1:0,canUpdate:job?1:0,canDelete:0});
  }
  data.rolePermissions=permissions;
 }
 if(path==="/api/access/me"){const user=payload.data?.user||payload.user;if(String(user?.role||"").toUpperCase()==="SALES_SUPERVISOR")user.roleLabel="سوپروایزر فروش"}
 return json(payload,response.status);
}
