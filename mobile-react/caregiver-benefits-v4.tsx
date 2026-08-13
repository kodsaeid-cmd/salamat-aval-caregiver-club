import React from "react";
import {BenefitsPage as BenefitsPageV3} from "./caregiver-benefits-v3";
import {ReferralMilestoneProgress} from "./referral-milestone-progress-v1";
import "./caregiver-benefits-v4.css";

export function BenefitsPage(){return <div className="cb4-benefits-wrap"><BenefitsPageV3/><div className="cb4-referral-progress"><ReferralMilestoneProgress/></div></div>}
