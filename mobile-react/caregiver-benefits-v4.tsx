import React from "react";
import {BenefitsPage as BenefitsPageV3} from "./caregiver-benefits-v3";
import {CaregiverLoanAccreditationPreviewV1} from "./caregiver-loan-accreditation-preview-v1";
import {ReferralBenefitsV6} from "./referral-benefits-v6";
import {CaregiverRequestsV1} from "./caregiver-requests-v1";

export function BenefitsPage(){return <div className="cb4-benefits-wrap"><style>{`
.cb4-loan-preview,.cb4-reward-pending,.cb4-referral-v6,.cb4-request-center{display:none}
.cb4-benefits-wrap .cb3-head p{display:none!important}
.cb4-benefits-wrap .clap-slide>p{display:none!important}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(1).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(2).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb3-tabs-card>.cb3-panel,.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(4).active) .cb3-tabs-card>.cb3-panel{display:none!important}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(1).active) .cb4-loan-preview{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(2).active) .cb4-reward-pending{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(3).active) .cb4-referral-v6{display:block;margin-top:12px}
.cb4-benefits-wrap:has(.cb3-tabs button:nth-child(4).active) .cb4-request-center{display:block;margin-top:12px}
.cb4-reward-pending-card{min-height:132px;display:grid;place-items:center;padding:28px 22px;border:1px solid #dce9e2;border-radius:18px;background:linear-gradient(135deg,#fbfdfc,#f1f8f4);box-shadow:0 8px 24px rgba(19,63,41,.06);text-align:center;color:#234131;font-size:12px;font-weight:900;line-height:2}
`}</style><BenefitsPageV3/><div className="cb4-loan-preview"><CaregiverLoanAccreditationPreviewV1/></div><div className="cb4-reward-pending"><div className="cb4-reward-pending-card" role="status">پاداش‌های شما با توجه به ماندگاری در قراردادهای مربوطه در حال محاسبه است.</div></div><div className="cb4-referral-v6"><ReferralBenefitsV6/></div><div className="cb4-request-center"><CaregiverRequestsV1/></div></div>}
