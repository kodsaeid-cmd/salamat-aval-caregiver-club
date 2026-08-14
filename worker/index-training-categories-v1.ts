import app from "./index-desktop-react-v1";
import {type AuthUser,type Env,getUser,nowIso,str} from "./lib";

const TRAINING_CATEGORIES=[
 "باشگاه مراقبین سلامت اول",
 "پیش از اعزام",
 "آموزش‌های حین اعزام",
 "بازآموزی‌های در قرارداد",
 "آموزش‌های تخصصی",
] as const;
const NOTIFICATION_ROLLOUT_AT="2026-08-09T18:40:00.000Z";

function normalize(value:unknown){return String(value??"").trim().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ")}
function canonicalCategory(value:unknown){
 const raw=normalize(value);
 if(["باشگاه مراقبین سلامت اول","باشگاه مراقبین","باشگاه","عمومی","آموزش سازمانی"].some(x=>normalize(x)===raw))return TRAINING_CATEGORIES[0];
 if(["پیش از اعزام","پیش‌از اعزام","مصاحبه","اعزام آزمایشی"].some(x=>normalize(x)===raw))return TRAINING_CATEGORIES[1];
 if(/حین اعزام/.test(raw))return TRAINING_CATEGORIES[2];
 if(/بازآموز|در قرارداد/.test(raw))return TRAINING_CATEGORIES[3];
 if(/تخصص/.test(raw))return TRAINING_CATEGORIES[4];
 return TRAINING_CATEGORIES[0];
}

async function canonicalTrainingRequest(request:Request){
 const url=new URL(request.url),method=request.method.toUpperCase();
 const create=url.pathname==="/api/training/courses"&&method==="POST";
 const update=/^\/api\/training\/courses\/[^/]+$/.test(url.pathname)&&method==="PATCH";
 if(!create&&!update)return request;
 const body=await request.clone().json().catch(()=>null) as Record<string,unknown>|null;
 if(!body)return request;
 if(create||body.category!==undefined)body.category=canonicalCategory(body.category);
 const headers=new Headers(request.headers);headers.set("content-type","application/json");
 return new Request(request.url,{method:request.method,headers,body:JSON.stringify(body)});
}

type TrainingNoticeRow={enrollmentId:string;assignedAt:string;title:string;category:string|null;assignmentNote:string|null};
async function safeTrainingRows(env:Env,caregiverId:string){
 try{
  const result=await env.DB.prepare(`SELECT e.id AS enrollmentId,e.assigned_at AS assignedAt,c.title,c.category,m.assignment_note AS assignmentNote
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    LEFT JOIN training_assignment_meta m ON m.enrollment_id=e.id
    WHERE e.caregiver_id=? AND UPPER(COALESCE(e.status,''))<>'CANCELLED' AND UPPER(COALESCE(c.status,'ACTIVE'))='ACTIVE'
    ORDER BY e.assigned_at DESC LIMIT 60`).bind(caregiverId).all<TrainingNoticeRow>();
  return result.results||[];
 }catch{return [] as TrainingNoticeRow[]}
}
async function trainingSeenAt(env:Env,caregiverId:string){
 try{const row=await env.DB.prepare("SELECT last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key='training' LIMIT 1").bind(caregiverId).first<{lastSeenAt:string}>();return str(row?.lastSeenAt)||NOTIFICATION_ROLLOUT_AT}catch{return NOTIFICATION_ROLLOUT_AT}
}
function preserveJson(response:Response,payload:unknown){const headers=new Headers(response.headers);headers.set("content-type","application/json; charset=utf-8");headers.delete("content-length");return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers})}
async function withTrainingNotifications(response:Response,env:Env,actor:AuthUser){
 if(!response.ok||actor.role.toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return response;
 const payload=await response.clone().json().catch(()=>null) as any;if(!payload?.data)return response;
 const [rows,seenAt]=await Promise.all([safeTrainingRows(env,actor.caregiverId),trainingSeenAt(env,actor.caregiverId)]);
 const trainingItems=rows.map(row=>({
  id:`training:${row.enrollmentId}:${row.assignedAt}`,
  moduleKey:"training",
  kind:"TRAINING_ASSIGNED",
  title:"آموزش جدید برای شما ارسال شد",
  body:`${row.title} • ${canonicalCategory(row.category)}${row.assignmentNote?` • ${str(row.assignmentNote)}`:""}`,
  createdAt:row.assignedAt,
  route:"training",
  unread:String(row.assignedAt)>String(seenAt),
 }));
 const existing=Array.isArray(payload.data.items)?payload.data.items:[];
 const existingIds=new Set(existing.map((item:any)=>String(item.id)));
 const items=[...trainingItems.filter(item=>!existingIds.has(item.id)),...existing]
  .filter(item=>item?.createdAt).sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,160);
 const unreadByModule={...(payload.data.unreadByModule||{})};
 unreadByModule.training=items.filter((item:any)=>item.moduleKey==="training"&&item.unread).length;
 payload.data.items=items;
 payload.data.unreadByModule=unreadByModule;
 payload.data.unreadTotal=Object.values(unreadByModule).reduce((sum:number,value:any)=>sum+Number(value||0),0);
 payload.data.generatedAt=nowIso();
 return preserveJson(response,payload);
}

export default{
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url),method=request.method.toUpperCase();
  const next=await canonicalTrainingRequest(request);
  const response=await app.fetch(next,env);
  if(url.pathname==="/api/caregiver/notifications"&&method==="GET"){
   const actor=await getUser(request,env);
   if(actor)return withTrainingNotifications(response,env,actor);
  }
  return response;
 },
};
