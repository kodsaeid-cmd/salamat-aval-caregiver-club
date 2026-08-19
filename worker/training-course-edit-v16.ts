import {requireAccess} from "./access-control";
import {audit,fail,getUser,json,nowIso,str,type Env} from "./lib";
import {ensureTrainingMetadataSchemaV15} from "./training-metadata-v15";
import {isValidTrainingTaxonomy,normalizeTrainingCategoryAudience,normalizeTrainingCategoryGroup,normalizeTrainingCategoryStage,normalizeTrainingDeliveryMode,normalizeTrainingLearningNature,trainingCategoryLabel} from "../shared/training-taxonomy-v2";

const PRESERVE_CONTENT_SENTINEL="__SALAMAT_PRESERVE_CONTENT__";
const numberOrZero=(value:unknown)=>{const n=Number(value||0);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0};
function normalizeExamUrl(value:unknown){let raw=str(value);if(/^www\./i.test(raw))raw=`https://${raw}`;if(!raw)return"";try{const parsed=new URL(raw);return parsed.protocol==="http:"||parsed.protocol==="https:"?parsed.toString():""}catch{return""}}
function hasOwn(body:any,key:string){return Boolean(body&&Object.prototype.hasOwnProperty.call(body,key))}

export async function routeTrainingCourseEditV16(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),match=url.pathname.match(/^\/api\/training\/courses\/([^/]+)$/);
 if(!match||method!=="PATCH")return null;
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.training","update");if(denied)return denied;
 await ensureTrainingMetadataSchemaV15(env);
 const id=decodeURIComponent(match[1]),body:any=await request.clone().json().catch(()=>null);if(!body||typeof body!=="object")return fail("اطلاعات ویرایش معتبر نیست.");
 const existing=await env.DB.prepare("SELECT * FROM courses WHERE id=? AND upper(status)<>'DELETED' LIMIT 1").bind(id).first<any>();if(!existing)return fail("آموزش پیدا نشد.",404,"course_not_found");
 const fields:string[]=[],values:unknown[]=[];const add=(column:string,value:unknown)=>{fields.push(`${column}=?`);values.push(value)};
 if(hasOwn(body,"title")){const value=str(body.title);if(value)add("title",value)}
 if(hasOwn(body,"description"))add("description",str(body.description)||null);
 if(hasOwn(body,"coverUrl"))add("cover_url",str(body.coverUrl)||null);
 if(hasOwn(body,"contentUrl")){const value=str(body.contentUrl);if(value&&value!==PRESERVE_CONTENT_SENTINEL)add("content_url",value)}
 if(hasOwn(body,"examUrl")){const raw=str(body.examUrl),normalized=normalizeExamUrl(raw);if(raw&&!normalized)return fail("لینک آزمون معتبر نیست.",400,"invalid_exam_url");add("exam_url",normalized||null)}
 if(hasOwn(body,"durationMinutes"))add("duration_minutes",numberOrZero(body.durationMinutes));
 if(hasOwn(body,"mandatory"))add("mandatory",body.mandatory?1:0);
 if(hasOwn(body,"passingScore"))add("passing_score",Math.min(100,Math.max(0,Math.trunc(Number(body.passingScore||0)))));
 if(hasOwn(body,"status"))add("status",str(body.status).toUpperCase()||String(existing.status||"ACTIVE"));

 const metadataSubmitted=["categoryGroup","categoryAudience","categoryStage","deliveryMode","learningNature"].some(key=>hasOwn(body,key));
 let metadataChanged=false,meta:any=null;
 if(metadataSubmitted){
  const categoryGroup=normalizeTrainingCategoryGroup(body.categoryGroup??existing.category_group),categoryAudience=normalizeTrainingCategoryAudience(body.categoryAudience??existing.category_audience),categoryStage=normalizeTrainingCategoryStage(body.categoryStage??existing.category_stage,categoryGroup),deliveryMode=normalizeTrainingDeliveryMode(body.deliveryMode??existing.delivery_mode),learningNature=normalizeTrainingLearningNature(body.learningNature??existing.learning_nature);
  const complete=isValidTrainingTaxonomy(categoryGroup,categoryAudience,categoryStage)&&Boolean(deliveryMode)&&Boolean(learningNature);
  if(complete){
   const validityMonths=hasOwn(body,"validityMonths")?numberOrZero(body.validityMonths):numberOrZero(existing.validity_months??existing.credit);
   meta={categoryGroup,categoryAudience,categoryStage,deliveryMode,learningNature,validityMonths,category:trainingCategoryLabel(categoryGroup,categoryAudience,categoryStage)};
   add("category",meta.category);add("credit",validityMonths);add("validity_months",validityMonths);add("delivery_mode",deliveryMode);add("learning_nature",learningNature);add("category_group",categoryGroup);add("category_audience",categoryGroup==="CLINICAL"?(categoryAudience||null):null);add("category_stage",categoryStage);metadataChanged=true;
  }
 }else if(hasOwn(body,"validityMonths")&&existing.category_group&&existing.category_stage&&existing.delivery_mode&&existing.learning_nature){const validityMonths=numberOrZero(body.validityMonths);add("credit",validityMonths);add("validity_months",validityMonths)}
 add("updated_at",nowIso());values.push(id);
 await env.DB.prepare(`UPDATE courses SET ${fields.join(",")} WHERE id=?`).bind(...values).run();
 const updated=await env.DB.prepare(`SELECT id,title,description,category,content_url AS contentUrl,exam_url AS examUrl,duration_minutes AS durationMinutes,mandatory,credit,validity_months AS validityMonths,delivery_mode AS deliveryMode,learning_nature AS learningNature,category_group AS categoryGroup,category_audience AS categoryAudience,category_stage AS categoryStage,status,updated_at AS updatedAt FROM courses WHERE id=? LIMIT 1`).bind(id).first<any>();
 await audit(request,env,actor,"UPDATE","course",id,{partialEdit:true,metadataChanged,changedFields:Object.keys(body)});
 return json({data:{...updated,mandatory:Boolean(updated?.mandatory)}},200,{"x-salamat-training-policy":"v16-partial-edit"});
}
