import React from "react";
import {BenefitsPage as BenefitsPageV3} from "./caregiver-benefits-v3";
import {CaregiverLoanAccreditationPreviewV1} from "./caregiver-loan-accreditation-preview-v1";
import {ReferralBenefitsV6} from "./referral-benefits-v6";
import {CaregiverRequestsV1} from "./caregiver-requests-v1";

export function BenefitsPage(){return <div className="cb4-benefits-wrap"><style>{`
.cb4-mobile-banner{display:none}
.cb4-loan-preview,.cb4-referral-v6,.cb4-request-center{display:none}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(1).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(4).active) .cb3-tabs-card>.cb3-panel{display:none!important}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(1).active) .cb4-loan-preview{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb4-referral-v6{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(4).active) .cb4-request-center{display:block;margin-top:12px}
@media(max-width:759px){
 .cb4-mobile-banner{display:block;margin:0 0 12px;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(20,66,44,.08)}
 .cb4-mobile-banner img{display:block;width:100%;height:auto;aspect-ratio:1983/793;object-fit:cover}
 .cb4-benefits-wrap .cb3-head{display:none!important}
}
`}</style><section className="cb4-mobile-banner" aria-label="پاداش و مزایای مراقبین سلامت اول"><img src="/assets/caregiver-benefits-banner-v1.webp" alt="پاداش و مزایای متنوع برای رفاه حال مراقبین سلامت اول" loading="eager" decoding="async"/></section><BenefitsPageV3/><div className="cb4-loan-preview"><CaregiverLoanAccreditationPreviewV1/></div><div className="cb4-referral-v6"><ReferralBenefitsV6/></div><div className="cb4-request-center"><CaregiverRequestsV1/></div></div>}
