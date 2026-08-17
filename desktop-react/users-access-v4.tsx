import React,{useEffect,useState} from "react";
import {UsersAccessPageV3} from "./users-access-v3";
import {api,fa,Notify} from "./core";
import "./users-access-v4.css";

export function UsersAccessPageV4({access,notify}:{access:any;notify:Notify}){
 const [summary,setSummary]=useState({newRegistrations:0,reregistrations:0,unseenReregistrations:0});
 const load=async()=>{try{const p:any=await api("/api/admin/caregiver-registrations/summary");setSummary({newRegistrations:Number(p.data?.newRegistrations||0),reregistrations:Number(p.data?.reregistrations||0),unseenReregistrations:Number(p.data?.unseenReregistrations||0)})}catch{}};
 useEffect(()=>{void load();const id=window.setInterval(load,15000);return()=>window.clearInterval(id)},[]);
 const open=(registration:string)=>{const url=new URL(location.href);url.pathname="/app/users";url.search="";url.searchParams.set("registration",registration);location.assign(url.toString())};
 return <div className="uav4-wrap"><section className="uav4-network-card"><button type="button" className="uav4-registration-card new" onClick={()=>open("NEW")}><small>ثبت نام جدید</small><strong>{fa(summary.newRegistrations)}</strong><span>جدیدالورودهای در انتظار تأیید</span></button><button type="button" className="uav4-registration-card rereg" onClick={()=>open("REREGISTRATION")}><small>ثبت نام مجددی‌ها</small><strong>{fa(summary.reregistrations)}</strong><span>{summary.unseenReregistrations?`${fa(summary.unseenReregistrations)} مورد هنوز دیده نشده`:"فهرست ثبت‌نام مجدد"}</span></button></section><UsersAccessPageV3 access={access} notify={notify}/></div>
}
