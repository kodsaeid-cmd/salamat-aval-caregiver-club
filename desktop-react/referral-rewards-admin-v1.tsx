import React,{useState} from "react";
import {Gift,WalletCards} from "lucide-react";
import {ReferralRewardsAdmin as ReferralRewardLedger} from "./referral-rewards-admin-v2";
import {ReferralMilestoneReview} from "./referral-milestone-review-v1";

export function ReferralRewardsAdmin(props:any){
 const [tab,setTab]=useState<"rewards"|"loans">("rewards");
 return <div className="da-stack"><style>{`.rr-subtabs{display:flex;gap:8px;flex-wrap:wrap}.rr-subtabs button{display:inline-flex;align-items:center;gap:8px;border:1px solid #d9e5df;background:#fff;color:#3d5c50;border-radius:13px;padding:10px 15px;font:inherit;font-weight:800;cursor:pointer}.rr-subtabs button.active{background:#087443;color:#fff;border-color:#087443;box-shadow:0 8px 20px rgba(8,116,67,.14)}`}</style><nav className="rr-subtabs" aria-label="بخش‌های پاداش معرفی"><button type="button" className={tab==="rewards"?"active":""} onClick={()=>setTab("rewards")}><Gift size={17}/>ریز پاداش‌های معرفی</button><button type="button" className={tab==="loans"?"active":""} onClick={()=>setTab("loans")}><WalletCards size={17}/>درخواست‌های وام معرفی</button></nav>{tab==="rewards"?<ReferralRewardLedger {...props}/>:<ReferralMilestoneReview notify={props.notify}/>}</div>;
}
