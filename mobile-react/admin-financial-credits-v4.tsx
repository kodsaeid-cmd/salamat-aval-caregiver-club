import React,{useState} from "react";
import {ArrowRight,Gift,HeartHandshake,UsersRound} from "lucide-react";
import {AdminFinancialCreditsLoanPolicyMobileV4} from "./admin-financial-credits-loan-policy-v4";
import {AdminReferralRewardsMobileV4} from "./admin-referral-rewards-mobile-v4";
import {AdminRetentionRewardsMobileV1} from "./admin-retention-rewards-v1";
import "./admin.css";
import "./admin-financial-referrals-v3.css";

type Notify=(message:string,tone?:"success"|"error"|"info")=>void;
type Props={access:any;onExit:()=>void;notify:Notify};

function SecondaryPage({title,onExit,children}:{title:string;onExit:()=>void;children:React.ReactNode}){return <div className="ma-app"><header className="mae-mobile-head"><button onClick={onExit}><ArrowRight size={20}/></button><strong>{title}</strong><span/></header><main className="ma-main">{children}</main></div>}

export function AdminFinancialCreditsMobileV4(props:Props){const [tab,setTab]=useState<"caregivers"|"referrals"|"retention">("caregivers");return <div className="mafr-shell"><nav className="mafr-tabs"><button className={tab==="caregivers"?"active":""} onClick={()=>setTab("caregivers")}><UsersRound size={16}/>وام و پرونده مالی</button><button className={tab==="referrals"?"active":""} onClick={()=>setTab("referrals")}><Gift size={16}/>پاداش معرفی</button><button className={tab==="retention"?"active":""} onClick={()=>setTab("retention")}><HeartHandshake size={16}/>پاداش ماندگاری</button></nav>{tab==="caregivers"?<AdminFinancialCreditsLoanPolicyMobileV4 {...props}/>:tab==="referrals"?<SecondaryPage title="پاداش معرفی" onExit={props.onExit}><AdminReferralRewardsMobileV4 access={props.access} notify={props.notify}/></SecondaryPage>:<SecondaryPage title="پاداش ماندگاری" onExit={props.onExit}><AdminRetentionRewardsMobileV1 access={props.access} notify={props.notify}/></SecondaryPage>}</div>}
