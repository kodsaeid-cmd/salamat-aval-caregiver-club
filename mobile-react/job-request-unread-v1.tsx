import React,{useCallback,useEffect,useState} from "react";
import "./job-request-unread-v1.css";

export const MOBILE_JOB_REQUEST_UNREAD_EVENT="salamat-job-request-unread-changed";

async function request(path:string,options:RequestInit={}){const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});const payload:any=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.message||`خطای ${response.status}`);return payload}

export async function markMobileJobAdRequestsSeenV1(adId:string){
 if(!adId)return;
 await request(`/api/staff/job-ads/${encodeURIComponent(adId)}/requests-seen`,{method:"POST"});
 window.dispatchEvent(new CustomEvent(MOBILE_JOB_REQUEST_UNREAD_EVENT,{detail:{adId}}));
}

export function MobileJobRequestUnreadDotV1(){
 const [count,setCount]=useState(0);
 const load=useCallback(async()=>{try{const p=await request("/api/staff/job-ads/request-unread-summary");setCount(Number(p.data?.unreadAds||0))}catch{setCount(0)}},[]);
 useEffect(()=>{void load();const onChange=()=>void load();window.addEventListener(MOBILE_JOB_REQUEST_UNREAD_EVENT,onChange);const timer=window.setInterval(load,30000);return()=>{window.removeEventListener(MOBILE_JOB_REQUEST_UNREAD_EVENT,onChange);window.clearInterval(timer)}},[load]);
 if(count<=0)return null;
 return <b className="mjr-unread-dot" aria-label={`${count.toLocaleString("fa-IR")} آگهی دارای درخواست جدید`} title={`${count.toLocaleString("fa-IR")} آگهی دارای درخواست جدید`}/>;
}
