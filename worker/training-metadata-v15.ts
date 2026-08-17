import {requireAccess} from "./access-control";
import {audit,ensureSchema,fail,findCaregiverId,getUser,json,nowIso,randomId,readBody,str,type Env} from "./lib";
import {isValidTrainingTaxonomy,normalizeTrainingCategoryAudience,normalizeTrainingCategoryGroup,normalizeTrainingCategoryStage,normalizeTrainingDeliveryMode,normalizeTrainingLearningNature,trainingCategoryLabel,trainingDeliveryLabel,trainingNatureLabel} from "../shared/training-taxonomy-v2";

let schemaReady:Promise<void>|undefined;
const OPTIONAL_EMPTY_SENTINEL="__SALAMAT_OPTIONAL_EMPTY__";

async function ensureTrainingMetadataSchemaV15(env:Env){
 await ensureSchema(env);
 if(!schemaReady){
  schemaReady=(async()=>{
   await env.DB.prepare(`CREATE TABLE IF NOT EXISTS courses(
    id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT,category TEXT,
    cover_url TEXT,content_url TEXT,duration_minutes INTEGER NOT NULL DEFAULT 0,
    mandatory INTEGER NOT NULL DEFAULT 0 CHECK (mandatory IN (0,1)),credit INTEGER NOT NULL DEFAULT 0,
    passing_score INTEGER NOT NULL DEFAULT 60,target_levels_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'ACTIVE',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    validity_months INTEGER,delivery_mode TEXT,learning_nature TEXT,category_group TEXT,category_audience TEXT,category_stage TEXT,
    exam_url TEXT
   )`).run();
   const info=await env.DB.prepare("PRAGMA table_info(courses)").all<any>();
   const names=new Set((info.results||[]).map((row:any)=>String(row.name||"")));
   const additions:[string,string][]=[
    ["validity_months","INTEGER"],["delivery_mode","TEXT"],["learning_nature","TEXT"],
    ["category_group","TEXT"],["category_audience","TEXT"],["category_stage","TEXT"],["exam_url","TEXT"],
   ];
   for(const [column,type] of additions)if(!names.has(column)){try{await env.DB.prepare(`ALTER TABLE courses ADD COLUMN ${column} ${type}`).run()}catch(error){const message=String(error instanceof Error?error.message:error);if(!/duplicate column/i.test(message))throw error}}
   await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_courses_training_taxonomy_v2 ON courses(category_group,category_audience,category_stage,status)").run();
   await env.DB.prepare(`CREATE TABLE IF NOT EXISTS training_exam_results(
    id TEXT PRIMARY KEY,caregiver_id TEXT NOT NULL,course_id TEXT NOT NULL,enrollment_id TEXT,
    score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 20),exam_date TEXT NOT NULL,valid_until TEXT NOT NULL,
    note TEXT,recorded_by_user_id TEXT NOT NULL,created_at TEXT NOT NULL,
    FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE RESTRICT,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE RESTRICT,
    FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
    FOREIGN KEY(recorded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
   )`).run();
   await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_training_exam_results_caregiver ON training_exam_results(caregiver_id,exam_date DESC,created_at DESC)").run();
   await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_training_exam_results_course ON training_exam_results(course_id,exam_date DESC,created_at DESC)").run();
  })().catch(error=>{schemaReady=undefined;throw error});
 }
 return schemaReady;
}

function hasV15Metadata(body:any){return body&&["validityMonths","deliveryMode","learningNature","categoryGroup","categoryAudience","categoryStage","examUrl"].some(key=>Object.prototype.hasOwnProperty.call(body,key))}
function numberOrZero(value:unknown){const n=Number(value||0);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0}
function normalizeExamUrl(value:unknown){let raw=str(value);if(/^www\./i.test(raw))raw=`https://${raw}`;if(!raw)return"";try{const parsed=new URL(raw);return parsed.protocol==="http:"||parsed.protocol==="https:"?parsed.toString():""}catch{return""}}
function metadataFrom(body:any,current?:any){
 const categoryGroup=normalizeTrainingCategoryGroup(body?.categoryGroup??current?.category_group),categoryAudience=normalizeTrainingCategoryAudience(body?.categoryAudience??current?.category_audience),categoryStage=normalizeTrainingCategoryStage(body?.categoryStage??current?.category_stage,categoryGroup);
 const deliveryMode=normalizeTrainingDeliveryMode(body?.deliveryMode??current?.delivery_mode),learningNature=normalizeTrainingLearningNature(body?.learningNature??current?.learning_nature);
 const validityMonths=body?.validityMonths!==undefined?numberOrZero(body.validityMonths):numberOrZero(current?.validity_months??current?.credit);
 return {categoryGroup,categoryAudience,categoryStage,deliveryMode,learningNature,validityMonths,category:trainingCategoryLabel(categoryGroup,categoryAudience,categoryStage)};
}
function validateMetadata(meta:ReturnType<typeof metadataFrom>){
 if(!isValidTrainingTaxonomy(meta.categoryGroup,meta.categoryAudience,meta.categoryStage))return "دسته‌بندی آموزش را مطابق ساختار بالینی/عمومی کامل کنید.";
 if(!meta.deliveryMode)return "نوع آموزش را انتخاب کنید.";
 if(!meta.learningNature)return "ماهیت آموزش را انتخاب کنید.";
 return "";
}
function normalizeExamDate(value:unknown){const raw=str(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return"";const date=new Date(`${raw}T00:00:00.000Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==raw)return"";return raw}
function addOneCalendarYear(dateValue:string){const [year,month,day]=dateValue.split("-").map(Number),targetYear=year+1,daysInTargetMonth=new Date(Date.UTC(targetYear,month,0)).getUTCDate(),targetDay=Math.min(day,daysInTargetMonth);return `${String(targetYear).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(targetDay).padStart(2,"0")}`}
function todayIsoDate(){return new Date().toISOString().slice(0,10)}
function decorateExamResult(row:any){const validUntil=str(row?.validUntil||row?.valid_until),examDate=str(row?.examDate||row?.exam_date);return {...row,score:Number(row?.score||0),examDate,validUntil,validityStatus:validUntil&&validUntil>=todayIsoDate()?"VALID":"EXPIRED",validityLabel:validUntil&&validUntil>=todayIsoDate()?"معتبر":"منقضی"}}

async function resolveExamCaregiver(request:Request,env:Env,actor:any){const role=str(actor?.role).toUpperCase();if(role==="CAREGIVER")return str(actor?.caregiverId);const requested=new URL(request.url).searchParams.get("caregiverId")||"";return requested?await findCaregiverId(env,requested):null}

async function getTrainingExamResults(request:Request,env:Env,actor:any){
 const role=str(actor?.role).toUpperCase();if(role!=="CAREGIVER"){const denied=await requireAccess(env,actor,"staff.evaluations","view");if(denied)return denied}
 const caregiverId=await resolveExamCaregiver(request,env,actor);if(!caregiverId)return fail(role==="CAREGIVER"?"حساب شما به پرونده مراقب متصل نیست.":"شناسه مراقب لازم است.",409,"caregiver_profile_missing");
 const caregiver=await env.DB.prepare("SELECT id,full_name AS fullName,membership_code AS membershipCode,mobile FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first<any>();if(!caregiver)return fail("پرونده مراقب پیدا نشد.",404,"caregiver_not_found");
 const coursesQuery=await env.DB.prepare(`SELECT e.id AS enrollmentId,e.status AS enrollmentStatus,e.assigned_at AS assignedAt,
   c.id AS courseId,c.code,c.title,c.category,c.exam_url AS examUrl,c.validity_months AS trainingValidityMonths,
   c.delivery_mode AS deliveryMode,c.learning_nature AS learningNature
   FROM enrollments e JOIN courses c ON c.id=e.course_id
   WHERE e.caregiver_id=? AND upper(c.status)<>'DELETED' ORDER BY e.assigned_at DESC`).bind(caregiverId).all<any>();
 const resultsQuery=await env.DB.prepare(`SELECT r.id,r.caregiver_id AS caregiverId,r.course_id AS courseId,r.enrollment_id AS enrollmentId,
   r.score,r.exam_date AS examDate,r.valid_until AS validUntil,r.note,r.recorded_by_user_id AS recordedByUserId,r.created_at AS createdAt,
   c.code AS courseCode,c.title AS courseTitle,c.category,c.exam_url AS examUrl,COALESCE(u.full_name,'—') AS recordedByName,COALESCE(u.role,'') AS recordedByRole
   FROM training_exam_results r JOIN courses c ON c.id=r.course_id LEFT JOIN users u ON u.id=r.recorded_by_user_id
   WHERE r.caregiver_id=? ORDER BY r.exam_date DESC,r.created_at DESC`).bind(caregiverId).all<any>();
 const results=(resultsQuery.results||[]).map(decorateExamResult),latestByCourse=new Map<string,any>();for(const row of results)if(!latestByCourse.has(String(row.courseId)))latestByCourse.set(String(row.courseId),row);
 const courses=(coursesQuery.results||[]).map((row:any)=>({...row,examUrl:normalizeExamUrl(row.examUrl),trainingValidityMonths:numberOrZero(row.trainingValidityMonths),latestResult:latestByCourse.get(String(row.courseId))||null}));
 return json({data:{caregiver,courses,results,examValidityMonths:12}},200,{"x-salamat-training-exam-policy":"v1"});
}

async function createTrainingExamResult(request:Request,env:Env,actor:any){
 const role=str(actor?.role).toUpperCase();if(role==="CAREGIVER")return fail("ثبت نتیجه آزمون فقط توسط واحد ارزیابی انجام می‌شود.",403,"forbidden");
 const denied=await requireAccess(env,actor,"staff.evaluations","update");if(denied)return denied;
 const body=await readBody(request),requestedCaregiver=str(body?.caregiverId),courseId=str(body?.courseId),score=Number(body?.score),examDate=normalizeExamDate(body?.examDate),note=str(body?.note)||null;
 if(!requestedCaregiver||!courseId)return fail("مراقب و آموزش را انتخاب کنید.");if(!Number.isInteger(score)||score<1||score>20)return fail("نمره آزمون باید عدد صحیحی از ۱ تا ۲۰ باشد.",400,"invalid_exam_score");if(!examDate)return fail("تاریخ آزمون معتبر نیست.",400,"invalid_exam_date");if(examDate>todayIsoDate())return fail("تاریخ آزمون نمی‌تواند در آینده باشد.",400,"future_exam_date");
 const caregiverId=await findCaregiverId(env,requestedCaregiver);if(!caregiverId)return fail("پرونده مراقب پیدا نشد.",404,"caregiver_not_found");
 const enrollment=await env.DB.prepare(`SELECT e.id AS enrollmentId,c.title,c.exam_url AS examUrl FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.caregiver_id=? AND e.course_id=? AND upper(c.status)<>'DELETED' LIMIT 1`).bind(caregiverId,courseId).first<any>();if(!enrollment)return fail("این آموزش برای مراقب انتخاب‌شده تخصیص داده نشده است.",409,"training_not_assigned");
 const id=randomId("tex_"),createdAt=nowIso(),validUntil=addOneCalendarYear(examDate);
 await env.DB.prepare("INSERT INTO training_exam_results(id,caregiver_id,course_id,enrollment_id,score,exam_date,valid_until,note,recorded_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,caregiverId,courseId,enrollment.enrollmentId,score,examDate,validUntil,note,actor.id,createdAt).run();
 await audit(request,env,actor,"CREATE","training_exam_result",id,{caregiverId,courseId,enrollmentId:enrollment.enrollmentId,score,examDate,validUntil,note});
 return json({data:decorateExamResult({id,caregiverId,courseId,enrollmentId:enrollment.enrollmentId,courseTitle:enrollment.title,score,examDate,validUntil,note,recordedByUserId:actor.id,recordedByName:actor.fullName||"—",recordedByRole:actor.role,createdAt})},201,{"x-salamat-training-exam-policy":"v1"});
}

export async function routeTrainingMetadataV15(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),patch=url.pathname.match(/^\/api\/training\/courses\/([^/]+)$/);
 if(url.pathname==="/api/training/exam-results"&&(method==="GET"||method==="POST")){await ensureTrainingMetadataSchemaV15(env);const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");return method==="GET"?getTrainingExamResults(request,env,actor):createTrainingExamResult(request,env,actor)}
 const isCreate=url.pathname==="/api/training/courses"&&method==="POST",isUpdate=Boolean(patch&&method==="PATCH");
 if(!isCreate&&!isUpdate)return null;
 const body=await request.clone().json().catch(()=>null);
 if(!hasV15Metadata(body))return null;
 await ensureTrainingMetadataSchemaV15(env);
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.training",isCreate?"create":"update");if(denied)return denied;
 if(isCreate){
  const rawContentUrl=str(body?.contentUrl),rawExamUrl=str(body?.examUrl),title=str(body?.title)||"آموزش بدون عنوان";
  const contentUrl=rawContentUrl===OPTIONAL_EMPTY_SENTINEL?null:(rawContentUrl||null),examUrl=rawExamUrl?normalizeExamUrl(rawExamUrl):null;
  if(rawExamUrl&&!examUrl)return fail("لینک آزمون معتبر نیست.",400,"invalid_exam_url");
  const meta=metadataFrom(body);
  const id=randomId("crs_"),timestamp=nowIso(),code=str(body?.code)||`TRN-${Date.now().toString(36).toUpperCase()}`;
  const row={id,code,title,description:str(body?.description)||null,category:meta.category,coverUrl:str(body?.coverUrl)||null,contentUrl,examUrl,durationMinutes:numberOrZero(body?.durationMinutes),mandatory:body?.mandatory?1:0,credit:meta.validityMonths,passingScore:Math.min(100,Math.max(0,Math.trunc(Number(body?.passingScore??60))))};
  try{await env.DB.prepare(`INSERT INTO courses(id,code,title,description,category,cover_url,content_url,duration_minutes,mandatory,credit,passing_score,target_levels_json,status,created_at,updated_at,validity_months,delivery_mode,learning_nature,category_group,category_audience,category_stage,exam_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,'[]','ACTIVE',?,?,?,?,?,?,?,?,?)`).bind(row.id,row.code,row.title,row.description,row.category,row.coverUrl,row.contentUrl,row.durationMinutes,row.mandatory,row.credit,row.passingScore,timestamp,timestamp,meta.validityMonths,meta.deliveryMode||null,meta.learningNature||null,meta.categoryGroup||null,meta.categoryGroup==="CLINICAL"?(meta.categoryAudience||null):null,meta.categoryStage||null,row.examUrl).run()}catch{return fail("کد آموزش تکراری است.",409,"duplicate_course")}
  await audit(request,env,actor,"CREATE","course",id,{...row,validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage});
  return json({data:{...row,mandatory:Boolean(row.mandatory),validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,deliveryModeLabel:trainingDeliveryLabel(meta.deliveryMode),learningNature:meta.learningNature,learningNatureLabel:trainingNatureLabel(meta.learningNature),categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage,createdAt:timestamp}},201,{"x-salamat-training-policy":"v15-taxonomy-exam-optional-create"});
 }
 const id=decodeURIComponent(patch![1]);
 const existing=await env.DB.prepare("SELECT * FROM courses WHERE id=? AND upper(status)<>'DELETED' LIMIT 1").bind(id).first<any>();if(!existing)return fail("آموزش پیدا نشد.",404,"course_not_found");
 if(body?.title!==undefined&&!str(body.title))return fail("عنوان آموزش نمی‌تواند خالی باشد.");if(body?.contentUrl!==undefined&&!str(body.contentUrl))return fail("محتوای آموزش نمی‌تواند خالی باشد.");if(body?.examUrl!==undefined&&!normalizeExamUrl(body.examUrl))return fail("لینک آزمون معتبر نیست.",400,"invalid_exam_url");
 const meta=metadataFrom(body,existing),validation=validateMetadata(meta);if(validation)return fail(validation,400,"invalid_training_metadata");
 const fields:string[]=[],values:unknown[]=[];const add=(column:string,value:unknown)=>{fields.push(`${column}=?`);values.push(value)};
 if(body.title!==undefined)add("title",str(body.title));if(body.description!==undefined)add("description",str(body.description)||null);if(body.coverUrl!==undefined)add("cover_url",str(body.coverUrl)||null);if(body.contentUrl!==undefined)add("content_url",str(body.contentUrl));if(body.examUrl!==undefined)add("exam_url",normalizeExamUrl(body.examUrl));if(body.durationMinutes!==undefined)add("duration_minutes",numberOrZero(body.durationMinutes));if(body.mandatory!==undefined)add("mandatory",body.mandatory?1:0);if(body.passingScore!==undefined)add("passing_score",Math.min(100,Math.max(0,Math.trunc(Number(body.passingScore||0)))));if(body.status!==undefined)add("status",str(body.status).toUpperCase()||"ACTIVE");
 add("category",meta.category);add("credit",meta.validityMonths);add("validity_months",meta.validityMonths);add("delivery_mode",meta.deliveryMode);add("learning_nature",meta.learningNature);add("category_group",meta.categoryGroup);add("category_audience",meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null);add("category_stage",meta.categoryStage);add("updated_at",nowIso());values.push(id);
 await env.DB.prepare(`UPDATE courses SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
 await audit(request,env,actor,"UPDATE","course",id,{...body,category:meta.category,validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage,examUrl:body.examUrl!==undefined?normalizeExamUrl(body.examUrl):normalizeExamUrl(existing.exam_url)});
 return json({data:{id,ok:true,category:meta.category,validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage,examUrl:body.examUrl!==undefined?normalizeExamUrl(body.examUrl):normalizeExamUrl(existing.exam_url)}},200,{"x-salamat-training-policy":"v15-taxonomy-exam"});
}

function decorateRow(row:any,meta:any){if(!row)return row;const validityMonths=meta?.validity_months==null?numberOrZero(row?.credit):numberOrZero(meta.validity_months),categoryGroup=normalizeTrainingCategoryGroup(meta?.category_group),categoryAudience=normalizeTrainingCategoryAudience(meta?.category_audience),categoryStage=normalizeTrainingCategoryStage(meta?.category_stage,categoryGroup),deliveryMode=normalizeTrainingDeliveryMode(meta?.delivery_mode),learningNature=normalizeTrainingLearningNature(meta?.learning_nature),examUrl=normalizeExamUrl(meta?.exam_url);return {...row,validityMonths,credit:validityMonths,deliveryMode,deliveryModeLabel:trainingDeliveryLabel(deliveryMode),learningNature,learningNatureLabel:trainingNatureLabel(learningNature),categoryGroup,categoryAudience,categoryStage,categoryStructured:Boolean(categoryGroup&&categoryStage&&(categoryGroup!=="CLINICAL"||categoryAudience)),legacyCategory:!(categoryGroup&&categoryStage&&(categoryGroup!=="CLINICAL"||categoryAudience)),examUrl}}

export async function decorateTrainingMetadataV15(request:Request,env:Env,response:Response){
 if(!response.ok||request.method.toUpperCase()!=="GET")return response;const path=new URL(request.url).pathname;if(path!=="/api/training/admin"&&path!=="/api/training/my")return response;
 await ensureTrainingMetadataSchemaV15(env);const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 const rows=await env.DB.prepare("SELECT id,credit,validity_months,delivery_mode,learning_nature,category_group,category_audience,category_stage,exam_url FROM courses WHERE upper(status)<>'DELETED'").all<any>();const byId=new Map((rows.results||[]).map((row:any)=>[String(row.id),row]));
 if(Array.isArray(payload.data.courses))payload.data.courses=payload.data.courses.map((row:any)=>decorateRow(row,byId.get(String(row.id))));
 if(Array.isArray(payload.data.assignments))payload.data.assignments=payload.data.assignments.map((row:any)=>decorateRow(row,byId.get(String(row.courseId))));
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("x-salamat-training-policy","v15-taxonomy-exam");return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
