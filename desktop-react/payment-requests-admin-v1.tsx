import React,{FormEvent,useEffect,useMemo,useState} from "react";
import {ArrowDownWideNarrow,ArrowUpWideNarrow,CheckCircle2,Clock3,Download,Search,XCircle} from "lucide-react";
import {api,can,Card,dateFa,Empty,fa,money,Notify,text} from "./core";
import {JalaliDateFilter} from "./jalali-date-filter-v1";
import "./payment-requests-admin-v1.css";

type SortKey="date_desc"|"date_asc"|"amount_desc"|"amount_asc";
type Row={id:string;source:"SETTLEMENT"|"CREDIT_REQUEST"|"REFERRAL_LOAN"|"RETENTION_REWARD";caregiverId:string;caregiverName:string;membershipCode:string;mobile:string;requestType:string;typeLabel:string;amountToman:number;requestedAt:string;sourceStatus:string;status:"WAITING"|"APPROVED"|"REJECTED";canApprove:boolean;canReject:boolean;detail?:string};
type Data={rows:Row[];summary:{total:number;waiting:number;approved:number;rejected:number;totalAmountToman:number};pagination:{page:number;pageSize:number;total:number;totalPages:number}};
const statusLabel={WAITING:"در انتظار",APPROVED:"تأیید",REJECTED:"رد"} as const;
const sortItems:[SortKey,string][]=[["date_desc","آخرین به اولین"],["date_asc","اولین به آخرین"],["amount_desc","بیشترین به کمترین"],["amount_asc","کمترین به بیشترین"]];
const xml=(value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");

function excelFile(rows:Row[]){
 const headers=["ردیف","نام مراقب","کد عضویت","موبایل","نوع تقاضا","مبلغ (تومان)","تاریخ تقاضا","وضعیت","جزئیات","شناسه"];
 const cell=(value:unknown,type:"String"|"Number"="String")=>`<Cell><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
 const body=rows.map((row,index)=>`<Row>${cell(index+1,"Number")}${cell(text(row.caregiverName))}${cell(text(row.membershipCode))}${cell(text(row.mobile))}${cell(row.typeLabel)}${cell(Number(row.amountToman||0),"Number")}${cell(dateFa(row.requestedAt))}${cell(statusLabel[row.status]||row.status)}${cell(text(row.detail,""))}${cell(row.id)}</Row>`).join("");
 const workbook=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="درخواست های پرداخت"><Table><Row>${headers.map(h=>cell(h)).join("")}</Row>${body}</Table></Worksheet></Workbook>`;
 const blob=new Blob(["\ufeff",workbook],{type:"application/vnd.ms-excel;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download="payment-requests-all.xls";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function PaymentRequestsAdmin({access,notify}:{access:any;notify:Notify}){
 const editable=can(access,"staff.financial_credits","update");
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(""),[exporting,setExporting]=useState(false),[sort,setSort]=useState<SortKey>("date_desc"),[page,setPage]=useState(1);
 const [draft,setDraft]=useState({q:"",from:"",to:""}),[filters,setFilters]=useState({q:"",from:"",to:""});
 const params=useMemo(()=>{const p=new URLSearchParams({page:String(page),pageSize:"50",sort});if(filters.q)p.set("q",filters.q);if(filters.from)p.set("from",filters.from);if(filters.to)p.set("to",filters.to);return p},[page,sort,filters]);
 const load=async()=>{setLoading(true);try{const response:any=await api(`/api/staff/financial-credits/payment-requests?${params}`);setData(response.data||null)}catch(e:any){notify(e.message||"دریافت درخواست‌های پرداخت انجام نشد.","error")}finally{setLoading(false)}};
 useEffect(()=>{void load()},[params.toString()]);
 const apply=(event:FormEvent)=>{event.preventDefault();if(draft.from&&draft.to&&draft.from>draft.to){notify("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.","error");return}setPage(1);setFilters({...draft})};
 const reset=()=>{setDraft({q:"",from:"",to:""});setFilters({q:"",from:"",to:""});setPage(1)};
 const changeSort=(next:SortKey)=>{setSort(next);setPage(1)};
 const action=async(row:Row,decision:"APPROVE"|"REJECT")=>{
  if(!editable)return;
  const initial=decision==="APPROVE"?"تأیید در تب درخواست‌های پرداخت":"";
  const reason=window.prompt(decision==="APPROVE"?"یادداشت تأیید را وارد کنید:":"دلیل رد را وارد کنید:",initial);
  if(reason===null)return;if(reason.trim().length<3){notify("یادداشت تصمیم باید حداقل ۳ کاراکتر باشد.","error");return}
  setBusy(`${row.source}:${row.id}:${decision}`);
  try{
   if(row.source==="SETTLEMENT")await api(`/api/staff/financial-credits/settlements/${encodeURIComponent(row.id)}`,{method:"PATCH",body:JSON.stringify({decision:decision==="APPROVE"?"APPROVED":"REJECTED",reason:reason.trim(),decisionNote:reason.trim()})});
   else if(row.source==="CREDIT_REQUEST")await api(`/api/staff/financial-credits/credit-requests/${encodeURIComponent(row.id)}`,{method:"PATCH",body:JSON.stringify({decision:decision==="APPROVE"?"APPROVED":"REJECTED",reason:reason.trim(),decisionNote:reason.trim()})});
   else if(row.source==="REFERRAL_LOAN")await api(`/api/staff/financial-credits/referrals/milestones/${encodeURIComponent(row.id)}`,{method:"PATCH",body:JSON.stringify({action:decision,note:reason.trim()})});
   else await api(`/api/staff/financial-credits/retention-rewards/${encodeURIComponent(row.id)}`,{method:"PATCH",body:JSON.stringify({action:decision,note:reason.trim()})});
   notify(decision==="APPROVE"?"درخواست تأیید شد.":"درخواست رد شد.","success");await load();
  }catch(e:any){notify(e.message||"ثبت تصمیم انجام نشد.","error")}finally{setBusy("")}
 };
 const exportAll=async()=>{
  if(exporting)return;setExporting(true);
  try{
   const all:Row[]=[];let current=1,totalPages=1;
   do{const p=new URLSearchParams({page:String(current),pageSize:"500",sort:"date_desc"});const response:any=await api(`/api/staff/financial-credits/payment-requests?${p}`),chunk=response.data?.rows||[];all.push(...chunk);totalPages=Math.max(1,Number(response.data?.pagination?.totalPages||1));current+=1}while(current<=totalPages);
   excelFile(all);notify(`خروجی اکسل ${fa(all.length)} رکورد آماده شد.`,"success");
  }catch(e:any){notify(e.message||"ساخت خروجی اکسل انجام نشد.","error")}finally{setExporting(false)}
 };
 const summary=data?.summary||{total:0,waiting:0,approved:0,rejected:0,totalAmountToman:0},rows=data?.rows||[],pagination=data?.pagination||{page:1,pageSize:50,total:0,totalPages:1};
 return <div className="da-stack prq-admin">
  <section className="da-metrics prq-metrics"><article className="da-metric"><small>کل درخواست‌ها</small><strong>{fa(summary.total)}</strong></article><article className="da-metric"><small>در انتظار</small><strong>{fa(summary.waiting)}</strong></article><article className="da-metric"><small>تأییدشده</small><strong>{fa(summary.approved)}</strong></article><article className="da-metric"><small>ردشده</small><strong>{fa(summary.rejected)}</strong></article><article className="da-metric"><small>جمع مبلغ درخواست‌ها</small><strong>{money(summary.totalAmountToman)}</strong></article></section>
  <Card className="prq-filter-card"><form className="prq-filter" onSubmit={apply}><div className="prq-filter-main"><label className="prq-search"><Search size={15}/><input value={draft.q} onChange={e=>setDraft(v=>({...v,q:e.target.value}))} placeholder="جستجو با نام مراقب، کد عضویت یا موبایل"/></label><JalaliDateFilter compact placeholder="از تاریخ شمسی" value={draft.from} onChange={value=>setDraft(v=>({...v,from:value}))}/><JalaliDateFilter compact placeholder="تا تاریخ شمسی" value={draft.to} onChange={value=>setDraft(v=>({...v,to:value}))}/><button className="da-btn primary prq-apply">اعمال فیلتر</button><button type="button" className="da-btn ghost prq-reset" onClick={reset}>پاک‌کردن</button><button type="button" className="da-btn soft prq-export" disabled={exporting} onClick={()=>void exportAll()}><Download size={14}/>{exporting?"در حال ساخت...":"خروجی اکسل همه رکوردها"}</button></div><div className="prq-sort" role="group" aria-label="مرتب‌سازی درخواست‌های پرداخت">{sortItems.map(([key,label])=><button type="button" key={key} className={sort===key?"active":""} onClick={()=>changeSort(key)}>{key.includes("desc")?<ArrowDownWideNarrow size={14}/>:<ArrowUpWideNarrow size={14}/>}<span>{label}</span></button>)}</div></form></Card>
  <Card><div className="da-card-head"><div><h3>درخواست‌های پرداخت</h3><p>تسویه کیف پول، درخواست‌های وام و درخواست‌های اتوماتیک واریز پاداش در یک صف یکپارچه نمایش داده می‌شوند.</p></div>{loading&&<span className="prq-loading"><Clock3 size={14}/>در حال به‌روزرسانی</span>}</div>{rows.length?<div className="da-table-wrap"><table className="da-table prq-table"><thead><tr><th>مراقب</th><th>نوع تقاضا</th><th>مبلغ</th><th>تاریخ تقاضا</th><th>وضعیت تقاضا</th><th>اقدام</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.source}:${row.id}`}><td><strong>{text(row.caregiverName)}</strong><small>{text(row.membershipCode)} • {text(row.mobile)}</small></td><td><strong>{row.typeLabel}</strong>{row.detail&&<small>{row.detail}</small>}</td><td><strong>{money(row.amountToman)}</strong></td><td>{dateFa(row.requestedAt)}</td><td><span className={`prq-status ${row.status.toLowerCase()}`}>{statusLabel[row.status]}</span><small>{row.sourceStatus==="WAITING_FRANCHISE"?"در انتظار ثبت فرانشیز":row.sourceStatus==="PAID"?"پرداخت نهایی ثبت شده":""}</small></td><td>{row.status==="WAITING"&&editable&&(row.canApprove||row.canReject)?<div className="prq-actions">{row.canReject&&<button type="button" className="reject" disabled={Boolean(busy)} onClick={()=>void action(row,"REJECT")}><XCircle size={14}/>رد</button>}{row.canApprove&&<button type="button" className="approve" disabled={Boolean(busy)} onClick={()=>void action(row,"APPROVE")}><CheckCircle2 size={14}/>تأیید</button>}</div>:<span className="prq-no-action">{row.status==="WAITING"?"در انتظار":"ثبت شده"}</span>}</td></tr>)}</tbody></table></div>:<Empty title="درخواستی با این فیلتر پیدا نشد" description="نام مراقب یا بازه تاریخ شمسی را تغییر دهید."/>}<div className="prq-pager"><button type="button" disabled={Number(pagination.page)<=1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))}>صفحه قبل</button><span>صفحه {fa(pagination.page)} از {fa(pagination.totalPages)} • {fa(pagination.total)} رکورد</span><button type="button" disabled={Number(pagination.page)>=Number(pagination.totalPages)||loading} onClick={()=>setPage(p=>p+1)}>صفحه بعد</button></div></Card>
 </div>
}
