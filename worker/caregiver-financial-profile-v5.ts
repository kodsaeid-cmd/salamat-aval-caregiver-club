import {routeCaregiverFinancialProfileV4} from "./caregiver-financial-profile-v4";
import {type Env,json,securityHeaders} from "./lib";

type Payload=Record<string,any>;

async function correctedSummary(env:Env,caregiverId:string,existing:Record<string,any>){
 const totals=await env.DB.prepare(`SELECT
   COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_toman ELSE 0 END),0) AS creditToman,
   COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount_toman ELSE 0 END),0) AS debitToman
   FROM caregiver_wallet_transactions WHERE caregiver_id=?`).bind(caregiverId).first<{creditToman:number;debitToman:number}>();
 const pending=await env.DB.prepare(`SELECT COALESCE(SUM(s.amount_toman),0) AS pendingToman,
   COALESCE(SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM caregiver_wallet_transactions w WHERE w.reference_type='SETTLEMENT_REQUEST' AND w.reference_id=s.id AND w.direction='DEBIT') THEN s.amount_toman ELSE 0 END),0) AS unheldPendingToman
   FROM caregiver_settlement_requests s WHERE s.caregiver_id=? AND s.status IN ('REQUESTED','APPROVED')`).bind(caregiverId).first<{pendingToman:number;unheldPendingToman:number}>();
 const creditToman=Number(totals?.creditToman||0),debitToman=Number(totals?.debitToman||0),balanceToman=creditToman-debitToman,pendingSettlementToman=Number(pending?.pendingToman||0),unheldPendingToman=Number(pending?.unheldPendingToman||0);
 return {...existing,creditToman,debitToman,receivableToman:creditToman,payableToman:debitToman,netToman:balanceToman,balanceToman,pendingSettlementToman,availableToman:Math.max(0,balanceToman-unheldPendingToman)};
}

export async function routeCaregiverFinancialProfileV5(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),method=request.method.toUpperCase(),isOwn=url.pathname==="/api/caregiver/platform/financial-profile",isStaff=/^\/api\/staff\/financial-credits\/caregivers\/[^/]+\/profile$/.test(url.pathname);
 if(method!=="GET"||(!isOwn&&!isStaff))return null;
 const response=await routeCaregiverFinancialProfileV4(request,env);if(!response)return null;
 const payload=await response.clone().json().catch(()=>({})) as Payload;if(!response.ok||!payload?.data?.caregiver?.id)return response;
 const caregiverId=String(payload.data.caregiver.id),wallet=payload.data.wallet||{};wallet.summary=await correctedSummary(env,caregiverId,wallet.summary||{});payload.data.wallet=wallet;payload.data.version="5.0.0";payload.data.dataUnity={...(payload.data.dataUnity||{}),walletSettlementMode:"IMMEDIATE_DEBIT_WITH_COMPENSATING_RELEASE",profileVersion:"5.0.0"};
 return securityHeaders(json(payload,response.status));
}
