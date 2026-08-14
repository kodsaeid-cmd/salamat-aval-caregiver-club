import React,{useState} from "react";
import {Gift,HeartHandshake,ReceiptText,UsersRound} from "lucide-react";
import {FinancialCreditsLoanPolicyPage as CaregiverFinancialCreditsPage} from "./financial-credits-loan-policy-v5";
import {ReferralRewardsAdmin} from "./referral-rewards-admin-v1";
import {RetentionRewardsAdmin} from "./retention-rewards-admin-v1";
import {PaymentRequestsAdmin} from "./payment-requests-admin-v1";
import {Notify} from "./core";

export function FinancialCreditsPage({access,notify}:{access:any;notify:Notify}){
 const [tab,setTab]=useState<"caregivers"|"referrals"|"retention"|"payments">("caregivers");
 return <div className="da-stack"><section className="da-card"><nav className="fv3-tabs"><button className={tab==="caregivers"?"active":""} onClick={()=>setTab("caregivers")}><UsersRound size={17}/>پرونده مالی و وام</button><button className={tab==="referrals"?"active":""} onClick={()=>setTab("referrals")}><Gift size={17}/>پاداش معرفی</button><button className={tab==="retention"?"active":""} onClick={()=>setTab("retention")}><HeartHandshake size={17}/>پاداش ماندگاری</button><button className={tab==="payments"?"active":""} onClick={()=>setTab("payments")}><ReceiptText size={17}/>درخواست‌های پرداخت</button></nav></section>{tab==="caregivers"?<CaregiverFinancialCreditsPage access={access} notify={notify}/>:tab==="referrals"?<ReferralRewardsAdmin access={access} notify={notify}/>:tab==="retention"?<RetentionRewardsAdmin access={access} notify={notify}/>:<PaymentRequestsAdmin access={access} notify={notify}/>}</div>
}
