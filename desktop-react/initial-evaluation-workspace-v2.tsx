import React,{useEffect,useState} from "react";
import {ClipboardCheck,Search,ShieldCheck} from "lucide-react";
import {api,Card,ErrorState,fa,initials,Loading,Modal,Notify,text} from "./core";
import {InitialEvaluationTab} from "./initial-evaluation-tab-v1";

const caregiverIdOf=(value:any)=>String(value?.id||value?.caregiverId||value?.caregiver_id||value?.profileId||"").trim();
const listFromPayload=(payload:any)=>{const d=payload?.data??payload??{};if(Array.isArray(d))return d;if(Array.isArray(d.items))return d.items;if(Array.isArray(d.caregivers))return d.caregivers;if(Array.isArray(d.rows))return d.rows;return []};
const paginationFromPayload=(payload:any)=>{const d=payload?.data??payload??{};return d.pagination||payload?.pagination||{}};

export function InitialEvaluationWorkspaceV2({notify}:{notify:Notify}){
 const [access,setAccess]=useState<any>(null),[rows,setRows]=useState<any[]>([]),[query,setQuery]=useState(""),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[page,setPage]=useState(1),[pagination,setPagination]=useState<any>({});
 useEffect(()=>{void api("/api/staff/initial-evaluations/access").then((p:any)=>setAccess(p.data||null)).catch((e:any)=>{setAccess({allowed:false});setError(e.message)})},[]);
 const load=async(next=page)=>{setLoading(true);setError("");try{const q=new URLSearchParams({page:String(next)});if(query.trim())q.set("q",query.trim());const p:any=await api(`/api/admin/caregivers-page?${q}`);setRows(listFromPayload(p));setPagination(paginationFromPayload(p));setPage(next)}catch(e:any){setRows([]);setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{if(access?.allowed)void load(1)},[access?.allowed]);
 if(access===null)return <Loading label="در حال بررسی دسترسی ارزیابی بدوی..."/>;
 if(!access?.allowed)return <Card><div style={{display:"flex",alignItems:"center",gap:10}}><ShieldCheck size={20}/><div><strong>ارزیابی بدوی محرمانه است</strong><p>برای استفاده از این بخش باید مدیر سامانه اختیار ارزیابی بدوی را به حساب شما بدهد.</p></div></div></Card>;
 const totalPages=Math.max(1,Number(pagination.totalPages||pagination.pages||1));
 return <div className="da-stack">
  <Card><form className="da-toolbar" onSubmit={event=>{event.preventDefault();void load(1)}}><div className="da-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی مراقب برای ارزیابی بدوی"/></div><button className="da-btn soft">جست‌وجو</button></form></Card>
  {error?<ErrorState message={error} retry={()=>load(page)}/>:loading?<Loading/>:<Card><div className="da-table-wrap"><table className="da-table"><thead><tr><th>مراقب</th><th>شماره پرونده</th><th>موبایل</th><th>سطح</th><th></th></tr></thead><tbody>{rows.map((caregiver,index)=>{const id=caregiverIdOf(caregiver)||String(index);return <tr key={id} onClick={()=>setSelected({...caregiver,id})} style={{cursor:"pointer"}}><td><div className="da-person-cell"><span>{initials(caregiver.fullName)}</span><strong>{text(caregiver.fullName,"مراقب")}</strong></div></td><td>{text(caregiver.membershipCode)}</td><td>{text(caregiver.mobile)}</td><td>{text(caregiver.professionalLevel,"—")}</td><td><button type="button" className="da-btn primary" onClick={event=>{event.stopPropagation();setSelected({...caregiver,id})}}><ClipboardCheck size={16}/>ارزیابی بدوی</button></td></tr>})}</tbody></table></div><div className="da-pager"><button disabled={page<=1} onClick={()=>void load(page-1)}>قبلی</button><span>{fa(pagination.total||rows.length)} پرونده</span><button disabled={page>=totalPages} onClick={()=>void load(page+1)}>بعدی</button></div></Card>}
  {selected&&<Modal title={`ارزیابی بدوی • ${text(selected.fullName,"مراقب")}`} subtitle="فرم ارزیابی در صفحه مستقل باز شده و پس از بستن به فهرست مراقبین بازمی‌گردید." onClose={()=>setSelected(null)} wide><InitialEvaluationTab caregiverId={selected.id} initialAccess={access} notify={notify}/></Modal>}
 </div>;
}
