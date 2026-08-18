import {requireAccess} from "./access-control";
import {ensureContractProgressSchema} from "./contract-progress-engine-v1";
import {ensureJobApplicationLifecycleSchema} from "./job-application-lifecycle-v1";
import {type Env,fail,getUser,json} from "./lib";

export const ADMIN_CAREGIVER_WORKFORCE_SUMMARY_VERSION="1.0.0";
const SUMMARY_PATH="/api/admin/caregiver-workforce-summary";

export async function routeAdminCaregiverWorkforceSummaryV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname!==SUMMARY_PATH||request.method.toUpperCase()!=="GET")return null;
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
          SELECT 1 FROM care_job_applications ap2
          WHERE ap2.caregiver_id=ap.caregiver_id
            AND COALESCE(ap2.lifecycle_status,ap2.status)='TRIAL_DISPATCH'
        )) AS contractApplicants`).first<any>();

 return json({data:{
  activeCaregivers:Number(row?.activeCaregivers||0),
  dispatchCaregivers:Number(row?.dispatchCaregivers||0),
  inContractCaregivers:Number(row?.inContractCaregivers||0),
  contractApplicants:Number(row?.contractApplicants||0),
  definitions:{
   activeCaregivers:"caregivers.active=1",
   dispatchCaregivers:"TRIAL_DISPATCH without active contract",
   inContractCaregivers:"ACTIVE job contract or IN_CONTRACT application",
   contractApplicants:"PENDING_CONSULTANT without dispatch or active contract",
  },
  version:ADMIN_CAREGIVER_WORKFORCE_SUMMARY_VERSION,
 }});
}
