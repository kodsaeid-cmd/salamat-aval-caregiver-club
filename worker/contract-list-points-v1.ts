import {decorateContractListPointsV1 as decorateBaseContractList} from "./contract-list-points-base-v1";
import {type Env,audit,fail,getUser,json,nowIso} from "./lib";

let deletionSchemaReady:Promise<void>|undefined;

async function ensureContractDeletionSchema(env:Env){
 if(!deletionSchemaReady){
  deletionSchemaReady=env.DB.batch([
   env.DB.prepare(`CREATE TABLE IF NOT EXISTS contract_admin_deletions_v1(
    contract_case_id TEXT PRIMARY KEY,
    job_contract_id TEXT NOT NULL UNIQUE,
    job_ad_id TEXT NOT NULL,
    contract_number TEXT,
    contract_title TEXT,
    deleted_by_user_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    snapshot_json TEXT NOT NULL DEFAULT '{}'
   )`),
   env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_admin_deletions_v1_job_ad ON contract_admin_deletions_v1(job_ad_id,deleted_at DESC)"),
  ]).then(()=>undefined).catch(error=>{deletionSchemaReady=undefined;throw error});
 }
 return deletionSchemaReady;
}

async function deletedContractIds(env:Env,ids:string[]){
 await ensureContractDeletionSchema(env);
 if(!ids.length)return new Set<string>();
 const placeholders=ids.map(()=>"?").join(",");
 const rows=await env.DB.prepare(`SELECT contract_case_id AS id FROM contract_admin_deletions_v1 WHERE contract_case_id IN (${placeholders})`).bind(...ids).all<{id:string}>();
 return new Set((rows.results||[]).map(row=>String(row.id)));
}

async function isDeletedContract(env:Env,id:string){
 await ensureContractDeletionSchema(env);
 const row=await env.DB.prepare("SELECT contract_case_id AS id FROM contract_admin_deletions_v1 WHERE contract_case_id=? LIMIT 1").bind(id).first<{id:string}>();
 return Boolean(row?.id);
}

async function deleteContractAsAdmin(request:Request,env:Env,id:string){
 await ensureContractDeletionSchema(env);
 const actor=await getUser(request,env);
 if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 if(String(actor.role||"").toUpperCase()!=="ADMIN")return fail("حذف قرارداد فقط در اختیار مدیر سامانه است.",403,"admin_only");
 const row=await env.DB.prepare(`SELECT id,job_contract_id AS jobContractId,job_ad_id AS jobAdId,source_application_id AS applicationId,contract_number AS contractNumber,contract_title AS contractTitle,primary_caregiver_id AS caregiverId,status,starts_at AS startsAt,ends_at AS endsAt,caregiver_salary_rial AS caregiverSalaryRial,duration_days AS durationDays FROM contract_cases_v3 WHERE id=? LIMIT 1`).bind(id).first<any>();
 if(!row)return fail("قرارداد پیدا نشد.",404,"contract_not_found");
 const deletedAt=nowIso(),snapshot={...row};
 await env.DB.prepare(`INSERT INTO contract_admin_deletions_v1(contract_case_id,job_contract_id,job_ad_id,contract_number,contract_title,deleted_by_user_id,deleted_at,snapshot_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(contract_case_id) DO UPDATE SET deleted_by_user_id=excluded.deleted_by_user_id,deleted_at=excluded.deleted_at,snapshot_json=excluded.snapshot_json`).bind(row.id,row.jobContractId,row.jobAdId,row.contractNumber||null,row.contractTitle||null,actor.id,deletedAt,JSON.stringify(snapshot)).run();
 await audit(request,env,actor,"ADMIN_DELETE_CONTRACT","contract_case_v3",id,{jobContractId:row.jobContractId,jobAdId:row.jobAdId,applicationId:row.applicationId,contractNumber:row.contractNumber,preservedOperationalHistory:true});
 return json({data:{id,deleted:true,deletedAt,preservedOperationalHistory:true}});
}

async function filterDeletedFromList(env:Env,response:Response){
 if(!response.ok)return response;
 const contentType=response.headers.get("content-type")||"";
 if(!contentType.includes("application/json"))return response;
 const payload:any=await response.clone().json().catch(()=>null);
 const contracts=Array.isArray(payload?.data?.contracts)?payload.data.contracts:null;
 if(!contracts)return response;
 const hidden=await deletedContractIds(env,contracts.map((row:any)=>String(row?.id||"")).filter(Boolean));
 if(!hidden.size)return response;
 payload.data.contracts=contracts.filter((row:any)=>!hidden.has(String(row?.id||"")));
 if(payload.data.pagination){
  const removed=contracts.length-payload.data.contracts.length;
  const total=Math.max(0,Number(payload.data.pagination.total||0)-removed);
  payload.data.pagination={...payload.data.pagination,total,totalPages:Math.max(1,Math.ceil(total/Math.max(1,Number(payload.data.pagination.pageSize||40))))};
 }
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-admin-contract-delete","1.0.0");
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

export async function decorateContractListPointsV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url),method=request.method.toUpperCase();
 const itemMatch=url.pathname.match(/^\/api\/staff\/contracts-v2\/([^/]+)$/);
 if(method==="DELETE"&&itemMatch&&itemMatch[1]!=="support-users")return deleteContractAsAdmin(request,env,decodeURIComponent(itemMatch[1]));
 if(method==="GET"&&itemMatch&&itemMatch[1]!=="support-users"){
  const id=decodeURIComponent(itemMatch[1]);
  if(await isDeletedContract(env,id))return fail("قرارداد پیدا نشد.",404,"contract_not_found");
 }
 const decorated=await decorateBaseContractList(request,env,response);
 if(method==="GET"&&/^\/api\/staff\/contracts-v2\/?$/.test(url.pathname))return filterDeletedFromList(env,decorated);
 return decorated;
}
