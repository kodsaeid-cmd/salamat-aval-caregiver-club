import React,{useState} from "react";
import {Gift,HeartHandshake,UsersRound} from "lucide-react";
import {FinancialCreditsLoanPolicyPage as CaregiverFinancialCreditsPage} from "./financial-credits-loan-policy-v5";
import {ReferralRewardsAdmin} from "./referral-rewards-admin-v1";
import {RetentionRewardsAdmin} from "./retention-rewards-admin-v1";
import {Notify} from "./core";

export function FinancialCreditsPage({access,notify}:{access:any;notify:Notify}){
 const [tab,setTab]=useState<"caregivers"|"referrals"|"retention">("caregivers");
 return <div className="da-stack"><section className="da-card"><nav className="fv3-tabs"><button className={tab==="caregivers"?"active":""} onClick={()=>setTab("caregivers")}><UsersRound size={17}/>پرونده مالی و وام</button><button className={tab==="referrals"?"active":""} onClick={()=>setTab("referrals")}><Gift size={17}/>پاداش معرفی</button><button className={tab==="retention"?"active":""} onClick={()=>setTab("retention")}><HeartHandshake size={17}/>پاداش ماندگاری</button></nav></section>{tab==="caregivers"?<CaregiverFinancialCreditsPage access={access} notify={notify}/>:tab==="referrals"?<ReferralRewardsAdmin access={access} notify={notify}/>:<RetentionRewardsAdmin access={access} notify={notify}/>}</div>
}
