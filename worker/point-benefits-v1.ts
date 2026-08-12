import {type Env,getUser} from "./lib";
import {contractProgressPointsSummary} from "./contract-progress-engine-v1";

export const MIN_LOAN_EVALUATION_SCORE=60;
export const LOAN_TIER_RULES=[
 {key:"POINT_LOAN_200",title:"وام ۱۰ میلیون تومانی",amountToman:10_000_000,targetPoints:200},
 {key:"POINT_LOAN_400",title:"وام ۲۵ میلیون تومانی",amountToman:25_000_000,targetPoints:400},
 {key:"POINT_LOAN_600",title:"وام ۵۰ میلیون تومانی",amountToman:50_000_000,targetPoints:600},
 {key:"POINT_LOAN_800",title:"وام ۷۰ میلیون تومانی",amountToman:70_000_000,targetPoints:800},
] as const;
export type LoanTierKey=(typeof LOAN_TIER_RULES)[number]["key"];

function round1(value:number){return Math.round(value*10)/10}
function pct(value:number){return Math.max(0,Math.min(100,round1(value)))}

async function latestIndicatorAverage(env:Env,caregiverId:string){
 try{
  const row=await env.DB.prepare(`SELECT final_score AS finalScore,finalized_at AS finalizedAt,
   (SELECT COUNT(*) FROM caregiver_evaluation_periods x WHERE x.caregiver_id=? AND x.status='FINAL' AND x.final_score IS NOT NULL) AS finalizedPeriods
   FROM caregiver_evaluation_periods
   WHERE caregiver_id=? AND status='FINAL' AND final_score IS NOT NULL
   ORDER BY COALESCE(finalized_at,updated_at,created_at) DESC LIMIT 1`).bind(caregiverId,caregiverId).first<{finalScore:number;finalizedAt:string|null;finalizedPeriods:number}>();
  const score=row?.finalScore==null?null:Number(row.finalScore);
  return {averageScore:Number.isFinite(score as number)?round1(score as number):null,finalizedAt:row?.finalizedAt||null,finalizedPeriods:Number(row?.finalizedPeriods||0)};
 }catch{return {averageScore:null,finalizedAt:null,finalizedPeriods:0}}
}

function loanTier(totalPoints:number,evaluationAverageScore:number|null,rule:(typeof LOAN_TIER_RULES)[number]){
 const pointsPassed=totalPoints>=rule.targetPoints;
 const evaluationPassed=evaluationAverageScore!==null&&evaluationAverageScore>=MIN_LOAN_EVALUATION_SCORE;
 const eligible=pointsPassed&&evaluationPassed;
 const pointsProgress=pct(totalPoints/rule.targetPoints*100);
 const evaluationProgress=evaluationAverageScore===null?0:pct(evaluationAverageScore/MIN_LOAN_EVALUATION_SCORE*100);
 const progressPercent=Math.min(pointsProgress,evaluationProgress);
 const status=eligible?"ELIGIBLE":!pointsPassed?"IN_PROGRESS":evaluationAverageScore===null?"WAITING_EVALUATION":"SCORE_BELOW_THRESHOLD";
 return {...rule,type:"LOAN",eligible,status,progressPercent,pointsProgress,evaluationProgress,currentPoints:totalPoints,remainingPoints:Math.max(0,rule.targetPoints-totalPoints),serviceMode:"POINTS_AND_EVALUATION",scoreMode:"INDICATOR_AVERAGE",scoreThreshold:MIN_LOAN_EVALUATION_SCORE,targetMonths:0,targetDays:rule.targetPoints,serviceDays:totalPoints,serviceDuration:{months:0,days:totalPoints},remainingDays:Math.max(0,rule.targetPoints-totalPoints),projectedEligibilityDate:null,evaluation:{count:evaluationAverageScore===null?0:1,averageScore:evaluationAverageScore,minimumScore:evaluationAverageScore,latestScore:evaluationAverageScore,metric:evaluationAverageScore,metricMode:"INDICATOR_AVERAGE",threshold:MIN_LOAN_EVALUATION_SCORE,comparison:"GTE",passed:evaluationPassed,windowStart:null,windowEnd:null},requirements:{points:{current:totalPoints,target:rule.targetPoints,passed:pointsPassed},evaluation:{current:evaluationAverageScore,target:MIN_LOAN_EVALUATION_SCORE,passed:evaluationPassed}}}
}

export async function caregiverLoanPolicy(env:Env,caregiverId:string){
 const [points,evaluation]=await Promise.all([contractProgressPointsSummary(env,caregiverId),latestIndicatorAverage(env,caregiverId)]);
 const tiers=LOAN_TIER_RULES.map(rule=>loanTier(Number(points.totalPoints||0),evaluation.averageScore,rule));
 const eligibleTiers=tiers.filter(tier=>tier.eligible).sort((a,b)=>b.amountToman-a.amountToman);
 const nextTier=tiers.find(tier=>!tier.eligible)||null;
 return {version:"4.0.0",eligibilityModel:"EARNED_CONTRACT_POINTS_AND_INDICATOR_AVERAGE",minimumEvaluationScore:MIN_LOAN_EVALUATION_SCORE,totalPoints:Number(points.totalPoints||0),points,evaluation,tiers,highestEligibleTier:eligibleTiers[0]||null,nextTier};
}

export async function applyPointBenefitsToFinancialPayload(env:Env,payload:any,caregiverId:string){
 const policy=await caregiverLoanPolicy(env,caregiverId),data=payload?.data;
 if(!data||typeof data!=="object")return payload;
 data.allowance=null;
 data.loans=policy.tiers;
 data.contractPoints=policy.points;
 data.loanPolicy=policy;
 data.evaluation={...(data.evaluation||{}),loanAverageScore:policy.evaluation.averageScore,loanEvaluationThreshold:MIN_LOAN_EVALUATION_SCORE,loanEvaluationPassed:policy.evaluation.averageScore!==null&&policy.evaluation.averageScore>=MIN_LOAN_EVALUATION_SCORE,loanEvaluationFinalizedAt:policy.evaluation.finalizedAt};
 data.benefitRules={...(data.benefitRules||{}),eligibilityModel:policy.eligibilityModel,minimumEvaluationScore:MIN_LOAN_EVALUATION_SCORE,loanThresholds:LOAN_TIER_RULES.map(x=>({key:x.key,targetPoints:x.targetPoints,amountToman:x.amountToman,title:x.title})),referralLoan:null,retiredRules:["REFERRAL_LOAN_10","ASSISTANCE_2M","LOAN_3M","LOAN_6M","LOAN_12M","LOAN_24M","LOAN_70M_CUMULATIVE"]};
 const highest=policy.highestEligibleTier,next=policy.nextTier;
 data.service={...(data.service||{}),credit:{eligibilityModel:policy.eligibilityModel,eligible:Boolean(highest),status:highest?"ELIGIBLE":next?.status||"IN_PROGRESS",amountToman:highest?.amountToman||0,currentPoints:policy.totalPoints,nextThreshold:next?.targetPoints||800,remainingToNext:next?Math.max(0,next.targetPoints-policy.totalPoints):0,maxThreshold:800,progressPercent:next?next.progressPercent:100,evaluationAverageScore:policy.evaluation.averageScore,evaluationThreshold:MIN_LOAN_EVALUATION_SCORE,evaluationPassed:policy.evaluation.averageScore!==null&&policy.evaluation.averageScore>=MIN_LOAN_EVALUATION_SCORE,selectedTier:highest?.key||null}};
 const referrals=data.referrals&&typeof data.referrals==="object"?data.referrals:null;
 if(referrals?.summary&&typeof referrals.summary==="object")Object.assign(referrals.summary,{loanEligible:false,loanEligibilityAmountToman:0,remainingToLoan:null});
 data.dataUnity={...(data.dataUnity||{}),benefitsSource:"earned_contract_points+caregiver_evaluation_periods",contractPointsSource:"caregiver_contract_point_ledger+caregiver_contract_point_daily_ledger",loanEvaluationSource:"caregiver_evaluation_periods:latest_FINAL.final_score",pointsPolicyVersion:"4.0.0",contractPointsAccrual:"completed_service_days"};
 return payload;
}

export async function rewriteFinancialResponseWithPoints(request:Request,env:Env,response:Response){
 if(!response.ok)return response;
 const url=new URL(request.url);let caregiverId="";
 if(url.pathname==="/api/caregiver/platform/financial-profile"||url.pathname==="/api/benefits/summary"){
  const actor=await getUser(request,env);caregiverId=actor?.role?.toUpperCase()==="CAREGIVER"?String(actor.caregiverId||""):String(url.searchParams.get("caregiverId")||"");
 }else{
  const match=url.pathname.match(/^\/api\/staff\/financial-credits\/caregivers\/([^/]+)\/profile$/);if(match)caregiverId=decodeURIComponent(match[1]);
 }
 if(!caregiverId)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload)return response;
 await applyPointBenefitsToFinancialPayload(env,payload,caregiverId);
 const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store");headers.set("x-salamat-loan-policy","4.0.0");
 return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}
