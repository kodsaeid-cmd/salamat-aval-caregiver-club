import {individualEffectivePermissions} from "./individual-access-v2";
import {
  type AuthUser,type Env,audit,fail,getUser,hashPassword,json,normalizeMobile,normalizeRole,
  nowIso,randomId,readBody,securityHeaders,str,
} from "./lib";

const REGISTRATION_PATH="/api/public/caregivers/register";
const SUCCESS_MESSAGE="تبریک! شما به شبکه مراقبین سلامت اول پیوستید.";
const NATIONAL_ID_SQL=`replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(COALESCE(national_id,''),'۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9'),'٠','0'),'١','1'),'٢','2'),'٣','3'),'٤','4'),'٥','5'),'٦','6'),'٧','7'),'٨','8'),'٩','9')`;

type RegistrationKind="NEW"|"REREGISTRATION";
type ExistingCaregiver={id:string;fullName:string;mobile:string;nationalId:string|null;membershipCode:string|null};
type ExistingUser={id:string;caregiverId:string|null;mobile:string;username:string|null;status:string;createdAt:string};

function normalizeDigits(value:unknown){return str(value).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g,"")}
function validNationalId(value:string){return /^\d{10}$/.test(value)}
function validMobile(value:string){return /^09\d{9}$/.test(value)}
function skillsFrom(value:unknown){return str(value).split(/[,،]/).map(x=>x.trim()).filter(Boolean)}

async function canViewUsers(env:Env,actor:AuthUser){
 if(normalizeRole(actor.role)==="ADMIN")return true;
 const module=(await individualEffectivePermissions(env,actor)).find(item=>item.key==="staff.users");
 return Boolean(module?.actions?.view);
}
async function requireUsersViewer(request:Request,env:Env){
 const actor=await getUser(request,env);if(!actor)return{response:securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized")),actor:null};
 if(!await canViewUsers(env,actor))return{response:securityHeaders(fail("دسترسی مشاهده کاربران فعال نیست.",403,"forbidden")),actor:null};
 return{response:null,actor};
}

async function findCaregiverByNationalId(env:Env,nationalId:string){
 const rows=await env.DB.prepare(`SELECT id,full_name AS fullName,mobile,national_id AS nationalId,membership_code AS membershipCode FROM caregivers WHERE ${NATIONAL_ID_SQL}=? AND COALESCE(cooperation_status,'')<>'حذف‌شده' LIMIT 2`).bind(nationalId).all<ExistingCaregiver>();
 return rows.results||[];
}
async function caregiverUser(env:Env,caregiverId:string){
 return env.DB.prepare(`SELECT id,caregiver_id AS caregiverId,mobile,username,status,created_at AS createdAt FROM users WHERE caregiver_id=? AND upper(role)='CAREGIVER' AND upper(status)<>'DELETED' ORDER BY created_at DESC LIMIT 1`).bind(caregiverId).first<ExistingUser>();
}
async function ensureNoIdentityCollision(env:Env,caregiverId:string,userId:string|null,mobile:string){
 const caregiverCollision=await env.DB.prepare(`SELECT id FROM caregivers WHERE mobile=? AND id<>? AND COALESCE(cooperation_status,'')<>'حذف‌شده' LIMIT 1`).bind(mobile,caregiverId).first<{id:string}>();
 if(caregiverCollision)return false;
 const userCollision=await env.DB.prepare(`SELECT id FROM users WHERE upper(status)<>'DELETED' AND id<>COALESCE(?, '') AND (mobile=? OR lower(COALESCE(username,''))=?) LIMIT 1`).bind(userId,mobile,mobile.toLowerCase()).first<{id:string}>();
 return !userCollision;
}

async function registerExistingCaregiver(request:Request,env:Env,caregiver:ExistingCaregiver,body:any,nationalId:string,mobile:string){
 const fullName=str(body.fullName||body.name);if(fullName.length<3)return securityHeaders(fail("نام و نام خانوادگی را کامل وارد کنید."));
 if(!validMobile(mobile))return securityHeaders(fail("شماره همراه معتبر نیست."));
 const currentUser=await caregiverUser(env,caregiver.id);
 if(!await ensureNoIdentityCollision(env,caregiver.id,currentUser?.id||null,mobile))return securityHeaders(fail("این شماره همراه هم‌اکنون به پرونده یا حساب دیگری متصل است.",409,"mobile_already_in_use"));
 const timestamp=nowIso(),eventId=randomId("reg_"),userId=currentUser?.id||randomId("usr_"),passwordHash=await hashPassword(nationalId),skills=skillsFrom(body.skills),previousMobile=str(caregiver.mobile)||null;
 const caregiverUpdate=env.DB.prepare(`UPDATE caregivers SET
   national_id=?,full_name=?,mobile=?,city=?,service_region=?,birth_date=?,primary_type=?,skills_json=?,work_history=?,
   active=0,recruitment_stage='SELF_REGISTERED',cooperation_status='در انتظار تأیید مدیر',profile_completed=1,last_synced_at=?,updated_at=?
   WHERE id=?`).bind(nationalId,fullName,mobile,str(body.city)||null,str(body.address)||null,str(body.birthDate)||null,str(body.serviceGroup)||null,JSON.stringify(skills),str(body.bio)||null,timestamp,timestamp,caregiver.id);
 const eventInsert=env.DB.prepare(`INSERT INTO caregiver_registration_events(id,caregiver_id,user_id,registration_kind,previous_mobile,new_mobile,registered_at,created_at) VALUES(?,?,?,'REREGISTRATION',?,?,?,?)`).bind(eventId,caregiver.id,userId,previousMobile,mobile,timestamp,timestamp);
 try{
  if(currentUser){
   await env.DB.batch([
    caregiverUpdate,
    env.DB.prepare(`UPDATE users SET full_name=?,mobile=?,username=?,password_hash=?,status='PENDING',updated_at=? WHERE id=?`).bind(fullName,mobile,mobile,passwordHash,timestamp,currentUser.id),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(currentUser.id),
    eventInsert,
   ]);
  }else{
   await env.DB.batch([
    caregiverUpdate,
    env.DB.prepare(`INSERT INTO users(id,caregiver_id,full_name,mobile,username,password_hash,role,status,permissions_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'CAREGIVER','PENDING','[]',?,?)`).bind(userId,caregiver.id,fullName,mobile,mobile,passwordHash,timestamp,timestamp),
    eventInsert,
   ]);
  }
 }catch(error){
  const detail=error instanceof Error?error.message:String(error);console.error("caregiver_reregistration_failed",{caregiverId:caregiver.id,detail});
  return securityHeaders(fail("ثبت‌نام مجدد انجام نشد؛ شماره همراه یا حساب ورود با رکورد دیگری تداخل دارد.",409,"reregistration_conflict"));
 }
 await audit(request,env,null,"CAREGIVER_REREGISTRATION_PENDING","caregiver",caregiver.id,{eventId,userId,previousMobile,newMobile:mobile,nationalIdMatched:true,status:"PENDING"});
 return securityHeaders(json({message:SUCCESS_MESSAGE,data:{requestCode:userId,userId,caregiverId:caregiver.id,membershipCode:caregiver.membershipCode||caregiver.id,username:mobile,mobile,status:"PENDING",accountCreated:!currentUser,registrationKind:"REREGISTRATION",reregistration:true,eventId}},201));
}

export async function routeCaregiverReregistrationV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname===REGISTRATION_PATH&&method==="POST"){
  const body=await readBody(request.clone());if(!body)return securityHeaders(fail("اطلاعات ثبت‌نام معتبر نیست."));
  const nationalId=normalizeDigits(body.nationalId),mobile=normalizeMobile(str(body.mobile))||"";
  if(!validNationalId(nationalId))return null;
  const matches=await findCaregiverByNationalId(env,nationalId);if(!matches.length)return null;
  if(matches.length>1)return securityHeaders(fail("برای این کد ملی بیش از یک پرونده قدیمی پیدا شد. برای جلوگیری از اتصال اشتباه، پرونده باید توسط مدیر سامانه یکپارچه شود.",409,"ambiguous_national_id"));
  return registerExistingCaregiver(request,env,matches[0],body,nationalId,mobile);
 }
 if(url.pathname==="/api/admin/caregiver-registrations/summary"&&method==="GET"){
  const guard=await requireUsersViewer(request,env);if(guard.response)return guard.response;
  const rows=await env.DB.prepare(`SELECT e.registration_kind AS kind,COUNT(*) AS total,SUM(CASE WHEN e.admin_seen_at IS NULL THEN 1 ELSE 0 END) AS unseen
   FROM caregiver_registration_events e
   JOIN users u ON u.caregiver_id=e.caregiver_id AND upper(u.role)='CAREGIVER' AND upper(u.status)='PENDING'
   WHERE e.id=(SELECT e2.id FROM caregiver_registration_events e2 WHERE e2.caregiver_id=e.caregiver_id ORDER BY e2.registered_at DESC,e2.id DESC LIMIT 1)
   GROUP BY e.registration_kind`).all<any>();
  const summary={NEW:{total:0,unseen:0},REREGISTRATION:{total:0,unseen:0}} as Record<RegistrationKind,{total:number;unseen:number}>;
  for(const row of rows.results||[]){const kind=String(row.kind||"").toUpperCase() as RegistrationKind;if(summary[kind])summary[kind]={total:Number(row.total||0),unseen:Number(row.unseen||0)}}
  return securityHeaders(json({data:{newRegistrations:summary.NEW.total,reregistrations:summary.REREGISTRATION.total,unseenReregistrations:summary.REREGISTRATION.unseen}}));
 }
 if(url.pathname==="/api/admin/caregiver-registrations"&&method==="GET"){
  const guard=await requireUsersViewer(request,env);if(guard.response)return guard.response;
  const kind=String(url.searchParams.get("kind")||"").toUpperCase();if(!["NEW","REREGISTRATION"].includes(kind))return securityHeaders(fail("نوع ثبت‌نام معتبر نیست."));
  const page=Math.max(1,Number(url.searchParams.get("page")||1)||1),pageSize=Math.min(50,Math.max(1,Number(url.searchParams.get("pageSize")||50)||50)),offset=(page-1)*pageSize,q=str(url.searchParams.get("q")).trim(),sort=String(url.searchParams.get("sort")||"NEWEST").toUpperCase()==="OLDEST"?"ASC":"DESC";
  const qLike=`%${q}%`,whereQ=q?` AND (u.full_name LIKE ? OR u.mobile LIKE ? OR COALESCE(u.username,'') LIKE ? OR c.full_name LIKE ? OR c.mobile LIKE ? OR COALESCE(c.national_id,'') LIKE ? OR COALESCE(c.membership_code,'') LIKE ?)` : "";
  const bindings:any[]=[kind];if(q)bindings.push(qLike,qLike,qLike,qLike,qLike,qLike,qLike);
  const base=` FROM caregiver_registration_events e JOIN caregivers c ON c.id=e.caregiver_id JOIN users u ON u.caregiver_id=c.id AND upper(u.role)='CAREGIVER' AND upper(u.status)<>'DELETED' WHERE e.registration_kind=? AND e.id=(SELECT e2.id FROM caregiver_registration_events e2 WHERE e2.caregiver_id=e.caregiver_id ORDER BY e2.registered_at DESC,e2.id DESC LIMIT 1)${whereQ}`;
  const count=await env.DB.prepare(`SELECT COUNT(*) AS total${base}`).bind(...bindings).first<{total:number}>();
  const rows=await env.DB.prepare(`SELECT u.id,u.caregiver_id AS caregiverId,u.full_name AS fullName,u.mobile,u.username,u.role,u.status,u.created_at AS createdAt,c.national_id AS nationalId,c.membership_code AS membershipCode,e.id AS registrationEventId,e.registration_kind AS registrationKind,e.registered_at AS registeredAt,e.admin_seen_at AS adminSeenAt${base} ORDER BY e.registered_at ${sort},e.id ${sort} LIMIT ? OFFSET ?`).bind(...bindings,pageSize,offset).all<any>();
  const total=Number(count?.total||0),totalPages=Math.max(1,Math.ceil(total/pageSize));
  return securityHeaders(json({data:(rows.results||[]).map((row:any)=>({...row,pendingApproval:String(row.status||"").toUpperCase()==="PENDING",selfRegistered:true,registrationUnseen:!row.adminSeenAt})),pagination:{page,pageSize,total,totalPages,hasNext:page<totalPages,hasPrevious:page>1}}));
 }
 if(url.pathname==="/api/admin/caregiver-registrations/seen"&&method==="POST"){
  const guard=await requireUsersViewer(request,env);if(guard.response)return guard.response;
  const body=await readBody(request);const ids=Array.isArray(body?.eventIds)?body.eventIds.map((x:any)=>str(x)).filter(Boolean).slice(0,50):[];if(!ids.length)return securityHeaders(json({data:{updated:0}}));
  const placeholders=ids.map(()=>"?").join(","),timestamp=nowIso();const result=await env.DB.prepare(`UPDATE caregiver_registration_events SET admin_seen_at=COALESCE(admin_seen_at,?) WHERE registration_kind='REREGISTRATION' AND id IN (${placeholders})`).bind(timestamp,...ids).run();
  await audit(request,env,guard.actor!,"MARK_REREGISTRATION_SEEN","caregiver_registration_event",null,{eventIds:ids});
  return securityHeaders(json({data:{updated:Number(result.meta?.changes||0)}}));
 }
 return null;
}

export async function recordNewCaregiverRegistrationV1(env:Env,response:Response){
 if(!response.ok)return response;const payload:any=await response.clone().json().catch(()=>null),caregiverId=str(payload?.data?.caregiverId),userId=str(payload?.data?.userId||payload?.data?.requestCode),mobile=normalizeMobile(str(payload?.data?.mobile||payload?.data?.username))||"";
 if(!caregiverId||!userId||!validMobile(mobile))return response;
 const exists=await env.DB.prepare(`SELECT id FROM caregiver_registration_events WHERE caregiver_id=? ORDER BY registered_at DESC LIMIT 1`).bind(caregiverId).first<{id:string}>();if(exists)return response;
 const timestamp=nowIso(),eventId=randomId("reg_");
 await env.DB.prepare(`INSERT INTO caregiver_registration_events(id,caregiver_id,user_id,registration_kind,previous_mobile,new_mobile,registered_at,created_at) VALUES(?,?,?,'NEW',NULL,?,?,?)`).bind(eventId,caregiverId,userId,mobile,timestamp,timestamp).run();
 return response;
}

export async function recordCaregiverRegistrationApprovalV1(env:Env,response:Response){
 if(!response.ok)return response;const payload:any=await response.clone().json().catch(()=>null),caregiverId=str(payload?.data?.caregiverId),status=String(payload?.data?.status||"").toUpperCase();if(!caregiverId||!["ACTIVE","APPROVED"].includes(status))return response;
 await env.DB.prepare(`UPDATE caregiver_registration_events SET approved_at=COALESCE(approved_at,?) WHERE caregiver_id=? AND id=(SELECT id FROM caregiver_registration_events WHERE caregiver_id=? ORDER BY registered_at DESC,id DESC LIMIT 1)`).bind(nowIso(),caregiverId,caregiverId).run();
 return response;
}
