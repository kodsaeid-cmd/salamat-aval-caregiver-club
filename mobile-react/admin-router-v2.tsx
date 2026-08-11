import React,{useEffect,useState} from "react";
import {AdminMobileApp} from "./admin";
import {AdminCaregiversMobileV4} from "./admin-caregivers-v4";
import {AdminEvaluationsMobileV3} from "./admin-evaluations-v3";
import {AdminJobAdsMobileV3} from "./admin-job-ads-v3";
import {AdminTrainingMobileV2} from "./admin-training-v2";
import {AdminFinancialCreditsMobileV3} from "./admin-financial-credits-v3";
import "./admin-grid-v2.css";
import "./admin-mobile-readability-v1.css";

const ROUTE_EVENT="salamat-admin-route-v2";
const EVALUATION_PATH="/mobile/admin/evaluations";
const CAREGIVER_PATH="/mobile/admin/caregivers";
const JOB_AD_PATH="/mobile/admin/job_ads";
const TRAINING_PATH="/mobile/admin/training";
const FINANCIAL_CREDITS_PATH="/mobile/admin/financial_credits";
function currentPath(){return location.pathname}
function go(path:string){history.pushState({},"",path);window.dispatchEvent(new Event(ROUTE_EVENT));window.scrollTo({top:0,behavior:"auto"})}

function AccessRoute({kind}:{kind:"caregivers"|"job_ads"|"training"|"financial_credits"}){
 const [access,setAccess]=useState<any>(null),[notice,setNotice]=useState<{message:string;tone:string}|null>(null);
 useEffect(()=>{fetch("/api/access/me",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()).then(p=>setAccess(p.data||p)).catch(()=>setAccess({}))},[]);
 const notify=(message:string,tone:"success"|"error"|"info"="info")=>{setNotice({message,tone});window.setTimeout(()=>setNotice(null),3200)};
 return <>{kind==="caregivers"?<AdminCaregiversMobileV4 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>:kind==="job_ads"?<AdminJobAdsMobileV3 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>:kind==="training"?<AdminTrainingMobileV2 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>:<AdminFinancialCreditsMobileV3 access={access} onExit={()=>go("/mobile/admin/")} notify={notify}/>} {notice&&<div className={`ma-toast ${notice.tone}`}>{notice.message}</div>}</>
}

export function AdminMobileRouterV2({user,onLogout}:{user:any;onLogout:()=>void}){
 const [path,setPath]=useState(currentPath);
 useEffect(()=>{const nativePush=history.pushState.bind(history),nativeReplace=history.replaceState.bind(history);const emit=()=>window.dispatchEvent(new Event(ROUTE_EVENT));history.pushState=((...args:any[])=>{nativePush(...args as [any,string,string?]);emit()}) as History["pushState"];history.replaceState=((...args:any[])=>{nativeReplace(...args as [any,string,string?]);emit()}) as History["replaceState"];const sync=()=>setPath(currentPath());window.addEventListener("popstate",sync);window.addEventListener(ROUTE_EVENT,sync);return()=>{history.pushState=nativePush as History["pushState"];history.replaceState=nativeReplace as History["replaceState"];window.removeEventListener("popstate",sync);window.removeEventListener(ROUTE_EVENT,sync)}},[]);
 if(path===EVALUATION_PATH||path.startsWith(`${EVALUATION_PATH}/`))return <AdminEvaluationsMobileV3 user={user} onExit={()=>go("/mobile/admin/")}/>;
 if(path===CAREGIVER_PATH||path.startsWith(`${CAREGIVER_PATH}/`))return <AccessRoute kind="caregivers"/>;
 if(path===JOB_AD_PATH||path.startsWith(`${JOB_AD_PATH}/`))return <AccessRoute kind="job_ads"/>;
 if(path===TRAINING_PATH||path.startsWith(`${TRAINING_PATH}/`))return <AccessRoute kind="training"/>;
 if(path===FINANCIAL_CREDITS_PATH||path.startsWith(`${FINANCIAL_CREDITS_PATH}/`))return <AccessRoute kind="financial_credits"/>;
 return <AdminMobileApp user={user} onLogout={onLogout}/>;
}
