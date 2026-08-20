import {requireAccess} from "./access-control";
import {ensureContractProgressSchema} from "./contract-progress-engine-v1";
import {ensureJobApplicationLifecycleSchema} from "./job-application-lifecycle-v1";
import {processPendingJobApplicationStatusSmsV1} from "./job-application-status-sms-v1";
import {type Env,fail,getUser,json} from "./lib";

export const ADMIN_CAREGIVER_WORKFORCE_SUMMARY_VERSION="1.2.0";
const SUMMARY_PATH="/api/admin/caregiver-workforce-summary";
const JOB_STATUS_SMS_FLUSH_PATH="/api/admin/job-status-sms/flush";
const percent=(numerator:number,denominator:number)=>denominator>0?Math.round((numerator/denominator)*1000)/10:0;

export async function routeAdminCaregiverWorkforceSummaryV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase();
 if(url.pathname===JOB_STATUS_SMS_FLUSH_PATH&&method==="POST"){
  const actor=await getUser(request,env);
  if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
  const denied=await requireAccess(env,actor,"staff.job_ads","update");
  if(denied)return denied;
  const result=await processPendingJobApplicationStatusSmsV1(env,20);
  return json({data:result});
 }
 if(url.pathname!==SUMMARY_PATH||method!=="GET")return null;
 const actor=await getUser(request,env);
 if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,"staff.dashboard","view");
 if(denied)return denied;

 await ensureContractProgressSchema(env);
 await ensureJobApplicationLifecycleSchema(env);

 const row=await env.DB.prepare(`SELECT
   (SELECT COUNT(*) FROM caregivers c WHERE COALESCE(c.active,0)=1) AS activeCaregivers,
   (SELECT COUNT(DISTINCT ap.caregiver_id)
      FROM care_job_applications ap
      WHERE COALESCE(ap.lifecycle_status,ap.status)='TRIAL_DISPATCH'
        AND NOT EXISTS (
          SELECT 1 FROM caregiver_job_contracts jc
          WHERE jc.caregiver_id=ap.caregiver_id AND jc.status='ACTIVE'
        )
        AND NOT EXISTS (
          SELECT 1 FROM care_job_applications apc
          WHERE apc.caregiver_id=ap.caregiver_id
            AND COALESCE(apc.lifecycle_status,apc.status)='IN_CONTRACT'
        )) AS dispatchCaregivers,
   (SELECT COUNT(DISTINCT caregiverId) FROM (
      SELECT jc.caregiver_id AS caregiverId
      FROM caregiver_job_contracts jc
      WHERE jc.status='ACTIVE'
      UNION
      SELECT ap.caregiver_id AS caregiverId
      FROM care_job_applications ap
      WHERE COALESCE(ap.lifecycle_status,ap.status)='IN_CONTRACT'
   )) AS inContractCaregivers,
   (SELECT COUNT(DISTINCT ap.caregiver_id)
      FROM care_job_applications ap
      WHERE COALESCE(ap.lifecycle_status,ap.status)='PENDING_CONSULTANT'
        AND NOT EXISTS (
          SELECT 1 FROM caregiver_job_contracts jc
          WHERE jc.caregiver_id=ap.caregiver_id AND jc.status='ACTIVE'
        )
        AND NOT EXISTS (
          SELECT 1 FROM care_job_applications apc
          WHERE apc.caregiver_id=ap.caregiver_id
            AND COALESCE(apc.lifecycle_status,apc.status)='IN_CONTRACT'
        )
        AND NOT EXISTS (
          SELECT 1 FROM care_job_applications ap2
          WHERE ap2.caregiver_id=ap.caregiver_id
            AND COALESCE(ap2.lifecycle_status,ap2.status)='TRIAL_DISPATCH'
        )) AS contractApplicants,
   (SELECT COUNT(*) FROM care_job_ads a WHERE a.deleted_at IS NULL) AS totalJobAds,
   (SELECT COUNT(*) FROM care_job_ads a
      WHERE a.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM caregiver_job_contracts jc WHERE jc.ad_id=a.id AND jc.status='ACTIVE')
        AND NOT EXISTS (SELECT 1 FROM care_job_applications apc WHERE apc.ad_id=a.id AND COALESCE(apc.lifecycle_status,apc.status)='IN_CONTRACT')
        AND EXISTS (SELECT 1 FROM care_job_applications apd WHERE apd.ad_id=a.id AND COALESCE(apd.lifecycle_status,apd.status)='TRIAL_DISPATCH')) AS dispatchJobAds,
   (SELECT COUNT(*) FROM care_job_ads a
      WHERE a.deleted_at IS NULL
        AND (EXISTS (SELECT 1 FROM caregiver_job_contracts jc WHERE jc.ad_id=a.id AND jc.status='ACTIVE')
          OR EXISTS (SELECT 1 FROM care_job_applications apc WHERE apc.ad_id=a.id AND COALESCE(apc.lifecycle_status,apc.status)='IN_CONTRACT'))) AS contractJobAds,
   (SELECT COUNT(*) FROM care_job_ads a
      WHERE a.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM caregiver_job_contracts jc WHERE jc.ad_id=a.id AND jc.status='ACTIVE')
        AND NOT EXISTS (SELECT 1 FROM care_job_applications apc WHERE apc.ad_id=a.id AND COALESCE(apc.lifecycle_status,apc.status)='IN_CONTRACT')
        AND NOT EXISTS (SELECT 1 FROM care_job_applications apd WHERE apd.ad_id=a.id AND COALESCE(apd.lifecycle_status,apd.status)='TRIAL_DISPATCH')
        AND EXISTS (SELECT 1 FROM care_job_applications apr WHERE apr.ad_id=a.id AND COALESCE(apr.lifecycle_status,apr.status)='PENDING_CONSULTANT')) AS requestedOnlyJobAds,
   (SELECT COUNT(*) FROM caregiver_job_contracts) AS totalContracts,
   (SELECT COUNT(*) FROM caregiver_job_contracts WHERE status='ACTIVE') AS activeContracts`).first<any>();

 const activeCaregivers=Number(row?.activeCaregivers||0),dispatchCaregivers=Number(row?.dispatchCaregivers||0),inContractCaregivers=Number(row?.inContractCaregivers||0),contractApplicants=Number(row?.contractApplicants||0),totalJobAds=Number(row?.totalJobAds||0),dispatchJobAds=Number(row?.dispatchJobAds||0),contractJobAds=Number(row?.contractJobAds||0),requestedOnlyJobAds=Number(row?.requestedOnlyJobAds||0),totalContracts=Number(row?.totalContracts||0),activeContracts=Number(row?.activeContracts||0);
 return json({data:{
  activeCaregivers,dispatchCaregivers,inContractCaregivers,contractApplicants,totalJobAds,dispatchJobAds,contractJobAds,requestedOnlyJobAds,totalContracts,activeContracts,
  dispatchToJobAdsPercent:percent(dispatchJobAds,totalJobAds),
  inContractToContractsPercent:percent(inContractCaregivers,totalContracts),
  operationalKpi:{
   dispatch:{numerator:dispatchJobAds,denominator:totalJobAds,percent:percent(dispatchJobAds,totalJobAds),label:"پرونده در اعزام / کل آگهی‌ها"},
   contracts:{numerator:inContractCaregivers,denominator:totalContracts,percent:percent(inContractCaregivers,totalContracts),label:"مراقب در قرارداد / کل قراردادها"},
  },
  applicantStageCounts:{requested:requestedOnlyJobAds,dispatch:dispatchJobAds,contract:contractJobAds},
  definitions:{
   activeCaregivers:"caregivers.active=1",
   dispatchCaregivers:"TRIAL_DISPATCH without ACTIVE contract or any IN_CONTRACT application",
   inContractCaregivers:"ACTIVE job contract or IN_CONTRACT application",
   contractApplicants:"PENDING_CONSULTANT without IN_CONTRACT, TRIAL_DISPATCH or active contract",
   requestedOnlyJobAds:"non-deleted ads with PENDING_CONSULTANT and no higher applicant stage",
   dispatchJobAds:"non-deleted ads with TRIAL_DISPATCH and no contract stage",
   contractJobAds:"non-deleted ads with ACTIVE contract or IN_CONTRACT application",
   totalJobAds:"all non-deleted job ads",
   totalContracts:"all caregiver_job_contracts rows including history",
  },
  version:ADMIN_CAREGIVER_WORKFORCE_SUMMARY_VERSION,
 }});
}
