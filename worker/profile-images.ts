import { canAccess } from "./access-control";
import { AwsClient } from "aws4fetch";
import {
  type AuthUser, type Env, audit, fail, json, nowIso, randomId, str,
} from "./lib";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function ensureProfileImageSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS profile_images (
      id TEXT PRIMARY KEY,user_id TEXT UNIQUE,caregiver_id TEXT UNIQUE,file_id TEXT NOT NULL,
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(caregiver_id) REFERENCES caregivers(id) ON DELETE CASCADE,
      FOREIGN KEY(file_id) REFERENCES stored_files(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_profile_images_user ON profile_images(user_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_profile_images_caregiver ON profile_images(caregiver_id)"),
  ]);
}
function storageConfig(env: Env) {const endpointRaw=str(env.PARSPACK_S3_ENDPOINT),bucket=str(env.PARSPACK_S3_BUCKET),accessKeyId=str(env.PARSPACK_S3_ACCESS_KEY),secretAccessKey=str(env.PARSPACK_S3_SECRET_KEY);if(!endpointRaw||!bucket||!accessKeyId||!secretAccessKey)return null;const endpoint=new URL(/^https?:\/\//i.test(endpointRaw)?endpointRaw:`https://${endpointRaw}`);const segments=endpoint.pathname.split("/").filter(Boolean).map(part=>{try{return decodeURIComponent(part)}catch{return part}});if(segments.at(-1)!==bucket)segments.push(bucket);endpoint.pathname=`/${segments.map(part=>encodeURIComponent(part)).join("/")}`;endpoint.search="";endpoint.hash="";return{endpoint,accessKeyId,secretAccessKey,region:str(env.PARSPACK_S3_REGION)||"us-east-1"}}
function objectUrl(env:Env,objectKey:string){const config=storageConfig(env);if(!config)return null;const encoded=objectKey.split("/").filter(Boolean).map(part=>encodeURIComponent(part)).join("/");return`${config.endpoint.toString().replace(/\/+$/,"")}/${encoded}`}
function s3Client(env:Env){const config=storageConfig(env);if(!config)return null;return new AwsClient({accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey,service:"s3",region:config.region})}
async function s3Fetch(env:Env,objectKey:string,init:RequestInit){const client=s3Client(env),url=objectUrl(env,objectKey);if(!client||!url)throw new Error("storage_not_configured");return client.fetch(url,init)}
function extensionFor(contentType:string){if(contentType==="image/png")return"png";if(contentType==="image/webp")return"webp";return"jpg"}

async function isSelfOwner(env:Env,actor:AuthUser,userId:string|null,caregiverId:string|null){
  if(userId&&actor.id===userId)return true;
  if(caregiverId&&actor.caregiverId===caregiverId)return true;
  if(userId&&actor.caregiverId){const row=await env.DB.prepare("SELECT caregiver_id AS caregiverId FROM users WHERE id=? LIMIT 1").bind(userId).first<{caregiverId:string|null}>();if(row?.caregiverId===actor.caregiverId)return true}
  return false;
}
async function canManageOwner(env:Env,actor:AuthUser,userId:string|null,caregiverId:string|null,action:"view"|"update"){
  if(await isSelfOwner(env,actor,userId,caregiverId))return true;
  return canAccess(env,actor,"staff.caregivers",action);
}

export async function uploadProfileImage(request:Request,env:Env,actor:AuthUser){
  await ensureProfileImageSchema(env);if(!storageConfig(env))return fail("فضای ذخیره‌سازی تصویر تنظیم نشده است.",503,"storage_not_configured");
  const url=new URL(request.url),userId=str(url.searchParams.get("userId"))||null,caregiverId=str(url.searchParams.get("caregiverId"))||null;
  if(!userId&&!caregiverId)return fail("شناسه پروفایل ارسال نشده است.",400,"profile_owner_required");
  if(!await canManageOwner(env,actor,userId,caregiverId,"update"))return fail("دسترسی کافی ندارید.",403,"forbidden");
  if(userId&&!await env.DB.prepare("SELECT id FROM users WHERE id=? LIMIT 1").bind(userId).first())return fail("حساب کاربری پیدا نشد.",404,"user_not_found");
  if(caregiverId&&!await env.DB.prepare("SELECT id FROM caregivers WHERE id=? LIMIT 1").bind(caregiverId).first())return fail("پرونده مراقب پیدا نشد.",404,"caregiver_not_found");
  const contentType=str(request.headers.get("content-type")).split(";")[0].toLowerCase();if(!IMAGE_TYPES.has(contentType))return fail("فقط تصویر JPG، PNG یا WebP قابل استفاده است.",415,"unsupported_image_type");
  const claimedSize=Number(request.headers.get("content-length")||request.headers.get("x-file-size")||0);if(claimedSize>MAX_IMAGE_BYTES)return fail("حجم تصویر باید کمتر از ۸ مگابایت باشد.",413,"image_too_large");
  const buffer=await request.arrayBuffer();if(!buffer.byteLength)return fail("فایل تصویر خالی است.",400,"empty_image");if(buffer.byteLength>MAX_IMAGE_BYTES)return fail("حجم تصویر باید کمتر از ۸ مگابایت باشد.",413,"image_too_large");
  const createdAt=nowIso(),datePath=createdAt.slice(0,10).replaceAll("-","/"),objectKey=`organization/profile/${datePath}/${randomId("avatar_")}.${extensionFor(contentType)}`;
  let uploaded=await s3Fetch(env,objectKey,{method:"PUT",headers:{"content-type":contentType,"cache-control":"private, no-store"},body:new Uint8Array(buffer)});if(!uploaded.ok&&[400,403].includes(uploaded.status))uploaded=await s3Fetch(env,objectKey,{method:"PUT",headers:{"content-type":contentType},body:new Uint8Array(buffer)});
  if(!uploaded.ok){const detail=(await uploaded.text().catch(()=>"")).slice(0,700);return json({error:"profile_image_upload_failed",message:"بارگذاری تصویر انجام نشد.",providerStatus:uploaded.status,detail},502)}
  const existing=await env.DB.prepare(`SELECT pi.id,pi.file_id AS fileId,sf.object_key AS objectKey FROM profile_images pi LEFT JOIN stored_files sf ON sf.id=pi.file_id WHERE (? IS NOT NULL AND pi.user_id=?) OR (? IS NOT NULL AND pi.caregiver_id=?) LIMIT 1`).bind(userId,userId,caregiverId,caregiverId).first<{id:string;fileId:string;objectKey:string|null}>();
  const fileId=randomId("fil_"),imageId=existing?.id||randomId("img_");
  try{const statements:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO stored_files(id,caregiver_id,category,original_name,object_key,content_type,size_bytes,checksum_sha256,uploaded_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(fileId,caregiverId,"profile",`profile.${extensionFor(contentType)}`,objectKey,contentType,buffer.byteLength,null,actor.id,createdAt)];if(existing){statements.push(env.DB.prepare(`UPDATE profile_images SET user_id=COALESCE(?,user_id),caregiver_id=COALESCE(?,caregiver_id),file_id=?,updated_at=? WHERE id=?`).bind(userId,caregiverId,fileId,createdAt,imageId));statements.push(env.DB.prepare("UPDATE stored_files SET deleted_at=? WHERE id=?").bind(createdAt,existing.fileId))}else statements.push(env.DB.prepare(`INSERT INTO profile_images(id,user_id,caregiver_id,file_id,created_at,updated_at) VALUES(?,?,?,?,?,?)`).bind(imageId,userId,caregiverId,fileId,createdAt,createdAt));await env.DB.batch(statements)}catch(error){await s3Fetch(env,objectKey,{method:"DELETE"}).catch(()=>undefined);const detail=error instanceof Error?error.message:"database_error";return json({error:"profile_image_save_failed",message:"تصویر ارسال شد اما ثبت پروفایل کامل نشد.",detail},500)}
  if(existing?.objectKey)await s3Fetch(env,existing.objectKey,{method:"DELETE"}).catch(()=>undefined);await audit(request,env,actor,"PROFILE_IMAGE_UPDATE","profile_image",imageId,{userId,caregiverId,fileId});return json({data:{id:imageId,url:`/api/profile-images/${encodeURIComponent(imageId)}`,updatedAt:createdAt}},201);
}

export async function getProfileImage(request:Request,env:Env,actor:AuthUser,imageId:string){
  await ensureProfileImageSchema(env);const row=await env.DB.prepare(`SELECT pi.user_id AS userId,pi.caregiver_id AS caregiverId,sf.object_key AS objectKey,sf.content_type AS contentType,sf.size_bytes AS sizeBytes FROM profile_images pi JOIN stored_files sf ON sf.id=pi.file_id WHERE pi.id=? AND sf.deleted_at IS NULL LIMIT 1`).bind(imageId).first<{userId:string|null;caregiverId:string|null;objectKey:string;contentType:string;sizeBytes:number}>();
  if(!row)return fail("تصویر پروفایل پیدا نشد.",404,"profile_image_not_found");if(!await canManageOwner(env,actor,row.userId,row.caregiverId,"view"))return fail("دسترسی کافی ندارید.",403,"forbidden");
  const response=await s3Fetch(env,row.objectKey,{method:"GET"});if(!response.ok)return fail("دریافت تصویر انجام نشد.",502,"profile_image_read_failed");const headers=new Headers();headers.set("content-type",row.contentType||"image/jpeg");headers.set("content-length",String(row.sizeBytes||0));headers.set("cache-control","private, max-age=300");headers.set("content-disposition","inline");return new Response(response.body,{status:200,headers});
}
