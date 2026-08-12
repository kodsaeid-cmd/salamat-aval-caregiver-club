import React,{useEffect,useState} from "react";
import {Modal,Loading,ErrorState,api,text} from "./core";
import {CaregiverScorecardView} from "../mobile-react/caregiver-scorecard-v2";

export function JobAdApplicantRecordV1({application,onClose}:{application:any;onClose:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{try{const id=String(application.caregiverId||"");const [profile,scorecard,financial]=await Promise.all([api<any>(`/api/admin/caregiver-profile?id=${encodeURIComponent(id)}`),api<any>(`/api/admin/caregiver-scorecard-v2?caregiverId=${encodeURIComponent(id)}`),api<any>(`/api/staff/financial-credits/caregivers/${encodeURIComponent(id)}/profile`).catch(()=>({data:null}))]);if(live)setData({profile:profile.data,scorecard:scorecard.data,financial:financial.data})}catch(e:any){if(live)setError(e.message)}})();return()=>{live=false}},[application.caregiverId]);
 return <Modal title={`کارنامه ${text(application.caregiverName,"مراقب")}`} subtitle="پرونده یکپارچه چهار تبی مراقب" onClose={onClose} wide>{error?<ErrorState message={error}/>:!data?<Loading label="در حال دریافت پرونده مراقب..."/>:<CaregiverScorecardView scorecard={data.scorecard} financial={data.financial} profile={data.profile}/>}</Modal>
}
