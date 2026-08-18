import React,{useEffect,useState} from "react";
import {Phone} from "lucide-react";
import {UsersAccessPageV3} from "./users-access-v3";
import {api,fa,Notify} from "./core";
import "./users-access-v4.css";

type UsersSummary={newRegistrations:number;reregistrations:number;unseenReregistrations:number};
const USERS_RESULT_EVENT="salamat-users-filtered-result-v1";
let activeUsersStatus="",lastUsersListUrl="";
let originalFetch:typeof window.fetch|undefined;

function exactUsersList(input:RequestInfo|URL){try{const value=input instanceof Request?input.url:String(input),url=new URL(value,location.origin);if(url.origin!==location.origin)return null;return url.pathname==="/api/users"||url.pathname==="/api/admin/caregiver-registrations"?url:null}catch{return null}}
function ensureUsersInterceptor(){
 if(originalFetch||typeof window==="undefined")return;
 originalFetch=window.fetch.bind(window);
 window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=exactUsersList(input);if(!url||String(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase()!=="GET")return originalFetch!(input,init);
  if(activeUsersStatus)url.searchParams.set("status",activeUsersStatus);else url.searchParams.delete("status");lastUsersListUrl=url.toString();
  const response=input instanceof Request?await originalFetch!(new Request(url.toString(),input),init):await originalFetch!(url.toString(),init);
  if(url.searchParams.get("export")!=="mobiles")void response.clone().json().then((payload:any)=>{const total=Number(payload?.pagination?.total??payload?.data?.pagination?.total??(Array.isArray(payload?.data)?payload.data.length:0));window.dispatchEvent(new CustomEvent(USERS_RESULT_EVENT,{detail:{total}}))}).catch(()=>undefined);
  return response;
 }) as typeof window.fetch;
}
async function writeClipboard(value:string){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return}const area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();const ok=document.execCommand("copy");area.remove();if(!ok)throw new Error("کپی شماره‌های تماس انجام نشد.")}

export function UsersAccessPageV4({access,notify}:{access:any;notify:Notify}){
 ensureUsersInterceptor();
 const [summary,setSummary]=useState<UsersSummary>({newRegistrations:0,reregistrations:0,unseenReregistrations:0}),[accountStatus,setAccountStatus]=useState(""),[filteredTotal,setFilteredTotal]=useState(0),[copying,setCopying]=useState(false);
 const load=async()=>{try{const p:any=await api("/api/admin/caregiver-registrations/summary");setSummary({newRegistrations:Number(p.data?.newRegistrations||0),reregistrations:Number(p.data?.reregistrations||0),unseenReregistrations:Number(p.data?.unseenReregistrations||0)})}catch{}};
 useEffect(()=>{void load();const id=window.setInterval(load,15000);const sync=(event:Event)=>setFilteredTotal(Number((event as CustomEvent<any>).detail?.total||0));window.addEventListener(USERS_RESULT_EVENT,sync);return()=>{window.clearInterval(id);window.removeEventListener(USERS_RESULT_EVENT,sync);activeUsersStatus="";lastUsersListUrl=""}},[]);
 const open=(registration:string)=>{const url=new URL(location.href);url.pathname="/app/users";url.search="";url.searchParams.set("registration",registration);location.assign(url.toString())};
 const changeStatus=(value:string)=>{setAccountStatus(value);activeUsersStatus=value;window.setTimeout(()=>document.querySelector<HTMLFormElement>(".uav3-search")?.requestSubmit(),0)};
 const copyFilteredMobiles=async()=>{try{setCopying(true);const url=lastUsersListUrl?new URL(lastUsersListUrl):new URL("/api/users",location.origin);url.searchParams.set("export","mobiles");url.searchParams.delete("page");url.searchParams.delete("pageSize");if(activeUsersStatus)url.searchParams.set("status",activeUsersStatus);else url.searchParams.delete("status");const response=await (originalFetch||window.fetch.bind(window))(url.toString(),{credentials:"same-origin",cache:"no-store"});const payload:any=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.message||`خطای ${response.status}`);const csv=String(payload?.data?.mobilesCsv||""),count=Number(payload?.data?.count||0);if(!csv||!count){notify("در نتیجه فعلی شماره همراهی برای کپی وجود ندارد.","info");return}await writeClipboard(csv);notify(`${count.toLocaleString("fa-IR")} شماره تماس با جداکننده , کپی شد.`,"success")}catch(error:any){notify(error?.message||"کپی شماره‌های تماس انجام نشد.","error")}finally{setCopying(false)}};
 return <div className="uav4-wrap"><section className="uav4-network-card"><button type="button" className="uav4-registration-card new" onClick={()=>open("NEW")}><small>ثبت نام جدید</small><strong>{fa(summary.newRegistrations)}</strong><span>جدیدالورودهای در انتظار تأیید</span></button><button type="button" className="uav4-registration-card rereg" onClick={()=>open("REREGISTRATION")}><small>ثبت نام مجددی‌ها</small><strong>{fa(summary.reregistrations)}</strong><span>{summary.unseenReregistrations?`${fa(summary.unseenReregistrations)} مورد هنوز دیده نشده`:"فهرست ثبت‌نام مجدد"}</span></button></section><section className="uav4-live-controls"><label><span>وضعیت حساب</span><select value={accountStatus} onChange={e=>changeStatus(e.target.value)}><option value="">همه وضعیت‌ها</option><option value="ACTIVE">فعال</option><option value="PENDING">در انتظار</option><option value="SUSPENDED">تعلیق</option><option value="INACTIVE">غیرفعال</option></select></label><div className="uav4-result-count"><small>تعداد نتیجه فعلی</small><strong>{filteredTotal.toLocaleString("fa-IR")}</strong><span>کاربر منطبق با جست‌وجو و فیلترهای فعال</span></div><button type="button" className="uav4-copy" disabled={copying} onClick={()=>void copyFilteredMobiles()}><Phone size={17}/><span><strong>{copying?"در حال آماده‌سازی...":"شماره‌های تماس"}</strong><small>کپی همه شماره‌های نتیجه فعلی با جداکننده ,</small></span></button></section><UsersAccessPageV3 access={access} notify={notify}/></div>
}
