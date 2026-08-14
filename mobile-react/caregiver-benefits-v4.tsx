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
 .cb4-mobile-banner{display:grid;margin:0 0 12px;overflow:hidden;border-radius:18px;background:linear-gradient(135deg,#f8fcfa,#edf7f1);box-shadow:0 8px 24px rgba(20,66,44,.08);aspect-ratio:1280/512;position:relative}
 .cb4-mobile-banner-fallback,.cb4-mobile-banner img{grid-area:1/1;width:100%;height:100%}
 .cb4-mobile-banner-fallback{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:22px 24px;box-sizing:border-box;color:#0c7148;direction:rtl}
 .cb4-mobile-banner-fallback strong{font-size:22px;line-height:1.25;color:#df1523}.cb4-mobile-banner-fallback span{font-size:14px;font-weight:800;margin-top:7px;color:#087a4d}
 .cb4-mobile-banner img{display:block;object-fit:cover;image-rendering:auto;position:relative;z-index:2;background:transparent}
 .cb4-benefits-wrap .cb3-head{display:none!important}
}
`}</style><section className="cb4-mobile-banner" aria-label="پاداش و مزایای مراقبین سلامت اول"><div className="cb4-mobile-banner-fallback" aria-hidden="true"><strong>پاداش و مزایای متنوع</strong><span>برای رفاه حال مراقبین سلامت اول</span></div><img src="/mobile/caregiver-benefits-banner-v1.webp?v=10" width={1280} height={512} alt="پاداش و مزایای متنوع برای رفاه حال مراقبین سلامت اول" loading="eager" fetchPriority="high" decoding="async" onError={event=>{const img=event.currentTarget;if(img.dataset.fallback!=="1"){img.dataset.fallback="1";img.src="/assets/caregiver-benefits-banner-v1.webp?v=10"}else{img.style.display="none"}}}/></section><BenefitsPageV3/><div className="cb4-loan-preview"><CaregiverLoanAccreditationPreviewV1/></div><div className="cb4-referral-v6"><ReferralBenefitsV6/></div><div className="cb4-request-center"><CaregiverRequestsV1/></div></div>}
