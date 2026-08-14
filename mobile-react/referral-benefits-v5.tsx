import React,{useCallback,useEffect,useMemo,useState} from "react";

type ReferralCase={id:string;referredName?:string;referredMembershipCode?:string;referrerConfirmationStatus?:string;createdAt?:string};
type ReferralData={caregiver?:{referralCode?:string};summary?:{totalReferrals?:number};cases?:ReferralCase[]};
type RequestState={id:string;status:string}|null;
type Tier={key:string;amountToman:number;target:number;current:number;eligible:boolean;request:RequestState};
type Milestones={totals?:{registered?:number;contracted?:number};network10:Tier;contract7:Tier};

const fa=(value:number)=>new Intl.NumberFormat("fa-IR").format(Number(value||0));
const money=(value:number)=>`${fa(value)} تومان`;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

async function api(path:string,init?:RequestInit){
 const response=await fetch(path,{credentials:"include",headers:{accept:"application/json",...(init?.body?{"content-type":"application/json"}:{}),...(init?.headers||{})},...init});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload?.message||"عملیات انجام نشد.");
 return payload?.data??payload;
}

function CopyIcon(){return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-8A2.5 2.5 0 0 0 3 6.5v8A2.5 2.5 0 0 0 5.5 17H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
function UsersIcon(){return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H6.2A4.2 4.2 0 0 0 2 18.2V20M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3.5 3.5 0 0 0 0-7M22 20v-1.7a4 4 0 0 0-3-3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
function ContractIcon(){return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h8l4 4v14H7V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M15 3v5h4M10 12h6M10 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}

function CounterCard({kind,value,label}:{kind:"users"|"contract";value:number;label:string}){
 return <div className="rb5-counter"><div className="rb5-counter-icon">{kind==="users"?<UsersIcon/>:<ContractIcon/>}</div><div><strong>{fa(value)}</strong><span>{label}</span></div></div>
}

function statusText(request:RequestState){
 if(!request)return "";
 const status=String(request.status||"").toUpperCase();
 if(status==="REQUESTED")return "در انتظار تأیید مدیر سامانه";
 if(status==="UNDER_REVIEW")return "در حال بررسی مدیر سامانه";
 if(status==="COMPLETED")return "تأیید و به کیف پول واریز شد";
 if(status==="REJECTED")return "درخواست رد شده است";
 return status;
}

function LoanDonut({tier,label,condition,onRequest,busy}:{tier:Tier;label:string;condition:string;onRequest:(key:string)=>void;busy:boolean}){
 const pct=clamp(tier.target?Math.round((tier.current/tier.target)*100):0,0,100),canRequest=Boolean(tier.eligible&&!tier.request);
 return <article className="rb5-loan-card">
  <div className="rb5-donut" style={{background:`conic-gradient(#0a8754 0 ${pct}%,#e5eee9 ${pct}% 100%)`}}><div><strong>{fa(tier.current)}</strong><span>از {fa(tier.target)}</span></div></div>
  <div className="rb5-loan-copy"><h3>{label}</h3><p>{condition}</p><strong>{money(tier.amountToman)}</strong></div>
  <button type="button" className={`rb5-loan-btn ${canRequest?"ready":""}`} disabled={!canRequest||busy} onClick={()=>onRequest(tier.key)}>{busy?"در حال ارسال...":tier.request?statusText(tier.request):canRequest?"تقاضای وام":"هنوز به حد نصاب نرسیده‌اید"}</button>
 </article>
}

export function ReferralBenefitsV5(){
 const [referrals,setReferrals]=useState<ReferralData|null>(null),[milestones,setMilestones]=useState<Milestones|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[copied,setCopied]=useState(false),[busy,setBusy]=useState<string|null>(null),[success,setSuccess]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const [r,m]=await Promise.all([api("/api/caregiver/platform/referrals"),api("/api/caregiver/platform/referral-milestone-summary")]);setReferrals(r);setMilestones(m)}catch(e){setError(e instanceof Error?e.message:"دریافت اطلاعات انجام نشد.")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const pending=useMemo(()=>Array.isArray(referrals?.cases)?referrals!.cases!.filter(item=>String(item.referrerConfirmationStatus||"").toUpperCase()==="PENDING"):[],[referrals]);
 const registered=Number(milestones?.totals?.registered??referrals?.summary?.totalReferrals??0),contracted=Number(milestones?.totals?.contracted??0),code=String(referrals?.caregiver?.referralCode||"");
 const copyCode=async()=>{if(!code)return;try{await navigator.clipboard.writeText(code)}catch{const el=document.createElement("textarea");el.value=code;document.body.appendChild(el);el.select();document.execCommand("copy");el.remove()}setCopied(true);window.setTimeout(()=>setCopied(false),1600)};
 const requestLoan=async(key:string)=>{setBusy(key);setError("");try{await api("/api/caregiver/platform/referral-milestone-requests",{method:"POST",body:JSON.stringify({milestoneKey:key})});setSuccess(true);await load()}catch(e){setError(e instanceof Error?e.message:"ارسال درخواست انجام نشد.")}finally{setBusy(null)}};
 const decide=async(id:string,action:"CONFIRM"|"REJECT")=>{setBusy(id);setError("");try{await api(`/api/caregiver/platform/referrals/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({action})});await load()}catch(e){setError(e instanceof Error?e.message:"ثبت تصمیم انجام نشد.")}finally{setBusy(null)}};

 if(success)return <section className="rb5-success" dir="rtl"><style>{styles}</style><div className="rb5-success-mark">✓</div><h2>درخواست وام ثبت شد</h2><p>تقاضای شما با موفقیت برای مدیر سامانه ارسال شد و پس از تایید مدیر سامانه وام شما به کیف پول واریز خواهد شد</p><button type="button" onClick={()=>setSuccess(false)}>بازگشت به معرفی‌ها</button></section>;
 return <section className="rb5-root" dir="rtl"><style>{styles}</style>
  {loading?<div className="rb5-state">در حال دریافت اطلاعات معرفی‌ها...</div>:null}
  {error?<div className="rb5-error">{error}</div>:null}
  {!loading&&<>
   <button type="button" className="rb5-code" onClick={copyCode} disabled={!code}><span><small>کد معرفی من</small><strong>{code||"—"}</strong></span><span className="rb5-copy"><CopyIcon/><em>{copied?"کپی شد":"برای کپی لمس کنید"}</em></span></button>
   <div className="rb5-counters"><CounterCard kind="users" value={registered} label="ثبت‌نام با کد معرفی شما"/><CounterCard kind="contract" value={contracted} label="ثبت‌نام‌شده و وارد قرارداد"/></div>
   {milestones?<div className="rb5-loans"><LoanDonut tier={milestones.network10} label="وام معرفی ۱۰ مراقب" condition="با ثبت‌نام ۱۰ مراقب با کد معرفی شما" onRequest={requestLoan} busy={busy===milestones.network10.key}/><LoanDonut tier={milestones.contract7} label="وام ورود به قرارداد" condition="با ورود ۷ نفر از گروه ۱۰ نفره معرفی‌شده به قرارداد" onRequest={requestLoan} busy={busy===milestones.contract7.key}/></div>:null}
   <div className="rb5-confirm"><div className="rb5-section-head"><div><h3>تأیید ثبت‌نام با کد معرفی</h3><p>افرادی که کد شما را هنگام ثبت‌نام وارد کرده‌اند، اینجا تأیید یا رد کنید.</p></div><span>{fa(pending.length)}</span></div>
    {pending.length===0?<div className="rb5-empty">در حال حاضر موردی برای تأیید شما وجود ندارد.</div>:<div className="rb5-confirm-list">{pending.map(item=><article key={item.id}><div><strong>{item.referredName||"مراقب معرفی‌شده"}</strong><small>{item.referredMembershipCode||""}</small></div><div className="rb5-confirm-actions"><button type="button" className="yes" disabled={busy===item.id} onClick={()=>decide(item.id,"CONFIRM")}>تأیید می‌کنم</button><button type="button" className="no" disabled={busy===item.id} onClick={()=>decide(item.id,"REJECT")}>رد</button></div></article>)}</div>}
   </div>
  </>}
 </section>;
}

const styles=`
.rb5-root{font-family:inherit;display:grid;gap:16px;color:#17332a}.rb5-state,.rb5-error,.rb5-empty{padding:18px;border-radius:18px;background:#f5f8f6;text-align:center;color:#60736b}.rb5-error{background:#fff1f0;color:#a83932}.rb5-code{width:100%;border:1px solid #d8e7df;background:linear-gradient(135deg,#f3fbf7,#fff);border-radius:22px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:15px;color:#0a7048;text-align:right;cursor:pointer;box-shadow:0 8px 24px rgba(15,92,61,.08)}.rb5-code>span:first-child{display:grid;gap:3px}.rb5-code small{font-size:12px;color:#6c8178}.rb5-code strong{font-size:28px;letter-spacing:4px;direction:ltr}.rb5-copy{display:flex;align-items:center;gap:7px}.rb5-copy em{font-style:normal;font-size:11px;font-weight:800}.rb5-counters{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rb5-counter{min-height:112px;border:1px solid #e0ebe6;background:#fff;border-radius:21px;padding:16px;display:flex;align-items:center;gap:13px;box-shadow:0 6px 20px rgba(29,72,54,.05)}.rb5-counter-icon{width:48px;height:48px;border-radius:16px;background:#edf8f2;color:#087a4d;display:grid;place-items:center;flex:none}.rb5-counter div:last-child{display:grid;gap:4px}.rb5-counter strong{font-size:25px;color:#0b6f48}.rb5-counter span{font-size:11px;line-height:1.8;color:#667b72}.rb5-loans{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rb5-loan-card{border:1px solid #dce9e3;background:#fff;border-radius:24px;padding:18px 14px;display:grid;justify-items:center;gap:12px;box-shadow:0 8px 24px rgba(31,79,59,.06)}.rb5-donut{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;position:relative}.rb5-donut:after{content:"";position:absolute;inset:14px;background:white;border-radius:50%}.rb5-donut>div{position:relative;z-index:1;display:grid;text-align:center}.rb5-donut strong{font-size:27px;color:#087a4d}.rb5-donut span{font-size:12px;color:#73837c}.rb5-loan-copy{text-align:center;display:grid;gap:4px}.rb5-loan-copy h3{font-size:14px;margin:0}.rb5-loan-copy p{font-size:10px;line-height:1.8;color:#6f8078;margin:0;min-height:36px}.rb5-loan-copy>strong{font-size:13px;color:#1d5942}.rb5-loan-btn{width:100%;min-height:44px;border:0;border-radius:14px;background:#e7ece9;color:#819089;font-family:inherit;font-weight:900;font-size:11px;padding:9px;cursor:not-allowed}.rb5-loan-btn.ready{background:#0a8754;color:#fff;cursor:pointer;box-shadow:0 7px 16px rgba(10,135,84,.2)}.rb5-confirm{margin-top:3px;border-top:1px solid #e3ece8;padding-top:18px;display:grid;gap:12px}.rb5-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.rb5-section-head h3{font-size:15px;margin:0 0 4px}.rb5-section-head p{font-size:10.5px;color:#71827a;margin:0;line-height:1.8}.rb5-section-head>span{min-width:35px;height:35px;border-radius:12px;background:#edf8f2;color:#087a4d;display:grid;place-items:center;font-weight:900}.rb5-confirm-list{display:grid;gap:9px}.rb5-confirm-list article{border:1px solid #e1eae6;border-radius:17px;padding:13px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff}.rb5-confirm-list article>div:first-child{display:grid;gap:2px}.rb5-confirm-list strong{font-size:12.5px}.rb5-confirm-list small{font-size:10px;color:#839189}.rb5-confirm-actions{display:flex;gap:7px}.rb5-confirm-actions button{border:0;border-radius:11px;padding:9px 11px;font-family:inherit;font-size:10px;font-weight:900;cursor:pointer}.rb5-confirm-actions .yes{background:#e8f7ef;color:#087a4d}.rb5-confirm-actions .no{background:#fff0ef;color:#ac443d}.rb5-success{font-family:inherit;min-height:390px;border:1px solid #daebe2;border-radius:25px;background:linear-gradient(180deg,#f2fbf6,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:34px 24px;color:#17382b}.rb5-success-mark{width:72px;height:72px;border-radius:50%;background:#0a8754;color:#fff;display:grid;place-items:center;font-size:35px;font-weight:900;margin-bottom:17px}.rb5-success h2{font-size:20px;margin:0 0 12px}.rb5-success p{max-width:480px;font-size:13px;line-height:2.1;color:#526d61;margin:0 0 22px}.rb5-success button{border:0;border-radius:14px;background:#0a8754;color:#fff;padding:12px 24px;font-family:inherit;font-weight:900;cursor:pointer}@media(max-width:520px){.rb5-code{padding:16px}.rb5-code strong{font-size:24px}.rb5-copy em{display:none}.rb5-counters,.rb5-loans{grid-template-columns:1fr 1fr}.rb5-counter{padding:12px;min-height:105px;display:grid;justify-items:start}.rb5-counter-icon{width:42px;height:42px}.rb5-counter strong{font-size:22px}.rb5-donut{width:112px;height:112px}.rb5-donut:after{inset:12px}.rb5-loan-card{padding:14px 9px}.rb5-loan-copy h3{font-size:12px}.rb5-confirm-list article{align-items:flex-start;flex-direction:column}.rb5-confirm-actions{width:100%}.rb5-confirm-actions button{flex:1}}
`;
