import React,{useEffect,useState} from "react";
import {AdminJobAdsMobileV4} from "./admin-job-ads-v4";
import "./job-ad-pagination-v1.css";

type Notify=(message:string,tone?:"success"|"error"|"info")=>void;
type Pagination={page:number;pageSize:number;total:number;totalPages:number;hasNext:boolean;hasPrevious:boolean};
const DEFAULT_PAGINATION:Pagination={page:1,pageSize:20,total:0,totalPages:1,hasNext:false,hasPrevious:false};
const PAGE_SIZE=20,PAGINATION_EVENT="salamat-mobile-admin-job-ads-pagination-v1";
let activePage=1,lastSignature="",requestSerial=0,activeApplicantStage="";
let originalFetch:typeof window.fetch|undefined;

function exactStaffJobAds(input:RequestInfo|URL){try{const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin);return url.origin===location.origin&&url.pathname==="/api/staff/job-ads"?url:null}catch{return null}}
function filterSignature(url:URL){const entries=[...url.searchParams.entries()].filter(([key])=>key!=="page"&&key!=="pageSize").sort(([ak,av],[bk,bv])=>ak===bk?av.localeCompare(bv):ak.localeCompare(bk));return JSON.stringify(entries)}
function ensureInterceptor(){
 if(originalFetch||typeof window==="undefined")return;
 originalFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=exactStaffJobAds(input);if(!url||String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()!=="GET")return originalFetch!(input,init);
  if(activeApplicantStage)url.searchParams.set("applicantStage",activeApplicantStage);else url.searchParams.delete("applicantStage");
  const signature=filterSignature(url);if(lastSignature&&lastSignature!==signature)activePage=1;lastSignature=signature;
  const requestedPage=activePage,serial=++requestSerial;url.searchParams.set("page",String(requestedPage));url.searchParams.set("pageSize",String(PAGE_SIZE));
  const response=input instanceof Request?await originalFetch!(new Request(url.toString(),input),init):await originalFetch!(url.toString(),init);
  void response.clone().json().then((payload:any)=>{if(serial!==requestSerial)return;const info=payload?.data?.pagination||payload?.pagination;if(info){activePage=Math.max(1,Number(info.page||requestedPage));window.dispatchEvent(new CustomEvent(PAGINATION_EVENT,{detail:info}))}}).catch(()=>undefined);
  return response;
 }) as typeof window.fetch;
}
function submitVisibleJobList(attempt=0){const form=document.querySelector<HTMLFormElement>(".maj-toolbar form");if(form){form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));return}if(attempt<5)requestAnimationFrame(()=>submitVisibleJobList(attempt+1))}

export function AdminJobAdsMobilePaginationV1({access,onExit,notify}:{access:any;onExit:()=>void;notify:Notify}){
 ensureInterceptor();
 const [pagination,setPagination]=useState<Pagination>(DEFAULT_PAGINATION),[listVisible,setListVisible]=useState(false),[applicantStage,setApplicantStage]=useState("");
 useEffect(()=>{const syncPage=(event:Event)=>setPagination((event as CustomEvent<Pagination>).detail||DEFAULT_PAGINATION);const syncList=()=>setListVisible(Boolean(document.querySelector(".maj-ad-list")));window.addEventListener(PAGINATION_EVENT,syncPage);const observer=new MutationObserver(syncList);observer.observe(document.body,{childList:true,subtree:true});syncList();return()=>{window.removeEventListener(PAGINATION_EVENT,syncPage);observer.disconnect();activePage=1;activeApplicantStage="";lastSignature="";requestSerial++}},[]);
 const changeApplicantStage=(value:string)=>{setApplicantStage(value);activeApplicantStage=value;activePage=1;lastSignature="";requestSerial++;setPagination(DEFAULT_PAGINATION);submitVisibleJobList()};
 const goPage=(next:number)=>{if(next<1||next>pagination.totalPages||next===pagination.page)return;activePage=next;setPagination(current=>({...current,page:next,hasPrevious:next>1,hasNext:next<current.totalPages}));submitVisibleJobList();window.scrollTo({top:0,behavior:"smooth"})};
 return <div className="job-ad-pagination-owner">{listVisible&&<div className="job-ad-stage-filter"><label><span>وضعیت متقاضی پرونده</span><select aria-label="فیلتر وضعیت متقاضی پرونده" value={applicantStage} onChange={e=>changeApplicantStage(e.target.value)}><option value="">همه وضعیت‌های متقاضی</option><option value="REQUESTED">فقط درخواست مراقب</option><option value="DISPATCH">متقاضی در اعزام</option><option value="CONTRACT">متقاضی در قرارداد</option></select></label></div>}<AdminJobAdsMobileV4 access={access} onExit={onExit} notify={notify}/>{listVisible&&pagination.total>0&&<nav className="job-ad-pagination" aria-label="صفحه‌بندی بانک آگهی‌ها"><button type="button" disabled={!pagination.hasPrevious} onClick={()=>goPage(pagination.page-1)}>قبلی</button><span>صفحه {pagination.page.toLocaleString("fa-IR")} از {pagination.totalPages.toLocaleString("fa-IR")}<small>{pagination.total.toLocaleString("fa-IR")} آگهی • {PAGE_SIZE.toLocaleString("fa-IR")} مورد در هر صفحه</small></span><button type="button" disabled={!pagination.hasNext} onClick={()=>goPage(pagination.page+1)}>بعدی</button></nav>}</div>;
}
