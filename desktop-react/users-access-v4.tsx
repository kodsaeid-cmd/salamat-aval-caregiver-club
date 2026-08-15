import React,{useEffect,useState} from "react";
import {UsersAccessPageV3} from "./users-access-v3";
import {api,fa,Notify} from "./core";
import "./users-access-v4.css";

export function UsersAccessPageV4({access,notify}:{access:any;notify:Notify}){
 const [summary,setSummary]=useState({pending:0,newJoiners:0});
 const load=async()=>{
  try{
   const createdFrom=new Date(Date.now()-7*86400000).toISOString();
   const [pending,newJoiners]:any=await Promise.all([
    api("/api/users?page=1&role=CAREGIVER&status=PENDING&registration=SELF_REGISTERED"),
    api(`/api/users?page=1&role=CAREGIVER&registration=SELF_REGISTERED&createdFrom=${encodeURIComponent(createdFrom)}`),
   ]);
   setSummary({
    pending:Number(pending.pagination?.total||0),
    newJoiners:Number(newJoiners.pagination?.total||0),
   });
  }catch{}
 };
 useEffect(()=>{void load();const id=window.setInterval(load,15000);return()=>window.clearInterval(id)},[]);
 return <div className="uav4-wrap"><section className="uav4-network-card"><div><small>پیوسته به شبکه مراقبین</small><strong>{fa(summary.newJoiners)}</strong><span>ثبت‌نام مستقیم فرم در ۷ روز اخیر</span></div><div><small>در انتظار فعال‌سازی</small><strong>{fa(summary.pending)}</strong><span>تا تأیید در کاربران و دسترسی‌ها امکان ورود ندارند</span></div></section><UsersAccessPageV3 access={access} notify={notify}/></div>
}
