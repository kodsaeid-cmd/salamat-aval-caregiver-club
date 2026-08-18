import {requireAccess} from "./access-control";
import {routeStaffJobAdListFiltersV1} from "./staff-job-ad-list-filters-v1";
import {type AuthUser,type Env,fail,getUser,json,nowIso} from "./lib";

export const JOB_REQUEST_UNREAD_VERSION="1.0.0";
const SUMMARY_PATH="/api/staff/job-ads/request-unread-summary";

function staffScope(actor:AuthUser){return actor.role.toUpperCase()==="SALES_CONSULTANT"}

async function requireViewer(request:Request,env:Env){
 const actor=await getUser(request,env);
 if(!actor)return {response:fail("ابتدا وارد حساب شوید.",401,"unauthorized"),actor:null};
 const denied=await requireAccess(env,actor,"staff.job_ads","view");
 return denied?{response:denied,actor:null}:{response:null,actor};
}

async function summary(request:Request,env:Env){
 const access=await requireViewer(request,env);if(access.response||!access.actor)return access.response!;
 const actor=access.actor,consultantOnly=staffScope(actor)?1:0;
 const row=await env.DB.prepare(`SELECT
   COUNT(DISTINCT a.id) AS unreadAds,
   COUNT(ap.id) AS unreadRequests
  FROM care_job_ads a
  JOIN care_job_applications ap ON ap.ad_id=a.id
  LEFT JOIN care_job_ad_request_reads rr ON rr.ad_id=a.id AND rr.user_id=?
  WHERE a.deleted_at IS NULL
    AND ap.applied_at>COALESCE(rr.last_seen_application_at,'')
    AND (?=0 OR a.sales_consultant_user_id=?)`).bind(actor.id,consultantOnly,actor.id).first<any>();
 return json({data:{unreadAds:Number(row?.unreadAds||0),unreadRequests:Number(row?.unreadRequests||0),version:JOB_REQUEST_UNREAD_VERSION}});
}

async function markSeen(request:Request,env:Env,adId:string){
 const access=await requireViewer(request,env);if(access.response||!access.actor)return access.response!;
 const actor=access.actor;
 const ad=await env.DB.prepare(`SELECT id,sales_consultant_user_id AS consultantId
   FROM care_job_ads WHERE id=? AND deleted_at IS NULL LIMIT 1`).bind(adId).first<any>();
 if(!ad)return fail("آگهی پیدا نشد.",404,"job_ad_not_found");
 if(staffScope(actor)&&String(ad.consultantId)!==actor.id)return fail("دسترسی کافی ندارید.",403,"forbidden");
 const latest=await env.DB.prepare("SELECT MAX(applied_at) AS latest FROM care_job_applications WHERE ad_id=?").bind(adId).first<any>();
 const seenThrough=String(latest?.latest||"");
 if(seenThrough){
  const ts=nowIso();
  await env.DB.prepare(`INSERT INTO care_job_ad_request_reads(user_id,ad_id,last_seen_application_at,updated_at)
    VALUES(?,?,?,?)
    ON CONFLICT(user_id,ad_id) DO UPDATE SET
      last_seen_application_at=excluded.last_seen_application_at,
      updated_at=excluded.updated_at`).bind(actor.id,adId,seenThrough,ts).run();
 }
 return json({data:{adId,seen:true,seenThrough:seenThrough||null,version:JOB_REQUEST_UNREAD_VERSION}});
}

async function unreadCountsForAds(env:Env,userId:string,ids:string[]){
 const result=new Map<string,number>();
 const unique=[...new Set(ids.filter(Boolean))];
 for(let offset=0;offset<unique.length;offset+=180){
  const group=unique.slice(offset,offset+180),marks=group.map(()=>"?").join(",");
  const rows=await env.DB.prepare(`SELECT a.id AS adId,COUNT(ap.id) AS unreadRequestCount
    FROM care_job_ads a
    JOIN care_job_applications ap ON ap.ad_id=a.id
    LEFT JOIN care_job_ad_request_reads rr ON rr.ad_id=a.id AND rr.user_id=?
    WHERE a.id IN (${marks})
      AND ap.applied_at>COALESCE(rr.last_seen_application_at,'')
    GROUP BY a.id`).bind(userId,...group).all<any>();
  for(const row of rows.results||[])result.set(String(row.adId),Number(row.unreadRequestCount||0));
 }
 return result;
}

async function decorateList(request:Request,env:Env){
 const response=await routeStaffJobAdListFiltersV1(request,env);if(!response)return null;
 if(!response.ok)return response;
 const actor=await getUser(request,env);if(!actor)return response;
 const payload:any=await response.clone().json().catch(()=>null),ads=Array.isArray(payload?.data?.ads)?payload.data.ads:[];
 if(!ads.length)return response;
 const unread=await unreadCountsForAds(env,actor.id,ads.map((ad:any)=>String(ad?.id||"")));
 payload.data.ads=ads.map((ad:any)=>{const unreadRequestCount=unread.get(String(ad.id))||0;return {...ad,unreadRequestCount,hasUnreadRequests:unreadRequestCount>0}});
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("content-type","application/json; charset=utf-8");headers.set("x-salamat-job-request-unread",JOB_REQUEST_UNREAD_VERSION);
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

export async function routeStaffJobRequestUnreadV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname===SUMMARY_PATH&&method==="GET")return summary(request,env);
 const seen=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/requests-seen$/);
 if(seen&&method==="POST")return markSeen(request,env,decodeURIComponent(seen[1]));
 if(url.pathname==="/api/staff/job-ads"&&method==="GET")return decorateList(request,env);
 return null;
}
