import React,{ReactNode} from "react";
import {RefreshCw} from "lucide-react";

export type Notify=(message:string,tone?:"success"|"error"|"info")=>void;
export type ApiError=Error&{status?:number;code?:string;detail?:unknown};
export type ModuleAccess={key:string;label:string;description?:string;panel?:string;actions?:Record<string,boolean>};

export const roleFa:Record<string,string>={ADMIN:"مدیر سامانه",RECRUITER:"کارشناس جذب",HR:"منابع انسانی",SUPPORT:"پشتیبان",EVALUATOR:"ارزیاب",EDUCATION:"کارشناس آموزش",OPERATIONS:"مدیر عملیات",SALES_CONSULTANT:"مشاور فروش",CAREGIVER:"مراقب"};
export const statusFa:Record<string,string>={ACTIVE:"فعال",APPROVED:"فعال",PENDING:"در انتظار",SUSPENDED:"تعلیق",INACTIVE:"غیرفعال",ISSUED:"صادرشده",PAID:"پرداخت‌شده",FINAL:"نهایی",DRAFT:"پیش‌نویس",OPEN:"باز",RESOLVED:"حل‌شده",CLOSED:"بسته",REQUESTED:"در انتظار بررسی",UNDER_REVIEW:"در حال بررسی",REJECTED:"ردشده",COMPLETED:"پایان‌یافته",CANCELLED:"لغوشده",PENDING_CONSULTANT:"در انتظار تأیید مشاور",TRIAL_DISPATCH:"اعزام آزمایشی",IN_CONTRACT:"در قرارداد"};
export const fa=(value:unknown)=>Number(value||0).toLocaleString("fa-IR",{maximumFractionDigits:2});
export const money=(value:unknown)=>`${fa(value)} تومان`;
export const text=(value:unknown,fallback="—")=>String(value??"").trim()||fallback;
export const status=(value:unknown)=>statusFa[String(value||"").toUpperCase()]||text(value);
export const dateFa=(value:unknown)=>{if(!value)return"—";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short"}).format(new Date(String(value)))}catch{return String(value)}};

const avatarRegistry=new Map<string,string>();
const avatarKey=(value:unknown)=>String(value??"").replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ").trim().toLocaleLowerCase("fa-IR");
function avatarLetters(name:string){return text(name,"ک").split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2)||"ک"}
function registerAvatar(name:unknown,url:unknown){const key=avatarKey(name),src=String(url??"").trim();if(key&&src)avatarRegistry.set(key,src)}
function harvestAvatars(value:any,depth=0){if(value==null||depth>7)return;if(Array.isArray(value)){for(const item of value)harvestAvatars(item,depth+1);return}if(typeof value!=="object")return;const name=value.fullName||value.name||value.caregiverName||value.referredName;const direct=value.avatarUrl||value.profileImageUrl||value.photoUrl||value.imageUrl;const avatarId=value.avatarId||value.profileImageId;const caregiverId=value.caregiverId||value.caregiver_id||((value.membershipCode||value.membership_code)&&value.id?value.id:null);if(name){if(direct)registerAvatar(name,direct);else if(avatarId)registerAvatar(name,`/api/profile-images/${encodeURIComponent(String(avatarId))}`);else if(caregiverId)registerAvatar(name,`/api/profile-images/caregiver/${encodeURIComponent(String(caregiverId))}/latest`)}for(const child of Object.values(value))if(child&&typeof child==="object")harvestAvatars(child,depth+1)}
export const initials=(name:string):ReactNode=>{const letters=avatarLetters(name),src=avatarRegistry.get(avatarKey(name));if(!src)return letters;return <span className="da-avatar-token"><img src={src} alt="" loading="lazy" onError={event=>event.currentTarget.parentElement?.classList.add("broken")}/><i>{letters}</i></span>};

function canonicalPath(path:string){
 if(path==="/api/contracts")return "/api/staff/contracts";
 if(path.startsWith("/api/contracts?"))return `/api/staff/contracts${path.slice("/api/contracts".length)}`;
 return path;
}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const headers=new Headers(options.headers||{});if(typeof options.body==="string"&&!headers.has("content-type"))headers.set("content-type","application/json");
 const response=await fetch(canonicalPath(path),{credentials:"same-origin",cache:"no-store",...options,headers});const raw=await response.text();let payload:any={};
 try{payload=raw?JSON.parse(raw):{}}catch{payload={detail:raw}};
 harvestAvatars(payload);
 if(!response.ok){const error=new Error(payload.message||`خطای ${response.status}`) as ApiError;error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}return payload as T;
}
export async function uploadFile(file:File,category:string,caregiverId?:string){const form=new FormData();form.append("file",file);form.append("category",category);if(caregiverId)form.append("caregiverId",caregiverId);const r=await fetch("/api/files",{method:"POST",body:form,credentials:"same-origin",cache:"no-store"});const p:any=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.message||"بارگذاری فایل انجام نشد.");return p.data;}
function moduleAliases(key:string){if(["staff.financial_credits","staff.financialCredits"].includes(key))return ["staff.financial_credits","staff.financialCredits","staff.payroll"];return [key]}
export function can(access:any,key:string,action="view"){const keys=moduleAliases(key);const module=(access?.allModules||[]).find((m:any)=>keys.includes(m.key))||(access?.modules||[]).find((m:any)=>keys.includes(m.key));return Boolean(module?.actions?.[action])}
export function Card({children,className=""}:{children:ReactNode;className?:string}){return <section className={`da-card ${className}`}>{children}</section>}
export function Loading({label="در حال دریافت اطلاعات..."}:{label?:string}){return <div className="da-state"><span className="da-spinner"/><strong>{label}</strong></div>}
export function Empty({title,description}:{title:string;description:string}){return <div className="da-state"><strong>{title}</strong><small>{description}</small></div>}
export function ErrorState({message,retry}:{message:string;retry?:()=>void}){return <div className="da-state error"><strong>عملیات انجام نشد</strong><small>{message}</small>{retry&&<button className="da-btn primary" onClick={retry}><RefreshCw size={16}/>تلاش مجدد</button>}</div>}
export function Metric({label,value,hint}:{label:string;value:ReactNode;hint?:ReactNode}){return <article className="da-metric"><small>{label}</small><strong>{value}</strong>{hint&&<span>{hint}</span>}</article>}
export function Modal({title,subtitle,children,onClose,wide=false}:{title:string;subtitle?:string;children:ReactNode;onClose:()=>void;wide?:boolean}){return <div className="da-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`da-modal ${wide?"wide":""}`}><header><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" onClick={onClose}>×</button></header><div className="da-modal-body">{children}</div></section></div>}
export function ClassicFallback({label="بازکردن نسخه سازگار کلاسیک"}:{label?:string}){return <a className="da-btn ghost" href="/panel?classic=1">{label}</a>}
