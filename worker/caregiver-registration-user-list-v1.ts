import {type Env,securityHeaders} from "./lib";

type RegistrationMeta={eventId:string;caregiverId:string;registrationKind:string;registeredAt:string;adminSeenAt:string|null};

export async function decorateUserListRegistrationV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(method!=="GET"||url.pathname!=="/api/users"||!response.ok)return response;
 const payload:any=await response.clone().json().catch(()=>null),rows=Array.isArray(payload?.data)?payload.data:null;
 if(!rows?.length)return response;
 const caregiverIds=[...new Set(rows.map((row:any)=>String(row?.caregiverId||row?.caregiver_id||"")).filter(Boolean))].slice(0,250);
 if(!caregiverIds.length)return response;
 const placeholders=caregiverIds.map(()=>"?").join(",");
 let metadata:RegistrationMeta[]=[];
 try{
  const result=await env.DB.prepare(`SELECT e.id AS eventId,e.caregiver_id AS caregiverId,e.registration_kind AS registrationKind,e.registered_at AS registeredAt,e.admin_seen_at AS adminSeenAt
   FROM caregiver_registration_events e
   WHERE e.caregiver_id IN (${placeholders})
     AND e.id=(SELECT e2.id FROM caregiver_registration_events e2 WHERE e2.caregiver_id=e.caregiver_id ORDER BY e2.registered_at DESC,e2.id DESC LIMIT 1)`).bind(...caregiverIds).all<RegistrationMeta>();
  metadata=result.results||[];
 }catch{return response}
 if(!metadata.length)return response;
 const byCaregiver=new Map(metadata.map(item=>[String(item.caregiverId),item]));
 payload.data=rows.map((row:any)=>{const meta=byCaregiver.get(String(row?.caregiverId||row?.caregiver_id||""));return meta?{...row,registrationEventId:meta.eventId,registrationKind:meta.registrationKind,registeredAt:meta.registeredAt,registrationUnseen:!meta.adminSeenAt}:row});
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");return securityHeaders(new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers}));
}
