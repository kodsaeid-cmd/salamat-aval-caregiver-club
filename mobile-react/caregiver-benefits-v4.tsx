import React from "react";
import {BenefitsPage as BenefitsPageV3} from "./caregiver-benefits-v3";
import {ReferralMilestoneProgress} from "./referral-milestone-progress-v1";
import {ReferralLivePies} from "./referral-live-pies-v1";

export function BenefitsPage(){return <div className="cb4-benefits-wrap"><style>{`.cb4-referral-progress{display:none}.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb4-referral-progress{display:block;margin-top:12px}`}</style><BenefitsPageV3/><div className="cb4-referral-progress"><ReferralLivePies/><ReferralMilestoneProgress/></div></div>}
