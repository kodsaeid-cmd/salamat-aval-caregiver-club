import {requireAccess} from "./access-control";
import {type Env,fail,getUser,json,securityHeaders,str} from "./lib";

type JsonRecord=Record<string,unknown>;
const STAFF_FINANCE_MODULE="staff.financial_credits";
const REWARD_TYPES=["REFERRAL_REGISTRATION_REWARD","REFERRAL_CONTRACT_BONUS"] as const;

function isoDate(value:unknown){const raw=str(value);return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:""}
function positiveInt(value:unknown,fallback:number){const parsed=Math.trunc(Number(value));return Number.isFinite(parsed)&&parsed>0?parsed:fallback}

async function staffRewardLedger(request:Request,env:Env){
 const actor=await getUser(request,env);if(!actor)return fail("ابتدا وارد حساب شوید.",401,"unauthorized");
 const denied=await requireAccess(env,actor,STAFF_FINANCE_MODULE,"view");if(denied)return denied;
 const url=new URL(request.url),q=str(url.searchParams.get("q")),referrerId=str(url.searchParams.get("referrerId")),from=isoDate(url.searchParams.get("from")),to=isoDate(url.searchParams.get("to"));
 const sort=String(url.searchParams.get("sort")||"desc").toLowerCase()==="asc"?"ASC":"DESC";
 const page=positiveInt(url.searchParams.get("page"),1),pageSize=Math.min(200,positiveInt(url.searchParams.get("pageSize"),50)),offset=(page-1)*pageSize;
 const conditions=["tx.direction='CREDIT'","tx.transaction_type IN ('REFERRAL_REGISTRATION_REWARD','REFERRAL_CONTRACT_BONUS')"];
 const bindings:unknown[]=[];
 if(referrerId){conditions.push("r.referrer_caregiver_id=?");bindings.push(referrerId)}
 if(from){conditions.push("date(tx.created_at)>=date(?)");bindings.push(from)}
 if(to){conditions.push("date(tx.created_at)<=date(?)");bindings.push(to)}
 if(q){conditions.push("(ref.full_name LIKE ? OR ref.membership_code LIKE ? OR ref.mobile LIKE ? OR referred.full_name LIKE ? OR referred.membership_code LIKE ? OR referred.mobile LIKE ?)");const pattern=`%${q}%`;bindings.push(pattern,pattern,pattern,pattern,pattern,pattern)}
 const where=`WHERE ${conditions.join(" AND ")}`;
 const fromSql=`FROM caregiver_wallet_transactions tx
   JOIN caregiver_referral_cases r ON r.id=tx.reference_id
   JOIN caregivers ref ON ref.id=r.referrer_caregiver_id
   JOIN caregivers referred ON referred.id=r.referred_caregiver_id`;
 const rowsSql=`SELECT tx.id AS transactionId,tx.transaction_type AS rewardType,tx.amount_toman AS amountToman,tx.created_at AS creditedAt,
   r.id AS referralCaseId,r.created_at AS registeredAt,
   ref.id AS referrerCaregiverId,ref.full_name AS referrerName,ref.membership_code AS referrerMembershipCode,ref.mobile AS referrerMobile,
   referred.id AS referredCaregiverId,referred.full_name AS referredName,referred.membership_code AS referredMembershipCode,referred.mobile AS referredMobile
   ${fromSql} ${where} ORDER BY tx.created_at ${sort},tx.id ${sort} LIMIT ? OFFSET ?`;
 const [rowsResult,summary,referrersResult]=await Promise.all([
  env.DB.prepare(rowsSql).bind(...bindings,pageSize,offset).all<JsonRecord>(),
  env.DB.prepare(`SELECT COUNT(*) AS totalRows,COALESCE(SUM(tx.amount_toman),0) AS totalAmountToman ${fromSql} ${where}`).bind(...bindings).first<JsonRecord>(),
  env.DB.prepare(`SELECT DISTINCT ref.id AS caregiverId,ref.full_name AS fullName,ref.membership_code AS membershipCode
    ${fromSql} WHERE tx.direction='CREDIT' AND tx.transaction_type IN ('REFERRAL_REGISTRATION_REWARD','REFERRAL_CONTRACT_BONUS')
    ORDER BY ref.full_name ASC LIMIT 2000`).all<JsonRecord>(),
 ]);
 const rows=(rowsResult.results||[]).map((row:any)=>({...row,amountToman:Number(row.amountToman||0),rewardTypeLabel:String(row.rewardType)==="REFERRAL_REGISTRATION_REWARD"?"پاداش ثبت‌نام":"پاداش ورود به قرارداد"}));
 const totalRows=Number(summary?.totalRows||0),totalPages=Math.max(1,Math.ceil(totalRows/pageSize));
 return json({data:{rows,summary:{totalRows,totalAmountToman:Number(summary?.totalAmountToman||0)},referrers:referrersResult.results||[],filters:{q:q||null,referrerId:referrerId||null,from:from||null,to:to||null,sort:sort.toLowerCase()},pagination:{page,pageSize,totalRows,totalPages}}});
}

export async function routeReferralRewardLedgerV1(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);if(url.pathname!=="/api/staff/financial-credits/referrals/reward-ledger"||request.method.toUpperCase()!=="GET")return null;
 return securityHeaders(await staffRewardLedger(request,env));
}
