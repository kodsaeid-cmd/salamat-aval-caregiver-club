import {type AuthUser,type Env,json} from "./lib";

const fa=(value:number)=>new Intl.NumberFormat("fa-IR").format(Number(value||0));

export async function decorateReferralContractNotificationsV1(env:Env,actor:AuthUser,response:Response){
 if(!response.ok||String(actor.role||"").toUpperCase()!=="CAREGIVER"||!actor.caregiverId)return response;
 const payload:any=await response.clone().json().catch(()=>null);if(!payload?.data?.items)return response;
 const rows=await env.DB.prepare(`SELECT r.id,c.full_name AS referredName,r.contract_reward_transaction_id AS transactionId,w.amount_toman AS amountToman,w.created_at AS eventAt
  FROM caregiver_referral_cases r JOIN caregivers c ON c.id=r.referred_caregiver_id
  JOIN caregiver_wallet_transactions w ON w.id=r.contract_reward_transaction_id
  WHERE r.referrer_caregiver_id=? AND r.contract_reward_transaction_id IS NOT NULL
  ORDER BY w.created_at DESC LIMIT 60`).bind(actor.caregiverId).all<any>().catch(()=>({results:[]} as any));
 const read=await env.DB.prepare("SELECT last_seen_at AS lastSeenAt FROM caregiver_module_reads WHERE caregiver_id=? AND module_key='benefits' LIMIT 1").bind(actor.caregiverId).first<any>().catch(()=>null),lastSeenAt=String(read?.lastSeenAt||"2026-08-09T18:40:00.000Z");
 const txIds=new Set((rows.results||[]).map((x:any)=>String(x.transactionId||"")).filter(Boolean));
 const base=(payload.data.items as any[]).filter(item=>!txIds.has(String(item.id||"").replace(/^wallet:/,"")));
 const referral=(rows.results||[]).map((x:any)=>({
  id:`referral-contract:${x.id}:${x.transactionId}`,
  moduleKey:"benefits",kind:"REFERRAL_CONTRACT_REWARD",title:"پاداش معرفی به کیف پول شما واریز شد",
  body:`مراقب ${String(x.referredName||"معرفی‌شده")} که با کد شما ثبت‌نام کرده بود وارد قرارداد شد و ${fa(Number(x.amountToman||300000))} تومان پاداش به کیف پول شما اضافه شد.`,
  createdAt:x.eventAt,route:"benefits",amountToman:Number(x.amountToman||300000),status:"PAID",unread:String(x.eventAt||"")>lastSeenAt,
 }));
 const merged=[...base,...referral].filter(x=>x.createdAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,120);
 const unreadByModule:Record<string,number>={};for(const item of merged)if(item.unread)unreadByModule[item.moduleKey]=(unreadByModule[item.moduleKey]||0)+1;
 payload.data.items=merged;payload.data.unreadByModule=unreadByModule;payload.data.unreadTotal=Object.values(unreadByModule).reduce((a,b)=>a+b,0);
 return json(payload,response.status);
}
