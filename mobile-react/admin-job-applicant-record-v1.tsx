import React,{useEffect,useState} from "react";
import {ArrowRight} from "lucide-react";
import {CaregiverScorecardView} from "./caregiver-scorecard-v2";
import "./admin.css";

async function api<T=any>(path:string):Promise<T>{const r=await fetch(path,{credentials:"same-origin",cache:"no-store"}),raw=await r.text();let p:any={};try{p=raw?JSON.parse(raw):{}}catch{p={}}if(!r.ok)throw new Error(p.message||`خطای ${r.status}`);return p as T}
export function AdminJobApplicantRecordV1({caregiverId,name,onBack}:{caregiverId:string;name:string;onBack:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{try{const [profile,scorecard,financial]=await Promise.all([api<any>(`/api/admin/caregiver-profile?id=${encodeURIComponent(caregiverId)}`),api<any>(`/api/admin/caregiver-scorecard-v2?caregiverId=${encodeURIComponent(caregiverId)}`),api<any>(`/api/staff/financial-credits/caregivers/${encodeURIComponent(caregiverId)}/profile`).catch(()=>({data:null}))]);if(live)setData({profile:profile.data,scorecard:scorecard.data,financial:financial.data})}catch(e:any){if(live)setError(e.message)}})();return()=>{live=false}},[caregiverId]);
 return <div className="ma-app"><header className="mae-mobile-head"><button type="button" onClick={onBack}><ArrowRight size={20}/></button><strong>کارنامه {name||"مراقب"}</strong><span/></header><main className="ma-main">{error?<div className="ma-state error"><strong>کارنامه دریافت نشد</strong><small>{error}</small></div>:!data?<div className="ma-state"><span className="ma-spinner"/><strong>در حال دریافت پرونده چهار تبی...</strong></div>:<CaregiverScorecardView scorecard={data.scorecard} financial={data.financial} profile={data.profile}/>}</main></div>
}
