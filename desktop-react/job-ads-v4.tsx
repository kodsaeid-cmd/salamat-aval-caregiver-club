import React,{useEffect,useMemo,useState} from "react";
import {SlidersHorizontal} from "lucide-react";
import {api,Notify} from "./core";
import {JobAdsPage as JobAdsPageV3} from "./job-ads-v3";
import "./job-ads-v4.css";

type ExtraFilters={sort:string;contractType:string;shiftType:string;consultantId:string;applicantStage:string};
type Pagination={page:number;pageSize:number;total:number;totalPages:number;hasNext:boolean;hasPrevious:boolean};
const DEFAULT_FILTERS:ExtraFilters={sort:"newest",contractType:"",shiftType:"",consultantId:"",applicantStage:""};
const DEFAULT_PAGINATION:Pagination={page:1,pageSize:20,total:0,totalPages:1,hasNext:false,hasPrevious:false};
const PAGE_SIZE=20,PAGINATION_EVENT="salamat-job-ads-pagination-v1";
let activeFilters:ExtraFilters=DEFAULT_FILTERS;
let activePage=1,lastListSignature="",requestSerial=0,forcedPage:number|null=null;
let stableFilterParams=new URLSearchParams();
let originalFetch:typeof window.fetch|undefined;

function exactStaffJobAds(input:RequestInfo|URL){
 try{const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin);return url.origin===location.origin&&url.pathname==="/api/staff/job-ads"?url:null}catch{return null}
}
function filterSignature(url:URL){
 const entries=[...url.searchParams.entries()].filter(([key])=>key!=="page"&&key!=="pageSize").sort(([ak,av],[bk,bv])=>ak===bk?av.localeCompare(bv):ak.localeCompare(bk));
 return JSON.stringify(entries);
}
function cloneFilterParams(url:URL){
 const next=new URLSearchParams();for(const [key,value] of url.searchParams.entries())if(key!=="page"&&key!=="pageSize")next.append(key,value);return next;
}
function restoreStableFilterParams(url:URL){
 url.search="";for(const [key,value] of stableFilterParams.entries())url.searchParams.append(key,value);
}
function ensureInterceptor(){
 if(originalFetch||typeof window==="undefined")return;
 originalFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=exactStaffJobAds(input);if(!url||String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()!=="GET")return originalFetch!(input,init);
  const paging=forcedPage!==null;
  if(paging&&stableFilterParams.toString())restoreStableFilterParams(url);
  else{
   for(const [key,value] of Object.entries(activeFilters)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)}
   const signature=filterSignature(url);if(lastListSignature&&lastListSignature!==signature)activePage=1;lastListSignature=signature;stableFilterParams=cloneFilterParams(url);
  }
  const requestedPage=paging?Math.max(1,Number(forcedPage||1)):activePage,serial=++requestSerial;url.searchParams.set("page",String(requestedPage));url.searchParams.set("pageSize",String(PAGE_SIZE));
  const response=input instanceof Request?await originalFetch!(new Request(url.toString(),input),init):await originalFetch!(url.toString(),init);
  void response.clone().json().then((payload:any)=>{if(serial!==requestSerial)return;const info=payload?.data?.pagination||payload?.pagination;if(info){activePage=Math.max(1,Number(info.page||requestedPage));if(paging)forcedPage=null;window.dispatchEvent(new CustomEvent(PAGINATION_EVENT,{detail:info}))}}).catch(()=>{if(paging)forcedPage=null});
  return response;
 }) as typeof window.fetch;
}
function submitVisibleJobList(attempt=0){
 const form=document.querySelector<HTMLFormElement>(".ja-toolbar form");
 if(form){if(typeof form.requestSubmit==="function")form.requestSubmit();else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));return;}
 if(attempt<5)requestAnimationFrame(()=>submitVisibleJobList(attempt+1));
}

export function JobAdsPage({notify}:{notify:Notify}){
 ensureInterceptor();
 const [filters,setFilters]=useState<ExtraFilters>(DEFAULT_FILTERS),[consultants,setConsultants]=useState<any[]>([]),[pagination,setPagination]=useState<Pagination>(DEFAULT_PAGINATION);
 useEffect(()=>{const sync=(event:Event)=>setPagination((event as CustomEvent<Pagination>).detail||DEFAULT_PAGINATION);window.addEventListener(PAGINATION_EVENT,sync);return()=>{window.removeEventListener(PAGINATION_EVENT,sync);activeFilters=DEFAULT_FILTERS;activePage=1;forcedPage=null;stableFilterParams=new URLSearchParams();lastListSignature="";requestSerial++}},[]);
 useEffect(()=>{api<any>("/api/staff/job-ads/consultants?q=").then(p=>setConsultants(p.data?.consultants||[])).catch(()=>setConsultants([]))},[]);
 const reloadFromFirstPage=()=>{activePage=1;forcedPage=null;stableFilterParams=new URLSearchParams();lastListSignature="";requestSerial++;setPagination(DEFAULT_PAGINATION);submitVisibleJobList()};
 const apply=()=>{activeFilters={...filters};reloadFromFirstPage()};
 const clear=()=>{const next={...DEFAULT_FILTERS};setFilters(next);activeFilters=next;reloadFromFirstPage()};
 const goPage=(next:number)=>{if(next<1||next>pagination.totalPages||next===pagination.page)return;activePage=next;forcedPage=next;requestSerial++;setPagination(current=>({...current,page:next,hasPrevious:next>1,hasNext:next<current.totalPages}));submitVisibleJobList();window.scrollTo({top:0,behavior:"smooth"})};
 const activeCount=useMemo(()=>[filters.contractType,filters.shiftType,filters.consultantId,filters.applicantStage,filters.sort!=="newest"?filters.sort:""].filter(Boolean).length,[filters]);
 return <div className="ja-v4-owner"><section className="ja-v4-filterbar"><div className="ja-v4-filter-title"><SlidersHorizontal size={18}/><div><strong>فیلتر و ترتیب بانک آگهی‌ها</strong><small>{activeCount?`${activeCount.toLocaleString("fa-IR")} فیلتر فعال`:"نمایش پیش‌فرض: جدیدترین آگهی‌ها"}</small></div></div><div className="ja-v4-filter-grid"><label><span>ترتیب نمایش</span><select value={filters.sort} onChange={e=>setFilters(x=>({...x,sort:e.target.value}))}><option value="newest">جدیدترین آگهی</option><option value="oldest">قدیمی‌ترین آگهی</option><option value="points_desc">بالاترین امتیاز</option><option value="points_asc">پایین‌ترین امتیاز</option></select></label><label><span>نوع آگهی</span><select value={filters.contractType} onChange={e=>setFilters(x=>({...x,contractType:e.target.value}))}><option value="">همه انواع</option><option value="ELDERLY">سالمند</option><option value="PATIENT">بیمار</option><option value="CHILD">کودک</option><option value="HOUSEKEEPING">خدماتی</option></select></label><label><span>شیفت آگهی</span><select value={filters.shiftType} onChange={e=>setFilters(x=>({...x,shiftType:e.target.value}))}><option value="">همه شیفت‌ها</option><option value="DAY">روزانه</option><option value="NIGHT">شبانه</option><option value="LIVE_IN">شبانه‌روزی</option><option value="TEMPORARY">مقطعی</option></select></label><label><span>وضعیت متقاضی پرونده</span><select aria-label="فیلتر وضعیت متقاضی پرونده" value={filters.applicantStage} onChange={e=>setFilters(x=>({...x,applicantStage:e.target.value}))}><option value="">همه وضعیت‌های متقاضی</option><option value="REQUESTED">فقط درخواست مراقب</option><option value="DISPATCH">متقاضی در اعزام</option><option value="CONTRACT">متقاضی در قرارداد</option></select></label><label><span>مشاور آگهی</span><select value={filters.consultantId} onChange={e=>setFilters(x=>({...x,consultantId:e.target.value}))}><option value="">همه مشاوران</option>{consultants.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select></label><div className="ja-v4-filter-actions"><button type="button" className="da-btn primary" onClick={apply}>اعمال فیلتر</button><button type="button" className="da-btn soft" onClick={clear}>پاک‌کردن</button></div></div></section><JobAdsPageV3 notify={notify}/>{pagination.total>0&&<nav className="ja-v4-pagination" aria-label="صفحه‌بندی بانک آگهی‌ها"><button type="button" disabled={!pagination.hasPrevious} onClick={()=>goPage(pagination.page-1)}>قبلی</button><span><strong>صفحه {pagination.page.toLocaleString("fa-IR")} از {pagination.totalPages.toLocaleString("fa-IR")}</strong><small>{pagination.total.toLocaleString("fa-IR")} آگهی • {PAGE_SIZE.toLocaleString("fa-IR")} ردیف در هر صفحه</small></span><button type="button" disabled={!pagination.hasNext} onClick={()=>goPage(pagination.page+1)}>بعدی</button></nav>}</div>;
}
