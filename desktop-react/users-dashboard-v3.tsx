import React,{useEffect,useState} from "react";
import {BriefcaseBusiness,Gauge,RotateCcw,Send,UserPlus} from "lucide-react";
import {DashboardPage as DashboardPageV2} from "./users-dashboard-v2";
import {api,can,fa} from "./core";
import "./users-dashboard-v3.css";

function KpiGauge({kind,label,numerator,denominator,percent}:{kind:"dispatch"|"contract";label:string;numerator:number;denominator:number;percent:number}){
 const safe=Math.max(0,Math.min(100,Number(percent||0)));
 const Icon=kind==="dispatch"?Send:BriefcaseBusiness;
 return <article className={`rdb3-kpi-gauge ${kind}`}><div className="rdb3-kpi-copy"><span><Icon size={18}/></span><div><small>{label}</small><strong>{fa(numerator)} <em>از {fa(denominator)}</em></strong><p>{kind==="dispatch"?"مراقب در وضعیت اعزام نسبت به کل آگهی‌ها":"مراقب در قرارداد نسبت به کل قراردادها"}</p></div></div><div className="rdb3-gauge" style={{"--p":`${safe}%`} as React.CSSProperties}><div><strong>{Number(percent||0).toLocaleString("fa-IR",{maximumFractionDigits:1})}٪</strong><small>KPI</small></div></div></article>;
}

export function DashboardPage({access,navigate}:{access:any;navigate:(key:string)=>void}){
 const [summary,setSummary]=useState({newRegistrations:0,reregistrations:0,unseenReregistrations:0});
 const [workforce,setWorkforce]=useState<any>(null);
 const load=async()=>{try{const [r,w]=await Promise.allSettled([api<any>("/api/admin/caregiver-registrations/summary"),api<any>("/api/admin/caregiver-workforce-summary")]);if(r.status==="fulfilled"){const p=r.value;setSummary({newRegistrations:Number(p.data?.newRegistrations||0),reregistrations:Number(p.data?.reregistrations||0),unseenReregistrations:Number(p.data?.unseenReregistrations||0)})}if(w.status==="fulfilled")setWorkforce(w.value.data||null)}catch{}};
 useEffect(()=>{void load();const id=window.setInterval(load,15000);return()=>window.clearInterval(id)},[]);
 const open=(registration:string)=>{const url=new URL(location.href);url.pathname="/app/users";url.search="";url.searchParams.set("registration",registration);location.assign(url.toString())};
 return <div className="rdb3-wrap">{can(access,"staff.users","view")&&<section className="rdb3-registration-cards"><button type="button" className="rdb3-card new" onClick={()=>open("NEW")}><span><UserPlus size={23}/></span><div><small>ثبت نام جدید</small><strong>{fa(summary.newRegistrations)}</strong><em>جدیدالورودهای در انتظار تأیید</em></div></button><button type="button" className="rdb3-card repeat" onClick={()=>open("REREGISTRATION")}><span><RotateCcw size={23}/></span><div><small>ثبت نام مجددی‌ها</small><strong>{fa(summary.reregistrations)}</strong><em>{summary.unseenReregistrations?`${fa(summary.unseenReregistrations)} مورد جدید برای بررسی`:"فهرست ثبت نام مجدد"}</em></div></button></section>}<section className="rdb3-kpi-section"><div className="rdb3-kpi-head"><div><Gauge size={20}/><span><strong>نرخ عملیاتی اعزام و قرارداد</strong><small>نمای گیج KPI از وضعیت زنده مراقبین نسبت به کل آگهی‌ها و قراردادها</small></span></div></div><div className="rdb3-kpi-grid"><KpiGauge kind="dispatch" label="نرخ اعزام" numerator={Number(workforce?.dispatchCaregivers||0)} denominator={Number(workforce?.totalJobAds||0)} percent={Number(workforce?.dispatchToJobAdsPercent||0)}/><KpiGauge kind="contract" label="نرخ قرارداد" numerator={Number(workforce?.inContractCaregivers||0)} denominator={Number(workforce?.totalContracts||0)} percent={Number(workforce?.inContractToContractsPercent||0)}/></div></section><DashboardPageV2 access={access} navigate={navigate}/></div>
}
