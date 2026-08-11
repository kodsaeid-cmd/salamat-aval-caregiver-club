import React,{useState} from "react";
import {Gift,UsersRound} from "lucide-react";
import {FinancialCreditsPage as CaregiverFinancialCreditsPage} from "./financial-credits-v3";
import {ReferralRewardsAdmin} from "./referral-rewards-admin-v1";
import {Notify} from "./core";

export function FinancialCreditsPage({access,notify}:{access:any;notify:Notify}){
 const [tab,setTab]=useState<"caregivers"|"referrals">("caregivers");
 return <div className="da-stack"><section className="da-card"><nav className="fv3-tabs"><button className={tab==="caregivers"?"active":""} onClick={()=>setTab("caregivers")}><UsersRound size={17}/>پرونده مالی مراقبین</button><button className={tab==="referrals"?"active":""} onClick={()=>setTab("referrals")}><Gift size={17}/>پاداش معرفی</button></nav></section>{tab==="caregivers"?<CaregiverFinancialCreditsPage access={access} notify={notify}/>:<ReferralRewardsAdmin access={access} notify={notify}/>}</div>
}
