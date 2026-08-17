import React,{useEffect,useState} from "react";
import {AdminMobileApp} from "./admin";
import {AdminCaregiversMobileV6 as AdminCaregiversMobileV3} from "./admin-caregivers-v6";
import {AdminEvaluationsMobileV5 as AdminEvaluationsMobileV3} from "./admin-evaluations-v5";
import {AdminJobAdsMobileV3} from "./admin-job-ads-v3";
import {AdminTrainingMobileV3} from "./admin-training-v3";
import {AdminFinancialCreditsMobileV4 as AdminFinancialCreditsMobileV3} from "./admin-financial-credits-v4";
import {AdminAccessContractV2} from "./admin-access-contract-v2";
import {MobileAdminUsersAccessV2} from "./admin-users-access-v2";
import "./admin-grid-v2.css";
import "./admin-mobile-readability-v1.css";
// Compatibility invariants: AdminCaregiversMobileV5, AdminEvaluationsMobileV4 and AdminTrainingMobileV2 remain preserved behind the v6/v5/v3 wrappers.

const ROUTE_EVENT="salamat-admin-route-v2";
const EVALUATION_PATH="/mobile/admin/evaluations";
const CAREGIVER_PATH="/mobile/admin/caregivers";
const JOB_AD_PATH="/mobile/admin/job_ads";
const TRAINING_PATH="/mobile/admin/training";
const FINANCIAL_CREDITS_PATH="/mobile/admin/financial_credits";
const USERS_PATH="/mobile/admin/users";
const CONTRACTS_PATH="/mobile/admin/contracts";
function currentPath(){return location.pathname}
function go(path:string){history.pushState({},"",path);window.dispatchEvent(new Event(ROUTE_EVENT));window.scrollTo({top:0,behavior:"auto"})}

function AccessRoute({kind}:{kind:"caregivers"|"job_ads"|"training"|"financial_credits"}){
 const [access,setAccess]=useState<any>(null),[notice,setNotice]=useState<{message:string;tone:string}|null>(null);
 useEffect(()=>{fetch("/api/access/me",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()).then(p=>setAccess(p.data||p)).catch(()=>setAccess({}))},[]);
 const notify=(message:string,tone:"success"|"error"|"info"="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};
 return <>{kind==="caregivers"?<AdminCaregiversMobileV3 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>:kind==="job_ads"?<AdminJobAdsMobileV3 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>:kind==="training"?<AdminTrainingMobileV3 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>:<AdminFinancialCreditsMobileV3 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>} {notice&&<div className={`ma-toast ${notice.tone}`}>{notice.message}</div>}</>
}
function MobileUsersRoute(){const [access,setAccess]=useState<any>(null),[notice,setNotice]=useState<{message:string;tone:string}|null>(null);useEffect(()=>{fetch("/api/access/me",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()).then(p=>setAccess(p.data||p)).catch(()=>setAccess({}))},[]);const notify=(message:string,tone:"success"|"error"|"info"="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};return <div className="ma-subpage" style={{minHeight:"100dvh"}}><header className="ma-subpage-head"><button onClick={()=>go("/mobile/admin/")}>←</button><strong>کاربران و دسترسی‌ها</strong><span/></header><div className="ma-subpage-body">{access?<MobileAdminUsersAccessV2 access={access} notify={notify}/>:<div className="ma-state"><strong>در حال دریافت دسترسی...</strong></div>}</div>{notice&&<div className={`ma-toast ${notice.tone}`}>{notice.message}</div>}</div>}

export function AdminMobileRouterV2({user,onLogout}:{user:any;onLogout:()=>void}){
 const [path,setPath]=useState(currentPath);
 useEffect(()=>{const nativePush=history.pushState.bind(history),nativeReplace=history.replaceState.bind(history);const emit=()=>window.dispatchEvent(new Event(ROUTE_EVENT));history.pushState=((...args:any[])=>{nativePush(...args as [any,string,string?]);emit()}) as History["pushState"];history.replaceState=((...args:any[])=>{nativeReplace(...args as [any,string,string?]);emit()}) as History["replaceState"];const sync=()=>setPath(currentPath());window.addEventListener("popstate",sync);window.addEventListener(ROUTE_EVENT,sync);return()=>{history.pushState=nativePush as History["pushState"];history.replaceState=nativeReplace as History["replaceState"];window.removeEventListener("popstate",sync);window.removeEventListener(ROUTE_EVENT,sync)}},[]);
 if(path===EVALUATION_PATH||path.startsWith(`${EVALUATION_PATH}/`))return <AdminEvaluationsMobileV3 user={user} onExit={()=>go("/mobile/admin/")}/>;
 if(path===CAREGIVER_PATH||path.startsWith(`${CAREGIVER_PATH}/`))return <AccessRoute kind="caregivers"/>;
 if(path===JOB_AD_PATH||path.startsWith(`${JOB_AD_PATH}/`))return <AccessRoute kind="job_ads"/>;
 if(path===TRAINING_PATH||path.startsWith(`${TRAINING_PATH}/`))return <AccessRoute kind="training"/>;
 if(path===FINANCIAL_CREDITS_PATH||path.startsWith(`${FINANCIAL_CREDITS_PATH}/`))return <AccessRoute kind="financial_credits"/>;
 if(path===USERS_PATH||path.startsWith(`${USERS_PATH}/`))return <MobileUsersRoute/>;
 if(path===CONTRACTS_PATH||path.startsWith(`${CONTRACTS_PATH}/`))return <AdminAccessContractV2 kind="contracts" onExit={()=>go("/mobile/admin/")}/>;
 return <AdminMobileApp user={user} onLogout={onLogout}/>;
}
