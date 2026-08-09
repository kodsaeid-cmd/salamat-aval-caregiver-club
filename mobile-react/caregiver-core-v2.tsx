import React,{ReactNode} from "react";
import {RefreshCw} from "lucide-react";

export type Notify=(message:string,tone?:"success"|"error"|"info")=>void;
export type RouteKey="home"|"profile"|"wallet"|"training"|"scorecard"|"contract"|"shifts"|"support"|"benefits";
export const fa=(value:unknown)=>Number(value||0).toLocaleString("fa-IR",{maximumFractionDigits:2});
export const money=(value:unknown)=>`${fa(value)} تومان`;
export const text=(value:unknown,fallback="—")=>String(value??"").trim()||fallback;
export const pct=(value:unknown)=>Math.max(0,Math.min(100,Number(value||0)));
export const dateFa=(value:unknown)=>{if(!value)return"—";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium"}).format(new Date(String(value)))}catch{return String(value)}};
export const dateTimeFa=(value:unknown)=>{if(!value)return"—";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short"}).format(new Date(String(value)))}catch{return String(value)}};
const labels:Record<string,string>={ACTIVE:"فعال",INACTIVE:"غیرفعال",APPROVED:"تأییدشده",PENDING:"در انتظار",REQUESTED:"در انتظار بررسی",UNDER_REVIEW:"در حال بررسی",REJECTED:"ردشده",PAID:"پرداخت‌شده",COMPLETED:"تکمیل‌شده",IN_PROGRESS:"در حال انجام",ASSIGNED:"تخصیص‌یافته",OPEN:"باز",RESOLVED:"حل‌شده",CLOSED:"بسته",FINAL:"نهایی",DRAFT:"پیش‌نویس",ISSUED:"صادرشده",ELIGIBLE:"واجد شرایط",PAUSED:"متوقف",NO_CONTRACTS:"بدون قرارداد",WAITING_EVALUATION:"منتظر ارزیابی نهایی",SCORE_BELOW_THRESHOLD:"امتیاز ناکافی",CANCELLED:"لغوشده"};
export const status=(value:unknown)=>labels[String(value||"").toUpperCase()]||text(value);
export const initials=(name:unknown)=>text(name,"مراقب").split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2)||"م";

export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const headers=new Headers(options.headers||{});if(typeof options.body==="string"&&!headers.has("content-type"))headers.set("content-type","application/json");
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,headers});const raw=await response.text();let payload:any={};try{payload=raw?JSON.parse(raw):{}}catch{payload={detail:raw}};
 if(!response.ok){const error:any=new Error(payload.message||`خطای ${response.status}`);error.status=response.status;error.code=payload.error;error.detail=payload.detail;throw error}return payload as T;
}
export async function uploadFile(file:File,category="support",caregiverId?:string){const form=new FormData();form.append("file",file);form.append("category",category);if(caregiverId)form.append("caregiverId",caregiverId);const r=await fetch("/api/files",{method:"POST",body:form,credentials:"same-origin",cache:"no-store"});const p:any=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.message||"بارگذاری فایل انجام نشد.");return p.data}
export function Card({children,className=""}:{children:ReactNode;className?:string}){return <section className={`mr-card ${className}`}>{children}</section>}
export function Metric({label,value,hint}:{label:string;value:ReactNode;hint?:ReactNode}){return <article className="mr-metric"><small>{label}</small><strong>{value}</strong>{hint&&<span>{hint}</span>}</article>}
export function Loading({label="در حال دریافت اطلاعات..."}:{label?:string}){return <div className="mr-state"><span className="mr-spinner"/><strong>{label}</strong></div>}
export function Empty({title,description}:{title:string;description:string}){return <div className="mr-state"><strong>{title}</strong><small>{description}</small></div>}
export function ErrorState({message,retry}:{message:string;retry?:()=>void}){return <div className="mr-state mr-error"><strong>دریافت اطلاعات انجام نشد</strong><small>{message}</small>{retry&&<button className="mr-btn mr-primary" onClick={retry}><RefreshCw size={16}/>تلاش مجدد</button>}</div>}
