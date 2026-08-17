import {requireAccess} from "./access-control";
import {audit,ensureSchema,fail,getUser,json,nowIso,randomId,readBody,str,type Env} from "./lib";
import {isValidTrainingTaxonomy,normalizeTrainingCategoryAudience,normalizeTrainingCategoryGroup,normalizeTrainingCategoryStage,normalizeTrainingDeliveryMode,normalizeTrainingLearningNature,trainingCategoryLabel,trainingDeliveryLabel,trainingNatureLabel} from "../shared/training-taxonomy-v2";

let schemaReady:Promise<void>|undefined;

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
    validity_months INTEGER,delivery_mode TEXT,learning_nature TEXT,category_group TEXT,category_audience TEXT,category_stage TEXT
   )`).run();
   const info=await env.DB.prepare("PRAGMA table_info(courses)").all<any>();
   const names=new Set((info.results||[]).map((row:any)=>String(row.name||"")));
   const additions:[string,string][]=[
    ["validity_months","INTEGER"],["delivery_mode","TEXT"],["learning_nature","TEXT"],
    ["category_group","TEXT"],["category_audience","TEXT"],["category_stage","TEXT"],
   ];
   for(const [column,type] of additions)if(!names.has(column)){try{await env.DB.prepare(`ALTER TABLE courses ADD COLUMN ${column} ${type}`).run()}catch(error){const message=String(error instanceof Error?error.message:error);if(!/duplicate column/i.test(message))throw error}}
   await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_courses_training_taxonomy_v2 ON courses(category_group,category_audience,category_stage,status)").run();
  })().catch(error=>{schemaReady=undefined;throw error});
 }
 return schemaReady;
}

function hasV15Metadata(body:any){return body&&["validityMonths","deliveryMode","learningNature","categoryGroup","categoryAudience","categoryStage"].some(key=>Object.prototype.hasOwnProperty.call(body,key))}
function numberOrZero(value:unknown){const n=Number(value||0);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0}
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

export async function routeTrainingMetadataV15(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),patch=url.pathname.match(/^\/api\/training\/courses\/([^/]+)$/);
 const isCreate=url.pathname==="/api/training/courses"&&method==="POST",isUpdate=Boolean(patch&&method==="PATCH");
 if(!isCreate&&!isUpdate)return null;
 const body=await request.clone().json().catch(()=>null);
 if(!hasV15Metadata(body))return null;
 await ensureTrainingMetadataSchemaV15(env);
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.training",isCreate?"create":"update");if(denied)return denied;
 if(isCreate){
  const title=str(body?.title),contentUrl=str(body?.contentUrl);if(!title)return fail("عنوان آموزش الزامی است.");if(!contentUrl)return fail("برای ثبت آموزش، فایل یا نشانی محتوا الزامی است.");
  const meta=metadataFrom(body),validation=validateMetadata(meta);if(validation)return fail(validation,400,"invalid_training_metadata");
  const id=randomId("crs_"),timestamp=nowIso(),code=str(body?.code)||`TRN-${Date.now().toString(36).toUpperCase()}`;
  const row={id,code,title,description:str(body?.description)||null,category:meta.category,coverUrl:str(body?.coverUrl)||null,contentUrl,durationMinutes:numberOrZero(body?.durationMinutes),mandatory:body?.mandatory?1:0,credit:meta.validityMonths,passingScore:Math.min(100,Math.max(0,Math.trunc(Number(body?.passingScore??60))))};
  try{await env.DB.prepare(`INSERT INTO courses(id,code,title,description,category,cover_url,content_url,duration_minutes,mandatory,credit,passing_score,target_levels_json,status,created_at,updated_at,validity_months,delivery_mode,learning_nature,category_group,category_audience,category_stage) VALUES(?,?,?,?,?,?,?,?,?,?,?,'[]','ACTIVE',?,?,?,?,?,?,?,?)`).bind(row.id,row.code,row.title,row.description,row.category,row.coverUrl,row.contentUrl,row.durationMinutes,row.mandatory,row.credit,row.passingScore,timestamp,timestamp,meta.validityMonths,meta.deliveryMode,meta.learningNature,meta.categoryGroup,meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null,meta.categoryStage).run()}catch{return fail("کد آموزش تکراری است.",409,"duplicate_course")}
  await audit(request,env,actor,"CREATE","course",id,{...row,validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage});
  return json({data:{...row,mandatory:Boolean(row.mandatory),validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,deliveryModeLabel:trainingDeliveryLabel(meta.deliveryMode),learningNature:meta.learningNature,learningNatureLabel:trainingNatureLabel(meta.learningNature),categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage,createdAt:timestamp}},201,{"x-salamat-training-policy":"v15-taxonomy"});
 }
 const id=decodeURIComponent(patch![1]);
 const existing=await env.DB.prepare("SELECT * FROM courses WHERE id=? AND upper(status)<>'DELETED' LIMIT 1").bind(id).first<any>();if(!existing)return fail("آموزش پیدا نشد.",404,"course_not_found");
 if(body?.title!==undefined&&!str(body.title))return fail("عنوان آموزش نمی‌تواند خالی باشد.");if(body?.contentUrl!==undefined&&!str(body.contentUrl))return fail("محتوای آموزش نمی‌تواند خالی باشد.");
 const meta=metadataFrom(body,existing),validation=validateMetadata(meta);if(validation)return fail(validation,400,"invalid_training_metadata");
 const fields:string[]=[],values:unknown[]=[];const add=(column:string,value:unknown)=>{fields.push(`${column}=?`);values.push(value)};
 if(body.title!==undefined)add("title",str(body.title));if(body.description!==undefined)add("description",str(body.description)||null);if(body.coverUrl!==undefined)add("cover_url",str(body.coverUrl)||null);if(body.contentUrl!==undefined)add("content_url",str(body.contentUrl));if(body.durationMinutes!==undefined)add("duration_minutes",numberOrZero(body.durationMinutes));if(body.mandatory!==undefined)add("mandatory",body.mandatory?1:0);if(body.passingScore!==undefined)add("passing_score",Math.min(100,Math.max(0,Math.trunc(Number(body.passingScore||0)))));if(body.status!==undefined)add("status",str(body.status).toUpperCase()||"ACTIVE");
 add("category",meta.category);add("credit",meta.validityMonths);add("validity_months",meta.validityMonths);add("delivery_mode",meta.deliveryMode);add("learning_nature",meta.learningNature);add("category_group",meta.categoryGroup);add("category_audience",meta.categoryGroup==="CLINICAL"?meta.categoryAudience:null);add("category_stage",meta.categoryStage);add("updated_at",nowIso());values.push(id);
 await env.DB.prepare(`UPDATE courses SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
 await audit(request,env,actor,"UPDATE","course",id,{...body,category:meta.category,validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage});
 return json({data:{id,ok:true,category:meta.category,validityMonths:meta.validityMonths,deliveryMode:meta.deliveryMode,learningNature:meta.learningNature,categoryGroup:meta.categoryGroup,categoryAudience:meta.categoryAudience,categoryStage:meta.categoryStage}},200,{"x-salamat-training-policy":"v15-taxonomy"});
}

function decorateRow(row:any,meta:any){if(!row)return row;const validityMonths=meta?.validity_months==null?numberOrZero(row?.credit):numberOrZero(meta.validity_months),categoryGroup=normalizeTrainingCategoryGroup(meta?.category_group),categoryAudience=normalizeTrainingCategoryAudience(meta?.category_audience),categoryStage=normalizeTrainingCategoryStage(meta?.category_stage,categoryGroup),deliveryMode=normalizeTrainingDeliveryMode(meta?.delivery_mode),learningNature=normalizeTrainingLearningNature(meta?.learning_nature);return {...row,validityMonths,credit:validityMonths,deliveryMode,deliveryModeLabel:trainingDeliveryLabel(deliveryMode),learningNature,learningNatureLabel:trainingNatureLabel(learningNature),categoryGroup,categoryAudience,categoryStage,categoryStructured:Boolean(categoryGroup&&categoryStage&&(categoryGroup!=="CLINICAL"||categoryAudience)),legacyCategory:!(categoryGroup&&categoryStage&&(categoryGroup!=="CLINICAL"||categoryAudience))}}

export async function decorateTrainingMetadataV15(request:Request,env:Env,response:Response){
 if(!response.ok||request.method.toUpperCase()!=="GET")return response;const path=new URL(request.url).pathname;if(path!=="/api/training/admin"&&path!=="/api/training/my")return response;
 await ensureTrainingMetadataSchemaV15(env);const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data)return response;
 const rows=await env.DB.prepare("SELECT id,credit,validity_months,delivery_mode,learning_nature,category_group,category_audience,category_stage FROM courses WHERE upper(status)<>'DELETED'").all<any>();const byId=new Map((rows.results||[]).map((row:any)=>[String(row.id),row]));
 if(Array.isArray(payload.data.courses))payload.data.courses=payload.data.courses.map((row:any)=>decorateRow(row,byId.get(String(row.id))));
 if(Array.isArray(payload.data.assignments))payload.data.assignments=payload.data.assignments.map((row:any)=>decorateRow(row,byId.get(String(row.courseId))));
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("x-salamat-training-policy","v15-taxonomy");return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
