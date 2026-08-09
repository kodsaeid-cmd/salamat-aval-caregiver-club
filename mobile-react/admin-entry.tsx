import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminMobileRouterV2 } from "./admin-router-v2";
import "./mobile.css";

type Phase="loading"|"admin"|"login"|"classic";

async function currentUser(){
  const response=await fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"});
  if(!response.ok)throw Object.assign(new Error("unauthorized"),{status:response.status});
  return response.json();
}

function Entry(){
  const [phase,setPhase]=useState<Phase>("loading");
  const [user,setUser]=useState<any>(null);
  useEffect(()=>{let active=true;(async()=>{try{const me:any=await currentUser();if(!active)return;const role=String(me?.data?.role||"").toUpperCase();if(role==="ADMIN"){setUser(me.data);setPhase("admin");return}setPhase("classic")}catch(error:any){if(active)setPhase(error?.status===401?"login":"classic")}})();return()=>{active=false}},[]);
  useEffect(()=>{if(phase==="login")location.replace("/mobile/");if(phase==="classic")location.replace("/panel?desktop=1")},[phase]);
  if(phase==="admin")return <AdminMobileRouterV2 user={user} onLogout={()=>location.replace("/mobile/")}/>;
  return <main className="ma-boot"><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><div className="ma-state"><span className="ma-spinner"/><strong>{phase==="loading"?"در حال آماده‌سازی پنل مدیر سامانه...":"در حال انتقال..."}</strong></div></main>;
}

const root=document.getElementById("mobile-admin-root");
if(!root)throw new Error("mobile-admin-root not found");
createRoot(root).render(<Entry/>);
