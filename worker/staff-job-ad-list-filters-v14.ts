import {type Env,json} from "./lib";
import {routeStaffJobAdListFiltersV1} from "./staff-job-ad-list-filters-v1";

export async function routeStaffJobAdListFiltersV14(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname!=="/api/staff/job-ads"||method!=="GET")return null;
 const response=await routeStaffJobAdListFiltersV1(request,env);if(!response||!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!Array.isArray(payload?.data?.ads))return response;
 const ids=payload.data.ads.map((ad:any)=>String(ad?.id||"")).filter(Boolean);
 if(ids.length){
  const marks=ids.map(()=>"?").join(",");
  const deleted=await env.DB.prepare(`SELECT id FROM care_job_ads WHERE deleted_at IS NOT NULL AND id IN (${marks})`).bind(...ids).all<{id:string}>();
  const hidden=new Set((deleted.results||[]).map(row=>String(row.id)));
  payload.data.ads=payload.data.ads.filter((ad:any)=>!hidden.has(String(ad?.id||"")));
 }
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("x-salamat-job-ad-list-source","staff-filter-v14-tombstone");
 return json(payload,response.status,headers);
}
