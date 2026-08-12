import app from "./index-desktop-react-v1";
import {routeContractLifecycleV2,reconcileContractCaseByApplication} from "./contract-lifecycle-v2";

type Ctx={waitUntil(p:Promise<unknown>):void};

export default {
 async fetch(request:Request,env:any,ctx:Ctx){
  const own=await routeContractLifecycleV2(request,env);if(own)return own;
  const url=new URL(request.url),method=request.method.toUpperCase();
  const match=url.pathname.match(/^\/api\/staff\/job-ads\/([^/]+)\/applications\/([^/]+)$/);
  let body:any=null;
  if(match&&method==="PATCH")body=await request.clone().json().catch(()=>null);
  const response=await app.fetch(request,env,ctx);
  if(match&&method==="PATCH"&&response.ok&&String(body?.status||"").toUpperCase()==="IN_CONTRACT"){
   ctx.waitUntil(reconcileContractCaseByApplication(env,decodeURIComponent(match[2])).catch(()=>undefined));
  }
  return response;
 },
 async scheduled(controller:any,env:any,ctx:Ctx){if(typeof (app as any).scheduled==="function")return (app as any).scheduled(controller,env,ctx)}
};
