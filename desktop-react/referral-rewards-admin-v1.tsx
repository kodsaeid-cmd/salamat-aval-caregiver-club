import React from "react";
import {ReferralRewardsAdmin as ExistingReferralRewards} from "./referral-rewards-admin-v2";
import {ReferralMilestoneReview} from "./referral-milestone-review-v1";

export function ReferralRewardsAdmin(props:any){
 return <div className="da-stack"><ExistingReferralRewards {...props}/><ReferralMilestoneReview notify={props.notify}/></div>;
}
