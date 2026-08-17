import React,{useEffect,useState} from "react";
import {BookOpen,Search} from "lucide-react";
import {api,Card,ErrorState,fa,initials,Loading,Modal,Notify,text} from "./core";
import {TrainingExamResultsPanel} from "./training-exam-results-v1";

const caregiverIdOf=(value:any)=>String(value?.id||value?.caregiverId||value?.caregiver_id||value?.profileId||"").trim();
const listFromPayload=(payload:any)=>{const d=payload?.data??payload??{};if(Array.isArray(d))return d;if(Array.isArray(d.items))return d.items;if(Array.isArray(d.caregivers))return d.caregivers;if(Array.isArray(d.rows))return d.rows;return []};
const paginationFromPayload=(payload:any)=>{const d=payload?.data??payload??{};return d.pagination||payload?.pagination||{}};

export function TrainingExamEvaluationPanelV2({access,notify}:{access:any;notify:Notify}){
 const [query,setQuery]=useState(""),[rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[page,setPage]=useState(1),[pagination,setPagination]=useState<any>({});
 const load=async(next=page)=>{setLoading(true);setError("");try{const params=new URLSearchParams({page:String(next)});if(query.trim())params.set("q",query.trim());const p:any=await api(`/api/admin/caregivers-page?${params}`);setRows(listFromPayload(p));setPagination(paginationFromPayload(p));setPage(next)}catch(e:any){setRows([]);setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{void load(1)},[]);
 const totalPages=Math.max(1,Number(pagination.totalPages||pagination.pages||1));
 return <div className="da-stack">
  <Card><div className="da-card-head"><div><h3>ارزیابی آموزش</h3><p>فهرست مراقبین مطابق ارزیابی حرفه‌ای است؛ روی هر سطر کلیک کنید تا صفحه ثبت نتیجه آزمون باز شود.</p></div><BookOpen size={22}/></div><form className="da-toolbar" onSubmit={event=>{event.preventDefault();void load(1)}}><div className="da-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی مراقب برای ارزیابی آموزش"/></div><button className="da-btn soft">جست‌وجو</button></form></Card>
  {error?<ErrorState message={error} retry={()=>load(page)}/>:loading?<Loading label="در حال دریافت مراقبین..."/>:<Card><div className="da-table-wrap"><table className="da-table"><thead><tr><th>مراقب</th><th>شماره پرونده</th><th>موبایل</th><th>سطح</th><th></th></tr></thead><tbody>{rows.map((caregiver,index)=>{const id=caregiverIdOf(caregiver)||String(index);return <tr key={id} onClick={()=>setSelected({...caregiver,id})} style={{cursor:"pointer"}}><td><div className="da-person-cell"><span>{initials(caregiver.fullName)}</span><strong>{text(caregiver.fullName,"مراقب")}</strong></div></td><td>{text(caregiver.membershipCode)}</td><td>{text(caregiver.mobile)}</td><td>{text(caregiver.professionalLevel,"—")}</td><td><button type="button" className="da-btn primary" onClick={event=>{event.stopPropagation();setSelected({...caregiver,id})}}><BookOpen size={16}/>ارزیابی آموزش</button></td></tr>})}</tbody></table></div><div className="da-pager"><button disabled={page<=1} onClick={()=>void load(page-1)}>قبلی</button><span>{fa(pagination.total||rows.length)} پرونده</span><button disabled={page>=totalPages} onClick={()=>void load(page+1)}>بعدی</button></div></Card>}
  {selected&&<Modal title={`ارزیابی آموزش • ${text(selected.fullName,"مراقب")}`} subtitle="ثبت نتیجه آزمون در صفحه مستقل انجام می‌شود و تاریخچه نتایج قبلی حفظ خواهد شد." onClose={()=>setSelected(null)} wide><TrainingExamResultsPanel caregiverId={selected.id} access={access} notify={notify} editable/></Modal>}
 </div>;
}
