import "./loan-tier-pie-score-counters-v1.css";

type ChartConfig={root:string;items:string;current:string};

const charts:ChartConfig[]=[
 {root:".cb3-loan-chart",items:".cb3-milestones > div",current:"header small"},
 {root:".mafl-chart",items:".mafl-marks > div",current:"header small"},
 {root:".flp-chart",items:".flp-marks > div",current:"header small"},
];

const latin=(value:string)=>value
 .replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
 .replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
 .replace(/٬/g,",")
 .replace(/٫/g,".");

const firstNumber=(value:string)=>{
 const match=latin(value).replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
 return match?Number(match[0]):NaN;
};

const clamp=(value:number)=>Math.max(0,Math.min(100,value));
const fa=(value:number)=>Math.round(value).toLocaleString("fa-IR");

function enhance(root:HTMLElement,config:ChartConfig){
 const current=firstNumber(root.querySelector<HTMLElement>(config.current)?.innerText||"");
 if(!Number.isFinite(current))return;
 const items=Array.from(root.querySelectorAll<HTMLElement>(config.items));
 if(!items.length)return;
 const signature=`${current}:${items.map(item=>item.innerText).join("|")}`;
 if(root.dataset.ltpSignature===signature)return;
 items.forEach((item,index)=>{
  const strong=item.querySelector<HTMLElement>("strong"),small=item.querySelector<HTMLElement>("small");
  const target=firstNumber(strong?.innerText||"");
  if(!Number.isFinite(target)||target<=0)return;
  const progress=clamp(current/target*100),complete=current>=target,remaining=Math.max(0,target-current);
  const displayedPercent=complete?100:Math.min(99,Math.round(progress));
  item.style.setProperty("--ltp-progress",`${progress}%`);
  item.dataset.ltpPercent=`${fa(displayedPercent)}٪`;
  item.dataset.ltpState=complete?"complete":"progress";
  item.setAttribute("aria-label",`پله ${index+1}: ${Math.round(current)} از ${Math.round(target)} امتیاز، ${displayedPercent} درصد`);
  if(strong)strong.dataset.ltpTier=`پله ${fa(index+1)}`;
  if(small)small.dataset.ltpDetail=complete?`${fa(target)} / ${fa(target)} امتیاز • تکمیل`:`${fa(current)} / ${fa(target)} امتیاز • ${fa(remaining)} مانده`;
 });
 root.dataset.ltpSignature=signature;
 root.dataset.ltpEnhanced="true";
}

function scan(){
 for(const config of charts){
  document.querySelectorAll<HTMLElement>(config.root).forEach(root=>enhance(root,config));
 }
}

let frame=0;
function schedule(){
 if(frame)return;
 frame=requestAnimationFrame(()=>{frame=0;scan()});
}

if(typeof document!=="undefined"){
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});
 else schedule();
 const observer=new MutationObserver(schedule);
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
}
