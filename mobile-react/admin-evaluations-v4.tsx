import React,{FormEvent,useEffect,useRef,useState} from "react";
import {ArrowDownUp,Filter,RotateCcw,X} from "lucide-react";
import {AdminEvaluationsMobileV3} from "./admin-evaluations-v3";
import "./admin-evaluations-v4.css";

type SortKey="evaluation_recent"|"evaluation_oldest"|"score_desc"|"stars_desc";
type FilterState={sort:SortKey;specialty:string;gender:string};
const defaults:FilterState={sort:"evaluation_recent",specialty:"",gender:""};
const sortLabel:Record<SortKey,string>={evaluation_recent:"آخرین ارزیابی → اولین",evaluation_oldest:"اولین/قدیمی‌ترین → آخرین",score_desc:"بالاترین امتیاز → کمترین",stars_desc:"بیشترین ستاره → کمترین"};

function patchDirectoryUrl(raw:string,state:FilterState){const url=new URL(raw,location.origin);if(url.origin!==location.origin||url.pathname!=="/api/admin/caregivers-page")return null;url.searchParams.set("sort",state.sort);const specialty=state.specialty.trim();if(specialty)url.searchParams.set("specialty",specialty);else url.searchParams.delete("specialty");if(state.gender)url.searchParams.set("gender",state.gender);else url.searchParams.delete("gender");return url}

export function AdminEvaluationsMobileV4({user,onExit}:{user:any;onExit:()=>void}){
 const [mode,setMode]=useState<""|"sort"|"filter">(""),[draft,setDraft]=useState<FilterState>(defaults),[applied,setApplied]=useState<FilterState>(defaults),[version,setVersion]=useState(0);
 const appliedRef=useRef(applied);appliedRef.current=applied;
 useEffect(()=>{const nativeFetch=window.fetch.bind(window);const patched:typeof window.fetch=async(input,init)=>{const raw=typeof input==="string"?input:input instanceof URL?input.toString():input.url;const url=patchDirectoryUrl(raw,appliedRef.current);if(!url)return nativeFetch(input as RequestInfo|URL,init);if(typeof input==="string"||input instanceof URL)return nativeFetch(url.toString(),init);return nativeFetch(new Request(url.toString(),input),init)};window.fetch=patched;return()=>{if(window.fetch===patched)window.fetch=nativeFetch as typeof window.fetch}},[]);
 const applySort=(event:FormEvent)=>{event.preventDefault();const next={...applied,sort:draft.sort};setApplied(next);setDraft(next);setMode("");setVersion(v=>v+1)};
 const applyFilter=(event:FormEvent)=>{event.preventDefault();const next={...applied,specialty:draft.specialty.trim(),gender:draft.gender};setApplied(next);setDraft(next);setMode("");setVersion(v=>v+1)};
 const resetFilter=()=>{const next={...applied,specialty:"",gender:""};setApplied(next);setDraft(next);setMode("");setVersion(v=>v+1)};
 const activeFilters=Number(Boolean(applied.specialty))+Number(Boolean(applied.gender));
 return <div className="mae-v4-shell">
  <AdminEvaluationsMobileV3 key={version} user={user} onExit={onExit}/>
  <div className="mae-v4-controls" aria-label="کنترل نمایش پرونده‌های ارزیابی"><button type="button" className={mode==="sort"?"active":""} onClick={()=>setMode(v=>v==="sort"?"":"sort")}><ArrowDownUp size={17}/><span>مرتب‌سازی</span></button><button type="button" className={mode==="filter"||activeFilters?"active":""} onClick={()=>setMode(v=>v==="filter"?"":"filter")}><Filter size={17}/><span>فیلتر</span>{activeFilters>0&&<b>{activeFilters.toLocaleString("fa-IR")}</b>}</button></div>
  {mode&&<div className="mae-v4-backdrop" onClick={()=>setMode("")}><section className="mae-v4-sheet" onClick={e=>e.stopPropagation()}><header><div><strong>{mode==="sort"?"مرتب‌سازی پرونده‌ها":"فیلتر پرونده‌ها"}</strong><small>{mode==="sort"?sortLabel[applied.sort]:activeFilters?`${activeFilters.toLocaleString("fa-IR")} فیلتر فعال`:"همه مراقبین"}</small></div><button type="button" onClick={()=>setMode("")}><X size={19}/></button></header>{mode==="sort"?<form onSubmit={applySort}><label><span>ترتیب نمایش</span><select value={draft.sort} onChange={e=>setDraft(v=>({...v,sort:e.target.value as SortKey}))}><option value="evaluation_recent">آخرین ارزیابی → اولین ارزیابی</option><option value="evaluation_oldest">اولین/قدیمی‌ترین ارزیابی → آخرین ارزیابی</option><option value="score_desc">بالاترین امتیاز → کمترین امتیاز</option><option value="stars_desc">بیشترین ستاره → کمترین ستاره</option></select></label><p>پرونده‌های بدون ارزیابی در مرتب‌سازی تاریخی، پس از پرونده‌های دارای ارزیابی قرار می‌گیرند.</p><button className="mae-v4-apply"><ArrowDownUp size={16}/>اعمال مرتب‌سازی</button></form>:<form onSubmit={applyFilter}><label><span>تخصص مراقب</span><input value={draft.specialty} onChange={e=>setDraft(v=>({...v,specialty:e.target.value}))} placeholder="سالمند، بیمار، کودک..."/></label><label><span>جنسیت مراقب</span><select value={draft.gender} onChange={e=>setDraft(v=>({...v,gender:e.target.value}))}><option value="">همه جنسیت‌ها</option><option value="female">زن</option><option value="male">مرد</option><option value="unknown">نامشخص</option></select></label><div className="mae-v4-sheet-actions"><button type="button" onClick={resetFilter}><RotateCcw size={15}/>پاک‌کردن</button><button className="mae-v4-apply"><Filter size={15}/>اعمال فیلتر</button></div></form>}</section></div>}
 </div>
}
