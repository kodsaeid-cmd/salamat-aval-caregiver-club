import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminMobileRouterV2 } from "./admin-router-v2";
import "./mobile.css";
import "./admin-vazirmatn.css";

type Phase="loading"|"staff"|"login"|"caregiver";
const STAFF_ROLES=new Set(["ADMIN","RECRUITER","HR","SUPPORT","EVALUATOR","EDUCATION","OPERATIONS","SALES_CONSULTANT"]);

async function currentUser(){
  const response=await fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"});
  if(!response.ok)throw Object.assign(new Error("unauthorized"),{status:response.status});
  return response.json();
}

function Entry(){
  const [phase,setPhase]=useState<Phase>("loading");
  const [user,setUser]=useState<any>(null);
  useEffect(()=>{let active=true;(async()=>{try{const me:any=await currentUser();if(!active)return;const role=String(me?.data?.role||"").toUpperCase();if(STAFF_ROLES.has(role)){setUser(me.data);setPhase("staff");return}setPhase("caregiver")}catch(error:any){if(active)setPhase(error?.status===401?"login":"caregiver")}})();return()=>{active=false}},[]);
  useEffect(()=>{if(phase==="login"||phase==="caregiver")location.replace("/mobile/")},[phase]);
  if(phase==="staff")return <AdminMobileRouterV2 user={user} onLogout={()=>location.replace("/mobile/")}/>;
  return <main className="ma-boot" aria-busy={phase==="loading"}><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><div className="ma-state"><span className="ma-spinner"/><strong>{phase==="loading"?"در حال آماده‌سازی پنل سازمانی سلامت اول...":"در حال انتقال..."}</strong></div></main>;
}

const root=document.getElementById("mobile-admin-root");
if(!root)throw new Error("mobile-admin-root not found");
createRoot(root).render(<Entry/>);
