import app from "./index-mobile-reset-v1";
import {routeContractLifecycleV2,reconcileContractCaseByApplication} from "./contract-lifecycle-v2";
import {reconcileLegacyOpenContracts} from "./legacy-contract-compat-v1";
import {decorateLegacyJobAdContractState} from "./legacy-job-ad-decoration-v1";

type Ctx={waitUntil(p:Promise<unknown>):void};

export default {
 async fetch(request:Request,env:any,ctx:Ctx){
  const own=await routeContractLifecycleV2(request,env);if(own)return own;
  const url=new URL(request.url),method=request.method.toUpperCase();
  const match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
  let body:any=null;
  if(match&&method==="PATCH")body=await request.clone().json().catch(()=>null);
  let response=await app.fetch(request,env,ctx);
  if(match&&method==="PATCH"&&response.ok&&String(body?.status||"").toUpperCase()==="IN_CONTRACT"){
   ctx.waitUntil(reconcileContractCaseByApplication(env,decodeURIComponent(match[2])).catch(()=>undefined));
  }
  response=await decorateLegacyJobAdContractState(request,env,response);
  return response;
 },
 async scheduled(controller:any,env:any,ctx:Ctx){
  ctx.waitUntil(reconcileLegacyOpenContracts(env).catch(error=>{console.error("legacy_contract_scheduled_reconcile_failed",error instanceof Error?error.message:String(error))}));
  if(typeof (app as any).scheduled==="function")return (app as any).scheduled(controller,env,ctx);
 }
};
