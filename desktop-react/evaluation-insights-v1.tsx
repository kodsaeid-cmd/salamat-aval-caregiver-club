import React from "react";
import {Sparkles,Star,TrendingUp,TriangleAlert} from "lucide-react";

const fa=(value:unknown)=>Number(value||0).toLocaleString("fa-IR");
const text=(value:unknown,fallback="—")=>String(value??"").trim()||fallback;

export function GoldStars({stars,label=true}:{stars:unknown;label?:boolean}){
 const count=Math.max(0,Math.min(5,Math.trunc(Number(stars)||0)));
 return <div className="cs-starline"><div className="cs-stars" aria-label={count?`${count} ستاره از ۵`:"رتبه ستاره‌ای هنوز صادر نشده"}>{[1,2,3,4,5].map(n=><Star key={n} className={n<=count?"filled":""}/>)}</div>{label&&<small>{count?`${fa(count)} از ۵ ستاره`:"در انتظار کارنامه نهایی"}</small>}</div>
}

export function EvaluationAnalysis({analysis}:{analysis:any}){
 if(!analysis)return null;
 const strengths=Array.isArray(analysis.strengths)?analysis.strengths:[],growth=Array.isArray(analysis.growthAreas)?analysis.growthAreas:[];
 return <section className="cs-analysis">
  <div className="cs-analysis-summary"><strong><Sparkles size={15}/> تحلیل خودکار کارنامه</strong>{text(analysis.summary,"برای تحلیل کارنامه هنوز داده کافی ثبت نشده است.")}</div>
  <div className="cs-analysis-columns">
   <section className="cs-analysis-column"><header><strong><TrendingUp size={15}/> نقاط قوت</strong><span>{fa(strengths.length)}</span></header><div className="cs-insight-list">{strengths.length?strengths.map((item:any)=><article className="cs-insight" key={`${item.indicatorCode}-${item.criterionCode}`}><div><strong>{text(item.title,"معیار ارزیابی")}</strong><small>{text(item.indicatorCode)} • {text(item.indicatorTitle,"شاخص")}</small></div><b>{fa(item.score)} / ۵</b></article>):<p className="cs-analysis-empty">در داده‌های فعلی هنوز معیار ۴ یا ۵ امتیازی برای معرفی به‌عنوان نقطه قوت برجسته ثبت نشده است.</p>}</div></section>
   <section className="cs-analysis-column growth"><header><strong><TriangleAlert size={15}/> نقاط ضعف / قابل بهبود</strong><span>{fa(growth.length)}</span></header><div className="cs-insight-list">{growth.length?growth.map((item:any)=><article className="cs-insight" key={`${item.indicatorCode}-${item.criterionCode}`}><div><strong>{text(item.title,"معیار ارزیابی")}</strong><small>{text(item.indicatorCode)} • {text(item.indicatorTitle,"شاخص")}</small></div><b>{fa(item.score)} / ۵</b></article>):<p className="cs-analysis-empty">در داده‌های امتیازدهی‌شده فعلی ضعف برجسته‌ای با امتیاز ۳ یا کمتر ثبت نشده است.</p>}</div></section>
  </div>
  <div className="cs-analysis-recommendation">{text(analysis.recommendation,"پس از تکمیل ارزیابی، پیشنهاد توسعه حرفه‌ای نمایش داده می‌شود.")}</div>
  <small className="cs-analysis-disclaimer">{text(analysis.disclaimer,"تحلیل صرفاً از امتیازهای ثبت‌شده در نظام ارزیابی استخراج می‌شود.")}</small>
 </section>
}
