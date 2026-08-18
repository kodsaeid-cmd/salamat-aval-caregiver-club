import React,{useEffect,useState} from "react";
import {CaregiverJobAdsPage as CaregiverJobAdsBase} from "./caregiver-job-ads-v1";
import {Notify} from "./caregiver-core-v2";
import "./job-ad-pagination-v1.css";

type Pagination={page:number;pageSize:number;total:number;totalPages:number;hasNext:boolean;hasPrevious:boolean};
const DEFAULT_PAGINATION:Pagination={page:1,pageSize:20,total:0,totalPages:1,hasNext:false,hasPrevious:false};
const PAGE_SIZE=20,PAGINATION_EVENT="salamat-caregiver-job-ads-pagination-v1";
let activePage=1,lastSignature="";
let originalFetch:typeof window.fetch|undefined;

function exactCaregiverJobAds(input:RequestInfo|URL){try{const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin);return url.origin===location.origin&&url.pathname==="/api/caregiver/job-ads"?url:null}catch{return null}}
function ensureInterceptor(){
 if(originalFetch||typeof window==="undefined")return;
 originalFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=exactCaregiverJobAds(input);if(!url||String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()!=="GET")return originalFetch!(input,init);
  const signature=url.toString();if(lastSignature&&lastSignature!==signature)activePage=1;lastSignature=signature;
  const response=input instanceof Request?await originalFetch!(input,init):await originalFetch!(input,init);
  if(!response.ok||!(response.headers.get("content-type")||"").includes("application/json"))return response;
  const payload:any=await response.clone().json().catch(()=>null);if(!Array.isArray(payload?.data?.ads))return response;
  const all=payload.data.ads,total=all.length,totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE)),page=Math.min(Math.max(1,activePage),totalPages),start=(page-1)*PAGE_SIZE;
  activePage=page;payload.data.ads=all.slice(start,start+PAGE_SIZE);payload.data.pagination={page,pageSize:PAGE_SIZE,total,totalPages,hasNext:page<totalPages,hasPrevious:page>1};
  window.dispatchEvent(new CustomEvent(PAGINATION_EVENT,{detail:payload.data.pagination}));
  const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","private, no-store, max-age=0");
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
 }) as typeof window.fetch;
}

export function CaregiverJobAdsPaginationV1({notify}:{notify:Notify}){
 ensureInterceptor();
 const [pagination,setPagination]=useState<Pagination>(DEFAULT_PAGINATION),[listVisible,setListVisible]=useState(false);
 useEffect(()=>{const syncPage=(event:Event)=>setPagination((event as CustomEvent<Pagination>).detail||DEFAULT_PAGINATION);const syncList=()=>setListVisible(Boolean(document.querySelector(".cja-list")));window.addEventListener(PAGINATION_EVENT,syncPage);const observer=new MutationObserver(syncList);observer.observe(document.body,{childList:true,subtree:true});syncList();return()=>{window.removeEventListener(PAGINATION_EVENT,syncPage);observer.disconnect();activePage=1;lastSignature=""}},[]);
 const goPage=(next:number)=>{if(next<1||next>pagination.totalPages||next===pagination.page)return;activePage=next;document.querySelector<HTMLFormElement>(".cja-search")?.requestSubmit();window.scrollTo({top:0,behavior:"smooth"})};
 return <div className="job-ad-pagination-owner"><CaregiverJobAdsBase notify={notify}/>{listVisible&&pagination.total>0&&<nav className="job-ad-pagination" aria-label="صفحه‌بندی آگهی‌های مراقبت"><button type="button" disabled={!pagination.hasPrevious} onClick={()=>goPage(pagination.page-1)}>قبلی</button><span>صفحه {pagination.page.toLocaleString("fa-IR")} از {pagination.totalPages.toLocaleString("fa-IR")}<small>{pagination.total.toLocaleString("fa-IR")} آگهی • {PAGE_SIZE.toLocaleString("fa-IR")} مورد در هر صفحه</small></span><button type="button" disabled={!pagination.hasNext} onClick={()=>goPage(pagination.page+1)}>بعدی</button></nav>}</div>;
}
