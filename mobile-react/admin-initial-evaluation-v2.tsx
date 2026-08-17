import React,{FormEvent,useEffect,useState} from "react";
import {Search,ShieldCheck} from "lucide-react";
import {InitialEvaluationFormV2,InitialNotify} from "../shared/initial-evaluation-v2";

async function api(path:string){const response=await fetch(path,{credentials:"same-origin",cache:"no-store"}),raw=await response.text();let payload:any={};try{payload=raw?JSON.parse(raw):{}}catch{}if(!response.ok)throw new Error(payload.message||`خطای ${response.status}`);return payload}
const text=(value:unknown,fallback="—")=>String(value??"").trim()||fallback;
export function AdminInitialEvaluationMobileV2({notify}:{notify:InitialNotify}){
 const [access,setAccess]=useState<any>(null),[rows,setRows]=useState<any[]>([]),[query,setQuery]=useState(""),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(false);
 useEffect(()=>{void api("/api/staff/initial-evaluations/access").then(p=>setAccess(p.data||null)).catch((e:any)=>notify(e.message,"error"))},[]);
 const search=async(event?:FormEvent)=>{event?.preventDefault();setLoading(true);try{const q=new URLSearchParams({page:"1",pageSize:"25",sort:"name_asc"});if(query.trim())q.set("q",query.trim());const p=await api(`/api/admin/caregivers-page?${q}`);setRows(p.data?.items||[])}catch(e:any){notify(e.message,"error")}finally{setLoading(false)}};
 useEffect(()=>{if(access?.allowed)void search()},[access?.allowed]);
 if(access===null)return <div className="ma-state"><strong>در حال بررسی دسترسی ارزیابی بدوی...</strong></div>;
 if(!access?.allowed)return <div className="ma-card" style={{display:"flex",gap:9,alignItems:"flex-start"}}><ShieldCheck size={20}/><div><strong>بخش محرمانه ارزیابی بدوی</strong><p>استفاده از این فرم نیازمند اختیار مدیر سامانه است.</p></div></div>;
 return <div style={{display:"grid",gap:10}}><section className="ma-card" style={{display:"grid",gap:9}}><strong>انتخاب مراقب</strong><form onSubmit={search} style={{display:"flex",gap:6}}><input style={{minWidth:0,flex:1}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام، موبایل یا کد ملی"/><button className="ma-btn primary" disabled={loading}><Search size={15}/></button></form><div style={{display:"grid",gap:6,maxHeight:240,overflow:"auto"}}>{rows.map(row=><button type="button" key={row.id} onClick={()=>setSelected(row)} style={{border:selected?.id===row.id?"1px solid #087443":"1px solid #dce8e2",background:selected?.id===row.id?"#eef8f3":"#fff",borderRadius:11,padding:"9px 10px",font:"inherit",textAlign:"right"}}><strong style={{display:"block",fontSize:11}}>{text(row.fullName,"مراقب")}</strong><small style={{display:"block",marginTop:3,color:"#74857d",fontSize:8}}>{text(row.mobile)} • {text(row.membershipCode||row.id)}</small></button>)}</div></section>{selected&&<InitialEvaluationFormV2 caregiverId={selected.id} initialAccess={access} notify={notify}/>}</div>
}
