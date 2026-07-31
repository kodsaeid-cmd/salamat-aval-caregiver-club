(()=>{
'use strict';
if(window.__salamatEvaluationLiveScoreV1)return;
window.__salamatEvaluationLiveScoreV1=true;

const fa=value=>Number(value||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const round1=value=>Math.round(value*10)/10;

function recalculate(){
  const cards=[...document.querySelectorAll('.sev-indicator')];
  if(!cards.length)return;
  let totalCriteria=0,scoredCriteria=0,completeIndicators=0;
  const liveScores=[];
  cards.forEach(card=>{
    const criteria=[...card.querySelectorAll('[data-sev-criterion]')];
    const values=criteria.map(row=>Number(row.querySelector('input[type="radio"]:checked')?.value||0)).filter(value=>value>=1&&value<=5);
    totalCriteria+=criteria.length;scoredCriteria+=values.length;
    if(criteria.length&&values.length===criteria.length)completeIndicators+=1;
    const liveScore=values.length?round1(values.reduce((sum,value)=>sum+value,0)/values.length*20):null;
    if(liveScore!==null)liveScores.push(liveScore);
    const score=card.querySelector('.sev-score strong');if(score)score.textContent=liveScore===null?'—':fa(liveScore);
    const progress=card.querySelector('.sev-progress i');if(progress)progress.style.width=`${liveScore===null?0:Math.max(0,Math.min(100,liveScore))}%`;
    const count=card.querySelector('.sev-indicator-head>span:nth-child(2)>small');if(count)count.textContent=`${fa(values.length)} از ${fa(criteria.length)} معیار امتیازدهی شده`;
  });
  const kpis=[...document.querySelectorAll('.sev-kpis .sev-kpi strong')];
  if(kpis[0])kpis[0].textContent=`${fa(scoredCriteria)} / ${fa(totalCriteria)}`;
  if(kpis[1])kpis[1].textContent=`${fa(completeIndicators)} / ۸`;
  if(kpis[2])kpis[2].textContent=liveScores.length?fa(round1(liveScores.reduce((sum,value)=>sum+value,0)/liveScores.length)):'—';
}

document.addEventListener('change',event=>{if(event.target?.matches?.('.sev-score-option input[type="radio"]'))recalculate()},true);
window.addEventListener('salamat-evaluation-changed',()=>setTimeout(recalculate,20));
})();
