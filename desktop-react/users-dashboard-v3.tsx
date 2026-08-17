import React,{useEffect,useState} from "react";
import {RotateCcw,UserPlus} from "lucide-react";
import {DashboardPage as DashboardPageV2} from "./users-dashboard-v2";
import {api,can,fa} from "./core";
import "./users-dashboard-v3.css";

export function DashboardPage({access,navigate}:{access:any;navigate:(key:string)=>void}){
 const [summary,setSummary]=useState({newRegistrations:0,reregistrations:0,unseenReregistrations:0});
 const load=async()=>{try{const p:any=await api("/api/admin/caregiver-registrations/summary");setSummary({newRegistrations:Number(p.data?.newRegistrations||0),reregistrations:Number(p.data?.reregistrations||0),unseenReregistrations:Number(p.data?.unseenReregistrations||0)})}catch{}};
 useEffect(()=>{void load();const id=window.setInterval(load,15000);return()=>window.clearInterval(id)},[]);
 const open=(registration:string)=>{const url=new URL(location.href);url.pathname="/app/users";url.search="";url.searchParams.set("registration",registration);location.assign(url.toString())};
 return <div className="rdb3-wrap">{can(access,"staff.users","view")&&<section className="rdb3-registration-cards"><button type="button" className="rdb3-card new" onClick={()=>open("NEW")}><span><UserPlus size={23}/></span><div><small>ثبت نام جدید</small><strong>{fa(summary.newRegistrations)}</strong><em>جدیدالورودهای در انتظار تأیید</em></div></button><button type="button" className="rdb3-card repeat" onClick={()=>open("REREGISTRATION")}><span><RotateCcw size={23}/></span><div><small>ثبت نام مجددی‌ها</small><strong>{fa(summary.reregistrations)}</strong><em>{summary.unseenReregistrations?`${fa(summary.unseenReregistrations)} مورد جدید برای بررسی`:"فهرست ثبت نام مجدد"}</em></div></button></section>}<DashboardPageV2 access={access} navigate={navigate}/></div>
}
