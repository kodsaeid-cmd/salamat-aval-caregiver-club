import {type Env} from "./lib";

const POINT_SCALE=100;
const DAY_MS=86_400_000;
const unitsToPoints=(value:unknown)=>Math.round((Number(value||0)/POINT_SCALE)*100)/100;
const optionalInt=(params:URLSearchParams,key:string)=>{const raw=params.get(key);if(raw==null||raw.trim()==="")return null;const n=Number(raw);return Number.isFinite(n)?Math.trunc(n):null};
const positiveInt=(params:URLSearchParams,key:string,fallback:number)=>{const n=optionalInt(params,key);return n==null?fallback:Math.max(1,n)};
const daysBetween=(a:string,b:string)=>Math.max(0,Math.ceil((Date.parse(b)-Date.parse(a))/DAY_MS));
const renewalState=(remaining:number,status:string)=>status!=="ACTIVE"?(status==="COMPLETED"?"COMPLETED":"INACTIVE"):remaining<=6?"RENEW_NOW":remaining<=14?"RENEW_SOON":remaining<=30?"NEAR_RENEWAL":"CURRENT";

async function canonicalList(request:Request,env:Env){
 const url=new URL(request.url),p=url.searchParams,q=(p.get("q")||"").trim(),status=(p.get("status")||"").trim().toUpperCase(),renewal=(p.get("renewal")||"").trim().toUpperCase();
 const stars=optionalInt(p,"stars"),salaryMin=optionalInt(p,"salaryMin"),salaryMax=optionalInt(p,"salaryMax"),durationMin=optionalInt(p,"durationMin"),durationMax=optionalInt(p,"durationMax"),remainingMin=optionalInt(p,"remainingMin"),remainingMax=optionalInt(p,"remainingMax");
 const startFrom=(p.get("startFrom")||"").trim(),startTo=(p.get("startTo")||"").trim(),endFrom=(p.get("endFrom")||"").trim(),endTo=(p.get("endTo")||"").trim(),sort=(p.get("sort")||"end_asc").trim();
 const page=positiveInt(p,"page",1),pageSize=Math.max(10,Math.min(100,positiveInt(p,"pageSize",40))),offset=(page-1)*pageSize,clauses=["1=1"],binds:any[]=[];
 if(q){clauses.push("(c.contract_number LIKE ? OR c.contract_title LIKE ? OR g.full_name LIKE ? OR g.membership_code LIKE ?)");binds.push(...Array(4).fill(`%${q}%`))}
 if(status){clauses.push("c.status=?");binds.push(status)}
 if(renewal){clauses.push("c.renewal_state=?");binds.push(renewal)}
 if(stars!=null){clauses.push("COALESCE(r.stars,0)=?");binds.push(stars)}
 if(salaryMin!=null){clauses.push("c.caregiver_salary_rial>=?");binds.push(salaryMin)}
 if(salaryMax!=null){clauses.push("c.caregiver_salary_rial<=?");binds.push(salaryMax)}
 if(durationMin!=null){clauses.push("c.duration_days>=?");binds.push(durationMin)}
 if(durationMax!=null){clauses.push("c.duration_days<=?");binds.push(durationMax)}
 if(remainingMin!=null){clauses.push("(julianday(c.ends_at)-julianday('now'))>=?");binds.push(remainingMin)}
 if(remainingMax!=null){clauses.push("(julianday(c.ends_at)-julianday('now'))<=?");binds.push(remainingMax)}
 if(startFrom){clauses.push("date(c.starts_at)>=date(?)");binds.push(startFrom)}
 if(startTo){clauses.push("date(c.starts_at)<=date(?)");binds.push(startTo)}
 if(endFrom){clauses.push("date(c.ends_at)>=date(?)");binds.push(endFrom)}
 if(endTo){clauses.push("date(c.ends_at)<=date(?)");binds.push(endTo)}
 const order=({end_asc:"c.ends_at ASC",remaining_asc:"c.ends_at ASC",end_desc:"c.ends_at DESC",remaining_desc:"c.ends_at DESC",start_desc:"c.starts_at DESC",start_asc:"c.starts_at ASC",salary_desc:"c.caregiver_salary_rial DESC",salary_asc:"c.caregiver_salary_rial ASC",stars_desc:"COALESCE(r.stars,0) DESC,c.ends_at ASC",stars_asc:"COALESCE(r.stars,0) ASC,c.ends_at ASC",duration_desc:"c.duration_days DESC",duration_asc:"c.duration_days ASC"} as Record<string,string>)[sort]||"c.ends_at ASC";
 const base=`FROM contract_cases_v2 c JOIN caregivers g ON g.id=c.primary_caregiver_id LEFT JOIN (SELECT contract_case_id,MAX(COALESCE(stars_snapshot,0)) stars FROM contract_service_providers_v2 WHERE status='ACTIVE' GROUP BY contract_case_id) r ON r.contract_case_id=c.id WHERE ${clauses.join(" AND ")}`;
 const [rows,count]=await Promise.all([
  env.DB.prepare(`SELECT c.*,g.full_name AS caregiverName,g.membership_code AS membershipCode,COALESCE(r.stars,0) AS caregiverStars ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds,pageSize,offset).all<any>(),
  env.DB.prepare(`SELECT COUNT(*) AS total ${base}`).bind(...binds).first<{total:number}>(),
 ]);
 const now=new Date().toISOString(),contracts=(rows.results||[]).map((row:any)=>{const duration=Math.max(1,Number(row.duration_days||1)),remaining=Math.max(0,daysBetween(now,String(row.ends_at||now))),elapsed=Math.max(0,daysBetween(String(row.starts_at||now),now));return{...row,remainingDays:remaining,elapsedDays:Math.min(duration,elapsed),progressPercent:Math.round(Math.min(1,elapsed/duration)*100),renewalState:renewalState(remaining,String(row.status||""))}}),total=Number(count?.total||0);
 return{contracts,pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))}};
}

export async function decorateContractListPointsV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url);
 if(request.method.toUpperCase()!=="GET"||!/^\/api\/staff\/contracts-v2\/?$/.test(url.pathname)||!response.ok)return response;
 const contentType=response.headers.get("content-type")||"";if(!contentType.includes("application/json"))return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 // contract-lifecycle-v2 historically coerced every absent numeric query parameter from null to 0.
 // That silently added salaryMax<=0, durationMax<=0 and remainingMax<=0 to an otherwise unfiltered request,
 // so the live administrator API returned an empty contracts array even while contract rows existed in D1.
 const rebuilt=await canonicalList(request,env);payload.data.contracts=rebuilt.contracts;payload.data.pagination=rebuilt.pagination;
 const rows=payload.data.contracts as any[],ids=[...new Set(rows.map((row:any)=>String(row?.job_contract_id||"")).filter(Boolean))];
 if(ids.length){
  const placeholders=ids.map(()=>"?").join(","),result=await env.DB.prepare(`SELECT id,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits FROM caregiver_job_contracts WHERE id IN (${placeholders})`).bind(...ids).all<any>(),byId=new Map((result.results||[]).map((row:any)=>[String(row.id),row]));
  payload.data.contracts=rows.map((row:any)=>{const points:any=byId.get(String(row?.job_contract_id||"")),total=unitsToPoints(points?.totalPointsUnits),earned=unitsToPoints(points?.earnedPointsUnits),remaining=Math.max(0,Math.round((total-earned)*100)/100);return{...row,totalPoints:total,earnedPoints:earned,remainingPoints:remaining,pointsProgressPercent:total>0?Math.max(0,Math.min(100,Math.round((earned/total)*1000)/10)):0}});
 }
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-contract-list-points","1.1.0");headers.set("x-salamat-contract-list-source","canonical-filter-repair-v1");
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
