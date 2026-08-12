import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {BadgeCheck,Sparkles} from "lucide-react";
import {api,fa} from "./caregiver-core-v2";
import "./caregiver-contract-welcome-v1.css";

function ContractWelcome(){
 const [contract,setContract]=useState<any>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;api<any>("/api/caregiver/contracts/active").then(p=>{if(live&&p.data?.welcomePending&&p.data?.activeContract)setContract(p.data.activeContract)}).catch(()=>{});return()=>{live=false}},[]);
 if(!contract)return null;
 const acknowledge=async()=>{setBusy(true);try{await api(`/api/caregiver/contracts/${encodeURIComponent(contract.id)}/welcome-seen`,{method:"POST",body:"{}"});setContract(null)}catch{setBusy(false)}};
 return <div className="ccw-backdrop" role="dialog" aria-modal="true" aria-labelledby="ccw-title"><section className="ccw-card"><div className="ccw-burst"><Sparkles size={31}/><span/><span/><span/></div><small>شبکه مراقبین سلامت اول</small><h2 id="ccw-title">تبریک! شما وارد قرارداد شدید 🎉</h2><p>از این پس با هر <b>روز کامل حضور در قرارداد</b>، بخشی از امتیاز این آگهی به‌صورت خودکار به حساب شما اضافه می‌شود.</p><div className="ccw-facts"><div><strong>{fa(contract.durationDays)}</strong><span>روز قرارداد</span></div><div><strong>{fa(contract.totalPoints)}</strong><span>امتیاز قابل کسب</span></div></div><div className="ccw-note"><BadgeCheck size={18}/><span>اگر قرارداد زودتر متوقف شود، امتیازهای کسب‌شده محفوظ می‌مانند و فقط امتیاز روزهای آینده متوقف می‌شود.</span></div><button onClick={()=>void acknowledge()} disabled={busy}>{busy?"در حال ثبت...":"شروع کنیم"}</button></section></div>;
}

const host=document.createElement("div");host.id="caregiver-contract-welcome-root";document.body.appendChild(host);createRoot(host).render(<ContractWelcome/>);
