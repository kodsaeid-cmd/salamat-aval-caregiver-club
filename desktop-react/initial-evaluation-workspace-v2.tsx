import React,{FormEvent,useEffect,useState} from "react";
import {Search,ShieldCheck} from "lucide-react";
import {api,Card,Notify,text} from "./core";
import {InitialEvaluationTab} from "./initial-evaluation-tab-v1";

export function InitialEvaluationWorkspaceV2({notify}:{notify:Notify}){
 const [access,setAccess]=useState<any>(null),[rows,setRows]=useState<any[]>([]),[query,setQuery]=useState(""),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(false);
 useEffect(()=>{void api("/api/staff/initial-evaluations/access").then((p:any)=>setAccess(p.data||null)).catch((e:any)=>notify(e.message,"error"))},[]);
 const search=async(event?:FormEvent)=>{event?.preventDefault();setLoading(true);try{const q=new URLSearchParams({page:"1",pageSize:"25",sort:"name_asc"});if(query.trim())q.set("q",query.trim());const p:any=await api(`/api/admin/caregivers-page?${q}`);setRows(p.data?.items||[])}catch(e:any){notify(e.message,"error")}finally{setLoading(false)}};
 useEffect(()=>{if(access?.allowed)void search()},[access?.allowed]);
 if(access===null)return <Card><p>در حال بررسی دسترسی ارزیابی بدوی...</p></Card>;
 if(!access?.allowed)return <Card><div style={{display:"flex",alignItems:"center",gap:10}}><ShieldCheck size={20}/><div><strong>ارزیابی بدوی محرمانه است</strong><p>برای استفاده از این بخش باید مدیر سامانه اختیار ارزیابی بدوی را به حساب شما بدهد.</p></div></div></Card>;
 return <div style={{display:"grid",gap:12}}>
  <Card><div style={{display:"grid",gap:10}}><div><strong>انتخاب مراقب برای ارزیابی بدوی</strong><p>نام، موبایل، کد ملی یا کد عضویت را جست‌وجو کنید.</p></div><form onSubmit={search} style={{display:"flex",gap:7}}><input style={{flex:1}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی مراقب"/><button className="da-btn primary" disabled={loading}><Search size={16}/>{loading?"در حال جست‌وجو...":"جست‌وجو"}</button></form><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{rows.map(row=><button type="button" key={row.id} onClick={()=>setSelected(row)} style={{textAlign:"right",border:selected?.id===row.id?"1px solid #087443":"1px solid #dce8e2",background:selected?.id===row.id?"#eef8f3":"#fff",borderRadius:12,padding:10,font:"inherit",cursor:"pointer"}}><strong style={{display:"block",fontSize:12}}>{text(row.fullName,"مراقب")}</strong><small style={{display:"block",marginTop:4,color:"#71827a"}}>{text(row.mobile)} • {text(row.membershipCode||row.id)}</small></button>)}</div></div></Card>
  {selected&&<InitialEvaluationTab caregiverId={selected.id} initialAccess={access} notify={notify}/>} 
 </div>;
}
