import React,{useEffect,useMemo,useState} from "react";
import {SlidersHorizontal} from "lucide-react";
import {api,Notify} from "./core";
import {JobAdsPage as JobAdsPageV3} from "./job-ads-v3";
import "./job-ads-v4.css";

type ExtraFilters={sort:string;contractType:string;shiftType:string;consultantId:string};
const DEFAULT_FILTERS:ExtraFilters={sort:"newest",contractType:"",shiftType:"",consultantId:""};
let activeFilters:ExtraFilters=DEFAULT_FILTERS;
let originalFetch:typeof window.fetch|undefined;
let interceptorUsers=0;

function exactStaffJobAds(input:RequestInfo|URL){
 try{const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin);return url.origin===location.origin&&url.pathname==="/api/staff/job-ads"?url:null}catch{return null}
}
function installInterceptor(){
 interceptorUsers++;
 if(originalFetch)return;
 originalFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=exactStaffJobAds(input);if(!url||String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()!=="GET")return originalFetch!(input,init);
  for(const [key,value] of Object.entries(activeFilters)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)}
  if(input instanceof Request)return originalFetch!(new Request(url.toString(),input),init);
  return originalFetch!(url.toString(),init);
 }) as typeof window.fetch;
}
function uninstallInterceptor(){
 interceptorUsers=Math.max(0,interceptorUsers-1);if(interceptorUsers||!originalFetch)return;
 window.fetch=originalFetch;originalFetch=undefined;activeFilters=DEFAULT_FILTERS;
}

export function JobAdsPage({notify}:{notify:Notify}){
 const [filters,setFilters]=useState<ExtraFilters>(DEFAULT_FILTERS),[consultants,setConsultants]=useState<any[]>([]),[revision,setRevision]=useState(0);
 useEffect(()=>{installInterceptor();return uninstallInterceptor},[]);
 useEffect(()=>{api<any>("/api/staff/job-ads/consultants?q=").then(p=>setConsultants(p.data?.consultants||[])).catch(()=>setConsultants([]))},[]);
 const apply=()=>{activeFilters={...filters};setRevision(x=>x+1)};
 const clear=()=>{const next={...DEFAULT_FILTERS};setFilters(next);activeFilters=next;setRevision(x=>x+1)};
 const activeCount=useMemo(()=>[filters.contractType,filters.shiftType,filters.consultantId,filters.sort!=="newest"?filters.sort:""].filter(Boolean).length,[filters]);
 return <div className="ja-v4-owner"><section className="ja-v4-filterbar"><div className="ja-v4-filter-title"><SlidersHorizontal size={18}/><div><strong>فیلتر و ترتیب بانک آگهی‌ها</strong><small>{activeCount?`${activeCount.toLocaleString("fa-IR")} فیلتر فعال`:"نمایش پیش‌فرض: جدیدترین آگهی‌ها"}</small></div></div><div className="ja-v4-filter-grid"><label><span>ترتیب نمایش</span><select value={filters.sort} onChange={e=>setFilters(x=>({...x,sort:e.target.value}))}><option value="newest">جدیدترین آگهی</option><option value="oldest">قدیمی‌ترین آگهی</option><option value="points_desc">بالاترین امتیاز</option><option value="points_asc">پایین‌ترین امتیاز</option></select></label><label><span>نوع آگهی</span><select value={filters.contractType} onChange={e=>setFilters(x=>({...x,contractType:e.target.value}))}><option value="">همه انواع</option><option value="ELDERLY">سالمند</option><option value="PATIENT">بیمار</option><option value="CHILD">کودک</option><option value="HOUSEKEEPING">خدماتی</option></select></label><label><span>شیفت آگهی</span><select value={filters.shiftType} onChange={e=>setFilters(x=>({...x,shiftType:e.target.value}))}><option value="">همه شیفت‌ها</option><option value="DAY">روزانه</option><option value="NIGHT">شبانه</option><option value="LIVE_IN">شبانه‌روزی</option><option value="TEMPORARY">مقطعی</option></select></label><label><span>مشاور آگهی</span><select value={filters.consultantId} onChange={e=>setFilters(x=>({...x,consultantId:e.target.value}))}><option value="">همه مشاوران</option>{consultants.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select></label><div className="ja-v4-filter-actions"><button type="button" className="da-btn primary" onClick={apply}>اعمال فیلتر</button><button type="button" className="da-btn soft" onClick={clear}>پاک‌کردن</button></div></div></section><JobAdsPageV3 key={`job-ads-v4-${revision}`} notify={notify}/></div>;
}
