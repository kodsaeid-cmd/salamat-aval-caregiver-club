import React,{useEffect} from "react";
import {ContractsLifecyclePageV2 as ContractsLifecyclePageV5} from "./contracts-lifecycle-v5";
import "./contracts-lifecycle-v6.css";

const DATE_LABELS=new Set(["تاریخ شروع از","تاریخ شروع تا","تاریخ پایان از","تاریخ پایان تا"]);

function enhanceJalaliFilters(root:HTMLElement){
 for(const label of Array.from(root.querySelectorAll<HTMLLabelElement>(".clv2-toolbar label"))){
  const title=(label.querySelector("small")?.textContent||"").trim();if(!DATE_LABELS.has(title))continue;
  const input=label.querySelector<HTMLInputElement>("input");if(!input)continue;
  if(input.type!=="text")input.type="text";
  input.inputMode="numeric";
  input.dir="ltr";
  input.placeholder="۱۴۰۵/۰۵/۲۱";
  input.autocomplete="off";
  input.setAttribute("aria-label",`${title} — تاریخ شمسی`);
  input.dataset.jalaliContractFilter="1";
  label.classList.add("clv6-jalali-field");
  let badge=label.querySelector<HTMLElement>(".clv6-jalali-badge");
  if(!badge){badge=document.createElement("em");badge.className="clv6-jalali-badge";badge.textContent="شمسی";label.appendChild(badge)}
 }
}

export function ContractsLifecyclePageV2(props:{access:any;notify:any}){
 useEffect(()=>{
  const host=document.querySelector<HTMLElement>(".clv2");if(!host)return;
  let queued=false;
  const apply=()=>{queued=false;enhanceJalaliFilters(host)};
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(apply)};
  apply();
  const observer=new MutationObserver(schedule);observer.observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:["type"]});
  return()=>observer.disconnect();
 },[]);
 return <ContractsLifecyclePageV5 {...props}/>;
}
