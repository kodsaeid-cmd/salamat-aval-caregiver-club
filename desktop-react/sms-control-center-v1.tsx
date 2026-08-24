import React,{useEffect,useMemo,useState} from "react";
import {Activity,AlertTriangle,CheckCircle2,Clock3,MessageSquareText,Pause,Play,RefreshCw,RotateCcw,Send,ServerCog,Smartphone} from "lucide-react";
import {api,Card,dateFa,Empty,ErrorState,fa,Loading,Notify,text} from "./core";
import "./sms-control-center-v1.css";

const kindFa:Record<string,string>={
 OTP:"رمز یکبارمصرف",
 CAREGIVER_CHANGE:"اعلان تغییرات مراقب",
 JOB_APPLICATION_STATUS_CHANGED:"تغییر وضعیت درخواست آگهی",
 JOB_APPLICATION_TO_CONSULTANT:"درخواست آگهی → مشاور فروش",
 PROFILE_ACTIVATED:"فعال‌سازی مراقب",
 CAREGIVER_ACTIVATED:"فعال‌سازی مراقب",
 JOB_BANK_REMINDER:"یادآوری بانک آگهی",
};
const queueTypeFa:Record<string,string>={ACTIVATION:"فعال‌سازی مراقب",JOB_BANK_REMINDER:"یادآوری بانک آگهی",JOB_STATUS:"تغییر وضعیت درخواست آگهی"};
const sendFa:Record<string,string>={SENT:"پذیرفته توسط SMS.ir",FAILED:"تلاش ناموفق",DEBUG:"آزمایشی"};
const outboxFa:Record<string,string>={PENDING:"در صف",QUEUED:"صف Cloudflare",PROCESSING:"در حال ارسال",SENT:"ارسال به SMS.ir",FAILED:"در انتظار تلاش مجدد",CANCELLED:"متوقف"};
const queueStateFa:Record<string,string>={PENDING:"در صف",QUEUED:"صف Cloudflare",PROCESSING:"در حال ارسال",SENT:"ارسال شد",RETRYING:"در انتظار تلاش مجدد",FINAL_FAILED:"ناموفق نهایی",CANCELLED:"متوقف"};

function readyLabel(value:any,yes:string,no:string,unknown="نامشخص"){return value===true?yes:value===false?no:unknown}
function providerReport(row:any){
 if(row?.providerDeliveryAt)return <span className="smsc-provider delivered"><CheckCircle2 size={14}/>زمان تحویل ثبت شده • {dateFa(row.providerDeliveryAt)}{row.providerStateText!=null?` • کد ${row.providerStateText}`:""}</span>;
 if(row?.lastCheckError)return <span className="smsc-provider failed"><AlertTriangle size={14}/>خطا در استعلام SMS.ir</span>;
 if(row?.providerStateText!=null)return <span className="smsc-provider reported"><Activity size={14}/>گزارش SMS.ir • کد {text(row.providerStateText)}</span>;
 if(String(row?.sendStatus).toUpperCase()==="SENT")return <span className="smsc-provider pending"><Clock3 size={14}/>در انتظار گزارش تحویل</span>;
 return <span className="smsc-provider muted">—</span>;
}

export function SmsControlCenterPage({notify}:{notify:Notify}){
 const [data,setData]=useState<any>(null),[readiness,setReadiness]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [busy,setBusy]=useState(""),[query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState("ALL"),[kindFilter,setKindFilter]=useState("ALL");
 const load=async()=>{setLoading(true);setError("");try{const [center,ready]:any=await Promise.all([api("/api/admin/sms-center?limit=250"),api("/api/system/sms-readiness")]);setData(center.data);setReadiness(ready.data)}catch(e:any){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const action=async(key:string,path:string,message:string)=>{setBusy(key);try{const result:any=await api(path,{method:"POST"});notify(message,"success");await load();return result}catch(e:any){notify(e.message,"error")}finally{setBusy("")}};
 const toggleJobBankReminder=async(enabled:boolean)=>{
  if(!enabled&&!window.confirm("ارسال خودکار پیامک «تعداد آگهی منتظر درخواست شماست» متوقف شود؟ پیام‌های این اتوماسیون که هنوز ارسال نشده‌اند نیز لغو می‌شوند."))return;
  const key="job-bank-reminder-control";setBusy(key);
  try{
   const result:any=await api("/api/admin/sms-center/automation/JOB_BANK_REMINDER",{method:"POST",body:JSON.stringify({enabled})});
   const cancelled=Number(result?.data?.cancelled||0);
   notify(enabled?"یادآوری خودکار بانک آگهی دوباره فعال شد.":`یادآوری خودکار بانک آگهی متوقف شد${cancelled?` و ${fa(cancelled)} پیام ارسال‌نشده لغو شد`:""}.`,"success");
   await load();
  }catch(e:any){notify(e.message,"error")}finally{setBusy("")}
 };
 const logs=useMemo(()=>{const q=query.trim().toLowerCase();return (data?.logs||[]).filter((row:any)=>{
  if(statusFilter!=="ALL"&&String(row.sendStatus)!==statusFilter)return false;
  if(kindFilter!=="ALL"&&String(row.messageKind)!==kindFilter)return false;
  if(!q)return true;
  return [row.messageKind,row.recipientName,row.recipientMobile,row.recipientRole,row.sourceCaregiverName,row.sourceCaregiverMobile,row.providerMessageId,row.errorCode,row.lastCheckError].some(v=>String(v||"").toLowerCase().includes(q));
 })},[data,query,statusFilter,kindFilter]);
 const kinds=useMemo(()=>[...new Set((data?.logs||[]).map((x:any)=>String(x.messageKind||"")).filter(Boolean))] as string[],[data]);
 if(error)return <ErrorState message={error} retry={load}/>;
 if(loading&&!data)return <Loading label="در حال دریافت وضعیت پیامک‌ها و SMS.ir..."/>;
 const s=data?.summary||{},a=s.activationEvents||{},r=readiness||{},queueCount=Number(s.pending||0)+Number(s.retrying||0)+Number(s.processing||0)+Number(s.automaticQueuePending||0),jobReminder=data?.automationControls?.jobBankReminder||{enabled:true};
 return <div className="smsc-page da-stack">
  <Card className="smsc-hero">
   <div className="smsc-hero-title"><span><MessageSquareText size={25}/></span><div><h2>مرکز کنترل پیامک</h2><p>ردیابی مسیر پیام از باشگاه تا SMS.ir و گزارش تحویل اپراتور</p></div></div>
   <div className="smsc-actions"><button className="da-btn ghost" disabled={Boolean(busy)} onClick={()=>void action("refresh","/api/admin/sms-center/refresh-delivery","گزارش‌های SMS.ir به‌روزرسانی شد.")}><RefreshCw size={16}/>{busy==="refresh"?"در حال استعلام...":"استعلام تحویل"}</button><button className="da-btn primary" disabled={Boolean(busy)} onClick={()=>void action("flush","/api/admin/sms-center/flush","صف‌های قابل پردازش پیامک اجرا شدند.")}><Send size={16}/>{busy==="flush"?"در حال پردازش...":"پردازش صف و Retry"}</button></div>
  </Card>

  <div className="smsc-health">
   <div className={r.providerReachable===true?"ok":r.providerReachable===false?"bad":"warn"}><ServerCog size={17}/><span>SMS.ir</span><strong>{readyLabel(r.providerReachable,"متصل","عدم پاسخ")}</strong></div>
   <div className={r.creditAvailable===true?"ok":r.creditAvailable===false?"bad":"warn"}><Activity size={17}/><span>اعتبار</span><strong>{readyLabel(r.creditAvailable,"موجود","ناموجود")}</strong></div>
   <div className={r.serviceLineAvailable===true?"ok":r.serviceLineAvailable===false?"bad":"warn"}><Smartphone size={17}/><span>خط خدماتی</span><strong>{readyLabel(r.serviceLineAvailable,"فعال","در دسترس نیست",data?.config?.lineConfigured?"در حال بررسی":"تنظیم نشده")}</strong></div>
   <div className={(data?.config?.consultantTemplateConfigured||data?.config?.genericTemplateConfigured||data?.config?.lineConfigured)?"ok":"bad"}><Send size={17}/><span>پیامک درخواست مشاور</span><strong>{data?.config?.consultantTemplateConfigured?"قالب اختصاصی":data?.config?.genericTemplateConfigured?"قالب عمومی":data?.config?.lineConfigured?"ارسال مستقیم":"کانال ندارد"}</strong></div>
  </div>

  <Card className={`smsc-automation-card ${jobReminder.enabled?"enabled":"paused"}`}>
   <div className="smsc-automation-main">
    <div className="smsc-automation-icon">{jobReminder.enabled?<Play size={20}/>:<Pause size={20}/>}</div>
    <div><div className="smsc-automation-title"><h3>یادآوری خودکار بانک آگهی</h3><span>{jobReminder.enabled?"فعال":"متوقف"}</span></div><p>پیامک «N آگهی منتظر درخواست شماست» برای مراقبین آزاد در نوبت‌های ۱۰:۱۰، ۱۲:۳۰ و ۱۶:۴۵ ارسال می‌شود.</p><small>{jobReminder.enabled?"در حالت فعال، نوبت‌های بعدی طبق برنامه ساخته و ارسال می‌شوند.":`ارسال‌های جدید متوقف‌اند${jobReminder.pausedAt?` • توقف از ${dateFa(jobReminder.pausedAt)}`:""}.`}</small></div>
   </div>
   <button type="button" className={jobReminder.enabled?"smsc-automation-stop":"smsc-automation-start"} disabled={Boolean(busy)} onClick={()=>void toggleJobBankReminder(!jobReminder.enabled)}>{busy==="job-bank-reminder-control"?(jobReminder.enabled?"در حال توقف...":"در حال فعال‌سازی..."):jobReminder.enabled?<><Pause size={16}/>توقف ارسال خودکار</>:<><Play size={16}/>فعال‌سازی مجدد</>}</button>
  </Card>

  <div className="smsc-metrics">
   <Card><small>کل تلاش ارسال • ۲۴ ساعت</small><strong>{fa(s.total)}</strong><span>هر Attempt یک رکورد مستقل در دفتر ارسال است</span></Card>
   <Card><small>پذیرفته SMS.ir</small><strong>{fa(s.accepted)}</strong><span>قبول توسط provider، نه الزاماً تحویل</span></Card>
   <Card className="smsc-metric-attempt"><small>تلاش‌های ناموفق</small><strong>{fa(s.failedAttempts??s.failed)}</strong><span>تعداد Attempt است؛ نه تعداد مراقب یا شکست نهایی</span></Card>
   <Card className="smsc-metric-success"><small>فعال‌سازی موفق • ۲۴ ساعت</small><strong>{fa(a.sent)}</strong><span>رویدادهای فعال‌سازی که نهایتاً ارسال شده‌اند</span></Card>
   <Card className="smsc-metric-retry"><small>فعال‌سازی در تلاش مجدد</small><strong>{fa(a.retrying)}</strong><span>شکست موقت؛ ارسال خودکار هنوز ادامه دارد</span></Card>
   <Card className="smsc-metric-final"><small>فعال‌سازی ناموفق نهایی</small><strong>{fa(a.finalFailed)}</strong><span>Retry خودکار متوقف؛ نیازمند اصلاح و ارسال مجدد</span></Card>
   <Card><small>کل صف و Retry</small><strong>{fa(queueCount)}</strong><span>{fa(s.automaticQueueRetrying||0)} اتوماسیون در Retry • {fa(s.automaticQueueFinalFailed||0)} ناموفق نهایی</span></Card>
   <Card><small>گزارش SMS.ir</small><strong>{fa(s.providerReports)}</strong><span>{fa(s.withDeliveryTime)} مورد دارای زمان تحویل</span></Card>
  </div>

  <Card className="smsc-table-card">
   <div className="smsc-toolbar"><div><h3>دفتر تلاش‌های ارسال پیامک</h3><small>آخرین {fa(data?.logs?.length||0)} Attempt؛ شکست‌های قدیمی بعد از موفقیت هم برای سابقه باقی می‌مانند.</small></div><div className="smsc-filters"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجو نام، موبایل، شناسه یا خطا"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">همه وضعیت‌ها</option><option value="SENT">پذیرفته SMS.ir</option><option value="FAILED">تلاش ناموفق</option><option value="DEBUG">آزمایشی</option></select><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="ALL">همه انواع پیامک</option>{kinds.map(k=><option key={k} value={k}>{kindFa[k]||k}</option>)}</select></div></div>
   {logs.length?<div className="smsc-table-wrap"><table className="smsc-table"><thead><tr><th>زمان</th><th>نوع پیام</th><th>گیرنده</th><th>وضعیت Attempt</th><th>گزارش SMS.ir</th><th>شناسه / خطا</th></tr></thead><tbody>{logs.map((row:any)=><tr key={row.id}><td><strong>{dateFa(row.createdAt)}</strong><small>{row.provider||"—"}</small></td><td><strong>{kindFa[row.messageKind]||row.messageKind}</strong>{row.sourceCaregiverName&&String(row.recipientRole).toUpperCase()!=="CAREGIVER"?<small>مراقب: {row.sourceCaregiverName} • {row.sourceCaregiverMobile||"—"}</small>:null}</td><td><strong>{row.recipientName||"گیرنده قدیمی"}</strong><small dir="ltr">{row.recipientMobile||"شماره در لاگ قدیمی ذخیره نشده"}</small><small>{row.recipientRole||"—"}</small></td><td><span className={`smsc-status ${String(row.sendStatus||"").toLowerCase()}`}>{sendFa[row.sendStatus]||row.sendStatus}</span></td><td>{providerReport(row)}</td><td><strong className="smsc-code">{row.providerMessageId||"—"}</strong>{(row.errorCode||row.lastCheckError)&&<small className="smsc-error">{row.errorCode||row.lastCheckError}</small>}</td></tr>)}</tbody></table></div>:<Empty title="پیامکی با این فیلتر پیدا نشد" description="فیلترها را تغییر دهید یا پس از ارسال پیامک دوباره بررسی کنید."/>}
  </Card>

  <Card className="smsc-table-card">
   <div className="smsc-toolbar"><div><h3>صف‌های اتوماتیک موجود</h3><small>«در انتظار تلاش مجدد» شکست موقت است؛ فقط «ناموفق نهایی» نیاز به اصلاح یا ارسال مجدد دستی دارد.</small></div></div>
   {(data?.automaticQueues||[]).length?<div className="smsc-table-wrap"><table className="smsc-table"><thead><tr><th>زمان</th><th>اتوماسیون</th><th>گیرنده</th><th>وضعیت صف</th><th>تلاش بعدی</th><th>شناسه / خطا / اقدام</th></tr></thead><tbody>{(data.automaticQueues||[]).map((row:any)=>{const queueState=String(row.queueState||row.status||"").toUpperCase();return <tr key={`${row.queueType}:${row.id}`}><td>{dateFa(row.createdAt)}</td><td><strong>{queueTypeFa[row.queueType]||row.queueType}</strong><small>{row.contextLabel||"—"}</small></td><td><strong>{row.recipientName||"—"}</strong><small dir="ltr">{row.recipientMobile||"—"}</small></td><td><span className={`smsc-outbox ${queueState.toLowerCase()}`}>{queueStateFa[queueState]||outboxFa[row.status]||row.status}</span><small>{fa(row.attemptCount)} تلاش{row.queueType==="ACTIVATION"&&a.maxAttempts?` از حداکثر ${fa(a.maxAttempts)}`:""}</small></td><td>{queueState==="RETRYING"&&row.nextAttemptAt?dateFa(row.nextAttemptAt):queueState==="FINAL_FAILED"?"تلاش خودکار متوقف":row.sentAt?`ارسال: ${dateFa(row.sentAt)}`:row.nextAttemptAt?dateFa(row.nextAttemptAt):"—"}</td><td><strong className="smsc-code">{row.providerMessageId||"—"}</strong>{row.lastError&&<small className="smsc-error">{row.lastError}</small>}{row.queueType==="ACTIVATION"&&queueState==="FINAL_FAILED"&&<button className="smsc-retry" disabled={Boolean(busy)} onClick={()=>void action(`activation-retry:${row.id}`,`/api/admin/sms-center/automatic/ACTIVATION/${encodeURIComponent(row.id)}/retry`,"پیامک فعال‌سازی برای ارسال مجدد پردازش شد.")}><RotateCcw size={14}/>{busy===`activation-retry:${row.id}`?"در حال ارسال...":"ارسال مجدد فعال‌سازی"}</button>}</td></tr>})}</tbody></table></div>:<Empty title="صف اتوماتیک قابل نمایشی وجود ندارد" description="اگر migrationهای پیامک فعال باشند، رویدادهای اتوماتیک اینجا دیده می‌شوند."/>}
  </Card>

  <Card className="smsc-table-card">
   <div className="smsc-toolbar"><div><h3>صف پیامک درخواست آگهی به مشاور</h3><small>این صف مستقل از ثبت درخواست مراقب است؛ خرابی SMS.ir درخواست مراقب را برنمی‌گرداند.</small></div></div>
   {(data?.outbox||[]).length?<div className="smsc-table-wrap"><table className="smsc-table"><thead><tr><th>زمان</th><th>مراقب</th><th>مشاور فروش</th><th>آگهی</th><th>وضعیت</th><th>تلاش / اقدام</th></tr></thead><tbody>{(data.outbox||[]).map((row:any)=><tr key={row.id}><td>{dateFa(row.createdAt)}</td><td><strong>{row.caregiverName}</strong><small dir="ltr">{row.caregiverMobile}</small></td><td><strong>{row.consultantName}</strong><small dir="ltr">{row.consultantMobile}</small></td><td><strong>{[row.contractType,row.shiftType].filter(Boolean).join(" • ")}</strong><small>{[row.city,row.region].filter(Boolean).join(" / ")}</small></td><td><span className={`smsc-outbox ${String(row.status||"").toLowerCase()}`}>{outboxFa[row.status]||row.status}</span>{row.lastError&&<small className="smsc-error">{row.lastError}</small>}{row.nextAttemptAt&&<small>تلاش بعدی: {dateFa(row.nextAttemptAt)}</small>}</td><td><strong>{fa(row.attemptCount)} تلاش</strong>{["FAILED","CANCELLED"].includes(String(row.status))&&<button className="smsc-retry" disabled={Boolean(busy)} onClick={()=>void action(`retry:${row.id}`,`/api/admin/sms-center/outbox/${encodeURIComponent(row.id)}/retry`,"پیامک برای ارسال مجدد پردازش شد.")}><RotateCcw size={14}/>ارسال مجدد</button>}</td></tr>)}</tbody></table></div>:<Empty title="صف پیامک خالی است" description="با ثبت درخواست جدید مراقب، پیامک مشاور در این صف ساخته می‌شود."/>}
  </Card>
 </div>
}
