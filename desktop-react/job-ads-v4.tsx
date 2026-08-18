import React,{useEffect,useMemo,useState} from "react";
import {SlidersHorizontal} from "lucide-react";
import {api,Notify} from "./core";
import {JobAdsPage as JobAdsPageV3} from "./job-ads-v3";
import "./job-ads-v4.css";

type ExtraFilters={sort:string;contractType:string;shiftType:string;consultantId:string};
type Pagination={page:number;pageSize:number;total:number;totalPages:number;hasNext:boolean;hasPrevious:boolean};
const DEFAULT_FILTERS:ExtraFilters={sort:"newest",contractType:"",shiftType:"",consultantId:""};
const DEFAULT_PAGINATION:Pagination={page:1,pageSize:20,total:0,totalPages:1,hasNext:false,hasPrevious:false};
const PAGE_SIZE=20,PAGINATION_EVENT="salamat-job-ads-pagination-v1";
let activeFilters:ExtraFilters=DEFAULT_FILTERS;
let activePage=1,lastListSignature="";
let originalFetch:typeof window.fetch|undefined;

function exactStaffJobAds(input:RequestInfo|URL){
 try{const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin);return url.origin===location.origin&&url.pathname==="/api/staff/job-ads"?url:null}catch{return null}
}
function ensureInterceptor(){
 if(originalFetch||typeof window==="undefined")return;
 originalFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=exactStaffJobAds(input);if(!url||String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()!=="GET")return originalFetch!(input,init);
  for(const [key,value] of Object.entries(activeFilters)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)}
  const signatureUrl=new URL(url.toString());signatureUrl.searchParams.delete("page");signatureUrl.searchParams.delete("pageSize");const signature=signatureUrl.toString();
  if(lastListSignature&&lastListSignature!==signature)activePage=1;lastListSignature=signature;
  url.searchParams.set("page",String(activePage));url.searchParams.set("pageSize",String(PAGE_SIZE));
  const response=input instanceof Request?await originalFetch!(new Request(url.toString(),input),init):await originalFetch!(url.toString(),init);
  void response.clone().json().then((payload:any)=>{const info=payload?.data?.pagination||payload?.pagination;if(info)window.dispatchEvent(new CustomEvent(PAGINATION_EVENT,{detail:info}))}).catch(()=>undefined);
  return response;
 }) as typeof window.fetch;
}

export function JobAdsPage({notify}:{notify:Notify}){
 ensureInterceptor();
 const [filters,setFilters]=useState<ExtraFilters>(DEFAULT_FILTERS),[consultants,setConsultants]=useState<any[]>([]),[revision,setRevision]=useState(0),[pagination,setPagination]=useState<Pagination>(DEFAULT_PAGINATION);
 useEffect(()=>{const sync=(event:Event)=>setPagination((event as CustomEvent<Pagination>).detail||DEFAULT_PAGINATION);window.addEventListener(PAGINATION_EVENT,sync);return()=>{window.removeEventListener(PAGINATION_EVENT,sync);activeFilters=DEFAULT_FILTERS;activePage=1;lastListSignature=""}},[]);
 useEffect(()=>{api<any>("/api/staff/job-ads/consultants?q=").then(p=>setConsultants(p.data?.consultants||[])).catch(()=>setConsultants([]))},[]);
 const apply=()=>{activeFilters={...filters};activePage=1;lastListSignature="";setPagination(DEFAULT_PAGINATION);setRevision(x=>x+1)};
 const clear=()=>{const next={...DEFAULT_FILTERS};setFilters(next);activeFilters=next;activePage=1;lastListSignature="";setPagination(DEFAULT_PAGINATION);setRevision(x=>x+1)};
 const goPage=(next:number)=>{if(next<1||next>pagination.totalPages||next===pagination.page)return;activePage=next;setRevision(x=>x+1);window.scrollTo({top:0,behavior:"smooth"})};
 const activeCount=useMemo(()=>[filters.contractType,filters.shiftType,filters.consultantId,filters.sort!=="newest"?filters.sort:""].filter(Boolean).length,[filters]);
 return <div className="ja-v4-owner"><section className="ja-v4-filterbar"><div className="ja-v4-filter-title"><SlidersHorizontal size={18}/><div><strong>فیلتر و ترتیب بانک آگهی‌ها</strong><small>{activeCount?`${activeCount.toLocaleString("fa-IR")} فیلتر فعال`:"نمایش پیش‌فرض: جدیدترین آگهی‌ها"}</small></div></div><div className="ja-v4-filter-grid"><label><span>ترتیب نمایش</span><select value={filters.sort} onChange={e=>setFilters(x=>({...x,sort:e.target.value}))}><option value="newest">جدیدترین آگهی</option><option value="oldest">قدیمی‌ترین آگهی</option><option value="points_desc">بالاترین امتیاز</option><option value="points_asc">پایین‌ترین امتیاز</option></select></label><label><span>نوع آگهی</span><select value={filters.contractType} onChange={e=>setFilters(x=>({...x,contractType:e.target.value}))}><option value="">همه انواع</option><option value="ELDERLY">سالمند</option><option value="PATIENT">بیمار</option><option value="CHILD">کودک</option><option value="HOUSEKEEPING">خدماتی</option></select></label><label><span>شیفت آگهی</span><select value={filters.shiftType} onChange={e=>setFilters(x=>({...x,shiftType:e.target.value}))}><option value="">همه شیفت‌ها</option><option value="DAY">روزانه</option><option value="NIGHT">شبانه</option><option value="LIVE_IN">شبانه‌روزی</option><option value="TEMPORARY">مقطعی</option></select></label><label><span>مشاور آگهی</span><select value={filters.consultantId} onChange={e=>setFilters(x=>({...x,consultantId:e.target.value}))}><option value="">همه مشاوران</option>{consultants.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select></label><div className="ja-v4-filter-actions"><button type="button" className="da-btn primary" onClick={apply}>اعمال فیلتر</button><button type="button" className="da-btn soft" onClick={clear}>پاک‌کردن</button></div></div></section><JobAdsPageV3 key={`job-ads-v4-${revision}`} notify={notify}/>{pagination.total>0&&<nav className="ja-v4-pagination" aria-label="صفحه‌بندی بانک آگهی‌ها"><button type="button" disabled={!pagination.hasPrevious} onClick={()=>goPage(pagination.page-1)}>قبلی</button><span><strong>صفحه {pagination.page.toLocaleString("fa-IR")} از {pagination.totalPages.toLocaleString("fa-IR")}</strong><small>{pagination.total.toLocaleString("fa-IR")} آگهی • {PAGE_SIZE.toLocaleString("fa-IR")} ردیف در هر صفحه</small></span><button type="button" disabled={!pagination.hasNext} onClick={()=>goPage(pagination.page+1)}>بعدی</button></nav>}</div>;
}
