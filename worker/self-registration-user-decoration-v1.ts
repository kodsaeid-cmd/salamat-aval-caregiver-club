import {type Env} from "./lib";

type Row={recruitmentStage?:string;active?:number;cooperationStatus?:string;createdAt?:string};

export async function decorateSelfRegistrationUsersV1(request:Request,env:Env,response:Response){
 const url=new URL(request.url);
 if(request.method.toUpperCase()!=="GET"||url.pathname!=="/api/users"||!response.ok)return response;
 try{
  const payload:any=await response.clone().json();
  if(!Array.isArray(payload?.data))return response;
  let pending=0,newJoiners=0;
  for(const user of payload.data){
   const caregiverId=String(user?.caregiverId||user?.caregiver_id||"");
   if(!caregiverId)continue;
   const row=await env.DB.prepare("SELECT recruitment_stage AS recruitmentStage,active,cooperation_status AS cooperationStatus,created_at AS createdAt FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first<Row>();
   if(!row)continue;
   const selfRegistered=String(row.recruitmentStage||"").toUpperCase()==="SELF_REGISTERED";
   const waiting=selfRegistered&&Number(row.active||0)!==1;
   user.selfRegistered=selfRegistered;
   if(!waiting)continue;
   user.status="PENDING";
   user.pendingApproval=true;
   user.caregiverActive=false;
   user.cooperationStatus=row.cooperationStatus||"در انتظار تأیید مدیر";
   pending+=1;
   const created=Date.parse(row.createdAt||user.createdAt||"");
   const fresh=!Number.isFinite(created)||Date.now()-created<=7*86400000;
   user.newJoiner=fresh;
   if(fresh)newJoiners+=1;
  }
  payload.meta={...(payload.meta||{}),pendingCaregiverApprovals:pending,newNetworkJoiners:newJoiners};
  const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");headers.set("x-salamat-pending-registration-unity","1.0.0");
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
 }catch{return response}
}
