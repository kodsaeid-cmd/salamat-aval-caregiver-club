import {requireAccess} from "./access-control";
import {ensureCaregiverPlatformSchema} from "./caregiver-platform-v1";
import {ensureRetentionRewardsSchema} from "./retention-rewards-v1";
import {type AuthUser,type Env,fail,getUser,json,securityHeaders,str} from "./lib";

const MODULE="staff.financial_credits";
const SORTS=new Set(["date_desc","date_asc","amount_desc","amount_asc"]);
const isoDate=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(str(value))?str(value):"";
const positiveInt=(value:unknown,fallback:number,max:number)=>{const parsed=Math.trunc(Number(value));return Number.isFinite(parsed)&&parsed>0?Math.min(parsed,max):fallback};

async function tableExists(env:Env,name:string){
 const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(name).first<{name:string}>();
 return Boolean(row?.name);
}

function settlementSql(){return `SELECT
 'SETTLEMENT' AS source,s.id,c.id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,
 'WALLET_WITHDRAWAL' AS requestType,'برداشت از کیف پول' AS typeLabel,CAST(s.amount_toman AS INTEGER) AS amountToman,
 s.created_at AS requestedAt,upper(s.status) AS sourceStatus,
 CASE WHEN upper(s.status)='REQUESTED' THEN 'WAITING' WHEN upper(s.status) IN ('REJECTED','CANCELLED') THEN 'REJECTED' ELSE 'APPROVED' END AS status,
 CASE WHEN upper(s.status)='REQUESTED' THEN 1 ELSE 0 END AS canApprove,
 CASE WHEN upper(s.status)='REQUESTED' THEN 1 ELSE 0 END AS canReject,
 CASE WHEN upper(s.status)='PAID' THEN 'پرداخت نهایی ثبت شده' WHEN upper(s.status)='APPROVED' THEN 'تأیید شده؛ در انتظار ثبت پرداخت نهایی' ELSE COALESCE(s.decision_note,'') END AS detail
 FROM caregiver_settlement_requests s JOIN caregivers c ON c.id=s.caregiver_id`}

function creditSql(){return `SELECT
 'CREDIT_REQUEST' AS source,r.id,c.id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,
 'LOAN_DEPOSIT' AS requestType,'واریز وام به کیف پول' AS typeLabel,CAST(r.requested_amount_toman AS INTEGER) AS amountToman,
 r.created_at AS requestedAt,upper(r.status) AS sourceStatus,
 CASE WHEN upper(r.status) IN ('REQUESTED','UNDER_REVIEW') THEN 'WAITING' WHEN upper(r.status) IN ('REJECTED','CANCELLED') THEN 'REJECTED' ELSE 'APPROVED' END AS status,
 CASE WHEN upper(r.status) IN ('REQUESTED','UNDER_REVIEW') THEN 1 ELSE 0 END AS canApprove,
 CASE WHEN upper(r.status) IN ('REQUESTED','UNDER_REVIEW') THEN 1 ELSE 0 END AS canReject,
 CASE WHEN r.eligibility_path IS NOT NULL AND r.eligibility_path<>'' THEN 'وام پله‌ای • '||r.eligibility_path ELSE COALESCE(r.decision_note,'') END AS detail
 FROM caregiver_credit_requests r JOIN caregivers c ON c.id=r.caregiver_id`}

function referralLoanSql(){return `SELECT
 'REFERRAL_LOAN' AS source,r.id,c.id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,
 'LOAN_DEPOSIT' AS requestType,'واریز وام به کیف پول' AS typeLabel,
 CAST(CASE r.milestone_key WHEN 'NETWORK_10' THEN 3000000 WHEN 'CONTRACT_7' THEN 8000000 ELSE 0 END AS INTEGER) AS amountToman,
 r.requested_at AS requestedAt,upper(r.status) AS sourceStatus,
 CASE WHEN upper(r.status) IN ('REQUESTED','UNDER_REVIEW') THEN 'WAITING' WHEN upper(r.status)='REJECTED' THEN 'REJECTED' ELSE 'APPROVED' END AS status,
 CASE WHEN upper(r.status) IN ('REQUESTED','UNDER_REVIEW') THEN 1 ELSE 0 END AS canApprove,
 CASE WHEN upper(r.status) IN ('REQUESTED','UNDER_REVIEW') THEN 1 ELSE 0 END AS canReject,
 CASE r.milestone_key WHEN 'NETWORK_10' THEN 'وام معرفی ۳ میلیون تومانی • دوره '||r.cycle_number WHEN 'CONTRACT_7' THEN 'وام معرفی ۸ میلیون تومانی • دوره '||r.cycle_number ELSE COALESCE(r.decision_note,'') END AS detail
 FROM caregiver_referral_recurring_loan_requests r JOIN caregivers c ON c.id=r.caregiver_id`}

function retentionSql(){return `SELECT
 'RETENTION_REWARD' AS source,r.id,c.id AS caregiverId,c.full_name AS caregiverName,c.membership_code AS membershipCode,c.mobile,
 'AUTO_REWARD_DEPOSIT' AS requestType,'درخواست اتوماتیک واریز پاداش‌ها به کیف پول' AS typeLabel,CAST(r.reward_toman AS INTEGER) AS amountToman,
 r.created_at AS requestedAt,upper(r.status) AS sourceStatus,
 CASE WHEN upper(r.status) IN ('WAITING_FRANCHISE','PENDING_APPROVAL') THEN 'WAITING' WHEN upper(r.status)='REJECTED' THEN 'REJECTED' ELSE 'APPROVED' END AS status,
 CASE WHEN upper(r.status)='PENDING_APPROVAL' THEN 1 ELSE 0 END AS canApprove,
 CASE WHEN upper(r.status) IN ('WAITING_FRANCHISE','PENDING_APPROVAL') THEN 1 ELSE 0 END AS canReject,
 CASE WHEN upper(r.status)='WAITING_FRANCHISE' THEN 'در انتظار ثبت فرانشیز قرارداد مبنا' WHEN r.reward_type='FIRST_CONTRACT_RETENTION' THEN 'پاداش ماندگاری قرارداد اول' WHEN r.reward_type='CONTRACT_CONTINUITY' THEN 'پاداش تداوم همکاری • قرارداد '||r.target_contract_sequence ELSE COALESCE(r.decision_note,'') END AS detail
 FROM caregiver_retention_rewards r JOIN caregivers c ON c.id=r.caregiver_id`}

async function unifiedSql(env:Env){
 await ensureCaregiverPlatformSchema(env);
 await ensureRetentionRewardsSchema(env);
 const [settlements,credits,referralLoans,retention]=await Promise.all([
  tableExists(env,"caregiver_settlement_requests"),tableExists(env,"caregiver_credit_requests"),tableExists(env,"caregiver_referral_recurring_loan_requests"),tableExists(env,"caregiver_retention_rewards"),
 ]);
 const parts:string[]=[];
 if(settlements)parts.push(settlementSql());
 if(credits)parts.push(creditSql());
 if(referralLoans)parts.push(referralLoanSql());
 if(retention)parts.push(retentionSql());
 return parts;
}

async function listPaymentRequests(request:Request,env:Env,actor:AuthUser){
 const denied=await requireAccess(env,actor,MODULE,"view");if(denied)return denied;
 const url=new URL(request.url),q=str(url.searchParams.get("q")).trim(),from=isoDate(url.searchParams.get("from")),to=isoDate(url.searchParams.get("to"));
 const sort=SORTS.has(str(url.searchParams.get("sort")))?str(url.searchParams.get("sort")):"date_desc";
 const page=positiveInt(url.searchParams.get("page"),1,100000),pageSize=positiveInt(url.searchParams.get("pageSize"),50,500),offset=(page-1)*pageSize;
 const parts=await unifiedSql(env);
 if(!parts.length)return json({data:{rows:[],summary:{total:0,waiting:0,approved:0,rejected:0,totalAmountToman:0},pagination:{page,pageSize,total:0,totalPages:1},sort}});
 const base=`${parts.join(" UNION ALL ")}`,clauses:string[]=[],bindings:unknown[]=[];
 if(q){const like=`%${q}%`;clauses.push("(p.caregiverName LIKE ? OR p.membershipCode LIKE ? OR p.mobile LIKE ?)");bindings.push(like,like,like)}
 if(from){clauses.push("substr(p.requestedAt,1,10)>=?");bindings.push(from)}
 if(to){clauses.push("substr(p.requestedAt,1,10)<=?");bindings.push(to)}
 const where=clauses.length?`WHERE ${clauses.join(" AND ")}`:"";
 const order=sort==="date_asc"?"p.requestedAt ASC,p.id ASC":sort==="amount_desc"?"p.amountToman DESC,p.requestedAt DESC,p.id DESC":sort==="amount_asc"?"p.amountToman ASC,p.requestedAt DESC,p.id DESC":"p.requestedAt DESC,p.id DESC";
 const [summaryResult,rowsResult]=await Promise.all([
  env.DB.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN p.status='WAITING' THEN 1 ELSE 0 END),0) AS waiting,COALESCE(SUM(CASE WHEN p.status='APPROVED' THEN 1 ELSE 0 END),0) AS approved,COALESCE(SUM(CASE WHEN p.status='REJECTED' THEN 1 ELSE 0 END),0) AS rejected,COALESCE(SUM(p.amountToman),0) AS totalAmountToman FROM (${base}) p ${where}`).bind(...bindings).first<any>(),
  env.DB.prepare(`SELECT * FROM (${base}) p ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...bindings,pageSize,offset).all<any>(),
 ]);
 const total=Number(summaryResult?.total||0),rows=(rowsResult.results||[]).map(row=>({...row,amountToman:Number(row.amountToman||0),canApprove:Boolean(Number(row.canApprove||0)),canReject:Boolean(Number(row.canReject||0))}));
 const summary={total,waiting:Number(summaryResult?.waiting||0),approved:Number(summaryResult?.approved||0),rejected:Number(summaryResult?.rejected||0),totalAmountToman:Number(summaryResult?.totalAmountToman||0)};
 return json({data:{rows,summary,pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))},sort,filters:{q,from,to}}});
}

export async function routeStaffPaymentRequestsV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname!=="/api/staff/financial-credits/payment-requests"||request.method.toUpperCase()!=="GET")return null;
 const actor=await getUser(request,env);if(!actor)return securityHeaders(fail("ابتدا وارد حساب شوید.",401,"unauthorized"));
 return securityHeaders(await listPaymentRequests(request,env,actor));
}
