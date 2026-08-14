import React,{FormEvent,useEffect,useState} from "react";
import {X} from "lucide-react";
import {api,Card,dateFa,Empty,ErrorState,Loading,Metric,money,Notify,status,text} from "./caregiver-core-v2";

const PERSIAN_DIGITS="۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS="٠١٢٣٤٥٦٧٨٩";
const ONES=["","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه"];
const TEENS=["ده","یازده","دوازده","سیزده","چهارده","پانزده","شانزده","هفده","هجده","نوزده"];
const TENS=["","","بیست","سی","چهل","پنجاه","شصت","هفتاد","هشتاد","نود"];
const HUNDREDS=["","صد","دویست","سیصد","چهارصد","پانصد","ششصد","هفتصد","هشتصد","نهصد"];
const SCALES=["","هزار","میلیون","میلیارد","تریلیون","کوادریلیون"];

function normalizeAmount(value:unknown){
  const ascii=String(value??"")
    .replace(/[۰-۹]/g,d=>String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g,d=>String(ARABIC_DIGITS.indexOf(d)));
  return ascii.replace(/[^0-9]/g,"").replace(/^0+(?=\d)/,"");
}
function formatAmount(raw:string){
  if(!raw)return "";
  const grouped=raw.replace(/\B(?=(\d{3})+(?!\d))/g,"٬");
  return grouped.replace(/\d/g,d=>PERSIAN_DIGITS[Number(d)]||d);
}
function threeDigitWords(value:number){
  const parts:string[]=[];
  const hundreds=Math.floor(value/100),rest=value%100;
  if(hundreds)parts.push(HUNDREDS[hundreds]);
  if(rest>=10&&rest<=19)parts.push(TEENS[rest-10]);
  else{
    const tens=Math.floor(rest/10),ones=rest%10;
    if(tens)parts.push(TENS[tens]);
    if(ones)parts.push(ONES[ones]);
  }
  return parts.filter(Boolean).join(" و ");
}
function amountToWords(raw:string){
  if(!raw)return "مبلغ را وارد کنید";
  let value=Number(raw);
  if(!Number.isSafeInteger(value)||value<0)return `${formatAmount(raw)} تومان`;
  if(value===0)return "صفر تومان";
  const groups:string[]=[];
  let index=0;
  while(value>0&&index<SCALES.length){
    const chunk=value%1000;
    if(chunk)groups.unshift(`${threeDigitWords(chunk)}${SCALES[index]?` ${SCALES[index]}`:""}`);
    value=Math.floor(value/1000);
    index+=1;
  }
  if(value>0)return `${formatAmount(raw)} تومان`;
  return `${groups.join(" و ")} تومان`;
}

export function WalletPage({notify}:{notify:Notify}){
  const [data,setData]=useState<any>(null),[error,setError]=useState(""),[settle,setSettle]=useState(false),[busy,setBusy]=useState(false),[amountRaw,setAmountRaw]=useState("");
  const load=async()=>{setError("");try{const p:any=await api("/api/caregiver/platform/wallet");setData(p.data)}catch(e:any){setError(e.message||"دریافت کیف پول انجام نشد.")}};
  useEffect(()=>{void load()},[]);
  if(error)return <ErrorState message={error} retry={load}/>;
  if(!data)return <Loading label="در حال دریافت کیف پول..."/>;

  const s=data.summary||{},transactions=data.transactions||[],settlements=data.settlements||[];
  const balance=Math.max(0,Number(s.balanceToman||0));
  const settleable=Math.max(0,Number(s.availableToman??s.balanceToman??0));
  const requestedAmount=Number(amountRaw||0);
  const amountInvalid=!amountRaw||requestedAmount<=0||requestedAmount>settleable;
  const openSettlement=()=>{setAmountRaw(String(settleable));setSettle(true)};
  const closeSettlement=()=>{if(!busy)setSettle(false)};
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if(amountInvalid){notify(requestedAmount>settleable?"مبلغ نمی‌تواند بیشتر از مانده کیف پول باشد.":"مبلغ تسویه باید بیشتر از صفر باشد.","error");return}
    setBusy(true);
    try{
      const formData=new FormData(e.currentTarget);
      const body=Object.fromEntries(formData.entries()) as Record<string,unknown>;
      body.amountToman=requestedAmount;
      await api("/api/caregiver/platform/settlements",{method:"POST",body:JSON.stringify(body)});
      notify("درخواست تسویه ثبت شد و مبلغ از مانده کیف پول کسر شد.","success");
      setSettle(false);setAmountRaw("");await load();
    }catch(x:any){notify(x.message||"ثبت درخواست تسویه انجام نشد.","error")}
    finally{setBusy(false)}
  };

  return <div className="mr-stack cg-wallet-v3">
    <style>{`.cg-wallet-v3 .cv-settlement-amount-words{display:block;margin-top:7px;font-size:12px;line-height:1.8;font-weight:800;color:#176b45;min-height:22px}.cg-wallet-v3 .cv-settlement-amount-display[aria-invalid="true"]+.cv-settlement-amount-words{color:#b42318}`}</style>
    <section className="mr-metrics"><Metric label="مانده کیف پول" value={money(balance)}/></section>
    <Card><div className="mr-card-head"><div><h3>کیف پول من</h3><p>پاداش‌ها، واریزها و تسویه‌های ثبت‌شده</p></div><button type="button" className="mr-btn mr-primary" disabled={settleable<=0} onClick={openSettlement}>تقاضای تسویه</button></div></Card>
    <Card><div className="mr-card-head"><h3>تراکنش‌ها</h3></div><div className="mr-list">{transactions.length?transactions.map((item:any)=><article className="mr-row" key={item.id}><div><strong>{text(item.title)}</strong><small>{text(item.description||item.referenceId," ")} • {dateFa(item.createdAt)}</small></div><b className={item.direction==="DEBIT"?"debit":"credit"}>{item.direction==="DEBIT"?"−":"+"} {money(item.amountToman)}</b></article>):<Empty title="تراکنشی ثبت نشده" description="پاداش‌ها و تسویه‌ها بعد از ثبت در این قسمت دیده می‌شوند."/>}</div></Card>
    <Card><div className="mr-card-head"><h3>درخواست‌های تسویه</h3></div><div className="mr-list">{settlements.length?settlements.map((item:any)=><article className="mr-row" key={item.id}><div><strong>{money(item.amountToman)}</strong><small>{dateFa(item.createdAt)}</small></div><span className="mr-pill">{status(item.status)}</span></article>):<Empty title="درخواست تسویه ندارید" description="درخواست‌های تسویه شما در همین بخش پیگیری می‌شوند."/>}</div></Card>
    {settle&&<div className="mr-modal-backdrop"><section className="mr-modal"><button type="button" className="mr-modal-close" onClick={closeSettlement} aria-label="بستن"><X size={20}/></button><form onSubmit={submit} noValidate><h2>تقاضای تسویه</h2><p>مانده کیف پول: <b>{money(balance)}</b></p><label><span>مبلغ (تومان)</span><input className="cv-settlement-amount-display" type="text" inputMode="numeric" autoComplete="off" dir="ltr" value={formatAmount(amountRaw)} onChange={e=>setAmountRaw(normalizeAmount(e.target.value))} aria-invalid={amountInvalid?"true":"false"}/><small className="cv-settlement-amount-words">{amountToWords(amountRaw)}</small></label><label><span>نام صاحب حساب</span><input name="accountHolderName" required/></label><label><span>شماره شبا</span><input name="iban" dir="ltr" placeholder="IR..."/></label><label><span>شماره حساب</span><input name="accountNumber" dir="ltr"/></label><label><span>بانک</span><input name="bankName"/></label><label><span>توضیح</span><textarea name="note"/></label><button type="submit" className="mr-save" disabled={busy||amountInvalid}>{busy?"در حال ثبت...":"ثبت درخواست"}</button></form></section></div>}
  </div>;
}
