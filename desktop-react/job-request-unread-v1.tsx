import React,{useCallback,useEffect,useState} from "react";
import {api,fa} from "./core";
import "./job-request-unread-v1.css";

export const JOB_REQUEST_UNREAD_EVENT="salamat-job-request-unread-changed";

export async function markJobAdRequestsSeenV1(adId:string){
 if(!adId)return;
 await api(`/api/staff/job-ads/${encodeURIComponent(adId)}/requests-seen`,{method:"POST"});
 window.dispatchEvent(new CustomEvent(JOB_REQUEST_UNREAD_EVENT,{detail:{adId}}));
}

export function notifyJobRequestUnreadChangedV1(){window.dispatchEvent(new Event(JOB_REQUEST_UNREAD_EVENT))}

export function JobRequestUnreadDotV1({compact=false}:{compact?:boolean}){
 const [count,setCount]=useState(0);
 const load=useCallback(async()=>{try{const p:any=await api("/api/staff/job-ads/request-unread-summary");setCount(Number(p.data?.unreadAds||0))}catch{setCount(0)}},[]);
 useEffect(()=>{void load();const onChange=()=>void load();window.addEventListener(JOB_REQUEST_UNREAD_EVENT,onChange);const timer=window.setInterval(load,30000);return()=>{window.removeEventListener(JOB_REQUEST_UNREAD_EVENT,onChange);window.clearInterval(timer)}},[load]);
 if(count<=0)return null;
 return <span className={`jru-dot ${compact?"compact":""}`} title={`${fa(count)} آگهی دارای درخواست جدید`} aria-label={`${fa(count)} آگهی دارای درخواست جدید`}><i/><b>{compact?"":fa(count)}</b></span>;
}
