import React,{useEffect,useState} from "react";
import {ArrowRight} from "lucide-react";
import {ContractsLifecyclePageV2} from "../desktop-react/contracts-lifecycle-v2";
import {MobileAdminUsersAccessV1} from "./admin-users-access-v1";
import "./admin.css";
import "./admin-users-pending-v2.css";
import "./admin-contracts-compact-v1.css";
import "./admin-contracts-compact-v2.css";

export function AdminAccessContractV2({kind,onExit}:{kind:"users"|"contracts";onExit:()=>void}){const [access,setAccess]=useState<any>(null),[notice,setNotice]=useState<{message:string;tone:string}|null>(null);useEffect(()=>{fetch("/api/access/me",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()).then(p=>setAccess(p.data||p)).catch(()=>setAccess({}))},[]);const notify=(message:string,tone:"success"|"error"|"info"="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};return <div className="ma-subpage" style={{minHeight:"100dvh"}}><header className="ma-subpage-head"><button onClick={onExit}><ArrowRight size={20}/></button><strong>{kind==="users"?"کاربران و دسترسی‌ها":"قراردادها"}</strong><span/></header><div className="ma-subpage-body">{access?(kind==="users"?<MobileAdminUsersAccessV1 access={access} notify={notify}/>:<ContractsLifecyclePageV2 access={access} notify={notify} mobileCompact/>):<div className="ma-state"><strong>در حال دریافت دسترسی...</strong></div>}</div>{notice&&<div className={`ma-toast ${notice.tone}`}>{notice.message}</div>}</div>}
