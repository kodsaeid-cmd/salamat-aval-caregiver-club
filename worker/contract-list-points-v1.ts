import {type Env} from "./lib";

const POINT_SCALE=100;
const unitsToPoints=(value:unknown)=>Math.round((Number(value||0)/POINT_SCALE)*100)/100;

export async function decorateContractListPointsV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url);
 if(request.method.toUpperCase()!=="GET"||!/^\/api\/staff\/contracts-v2\/?$/.test(url.pathname)||!response.ok)return response;
 const contentType=response.headers.get("content-type")||"";if(!contentType.includes("application/json"))return response;
 const payload:any=await response.clone().json().catch(()=>null),rows=payload?.data?.contracts;
 if(!Array.isArray(rows)||!rows.length)return response;
 const ids=[...new Set(rows.map((row:any)=>String(row?.job_contract_id||"")).filter(Boolean))];
 if(!ids.length)return response;
 const placeholders=ids.map(()=>"?").join(",");
 const result=await env.DB.prepare(`SELECT id,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits FROM caregiver_job_contracts WHERE id IN (${placeholders})`).bind(...ids).all<any>();
 const byId=new Map((result.results||[]).map((row:any)=>[String(row.id),row]));
 payload.data.contracts=rows.map((row:any)=>{
  const points:any=byId.get(String(row?.job_contract_id||""));
  const total=unitsToPoints(points?.totalPointsUnits),earned=unitsToPoints(points?.earnedPointsUnits),remaining=Math.max(0,Math.round((total-earned)*100)/100);
  return {...row,totalPoints:total,earnedPoints:earned,remainingPoints:remaining,pointsProgressPercent:total>0?Math.max(0,Math.min(100,Math.round((earned/total)*1000)/10)):0};
 });
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-contract-list-points","1.0.0");
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
