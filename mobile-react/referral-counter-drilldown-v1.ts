type ReferralCase={id:string;referredCaregiverId?:string;referredName?:string;referredMembershipCode?:string;contractRewardTransactionId?:string|null};
type ReferralPayload={cases?:ReferralCase[];summary?:{totalReferrals?:number}};
type MilestonePayload={totals?:{registered?:number;contracted?:number};network10?:{target?:number;current?:number;submittedCycles?:number};contract7?:{target?:number;current?:number;submittedCycles?:number;contractedCaregiverIds?:string[]}};

const ROOT=".rb6-root";
const STYLE_ID="salamat-referral-counter-drilldown-v1-style";
const MODAL_ID="salamat-referral-counter-drilldown-v1";
const fa=(value:number)=>new Intl.NumberFormat("fa-IR").format(Number(value||0));

async function readJson(path:string){const response=await fetch(path,{credentials:"include",cache:"no-store",headers:{accept:"application/json","cache-control":"no-cache"}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.message||"دریافت اطلاعات انجام نشد.");return payload?.data??payload}
async function load(){const [referrals,milestones]=await Promise.all([readJson("/api/caregiver/platform/referrals"),readJson("/api/caregiver/platform/referral-milestone-summary")]);return {referrals:referrals as ReferralPayload,milestones:milestones as MilestonePayload}}

function installStyle(){if(document.getElementById(STYLE_ID))return;const style=document.createElement("style");style.id=STYLE_ID;style.textContent=`
${ROOT} .rb6-counter{cursor:pointer;user-select:none;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
${ROOT} .rb6-counter:hover,${ROOT} .rb6-counter:focus{outline:none;transform:translateY(-1px);border-color:#b9d9c8;box-shadow:0 10px 26px rgba(20,92,60,.1)}
#${MODAL_ID}{position:fixed;inset:0;z-index:999999;background:rgba(13,39,29,.44);display:flex;align-items:flex-end;justify-content:center;padding:14px;font-family:inherit;direction:rtl}
#${MODAL_ID} .rcd-sheet{width:min(100%,520px);max-height:min(78vh,720px);overflow:auto;background:#fff;border-radius:26px 26px 18px 18px;box-shadow:0 -16px 50px rgba(11,52,35,.2);padding:18px}
#${MODAL_ID} .rcd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:-18px;background:#fff;padding:18px 0 12px;z-index:2}
#${MODAL_ID} .rcd-head h3{margin:0;font-size:16px;color:#174536}#${MODAL_ID} .rcd-head small{display:block;margin-top:4px;color:#718279;font-size:11px}
#${MODAL_ID} .rcd-close{width:38px;height:38px;border:0;border-radius:12px;background:#f0f5f2;color:#244b3d;font-size:22px;line-height:1;cursor:pointer}
#${MODAL_ID} .rcd-list{display:grid;gap:9px}#${MODAL_ID} .rcd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e2ece7;border-radius:16px;padding:12px 13px;background:#fbfdfc}
#${MODAL_ID} .rcd-row strong{font-size:13px;color:#183f32}#${MODAL_ID} .rcd-row small{display:block;margin-top:3px;color:#7a8a83;font-size:10px;direction:ltr;text-align:right}#${MODAL_ID} .rcd-badge{font-size:10px;font-weight:900;color:#087a4d;background:#eaf7f0;border-radius:999px;padding:6px 9px;white-space:nowrap}
#${MODAL_ID} .rcd-empty{padding:26px 12px;text-align:center;color:#6f8078;background:#f6f9f7;border-radius:16px}
`;document.head.appendChild(style)}

function uniqueCases(cases:ReferralCase[]){const map=new Map<string,ReferralCase>();for(const item of cases||[]){const key=String(item.referredCaregiverId||item.id||"");if(key&&!map.has(key))map.set(key,item)}return [...map.values()]}
function closeModal(){document.getElementById(MODAL_ID)?.remove()}
async function openModal(kind:"registered"|"contracted"){
 closeModal();installStyle();
 const host=document.createElement("div");host.id=MODAL_ID;host.innerHTML=`<section class="rcd-sheet" role="dialog" aria-modal="true"><div class="rcd-head"><div><h3>${kind==="registered"?"مراقبین ثبت‌نام‌شده با کد معرفی شما":"مراقبین معرفی‌شده واردشده به قرارداد"}</h3><small>در حال دریافت فهرست...</small></div><button class="rcd-close" type="button" aria-label="بستن">×</button></div><div class="rcd-list"><div class="rcd-empty">در حال دریافت اطلاعات...</div></div></section>`;document.body.appendChild(host);
 host.addEventListener("click",event=>{if(event.target===host||(event.target as Element).closest?.(".rcd-close"))closeModal()});
 try{
  const {referrals,milestones}=await load(),all=uniqueCases(referrals.cases||[]),contractedIds=new Set((milestones.contract7?.contractedCaregiverIds||[]).map(String));
  const list=kind==="registered"?all:all.filter(x=>contractedIds.has(String(x.referredCaregiverId||""))||Boolean(x.contractRewardTransactionId));
  const head=host.querySelector(".rcd-head small");if(head)head.textContent=`${fa(list.length)} نفر`;
  const box=host.querySelector(".rcd-list");if(box)box.innerHTML=list.length?list.map(x=>`<article class="rcd-row"><div><strong>${escapeHtml(x.referredName||"مراقب معرفی‌شده")}</strong><small>${escapeHtml(x.referredMembershipCode||x.referredCaregiverId||"")}</small></div><span class="rcd-badge">${kind==="contracted"?"وارد قرارداد شده":"ثبت‌نام شده"}</span></article>`).join(""):`<div class="rcd-empty">موردی برای نمایش وجود ندارد.</div>`;
 }catch(error){const box=host.querySelector(".rcd-list");if(box)box.innerHTML=`<div class="rcd-empty">${escapeHtml(error instanceof Error?error.message:"دریافت اطلاعات انجام نشد.")}</div>`}
}
function escapeHtml(value:string){return String(value||"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]||ch))}

let refreshBusy=false;
async function syncVisible(){if(refreshBusy||!document.querySelector(ROOT))return;refreshBusy=true;try{
 const {referrals,milestones}=await load(),registered=Number(milestones.totals?.registered??referrals.summary?.totalReferrals??0),contracted=Number(milestones.totals?.contracted??0);
 const counters=[...document.querySelectorAll<HTMLElement>(`${ROOT} .rb6-counters .rb6-counter`)];
 const values=[registered,contracted];counters.forEach((card,index)=>{card.setAttribute("role","button");card.tabIndex=0;card.setAttribute("aria-label",index===0?"نمایش فهرست مراقبین ثبت‌نام‌شده با کد معرفی":"نمایش فهرست مراقبین معرفی‌شده واردشده به قرارداد");const strong=card.querySelector("strong");if(strong)strong.textContent=fa(values[index]||0)});
 const donuts=[...document.querySelectorAll<HTMLElement>(`${ROOT} .rb6-loan-card .rb6-donut`)];
 const tiers=[milestones.network10,milestones.contract7];donuts.forEach((donut,index)=>{const tier=tiers[index];if(!tier)return;const target=Math.max(1,Number(tier.target||0)),submitted=Math.max(0,Number(tier.submittedCycles||0)),total=index===0?registered:contracted,current=Math.min(target,Math.max(0,total-submitted*target)),pct=Math.max(0,Math.min(100,Math.round(current/target*100)));const strong=donut.querySelector("strong"),span=donut.querySelector("span");if(strong)strong.textContent=fa(current);if(span)span.textContent=`از ${fa(target)}`;donut.style.background=`conic-gradient(#0a8754 0 ${pct}%,#e5eee9 ${pct}% 100%)`});
 }catch{}finally{refreshBusy=false}}

function wire(){installStyle();void syncVisible();const cards=[...document.querySelectorAll<HTMLElement>(`${ROOT} .rb6-counters .rb6-counter`)];cards.forEach((card,index)=>{if(card.dataset.referralDrilldown==="1")return;card.dataset.referralDrilldown="1";card.setAttribute("role","button");card.tabIndex=0;const open=()=>void openModal(index===0?"registered":"contracted");card.addEventListener("click",open);card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open()}})})}
let timer:number|undefined;const observer=new MutationObserver(()=>{window.clearTimeout(timer);timer=window.setTimeout(wire,80)});observer.observe(document.documentElement,{subtree:true,childList:true});wire();document.addEventListener("visibilitychange",()=>{if(!document.hidden)void syncVisible()});window.addEventListener("focus",()=>void syncVisible());

export const referralCounterDrilldownV1={refresh:syncVisible};
