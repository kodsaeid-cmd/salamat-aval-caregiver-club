import "./admin-workforce-kpi-runtime-v1.css";

const ROOT_CLASS="ma-workforce-kpi-v1";
const fa=(value:number)=>Number(value||0).toLocaleString("fa-IR");
const pct=(value:number)=>Number(value||0).toLocaleString("fa-IR",{maximumFractionDigits:1});

function gauge(kind:"dispatch"|"contract",label:string,numerator:number,denominator:number,percent:number){
 const safe=Math.max(0,Math.min(100,Number(percent||0))),article=document.createElement("article");article.className=`ma-workforce-kpi-gauge ${kind}`;
 article.innerHTML=`<div class="ma-workforce-kpi-copy"><small>${label}</small><strong>${fa(numerator)} <em>از ${fa(denominator)}</em></strong><span>${kind==="dispatch"?"مراقب در اعزام / کل آگهی‌ها":"مراقب در قرارداد / کل قراردادها"}</span></div><div class="ma-workforce-kpi-ring"><div><strong>${pct(percent)}٪</strong><small>KPI</small></div></div>`;
 (article.querySelector(".ma-workforce-kpi-ring") as HTMLElement|null)?.style.setProperty("--p",`${safe}%`);return article;
}

async function render(){
 const card=document.querySelector<HTMLElement>(".ma-workforce-card");if(!card)return;
 let root=card.querySelector<HTMLElement>(`.${ROOT_CLASS}`);if(!root){root=document.createElement("section");root.className=ROOT_CLASS;card.appendChild(root)}
 try{
  const response=await fetch("/api/admin/caregiver-workforce-summary",{credentials:"same-origin",cache:"no-store"});if(!response.ok)return;const payload:any=await response.json(),w=payload?.data||{};
  root.replaceChildren(gauge("dispatch","نرخ اعزام",Number(w.dispatchCaregivers||0),Number(w.totalJobAds||0),Number(w.dispatchToJobAdsPercent||0)),gauge("contract","نرخ قرارداد",Number(w.inContractCaregivers||0),Number(w.totalContracts||0),Number(w.inContractToContractsPercent||0)));
 }catch{}
}

let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void render()})};
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(()=>void render(),15000);schedule();
