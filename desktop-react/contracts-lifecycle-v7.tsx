import React,{useEffect,useRef} from "react";
import {ContractsLifecyclePageV2 as ContractsLifecyclePageV6} from "./contracts-lifecycle-v6";
import {api} from "./core";
import "./contracts-lifecycle-v7.css";

type Props={access:any;notify:(message:string,tone?:"success"|"error"|"info")=>void;mobileCompact?:boolean};

function contractNumberFrom(node:Element){
 return String(node.querySelector(".clv5-contract-cell small, .clvm-card-head small[dir='ltr']")?.textContent||"").trim();
}

export function ContractsLifecyclePageV2(props:Props){
 const hostRef=useRef<HTMLDivElement>(null);
 const isAdmin=String(props.access?.user?.role||"").toUpperCase()==="ADMIN";

 useEffect(()=>{
  const host=hostRef.current;if(!host||!isAdmin)return;
  let disposed=false,enhancing=false;

  const removeContract=async(number:string)=>{
   if(!number)return;
   const lookup:any=await api(`/api/staff/contracts-v2?q=${encodeURIComponent(number)}&page=1&pageSize=100`);
   const contract=(lookup?.data?.contracts||[]).find((row:any)=>String(row?.contract_number||"").trim()===number);
   if(!contract?.id)throw new Error("قرارداد برای حذف پیدا نشد.");
   const title=String(contract.contract_title||number).trim();
   if(!window.confirm(`قرارداد «${title}» حذف شود؟\nاین عملیات فقط برای مدیر سامانه فعال است و قرارداد را از ماژول مدیریت قراردادها حذف می‌کند؛ سوابق عملیاتی و مالی برای حفظ یکپارچگی داده باقی می‌مانند.`))return;
   await api(`/api/staff/contracts-v2/${encodeURIComponent(contract.id)}`,{method:"DELETE"});
   props.notify("قرارداد از فهرست مدیریت قراردادها حذف شد.","success");
   window.setTimeout(()=>window.location.reload(),180);
  };

  const bindDelete=(control:HTMLElement,number:string)=>{
   control.dataset.adminContractDelete="1";
   control.addEventListener("click",event=>{
    event.preventDefault();event.stopPropagation();
    if(control.dataset.busy==="1")return;
    control.dataset.busy="1";
    const previous=control.textContent||"حذف قرارداد";control.textContent="در حال حذف...";
    void removeContract(number).catch((error:any)=>props.notify(error?.message||"حذف قرارداد انجام نشد.","error")).finally(()=>{control.dataset.busy="0";control.textContent=previous});
   });
  };

  const enhance=()=>{
   if(disposed||enhancing)return;enhancing=true;
   try{
    host.querySelectorAll<HTMLTableRowElement>(".clv5-table tbody tr").forEach(row=>{
     if(row.querySelector("[data-admin-contract-delete='1']"))return;
     const number=contractNumberFrom(row),cell=row.querySelector<HTMLElement>(".clv5-contract-cell");if(!number||!cell)return;
     const button=document.createElement("button");button.type="button";button.className="clv7-delete-contract";button.textContent="حذف قرارداد";button.setAttribute("aria-label",`حذف قرارداد ${number}`);bindDelete(button,number);cell.appendChild(button);
    });
    host.querySelectorAll<HTMLElement>(".clvm-card").forEach(card=>{
     if(card.querySelector("[data-admin-contract-delete='1']"))return;
     const number=contractNumberFrom(card);if(!number)return;
     const control=document.createElement("span");control.className="clv7-delete-contract clv7-delete-contract-mobile";control.setAttribute("role","button");control.setAttribute("tabindex","0");control.textContent="حذف قرارداد";control.setAttribute("aria-label",`حذف قرارداد ${number}`);bindDelete(control,number);
     control.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();control.click()}});
     card.appendChild(control);
    });
   }finally{enhancing=false}
  };

  enhance();
  const observer=new MutationObserver(()=>queueMicrotask(enhance));observer.observe(host,{childList:true,subtree:true});
  return()=>{disposed=true;observer.disconnect()};
 },[isAdmin,props.notify]);

 return <div ref={hostRef} className="clv7-host"><ContractsLifecyclePageV6 {...props}/></div>;
}
