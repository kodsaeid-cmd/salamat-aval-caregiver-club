import {ensureJobAdsSchema} from "./job-ads-v1";
import {ensureJobApplicationLifecycleSchema} from "./job-application-lifecycle-v1";
import {audit,fail,getUser,json,nowIso,randomId,type Env} from "./lib";

const DAILY_APPLICATION_LIMIT=5;
const ACTIVE_REQUEST_STATES=["PENDING_CONSULTANT","TRIAL_DISPATCH"] as const;
let guardReady:Promise<void>|undefined;

function tehranDayBoundsIso(at=Date.now()){
 const offsetMs=210*60*1000;
 const local=new Date(at+offsetMs);
 const localMidnightUtc=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 const start=new Date(localMidnightUtc-offsetMs);
 const end=new Date(start.getTime()+86_400_000);
 return {start:start.toISOString(),end:end.toISOString()};
}

async function ensureDailyApplicationGuard(env:Env){
 if(!guardReady)guardReady=(async()=>{
  await ensureJobAdsSchema(env);
  await ensureJobApplicationLifecycleSchema(env);
  await env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_caregiver_daily_active_job_application_limit_v1
   BEFORE INSERT ON care_job_applications
   WHEN COALESCE(NEW.lifecycle_status,NEW.status) IN ('PENDING_CONSULTANT','TRIAL_DISPATCH')
    AND (SELECT COUNT(*) FROM care_job_applications existing
      WHERE existing.caregiver_id=NEW.caregiver_id
       AND existing.applied_at>=datetime(date(datetime(NEW.applied_at,'+3 hours','+30 minutes')),'-3 hours','-30 minutes')
       AND existing.applied_at<datetime(date(datetime(NEW.applied_at,'+3 hours','+30 minutes'),'+1 day'),'-3 hours','-30 minutes')
       AND COALESCE(existing.lifecycle_status,existing.status) IN ('PENDING_CONSULTANT','TRIAL_DISPATCH'))>=${DAILY_APPLICATION_LIMIT}
   BEGIN SELECT RAISE(ABORT,'DAILY_JOB_APPLICATION_LIMIT'); END`).run();
 })().catch(error=>{guardReady=undefined;throw error});
 return guardReady;
}

function limitResponse(activeToday=DAILY_APPLICATION_LIMIT){
 return json({
  error:"daily_job_application_limit_reached",
  message:"شما به سقف درخواست آگهی روزانه رسیده‌اید. برای درخواست‌های بیشتر، یا باید از یکی از درخواست‌های قبلی امروز انصراف دهید یا تا فردا صبر کنید.",
  data:{dailyLimit:DAILY_APPLICATION_LIMIT,activeToday,remainingToday:0},
 },429,{"x-salamat-job-application-daily-limit":"5-v1"});
}

export async function routeCaregiverDailyJobApplicationLimitV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 const match=url.pathname.match(/^\/api\/caregiver\/job-ads\/([^/]+)\/apply$/);
 if(!match||method!=="POST")return null;
 const actor=await getUser(request,env);
 if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 if(actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return fail("این مسیر مخصوص مراقبین است.",403,"caregiver_only");
 await ensureDailyApplicationGuard(env);
 const adId=decodeURIComponent(match[1]);
 const existing=await env.DB.prepare(`SELECT id,COALESCE(lifecycle_status,status) AS lifecycleStatus,applied_at AS appliedAt
   FROM care_job_applications WHERE ad_id=? AND caregiver_id=? LIMIT 1`).bind(adId,actor.caregiverId).first<any>();
 if(existing&&ACTIVE_REQUEST_STATES.includes(String(existing.lifecycleStatus||"").toUpperCase() as any)){
  return json({data:{application:{id:existing.id,status:existing.lifecycleStatus,appliedAt:existing.appliedAt}}},200,{"x-salamat-job-application-daily-limit":"5-v1"});
 }
 const ad=await env.DB.prepare("SELECT id,status FROM care_job_ads WHERE id=? LIMIT 1").bind(adId).first<any>();
 if(!ad||String(ad.status||"").toUpperCase()!=="PUBLISHED")return fail("این آگهی فعال نیست و امکان ثبت درخواست برای شغل ندارد.",409,"job_ad_unavailable");
 const {start,end}=tehranDayBoundsIso();
 const count=await env.DB.prepare(`SELECT COUNT(*) AS count FROM care_job_applications
   WHERE caregiver_id=? AND applied_at>=? AND applied_at<?
    AND COALESCE(lifecycle_status,status) IN ('PENDING_CONSULTANT','TRIAL_DISPATCH')`).bind(actor.caregiverId,start,end).first<{count:number}>();
 const activeToday=Number(count?.count||0);
 if(activeToday>=DAILY_APPLICATION_LIMIT)return limitResponse(activeToday);
 const ts=nowIso(),appId=randomId("app_");
 try{
  await env.DB.prepare(`INSERT OR IGNORE INTO care_job_applications(id,ad_id,caregiver_id,status,lifecycle_status,applied_at,updated_at)
   VALUES(?,?,?,'PENDING_CONSULTANT','PENDING_CONSULTANT',?,?)`).bind(appId,adId,actor.caregiverId,ts,ts).run();
 }catch(error:any){
  if(/DAILY_JOB_APPLICATION_LIMIT/i.test(String(error?.message||error)))return limitResponse(DAILY_APPLICATION_LIMIT);
  throw error;
 }
 const row=await env.DB.prepare(`SELECT id,COALESCE(lifecycle_status,status) AS status,applied_at AS appliedAt
   FROM care_job_applications WHERE ad_id=? AND caregiver_id=? LIMIT 1`).bind(adId,actor.caregiverId).first<any>();
 if(!row)return fail("ثبت درخواست آگهی انجام نشد.",500,"job_application_create_failed");
 await audit(request,env,actor,"APPLY_JOB_AD","care_job_application",String(row.id),{adId,dailyLimit:DAILY_APPLICATION_LIMIT,activeTodayBefore:activeToday});
 return json({data:{application:row,dailyLimit:DAILY_APPLICATION_LIMIT,activeToday:activeToday+1,remainingToday:Math.max(0,DAILY_APPLICATION_LIMIT-activeToday-1)}},201,{"x-salamat-job-application-daily-limit":"5-v1"});
}
