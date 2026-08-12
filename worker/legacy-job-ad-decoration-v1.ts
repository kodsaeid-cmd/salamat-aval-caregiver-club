import {type Env} from "./lib";

export async function decorateLegacyJobAdContractState(request:Request,env:Env,response:Response){
 const url=new URL(request.url);
 if(request.method.toUpperCase()!=="GET"||!response.ok||!url.pathname.startsWith("/api/staff/job-ads"))return response;
 if(!(response.headers.get("content-type")||"").includes("application/json"))return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 const ads:any[]=[];
 if(Array.isArray(payload.data.ads))ads.push(...payload.data.ads);
 if(payload.data.ad?.id)ads.push(payload.data.ad);
 const ids=[...new Set(ads.map(x=>String(x?.id||"")).filter(Boolean))].slice(0,250);if(!ids.length)return response;
 const marks=ids.map(()=>"?").join(",");
 const rows=await env.DB.prepare(`SELECT DISTINCT ad_id AS adId FROM care_job_applications WHERE status='IN_CONTRACT' AND ad_id IN (${marks})`).bind(...ids).all<{adId:string}>();
 const legacyActive=new Set((rows.results||[]).map(x=>String(x.adId)));
 for(const ad of ads){
  if(legacyActive.has(String(ad.id)))ad.hasActiveContract=true;
  ad.contractPoints=Math.max(0,Number(ad.contractPoints||ad.rewardPoints||0));
 }
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("content-type","application/json; charset=utf-8");
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
