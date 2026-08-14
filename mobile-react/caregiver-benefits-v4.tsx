import React from "react";
import {BenefitsPage as BenefitsPageV3} from "./caregiver-benefits-v3";
import {CaregiverLoanAccreditationPreviewV1} from "./caregiver-loan-accreditation-preview-v1";
import {ReferralBenefitsV6} from "./referral-benefits-v6";
import {CaregiverRequestsV1} from "./caregiver-requests-v1";

export function BenefitsPage(){return <div className="cb4-benefits-wrap"><style>{`
.cb4-loan-preview,.cb4-referral-v6,.cb4-request-center{display:none}
.cb4-benefits-wrap .cb3-head p{display:none!important}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(1).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(4).active) .cb3-tabs-card>.cb3-panel{display:none!important}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(1).active) .cb4-loan-preview{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb4-referral-v6{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(4).active) .cb4-request-center{display:block;margin-top:12px}
`}</style><BenefitsPageV3/><div className="cb4-loan-preview"><CaregiverLoanAccreditationPreviewV1/></div><div className="cb4-referral-v6"><ReferralBenefitsV6/></div><div className="cb4-request-center"><CaregiverRequestsV1/></div></div>}
