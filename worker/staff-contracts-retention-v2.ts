import {routeStaffContractsV1} from "./staff-contracts-v1";
import {reconcileRetentionRewardsForCaregiver} from "./retention-rewards-v1";
import {type Env,str} from "./lib";

export async function routeStaffContractsRetentionV2(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();
 const owns=path==="/api/staff/contracts"||path==="/api/staff/contracts/caregivers"||/^\/api\/staff\/contracts\/[^/]+$/.test(path);
 if(!owns)return null;
 let body:any=null;const write=method==="POST"||(method==="PATCH"&&/^\/api\/staff\/contracts\/[^/]+$/.test(path));
 if(write)body=await request.clone().json().catch(()=>null);
 const response=await routeStaffContractsV1(request,env);if(!response||!response.ok||!write)return response;
 try{
  let caregiverId=str(body?.caregiverId);
  if(!caregiverId&&method==="PATCH"){
   const id=decodeURIComponent(path.split("/").pop()||"");
   const row=await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM contracts WHERE id=? LIMIT 1").bind(id).first<{caregiverId:string}>();caregiverId=str(row?.caregiverId);
  }
  if(caregiverId)await reconcileRetentionRewardsForCaregiver(env,caregiverId);
 }catch(error){console.error("retention_reward_contract_reconcile_failed",{path,error:error instanceof Error?error.message:String(error)})}
 return response;
}
