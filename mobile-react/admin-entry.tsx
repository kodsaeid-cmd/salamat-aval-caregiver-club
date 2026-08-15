import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminMobileRouterV2 } from "./admin-router-v2";
import "./mobile.css";
import "./admin-vazirmatn.css";

type Phase="loading"|"staff"|"login"|"caregiver";

async function currentSession(){
  const [authResponse,accessResponse]=await Promise.all([
    fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"}),
    fetch("/api/access/me",{credentials:"same-origin",cache:"no-store"}),
  ]);
  if(!authResponse.ok)throw Object.assign(new Error("unauthorized"),{status:authResponse.status});
  const auth:any=await authResponse.json();
  const access:any=accessResponse.ok?await accessResponse.json():null;
  return {user:auth?.data||auth?.user||auth,access:access?.data||access};
}

function Entry(){
  const [phase,setPhase]=useState<Phase>("loading");
  const [user,setUser]=useState<any>(null);
  useEffect(()=>{let active=true;(async()=>{try{const session=await currentSession();if(!active)return;if(String(session?.access?.panel||"").toUpperCase()==="STAFF"){setUser(session.user);setPhase("staff");return}setPhase("caregiver")}catch(error:any){if(active)setPhase(error?.status===401?"login":"caregiver")}})();return()=>{active=false}},[]);
  useEffect(()=>{if(phase==="login"||phase==="caregiver")location.replace("/mobile/")},[phase]);
  if(phase==="staff")return <AdminMobileRouterV2 user={user} onLogout={()=>location.replace("/mobile/")}/>;
  return <main className="ma-boot" aria-busy={phase==="loading"}><img src="/logo-salamat-aval.svg" alt="سلامت اول"/><div className="ma-state"><span className="ma-spinner"/><strong>{phase==="loading"?"در حال آماده‌سازی پنل سازمانی سلامت اول...":"در حال انتقال..."}</strong></div></main>;
}

const root=document.getElementById("mobile-admin-root");
if(!root)throw new Error("mobile-admin-root not found");
createRoot(root).render(<Entry/>);
