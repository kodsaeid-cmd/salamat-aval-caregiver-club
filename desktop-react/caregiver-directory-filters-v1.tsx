import React,{FormEvent,useEffect,useRef,useState} from "react";
import {Filter,RotateCcw,SlidersHorizontal} from "lucide-react";
import {Card,Notify} from "./core";
import {CaregiversPage as CaregiversActivityPage} from "./caregiver-activity-scorecard";
import "./caregiver-directory-filters-v1.css";

type FilterState={gender:string;ageMin:string;ageMax:string;specialty:string;sort:string};
const defaults:FilterState={gender:"",ageMin:"",ageMax:"",specialty:"",sort:"evaluation_due"};

function normalize(filters:FilterState){
 const next:Record<string,string>={};
 for(const [key,value] of Object.entries(filters)){const clean=String(value||"").trim();if(clean)next[key]=clean}
 return next;
}

export function CaregiversPage({access,notify}:{access:any;notify:Notify}){
 const [draft,setDraft]=useState<FilterState>(defaults),[applied,setApplied]=useState<FilterState>(defaults),[version,setVersion]=useState(0);
 const appliedRef=useRef(applied);appliedRef.current=applied;
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
   return nativeFetch(input as RequestInfo|URL,init);
  };
  window.fetch=patched;
  return()=>{if(window.fetch===patched)window.fetch=nativeFetch as typeof window.fetch};
 },[]);
 const apply=(event:FormEvent)=>{event.preventDefault();const min=Number(draft.ageMin||0),max=Number(draft.ageMax||0);if(min&&max&&max<min){notify("حداکثر سن نمی‌تواند کمتر از حداقل سن باشد.","error");return}setApplied({...draft});setVersion(v=>v+1)};
 const reset=()=>{setDraft(defaults);setApplied(defaults);setVersion(v=>v+1)};
 const active=Object.entries(applied).filter(([key,value])=>key!=="sort"&&Boolean(value)).length+(applied.sort!==defaults.sort?1:0);
 return <div className="cdf-desktop-stack">
  <Card className="cdf-desktop-card"><form className="cdf-desktop-filter" onSubmit={apply}><div className="cdf-desktop-title"><span><SlidersHorizontal size={18}/></span><div><strong>فیلتر و ترتیب نمایش مراقبین</strong><small>فیلترها روی کل دیتابیس اعمال می‌شوند، نه فقط صفحه جاری.</small></div>{active>0&&<em>{active.toLocaleString("fa-IR")} فیلتر فعال</em>}</div><div className="cdf-desktop-grid"><label><span>جنسیت</span><select value={draft.gender} onChange={e=>setDraft(v=>({...v,gender:e.target.value}))}><option value="">همه</option><option value="female">زن</option><option value="male">مرد</option><option value="unknown">نامشخص</option></select></label><label><span>سن از</span><input type="number" inputMode="numeric" min="15" max="100" placeholder="مثلاً ۲۵" value={draft.ageMin} onChange={e=>setDraft(v=>({...v,ageMin:e.target.value}))}/></label><label><span>سن تا</span><input type="number" inputMode="numeric" min="15" max="100" placeholder="مثلاً ۵۵" value={draft.ageMax} onChange={e=>setDraft(v=>({...v,ageMax:e.target.value}))}/></label><label><span>تخصص / گروه خدمتی</span><input placeholder="سالمند، بیمار، کودک..." value={draft.specialty} onChange={e=>setDraft(v=>({...v,specialty:e.target.value}))}/></label><label className="cdf-sort"><span>ترتیب نمایش</span><select value={draft.sort} onChange={e=>setDraft(v=>({...v,sort:e.target.value}))}><option value="evaluation_due">نوبت ارزیابی: عقب‌افتاده‌تر اول</option><option value="evaluation_recent">آخرین ارزیابی: جدیدتر اول</option><option value="created_desc">تاریخ ایجاد پروفایل: جدیدتر اول</option><option value="created_asc">تاریخ ایجاد پروفایل: قدیمی‌تر اول</option><option value="age_asc">سن: کم‌تر به بیش‌تر</option><option value="age_desc">سن: بیش‌تر به کم‌تر</option><option value="score_desc">امتیاز حرفه‌ای: بیش‌تر اول</option><option value="name_asc">نام: الف تا ی</option></select></label></div><div className="cdf-desktop-actions"><p><Filter size={15}/>در «نوبت ارزیابی»، مراقبین بدون ارزیابی در اولویت‌اند و بعد قدیمی‌ترین ارزیابی‌ها نمایش داده می‌شوند.</p><div><button type="button" className="da-btn soft" onClick={reset}><RotateCcw size={16}/>پاک‌کردن</button><button className="da-btn primary"><Filter size={16}/>اعمال فیلتر</button></div></div></form></Card>
  <CaregiversActivityPage key={version} access={access} notify={notify}/>
 </div>
}
