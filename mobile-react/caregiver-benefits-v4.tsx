import React from "react";
import {BenefitsPage as BenefitsPageV3} from "./caregiver-benefits-v3";
import {ReferralBenefitsV5} from "./referral-benefits-v5";

export function BenefitsPage(){return <div className="cb4-benefits-wrap"><style>{`.cb4-referral-v5{display:none}.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb3-head{display:none!important}.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb3-tabs-card>.cb3-panel{display:none!important}.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb4-referral-v5{display:block;margin-top:12px}`}</style><BenefitsPageV3/><div className="cb4-referral-v5"><ReferralBenefitsV5/></div></div>}
