import {type Env,fail} from "./lib";

const POINT_SCALE=100;
const DAY_MS=86_400_000;
const BREAKS=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
const unitsToPoints=(value:unknown)=>Math.round((Number(value||0)/POINT_SCALE)*100)/100;
const optionalInt=(params:URLSearchParams,key:string)=>{const raw=params.get(key);if(raw==null||raw.trim()==="")return null;const n=Number(raw);return Number.isFinite(n)?Math.trunc(n):null};
const positiveInt=(params:URLSearchParams,key:string,fallback:number)=>{const n=optionalInt(params,key);return n==null?fallback:Math.max(1,n)};
const daysBetween=(a:string,b:string)=>Math.max(0,Math.ceil((Date.parse(b)-Date.parse(a))/DAY_MS));
const renewalState=(remaining:number,status:string)=>status!=="ACTIVE"?(status==="COMPLETED"?"COMPLETED":"INACTIVE"):remaining<=6?"RENEW_NOW":remaining<=14?"RENEW_SOON":remaining<=30?"NEAR_RENEWAL":"CURRENT";
const div=(a:number,b:number)=>Math.trunc(a/b),mod=(a:number,b:number)=>a-Math.trunc(a/b)*b,pad=(n:number)=>String(n).padStart(2,"0");
const asciiDigits=(value:string)=>value.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

function jalCal(jy:number,withoutLeap=false){const bl=BREAKS.length,gy=jy+621;let leapJ=-14,jp=BREAKS[0],jm=0,jump=0,leap=0,n=0;if(jy<jp||jy>=BREAKS[bl-1])throw new Error("jalali_year_out_of_range");for(let i=1;i<bl;i++){jm=BREAKS[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ++;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150,march=20+leapJ-leapG;if(withoutLeap)return{gy,march,leap:0};if(jump-n<6)n=n-jump+div(jump+4,33)*33;leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}}
function g2d(gy:number,gm:number,gd:number){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
function d2g(jdn:number){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308,gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1,gy=div(j,1461)-100100+div(8-gm,6);return{gy,gm,gd}}
function j2d(jy:number,jm:number,jd:number){const r=jalCal(jy,true);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1}
function jalaliMonthLength(jy:number,jm:number){if(jm<=6)return 31;if(jm<=11)return 30;return jalCal(jy).leap===0?30:29}
function normalizeContractDate(raw:string){
 const value=asciiDigits(raw.trim()).replace(/[.-]/g,"/");if(!value)return"";
 const iso=value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
 if(!iso)return null;
 const year=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 // Gregorian dates remain accepted for API compatibility; the administrator UI sends Jalali.
 if(year>=1800&&year<=2500){if(month<1||month>12||day<1||day>31)return null;return `${year}-${pad(month)}-${pad(day)}`}
 if(year<1200||year>1700||month<1||month>12||day<1||day>jalaliMonthLength(year,month))return null;
 const g=d2g(j2d(year,month,day));return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

async function canonicalList(request:Request,env:Env){
 const url=new URL(request.url),p=url.searchParams,q=(p.get("q")||"").trim(),status=(p.get("status")||"").trim().toUpperCase(),renewal=(p.get("renewal")||"").trim().toUpperCase();
 const consultantId=(p.get("consultantId")||"").trim(),contractType=(p.get("contractType")||"").trim().toUpperCase(),shiftType=(p.get("shiftType")||"").trim().toUpperCase(),settlementMethod=(p.get("settlementMethod")||"").trim().toUpperCase();
 const stars=optionalInt(p,"stars"),salaryMin=optionalInt(p,"salaryMin"),salaryMax=optionalInt(p,"salaryMax"),durationMin=optionalInt(p,"durationMin"),durationMax=optionalInt(p,"durationMax"),remainingMin=optionalInt(p,"remainingMin"),remainingMax=optionalInt(p,"remainingMax");
 const rawDates={startFrom:(p.get("startFrom")||"").trim(),startTo:(p.get("startTo")||"").trim(),endFrom:(p.get("endFrom")||"").trim(),endTo:(p.get("endTo")||"").trim()};
 const converted=Object.fromEntries(Object.entries(rawDates).map(([key,value])=>[key,normalizeContractDate(value)])) as Record<string,string|null>;
 for(const [key,value] of Object.entries(converted))if(rawDates[key as keyof typeof rawDates]&&value==null)throw new Error(`invalid_jalali_date:${key}`);
 const startFrom=converted.startFrom||"",startTo=converted.startTo||"",endFrom=converted.endFrom||"",endTo=converted.endTo||"",sort=(p.get("sort")||"end_asc").trim();
 const page=positiveInt(p,"page",1),pageSize=Math.max(10,Math.min(100,positiveInt(p,"pageSize",40))),offset=(page-1)*pageSize,clauses=["1=1"],binds:any[]=[];
 if(q){clauses.push("(c.contract_number LIKE ? OR c.contract_title LIKE ? OR g.full_name LIKE ? OR g.membership_code LIKE ?)");binds.push(...Array(4).fill(`%${q}%`))}
 if(status){clauses.push("c.status=?");binds.push(status)}
 if(renewal){clauses.push("c.renewal_state=?");binds.push(renewal)}
 if(consultantId){clauses.push("a.sales_consultant_user_id=?");binds.push(consultantId)}
 if(contractType){clauses.push("a.contract_type=?");binds.push(contractType)}
 if(shiftType){clauses.push("a.shift_type=?");binds.push(shiftType)}
 if(settlementMethod){clauses.push("c.settlement_method=?");binds.push(settlementMethod)}
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
 const order=({end_asc:"c.ends_at ASC",remaining_asc:"c.ends_at ASC",end_desc:"c.ends_at DESC",remaining_desc:"c.ends_at DESC",start_desc:"c.starts_at DESC",start_asc:"c.starts_at ASC",salary_desc:"c.caregiver_salary_rial DESC",salary_asc:"c.caregiver_salary_rial ASC",stars_desc:"COALESCE(r.stars,0) DESC,c.ends_at ASC",stars_asc:"COALESCE(r.stars,0) ASC,c.ends_at ASC",duration_desc:"c.duration_days DESC",duration_asc:"c.duration_days ASC",points_desc:"COALESCE(jc.total_points_units,0) DESC,c.starts_at DESC",points_asc:"COALESCE(jc.total_points_units,0) ASC,c.starts_at DESC"} as Record<string,string>)[sort]||"c.ends_at ASC";
 const base=`FROM contract_cases_v3 c JOIN caregivers g ON g.id=c.primary_caregiver_id LEFT JOIN care_job_ads a ON a.id=c.job_ad_id LEFT JOIN users consultant ON consultant.id=a.sales_consultant_user_id LEFT JOIN caregiver_job_contracts jc ON jc.id=c.job_contract_id LEFT JOIN (SELECT contract_case_id,MAX(COALESCE(stars_snapshot,0)) stars FROM contract_service_providers_v3 GROUP BY contract_case_id) r ON r.contract_case_id=c.id WHERE ${clauses.join(" AND ")}`;
 const [rows,count,consultants]=await Promise.all([
  env.DB.prepare(`SELECT c.*,g.full_name AS caregiverName,g.membership_code AS membershipCode,COALESCE(r.stars,0) AS caregiverStars,a.sales_consultant_user_id AS consultantId,consultant.full_name AS consultantName,a.contract_type AS contractType,a.shift_type AS shiftType ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds,pageSize,offset).all<any>(),
  env.DB.prepare(`SELECT COUNT(*) AS total ${base}`).bind(...binds).first<{total:number}>(),
  env.DB.prepare("SELECT DISTINCT u.id,u.full_name AS fullName FROM contract_cases_v3 c JOIN care_job_ads a ON a.id=c.job_ad_id JOIN users u ON u.id=a.sales_consultant_user_id WHERE a.sales_consultant_user_id IS NOT NULL ORDER BY u.full_name COLLATE NOCASE").all<any>(),
 ]);
 const now=new Date().toISOString(),contracts=(rows.results||[]).map((row:any)=>{const duration=Math.max(1,Number(row.duration_days||1)),remaining=Math.max(0,daysBetween(now,String(row.ends_at||now))),elapsed=Math.max(0,daysBetween(String(row.starts_at||now),now));return{...row,remainingDays:remaining,elapsedDays:Math.min(duration,elapsed),progressPercent:Math.round(Math.min(1,elapsed/duration)*100),renewalState:renewalState(remaining,String(row.status||""))}}),total=Number(count?.total||0);
 return{contracts,pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))},filterOptions:{consultants:consultants.results||[]}};
}

export async function decorateContractListPointsV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url);
 if(request.method.toUpperCase()!=="GET"||!/^\/api\/staff\/contracts-v2\/?$/.test(url.pathname)||!response.ok)return response;
 const contentType=response.headers.get("content-type")||"";if(!contentType.includes("application/json"))return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 let rebuilt:any;try{rebuilt=await canonicalList(request,env)}catch(error){if(String(error).includes("invalid_jalali_date"))return fail("تاریخ شمسی را به شکل ۱۴۰۵/۰۵/۲۱ وارد کنید.",400,"invalid_jalali_date");throw error}
 payload.data.contracts=rebuilt.contracts;payload.data.pagination=rebuilt.pagination;payload.data.filterOptions=rebuilt.filterOptions;
 const rows=payload.data.contracts as any[],ids=[...new Set(rows.map((row:any)=>String(row?.job_contract_id||"")).filter(Boolean))];
 if(ids.length){
  const placeholders=ids.map(()=>"?").join(","),result=await env.DB.prepare(`SELECT id,total_points_units AS totalPointsUnits,earned_points_units AS earnedPointsUnits FROM caregiver_job_contracts WHERE id IN (${placeholders})`).bind(...ids).all<any>(),byId=new Map((result.results||[]).map((row:any)=>[String(row.id),row]));
  payload.data.contracts=rows.map((row:any)=>{const points:any=byId.get(String(row?.job_contract_id||"")),total=unitsToPoints(points?.totalPointsUnits),earned=unitsToPoints(points?.earnedPointsUnits),remaining=Math.max(0,Math.round((total-earned)*100)/100);return{...row,totalPoints:total,earnedPoints:earned,remainingPoints:remaining,pointsProgressPercent:total>0?Math.max(0,Math.min(100,Math.round((earned/total)*1000)/10)):0}});
 }
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-contract-list-points","1.3.0");headers.set("x-salamat-contract-list-source","multi-period-v3-jalali-mobile-filters");
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}