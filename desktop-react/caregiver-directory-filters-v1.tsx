import React,{FormEvent,useEffect,useRef,useState} from "react";
import {Filter,RotateCcw,SlidersHorizontal} from "lucide-react";
import {api,Card,Notify} from "./core";
import {CaregiversPage as CaregiversActivityPage} from "./caregiver-activity-scorecard";
import {InitialEvaluationTab} from "./initial-evaluation-tab-v1";
import "./caregiver-directory-filters-v1.css";

type FilterState={gender:string;ageMin:string;ageMax:string;specialty:string;evaluation:string;scoreMin:string;scoreMax:string;rank:string;stars:string;sort:string};
const defaults:FilterState={gender:"",ageMin:"",ageMax:"",specialty:"",evaluation:"",scoreMin:"",scoreMax:"",rank:"",stars:"",sort:"evaluation_due"};

function normalize(filters:FilterState){
 const next:Record<string,string>={};
 for(const [key,value] of Object.entries(filters)){const clean=String(value||"").trim();if(clean)next[key]=clean}
 return next;
}

export function CaregiversPage({access,notify}:{access:any;notify:Notify}){
 const [draft,setDraft]=useState<FilterState>(defaults),[applied,setApplied]=useState<FilterState>(defaults),[version,setVersion]=useState(0),[selectedCaregiverId,setSelectedCaregiverId]=useState(""),[profileTab,setProfileTab]=useState<"activity"|"initial">("activity"),[initialAccess,setInitialAccess]=useState<any>(null);
 const appliedRef=useRef(applied);appliedRef.current=applied;
 useEffect(()=>{void api("/api/staff/initial-evaluations/access").then((p:any)=>setInitialAccess(p.data||null)).catch(()=>setInitialAccess(null))},[]);
 useEffect(()=>{
  const nativeFetch=window.fetch.bind(window);
  const patched:typeof window.fetch=async(input,init)=>{
   const raw=typeof input==="string"?input:input instanceof URL?input.toString():input.url;
   const url=new URL(raw,location.origin);
   if(url.origin===location.origin&&url.pathname==="/api/admin/caregivers-page"){
    const filters=normalize(appliedRef.current);
    for(const [key,value] of Object.entries(filters))url.searchParams.set(key,value);
    if(typeof input==="string"||input instanceof URL)return nativeFetch(url.toString(),init);
    return nativeFetch(new Request(url.toString(),input),init);
   }
   if(url.origin===location.origin&&url.pathname==="/api/admin/caregiver-profile"){
    const response=typeof input==="string"||input instanceof URL?await nativeFetch(url.toString(),init):await nativeFetch(new Request(url.toString(),input),init);
    const id=String(url.searchParams.get("id")||"").trim();if(response.ok&&id)setSelectedCaregiverId(id);return response;
   }
   return nativeFetch(input as RequestInfo|URL,init);
  };
  window.fetch=patched;
  return()=>{if(window.fetch===patched)window.fetch=nativeFetch as typeof window.fetch};
 },[]);
 const resetSelection=()=>{setSelectedCaregiverId("");setProfileTab("activity")};
 const apply=(event:FormEvent)=>{event.preventDefault();const ageMin=Number(draft.ageMin||0),ageMax=Number(draft.ageMax||0),scoreMin=Number(draft.scoreMin||0),scoreMax=draft.scoreMax===""?0:Number(draft.scoreMax);if(ageMin&&ageMax&&ageMax<ageMin){notify("حداکثر سن نمی‌تواند کمتر از حداقل سن باشد.","error");return}if(draft.scoreMin!==""&&draft.scoreMax!==""&&scoreMax<scoreMin){notify("حداکثر امتیاز نمی‌تواند کمتر از حداقل امتیاز باشد.","error");return}setApplied({...draft});setVersion(v=>v+1);resetSelection()};
 const reset=()=>{setDraft(defaults);setApplied(defaults);setVersion(v=>v+1);resetSelection()};
 const active=Object.entries(applied).filter(([key,value])=>key!=="sort"&&Boolean(value)).length+(applied.sort!==defaults.sort?1:0),showInitial=Boolean(initialAccess?.allowed&&selectedCaregiverId);
 return <div className="cdf-desktop-stack">
  <Card className="cdf-desktop-card"><form className="cdf-desktop-filter" onSubmit={apply}><div className="cdf-desktop-title"><span><SlidersHorizontal size={18}/></span><div><strong>فیلتر و ترتیب نمایش مراقبین</strong><small>ارزیابی، امتیاز، رتبه و ستاره روی کل دیتابیس مراقبین اعمال می‌شوند.</small></div>{active>0&&<em>{active.toLocaleString("fa-IR")} فیلتر فعال</em>}</div><div className="cdf-desktop-grid"><label><span>وضعیت ارزیابی</span><select value={draft.evaluation} onChange={e=>setDraft(v=>({...v,evaluation:e.target.value}))}><option value="">همه</option><option value="evaluated">دارای ارزیابی نهایی</option><option value="none">بدون ارزیابی نهایی</option></select></label><label><span>امتیاز از</span><input type="number" inputMode="numeric" min="0" max="100" placeholder="۰" value={draft.scoreMin} onChange={e=>setDraft(v=>({...v,scoreMin:e.target.value}))}/></label><label><span>امتیاز تا</span><input type="number" inputMode="numeric" min="0" max="100" placeholder="۱۰۰" value={draft.scoreMax} onChange={e=>setDraft(v=>({...v,scoreMax:e.target.value}))}/></label><label><span>رتبه حرفه‌ای</span><select value={draft.rank} onChange={e=>setDraft(v=>({...v,rank:e.target.value}))}><option value="">همه رتبه‌ها</option><option value="R-1">R-1 ممتاز</option><option value="R-2">R-2 ارشد</option><option value="R-3">R-3 حرفه‌ای</option><option value="R-4">R-4 پایه</option><option value="R-5">R-5 مشروط</option></select></label><label><span>تعداد ستاره</span><select value={draft.stars} onChange={e=>setDraft(v=>({...v,stars:e.target.value}))}><option value="">همه</option><option value="5">۵ ستاره</option><option value="4">۴ ستاره</option><option value="3">۳ ستاره</option><option value="2">۲ ستاره</option><option value="1">۱ ستاره</option></select></label><label><span>جنسیت</span><select value={draft.gender} onChange={e=>setDraft(v=>({...v,gender:e.target.value}))}><option value="">همه</option><option value="female">زن</option><option value="male">مرد</option><option value="unknown">نامشخص</option></select></label><label><span>سن از</span><input type="number" inputMode="numeric" min="15" max="100" placeholder="مثلاً ۲۵" value={draft.ageMin} onChange={e=>setDraft(v=>({...v,ageMin:e.target.value}))}/></label><label><span>سن تا</span><input type="number" inputMode="numeric" min="15" max="100" placeholder="مثلاً ۵۵" value={draft.ageMax} onChange={e=>setDraft(v=>({...v,ageMax:e.target.value}))}/></label><label><span>تخصص / گروه خدمتی</span><input placeholder="سالمند، بیمار، کودک..." value={draft.specialty} onChange={e=>setDraft(v=>({...v,specialty:e.target.value}))}/></label><label className="cdf-sort"><span>ترتیب نمایش</span><select value={draft.sort} onChange={e=>setDraft(v=>({...v,sort:e.target.value}))}><option value="evaluation_due">آخرین ارزیابی: ارزیابی‌نشده/قدیمی‌تر اول</option><option value="evaluation_recent">آخرین ارزیابی: جدیدتر اول</option><option value="score_desc">امتیاز: بیشترین اول</option><option value="score_asc">امتیاز: کمترین اول</option><option value="rank_desc">رتبه: ممتاز به مشروط</option><option value="rank_asc">رتبه: مشروط به ممتاز</option><option value="stars_desc">ستاره: ۵ به ۱</option><option value="stars_asc">ستاره: ۱ به ۵</option><option value="created_desc">تاریخ ایجاد پروفایل: جدیدتر اول</option><option value="created_asc">تاریخ ایجاد پروفایل: قدیمی‌تر اول</option><option value="age_asc">سن: کم‌تر به بیش‌تر</option><option value="age_desc">سن: بیش‌تر به کم‌تر</option><option value="name_asc">نام: الف تا ی</option></select></label></div><div className="cdf-desktop-actions"><p><Filter size={15}/>رتبه و تعداد ستاره از امتیاز آخرین ارزیابی نهایی محاسبه می‌شود؛ R-1 برابر ۵ ستاره و R-5 برابر ۱ ستاره است.</p><div><button type="button" className="da-btn soft" onClick={reset}><RotateCcw size={16}/>پاک‌کردن</button><button className="da-btn primary"><Filter size={16}/>اعمال فیلتر</button></div></div></form></Card>
  {showInitial&&<div className="iev-profile-tabs"><button type="button" className={profileTab==="activity"?"active":""} onClick={()=>setProfileTab("activity")}>پرونده و کارنامه</button><button type="button" className={profileTab==="initial"?"active":""} onClick={()=>setProfileTab("initial")}>ارزیابی بدوی</button><em>محرمانه • فقط مدیر/دارای اختیار</em></div>}
  <div style={{display:profileTab==="activity"?"block":"none"}}><CaregiversActivityPage key={version} access={access} notify={notify}/></div>
  {showInitial&&profileTab==="initial"&&<InitialEvaluationTab caregiverId={selectedCaregiverId} initialAccess={initialAccess} notify={notify}/>} 
 </div>
}
