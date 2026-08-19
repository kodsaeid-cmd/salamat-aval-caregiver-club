import {requireAccess} from "./access-control";
import {audit,ensureSchema,fail,findCaregiverId,getUser,json,nowIso,randomId,readBody,str,type Env} from "./lib";
import {isValidTrainingTaxonomy,normalizeTrainingCategoryAudience,normalizeTrainingCategoryGroup,normalizeTrainingCategoryStage,normalizeTrainingDeliveryMode,normalizeTrainingLearningNature,trainingCategoryLabel,trainingDeliveryLabel,trainingNatureLabel} from "../shared/training-taxonomy-v2";

let schemaReady:Promise<void>|undefined;
const OPTIONAL_EMPTY_SENTINEL="__SALAMAT_OPTIONAL_EMPTY__";

export async function ensureTrainingMetadataSchemaV15(env:Env){
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
 const rows=await env.DB.prepare(`SELECT r.id,r.caregiver_id AS caregiverId,r.course_id AS courseId,r.enrollment_id AS enrollmentId,r.score,r.exam_date AS examDate,r.valid_until AS validUntil,r.note,r.recorded_by_user_id AS recordedByUserId,r.created_at AS createdAt,c.title AS courseTitle,c.category_group AS categoryGroup,c.category_audience AS categoryAudience,c.category_stage AS categoryStage,u.full_name AS recordedByName FROM training_exam_results r JOIN courses c ON c.id=r.course_id LEFT JOIN users u ON u.id=r.recorded_by_user_id WHERE r.caregiver_id=? ORDER BY r.exam_date DESC,r.created_at DESC LIMIT 120`).bind(caregiverId).all<any>();
 return json({data:{caregiver,items:(rows.results||[]).map(decorateExamResult)}});
}

async function createTrainingExamResult(request:Request,env:Env,actor:any){
 const denied=await requireAccess(env,actor,"staff.evaluations","create");if(denied)return denied;
 const body:any=await readBody(request),caregiverId=str(body?.caregiverId),courseId=str(body?.courseId),enrollmentId=str(body?.enrollmentId)||null,score=Math.trunc(Number(body?.score)),examDate=normalizeExamDate(body?.examDate),note=str(body?.note);
 if(!caregiverId||!courseId)return fail("مراقب و آموزش را انتخاب کنید.");if(!Number.isFinite(score)||score<1||score>20)return fail("نمره آزمون باید بین ۱ تا ۲۰ باشد.");if(!examDate)return fail("تاریخ آزمون معتبر نیست.");
 const [caregiver,course]=await Promise.all([env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first(),env.DB.prepare("SELECT id,title FROM courses WHERE id=? AND upper(status)<>'DELETED' LIMIT 1").bind(courseId).first<any>()]);if(!caregiver)return fail("مراقب پیدا نشد.",404,"caregiver_not_found");if(!course)return fail("آموزش پیدا نشد.",404,"course_not_found");
 const id=randomId("tex_"),ts=nowIso(),validUntil=addOneCalendarYear(examDate);await env.DB.prepare("INSERT INTO training_exam_results(id,caregiver_id,course_id,enrollment_id,score,exam_date,valid_until,note,recorded_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,caregiverId,courseId,enrollmentId,score,examDate,validUntil,note||null,actor.id,ts).run();await audit(request,env,actor,"CREATE","training_exam_result",id,{caregiverId,courseId,enrollmentId,score,examDate,validUntil});return json({data:{id,caregiverId,courseId,enrollmentId,score,examDate,validUntil,note,recordedByUserId:actor.id,recordedByName:actor.fullName,courseTitle:course.title,validityStatus:"VALID",validityLabel:"معتبر",createdAt:ts}},201)
}

async function createCourseV15(request:Request,env:Env,actor:any){const denied=await requireAccess(env,actor,"staff.training","create");if(denied)return denied;const body:any=await readBody(request),meta=metadataFrom(body),validation=validateMetadata(meta);if(validation)return fail(validation);const title=str(body?.title);if(!title)return fail("عنوان آموزش الزامی است.");const rawExam=str(body?.examUrl),examUrl=normalizeExamUrl(rawExam);if(rawExam&&!examUrl)return fail("لینک آزمون معتبر نیست.");const contentUrl=str(body?.contentUrl);const optionalContent=contentUrl===OPTIONAL_EMPTY_SENTINEL;const id=randomId("course_"),ts=nowIso(),code=`TR-${Math.random().toString(36).slice(2,8).toUpperCase()}`;await env.DB.prepare("INSERT INTO courses(id,code,title,description,category,content_url,exam_url,duration_minutes,mandatory,credit,passing_score,target_levels_json,status,created_at,updated_at,validity_months,delivery_mode,learning_nature,category_group,category_audience,category_stage) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,code,title,str(body?.description)||null,meta.category,optionalContent?null:contentUrl||null,examUrl||null,numberOrZero(body?.durationMinutes),body?.mandatory?1:0,meta.validityMonths,60,"[]","ACTIVE",ts,ts,meta.validityMonths,meta.deliveryMode,meta.learningNature,meta.categoryGroup,meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null,meta.categoryStage).run();await audit(request,env,actor,"CREATE","course",id,{code,title,...meta,examUrl,contentOptional:optionalContent});return json({data:{id,code,title,category:meta.category,contentUrl:optionalContent?null:contentUrl||null,examUrl:examUrl||null,durationMinutes:numberOrZero(body?.durationMinutes),mandatory:Boolean(body?.mandatory),validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null,categoryStage:meta.categoryStage,status:"ACTIVE"}},201,{"x-salamat-training-policy":"v15"})}

async function updateCourseV15(request:Request,env:Env,actor:any,id:string){const denied=await requireAccess(env,actor,"staff.training","update");if(denied)return denied;const current=await env.DB.prepare("SELECT * FROM courses WHERE id=? AND upper(status)<>'DELETED' LIMIT 1").bind(id).first<any>();if(!current)return fail("آموزش پیدا نشد.",404,"course_not_found");const body:any=await readBody(request),meta=metadataFrom(body,current),validation=validateMetadata(meta);if(validation)return fail(validation);const title=str(body?.title??current.title);if(!title)return fail("عنوان آموزش الزامی است.");const rawExam=str(body?.examUrl??current.exam_url),examUrl=normalizeExamUrl(rawExam);if(rawExam&&!examUrl)return fail("لینک آزمون معتبر نیست.");const contentUrl=str(body?.contentUrl??current.content_url);if(!contentUrl)return fail("محتوای آموزش نمی‌تواند خالی باشد.");const ts=nowIso();await env.DB.prepare("UPDATE courses SET title=?,description=?,category=?,content_url=?,exam_url=?,duration_minutes=?,mandatory=?,credit=?,validity_months=?,delivery_mode=?,learning_nature=?,category_group=?,category_audience=?,category_stage=?,updated_at=? WHERE id=?").bind(title,str(body?.description??current.description)||null,meta.category,contentUrl,examUrl||null,body?.durationMinutes===undefined?numberOrZero(current.duration_minutes):numberOrZero(body.durationMinutes),body?.mandatory===undefined?Number(current.mandatory||0):(body.mandatory?1:0),meta.validityMonths,meta.validityMonths,meta.deliveryMode,meta.learningNature,meta.categoryGroup,meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null,meta.categoryStage,ts,id).run();await audit(request,env,actor,"UPDATE","course",id,{title,...meta,examUrl});return json({data:{id,title,category:meta.category,contentUrl,examUrl:examUrl||null,durationMinutes:body?.durationMinutes===undefined?numberOrZero(current.duration_minutes):numberOrZero(body.durationMinutes),mandatory:body?.mandatory===undefined?Boolean(current.mandatory):Boolean(body.mandatory),validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null,categoryStage:meta.categoryStage,status:current.status}},200,{"x-salamat-training-policy":"v15"})}

export async function decorateTrainingMetadataV15(request:Request,env:Env,response:Response){if(!response.ok)return response;const url=new URL(request.url),method=request.method.toUpperCase();if(url.pathname!=="/api/training/admin"||method!=="GET")return response;await ensureTrainingMetadataSchemaV15(env);const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;const courses=await env.DB.prepare(`SELECT c.id,c.code,c.title,c.description,c.category,c.content_url AS contentUrl,c.exam_url AS examUrl,c.duration_minutes AS durationMinutes,c.mandatory,c.credit,c.validity_months AS validityMonths,c.delivery_mode AS deliveryMode,c.learning_nature AS learningNature,c.category_group AS categoryGroup,c.category_audience AS categoryAudience,c.category_stage AS categoryStage,c.status,c.created_at AS createdAt,c.updated_at AS updatedAt,COUNT(DISTINCT e.id) AS assignedCount,COUNT(DISTINCT t.id) AS totalOpenCount,COALESCE(SUM(t.total_view_seconds),0) AS totalViewSeconds FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id LEFT JOIN training_progress t ON t.enrollment_id=e.id WHERE upper(c.status)<>'DELETED' GROUP BY c.id ORDER BY c.updated_at DESC,c.created_at DESC`).all<any>();payload.data.courses=(courses.results||[]).map((row:any)=>({...row,mandatory:Boolean(row.mandatory),validityMonths:numberOrZero(row.validityMonths??row.credit)}));return json(payload,response.status,{"x-salamat-training-policy":"v15"})}

export async function routeTrainingMetadataV15(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 const courseMatch=url.pathname.match(/^\/api\/training\/courses\/([^/]+)$/);
 const examList=url.pathname==="/api/training/exam-results"&&method==="GET",examCreate=url.pathname==="/api/training/exam-results"&&method==="POST";
 const create=url.pathname==="/api/training/courses"&&method==="POST",update=Boolean(courseMatch&&method==="PATCH");
 if(!create&&!update&&!examList&&!examCreate)return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");await ensureTrainingMetadataSchemaV15(env);
 if(create)return createCourseV15(request,env,actor);if(update&&courseMatch)return updateCourseV15(request,env,actor,decodeURIComponent(courseMatch[1]));if(examList)return getTrainingExamResults(request,env,actor);if(examCreate)return createTrainingExamResult(request,env,actor);return null;
}
