import React,{useEffect,useState} from "react";
import {BadgeCheck,ChevronLeft,ChevronRight,ClipboardCheck,Landmark,LockKeyhole,ShieldCheck} from "lucide-react";
import {api,fa} from "./caregiver-core-v2";

type FinancialProfile={loanPolicy?:{totalPoints?:number};contractPoints?:{totalPoints?:number}};

const STEPS=[200,400,600,800];

export function CaregiverLoanAccreditationPreviewV1(){
 const [profile,setProfile]=useState<FinancialProfile|null>(null),[error,setError]=useState(""),[slide,setSlide]=useState(0);
 useEffect(()=>{let alive=true;(async()=>{try{const response:any=await api("/api/caregiver/platform/financial-profile");if(alive)setProfile(response?.data||response||{})}catch(e:any){if(alive)setError(e?.message||"دریافت امتیاز قرارداد انجام نشد.")}})();return()=>{alive=false}},[]);
 const points=Number(profile?.loanPolicy?.totalPoints??profile?.contractPoints?.totalPoints??0);
 const go=(next:number)=>setSlide(Math.max(0,Math.min(3,next)));
 return <section className="clap-root" dir="rtl"><style>{styles}</style>
  <div className="clap-deck">
   <article className={`clap-slide clap-status ${slide===0?"active":""}`} aria-hidden={slide!==0}>
    <div className="clap-icon"><ShieldCheck size={31}/></div><span className="clap-kicker">وام و تسهیلات</span><h2>شما در حال اعتبارسنجی برای تخصیص وام هستید</h2><p>چارچوب نهایی تسهیلات در حال تکمیل و اخذ تأییدهای لازم است. در این مرحله این بخش صرفاً برای اطلاع‌رسانی طراحی شده و هیچ درخواست وامی از پنل مراقب ثبت نمی‌شود.</p><div className="clap-badge"><LockKeyhole size={17}/> سامانه درخواست وام فعلاً غیرفعال است</div>
   </article>

   <article className={`clap-slide clap-points ${slide===1?"active":""}`} aria-hidden={slide!==1}>
    <div className="clap-icon"><BadgeCheck size={31}/></div><span className="clap-kicker">امتیازهای مکتسب از قراردادها</span><div className="clap-point-number"><strong>{profile?fa(points):"…"}</strong><span>امتیاز قرارداد</span></div>{error?<small className="clap-error">{error}</small>:<p>این شمارشگر، مجموع امتیازهای ثبت‌شده شما از قراردادها را نمایش می‌دهد. این صفحه هیچ امتیازی از شما کم نمی‌کند و سابقه امتیازهای قرارداد برای استفاده در سیاست نهایی تسهیلات حفظ می‌شود.</p>}<div className="clap-badge"><ClipboardCheck size={17}/> امتیازهای شما برای اعتبارسنجی آینده نگهداری می‌شوند</div>
   </article>

   <article className={`clap-slide clap-steps ${slide===2?"active":""}`} aria-hidden={slide!==2}>
    <div className="clap-icon"><Landmark size={31}/></div><span className="clap-kicker">پلکان امتیازی تسهیلات</span><h2>چهار پله برای ارزیابی آینده</h2><p>پلکان تسهیلات به‌صورت شماتیک در چهار سطح امتیازی تعریف شده است. این اعداد فقط سطح‌های ارزیابی هستند و در حال حاضر به معنی تأیید یا تخصیص وام نیستند.</p><div className="clap-stair" aria-label="پله‌های ۲۰۰، ۴۰۰، ۶۰۰ و ۸۰۰ امتیاز">{STEPS.map((value,index)=><div key={value} className={`clap-step s${index+1}`}><small>پله {fa(index+1)}</small><strong>{fa(value)}</strong><span>امتیاز</span></div>)}</div>
   </article>

   <article className={`clap-slide clap-how ${slide===3?"active":""}`} aria-hidden={slide!==3}>
    <div className="clap-icon"><ClipboardCheck size={31}/></div><span className="clap-kicker">نحوه بررسی پس از فعال‌سازی</span><h2>امتیاز قرارداد + امتیاز ارزیابی</h2><p>پس از نهایی‌شدن سیاست و فعال‌سازی رسمی این خدمت، بررسی هر پله با ترکیب امتیازهای مکتسب از قراردادها و نتیجه ارزیابی مراقب انجام خواهد شد. شرایط نهایی تخصیص وام بعداً در همین بخش اعلام می‌شود.</p><div className="clap-two"><span>امتیاز قرارداد</span><b>+</b><span>امتیاز ارزیابی</span></div><div className="clap-badge"><ShieldCheck size={17}/> تا زمان فعال‌سازی، هیچ قابلیت درخواست وامی در این تب وجود ندارد</div>
   </article>
  </div>

  <div className="clap-nav"><button type="button" onClick={()=>go(slide-1)} disabled={slide===0} aria-label="اسلاید قبلی"><ChevronRight size={19}/></button><div className="clap-dots" aria-label="انتخاب اسلاید">{[0,1,2,3].map(index=><button key={index} type="button" className={slide===index?"active":""} onClick={()=>go(index)} aria-label={`اسلاید ${index+1}`}/>)}</div><button type="button" onClick={()=>go(slide+1)} disabled={slide===3} aria-label="اسلاید بعدی"><ChevronLeft size={19}/></button></div>
 </section>
}

const styles=`
.clap-root{font-family:inherit;color:#18352b;display:grid;gap:12px}.clap-deck{position:relative;min-height:410px}.clap-slide{position:absolute;inset:0;opacity:0;pointer-events:none;transform:translateX(-12px);transition:opacity .22s ease,transform .22s ease;border:1px solid #dce9e3;border-radius:26px;background:linear-gradient(145deg,#fff,#f7fbf9);padding:27px 24px;box-shadow:0 10px 30px rgba(25,73,54,.07);display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center}.clap-slide.active{opacity:1;pointer-events:auto;transform:none}.clap-icon{width:64px;height:64px;border-radius:22px;background:#eaf7f0;color:#08784c;display:grid;place-items:center;margin-bottom:14px}.clap-kicker{font-size:11px;font-weight:900;color:#17865b;background:#edf8f2;border-radius:999px;padding:6px 10px}.clap-slide h2{font-size:20px;line-height:1.75;margin:12px 0 7px;color:#163c2e}.clap-slide p{max-width:650px;font-size:12px;line-height:2.05;color:#657c72;margin:0}.clap-badge{margin-top:19px;border:1px solid #d7e8df;background:#f0f8f4;color:#28674d;border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800}.clap-point-number{margin:14px 0 8px;display:grid;place-items:center}.clap-point-number strong{font-size:54px;line-height:1;color:#08784c;font-variant-numeric:tabular-nums}.clap-point-number span{font-size:12px;color:#60776c;margin-top:8px}.clap-error{color:#a8423b;font-size:11px;margin:8px}.clap-stair{width:min(100%,560px);height:175px;display:flex;align-items:flex-end;justify-content:center;gap:7px;margin-top:20px;direction:ltr}.clap-step{width:23%;min-width:64px;border:1px solid #cfe3d8;background:#edf8f2;border-radius:15px 15px 8px 8px;display:grid;place-items:center;align-content:center;color:#166443;padding:7px}.clap-step small{font-size:9px}.clap-step strong{font-size:22px}.clap-step span{font-size:9px}.clap-step.s1{height:62px}.clap-step.s2{height:91px}.clap-step.s3{height:122px}.clap-step.s4{height:155px}.clap-two{margin-top:22px;display:flex;align-items:center;justify-content:center;gap:11px;flex-wrap:wrap}.clap-two span{border:1px solid #d7e7df;background:#fff;border-radius:15px;padding:12px 15px;font-size:12px;font-weight:900;color:#246047}.clap-two b{color:#17865b;font-size:20px}.clap-nav{display:flex;align-items:center;justify-content:center;gap:18px}.clap-nav>button{width:39px;height:39px;border:1px solid #d9e6e0;border-radius:13px;background:#fff;color:#1e6549;display:grid;place-items:center;cursor:pointer}.clap-nav>button:disabled{opacity:.35;cursor:default}.clap-dots{display:flex;gap:7px;direction:ltr}.clap-dots button{width:8px;height:8px;padding:0;border:0;border-radius:999px;background:#cbd9d2;cursor:pointer;transition:width .2s ease}.clap-dots button.active{width:25px;background:#0b8152}@media(max-width:600px){.clap-deck{min-height:430px}.clap-slide{padding:23px 16px;border-radius:23px}.clap-slide h2{font-size:18px}.clap-stair{gap:5px}.clap-step strong{font-size:18px}.clap-point-number strong{font-size:48px}}@media(min-width:900px){.clap-deck{min-height:390px}.clap-slide{padding:32px}.clap-slide p{font-size:13px}.clap-stair{height:165px}}
`;
