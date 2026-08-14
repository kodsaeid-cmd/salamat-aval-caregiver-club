import React,{useEffect,useMemo,useState} from "react";
import {BadgeCheck,CircleDollarSign,Clock3,Landmark,WalletCards} from "lucide-react";
import {api,Card,dateFa,Empty,ErrorState,fa,Loading,money,text} from "./caregiver-core-v2";
import "./caregiver-requests-v1.css";

const STATUS_FA:Record<string,string>={REQUESTED:"در انتظار بررسی",UNDER_REVIEW:"در حال بررسی",APPROVED:"تأیید شده",REJECTED:"رد شده",PAID:"پرداخت شده",COMPLETED:"تأیید و واریز شده",CANCELLED:"لغو شده"};
const typeLabel=(type:string)=>type==="SETTLEMENT"?"تسویه کیف پول":type==="REFERRAL_LOAN"?"وام معرفی":"تسهیلات";
const typeIcon=(type:string)=>type==="SETTLEMENT"?WalletCards:type==="REFERRAL_LOAN"?Landmark:CircleDollarSign;
const stateClass=(status:string)=>["COMPLETED","PAID","APPROVED"].includes(status)?"done":status==="REJECTED"||status==="CANCELLED"?"rejected":"open";

export function CaregiverRequestsV1(){
 const [data,setData]=useState<any>(null),[error,setError]=useState("");
 const load=async()=>{setError("");try{const p:any=await api("/api/caregiver/platform/requests");setData(p.data)}catch(e:any){setError(e.message||"دریافت درخواست‌ها انجام نشد.")}};
 useEffect(()=>{void load()},[]);
 const items=useMemo(()=>Array.isArray(data?.items)?data.items:[],[data]);
 if(error)return <ErrorState message={error} retry={load}/>;if(!data)return <Loading label="در حال دریافت تاریخچه درخواست‌ها..."/>;
 return <div className="crq1-wrap"><Card><div className="mr-card-head"><div><h3>همه درخواست‌های من</h3><p>هر درخواستی که از طرف شما برای مدیر سامانه ارسال شده، با تاریخچه و نتیجه در اینجا نگهداری می‌شود.</p></div><span className="crq1-total">{fa(data.summary?.total||0)} درخواست</span></div><div className="crq1-summary"><span><b>{fa(data.summary?.open||0)}</b> در جریان</span><span><b>{fa(data.summary?.settlements||0)}</b> تسویه</span><span><b>{fa(data.summary?.referralLoans||0)}</b> وام معرفی</span><span><b>{fa(data.summary?.credits||0)}</b> تسهیلات</span></div></Card>{items.length?<div className="crq1-list">{items.map((item:any)=>{const Icon=typeIcon(String(item.type));const status=String(item.status||"").toUpperCase(),timeline=Array.isArray(item.timeline)?item.timeline:[];return <article className="crq1-row" key={`${item.type}:${item.id}`}><div className="crq1-icon"><Icon size={20}/></div><div className="crq1-main"><header><div><small>{typeLabel(String(item.type))}</small><strong>{text(item.title,"درخواست")}</strong></div><span className={`crq1-status ${stateClass(status)}`}>{STATUS_FA[status]||text(item.status)}</span></header><div className="crq1-meta"><span>{money(item.amountToman||0)}</span><span>ثبت: {dateFa(item.requestedAt)}</span>{item.cycleNumber&&<span>دوره {fa(item.cycleNumber)}</span>}{item.paymentTrackingNumber&&<span>پیگیری: {text(item.paymentTrackingNumber)}</span>}</div>{item.decisionNote&&<p className="crq1-decision"><BadgeCheck size={15}/> نتیجه بررسی: {text(item.decisionNote)}</p>}{timeline.length>0&&<div className="crq1-timeline">{timeline.map((step:any,index:number)=><div className="crq1-step" key={`${step.status}:${step.at}:${index}`}><span className="crq1-dot">{index===timeline.length-1?<BadgeCheck size={11}/>:<Clock3 size={10}/>}</span><div><b>{text(step.label||STATUS_FA[String(step.status||"").toUpperCase()]||step.status)}</b><small>{dateFa(step.at)}{step.note?` • ${text(step.note)}`:""}</small></div></div>)}</div>}</div></article>})}</div>:<Empty title="هنوز درخواستی ثبت نشده" description="درخواست تسویه کیف پول، وام معرفی و سایر درخواست‌های مالی شما پس از ثبت در اینجا نمایش داده می‌شوند."/>}</div>
}
